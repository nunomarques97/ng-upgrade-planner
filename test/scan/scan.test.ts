// Scan of the synthetic project (test/fixtures/synthetic/scan) with a synthetic dataset.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scan, type ScanResult } from '../../src/scan/index.js';
import { brief, copySyntheticProject, removeFolder, TEST_DATA, writeFiles, HIT, tempFolder } from './helpers.js';

let root: string;
let result: ScanResult;

function inFile(file: string): string[] {
  return result.findings.filter((finding) => finding.file === file).map(brief);
}

beforeAll(async () => {
  root = copySyntheticProject();
  result = await scan(root, TEST_DATA);
});

afterAll(() => removeFolder(root));

describe('import-aware TypeScript scan', () => {
  it('finds named imports, members, keyed options, bare types and whole entry points', () => {
    expect(inFile('src/app/positives.ts')).toEqual([
      'src/app/positives.ts:2:41 renderer confirmed',
      'src/app/positives.ts:3:10 xhr-factory confirmed',
      'src/app/positives.ts:4:10 testing-async confirmed',
      'src/app/positives.ts:6:8 webworker confirmed',
      'src/app/positives.ts:8:30 encapsulation-native confirmed',
      'src/app/positives.ts:11:28 module-with-providers confirmed',
      'src/app/positives.ts:19:51 relative-link-resolution confirmed',
      'src/app/positives.ts:20:24 test-bed-get confirmed',
      'src/app/positives.ts:22:13 entry-components confirmed',
      'src/app/positives.ts:26:17 webworker-dynamic confirmed',
    ]);
  });

  it('does not report a member, option or type that is still supported', () => {
    // ViewEncapsulation.Emulated on line 9 and ModuleWithProviders<AppModule> on line 15.
    const lines = result.findings.filter((finding) => finding.file === 'src/app/positives.ts').map((f) => f.line);
    expect(lines).not.toContain(9);
    expect(lines).not.toContain(15);
  });

  it('follows aliased imports', () => {
    expect(inFile('src/app/aliased.ts')).toEqual([
      'src/app/aliased.ts:2:10 reflective-injector confirmed',
      'src/app/aliased.ts:6:21 encapsulation-native confirmed',
      'src/app/aliased.ts:7:25 test-bed-get confirmed',
    ]);
  });

  it('follows namespace imports in values, types, decorators and calls', () => {
    expect(inFile('src/app/namespace.ts')).toEqual([
      'src/app/namespace.ts:5:24 renderer confirmed',
      'src/app/namespace.ts:6:24 renderer confirmed',
      'src/app/namespace.ts:7:21 encapsulation-native confirmed',
      'src/app/namespace.ts:8:23 module-with-providers confirmed',
      'src/app/namespace.ts:10:37 module-id confirmed',
      'src/app/namespace.ts:13:57 malformed-uri confirmed',
    ]);
  });

  it('reports re-exports from the matching package', () => {
    expect(inFile('src/app/reexports.ts')).toEqual([
      'src/app/reexports.ts:2:10 transfer-state confirmed',
      'src/app/reexports.ts:2:25 make-state-key confirmed',
      'src/app/reexports.ts:3:15 webworker-dynamic confirmed',
      'src/app/reexports.ts:4:25 webworker confirmed',
    ]);
  });

  it('ignores the same names imported from another package or another entry point', () => {
    expect(inFile('src/app/other-package.ts')).toEqual([]);
  });

  it('ignores names that appear only in comments and strings', () => {
    expect(inFile('src/app/comments-strings.ts')).toEqual([]);
  });

  it('parses a decorator placed after export', () => {
    expect(inFile('src/app/export-decorator.ts')).toEqual(['src/app/export-decorator.ts:2:21 reflective-injector confirmed']);
  });

  it('skips declaration files and does not parse files without an Angular import', () => {
    expect(inFile('src/app/typings.d.ts')).toEqual([]);
    expect(inFile('src/app/plain.ts')).toEqual([]);
  });

  it('lists a file that does not parse as unscanned instead of failing', () => {
    expect(result.unscanned.map((item) => item.file)).toEqual(['src/app/broken.ts']);
    expect(result.unscanned[0]?.reason).toMatch(/^could not be parsed \(.+\)$/);
    expect(inFile('src/app/broken.ts')).toEqual([]);
  });
});

describe('template scan', () => {
  it('matches inline template literals and strings of @Component, skipping HTML comments', () => {
    expect(inFile('src/app/inline-template.component.ts')).toEqual([
      'src/app/inline-template.component.ts:7:27 preserve-query-params heuristic',
      'src/app/inline-template.component.ts:16:56 ngform-element heuristic',
    ]);
  });

  it('reads an external template named by templateUrl, skipping HTML comments', () => {
    expect(inFile('src/app/external-view.html')).toEqual(['src/app/external-view.html:2:3 ngform-element heuristic']);
  });

  it('reads *.component.html files even when no component points at them', () => {
    expect(inFile('src/app/legacy.component.html')).toEqual([
      'src/app/legacy.component.html:1:22 preserve-query-params heuristic',
    ]);
  });

  it('does not read other HTML files', () => {
    expect(inFile('src/app/orphan.html')).toEqual([]);
  });

  it('marks template findings as heuristic with a reason, and carries the entry details', () => {
    const finding = result.findings.find((item) => item.file === 'src/app/external-view.html');
    expect(finding).toEqual({
      file: 'src/app/external-view.html',
      line: 2,
      column: 3,
      entryId: 'ngform-element',
      package: '@angular/forms',
      api: 'ngform-element',
      change: 'removed',
      major: 9,
      replacement: 'instead of ngform-element',
      migration: 'unknown',
      confidence: 'heuristic',
      reason: 'Matched by text in a component template, not by the Angular template parser.',
    });
  });
});

describe('config scan', () => {
  it('finds angular.json properties, including wildcard project paths, in a file with comments', () => {
    expect(inFile('angular.json')).toEqual([
      'angular.json:4:3 default-project confirmed',
      'angular.json:5:12 default-collection confirmed',
      'angular.json:9:16 default-collection confirmed',
      // Builder options in "options" and in "configurations" entries, under architect and targets.
      'angular.json:14:51 extract-css confirmed',
      'angular.json:16:29 extract-css confirmed',
      'angular.json:26:24 browser-target confirmed',
      'angular.json:28:29 browser-target confirmed',
      'angular.json:33:39 browser-target confirmed',
      'angular.json:34:24 browser-target confirmed',
      // A removed builder points at the target's "builder" key.
      'angular.json:43:11 tslint-builder confirmed',
      'angular.json:62:39 extract-css confirmed',
      // Third-party builders that extend an Angular builder.
      'angular.json:67:24 extract-css heuristic',
      'angular.json:71:24 browser-target heuristic',
    ]);
  });

  it('counts builder options only directly in the options of a target with a listed builder', () => {
    const lines = result.findings.filter((finding) => finding.file === 'angular.json').map((finding) => finding.line);
    // 10: project level; 14 (nested object) and 17: not a listed option; 22: target without a builder;
    // 38 to 40 and 47: a third-party builder; 51: a builder that is not a string; 76: workspace level.
    for (const line of [10, 17, 22, 38, 39, 40, 46, 47, 51, 52, 76]) expect(lines, `line ${line}`).not.toContain(line);
    expect(lines.filter((line) => line === 14)).toEqual([14]);
  });

  it('copies the entry details to builder findings and keeps their major', () => {
    const byId = (id: string) => result.findings.find((finding) => finding.entryId === id);
    expect(byId('extract-css')).toEqual({
      file: 'angular.json',
      line: 14,
      column: 51,
      entryId: 'extract-css',
      package: '@angular-devkit/build-angular',
      api: 'extract-css',
      change: 'removed',
      major: 13,
      replacement: 'instead of extract-css',
      migration: 'unknown',
      confidence: 'confirmed',
    });
    expect(byId('browser-target')).toMatchObject({ major: 19, migration: 'yes', confidence: 'confirmed' });
    expect(byId('tslint-builder')).toMatchObject({ major: 13, migration: 'no', confidence: 'confirmed' });
  });

  it('marks options under a third-party builder that extends an Angular builder as heuristic, with a reason', () => {
    const finding = result.findings.find((item) => item.file === 'angular.json' && item.line === 67);
    expect(finding).toMatchObject({ entryId: 'extract-css', major: 13, confidence: 'heuristic' });
    expect(finding?.reason).toContain('@angular-builders/custom-webpack:browser');
    expect(finding?.reason).toContain('@angular-devkit/build-angular:browser');
  });

  it('finds tsconfig properties in any tsconfig*.json', () => {
    expect(inFile('tsconfig.json')).toEqual(['tsconfig.json:7:5 enable-ivy confirmed']);
    expect(inFile('tsconfig.app.json')).toEqual([]);
  });

  it('marks structural findings as confirmed without a reason', () => {
    const finding = result.findings.find((item) => item.entryId === 'renderer');
    expect(finding).toMatchObject({ confidence: 'confirmed', migration: 'yes', major: 9, package: '@angular/core' });
    expect(finding && 'reason' in finding).toBe(false);
  });
});

describe('result', () => {
  it('counts the files it read', () => {
    // 10 TypeScript files that parse, angular.json, 2 tsconfig files and 2 templates.
    expect(result.filesScanned).toBe(15);
  });

  it('uses forward-slash paths relative to the project', () => {
    for (const finding of result.findings) {
      expect(finding.file).not.toMatch(/\\|^\/|^[A-Za-z]:|^\.\.?\//);
    }
  });

  it('is sorted and the same on every run', async () => {
    const again = await scan(root, TEST_DATA);
    expect(again).toEqual(result);
    const keys = result.findings.map(brief);
    const sorted = [...result.findings]
      .sort((a, b) =>
        a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.column - b.column || (a.entryId < b.entryId ? -1 : 1),
      )
      .map(brief);
    expect(keys).toEqual(sorted);
  });

  it('rejects when the project folder does not exist', async () => {
    await expect(scan(`${root}-missing`, TEST_DATA)).rejects.toThrow(/Cannot list the project folder/);
  });
});

describe('edge cases', () => {
  it('reports a templateUrl outside the project and an invalid config file as unscanned', async () => {
    const project = tempFolder('ngup-scan-edge-');
    try {
      writeFiles(project, {
        'src/app/escape.component.ts':
          "import { Component } from '@angular/core';\n@Component({ templateUrl: '../../../outside.html' })\nexport class Escape {}\n",
        'tsconfig.broken.json': '{ "angularCompilerOptions": { "enableIvy": } }',
        'src/app/ok.ts': HIT,
      });
      const edge = await scan(project, TEST_DATA);
      expect(edge.unscanned.map((item) => item.file)).toEqual(['src/app/escape.component.ts', 'tsconfig.broken.json']);
      expect(edge.unscanned[0]?.reason).toBe('its templateUrl points outside the project folder');
      expect(edge.unscanned[1]?.reason).toMatch(/^could not be parsed \(.+at offset \d+\)$/);
      expect(edge.findings.map(brief)).toEqual(['src/app/ok.ts:1:10 renderer confirmed']);
    } finally {
      removeFolder(project);
    }
  });

  it('reports a malformed angular.json as unscanned when builder entries apply', async () => {
    const project = tempFolder('ngup-scan-workspace-');
    try {
      writeFiles(project, {
        'angular.json':
          '{ "projects": { "app": { "architect": { "serve": { "builder": "@angular-devkit/build-angular:dev-server", "options": { "browserTarget": } } } } } }',
        'src/app/ok.ts': HIT,
      });
      const broken = await scan(project, TEST_DATA);
      expect(broken.unscanned.map((item) => item.file)).toEqual(['angular.json']);
      expect(broken.unscanned[0]?.reason).toMatch(/^could not be parsed \(.+at offset \d+\)$/);
      expect(broken.findings.map(brief)).toEqual(['src/app/ok.ts:1:10 renderer confirmed']);
    } finally {
      removeFolder(project);
    }
  });

  it('survives deeply nested code', async () => {
    const project = tempFolder('ngup-scan-deep-');
    try {
      const depth = 2000;
      writeFiles(project, {
        'deep.ts': `${HIT}export const x = ${'['.repeat(depth)}Renderer${']'.repeat(depth)};\n`,
      });
      const deep = await scan(project, TEST_DATA);
      // Either parsed (the import is reported) or listed as unscanned; never a crash.
      expect(deep.findings.length + deep.unscanned.length).toBeGreaterThan(0);
    } finally {
      removeFolder(project);
    }
  });
});
