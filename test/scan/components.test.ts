// Scan of the synthetic Angular Material and CDK sources (test/fixtures/synthetic/scan/material)
// with the bundled data: Material and CDK symbols, entry points and template patterns are found by
// the same import-aware and template rules as the framework entries, and nothing else is.
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { scan, type ScanResult } from '../../src/scan/index.js';
import { TEMPLATE_REASON } from '../../src/scan/template.js';
import { brief } from './helpers.js';

const MATERIAL_PROJECT = fileURLToPath(new URL('../fixtures/synthetic/scan/material', import.meta.url));

let result: ScanResult;

function inFile(file: string): string[] {
  return result.findings.filter((finding) => finding.file === file).map(brief);
}

beforeAll(async () => {
  result = await scan(MATERIAL_PROJECT, REMOVED_APIS);
});

describe('Angular Material and CDK scan', () => {
  it('finds Material and CDK symbols, a static member and whole entry points by import', () => {
    expect(inFile('src/app/positives.ts')).toEqual([
      'src/app/positives.ts:2:10 v11-material-core-jan confirmed',
      'src/app/positives.ts:2:15 v21-material-core-mat-common-module confirmed',
      'src/app/positives.ts:3:10 v20-cdk-portal-portal-injector confirmed',
      'src/app/positives.ts:4:39 v17-material-legacy-button confirmed',
      'src/app/positives.ts:5:33 v9-material-primary-entry-point confirmed',
      'src/app/positives.ts:6:10 v21-material-select-mat-select-animations confirmed',
      'src/app/positives.ts:7:10 v13-cdk-clipboard-ckd-copy-to-clipboard-config confirmed',
      'src/app/positives.ts:9:21 v20-material-select-mat-select-animations-transform-panel-wrap confirmed',
    ]);
  });

  it('follows aliased and namespace imports and leaves symbols that still exist alone', () => {
    // stepper.MatStepper on line 8 is the replacement and must not count.
    expect(inFile('src/app/aliased.ts')).toEqual([
      'src/app/aliased.ts:1:10 v20-cdk-portal-dom-portal-host confirmed',
      'src/app/aliased.ts:5:24 v13-cdk-overlay-connected-position-strategy confirmed',
      'src/app/aliased.ts:7:25 v14-material-stepper-mat-vertical-stepper confirmed',
    ]);
  });

  it('ignores the same names from a local file, another package or a look-alike entry point', () => {
    // @angular/material/button and @angular/material-moment-adapter are not the removed
    // @angular/material entry point, and @angular/cdk-experimental/menu is not @angular/cdk/menu.
    expect(inFile('src/app/other-package.ts')).toEqual([]);
  });

  it('ignores names that appear only in comments and strings', () => {
    expect(inFile('src/app/comments-strings.ts')).toEqual([]);
  });

  it('matches the template patterns as heuristic findings, only on the element they belong to', () => {
    expect(inFile('src/app/lists.component.html')).toEqual([
      // matTextareaAutosize and matAutosizeMinRows; not cdkTextareaAutosize on line 2.
      'src/app/lists.component.html:1:20 v13-material-input-textarea-autosize-template heuristic',
      'src/app/lists.component.html:1:40 v13-material-input-textarea-autosize-template heuristic',
      // checkboxPosition on mat-list-option; not on app-option (line 5).
      'src/app/lists.component.html:3:19 v22-material-list-checkbox-position-input heuristic',
      // (copied) next to cdkCopyToClipboard; not on a plain button (line 7) or in the comment (line 8).
      'src/app/lists.component.html:6:37 v10-cdk-clipboard-copied-output heuristic',
    ]);
    const finding = result.findings.find((item) => item.file === 'src/app/lists.component.html');
    expect(finding?.reason).toBe(TEMPLATE_REASON);
  });

  it('copies the major, package, replacement and migration status of the entry', () => {
    expect(result.findings.find((finding) => finding.entryId === 'v17-material-legacy-button')).toMatchObject({
      package: '@angular/material/legacy-button',
      api: '@angular/material/legacy-button',
      change: 'removed',
      major: 17,
      replacement: '@angular/material/button',
      migration: 'no',
    });
    expect(result.findings.find((finding) => finding.entryId === 'v10-cdk-clipboard-copied-output')).toMatchObject({
      package: '@angular/cdk/clipboard',
      major: 10,
      replacement: '(cdkCopyToClipboardCopied)',
      migration: 'yes',
    });
  });

  it('reads every synthetic file', () => {
    expect(result.unscanned).toEqual([]);
    expect(result.filesScanned).toBe(5);
  });
});
