// Text safety for every output format. Plan strings can come from the registry (peer ranges,
// deprecation messages), the project (names, ranges) or the update guide (Markdown step text),
// so all of them are treated as untrusted and cleaned or escaped for the format they end up in.

/* eslint-disable no-control-regex */
// ANSI escape sequences: CSI (ESC [ or the C1 byte 0x9b), OSC (ESC ] ... BEL or ST), and the
// remaining two-byte ESC sequences.
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u009b[0-?]*[ -/]*[@-~]|\u001b\][\s\S]*?(?:\u0007|\u001b\\|$)|\u001b[ -/]*[0-~]?/g;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
/* eslint-enable no-control-regex */
// Bidirectional overrides and isolates can make text display in a different order than it is stored.
const BIDI = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Displayable text on one line: ANSI escape sequences and bidirectional controls are removed,
 * other control characters (line breaks included) become spaces and runs of spaces collapse.
 * Leading and trailing spaces are kept, so fragments can be joined.
 */
export function cleanFragment(value: string): string {
  return value.replace(ANSI, '').replace(BIDI, '').replace(CONTROL, ' ').replace(/ {2,}/g, ' ');
}

/** cleanFragment without leading and trailing spaces. */
export function cleanText(value: string): string {
  return cleanFragment(value).trim();
}

export function escapeHtml(value: string): string {
  return cleanFragment(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Inline Markdown text. Characters that can start emphasis, links, images, raw HTML, entities,
 * code spans or strikethrough are backslash-escaped, and so is `|` so the text is safe in table
 * cells. Text is never placed at the start of a line, so block markers need no escaping.
 */
export function escapeMarkdown(value: string): string {
  return cleanFragment(value).replace(/[\\`*_[\]<>|~&!]/g, '\\$&');
}

/**
 * Inline Markdown code span. The fence is longer than any backtick run in the text. In a table
 * cell `|` must still be escaped; GitHub removes the backslash inside code spans in tables.
 */
export function markdownCode(value: string, inTable = false): string {
  let text = cleanText(value);
  if (inTable) text = text.replace(/\|/g, '\\|');
  if (text === '') return '';
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** The URL when it is an absolute https URL without credentials, otherwise null. */
export function safeHttpsUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(cleanText(value));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return null;
  return url.href;
}

export type StepToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  /** `url` is null when the link target is not a safe https URL; `target` is the original text. */
  | { kind: 'link'; text: string; url: string | null; target: string }
  | { kind: 'break' };

// Link targets may contain one level of balanced parentheses, as in https://example.com/a_(b).
const STEP_TOKEN = /(`+)([\s\S]*?[^`])\1(?!`)|\[([^\]\n]*)\]\(\s*((?:[^\s()]|\([^\s()]*\))*)\s*\)|<br\s*\/?>/gi;

/**
 * Splits update guide step text (a small Markdown subset) into tokens: code spans, links and
 * line breaks. Everything else, including any other HTML, is plain text.
 */
export function stepTokens(action: string): StepToken[] {
  const tokens: StepToken[] = [];
  const text = (value: string): void => {
    if (value !== '') tokens.push({ kind: 'text', text: value });
  };
  let last = 0;
  for (const match of action.matchAll(STEP_TOKEN)) {
    text(action.slice(last, match.index));
    last = match.index + match[0].length;
    if (match[1] !== undefined) {
      tokens.push({ kind: 'code', text: match[2]! });
    } else if (match[3] !== undefined) {
      const target = match[4]!;
      tokens.push({ kind: 'link', text: match[3], url: safeHttpsUrl(target), target });
    } else {
      tokens.push({ kind: 'break' });
    }
  }
  text(action.slice(last));
  return tokens;
}

/** Percent-encodes the characters that would end or confuse a Markdown link destination. */
export function markdownUrl(url: string): string {
  return url.replace(/[()<>\s\\`]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

function linkLabel(token: Extract<StepToken, { kind: 'link' }>): string {
  return cleanText(token.text) || cleanText(token.target);
}

/** Step text as inline Markdown. Only https links stay links; others show their target as text. */
export function stepMarkdown(action: string): string {
  return stepTokens(action)
    .map((token) => {
      switch (token.kind) {
        case 'text':
          return escapeMarkdown(token.text);
        case 'code':
          return markdownCode(token.text);
        case 'break':
          return '<br>';
        case 'link':
          return token.url !== null
            ? `[${escapeMarkdown(linkLabel(token))}](${markdownUrl(token.url)})`
            : `${escapeMarkdown(token.text)} (${escapeMarkdown(token.target)})`;
      }
    })
    .join('')
    .trim();
}

/** Step text as inline HTML. Only https links stay links; others show their target as text. */
export function stepHtml(action: string): string {
  return stepTokens(action)
    .map((token) => {
      switch (token.kind) {
        case 'text':
          return escapeHtml(token.text);
        case 'code':
          return `<code>${escapeHtml(token.text)}</code>`;
        case 'break':
          return '<br>';
        case 'link':
          return token.url !== null
            ? `<a href="${escapeHtml(token.url)}" rel="noopener noreferrer">${escapeHtml(linkLabel(token))}</a>`
            : `${escapeHtml(token.text)} (${escapeHtml(token.target)})`;
      }
    })
    .join('')
    .trim();
}

/** Step text as plain text for the terminal. */
export function stepPlain(action: string): string {
  return cleanText(
    stepTokens(action)
      .map((token) => {
        switch (token.kind) {
          case 'text':
          case 'code':
            return token.text;
          case 'break':
            return ' ';
          case 'link':
            return `${token.text} (${token.target})`;
        }
      })
      .join(''),
  );
}
