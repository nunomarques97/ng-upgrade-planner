// Scan of the synthetic RxJS sources (test/fixtures/synthetic/scan/rxjs) with the bundled RxJS data:
// files that import rxjs are parsed even without an Angular import, entries match by import (named,
// aliased, namespace and re-export), by static member and by a call with too few arguments, and
// come back in their own list. Comments, strings and same-named symbols from other packages do not match.
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { RXJS_APIS } from '../../src/data/rxjs-apis.js';
import { scan, type RxjsScanFinding, type ScanResult } from '../../src/scan/index.js';
import { TEST_DATA } from './helpers.js';

const PROJECT = fileURLToPath(new URL('../fixtures/synthetic/scan/rxjs', import.meta.url));

function brief(finding: RxjsScanFinding): string {
  return `${finding.file}:${finding.line}:${finding.column} ${finding.entryId}`;
}

let result: ScanResult;

function inFile(file: string): string[] {
  return result.rxjs.filter((finding) => finding.file === file).map(brief);
}

beforeAll(async () => {
  result = await scan(PROJECT, TEST_DATA, { rxjs: RXJS_APIS });
});

describe('RxJS 7 scan', () => {
  it('finds the bundled entries in a file without an Angular import', () => {
    expect(inFile('src/app/positives.ts')).toEqual([
      'src/app/positives.ts:3:28 rx7-rx-import',
      'src/app/positives.ts:5:26 rx7-iif-missing-result',
      'src/app/positives.ts:6:27 rx7-iif-missing-result',
      'src/app/positives.ts:8:38 rx7-default-if-empty-no-value',
      'src/app/positives.ts:10:21 rx7-virtual-time-scheduler-sort-actions',
    ]);
  });

  it('finds aliased and namespace uses and re-exports, but not a call whose arguments are spread', () => {
    expect(inFile('src/app/aliased.ts')).toEqual([
      'src/app/aliased.ts:8:19 rx7-iif-missing-result',
      'src/app/aliased.ts:9:19 rx7-iif-missing-result',
      'src/app/aliased.ts:10:32 rx7-default-if-empty-no-value',
      'src/app/aliased.ts:11:19 rx7-virtual-time-scheduler-sort-actions',
      'src/app/aliased.ts:15:15 rx7-rx-import',
    ]);
  });

  it('ignores the same names from other packages, comments and strings', () => {
    expect(inFile('src/app/other-package.ts')).toEqual([]);
    expect(inFile('src/app/comments-strings.ts')).toEqual([]);
  });

  it('copies the entry fields onto each finding', () => {
    const entry = RXJS_APIS.entries.find((item) => item.id === 'rx7-iif-missing-result')!;
    expect(result.rxjs.find((finding) => finding.entryId === entry.id)).toEqual({
      file: 'src/app/aliased.ts',
      line: 8,
      column: 19,
      entryId: entry.id,
      package: 'rxjs',
      api: entry.label,
      change: 'breaking',
      rxjsMajor: 7,
      replacement: entry.replacement,
    });
  });

  it('parses a file that imports rxjs and leaves alone one that only mentions it', () => {
    expect(result.unscanned.map((item) => item.file)).toEqual(['src/app/broken.ts']);
    expect(result.unscanned[0]!.reason).toMatch(/^could not be parsed/);
  });

  it('keeps RxJS findings apart from removed-API findings and deprecation warnings', () => {
    expect(result.findings).toEqual([]);
    expect(result.deprecations).toEqual([]);
    expect(result.rxjs).toHaveLength(10);
  });

  it('matches nothing and parses no rxjs-only file without RxJS data', async () => {
    const without = await scan(PROJECT, TEST_DATA);
    expect(without.rxjs).toEqual([]);
    expect(without.unscanned).toEqual([]);
    expect(without.filesScanned).toBe(result.filesScanned + 1);
  });
});
