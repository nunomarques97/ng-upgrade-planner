// Scan of the synthetic deprecation sources (test/fixtures/synthetic/scan/deprecations) with the
// bundled deprecated-API data and a synthetic removed-API dataset: deprecation entries match by the
// same import-aware and template rules as removed APIs and come back in their own list.
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEPRECATED_APIS } from '../../src/data/deprecated-apis.js';
import type { DeprecatedApiData } from '../../src/data/types.js';
import { scan, type DeprecationScanFinding, type ScanResult } from '../../src/scan/index.js';
import { TEMPLATE_REASON } from '../../src/scan/template.js';
import { TEST_DATA } from './helpers.js';

const PROJECT = fileURLToPath(new URL('../fixtures/synthetic/scan/deprecations', import.meta.url));

/** A synthetic template entry, because the bundled deprecated-API data has none. */
const TEMPLATE_DATA: DeprecatedApiData = {
  retrieved: '2026-10-03',
  entries: [
    {
      kind: 'template',
      id: 'animation-binding',
      package: '@angular/animations',
      label: 'animation trigger binding',
      pattern: '[[(]@[A-Za-z]',
      deprecatedIn: 20,
      removalMajor: 23,
      summary: 'Synthetic.',
      replacement: 'animate.enter and animate.leave',
      source: { url: 'https://angular.dev/guide/animations/migration', title: 'Synthetic test entry' },
      audit: { status: 'added', read: '2026-10-03', note: 'Synthetic test entry.' },
    },
  ],
};

function brief(finding: DeprecationScanFinding): string {
  return `${finding.file}:${finding.line}:${finding.column} ${finding.entryId} ${finding.confidence}`;
}

let result: ScanResult;

function inFile(file: string): string[] {
  return result.deprecations.filter((finding) => finding.file === file).map(brief);
}

beforeAll(async () => {
  result = await scan(PROJECT, TEST_DATA, { deprecations: DEPRECATED_APIS });
});

describe('deprecated-API scan', () => {
  it('finds bundled deprecations by import: named imports, a decorator key and whole entry points', () => {
    expect(inFile('src/app/positives.ts')).toEqual([
      'src/app/positives.ts:2:60 d23-animations-package confirmed',
      'src/app/positives.ts:3:10 d23-platform-browser-animations-module confirmed',
      'src/app/positives.ts:3:35 d23-platform-browser-provide-animations confirmed',
      'src/app/positives.ts:4:10 d23-platform-browser-provide-animations-async confirmed',
      'src/app/positives.ts:5:33 d23-animations-browser confirmed',
      'src/app/positives.ts:6:34 d24-platform-browser-with-incremental-hydration confirmed',
      'src/app/positives.ts:11:3 d23-core-component-animations confirmed',
    ]);
  });

  it('follows aliased and namespace imports', () => {
    expect(inFile('src/app/aliased.ts')).toEqual([
      'src/app/aliased.ts:2:10 d23-platform-browser-provide-animations confirmed',
      'src/app/aliased.ts:2:49 d23-platform-browser-noop-animations-module confirmed',
      'src/app/aliased.ts:3:25 d23-animations-package confirmed',
      'src/app/aliased.ts:8:3 d23-core-component-animations confirmed',
    ]);
  });

  it('ignores the same names from another package, a local file or a decorator of another framework', () => {
    // Also ANIMATION_MODULE_TYPE, a re-export of @angular/platform-browser/animations that is not
    // deprecated, withNoIncrementalHydration, and an animations key outside @Component.
    expect(inFile('src/app/other-package.ts')).toEqual([]);
  });

  it('ignores names that appear only in comments, strings and inline template text', () => {
    expect(inFile('src/app/comments-strings.ts')).toEqual([]);
  });

  it('keeps deprecation findings apart from removed-API findings of the same file', () => {
    expect(inFile('src/app/mixed.ts')).toEqual(['src/app/mixed.ts:2:10 d23-platform-browser-provide-noop-animations confirmed']);
    expect(result.findings.map((finding) => `${finding.file}:${finding.line} ${finding.entryId}`)).toEqual(['src/app/mixed.ts:1 renderer']);
  });

  it('carries the deprecation and removal majors and the replacement of the entry', () => {
    const entry = DEPRECATED_APIS.entries.find((item) => item.id === 'd24-platform-browser-with-incremental-hydration')!;
    expect(result.deprecations.find((finding) => finding.entryId === entry.id)).toEqual({
      file: 'src/app/positives.ts',
      line: 6,
      column: 34,
      entryId: entry.id,
      package: '@angular/platform-browser',
      api: entry.label,
      deprecatedIn: 22,
      removalMajor: 24,
      replacement: entry.replacement,
      confidence: 'confirmed',
    });
  });

  it('matches deprecated template patterns as heuristic findings, skipping HTML comments', async () => {
    const templates = await scan(PROJECT, { ...TEST_DATA, entries: [] }, { deprecations: TEMPLATE_DATA });
    expect(templates.deprecations.map(brief)).toEqual([
      'src/app/fade.component.html:1:6 animation-binding heuristic',
      'src/app/fade.component.html:1:22 animation-binding heuristic',
      'src/app/positives.ts:10:19 animation-binding heuristic',
    ]);
    expect(templates.deprecations[0]!.reason).toBe(TEMPLATE_REASON);
    expect(templates.findings).toEqual([]);
  });

  it('returns no deprecation findings when no deprecated-API data is given', async () => {
    const plain = await scan(PROJECT, TEST_DATA);
    expect(plain.deprecations).toEqual([]);
    expect(plain.findings).toEqual(result.findings);
  });
});
