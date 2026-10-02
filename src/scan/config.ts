// Structural matching of angular.json and tsconfig properties.
import { parseJsonc, propertiesAt } from './jsonc.js';
import type { Matchers, RawMatch } from './matchers.js';

/** Throws when the file is not valid JSON with comments. */
export function matchConfig(text: string, file: 'angular.json' | 'tsconfig', matchers: Matchers): RawMatch[] {
  const entries = matchers.configs.filter((entry) => entry.file === file);
  if (entries.length === 0) return [];
  const document = parseJsonc(text);
  const matches: RawMatch[] = [];
  for (const entry of entries) {
    for (const path of entry.paths) {
      for (const property of propertiesAt(document, path)) matches.push({ entry, offset: property.offset });
    }
  }
  return matches;
}
