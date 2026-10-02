import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REMOVED_API_EXCLUDED, REMOVED_APIS } from '../../src/data/removed-apis.js';
import type { RemovedApiSource } from '../../src/data/types.js';
import { isValidPackageName } from '../../src/project/package-name.js';

const { entries, emptyMajors, firstMajor, lastMajor } = REMOVED_APIS;

/** Every source must be https on an official Angular host, and on GitHub only in an Angular repo. */
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
    return /^\/angular\/(angular|angular-cli)\/blob\/[^/]+\/.+/.test(url.pathname)
      ? null
      : `not a file in angular/angular or angular/angular-cli: ${source.url}`;
  }
  if (url.hostname === 'angular.dev' || url.hostname === 'angular.io') return null;
  if (/^v\d+\.angular\.io$/.test(url.hostname)) return null;
  return `host not allowed: ${url.hostname}`;
}

function basePackage(specifier: string): string {
  return specifier.split('/').slice(0, 2).join('/');
}

describe('removed Angular API dataset', () => {
  it('covers majors 9 to 22 with a retrieval date', () => {
    expect(firstMajor).toBe(9);
    expect(lastMajor).toBe(22);
    expect(REMOVED_APIS.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has unique, well-formed ids', () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('names an @angular package or entry point on every entry', () => {
    for (const entry of entries) {
      expect(entry.package, entry.id).toMatch(/^@angular\/[a-z0-9-]+(\/[a-z0-9-]+)*$/);
      expect(isValidPackageName(basePackage(entry.package)), entry.id).toBe(true);
    }
  });

  it('keeps majors within the covered range', () => {
    for (const entry of entries) {
      expect(Number.isInteger(entry.major), entry.id).toBe(true);
      expect(entry.major, entry.id).toBeGreaterThanOrEqual(firstMajor);
      expect(entry.major, entry.id).toBeLessThanOrEqual(lastMajor);
    }
    for (const empty of emptyMajors) {
      expect(empty.major).toBeGreaterThanOrEqual(firstMajor);
      expect(empty.major).toBeLessThanOrEqual(lastMajor);
    }
  });

  it('uses only the allowed change, kind and migration values', () => {
    for (const entry of entries) {
      expect(['removed', 'breaking'], entry.id).toContain(entry.change);
      expect(['symbol', 'template', 'config'], entry.id).toContain(entry.kind);
      expect(['yes', 'no', 'unknown'], entry.id).toContain(entry.migration);
    }
  });

  it('backs every yes or no migration value with the migration list it was read from', () => {
    for (const entry of entries) {
      if (entry.migration === 'unknown') continue;
      expect(entry.migrationSource, entry.id).toBeDefined();
      if (entry.migrationSource) {
        expect(sourceProblem(entry.migrationSource), entry.id).toBeNull();
        expect(entry.migrationSource.url, entry.id).toMatch(/migrations?(-collection)?\.json$/);
        expect(entry.migrationSource.title, entry.id).toContain(`${entry.major}.0.0`);
      }
    }
  });

  it('cites an official https source on every entry, empty major and exclusion', () => {
    const sources: [string, RemovedApiSource][] = [];
    for (const entry of entries) {
      sources.push([entry.id, entry.source]);
      for (const reference of entry.references ?? []) sources.push([entry.id, reference]);
    }
    for (const empty of emptyMajors) sources.push([`empty ${empty.major}`, empty.source]);
    for (const excluded of REMOVED_API_EXCLUDED) {
      if (excluded.source) sources.push([excluded.candidate, excluded.source]);
    }
    for (const [owner, source] of sources) expect(sourceProblem(source), owner).toBeNull();
  });

  it('rejects sources outside the official hosts', () => {
    expect(sourceProblem({ url: 'http://angular.dev/update-guide', title: 'x' })).toMatch(/not https/);
    expect(sourceProblem({ url: 'https://blog.example.com/angular', title: 'x' })).toMatch(/host not allowed/);
    expect(sourceProblem({ url: 'https://github.com/someone/angular/blob/main/CHANGELOG.md', title: 'x' })).toMatch(
      /not a file/,
    );
    expect(sourceProblem({ url: 'https://angular.dev.example.com/', title: 'x' })).toMatch(/host not allowed/);
    expect(sourceProblem({ url: 'https://v12.angular.io/guide/deprecations', title: 'x' })).toBeNull();
  });

  it('gives a replacement, or none with a reason', () => {
    for (const entry of entries) {
      expect(entry.replacement.trim(), entry.id).not.toBe('');
      if (entry.replacement === 'none') {
        expect(entry.noReplacementReason?.trim(), entry.id).toBeTruthy();
      } else {
        expect(entry.noReplacementReason, entry.id).toBeUndefined();
      }
      expect(entry.label.trim(), entry.id).not.toBe('');
      expect(entry.summary.trim(), entry.id).not.toBe('');
    }
  });

  it('describes a usable pattern for each kind', () => {
    for (const entry of entries) {
      if (entry.kind === 'symbol') {
        expect(entry.symbol, entry.id).toMatch(/^(\*|[A-Za-z_$][\w$]*)$/);
        if (entry.member !== undefined) expect(entry.member, entry.id).toMatch(/^[A-Za-z_$][\w$]*$/);
        if (entry.key !== undefined) expect(entry.key, entry.id).toMatch(/^[A-Za-z_$][\w$]*$/);
        if (entry.symbol === '*') {
          expect(entry.member ?? entry.key ?? entry.withoutTypeArguments, entry.id).toBeUndefined();
        }
      } else if (entry.kind === 'template') {
        expect(() => new RegExp(entry.pattern, 'g'), entry.id).not.toThrow();
        expect(new RegExp(entry.pattern).test(''), entry.id).toBe(false);
      } else {
        expect(['angular.json', 'tsconfig'], entry.id).toContain(entry.file);
        expect(entry.paths.length, entry.id).toBeGreaterThan(0);
        for (const path of entry.paths) {
          expect(path.length, entry.id).toBeGreaterThan(0);
          for (const part of path) expect(part.trim(), entry.id).not.toBe('');
          expect(path[path.length - 1], entry.id).not.toBe('*');
        }
      }
    }
  });

  it('matches the template patterns it is meant to find', () => {
    const pattern = (id: string): RegExp => {
      const entry = entries.find((candidate) => candidate.id === id);
      if (entry?.kind !== 'template') throw new Error(`${id} is not a template entry`);
      return new RegExp(entry.pattern);
    };
    expect(pattern('v9-forms-ngform-element').test('<ngForm #f="ngForm">')).toBe(true);
    expect(pattern('v9-forms-ngform-element').test('<ngForm>')).toBe(true);
    expect(pattern('v9-forms-ngform-element').test('<form ngForm>')).toBe(false);
    expect(pattern('v9-forms-ngform-element').test('<ngFormGroup>')).toBe(false);
    expect(pattern('v11-router-preserve-query-params-template').test('<a routerLink="/x" preserveQueryParams>')).toBe(
      true,
    );
    expect(pattern('v11-router-preserve-query-params-template').test('[preserveQueryParamsX]="y"')).toBe(false);
  });

  it('has at least one entry or an explicit empty record for every major', () => {
    const withEntries = new Set(entries.map((entry) => entry.major));
    const empty = new Set(emptyMajors.map((record) => record.major));
    for (let major = firstMajor; major <= lastMajor; major++) {
      expect(withEntries.has(major) || empty.has(major), `major ${major}`).toBe(true);
      expect(withEntries.has(major) && empty.has(major), `major ${major} is both covered and empty`).toBe(false);
    }
    for (const record of emptyMajors) expect(record.reason.trim()).not.toBe('');
  });

  it('records why each excluded candidate was left out', () => {
    expect(REMOVED_API_EXCLUDED.length).toBeGreaterThan(0);
    for (const excluded of REMOVED_API_EXCLUDED) {
      expect(excluded.candidate.trim()).not.toBe('');
      expect(excluded.package.trim(), excluded.candidate).not.toBe('');
      expect(excluded.reason.trim(), excluded.candidate).not.toBe('');
      expect(['no-official-source', 'internal-api', 'not-detectable', 'outside-scope']).toContain(excluded.category);
      expect(excluded.major).toBeGreaterThanOrEqual(firstMajor);
      expect(excluded.major).toBeLessThanOrEqual(lastMajor);
    }
  });

  it('does not list the same API twice', () => {
    const keys = entries.map((entry) => {
      if (entry.kind === 'symbol') {
        return [entry.package, entry.symbol, entry.member ?? '', entry.key ?? '', entry.major].join('|');
      }
      if (entry.kind === 'template') return [entry.package, entry.pattern, entry.major].join('|');
      return [entry.file, ...entry.paths.map((path) => path.join('.')), entry.major].join('|');
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is stored as plain ASCII', () => {
    for (const file of ['../../src/data/removed-apis.ts', '../../src/data/types.ts']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect([...text].filter((char) => char.charCodeAt(0) > 0x7f), file).toEqual([]);
    }
  });
});
