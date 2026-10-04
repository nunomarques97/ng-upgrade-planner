import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REMOVED_API_EXCLUDED, REMOVED_APIS } from '../../src/data/removed-apis.js';
import type { RemovedApiAudit, RemovedApiEntry, RemovedApiSource, RemovedConfigEntry } from '../../src/data/types.js';
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
    return /^\/angular\/(angular|angular-cli|components)\/blob\/[^/]+\/.+/.test(url.pathname)
      ? null
      : `not a file in angular/angular, angular/angular-cli or angular/components: ${source.url}`;
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

const AUDIT_STATUSES: readonly string[] = ['confirmed', 'corrected', 'removed', 'unverified', 'added'];

/** Statuses an entry still in the dataset can carry; removed records live on REMOVED_API_EXCLUDED. */
const ENTRY_STATUSES = ['confirmed', 'corrected', 'unverified', 'added'];

/**
 * An audit record needs a known status and a real read date no earlier than the data itself; every
 * status except confirmed must say in its note what changed, why it was removed or why the source
 * could not be read.
 */
function auditProblem(audit: RemovedApiAudit | undefined): string | null {
  if (audit === undefined) return 'no audit record';
  if (!AUDIT_STATUSES.includes(audit.status)) return `unknown status: ${String(audit.status)}`;
  const date = new Date(`${audit.read}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(audit.read) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== audit.read) {
    return `not a date: ${audit.read}`;
  }
  if (audit.read < REMOVED_APIS.retrieved) return `read before the data was written: ${audit.read}`;
  if (audit.note !== undefined && audit.note.trim() === '') return 'empty note';
  if (audit.status !== 'confirmed' && audit.note === undefined) return `${audit.status} without a note`;
  return null;
}

function auditReport(): string {
  return readFileSync(new URL('../../docs/verification/data-audit.md', import.meta.url), 'utf8');
}

/** The opening of docs/verification/data-audit.md, before its first section. */
function auditSummary(): string {
  const text = auditReport();
  return text.slice(0, text.indexOf('\n## '));
}

/** Entry ids and statuses listed in the per-entry tables of docs/verification/data-audit.md. */
function auditReportRows(): Map<string, string> {
  const text = auditReport();
  const rows = new Map<string, string>();
  for (const [, id = '', status = ''] of text.matchAll(/^\| `([a-z0-9-]+)` \| (\w+) \|/gm)) {
    if (rows.has(id)) throw new Error(`${id} is listed twice`);
    rows.set(id, status);
  }
  return rows;
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
    audit: { status: 'added', read: REMOVED_APIS.retrieved, note: 'Synthetic.' },
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

  it('does not claim the v12 i18n migration fixes options it can leave in place', () => {
    // remove-deprecated-i18n-options keeps i18nFile and i18nLocale when outputPath does not end in the locale.
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    for (const id of ['v12-build-angular-i18n-file', 'v12-build-angular-i18n-locale']) {
      expect(byId.get(id)?.migration, id).toBe('unknown');
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

  it('accepts files of angular/components and rejects its other pages, other repositories and hosts', () => {
    const problem = (url: string): string | null => sourceProblem({ url, title: 'x' });
    expect(problem('https://github.com/angular/components/blob/f6c2a193ec4ad454beeafc74469103fecfc96a12/CHANGELOG.md')).toBeNull();
    expect(problem('https://github.com/angular/components/releases/tag/v17.0.0')).toMatch(/not a file/);
    expect(problem('https://github.com/angular/components/tree/main/src')).toMatch(/not a file/);
    expect(problem('https://github.com/angular/components')).toMatch(/not a file/);
    expect(problem('https://github.com/angular/material2/blob/x/CHANGELOG.md')).toMatch(/not a file/);
    expect(problem('https://github.com/angular/components-fork/blob/x/CHANGELOG.md')).toMatch(/not a file/);
    expect(problem('https://github.com/someone/components/blob/x/CHANGELOG.md')).toMatch(/not a file/);
    expect(problem('http://github.com/angular/components/blob/x/CHANGELOG.md')).toMatch(/not https/);
    expect(problem('https://raw.githubusercontent.com/angular/components/x/CHANGELOG.md')).toMatch(/host not allowed/);
    expect(problem('https://github.com.example.com/angular/components/blob/x/CHANGELOG.md')).toMatch(/host not allowed/);
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
    const outlet = pattern('v21-common-ng-component-outlet-ng-module-factory');
    expect(outlet.test('<ng-container [ngComponentOutletNgModuleFactory]="factory">')).toBe(true);
    expect(outlet.test('<ng-container *ngComponentOutlet="comp; ngModuleFactory: factory">')).toBe(true);
    expect(outlet.test("<ng-container *ngComponentOutlet='comp;\n  ngModuleFactory factory'>")).toBe(true);
    expect(outlet.test('<ng-container *ngComponentOutlet="comp; ngModule: module">')).toBe(false);
    expect(outlet.test('<ng-container [ngComponentOutletNgModule]="module">')).toBe(false);
    expect(outlet.test('<other [ngModuleFactory]="factory">')).toBe(false);
    const copied = pattern('v10-cdk-clipboard-copied-output');
    expect(copied.test('<button [cdkCopyToClipboard]="text" (copied)="done()">')).toBe(true);
    expect(copied.test('<button (copied)="done()" cdkCopyToClipboard="text">')).toBe(true);
    expect(copied.test('<button (copied)="done()">')).toBe(false);
    expect(copied.test('<a cdkCopyToClipboard="x"></a><b (copied)="done()">')).toBe(false);
    const position = pattern('v22-material-list-checkbox-position-input');
    expect(position.test('<mat-list-option [checkboxPosition]="\'before\'">')).toBe(true);
    expect(position.test('<mat-list-option\n  value="a"\n  checkboxPosition="after">')).toBe(true);
    expect(position.test('<app-option checkboxPosition="before">')).toBe(false);
    expect(position.test('<mat-list-option></mat-list-option><b checkboxPosition="x">')).toBe(false);
    expect(position.test('<mat-list-option [checkboxPositionX]="x">')).toBe(false);
  });

  it('scans a large template without angle brackets quickly', () => {
    // Template patterns run at every position of files up to 1 MB, so none may scan back or ahead
    // over the whole text before its literal part has matched.
    const text = 'lorem ipsum (copied) checkboxPosition cdkCopyToClipboard '.repeat(4).padEnd(1_000_000, 'lorem ipsum ');
    const started = performance.now();
    let matches = 0;
    for (const entry of entries) {
      if (entry.kind === 'template') matches += [...text.matchAll(new RegExp(entry.pattern, 'g'))].length;
    }
    expect(performance.now() - started).toBeLessThan(2000);
    // Only the 4 (copied) texts followed by cdkCopyToClipboard with no bracket between them.
    expect(matches).toBe(4);
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

  it('carries a well-formed audit status on every bundled entry', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(auditProblem(entry.audit), entry.id).toBeNull();
      expect(ENTRY_STATUSES, entry.id).toContain(entry.audit.status);
    }
  });

  it('keeps audit records of exclusions well-formed and marked removed', () => {
    for (const excluded of REMOVED_API_EXCLUDED) {
      if (excluded.audit === undefined) continue;
      expect(auditProblem(excluded.audit), excluded.candidate).toBeNull();
      expect(excluded.audit.status, excluded.candidate).toBe('removed');
    }
  });

  it('rejects malformed audit records', () => {
    const read = REMOVED_APIS.retrieved;
    expect(auditProblem({ status: 'confirmed', read })).toBeNull();
    expect(auditProblem({ status: 'confirmed', read, note: 'Context.' })).toBeNull();
    expect(auditProblem({ status: 'corrected', read, note: 'replacement: X instead of Y.' })).toBeNull();
    expect(auditProblem({ status: 'added', read, note: 'Written from the source.' })).toBeNull();
    expect(auditProblem(undefined)).toBe('no audit record');
    expect(auditProblem({ status: 'checked' as RemovedApiAudit['status'], read })).toMatch(/unknown status/);
    expect(auditProblem({ status: 'confirmed', read: '' })).toMatch(/not a date/);
    expect(auditProblem({ status: 'confirmed', read: '2026-02-30' })).toMatch(/not a date/);
    expect(auditProblem({ status: 'confirmed', read: '3 October 2026' })).toMatch(/not a date/);
    expect(auditProblem({ status: 'confirmed', read: '2020-01-01' })).toMatch(/before the data was written/);
    expect(auditProblem({ status: 'confirmed', read, note: ' ' })).toBe('empty note');
    for (const status of ['corrected', 'removed', 'unverified', 'added'] as const) {
      expect(auditProblem({ status, read }), status).toBe(`${status} without a note`);
      expect(auditProblem({ status, read, note: '' }), status).toBe('empty note');
    }
  });

  it('lists every entry in docs/verification/data-audit.md with its status', () => {
    const rows = auditReportRows();
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    for (const entry of entries) expect(rows.get(entry.id), entry.id).toBe(entry.audit.status);
    const removedNotes = REMOVED_API_EXCLUDED.flatMap((excluded) => (excluded.audit ? [excluded.audit.note ?? ''] : []));
    for (const [id, status] of rows) {
      const entry = byId.get(id);
      // A removed entry is no longer in the dataset; its record moves to REMOVED_API_EXCLUDED and names the id.
      if (status === 'removed') {
        expect(entry, id).toBeUndefined();
        expect(removedNotes.filter((note) => note.startsWith(`Was entry ${id}.`)), id).toHaveLength(1);
        continue;
      }
      expect(entry?.audit.status, id).toBe(status);
    }
    expect([...rows.values()].filter((status) => status === 'removed')).toHaveLength(removedNotes.length);
  });

  it('opens docs/verification/data-audit.md with counts per major that match the data', () => {
    // Columns: entries read (every status except added), then one per status in AUDIT_STATUSES order.
    const counts = new Map<string, number[]>();
    const add = (major: string, status: string): void => {
      const row = counts.get(major) ?? [0, 0, 0, 0, 0, 0];
      if (status !== 'added') row[0] = (row[0] ?? 0) + 1;
      const column = AUDIT_STATUSES.indexOf(status) + 1;
      row[column] = (row[column] ?? 0) + 1;
      counts.set(major, row);
    };
    const records = [
      ...entries.map((entry) => ({ major: entry.major, audit: entry.audit })),
      ...REMOVED_API_EXCLUDED.flatMap((excluded) => (excluded.audit ? [{ major: excluded.major, audit: excluded.audit }] : [])),
    ];
    for (const record of records) {
      add(String(record.major), record.audit.status);
      add('All', record.audit.status);
    }
    const table = new Map<string, number[]>();
    for (const [, major = '', cells = ''] of auditSummary().matchAll(/^\| (\d+|All) \|((?: \d+ \|){6})$/gm)) {
      table.set(
        major,
        cells
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell) => cell !== '')
          .map(Number),
      );
    }
    expect(table).toEqual(counts);
    expect(table.size).toBe(lastMajor - firstMajor + 2);
  });

  it('names every corrected entry in the summary of docs/verification/data-audit.md', () => {
    const summary = auditSummary();
    for (const entry of entries) {
      if (entry.audit.status === 'corrected') expect(summary, entry.id).toContain(`\`${entry.id}\``);
    }
  });

  it('keeps the corrections of the Angular 16 to 22 audit', () => {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    // No ng update migration removes the usage the scan finds for these entries.
    for (const id of [
      'v21-core-ignore-changes-outside-zone',
      'v22-upgrade-get-angular-lib',
      'v22-upgrade-set-angular-lib',
      'v22-compiler-cli-full-template-type-check',
    ]) {
      expect(byId.get(id)?.migration, id).toBe('no');
      expect(byId.get(id)?.migrationSource?.url, id).toMatch(/\/packages\/core\/schematics\/migrations\.json$/);
    }
    // Both symbols still compile in 22, so an import of either must not become a finding again.
    const symbols = new Set(entries.flatMap((entry) => (entry.kind === 'symbol' ? [entry.symbol] : [])));
    expect(symbols.has('NgModuleFactory')).toBe(false);
    expect(symbols.has('HttpXhrBackend')).toBe(false);
  });

  it('is stored as plain ASCII', () => {
    for (const file of ['../../src/data/removed-apis.ts', '../../src/data/components-apis.ts', '../../src/data/types.ts']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect([...text].filter((char) => char.charCodeAt(0) > 0x7f), file).toEqual([]);
    }
  });
});
