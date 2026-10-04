// One scan of the synthetic project with the real bundled dataset.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { scan, type ScanResult } from '../../src/scan/index.js';
import { brief, copySyntheticProject, removeFolder, tempFolder, writeFiles } from './helpers.js';

let root: string;
let result: ScanResult;

beforeAll(async () => {
  root = copySyntheticProject();
  result = await scan(root, REMOVED_APIS);
});

afterAll(() => removeFolder(root));

describe('scan with the bundled removed-API data', () => {
  it('finds the planted usages of real dataset entries', () => {
    const ids = new Set(result.findings.map((finding) => finding.entryId));
    for (const id of [
      'v9-core-renderer',
      'v9-forms-ngform-element',
      'v10-core-module-with-providers-generic',
      'v11-core-view-encapsulation-native',
      'v11-platform-webworker',
      'v11-router-preserve-query-params-template',
      'v15-compiler-cli-enable-ivy',
      'v15-router-relative-link-resolution',
      'v16-cli-default-collection',
      'v16-cli-default-project',
      'v16-common-http-xhr-factory',
      'v16-core-ng-module-entry-components',
      'v16-core-reflective-injector',
      'v17-router-malformed-uri-error-handler',
      'v18-core-testing-async',
      'v18-platform-browser-make-state-key',
      'v18-platform-browser-transfer-state',
      'v20-core-testing-test-bed-get',
      'v21-core-component-module-id',
      'v22-compiler-cli-full-template-type-check',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('copies each finding from its dataset entry', () => {
    const byId = new Map(REMOVED_APIS.entries.map((entry) => [entry.id, entry]));
    for (const finding of result.findings) {
      const entry = byId.get(finding.entryId);
      expect(entry, finding.entryId).toBeDefined();
      if (!entry) continue;
      expect(finding).toMatchObject({
        package: entry.package,
        api: entry.label,
        change: entry.change,
        major: entry.major,
        replacement: entry.replacement,
        migration: entry.migration,
        // Template text matches and options under a wrapping third-party builder are heuristic.
        confidence: entry.kind === 'template' || finding.reason !== undefined ? 'heuristic' : 'confirmed',
      });
    }
  });

  it('finds the removed builder options and builders of the synthetic angular.json, scoped to their builder', () => {
    const found = result.findings
      .filter((finding) => finding.file === 'angular.json')
      .map((finding) => `${finding.line} ${finding.entryId} ${finding.major}`);
    expect(found.sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b))).toEqual([
      '4 v16-cli-default-project 16',
      '5 v16-cli-default-collection 16',
      '9 v16-cli-default-collection 16',
      // extractCss in the browser target: options and a configurations entry.
      '14 v13-build-angular-extract-css 13',
      '16 v13-build-angular-extract-css 13',
      // browserTarget in the dev-server target: options and a configurations entry.
      '26 v19-build-angular-browser-target 19',
      '28 v19-build-angular-browser-target 19',
      // browserTarget in the extract-i18n target: a configurations entry and options.
      '33 v19-build-angular-browser-target 19',
      '34 v19-build-angular-browser-target 19',
      '43 v13-build-angular-tslint-builder 13',
      // extractCss in a configurations entry under the "targets" alias.
      '62 v13-build-angular-extract-css 13',
      // Options under third-party builders that extend the Angular builders.
      '67 v13-build-angular-extract-css 13',
      '71 v19-build-angular-browser-target 19',
    ]);
  });

  it('gives no builder finding outside the affected builders', () => {
    // Root and project level keys, a target without a builder, the third-party builders and a
    // non-string builder use the same option names: none of them counts.
    const lines = [10, 14, 17, 22, 38, 39, 40, 47, 48, 51, 52, 76];
    const builderEntries = new Set(
      REMOVED_APIS.entries.filter((entry) => entry.kind === 'config' && entry.builders !== undefined).map((entry) => entry.id),
    );
    const unexpected = result.findings.filter(
      (finding) => finding.file === 'angular.json' && builderEntries.has(finding.entryId) && lines.includes(finding.line),
    );
    // Line 14 holds a real extractCss option at column 51 and a nested one that must not count.
    expect(unexpected.map((finding) => `${finding.line}:${finding.column} ${finding.entryId}`)).toEqual([
      '14:51 v13-build-angular-extract-css',
    ]);
  });

  it('finds the NgComponentOutlet ngModuleFactory input and not the symbols the data audit removed', async () => {
    const project = tempFolder('ngup-scan-audit-');
    try {
      writeFiles(project, {
        'src/app/inline.component.ts': [
          "import { Component, NgModuleFactory } from '@angular/core';",
          "import { HttpXhrBackend } from '@angular/common/http';",
          '@Component({',
          "  selector: 'app-inline',",
          '  template: `<ng-container *ngComponentOutlet="comp; ngModuleFactory: factory"></ng-container>`,',
          '})',
          'export class InlineComponent {',
          '  factory?: NgModuleFactory<unknown>;',
          '  backend?: HttpXhrBackend;',
          '}',
          '',
        ].join('\n'),
        'src/app/external.component.ts':
          "import { Component } from '@angular/core';\n@Component({ templateUrl: './external.component.html' })\nexport class ExternalComponent {}\n",
        'src/app/external.component.html': [
          '<ng-container *ngComponentOutlet="comp; ngModule: module"></ng-container>',
          '<ng-container [ngComponentOutlet]="comp" [ngComponentOutletNgModuleFactory]="factory"></ng-container>',
          '',
        ].join('\n'),
      });
      const audited = await scan(project, REMOVED_APIS);
      expect(audited.findings.map(brief)).toEqual([
        'src/app/external.component.html:2:43 v21-common-ng-component-outlet-ng-module-factory heuristic',
        'src/app/inline.component.ts:5:28 v21-common-ng-component-outlet-ng-module-factory heuristic',
      ]);
    } finally {
      removeFolder(project);
    }
  });

  it('reports nothing in the files that must stay clean', () => {
    const clean = ['src/app/other-package.ts', 'src/app/comments-strings.ts', 'src/app/orphan.html', 'src/app/plain.ts'];
    expect(result.findings.filter((finding) => clean.includes(finding.file))).toEqual([]);
  });
});
