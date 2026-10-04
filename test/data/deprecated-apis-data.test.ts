// Checks the bundled deprecated-API data: every entry names the major that deprecated the API, a
// later announced removal major and an official source, carries audit status 'added', and matches
// something no other entry matches. Exclusions say why a deprecation is not an entry.
import { describe, expect, it } from 'vitest';
import { DEPRECATED_API_EXCLUDED, DEPRECATED_APIS, deprecationCoverage } from '../../src/data/deprecated-apis.js';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import type { DeprecatedApiEntry, RemovedApiSource } from '../../src/data/types.js';
import { isValidPackageName } from '../../src/project/package-name.js';

const { entries, retrieved } = DEPRECATED_APIS;

/**
 * A source must be https: a file of angular/angular at a release tag or commit (the deprecation
 * notice, with its line), or a page on angular.dev.
 */
function sourceProblem(source: RemovedApiSource): string | null {
  if (source.title.trim() === '') return 'empty title';
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return `not a URL: ${source.url}`;
  }
  if (url.protocol !== 'https:') return `not https: ${source.url}`;
  if (url.username !== '' || url.password !== '' || url.port !== '') return `unexpected URL parts: ${source.url}`;
  if (url.hostname === 'github.com') {
    return /^\/angular\/angular\/blob\/(v\d+\.\d+\.\d+|[0-9a-f]{40})\/.+/.test(url.pathname)
      ? null
      : `not a file of angular/angular at a release tag or commit: ${source.url}`;
  }
  if (url.hostname === 'angular.dev') return null;
  return `host not allowed: ${url.hostname}`;
}

/** Problems with one entry's fields. */
function entryProblem(entry: DeprecatedApiEntry): string | null {
  if (!/^d\d+-[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) return `not an id: ${entry.id}`;
  if (!entry.id.startsWith(`d${entry.removalMajor}-`)) return `id does not start with d${entry.removalMajor}-`;
  if (!/^@angular\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(entry.package)) return `not an @angular package: ${entry.package}`;
  if (!isValidPackageName(entry.package.split('/').slice(0, 2).join('/'))) return `not a valid package name: ${entry.package}`;
  if (!Number.isInteger(entry.deprecatedIn) || entry.deprecatedIn < 2) return `not a major: ${entry.deprecatedIn}`;
  if (!Number.isInteger(entry.removalMajor)) return `not a major: ${entry.removalMajor}`;
  if (entry.removalMajor <= entry.deprecatedIn) return `removal ${entry.removalMajor} is not after the deprecation ${entry.deprecatedIn}`;
  for (const field of ['label', 'summary', 'replacement'] as const) {
    if (entry[field].trim() === '') return `empty ${field}`;
  }
  if (entry.replacement === 'none' && !entry.noReplacementReason?.trim()) return 'no replacement without a reason';
  const sources = [entry.source, ...(entry.references ?? [])];
  for (const source of sources) {
    const problem = sourceProblem(source);
    if (problem) return problem;
  }
  if (entry.kind === 'symbol' && entry.symbol.trim() === '') return 'empty symbol';
  if (entry.kind === 'template') {
    try {
      new RegExp(entry.pattern, 'g');
    } catch {
      return `invalid pattern: ${entry.pattern}`;
    }
  }
  if (entry.audit.status !== 'added') return `audit status ${entry.audit.status}, not added`;
  if (entry.audit.read !== retrieved) return `audit read ${entry.audit.read}, not the retrieval date`;
  if (!entry.audit.note?.trim()) return 'audit without a note';
  // The note quotes the notice, which names the removal major.
  if (!entry.audit.note.includes(`v${entry.removalMajor}`)) return `audit note does not quote the removal in v${entry.removalMajor}`;
  return null;
}

function matchKey(entry: DeprecatedApiEntry): string {
  return entry.kind === 'symbol'
    ? [entry.package, entry.symbol, entry.member ?? '', entry.key ?? ''].join('|')
    : [entry.package, entry.pattern].join('|');
}

function valid(fields: Partial<DeprecatedApiEntry>): DeprecatedApiEntry {
  return {
    kind: 'symbol',
    id: 'd23-synthetic',
    package: '@angular/animations',
    symbol: 'trigger',
    label: 'trigger()',
    deprecatedIn: 20,
    removalMajor: 23,
    summary: 'Synthetic.',
    replacement: 'animate.enter',
    source: { url: 'https://github.com/angular/angular/blob/v22.2.1/packages/animations/src/animation_metadata.ts#L650', title: 'Notice' },
    audit: { status: 'added', read: retrieved, note: 'Intent to remove in v23' },
    ...fields,
  } as DeprecatedApiEntry;
}

describe('deprecated Angular API dataset', () => {
  it('has a retrieval date and entries', () => {
    expect(retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.map((entry) => [entry.id, entry] as const))('%s is well formed', (_id, entry) => {
    expect(entryProblem(entry)).toBeNull();
  });

  it('has unique ids, distinct from the removed-API ids, and no two entries matching the same thing', () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const removed = new Set(REMOVED_APIS.entries.map((entry) => entry.id));
    expect(ids.filter((id) => removed.has(id))).toEqual([]);
    const keys = entries.map(matchKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('announces removals after the newest major of the removed-API data', () => {
    // An announced removal in a released major is either in the removed-API data or did not happen
    // (excluded as removal-passed), so no entry may announce one.
    for (const entry of entries) expect(entry.removalMajor, entry.id).toBeGreaterThan(REMOVED_APIS.lastMajor);
  });

  it('reports the removal majors it covers', () => {
    const coverage = deprecationCoverage(DEPRECATED_APIS);
    expect(coverage.retrieved).toBe(retrieved);
    expect(coverage.removalMajors).toEqual([...new Set(entries.map((entry) => entry.removalMajor))].sort((a, b) => a - b));
  });

  it('lists every excluded candidate with a category, a reason and an official source', () => {
    expect(DEPRECATED_API_EXCLUDED.length).toBeGreaterThan(0);
    const categories = ['no-removal-major', 'removal-passed', 'not-detectable', 'internal-api'];
    for (const item of DEPRECATED_API_EXCLUDED) {
      expect(categories, item.candidate).toContain(item.category);
      expect(item.reason.trim(), item.candidate).not.toBe('');
      expect(item.package, item.candidate).toMatch(/^@angular\/[a-z0-9-]+(\/[a-z0-9-]+)*$/);
      expect(sourceProblem(item.source), item.candidate).toBeNull();
      if (item.category === 'removal-passed') expect(item.deprecatedIn, item.candidate).not.toBeNull();
    }
    const candidates = DEPRECATED_API_EXCLUDED.map((item) => item.candidate);
    expect(new Set(candidates).size).toBe(candidates.length);
    // Deprecations without an announced removal major are listed, not silently dropped.
    expect(DEPRECATED_API_EXCLUDED.filter((item) => item.category === 'no-removal-major').length).toBeGreaterThan(0);
  });

  it('validation rejects malformed entries', () => {
    expect(entryProblem(valid({}))).toBeNull();
    expect(entryProblem(valid({ removalMajor: 20, id: 'd20-synthetic' }))).toBe('removal 20 is not after the deprecation 20');
    expect(entryProblem(valid({ removalMajor: 19, id: 'd19-synthetic' }))).toBe('removal 19 is not after the deprecation 20');
    expect(entryProblem(valid({ id: 'd24-synthetic' }))).toBe('id does not start with d23-');
    expect(entryProblem(valid({ package: 'rxjs' }))).toBe('not an @angular package: rxjs');
    expect(entryProblem(valid({ audit: { status: 'confirmed', read: retrieved } }))).toBe('audit status confirmed, not added');
    expect(entryProblem(valid({ audit: { status: 'added', read: retrieved, note: 'Intent to remove in v24' } }))).toBe(
      'audit note does not quote the removal in v23',
    );
    expect(entryProblem(valid({ replacement: 'none' }))).toBe('no replacement without a reason');
    expect(entryProblem(valid({ kind: 'template', pattern: '[' }))).toBe('invalid pattern: [');
  });

  it('source check accepts angular/angular files at a tag or commit and angular.dev, and rejects the rest', () => {
    const at = (url: string): string | null => sourceProblem({ url, title: 'x' });
    expect(at('https://github.com/angular/angular/blob/v22.2.1/packages/core/src/metadata/directives.ts#L601')).toBeNull();
    expect(at(`https://github.com/angular/angular/blob/${'a'.repeat(40)}/CHANGELOG.md#2000-2025-05-28`)).toBeNull();
    expect(at('https://angular.dev/guide/animations/migration')).toBeNull();
    expect(at('https://github.com/angular/angular/blob/main/packages/core/src/x.ts')).toMatch(/^not a file of angular\/angular/);
    expect(at('https://github.com/angular/components/blob/v22.0.0/CHANGELOG.md')).toMatch(/^not a file of angular\/angular/);
    expect(at('https://github.com/evil/angular/blob/v22.2.1/x.ts')).toMatch(/^not a file of angular\/angular/);
    expect(at('http://angular.dev/guide')).toMatch(/^not https/);
    expect(at('https://angular.dev.evil.example/guide')).toBe('host not allowed: angular.dev.evil.example');
    expect(at('https://user@angular.dev/guide')).toMatch(/^unexpected URL parts/);
  });
});
