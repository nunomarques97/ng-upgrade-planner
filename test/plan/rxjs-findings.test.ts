// RxJS 7 breaking changes in the plan: shown only with rxjs 6.x installed, required work in the first
// hop whose @angular/core rxjs peer range accepts no RxJS 6, otherwise one advisory without effort
// points, and only counted with rxjs 7 or later or without rxjs. Registry data is in memory.
import { describe, expect, it } from 'vitest';
import { REMOVED_API_POINTS, buildPlan, type PlanOptions, type UpgradePlan } from '../../src/plan/index.js';
import type { PackageRecord } from '../../src/registry/types.js';
import type { RxjsScanFinding, ScanResult } from '../../src/scan/index.js';
import { angularRecords, guide, memorySource, project } from './helpers.js';

const COVERAGE = { firstMajor: 9, lastMajor: 22, retrieved: '2026-10-03' };
const RXJS = { rxjsMajor: 7, retrieved: '2026-10-03' };

function rxjsFinding(entryId: string, line: number): RxjsScanFinding {
  return {
    file: 'src/app/data.service.ts',
    line,
    column: 5,
    entryId,
    package: 'rxjs',
    api: entryId,
    change: 'breaking',
    rxjsMajor: 7,
    replacement: `instead of ${entryId}`,
  };
}

/** Three uses of two entries. */
const FOUND = [rxjsFinding('rx7-iif-missing-result', 4), rxjsFinding('rx7-iif-missing-result', 9), rxjsFinding('rx7-rx-import', 1)];

function scanResult(rxjs: RxjsScanFinding[]): ScanResult {
  return { findings: [], deprecations: [], rxjs, unscanned: [], filesScanned: 8 };
}

/** Angular 14 to 17 records, with the @angular/core rxjs peer of the given releases replaced. */
function records(rxjsPeers: Record<string, string> = {}): PackageRecord[] {
  return angularRecords().map((record) => {
    if (record.name !== '@angular/core') return record;
    const versions = { ...record.versions };
    for (const [version, range] of Object.entries(rxjsPeers)) {
      const current = versions[version]!;
      versions[version] = { ...current, peerDependencies: { ...current.peerDependencies, rxjs: range } };
    }
    return { ...record, versions };
  });
}

async function plan(
  rxjs: string,
  options: { peers?: Record<string, string>; found?: RxjsScanFinding[]; scan?: PlanOptions['scan'] | null } = {},
): Promise<UpgradePlan> {
  const scan =
    options.scan !== undefined ? options.scan : { result: scanResult(options.found ?? FOUND), coverage: COVERAGE, rxjs: RXJS };
  return buildPlan(
    project('14.2.12', [], { rxjs }),
    memorySource(records(options.peers)),
    { nodeVersion: '18.19.0', scan },
    guide([]),
  );
}

const rxjsIds = (result: UpgradePlan): [number, string[]][] => result.hops.map((hop) => [hop.to, hop.rxjs.map((item) => item.entryId)]);

describe('RxJS 7 breaking changes in the plan', () => {
  it('attaches them as work to the first hop whose @angular/core accepts no RxJS 6', async () => {
    const result = await plan('6.6.7', { peers: { '16.2.12': '^7.4.0', '17.3.12': '^7.4.0' } });
    expect(rxjsIds(result)).toEqual([
      [15, []],
      [16, ['rx7-iif-missing-result', 'rx7-iif-missing-result', 'rx7-rx-import']],
      [17, []],
    ]);
    expect(result.hops[1]!.rxjs[0]).toEqual({
      file: 'src/app/data.service.ts',
      line: 4,
      column: 5,
      entryId: 'rx7-iif-missing-result',
      package: 'rxjs',
      api: 'rx7-iif-missing-result',
      change: 'breaking',
      replacement: 'instead of rx7-iif-missing-result',
    });
    expect(result.scan.rxjs).toMatchObject({
      coverage: RXJS,
      installed: '6.6.7',
      status: 'required',
      forcedBy: 16,
      uncheckedHops: [],
      findings: 3,
      advisory: [],
    });
    expect(result.scan.rxjs.reason).toContain('Angular 16 accepts no RxJS 6');
    // The same hop flags the rxjs requirement that forces the move.
    const requirement = result.hops[1]!.requirements.find((item) => item.name === 'rxjs')!;
    expect(requirement).toMatchObject({ status: 'unmet', flagged: true });
  });

  it('adds the manual weight per distinct RxJS entry to the forcing hop only', async () => {
    const peers = { '16.2.12': '^7.4.0' };
    const without = await plan('6.6.7', { peers, found: [] });
    const withFindings = await plan('6.6.7', { peers });
    const points = withFindings.hops.map((hop, index) => hop.effort.points - without.hops[index]!.effort.points);
    expect(points).toEqual([0, 2 * REMOVED_API_POINTS.manual, 0]);
    expect(withFindings.hops[1]!.effort.counts.removedApis).toEqual({ migrated: 0, manual: 2 });
    expect(withFindings.effort.points - without.effort.points).toBe(2 * REMOVED_API_POINTS.manual);
  });

  it('shows them once as a non-blocking advisory without effort points when no hop forces RxJS 7', async () => {
    // The recorded @angular/core peers for 14 to 17 accept ^6.5.3 || ^7.4.0.
    const result = await plan('6.6.7');
    const none = await plan('6.6.7', { found: [] });
    expect(rxjsIds(result)).toEqual([
      [15, []],
      [16, []],
      [17, []],
    ]);
    expect(result.scan.rxjs).toMatchObject({ status: 'advisory', forcedBy: null, uncheckedHops: [], findings: 3 });
    expect(result.scan.rxjs.advisory.map((item) => item.entryId)).toEqual(['rx7-iif-missing-result', 'rx7-iif-missing-result', 'rx7-rx-import']);
    expect(result.scan.rxjs.reason).toMatch(/^no hop of this plan forces RxJS 7/);
    expect(result.hops.map((hop) => hop.effort.points)).toEqual(none.hops.map((hop) => hop.effort.points));
    expect(result.effort).toEqual(none.effort);
    expect(result.unverified).toEqual(none.unverified);
  });

  it('does not treat a hop that still accepts another RxJS 6 release as forcing RxJS 7', async () => {
    // rxjs 6.4.0 is outside ^6.5.3, but the hop only needs a newer 6.x.
    const result = await plan('6.4.0', { peers: { '15.2.10': '^6.5.3' } });
    expect(result.hops[0]!.requirements.find((item) => item.name === 'rxjs')!.status).toBe('unmet');
    expect(result.scan.rxjs.status).toBe('advisory');
    expect(rxjsIds(result).flatMap(([, ids]) => ids)).toEqual([]);
  });

  it('keeps an advisory but lists a hop whose rxjs range cannot be read as unverified', async () => {
    const result = await plan('6.6.7', { peers: { '16.2.12': 'next' } });
    expect(result.scan.rxjs).toMatchObject({ status: 'advisory', uncheckedHops: [16] });
    expect(result.scan.rxjs.reason).toContain('the range of Angular 16 could not be read');
    expect(result.unverified).toContainEqual({
      hop: null,
      subject: 'RxJS 7 requirement',
      reason: 'the @angular/core rxjs peer range of Angular 16 could not be read, so the advisory RxJS findings may be required work',
    });
  });

  it('counts them without showing them when rxjs 7 is installed, even where a hop needs RxJS 7', async () => {
    for (const peers of [{}, { '16.2.12': '^7.4.0' }]) {
      const result = await plan('7.8.1', { peers });
      expect(rxjsIds(result).flatMap(([, ids]) => ids)).toEqual([]);
      expect(result.scan.rxjs).toMatchObject({ installed: '7.8.1', status: 'not-applicable', forcedBy: null, findings: 3, advisory: [] });
      expect(result.scan.rxjs.reason).toBe('the installed rxjs 7.8.1 is already RxJS 7 or later, so RxJS 7 breaking changes are not shown');
    }
  });

  it('counts them without showing them when rxjs is not a dependency', async () => {
    const result = await plan('absent', { peers: { '16.2.12': '^7.4.0' } });
    expect(result.scan.rxjs).toMatchObject({ installed: null, status: 'not-applicable', findings: 3, advisory: [] });
    expect(result.scan.rxjs.reason).toBe('rxjs is not a direct dependency, so RxJS 7 breaking changes are not shown');
    expect(rxjsIds(result).flatMap(([, ids]) => ids)).toEqual([]);
  });

  it('records the scan as off without RxJS data or without a scan', async () => {
    const off = await plan('6.6.7', { scan: null });
    expect(off.scan.rxjs).toMatchObject({ coverage: null, status: 'off', findings: 0, advisory: [] });
    const noData = await plan('6.6.7', { scan: { result: scanResult(FOUND), coverage: COVERAGE } });
    expect(noData.scan.rxjs).toMatchObject({ coverage: null, status: 'off', findings: 3, advisory: [] });
    expect(rxjsIds(noData).flatMap(([, ids]) => ids)).toEqual([]);
  });
});
