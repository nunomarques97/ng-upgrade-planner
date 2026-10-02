import { describe, expect, it } from 'vitest';
import { hopEffort, totalEffort } from '../../src/plan/effort.js';
import { buildPlan, isPlanError, type LibraryHopResult, type PlanStep, type UpgradePlan } from '../../src/plan/index.js';
import type { PackageRecord } from '../../src/registry/types.js';
import { angularRecords, dependency, guide, memorySource, peers, project, record, step } from './helpers.js';

const GUIDE = guide([
  step(1420, 1, 'Fourteen two'),
  step(1500, 1, 'Fifteen basic'),
  step(1500, 3, 'Fifteen advanced'),
  step(1500, 2, 'Material fifteen', { material: true }),
  step(1510, 2, 'Fifteen one'),
  step(1700, 2, 'Seventeen medium'),
]);

function lib(plan: UpgradePlan, hop: number, name: string): LibraryHopResult {
  const found = plan.hops.find((h) => h.to === hop)?.libraries.find((l) => l.name === name);
  if (!found) throw new Error(`no result for ${name} at hop ${hop}`);
  return found;
}

async function plan(
  angular: string,
  libraries: PackageRecord[],
  extra: ReturnType<typeof dependency>[] = [],
  options: Parameters<typeof buildPlan>[2] = { nodeVersion: '18.19.0' },
  overrides: Parameters<typeof memorySource>[1] = {},
): Promise<UpgradePlan> {
  const source = memorySource([...angularRecords(), ...libraries], overrides);
  return buildPlan(project(angular, extra), source, options, GUIDE);
}

async function expectPlanError(promise: Promise<unknown>, code: string): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (isPlanError(error)) {
      expect(error.code).toBe(code);
      return error.message;
    }
    throw error;
  }
  throw new Error('expected a PlanError');
}

describe('hop path', () => {
  it('plans one hop per major from the installed major to the latest stable major', async () => {
    const result = await plan('14.2.12', []);
    expect(result.current).toEqual({
      angular: { value: '14.2.12', confidence: 'confirmed', source: 'lockfile', note: null },
      major: 14,
    });
    expect(result.target.major).toBe(17);
    expect(result.target.source).toBe('latest');
    expect(result.target.angular.value).toBe('17.3.12');
    expect(result.hops.map((hop) => [hop.from, hop.to, hop.angular.value])).toEqual([
      [14, 15, '15.2.10'],
      [15, 16, '16.2.12'],
      [16, 17, '17.3.12'],
    ]);
    expect(result.hops[0]!.commands).toEqual(['ng update @angular/core@15 @angular/cli@15']);
    expect(result.message).toBeNull();
  });

  it('honours an explicit target and never uses prereleases as the hop release', async () => {
    const result = await plan('14.0.0', [], [], { targetMajor: 16 });
    expect(result.target).toMatchObject({ major: 16, source: 'option' });
    expect(result.hops.map((hop) => hop.angular.value)).toEqual(['15.2.10', '16.2.12']);
  });

  it('returns an empty plan with a clear message when the project is already on the target', async () => {
    const latest = await plan('17.1.0', []);
    expect(latest.hops).toEqual([]);
    expect(latest.message).toBe(
      'The project is already on Angular 17 (17.1.0), the target version. There is nothing to plan.',
    );
    expect(latest.effort).toMatchObject({ points: 0, label: 'S' });

    const explicit = await plan('16.2.0', [], [], { targetMajor: 16 });
    expect(explicit.hops).toEqual([]);
    expect(explicit.message).toContain('already on Angular 16');
  });

  it('rejects a target lower than the installed major', async () => {
    const message = await expectPlanError(plan('16.2.0', [], [], { targetMajor: 15 }), 'TARGET_BELOW_CURRENT');
    expect(message).toBe(
      'The target Angular 15 is lower than the installed Angular 16 (16.2.0); downgrades are not planned.',
    );
  });

  it('rejects invalid and unreleased targets', async () => {
    await expectPlanError(plan('15.0.0', [], [], { targetMajor: 16.5 }), 'INVALID_TARGET');
    await expectPlanError(plan('15.0.0', [], [], { targetMajor: 0 }), 'INVALID_TARGET');
    const message = await expectPlanError(plan('15.0.0', [], [], { targetMajor: 18 }), 'TARGET_NOT_RELEASED');
    expect(message).toBe('Angular 18 has no stable release yet; the newest is Angular 17.');
  });

  it('needs an explicit target when the latest Angular version is unknown', async () => {
    const offline = { '@angular/core': { status: 'unavailable', name: '@angular/core', reason: 'not in the offline cache' } } as const;
    const message = await expectPlanError(plan('15.0.0', [], [], {}, offline), 'TARGET_UNKNOWN');
    expect(message).toContain('not in the offline cache');
  });
});

describe('library matrix', () => {
  const steady = record('ngx-steady', {
    '1.0.0': peers({ '@angular/core': '^14.0.0' }),
    '2.0.0': peers({ '@angular/core': '^15.0.0 || ^16.0.0 || ^17.0.0', '@angular/common': '>=15.0.0' }),
  });

  it('excludes framework packages and keeps Angular-dependent third-party libraries', async () => {
    const lodash = record('lodash', { '4.17.21': {} });
    const material = record('@angular/material', {
      '14.2.7': peers({ '@angular/core': '^14.0.0', '@angular/cdk': '14.2.7' }),
    });
    const result = await plan(
      '14.2.12',
      [steady, lodash, material, record('@angular/cdk', { '14.2.7': peers({ '@angular/core': '^14.0.0' }) })],
      [dependency('ngx-steady', '1.0.0'), dependency('lodash', '4.17.21'), dependency('@angular/material', '14.2.7')],
    );
    expect(result.libraries.map((library) => library.name)).toEqual(['@angular/material', 'ngx-steady']);
    expect(result.framework.map((pkg) => pkg.name)).toEqual([
      '@angular-devkit/build-angular',
      '@angular/cli',
      '@angular/common',
      '@angular/compiler-cli',
      '@angular/core',
    ]);
    expect(result.libraries[1]!.angularPeers).toEqual({
      version: '1.0.0',
      peers: [{ name: '@angular/core', range: '^14.0.0' }],
    });
  });

  it('classifies a library by its newest version when the installed one declares no Angular peer', async () => {
    const late = record('ngx-late', { '0.1.0': {}, '1.0.0': peers({ '@angular/core': '>=15.0.0' }) });
    const result = await plan('14.2.12', [late], [dependency('ngx-late', '0.1.0')]);
    expect(result.libraries[0]!.angularPeers.version).toBe('1.0.0');
    expect(lib(result, 15, 'ngx-late')).toMatchObject({ status: 'compatible', changeNeeded: null, change: 'major' });
  });

  it('finds a compatible version on every hop and carries the chosen version forward', async () => {
    const result = await plan('14.2.12', [steady], [dependency('ngx-steady', '1.0.0')]);
    const hop15 = lib(result, 15, 'ngx-steady');
    expect(hop15).toMatchObject({
      status: 'compatible',
      from: { value: '1.0.0', confidence: 'confirmed', source: 'lockfile' },
      newestCompatible: { value: '2.0.0', confidence: 'confirmed', source: 'registry-cache' },
      changeNeeded: true,
      change: 'major',
      evidenceVersion: '2.0.0',
      confidence: 'confirmed',
    });
    expect(hop15.peers).toEqual([
      { name: '@angular/common', range: '>=15.0.0', checkedAgainst: '15.2.10', satisfied: true, optional: false },
      {
        name: '@angular/core',
        range: '^15.0.0 || ^16.0.0 || ^17.0.0',
        checkedAgainst: '15.2.10',
        satisfied: true,
        optional: false,
      },
    ]);
    for (const hop of [16, 17]) {
      expect(lib(result, hop, 'ngx-steady')).toMatchObject({
        status: 'compatible',
        from: { value: '2.0.0' },
        newestCompatible: { value: '2.0.0' },
        changeNeeded: false,
        change: null,
        reason: `2.0.0 already accepts Angular ${hop}; no change needed.`,
      });
    }
    expect(result.hops.map((hop) => hop.effort.counts.majorBumps)).toEqual([1, 0, 0]);
  });

  it('marks a library as a blocker at the first hop that no release accepts', async () => {
    const stuck = record('ngx-stuck', {
      '3.0.0': peers({ '@angular/core': '>=14.0.0 <17.0.0' }),
      '0.0.1': {},
    });
    const result = await plan('14.2.12', [stuck], [dependency('ngx-stuck', '3.0.0')]);
    expect(lib(result, 16, 'ngx-stuck')).toMatchObject({ status: 'compatible', changeNeeded: false });
    const blocker = lib(result, 17, 'ngx-stuck');
    expect(blocker).toMatchObject({
      status: 'blocker',
      newestCompatible: { value: null, confidence: 'confirmed' },
      evidenceVersion: '3.0.0',
      changeNeeded: true,
      reason: 'No release accepts Angular 17; the newest, 3.0.0, requires @angular/core ">=14.0.0 <17.0.0".',
      confidence: 'confirmed',
    });
    expect(blocker.peers).toEqual([
      { name: '@angular/core', range: '>=14.0.0 <17.0.0', checkedAgainst: '17.3.12', satisfied: false, optional: false },
    ]);
    expect(result.hops[2]!.effort.counts.blockers).toBe(1);
  });

  it('decides a library that publishes only prereleases from those prereleases, never offering one', async () => {
    const flex = record('@angular/flex-layout', {
      '14.0.0-beta.41': peers({ '@angular/core': '^14.0.0' }),
      '15.0.0-beta.42': peers({ '@angular/core': '^15.0.0' }),
    });
    const result = await plan('14.2.12', [flex], [dependency('@angular/flex-layout', '14.0.0-beta.41')], {
      targetMajor: 16,
      nodeVersion: '18.19.0',
    });
    expect(result.libraries.map((library) => library.name)).toEqual(['@angular/flex-layout']);
    expect(lib(result, 15, '@angular/flex-layout')).toMatchObject({
      status: 'blocker',
      newestCompatible: { value: null, confidence: 'confirmed' },
      evidenceVersion: '15.0.0-beta.42',
      changeNeeded: true,
      reason:
        'No stable release accepts Angular 15. Only the prerelease 15.0.0-beta.42 accepts it, and prereleases are not offered.',
      confidence: 'confirmed',
    });
    expect(lib(result, 16, '@angular/flex-layout')).toMatchObject({
      status: 'blocker',
      newestCompatible: { value: null, confidence: 'confirmed' },
      from: { value: '14.0.0-beta.41' },
      evidenceVersion: '15.0.0-beta.42',
      reason:
        'No release accepts Angular 16; the registry lists only prereleases and the newest, 15.0.0-beta.42, requires @angular/core "^15.0.0".',
    });
    expect(result.hops.map((hop) => hop.effort.counts.blockers)).toEqual([1, 1]);
  });

  it('notes a prerelease that accepts a hop no stable release accepts', async () => {
    const next = record('ngx-next', {
      '1.0.0': peers({ '@angular/core': '^15.0.0' }),
      '2.0.0-rc.0': peers({ '@angular/core': '^16.0.0' }),
    });
    const result = await plan('15.0.0', [next], [dependency('ngx-next', '1.0.0')], { targetMajor: 16 });
    expect(lib(result, 16, 'ngx-next')).toMatchObject({
      status: 'blocker',
      evidenceVersion: '1.0.0',
      reason:
        'No release accepts Angular 16; the newest, 1.0.0, requires @angular/core "^15.0.0". Only the prerelease 2.0.0-rc.0 accepts it, and prereleases are not offered.',
    });
  });

  it('treats removed Angular core packages such as @angular/http as framework packages', async () => {
    const http = record('@angular/http', { '7.2.16': peers({ '@angular/core': '7.2.16', rxjs: '^6.0.0' }) });
    const webworker = record('@angular/platform-webworker', { '10.2.5': peers({ '@angular/core': '10.2.5' }) });
    const result = await plan('14.2.12', [http, webworker], [
      dependency('@angular/http', '7.2.16'),
      dependency('@angular/platform-webworker', '10.2.5'),
    ]);
    expect(result.libraries).toEqual([]);
    expect(result.framework.map((pkg) => pkg.name)).toEqual(
      expect.arrayContaining(['@angular/http', '@angular/platform-webworker']),
    );
    for (const hop of result.hops) {
      expect(hop.libraries).toEqual([]);
      expect(hop.effort.counts.blockers).toBe(0);
    }
  });

  it('evaluates || ranges and prerelease comparators with npm semantics, ignoring prerelease releases', async () => {
    const mixed = record('ngx-mixed', {
      '4.0.0': peers({ '@angular/core': '^15.0.0 || ^16.0.0-rc.0' }),
      '5.0.0-beta.1': peers({ '@angular/core': '^17.0.0' }),
    });
    const result = await plan('15.0.0', [mixed], [dependency('ngx-mixed', '4.0.0')]);
    expect(lib(result, 16, 'ngx-mixed')).toMatchObject({
      status: 'compatible',
      changeNeeded: false,
      fromPeers: [{ name: '@angular/core', range: '^15.0.0 || ^16.0.0-rc.0', checkedAgainst: '16.2.12', satisfied: true }],
    });
    // 5.0.0-beta.1 accepts 17 but is a prerelease, so it is never offered.
    expect(lib(result, 17, 'ngx-mixed')).toMatchObject({ status: 'blocker', newestCompatible: { value: null } });
  });

  it('prefers the newest non-deprecated release and flags a deprecated-only match', async () => {
    const deprecatedLatest = record('ngx-dep', {
      '1.0.0': peers({ '@angular/core': '^14.0.0 || ^15.0.0' }),
      '1.1.0': peers({ '@angular/core': '^15.0.0' }),
      '1.2.0': { ...peers({ '@angular/core': '^15.0.0' }), deprecated: 'Broken build, use 1.1.0' },
      '2.0.0': { ...peers({ '@angular/core': '^16.0.0' }), deprecated: 'No longer maintained' },
    });
    const result = await plan('14.2.12', [deprecatedLatest], [dependency('ngx-dep', '1.0.0')], {
      targetMajor: 16,
      nodeVersion: null,
    });
    expect(lib(result, 15, 'ngx-dep')).toMatchObject({
      status: 'compatible',
      newestCompatible: { value: '1.1.0' },
      changeNeeded: false,
      deprecated: null,
    });
    expect(lib(result, 16, 'ngx-dep')).toMatchObject({
      status: 'compatible',
      newestCompatible: { value: '2.0.0' },
      changeNeeded: true,
      change: 'major',
      deprecated: 'No longer maintained',
    });
    expect(lib(result, 16, 'ngx-dep').reason).toContain('Every release that accepts this version is deprecated.');
  });

  it('ignores optional Angular peers the project does not use', async () => {
    const optional = record('ngx-opt', {
      '1.0.0': {
        peerDependencies: { '@angular/core': '>=15.0.0', '@angular/animations': '^15.0.0' },
        peerDependenciesMeta: { '@angular/animations': { optional: true } },
      },
    });
    const result = await plan('15.0.0', [optional], [dependency('ngx-opt', '1.0.0')]);
    expect(lib(result, 17, 'ngx-opt')).toMatchObject({ status: 'compatible', changeNeeded: false });
    expect(lib(result, 17, 'ngx-opt').fromPeers[0]).toMatchObject({
      name: '@angular/animations',
      satisfied: null,
      optional: true,
    });
  });

  it('checks non-framework @angular peers against their own newest release of the major', async () => {
    const cdk = record('@angular/cdk', {
      '15.2.9': peers({ '@angular/core': '^15.0.0 || ^16.0.0' }),
      '16.2.14': peers({ '@angular/core': '^16.0.0 || ^17.0.0' }),
    });
    const material = record('@angular/material', {
      '15.2.9': peers({ '@angular/core': '^15.0.0 || ^16.0.0', '@angular/cdk': '15.2.9' }),
      '16.2.14': peers({ '@angular/core': '^16.0.0 || ^17.0.0', '@angular/cdk': '16.2.14' }),
    });
    const result = await plan(
      '15.2.10',
      [cdk, material],
      [dependency('@angular/cdk', '15.2.9'), dependency('@angular/material', '15.2.9')],
      { targetMajor: 16, nodeVersion: null },
    );
    expect(lib(result, 16, '@angular/material')).toMatchObject({
      status: 'compatible',
      newestCompatible: { value: '16.2.14' },
      changeNeeded: true,
    });
    expect(lib(result, 16, '@angular/material').peers.find((p) => p.name === '@angular/cdk')).toEqual({
      name: '@angular/cdk',
      range: '16.2.14',
      checkedAgainst: '16.2.14',
      satisfied: true,
      optional: false,
    });
  });

  // Regression (yunikorn-web fixture): @angular/cdk 16.2.9 accepts Angular 17, but the
  // @angular/material 17.3.10 chosen for that hop needs @angular/cdk 17.3.10 exactly.
  it('moves a library that accepts the hop when another chosen release requires a newer version of it', async () => {
    const cdk = record('@angular/cdk', {
      '15.2.9': peers({ '@angular/core': '^15.0.0' }),
      '16.2.9': peers({ '@angular/core': '^16.0.0 || ^17.0.0' }),
      '17.3.10': peers({ '@angular/core': '^17.0.0 || ^18.0.0' }),
    });
    const material = record('@angular/material', {
      '16.2.9': peers({ '@angular/core': '^16.0.0 || ^17.0.0', '@angular/cdk': '16.2.9' }),
      '17.3.10': peers({ '@angular/core': '^17.0.0 || ^18.0.0', '@angular/cdk': '17.3.10' }),
    });
    const result = await plan(
      '16.2.12',
      [cdk, material],
      [dependency('@angular/cdk', '16.2.9'), dependency('@angular/material', '16.2.9')],
      { targetMajor: 17, nodeVersion: null },
    );
    expect(lib(result, 17, '@angular/material')).toMatchObject({ newestCompatible: { value: '17.3.10' }, changeNeeded: true });
    const cdkResult = lib(result, 17, '@angular/cdk');
    expect(cdkResult).toMatchObject({
      status: 'compatible',
      from: { value: '16.2.9' },
      newestCompatible: { value: '17.3.10' },
      changeNeeded: true,
      change: 'major',
      fromPeers: [],
      evidenceVersion: '17.3.10',
    });
    expect(cdkResult.reason).toBe(
      '@angular/material 17.3.10 requires @angular/cdk "17.3.10", which 16.2.9 does not satisfy; 17.3.10 is the newest release that accepts Angular 17.',
    );
    expect(result.hops[0]!.effort.counts.majorBumps).toBe(2);
  });

  it('keeps a library that accepts the hop when the other chosen releases accept its version', async () => {
    const cdk = record('@angular/cdk', {
      '16.2.9': peers({ '@angular/core': '^16.0.0 || ^17.0.0' }),
      '17.3.10': peers({ '@angular/core': '^17.0.0 || ^18.0.0' }),
    });
    const addon = record('cdk-addon', {
      '2.0.0': peers({ '@angular/core': '>=16.0.0', '@angular/cdk': '>=16.0.0' }),
    });
    const result = await plan(
      '16.2.12',
      [cdk, addon],
      [dependency('@angular/cdk', '16.2.9'), dependency('cdk-addon', '2.0.0')],
      { targetMajor: 17, nodeVersion: null },
    );
    expect(lib(result, 17, '@angular/cdk')).toMatchObject({ changeNeeded: false, change: null });
    expect(lib(result, 17, 'cdk-addon')).toMatchObject({ changeNeeded: false });
  });
});

describe('unknown and unverified data', () => {
  it('lists dependencies without registry data as unclassified and never as compatible', async () => {
    const result = await plan('15.0.0', [], [dependency('ngx-private', '1.0.0')], { nodeVersion: null }, {
      'ngx-private': { status: 'not-found', name: 'ngx-private' },
    });
    expect(result.libraries).toEqual([]);
    expect(result.unclassified).toEqual([
      { name: 'ngx-private', reason: 'not found on the registry (private or unpublished package)' },
    ]);
    expect(result.unverified).toContainEqual({
      hop: null,
      subject: 'ngx-private',
      reason: 'could not tell whether it depends on Angular: not found on the registry (private or unpublished package)',
    });
  });

  it('reports unknown when a peer reference version is missing', async () => {
    const needsCdk = record('ngx-table', { '2.0.0': peers({ '@angular/core': '>=15.0.0', '@angular/cdk': '>=15.0.0' }) });
    const result = await plan('15.0.0', [needsCdk], [dependency('ngx-table', '2.0.0')], { targetMajor: 16 });
    const unknown = lib(result, 16, 'ngx-table');
    expect(unknown).toMatchObject({
      status: 'unknown',
      newestCompatible: { value: null, confidence: 'unverified' },
      changeNeeded: null,
      confidence: 'unverified',
    });
    expect(unknown.reason).toBe(
      'Could not check 2.0.0 against Angular 16: no reference version for @angular/cdk: registry data unavailable: not in the offline cache.',
    );
    expect(result.unverified).toContainEqual({ hop: 16, subject: 'ngx-table', reason: unknown.reason });
  });

  it('reports every library as unknown when Angular release data is missing for an explicit target', async () => {
    const steady = record('ngx-steady', { '2.0.0': peers({ '@angular/core': '^15.0.0 || ^16.0.0' }) });
    const result = await plan('15.0.0', [steady], [dependency('ngx-steady', '2.0.0')], { targetMajor: 16 }, {
      '@angular/core': { status: 'unavailable', name: '@angular/core', reason: 'not in the offline cache' },
    });
    expect(result.hops).toHaveLength(1);
    expect(result.hops[0]!.angular).toMatchObject({ value: null, confidence: 'unverified' });
    expect(lib(result, 16, 'ngx-steady')).toMatchObject({ status: 'unknown', newestCompatible: { value: null } });
    const statuses = result.hops[0]!.requirements.map((r) => [r.name, r.requiredBy, r.status]);
    expect(statuses).toContainEqual(['rxjs', '@angular/core peerDependencies', 'unknown']);
  });

  it('reports unknown when the newest release has no Angular peer to decide', async () => {
    const dropped = record('ngx-dropped', {
      '1.0.0': peers({ '@angular/core': '^15.0.0' }),
      '2.0.0': {},
    });
    const result = await plan('15.0.0', [dropped], [dependency('ngx-dropped', '1.0.0')], { targetMajor: 16 });
    expect(lib(result, 16, 'ngx-dropped')).toMatchObject({ status: 'unknown', evidenceVersion: '2.0.0', uncheckedNewer: 1 });
  });

  it('marks stale cache data and range-minimum versions as unverified', async () => {
    const steady = record('ngx-steady', { '2.0.0': peers({ '@angular/core': '^15.0.0 || ^16.0.0' }) });
    const result = await plan(
      '15.0.0',
      [],
      [dependency('ngx-steady', '2.0.0', { source: 'range-minimum' })],
      { targetMajor: 16, nodeVersion: null },
      { 'ngx-steady': { status: 'ok', name: 'ngx-steady', record: steady, source: 'cache', stale: true } },
    );
    const result16 = lib(result, 16, 'ngx-steady');
    expect(result16.status).toBe('compatible');
    expect(result16.confidence).toBe('unverified');
    expect(result16.newestCompatible.note).toBe('registry data cached on 2026-10-01 could not be refreshed');
    expect(result16.from).toMatchObject({ confidence: 'unverified', source: 'package-json-range' });
    expect(result.unverified.map((item) => item.subject)).toEqual(
      expect.arrayContaining(['installed ngx-steady', 'registry data for ngx-steady', 'ngx-steady']),
    );
  });

  it('lists a requirement checked against a guessed installed version as unverified', async () => {
    const base = project('15.0.0');
    const guessed = {
      ...base,
      dependencies: base.dependencies.map((dep) =>
        dep.name === 'typescript' ? { ...dep, range: '^4.8.4', source: 'range-minimum' as const } : dep,
      ),
    };
    const result16 = await buildPlan(guessed, memorySource(angularRecords()), { targetMajor: 16, nodeVersion: '18.19.0' }, GUIDE);
    const typescript = result16.hops[0]!.requirements.find((r) => r.name === 'typescript')!;
    expect(typescript).toMatchObject({ status: 'unmet', installed: { value: '4.8.4', confidence: 'unverified' } });
    expect(result16.unverified).toContainEqual({
      hop: 16,
      subject: 'installed typescript (@angular/compiler-cli@16.2.12 peerDependencies)',
      reason: 'not resolved in a lockfile; lowest version allowed by "^4.8.4"',
    });
    // Lockfile-confirmed tooling versions are not listed.
    expect(result16.unverified.map((item) => item.subject)).not.toContain('installed rxjs (@angular/core@16.2.12 peerDependencies)');
  });

  it('lists a compatible pick with newer releases that could not be checked as unverified', async () => {
    const partial = record('ngx-partial', { '1.0.0': peers({ '@angular/core': '^15.0.0 || ^16.0.0' }), '1.1.0': {} });
    const result = await plan('15.0.0', [partial], [dependency('ngx-partial', '1.0.0')], { targetMajor: 16 });
    expect(lib(result, 16, 'ngx-partial')).toMatchObject({ status: 'compatible', confidence: 'confirmed', uncheckedNewer: 1 });
    expect(result.unverified).toContainEqual({
      hop: 16,
      subject: 'newest compatible ngx-partial',
      reason: '1 newer release could not be checked, so a newer compatible release may exist',
    });
  });

  it('treats a throwing package source as unavailable data', async () => {
    const result = await plan('15.0.0', [], [dependency('ngx-flaky', '1.0.0')], { targetMajor: 16 }, {
      'ngx-flaky': new Error('socket closed'),
    });
    expect(result.unclassified).toEqual([
      { name: 'ngx-flaky', reason: 'registry data unavailable: lookup failed: socket closed' },
    ]);
  });
});

describe('framework requirements', () => {
  it('flags TypeScript, zone.js and Node requirements that the installed versions do not meet', async () => {
    const source = memorySource(angularRecords());
    const app = project('15.2.10', [], { typescript: '4.8.4', 'zone.js': 'absent' });
    const result = await buildPlan(app, source, { targetMajor: 16, nodeVersion: 'v16.13.0' }, GUIDE);
    const requirements = result.hops[0]!.requirements.map((r) => ({
      name: r.name,
      requiredBy: r.requiredBy,
      range: r.range.value,
      installed: r.installed.value,
      status: r.status,
      flagged: r.flagged,
    }));
    expect(requirements).toEqual([
      {
        name: 'typescript',
        requiredBy: '@angular/compiler-cli@16.2.12 peerDependencies',
        range: '>=4.9.3 <5.2',
        installed: '4.8.4',
        status: 'unmet',
        flagged: true,
      },
      {
        name: 'rxjs',
        requiredBy: '@angular/core@16.2.12 peerDependencies',
        range: '^6.5.3 || ^7.4.0',
        installed: '7.8.1',
        status: 'met',
        flagged: false,
      },
      {
        name: 'zone.js',
        requiredBy: '@angular/core@16.2.12 peerDependencies',
        range: '~0.13.0',
        installed: null,
        status: 'not-installed',
        flagged: true,
      },
      {
        name: 'node',
        requiredBy: '@angular/core@16.2.12 engines',
        range: '^16.14.0 || >=18.10.0',
        installed: '16.13.0',
        status: 'unmet',
        flagged: true,
      },
      {
        name: 'node',
        requiredBy: '@angular/cli@16.2.16 engines',
        range: '^16.14.0 || >=18.10.0',
        installed: '16.13.0',
        status: 'unmet',
        flagged: true,
      },
    ]);
    expect(result.hops[0]!.effort.counts.unmetRequirements).toBe(4);
  });

  it('leaves the Node requirement unknown when no Node version is given', async () => {
    const result = await plan('15.2.10', [], [], { targetMajor: 16, nodeVersion: '18.19.0' });
    expect(result.hops[0]!.requirements.filter((r) => r.name === 'node').map((r) => r.status)).toEqual(['met', 'met']);
    const unknown = await plan('15.2.10', [], [], { targetMajor: 16, nodeVersion: null });
    const node = unknown.hops[0]!.requirements.find((r) => r.name === 'node')!;
    expect(node).toMatchObject({ status: 'unknown', flagged: false, installed: { value: null, confidence: 'unverified' } });
  });
});

describe('update steps', () => {
  it('selects the steps inside each hop, with Material steps only when Material is installed', async () => {
    const result = await plan('14.0.0', [], [], { targetMajor: 17, nodeVersion: null });
    const titles = result.hops.map((hop) => hop.steps.map((s) => `${s.title}:${s.level}`));
    expect(titles).toEqual([
      ['Fourteen two:basic', 'Fifteen basic:basic', 'Fifteen advanced:advanced', 'Fifteen one:medium'],
      [],
      ['Seventeen medium:medium'],
    ]);
    expect(result.hops[1]).toMatchObject({
      stepCoverage: 'none-recorded',
      stepsNote: 'The official update guide records no steps for this hop to Angular 16.',
    });

    const material = record('@angular/material', { '14.2.7': peers({ '@angular/core': '^14.0.0' }) });
    const withMaterial = await plan('14.2.12', [material], [dependency('@angular/material', '14.2.7')], {
      targetMajor: 15,
      nodeVersion: null,
    });
    // 14.2 is already reached, so its step is not repeated.
    expect(withMaterial.hops[0]!.steps.map((s) => [s.title, s.appliesTo])).toEqual([
      ['Fifteen basic', 'all'],
      ['Fifteen advanced', 'all'],
      ['Material fifteen', 'material'],
      ['Fifteen one', 'all'],
    ]);
    expect(withMaterial.hops[0]!.commands).toEqual([
      'ng update @angular/core@15 @angular/cli@15',
      'ng update @angular/material@15',
    ]);
  });

  it('says so when a hop is newer than the bundled snapshot', async () => {
    const source = memorySource(angularRecords());
    const result = await buildPlan(project('16.0.0'), source, { nodeVersion: null }, guide([], 16));
    expect(result.hops[0]).toMatchObject({ to: 17, steps: [], stepCoverage: 'not-covered' });
    expect(result.hops[0]!.stepsNote).toContain('covers Angular up to 16');
    expect(result.unverified).toContainEqual({ hop: 17, subject: 'update steps', reason: result.hops[0]!.stepsNote });
  });

  it('uses the vendored Angular update guide by default', async () => {
    const result = await buildPlan(project('14.2.12'), memorySource(angularRecords()), { targetMajor: 15 });
    expect(result.updateGuide).toMatchObject({ license: 'MIT', coversThroughMajor: 22 });
    expect(result.updateGuide.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.hops[0]!.stepCoverage).toBe('recorded');
    expect(result.hops[0]!.steps.every((s) => s.necessaryAsOf.startsWith('15.'))).toBe(true);
    expect(result.hops[0]!.steps.some((s) => s.appliesTo === 'material')).toBe(false);
  });
});

describe('effort and determinism', () => {
  const libraries = [
    record('ngx-steady', {
      '1.0.0': peers({ '@angular/core': '^14.0.0' }),
      '2.0.0': peers({ '@angular/core': '^15.0.0 || ^16.0.0 || ^17.0.0' }),
    }),
    record('ngx-stuck', { '3.0.0': peers({ '@angular/core': '>=14.0.0 <17.0.0' }) }),
  ];
  const extra = [dependency('ngx-steady', '1.0.0'), dependency('ngx-stuck', '3.0.0')];

  it('scores each hop from steps, major bumps, unmet requirements and blockers', async () => {
    const result = await plan('14.2.12', libraries, extra, { nodeVersion: '18.19.0' });
    expect(result.hops.map((hop) => hop.effort)).toEqual([
      // 15: TypeScript 4.8.4 and zone.js 0.11.8 still fit.
      {
        points: 9,
        label: 'S',
        counts: { steps: { basic: 1, medium: 1, advanced: 1 }, majorBumps: 1, unmetRequirements: 0, blockers: 0 },
        breakdown: { base: 2, steps: 4, majorBumps: 3, requirements: 0, blockers: 0 },
      },
      // 16: TypeScript and zone.js are too old.
      {
        points: 6,
        label: 'S',
        counts: { steps: { basic: 0, medium: 0, advanced: 0 }, majorBumps: 0, unmetRequirements: 2, blockers: 0 },
        breakdown: { base: 2, steps: 0, majorBumps: 0, requirements: 4, blockers: 0 },
      },
      // 17: the same, plus ngx-stuck becomes a blocker.
      {
        points: 15,
        label: 'S',
        counts: { steps: { basic: 0, medium: 1, advanced: 0 }, majorBumps: 0, unmetRequirements: 2, blockers: 1 },
        breakdown: { base: 2, steps: 1, majorBumps: 0, requirements: 4, blockers: 8 },
      },
    ]);
    expect(result.effort).toEqual({
      points: 30,
      label: 'S',
      counts: { steps: { basic: 1, medium: 2, advanced: 1 }, majorBumps: 1, unmetRequirements: 4, blockers: 1 },
      breakdown: { base: 6, steps: 5, majorBumps: 3, requirements: 8, blockers: 8 },
    });
  });

  it('maps points to S, M, L and XL labels', () => {
    const effortFor = (basic: number) =>
      hopEffort({ steps: Array.from({ length: basic }, () => ({ level: 'basic' }) as PlanStep), libraries: [], requirements: [] });
    // 2 base points plus 2 per basic step.
    expect([8, 9, 18, 19, 33, 34].map((n) => [effortFor(n).points, effortFor(n).label])).toEqual([
      [18, 'S'],
      [20, 'M'],
      [38, 'M'],
      [40, 'L'],
      [68, 'L'],
      [70, 'XL'],
    ]);
    // The total adds up the counts of every hop and uses wider bounds.
    const total = (basic: number) => totalEffort([{ effort: effortFor(basic) }]);
    expect([18, 19, 58, 59, 123, 124].map((n) => [total(n).points, total(n).label])).toEqual([
      [38, 'S'],
      [40, 'M'],
      [118, 'M'],
      [120, 'L'],
      [248, 'L'],
      [250, 'XL'],
    ]);
    expect(totalEffort([]).label).toBe('S');
  });

  it('gives identical, JSON-serializable output for identical input', async () => {
    const first = await plan('14.2.12', libraries, extra);
    const second = await plan('14.2.12', [...libraries].reverse(), [...extra].reverse());
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});
