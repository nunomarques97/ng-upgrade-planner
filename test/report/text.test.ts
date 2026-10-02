import { describe, expect, it } from 'vitest';
import {
  cleanText,
  escapeHtml,
  escapeMarkdown,
  markdownCode,
  safeHttpsUrl,
  stepHtml,
  stepMarkdown,
  stepPlain,
  stepTokens,
} from '../../src/report/text.js';

describe('cleanText', () => {
  it('removes ANSI escape sequences, control characters and bidirectional controls', () => {
    const text = 'a\u001b[31mred\u001b[0m b\u001b]8;;https://evil.example\u0007link\u001b]8;;\u001b\\ c\u009b2Jd\u202eevil\u2066e\r\nf\tg\u0000h\u001bc';
    const clean = cleanText(text);
    expect(clean).toBe('ared blink cdevile f g h');
    // eslint-disable-next-line no-control-regex
    expect(clean).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/);
  });

  it('collapses spaces and trims', () => {
    expect(cleanText('  a   b  ')).toBe('a b');
  });
});

describe('escapeHtml', () => {
  it('escapes markup and quotes', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
  });
});

describe('escapeMarkdown', () => {
  it('escapes link, HTML, emphasis, code, entity and table characters', () => {
    expect(escapeMarkdown('[x](javascript:alert(1)) <b>*y*</b> _z_ `c` a|b &amp; ~~s~~ ![i]')).toBe(
      '\\[x\\](javascript:alert(1)) \\<b\\>\\*y\\*\\</b\\> \\_z\\_ \\`c\\` a\\|b \\&amp; \\~\\~s\\~\\~ \\!\\[i\\]',
    );
  });
});

describe('markdownCode', () => {
  it('uses a fence longer than any backtick run', () => {
    expect(markdownCode('a``b')).toBe('```a``b```');
    expect(markdownCode('`x')).toBe('`` `x ``');
  });

  it('escapes pipes only inside tables', () => {
    expect(markdownCode('a|b', true)).toBe('`a\\|b`');
    expect(markdownCode('a|b')).toBe('`a|b`');
  });
});

describe('safeHttpsUrl', () => {
  it('accepts absolute https URLs only', () => {
    expect(safeHttpsUrl('https://angular.dev/guide')).toBe('https://angular.dev/guide');
    expect(safeHttpsUrl('HTTPS://Angular.dev/a b')).toBe('https://angular.dev/a%20b');
    for (const bad of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'java\u0000script:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://angular.dev',
      'vbscript:x',
      '//evil.example',
      '/relative',
      'https://user:pass@evil.example',
    ]) {
      expect(safeHttpsUrl(bad), bad).toBeNull();
    }
  });
});

describe('step text', () => {
  const action =
    'Run `ng update <x>` [docs](https://angular.dev/a_(b)) then [bad](javascript:alert(1))<br/>next <iframe> line | end';

  it('tokenizes code spans, links and line breaks', () => {
    expect(stepTokens(action).map((token) => token.kind)).toEqual(['text', 'code', 'text', 'link', 'text', 'link', 'break', 'text']);
  });

  it('keeps https links and neutralises other links in Markdown', () => {
    const md = stepMarkdown(action);
    expect(md).toContain('`ng update <x>`');
    expect(md).toContain('[docs](https://angular.dev/a_%28b%29)');
    expect(md).not.toMatch(/\]\(javascript:/i);
    expect(md).toContain('bad (javascript:alert(1))');
    expect(md).toContain('\\<iframe\\>');
    expect(md).toContain('line \\| end');
  });

  it('keeps https links and neutralises other links in HTML', () => {
    const html = stepHtml(action);
    expect(html).toContain('<code>ng update &lt;x&gt;</code>');
    expect(html).toContain('<a href="https://angular.dev/a_(b)" rel="noopener noreferrer">docs</a>');
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('bad (javascript:alert(1))');
    expect(html).toContain('<br>next &lt;iframe&gt;');
  });

  it('flattens to plain text for the terminal', () => {
    expect(stepPlain('a `b` [c](https://x.example)<br>\u001b[2Jd')).toBe('a b c (https://x.example) d');
  });
});
