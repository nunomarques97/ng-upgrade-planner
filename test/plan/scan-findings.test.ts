// Removed-API and deprecation scan results in the plan: hop assignment, effort weights, scan status
// and the confirmed/unverified split. Scan results are written here, so nothing reads the disk.
import { describe, expect, it } from 'vitest';
import { hopEffort, totalEffort } from '../../src/plan/effort.js';
import {
  BASE_POINTS,
  REMOVED_API_POINTS,
  buildPlan,
  type PlanOptions,
  type RemovedApiFinding,
  type UpgradePlan,
} from '../../src/plan/index.js';
import type { DeprecationScanFinding, ScanFinding, ScanResult } from '../../src/scan/index.js';
import { angularRecords, guide, memorySource, project, toolchain } from './helpers.js';

const COVERAGE = { firstMajor: 9, lastMajor: 16, retrieved: '2026-10-02' };

function finding(entryId: string, major: number, fields: Partial<ScanFinding> = {}): ScanFinding {
  return {
    file: 'src/app/app.module.ts',
    line: 3,
    column: 10,
    entryId,
    package: '@angular/core',
    api: entryId,
    change: 'removed',
    major,
    replacement: `instead of ${entryId}`,
    migration: 'no',
    confidence: 'confirmed',
    ...fields,
  };
}

function scanResult(findings: ScanFinding[], fields: Partial<ScanResult> = {}): ScanResult {
  return { findings, deprecations: [], rxjs: [], unscanned: [], filesScanned: 12, ...fields };
}

function deprecation(entryId: string, removalMajor: number, fields: Partial<DeprecationScanFinding> = {}): DeprecationScanFinding {
  return {
    file: 'src/app/app.config.ts',
    line: 5,
    column: 3,
    entryId,
    package: '@angular/platform-browser/animations',
    api: entryId,
    deprecatedIn: removalMajor - 3,
    removalMajor,
    replacement: `instead of ${entryId}`,
    confidence: 'confirmed',
    ...fields,
  };
}

const NO_DEPRECATIONS = { coverage: null, findings: 0, attached: 0, notAttached: { atOrBelowCurrent: 0, aboveTarget: 0, noHop: 0 } };

/** The RxJS part of a plan whose scan matched no RxJS data; the project has rxjs 7.8.1. */
const NO_RXJS = {
  coverage: null,
  installed: '7.8.1',
  status: 'off',
  forcedBy: null,
  uncheckedHops: [],
  reason: 'the source was not scanned for RxJS 7 breaking changes',
  findings: 0,
  advisory: [],
};

async function plan(scan: PlanOptions['scan'] | undefined, options: PlanOptions = {}): Promise<UpgradePlan> {
  // Angular 14.2 to 17; the test data covers 9 to 16, so the hop to 17 is outside it.
  return buildPlan(project('14.2.12'), memorySource(angularRecords()), { nodeVersion: '18.19.0', ...options, ...(scan !== undefined ? { scan } : {}) }, guide([]));
}

const ids = (findings: readonly RemovedApiFinding[]): string[] => findings.map((item) => item.entryId);

describe('hop assignment', () => {
  it('attaches a finding for major N to the hop with to == N and counts the rest', async () => {
    const result = await plan({
      result: scanResult([
        finding('old-13', 13),
        finding('same-14', 14),
        finding('in-15', 15),
        finding('in-16', 16),
        finding('in-17', 17),
        finding('above-18', 18),
        finding('above-20', 20),
      ]),
      coverage: COVERAGE,
    });
    expect(result.hops.map((hop) => [hop.to, ids(hop.removedApis)])).toEqual([
      [15, ['in-15']],
      [16, ['in-16']],
      [17, ['in-17']],
    ]);
    expect(result.scan).toEqual({
      status: 'ran',
      coverage: COVERAGE,
      filesScanned: 12,
      findings: 7,
      attached: 3,
      notAttached: { atOrBelowCurrent: 2, aboveTarget: 2, noHop: 0 },
      unscanned: [],
      deprecations: NO_DEPRECATIONS,
      rxjs: NO_RXJS,
    });
  });

  it('follows an explicit target and copies every field of the finding', async () => {
    const heuristic = finding('pattern-16', 16, {
      file: 'src/app/view.component.html',
      line: 7,
      column: 2,
      package: '@angular/router',
      api: 'preserveQueryParams',
      change: 'breaking',
      migration: 'unknown',
      confidence: 'heuristic',
      reason: 'template text match',
    });
    const result = await plan({ result: scanResult([finding('in-15', 15, { migration: 'yes' }), heuristic]), coverage: COVERAGE }, { targetMajor: 15 });
    expect(result.hops).toHaveLength(1);
    expect(result.hops[0]!.removedApis).toEqual([
      {
        file: 'src/app/app.module.ts',
        line: 3,
        column: 10,
        entryId: 'in-15',
        package: '@angular/core',
        api: 'in-15',
        change: 'removed',
        major: 15,
        replacement: 'instead of in-15',
        migration: 'yes',
        confidence: 'confirmed',
        reason: null,
      },
    ]);
    expect(result.scan.notAttached).toEqual({ atOrBelowCurrent: 0, aboveTarget: 1, noHop: 0 });
  });

  it('keeps hops empty and records the status when the scan is off or finds no source', async () => {
    const off = await plan(undefined);
    expect(off.hops.every((hop) => hop.removedApis.length === 0)).toBe(true);
    expect(off.scan).toEqual({
      status: 'off',
      coverage: null,
      filesScanned: 0,
      findings: 0,
      attached: 0,
      notAttached: { atOrBelowCurrent: 0, aboveTarget: 0, noHop: 0 },
      unscanned: [],
      deprecations: NO_DEPRECATIONS,
      rxjs: NO_RXJS,
    });
    expect(off.hops.every((hop) => hop.deprecations.length === 0)).toBe(true);
    expect((await plan(null)).scan.status).toBe('off');
    const empty = await plan({ result: scanResult([], { filesScanned: 0 }), coverage: COVERAGE });
    expect(empty.scan.status).toBe('no-source-files');
    // A folder whose only files cannot be read was still scanned.
    const unreadable = await plan({
      result: scanResult([], { filesScanned: 0, unscanned: [{ file: 'src/big.ts', reason: 'larger than 1024 kB, not read' }] }),
      coverage: COVERAGE,
    });
    expect(unreadable.scan.status).toBe('ran');
  });
});

describe('deprecation warnings', () => {
  const DEPRECATION_COVERAGE = { removalMajors: [16, 17, 18, 19], retrieved: '2026-10-03' };

  it('attaches a warning for a removal in N to the hop with to == N - 1 and counts the rest', async () => {
    const result = await plan({
      result: scanResult([], {
        deprecations: [
          deprecation('removed-by-14', 14),
          deprecation('warn-in-14', 15),
          deprecation('warn-in-15', 16),
          deprecation('warn-in-16', 17),
          deprecation('warn-in-17', 18),
          deprecation('warn-in-18', 19),
        ],
      }),
      coverage: COVERAGE,
      deprecations: DEPRECATION_COVERAGE,
    });
    expect(result.hops.map((hop) => [hop.to, hop.deprecations.map((item) => item.entryId)])).toEqual([
      [15, ['warn-in-15']],
      [16, ['warn-in-16']],
      [17, ['warn-in-17']],
    ]);
    expect(result.scan.deprecations).toEqual({
      coverage: DEPRECATION_COVERAGE,
      findings: 6,
      attached: 3,
      notAttached: { atOrBelowCurrent: 2, aboveTarget: 1, noHop: 0 },
    });
    // Removed-API counts are kept apart.
    expect(result.scan.findings).toBe(0);
    expect(result.hops.every((hop) => hop.removedApis.length === 0)).toBe(true);
  });

  it('copies every field and counts a warning hop without a stable release as not attached', async () => {
    const records = angularRecords().map((record) =>
      record.name === '@angular/core'
        ? { ...record, versions: Object.fromEntries(Object.entries(record.versions).filter(([version]) => !version.startsWith('16.'))) }
        : record,
    );
    const result = await buildPlan(
      project('14.2.12'),
      memorySource(records),
      {
        nodeVersion: '18.19.0',
        targetMajor: 17,
        scan: {
          result: scanResult([], {
            deprecations: [
              deprecation('warn-in-15', 16, { confidence: 'heuristic', reason: 'template text match', file: 'src/a.component.html' }),
              deprecation('warn-in-16', 17),
            ],
          }),
          coverage: COVERAGE,
        },
      },
      guide([]),
    );
    expect(result.hops.map((hop) => hop.to)).toEqual([15, 17]);
    expect(result.hops[0]!.deprecations).toEqual([
      {
        file: 'src/a.component.html',
        line: 5,
        column: 3,
        entryId: 'warn-in-15',
        package: '@angular/platform-browser/animations',
        api: 'warn-in-15',
        deprecatedIn: 13,
        removalMajor: 16,
        replacement: 'instead of warn-in-15',
        confidence: 'heuristic',
        reason: 'template text match',
      },
    ]);
    expect(result.scan.deprecations).toEqual({
      coverage: null,
      findings: 2,
      attached: 1,
      notAttached: { atOrBelowCurrent: 0, aboveTarget: 0, noHop: 1 },
    });
    // A heuristic warning is unverified, like a heuristic removed-API finding.
    expect(result.unverified).toContainEqual({ hop: 15, subject: 'deprecated API warn-in-15 at src/a.component.html:5', reason: 'template text match' });
  });

  it('adds no effort points and no blockers', async () => {
    const withWarnings = await plan({
      result: scanResult([], { deprecations: [deprecation('a', 16), deprecation('b', 16, { line: 9 }), deprecation('c', 17)] }),
      coverage: COVERAGE,
    });
    const without = await plan({ result: scanResult([]), coverage: COVERAGE });
    expect(withWarnings.hops.map((hop) => hop.deprecations.length)).toEqual([2, 1, 0]);
    expect(withWarnings.hops.map((hop) => hop.effort)).toEqual(without.hops.map((hop) => hop.effort));
    expect(withWarnings.effort).toEqual(without.effort);
    expect(withWarnings.hops.map((hop) => hop.libraries.filter((library) => library.status === 'blocker').length)).toEqual(
      without.hops.map((hop) => hop.libraries.filter((library) => library.status === 'blocker').length),
    );
  });
});

describe('effort', () => {
  it('uses documented integer weights that differ by migration', () => {
    expect(Number.isInteger(REMOVED_API_POINTS.migrated)).toBe(true);
    expect(Number.isInteger(REMOVED_API_POINTS.manual)).toBe(true);
    expect(REMOVED_API_POINTS.migrated).toBeGreaterThan(0);
    expect(REMOVED_API_POINTS.manual).toBeGreaterThan(REMOVED_API_POINTS.migrated);
  });

  it('adds points per distinct API per hop, not per occurrence', () => {
    const toFinding = (item: ScanFinding): RemovedApiFinding => ({ ...item, reason: item.reason ?? null });
    const removedApis = [
      finding('auto', 15, { migration: 'yes', line: 1 }),
      finding('auto', 15, { migration: 'yes', line: 2 }),
      finding('auto', 15, { migration: 'yes', file: 'src/other.ts' }),
      finding('manual', 15, { migration: 'no' }),
      finding('manual', 15, { migration: 'no', line: 9 }),
      finding('maybe', 15, { migration: 'unknown', confidence: 'heuristic', reason: 'text match' }),
    ].map(toFinding);
    const effort = hopEffort({ steps: [], libraries: [], requirements: [], toolchain: toolchain(), removedApis, rxjs: [] });
    expect(effort.counts.removedApis).toEqual({ migrated: 1, manual: 2 });
    expect(effort.breakdown.removedApis).toBe(REMOVED_API_POINTS.migrated + 2 * REMOVED_API_POINTS.manual);
    expect(effort.points).toBe(BASE_POINTS + effort.breakdown.removedApis);

    const again = hopEffort({ steps: [], libraries: [], requirements: [], toolchain: toolchain(), removedApis: removedApis.slice(3), rxjs: [] });
    const total = totalEffort([{ effort }, { effort: again }]);
    expect(total.counts.removedApis).toEqual({ migrated: 1, manual: 4 });
    expect(total.breakdown.removedApis).toBe(effort.breakdown.removedApis + again.breakdown.removedApis);
    const { base, steps, majorBumps, requirements, blockers, removedApis: apis } = total.breakdown;
    expect(base + steps + majorBumps + requirements + blockers + apis).toBe(total.points);
  });

  it('feeds the hop and total effort of a plan', async () => {
    const result = await plan({
      result: scanResult([finding('a', 15, { migration: 'yes' }), finding('a', 15, { migration: 'yes', line: 8 }), finding('b', 16)]),
      coverage: COVERAGE,
    });
    expect(result.hops.map((hop) => hop.effort.breakdown.removedApis)).toEqual([REMOVED_API_POINTS.migrated, REMOVED_API_POINTS.manual, 0]);
    expect(result.effort.breakdown.removedApis).toBe(REMOVED_API_POINTS.migrated + REMOVED_API_POINTS.manual);
    for (const effort of [...result.hops.map((hop) => hop.effort), result.effort]) {
      const parts = Object.values(effort.breakdown).reduce((sum, value) => sum + value, 0);
      expect(parts).toBe(effort.points);
    }
  });
});

describe('confirmed and unverified split', () => {
  const subjects = (result: UpgradePlan, hop: number | null): string[] =>
    result.unverified.filter((item) => item.hop === hop).map((item) => `${item.subject}: ${item.reason}`);

  it('lists heuristic findings for their hop and unscanned files for the whole plan', async () => {
    const result = await plan({
      result: scanResult(
        [
          finding('confirmed-15', 15),
          finding('pattern-15', 15, { api: 'ngForm element', file: 'src/a.component.html', line: 4, confidence: 'heuristic', reason: 'text match' }),
        ],
        { unscanned: [{ file: 'src/broken.ts', reason: 'could not be parsed (Unexpected token)' }] },
      ),
      coverage: COVERAGE,
    });
    expect(subjects(result, 15)).toContain('removed API ngForm element at src/a.component.html:4: text match');
    expect(subjects(result, 15).some((line) => line.includes('confirmed-15'))).toBe(false);
    expect(subjects(result, null)).toContain('source src/broken.ts: not scanned: could not be parsed (Unexpected token)');
    // The data covers up to 16, so the hop to 17 could not be checked.
    expect(subjects(result, 17)).toContain(
      'removed-API scan: the bundled removed-API data covers Angular 9 to 16 only, so changes in Angular 17 were not checked',
    );
    expect(subjects(result, 16).some((line) => line.startsWith('removed-API scan'))).toBe(false);
  });

  it('says the source was not checked when the scan is off or finds nothing to scan', async () => {
    expect(subjects(await plan(undefined), null)).toContain(
      'removed-API scan: the scan was turned off, so the source was not checked for removed or changed Angular APIs',
    );
    const empty = await plan({ result: scanResult([], { filesScanned: 0 }), coverage: COVERAGE });
    expect(subjects(empty, null).some((line) => line.startsWith('removed-API scan: no TypeScript'))).toBe(true);
    // Nothing to plan: nothing about the scan either.
    const nothing = await plan(undefined, { targetMajor: 14 });
    expect(nothing.unverified.some((item) => item.subject === 'removed-API scan')).toBe(false);
  });
});
