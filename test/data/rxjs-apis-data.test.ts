// Checks the bundled RxJS 7 data: every entry names rxjs or one of its entry points, cites the
// official RxJS breaking-changes document or CHANGELOG at a pinned commit, carries audit status
// 'added', and matches something no other entry matches. Exclusions say why a breaking change is not an entry.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEPRECATED_APIS } from '../../src/data/deprecated-apis.js';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { RXJS_API_EXCLUDED, RXJS_APIS } from '../../src/data/rxjs-apis.js';
import type { RxjsApiEntry, RxjsApiSource } from '../../src/data/types.js';

const { entries, retrieved } = RXJS_APIS;

/** The two official RxJS documents that list breaking changes, as files of ReactiveX/rxjs. */
const RXJS_FILES = /^\/ReactiveX\/rxjs\/blob\/[0-9a-f]{40}\/(CHANGELOG\.md|docs_app\/content\/deprecations\/breaking-changes\.md)$/;

/**
 * A source must be https: the RxJS CHANGELOG or breaking-changes document in ReactiveX/rxjs at a
 * full commit, or a page on rxjs.dev.
 */
function sourceProblem(source: RxjsApiSource): string | null {
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
    return RXJS_FILES.test(url.pathname) ? null : `not an RxJS breaking-changes file at a commit: ${source.url}`;
  }
  if (url.hostname === 'rxjs.dev') return null;
  return `host not allowed: ${url.hostname}`;
}

/** rxjs itself or one of its entry points, such as rxjs/operators or rxjs/Rx. */
function packageProblem(name: string): string | null {
  return /^rxjs(\/[A-Za-z0-9-]+)*$/.test(name) ? null : `not rxjs or an rxjs entry point: ${name}`;
}

/** Problems with one entry's fields. */
function entryProblem(entry: RxjsApiEntry): string | null {
  if (!/^rx7-[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) return `not an id: ${entry.id}`;
  const packageIssue = packageProblem(entry.package);
  if (packageIssue) return packageIssue;
  if (entry.kind !== 'symbol') return `unknown kind: ${String(entry.kind)}`;
  if (entry.symbol.trim() === '') return 'empty symbol';
  if (entry.rxjsMajor !== 7) return `not RxJS 7: ${String(entry.rxjsMajor)}`;
  if (!['removed', 'breaking'].includes(entry.change)) return `unknown change: ${entry.change}`;
  if (entry.minArguments !== undefined) {
    if (!Number.isInteger(entry.minArguments) || entry.minArguments < 1) return `not an argument count: ${entry.minArguments}`;
    if (entry.symbol === '*' || entry.member !== undefined) return 'minArguments applies to a call of a named symbol only';
  }
  for (const field of ['label', 'summary', 'replacement'] as const) {
    if (entry[field].trim() === '') return `empty ${field}`;
  }
  if (entry.replacement === 'none' && !entry.noReplacementReason?.trim()) return 'no replacement without a reason';
  for (const source of [entry.source, ...(entry.references ?? [])]) {
    const problem = sourceProblem(source);
    if (problem) return problem;
  }
  if (entry.audit.status !== 'added') return `audit status ${entry.audit.status}, not added`;
  if (entry.audit.read !== retrieved) return `audit read ${entry.audit.read}, not the retrieval date`;
  if (!entry.audit.note?.trim()) return 'audit without a note';
  return null;
}

function matchKey(entry: RxjsApiEntry): string {
  return [entry.package, entry.symbol, entry.member ?? '', String(entry.minArguments ?? '')].join('|');
}

const COMMIT = 'e5351d02e225e275ac0e497c7b66eaa5f0c88791';

function valid(fields: Partial<RxjsApiEntry>): RxjsApiEntry {
  return {
    kind: 'symbol',
    id: 'rx7-synthetic',
    package: 'rxjs',
    symbol: 'iif',
    minArguments: 3,
    label: 'iif()',
    change: 'breaking',
    rxjsMajor: 7,
    summary: 'Synthetic.',
    replacement: 'pass EMPTY',
    source: { url: `https://github.com/ReactiveX/rxjs/blob/${COMMIT}/CHANGELOG.md?plain=1#L382`, title: 'CHANGELOG' },
    audit: { status: 'added', read: retrieved, note: 'Synthetic.' },
    ...fields,
  };
}

describe('RxJS 7 breaking-change dataset', () => {
  it('has a retrieval date and entries for RxJS 7', () => {
    expect(retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(RXJS_APIS.rxjsMajor).toBe(7);
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.map((entry) => [entry.id, entry] as const))('%s is well formed', (_id, entry) => {
    expect(entryProblem(entry)).toBeNull();
  });

  it('carries audit status added on every entry', () => {
    expect(entries.map((entry) => entry.audit.status)).toEqual(entries.map(() => 'added'));
  });

  it('has unique ids, distinct from the Angular data ids, and no two entries matching the same thing', () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const angular = new Set([...REMOVED_APIS.entries, ...DEPRECATED_APIS.entries].map((entry) => entry.id));
    expect(ids.filter((id) => angular.has(id))).toEqual([]);
    const keys = entries.map(matchKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lists every excluded candidate with a category, a reason and an official source', () => {
    expect(RXJS_API_EXCLUDED.length).toBeGreaterThan(0);
    const categories = ['not-detectable', 'outside-scope', 'no-official-source', 'already-broken'];
    for (const item of RXJS_API_EXCLUDED) {
      expect(categories, item.candidate).toContain(item.category);
      expect(item.reason.trim(), item.candidate).not.toBe('');
      expect(packageProblem(item.package), item.candidate).toBeNull();
      expect(sourceProblem(item.source), item.candidate).toBeNull();
    }
    const candidates = RXJS_API_EXCLUDED.map((item) => item.candidate);
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it('validation rejects malformed entries', () => {
    expect(entryProblem(valid({}))).toBeNull();
    expect(entryProblem(valid({ package: 'rxjs/operators' }))).toBeNull();
    expect(entryProblem(valid({ package: '@angular/core' }))).toBe('not rxjs or an rxjs entry point: @angular/core');
    expect(entryProblem(valid({ package: 'rxjs-compat' }))).toBe('not rxjs or an rxjs entry point: rxjs-compat');
    expect(entryProblem(valid({ id: 'v7-synthetic' }))).toBe('not an id: v7-synthetic');
    expect(entryProblem(valid({ minArguments: 0 }))).toBe('not an argument count: 0');
    expect(entryProblem(valid({ member: 'create' }))).toBe('minArguments applies to a call of a named symbol only');
    expect(entryProblem(valid({ audit: { status: 'confirmed', read: retrieved } }))).toBe('audit status confirmed, not added');
    expect(entryProblem(valid({ replacement: 'none' }))).toBe('no replacement without a reason');
    expect(entryProblem(valid({ change: 'renamed' as RxjsApiEntry['change'] }))).toBe('unknown change: renamed');
  });

  it('source check accepts the RxJS breaking-changes files at a commit and rxjs.dev, and rejects other hosts', () => {
    const at = (url: string): string | null => sourceProblem({ url, title: 'x' });
    expect(at(`https://github.com/ReactiveX/rxjs/blob/${COMMIT}/CHANGELOG.md?plain=1#L273`)).toBeNull();
    expect(at(`https://github.com/ReactiveX/rxjs/blob/${COMMIT}/docs_app/content/deprecations/breaking-changes.md?plain=1#L36`)).toBeNull();
    expect(at('https://rxjs.dev/deprecations/breaking-changes')).toBeNull();
    expect(at('https://github.com/ReactiveX/rxjs/blob/7.x/CHANGELOG.md')).toMatch(/^not an RxJS breaking-changes file/);
    expect(at(`https://github.com/ReactiveX/rxjs/blob/${COMMIT}/src/index.ts`)).toMatch(/^not an RxJS breaking-changes file/);
    expect(at(`https://github.com/evil/rxjs/blob/${COMMIT}/CHANGELOG.md`)).toMatch(/^not an RxJS breaking-changes file/);
    expect(at('https://angular.dev/reference/releases')).toBe('host not allowed: angular.dev');
    expect(at('https://rxjs.dev.evil.example/x')).toBe('host not allowed: rxjs.dev.evil.example');
    expect(at('https://www.learnrxjs.io/learn-rxjs')).toBe('host not allowed: www.learnrxjs.io');
    expect(at('http://rxjs.dev/x')).toMatch(/^not https/);
    expect(at('https://user@rxjs.dev/x')).toMatch(/^unexpected URL parts/);
  });

  it('is stored as plain ASCII', () => {
    const text = readFileSync(new URL('../../src/data/rxjs-apis.ts', import.meta.url), 'utf8');
    expect([...text].filter((char) => char.charCodeAt(0) > 127)).toEqual([]);
  });
});
