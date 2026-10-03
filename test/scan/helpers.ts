// Shared helpers for the scan tests: a small synthetic dataset and temporary project folders.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  RemovedApiData,
  RemovedApiEntry,
  RemovedBuilderEntry,
  RemovedBuilderOptionEntry,
  RemovedConfigPathEntry,
  RemovedSymbolEntry,
  RemovedTemplateEntry,
} from '../../src/data/types.js';
import type { ScanFinding } from '../../src/scan/index.js';

export const SYNTHETIC_PROJECT = fileURLToPath(new URL('../fixtures/synthetic/scan/project', import.meta.url));

const SOURCE = { url: 'https://angular.dev/reference/releases', title: 'Synthetic test entry' };

type Base = Pick<RemovedApiEntry, 'id' | 'package' | 'major'> & Partial<Pick<RemovedApiEntry, 'migration'>>;

function base(fields: Base): Omit<RemovedSymbolEntry, 'kind' | 'symbol'> {
  return {
    label: fields.id,
    change: 'removed',
    summary: `${fields.id} changed.`,
    replacement: `instead of ${fields.id}`,
    migration: 'unknown',
    source: SOURCE,
    ...fields,
  };
}

function symbol(
  fields: Base & Pick<RemovedSymbolEntry, 'symbol'> & Partial<Pick<RemovedSymbolEntry, 'member' | 'key' | 'withoutTypeArguments'>>,
): RemovedSymbolEntry {
  return { ...base(fields), kind: 'symbol', ...fields };
}

function template(fields: Base & Pick<RemovedTemplateEntry, 'pattern'>): RemovedTemplateEntry {
  return { ...base(fields), kind: 'template', ...fields };
}

function config(fields: Base & Pick<RemovedConfigPathEntry, 'file' | 'paths'>): RemovedConfigPathEntry {
  return { ...base(fields), kind: 'config', ...fields };
}

function builderOption(fields: Base & Pick<RemovedBuilderOptionEntry, 'builders' | 'option'>): RemovedBuilderOptionEntry {
  return { ...base(fields), kind: 'config', file: 'angular.json', ...fields };
}

function builder(fields: Base & Pick<RemovedBuilderEntry, 'builders'>): RemovedBuilderEntry {
  return { ...base(fields), kind: 'config', file: 'angular.json', ...fields };
}

/** Synthetic dataset for the scan tests, independent of the bundled data. */
export const TEST_DATA: RemovedApiData = {
  retrieved: '2026-10-02',
  firstMajor: 9,
  lastMajor: 22,
  emptyMajors: [],
  entries: [
    symbol({ id: 'renderer', package: '@angular/core', symbol: 'Renderer', major: 9, migration: 'yes' }),
    symbol({ id: 'reflective-injector', package: '@angular/core', symbol: 'ReflectiveInjector', major: 16 }),
    symbol({ id: 'xhr-factory', package: '@angular/common/http', symbol: 'XhrFactory', major: 16, migration: 'no' }),
    symbol({ id: 'testing-async', package: '@angular/core/testing', symbol: 'async', major: 18 }),
    symbol({ id: 'transfer-state', package: '@angular/platform-browser', symbol: 'TransferState', major: 18 }),
    symbol({ id: 'make-state-key', package: '@angular/platform-browser', symbol: 'makeStateKey', major: 18 }),
    symbol({ id: 'webworker', package: '@angular/platform-webworker', symbol: '*', major: 11 }),
    symbol({ id: 'webworker-dynamic', package: '@angular/platform-webworker-dynamic', symbol: '*', major: 11 }),
    symbol({
      id: 'encapsulation-native',
      package: '@angular/core',
      symbol: 'ViewEncapsulation',
      member: 'Native',
      major: 11,
    }),
    symbol({ id: 'test-bed-get', package: '@angular/core/testing', symbol: 'TestBed', member: 'get', major: 20 }),
    symbol({
      id: 'module-with-providers',
      package: '@angular/core',
      symbol: 'ModuleWithProviders',
      withoutTypeArguments: true,
      major: 10,
    }),
    symbol({
      id: 'relative-link-resolution',
      package: '@angular/router',
      symbol: 'RouterModule',
      member: 'forRoot',
      key: 'relativeLinkResolution',
      major: 15,
    }),
    symbol({
      id: 'malformed-uri',
      package: '@angular/router',
      symbol: 'RouterModule',
      member: 'forRoot',
      key: 'malformedUriErrorHandler',
      major: 17,
    }),
    symbol({ id: 'entry-components', package: '@angular/core', symbol: 'NgModule', key: 'entryComponents', major: 16 }),
    symbol({ id: 'module-id', package: '@angular/core', symbol: 'Component', key: 'moduleId', major: 21 }),
    template({ id: 'ngform-element', package: '@angular/forms', pattern: '<ngForm(?=[\\s/>])', major: 9 }),
    template({ id: 'preserve-query-params', package: '@angular/router', pattern: '\\bpreserveQueryParams\\b', major: 11 }),
    config({
      id: 'enable-ivy',
      package: '@angular/compiler-cli',
      file: 'tsconfig',
      paths: [['angularCompilerOptions', 'enableIvy']],
      major: 15,
    }),
    config({ id: 'default-project', package: '@angular/cli', file: 'angular.json', paths: [['defaultProject']], major: 16 }),
    config({
      id: 'default-collection',
      package: '@angular/cli',
      file: 'angular.json',
      paths: [
        ['cli', 'defaultCollection'],
        ['projects', '*', 'cli', 'defaultCollection'],
      ],
      major: 16,
    }),
    builderOption({
      id: 'extract-css',
      package: '@angular-devkit/build-angular',
      builders: ['@angular-devkit/build-angular:browser'],
      option: 'extractCss',
      major: 13,
    }),
    builderOption({
      id: 'browser-target',
      package: '@angular-devkit/build-angular',
      builders: ['@angular-devkit/build-angular:dev-server', '@angular-devkit/build-angular:extract-i18n'],
      option: 'browserTarget',
      major: 19,
      migration: 'yes',
    }),
    builder({
      id: 'tslint-builder',
      package: '@angular-devkit/build-angular',
      builders: ['@angular-devkit/build-angular:tslint'],
      major: 13,
      migration: 'no',
    }),
  ],
};

/** A source line that imports a removed API, used to plant hits in folders that must be skipped. */
export const HIT = "import { Renderer } from '@angular/core';\n";

export function tempFolder(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function removeFolder(folder: string): void {
  rmSync(folder, { recursive: true, force: true });
}

/** Writes files (posix paths relative to `root`), creating folders as needed. */
export function writeFiles(root: string, files: Readonly<Record<string, string>>): void {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, ...file.split('/'));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

/** A copy of the synthetic project in a new temporary folder. */
export function copySyntheticProject(): string {
  const root = tempFolder('ngup-scan-');
  cpSync(SYNTHETIC_PROJECT, root, { recursive: true });
  return root;
}

/** `file:line:column entry confidence`, compact for comparisons. */
export function brief(finding: ScanFinding): string {
  return `${finding.file}:${finding.line}:${finding.column} ${finding.entryId} ${finding.confidence}`;
}
