// Text matching of template patterns. Always heuristic: it does not use the Angular template parser.
import type { RawMatch, TemplateMatcher } from './matchers.js';
import { blankHtmlComments } from './text.js';

export const TEMPLATE_REASON = 'Matched by text in a component template, not by the Angular template parser.';

/** Matches in `text`, with offsets shifted by `baseOffset` into the enclosing file. */
export function matchTemplate(text: string, baseOffset: number, templates: readonly TemplateMatcher[]): RawMatch[] {
  const matches: RawMatch[] = [];
  if (templates.length === 0) return matches;
  const visible = blankHtmlComments(text);
  for (const { entry, pattern } of templates) {
    pattern.lastIndex = 0;
    for (let found = pattern.exec(visible); found !== null; found = pattern.exec(visible)) {
      matches.push({ entry, offset: baseOffset + found.index, heuristic: TEMPLATE_REASON });
      if (found[0] === '') pattern.lastIndex++;
    }
  }
  return matches;
}
