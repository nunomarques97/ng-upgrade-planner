import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REMOVED_API_EXCLUDED, REMOVED_APIS } from '../../src/data/removed-apis.js';
import type { RemovedApiEntry, RemovedApiSource, RemovedConfigEntry } from '../../src/data/types.js';
import { isValidPackageName } from '../../src/project/package-name.js';

const { entries, emptyMajors, firstMajor, lastMajor } = REMOVED_APIS;

/**
 * Every source must be https on an official Angular host, and on GitHub only a file in an Angular
 * repo or an Angular CLI release page (release notes before the CLI CHANGELOG starts at 12).
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
    if (/^\/angular\/angular-cli\/releases\/tag\/v\d+\.\d+\.\d+$/.test(url.pathname)) return null;
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

/**
 * Packages a builder option or builder-name entry may name; all other entries name @angular/*.
 * @angular-devkit/build-ng-packagr is listed for its library builder, removed in 11.
 */
const BUILDER_PACKAGES: readonly string[] = ['@angular-devkit/build-angular', '@angular/build', '@angular-devkit/build-ng-packagr'];

function packageProblem(entry: RemovedApiEntry): string | null {
  if (entry.kind === 'config' && entry.builders !== undefined) {
    return BUILDER_PACKAGES.includes(entry.package) ? null : `not a builder package: ${entry.package}`;
  }
  if (!/^@angular\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(entry.package)) return `not an @angular package: ${entry.package}`;
  return isValidPackageName(basePackage(entry.package)) ? null : `not a valid package name: ${entry.package}`;
}

/** A full builder name: an npm package name, a colon and the builder, such as @angular/build:dev-server. */
function builderNameProblem(name: string): string | null {
  const colon = name.lastIndexOf(':');
  if (colon <= 0) return `not in the form package:builder: ${name}`;
  if (!isValidPackageName(name.slice(0, colon))) return `not a valid builder package: ${name}`;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name.slice(colon + 1)) ? null : `not a valid builder: ${name}`;
}

function configProblem(entry: RemovedConfigEntry): string | null {
  if (entry.builders === undefined) {
    if (entry.paths.length === 0) return 'no paths';
    for (const path of entry.paths) {
      if (path.length === 0) return 'empty path';
      if (path.some((part) => part.trim() === '')) return 'empty path part';
      if (path[path.length - 1] === '*') return 'path ends with *';
    }
    return null;
  }
  if (entry.file !== 'angular.json') return 'builder entries apply to angular.json only';
  if ('paths' in entry) return 'builder entries have no paths';
  if (entry.builders.length === 0) return 'no builder names';
  if (new Set(entry.builders).size !== entry.builders.length) return 'repeated builder name';
  for (const name of entry.builders) {
    const problem = builderNameProblem(name);
    if (problem) return problem;
  }
  if (entry.option !== undefined && !/^[A-Za-z_$][\w$-]*$/.test(entry.option)) return `not an option key: ${entry.option}`;
  return null;
}

/** Keys that identify what an entry matches; two entries must never share one. */
function entryKeys(entry: RemovedApiEntry): string[] {
  if (entry.kind === 'symbol') {
    return [[entry.package, entry.symbol, entry.member ?? '', entry.key ?? '', entry.major].join('|')];
  }
  if (entry.kind === 'template') return [[entry.package, entry.pattern, entry.major].join('|')];
  if (entry.builders === undefined) return [[entry.file, ...entry.paths.map((path) => path.join('.')), entry.major].join('|')];
  // One key per builder, so the same option of one builder in two entries is caught.
  return entry.builders.map((name) => [entry.file, 'builder', name, entry.option ?? '', entry.major].join('|'));
}

function hasDuplicateKeys(list: readonly RemovedApiEntry[]): boolean {
  const keys = list.flatMap(entryKeys);
  return new Set(keys).size !== keys.length;
}

/** A well-formed synthetic builder option entry, for the checks of the validation itself. */
function syntheticConfig(fields: Record<string, unknown>): RemovedConfigEntry {
  return {
    id: 'synthetic',
    kind: 'config',
    package: '@angular-devkit/build-angular',
    label: 'synthetic',
    change: 'removed',
    major: 19,
    summary: 'Synthetic.',
    replacement: 'none',
    noReplacementReason: 'Synthetic.',
    migration: 'unknown',
    source: { url: 'https://angular.dev/reference/releases', title: 'Synthetic' },
    file: 'angular.json',
    builders: ['@angular-devkit/build-angular:dev-server'],
    option: 'browserTarget',
    ...fields,
  };
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

  it('names an @angular package or entry point on every entry, or a builder package on builder entries', () => {
    for (const entry of entries) expect(packageProblem(entry), entry.id).toBeNull();
  });

  it('accepts builder packages on builder entries only', () => {
    const symbolEntry = entries.find((entry) => entry.kind === 'symbol');
    if (!symbolEntry) throw new Error('no symbol entry');
    expect(packageProblem({ ...symbolEntry, package: '@angular-devkit/build-angular' })).toMatch(/not an @angular package/);
    expect(packageProblem({ ...symbolEntry, package: '@angular/build' })).toBeNull();
    const pathEntry = syntheticConfig({ builders: undefined, option: undefined, paths: [['defaultProject']] });
    expect(packageProblem({ ...pathEntry, package: '@angular-devkit/build-angular' })).toMatch(/not an @angular package/);
    expect(packageProblem(syntheticConfig({}))).toBeNull();
    expect(packageProblem(syntheticConfig({ package: '@angular/build' }))).toBeNull();
    expect(packageProblem(syntheticConfig({ package: '@angular/core' }))).toMatch(/not a builder package/);
    expect(packageProblem(syntheticConfig({ package: '@nx/angular' }))).toMatch(/not a builder package/);
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
    expect(sourceProblem({ url: 'https://github.com/angular/angular-cli/releases/tag/v10.0.0', title: 'x' })).toBeNull();
    expect(sourceProblem({ url: 'https://github.com/angular/angular/releases/tag/v10.0.0', title: 'x' })).toMatch(/not a file/);
    expect(sourceProblem({ url: 'https://github.com/angular/angular-cli/releases/tag/latest', title: 'x' })).toMatch(/not a file/);
    expect(sourceProblem({ url: 'https://github.com/angular/angular-cli/releases', title: 'x' })).toMatch(/not a file/);
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
        expect(configProblem(entry), entry.id).toBeNull();
      }
    }
  });

  it('rejects malformed config and builder entries', () => {
    const devServer = '@angular-devkit/build-angular:dev-server';
    expect(configProblem(syntheticConfig({}))).toBeNull();
    expect(configProblem(syntheticConfig({ option: undefined }))).toBeNull();
    expect(configProblem(syntheticConfig({ builders: ['@angular/build:dev-server', devServer] }))).toBeNull();
    expect(configProblem(syntheticConfig({ builders: [] }))).toBe('no builder names');
    expect(configProblem(syntheticConfig({ builders: [''] }))).toMatch(/form package:builder/);
    expect(configProblem(syntheticConfig({ builders: ['dev-server'] }))).toMatch(/form package:builder/);
    expect(configProblem(syntheticConfig({ builders: [':dev-server'] }))).toMatch(/form package:builder/);
    expect(configProblem(syntheticConfig({ builders: ['@angular/build:'] }))).toMatch(/not a valid builder/);
    expect(configProblem(syntheticConfig({ builders: ['@angular /build:dev-server'] }))).toMatch(/not a valid builder package/);
    expect(configProblem(syntheticConfig({ builders: [devServer, devServer] }))).toBe('repeated builder name');
    expect(configProblem(syntheticConfig({ option: '' }))).toMatch(/not an option key/);
    expect(configProblem(syntheticConfig({ option: ' aot' }))).toMatch(/not an option key/);
    expect(configProblem(syntheticConfig({ file: 'tsconfig' }))).toMatch(/angular.json only/);
    expect(configProblem(syntheticConfig({ paths: [['projects']] }))).toBe('builder entries have no paths');
    const pathEntry = syntheticConfig({ builders: undefined, option: undefined, paths: [['defaultProject']] });
    expect(configProblem(pathEntry)).toBeNull();
    expect(configProblem(syntheticConfig({ builders: undefined, option: undefined, paths: [] }))).toBe('no paths');
    expect(configProblem(syntheticConfig({ builders: undefined, option: undefined, paths: [['projects', '*']] }))).toBe(
      'path ends with *',
    );
    expect(configProblem(syntheticConfig({ builders: undefined, option: undefined, paths: [['projects', ' ']] }))).toBe(
      'empty path part',
    );
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
    expect(hasDuplicateKeys(entries)).toBe(false);
  });

  it('detects the same builder option or builder in two entries', () => {
    const devServer = '@angular-devkit/build-angular:dev-server';
    const extract = '@angular-devkit/build-angular:extract-i18n';
    const option = syntheticConfig({ id: 'a', builders: [devServer, extract] });
    expect(hasDuplicateKeys([option, syntheticConfig({ id: 'b', builders: [extract] })])).toBe(true);
    expect(hasDuplicateKeys([option, syntheticConfig({ id: 'b', builders: [extract], option: 'aot' })])).toBe(false);
    expect(hasDuplicateKeys([option, syntheticConfig({ id: 'b', builders: [extract], major: 20 })])).toBe(false);
    const builder = syntheticConfig({ id: 'c', builders: [devServer], option: undefined });
    expect(hasDuplicateKeys([option, builder])).toBe(false);
    expect(hasDuplicateKeys([builder, syntheticConfig({ id: 'd', builders: [devServer], option: undefined })])).toBe(true);
  });

  it('is stored as plain ASCII', () => {
    for (const file of ['../../src/data/removed-apis.ts', '../../src/data/types.ts']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect([...text].filter((char) => char.charCodeAt(0) > 0x7f), file).toEqual([]);
    }
  });
});
