// Toolchain checks per hop: the project's engines.node against the Node.js engines ranges of
// @angular/core and @angular/cli, and the installed TypeScript against the @angular/compiler-cli
// peer range. The local Node.js version is context only.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_POINTS, TOOLCHAIN_POINTS, hopEffort, totalEffort } from '../../src/plan/effort.js';
import { buildPlan, type UpgradePlan } from '../../src/plan/index.js';
import { intersectRanges } from '../../src/plan/requirements.js';
import type { NodeEngine, ProjectDependency, ProjectInfo } from '../../src/project/types.js';
import { angularRecords, guide, memorySource, project, toolchain } from './helpers.js';

const GUIDE = guide([]);

// Ranges of the test records (helpers.ts): Angular 16 needs Node.js "^16.14.0 || >=18.10.0" and
// TypeScript ">=4.9.3 <5.2"; Angular 17 needs "^18.13.0 || ^20.9.0" and ">=5.2 <5.5".
function app(nodeEngine: NodeEngine, typescript: Partial<ProjectDependency> | null = { version: '5.1.6' }): ProjectInfo {
  const base = project('15.2.10');
  const dependencies = base.dependencies
    .filter((dep) => dep.name !== 'typescript' || typescript !== null)
    .map((dep) => (dep.name === 'typescript' ? { ...dep, ...typescript } : dep));
  return { ...base, nodeEngine, dependencies };
}

async function plan(info: ProjectInfo, nodeVersion: string | null = '22.12.0', targetMajor = 16): Promise<UpgradePlan> {
  return buildPlan(info, memorySource(angularRecords()), { targetMajor, nodeVersion }, GUIDE);
}

const declared = (range: string): NodeEngine => ({ status: 'declared', range });

describe('Node.js requirement per hop', () => {
  it('states the Node.js range of the hop from @angular/core and @angular/cli engines', async () => {
    const result = await plan(app(declared('>=18.10.0')));
    expect(result.hops[0]!.toolchain.node).toMatchObject({
      name: 'node',
      range: { value: '^16.14.0 || >=18.10.0', confidence: 'confirmed', source: 'registry-cache' },
      requiredBy: ['@angular/core@16.2.12 engines', '@angular/cli@16.2.16 engines'],
      project: { value: '>=18.10.0', confidence: 'confirmed', source: 'package-json' },
    });
  });

  it('is in range when engines.node is inside the hop range', async () => {
    const node = (await plan(app(declared('^18.10.0 || ^20.0.0')))).hops[0]!.toolchain.node;
    expect(node.status).toBe('ok');
    expect(node.reason).toBe('engines.node "^18.10.0 || ^20.0.0" is inside "^16.14.0 || >=18.10.0"');
  });

  it('is a warning when engines.node is partly outside the hop range', async () => {
    const result = await plan(app(declared('>=16.0.0')));
    const node = result.hops[0]!.toolchain.node;
    expect(node.status).toBe('warning');
    expect(node.reason).toBe(
      'engines.node ">=16.0.0" also allows Node.js versions outside "^16.14.0 || >=18.10.0": use a version inside both and narrow engines.node',
    );
    expect(result.hops[0]!.effort.counts.toolchain).toEqual({ nodeBlockers: 0, nodeWarnings: 1, typescriptBlockers: 0 });
  });

  it('is a blocker when engines.node is fully outside the hop range', async () => {
    const result = await plan(app(declared('^14.20.0')));
    const node = result.hops[0]!.toolchain.node;
    expect(node.status).toBe('blocker');
    expect(node.reason).toBe(
      'engines.node "^14.20.0" allows no Node.js version inside "^16.14.0 || >=18.10.0": move the project to a Node.js version inside that range and update engines.node',
    );
    expect(result.hops[0]!.effort.counts.toolchain.nodeBlockers).toBe(1);
  });

  it('checks every hop against the same engines.node', async () => {
    // "^16.14.0" is inside Angular 16's range and outside Angular 17's.
    const result = await plan(app(declared('^16.14.0')), '22.12.0', 17);
    expect(result.hops.map((hop) => [hop.to, hop.toolchain.node.status])).toEqual([
      [16, 'ok'],
      [17, 'blocker'],
    ]);
  });

  it('is unverified, not a blocker, when engines.node is missing', async () => {
    const result = await plan(app({ status: 'missing', range: null }));
    const node = result.hops[0]!.toolchain.node;
    expect(node.status).toBe('unverified');
    expect(node.project).toMatchObject({ value: null, confidence: 'unverified' });
    expect(node.reason).toBe('package.json has no engines.node, so the Node.js range "^16.14.0 || >=18.10.0" of Angular 16 was not checked');
    expect(result.hops[0]!.effort.counts.toolchain).toEqual({ nodeBlockers: 0, nodeWarnings: 0, typescriptBlockers: 0 });
    expect(result.unverified).toContainEqual({ hop: 16, subject: 'Node.js requirement', reason: node.reason });
  });

  it('is unverified when engines.node is not a valid range', async () => {
    const result = await plan(app({ status: 'invalid', range: 'lts/hydrogen' }));
    const node = result.hops[0]!.toolchain.node;
    expect(node.status).toBe('unverified');
    expect(node.reason).toBe(
      'engines.node "lts/hydrogen" in package.json is not a valid version range, so the Node.js range "^16.14.0 || >=18.10.0" of Angular 16 was not checked',
    );
    expect(result.toolchain).toMatchObject({ enginesStatus: 'invalid', engines: { value: 'lts/hydrogen', confidence: 'unverified' } });
  });

  it('shows the local Node.js version as context and never decides the status with it', async () => {
    const engines = declared('^14.20.0');
    const old = await plan(app(engines), 'v14.21.3');
    const current = await plan(app(engines), '22.12.0');
    const unknown = await plan(app(engines), null);
    expect([old, current, unknown].map((result) => result.hops[0]!.toolchain.node.status)).toEqual(['blocker', 'blocker', 'blocker']);
    expect(old.toolchain.localNode).toEqual({ value: '14.21.3', confidence: 'confirmed', source: 'option', note: null });
    expect(current.toolchain.localNode.value).toBe('22.12.0');
    expect(unknown.toolchain.localNode).toMatchObject({ value: null, confidence: 'unverified' });
    // A missing engines.node stays unverified whatever the local version.
    const missing = await plan(app({ status: 'missing', range: null }), '22.12.0');
    expect(missing.hops[0]!.toolchain.node.status).toBe('unverified');
  });

  it('uses the @angular/cli range alone when @angular/core declares no engines', async () => {
    const records = angularRecords().map((item) =>
      item.name === '@angular/core'
        ? { ...item, versions: Object.fromEntries(Object.entries(item.versions).map(([v, data]) => [v, { peerDependencies: data.peerDependencies ?? {} }])) }
        : item,
    );
    const result = await buildPlan(app(declared('>=18.10.0')), memorySource(records), { targetMajor: 16, nodeVersion: null }, GUIDE);
    expect(result.hops[0]!.toolchain.node).toMatchObject({ status: 'ok', requiredBy: ['@angular/cli@16.2.16 engines'] });
  });

  it('is unverified when the registry data for the range is missing', async () => {
    const result = await buildPlan(
      app(declared('>=18.10.0')),
      memorySource(angularRecords().filter((item) => item.name !== '@angular/cli')),
      { targetMajor: 16, nodeVersion: null },
      GUIDE,
    );
    const node = result.hops[0]!.toolchain.node;
    expect(node.status).toBe('unverified');
    expect(node.reason).toBe('the Node.js range of Angular 16 is not known: @angular/cli: registry data unavailable: not in the offline cache');
  });
});

describe('TypeScript requirement per hop', () => {
  it('states the TypeScript range of the hop from the @angular/compiler-cli peer', async () => {
    const typescript = (await plan(app(declared('>=18.10.0')))).hops[0]!.toolchain.typescript;
    expect(typescript).toMatchObject({
      range: { value: '>=4.9.3 <5.2', confidence: 'confirmed' },
      requiredBy: ['@angular/compiler-cli@16.2.12 peerDependencies'],
      project: { value: '5.1.6', confidence: 'confirmed', source: 'lockfile' },
      status: 'ok',
      reason: 'typescript 5.1.6 from the lockfile is inside ">=4.9.3 <5.2"',
    });
  });

  it('is a blocker when the lockfile TypeScript is outside the range', async () => {
    const result = await plan(app(declared('>=18.10.0'), { version: '4.8.4' }));
    const typescript = result.hops[0]!.toolchain.typescript;
    expect(typescript.status).toBe('blocker');
    expect(typescript.reason).toBe(
      'typescript 4.8.4 from the lockfile is outside ">=4.9.3 <5.2": after ng update, install a TypeScript inside that range if ng update did not move it there',
    );
    expect(result.hops[0]!.effort.counts.toolchain.typescriptBlockers).toBe(1);
  });

  it('gives an unverified result, not a blocker, for a version guessed from the package.json range', async () => {
    const outside = await plan(app(declared('>=18.10.0'), { version: '4.8.4', range: '^4.8.4', source: 'range-minimum' }));
    const typescript = outside.hops[0]!.toolchain.typescript;
    expect(typescript.status).toBe('unverified');
    expect(typescript.reason).toBe(
      'typescript 4.8.4 would be outside ">=4.9.3 <5.2", but it is guessed (not resolved in a lockfile; lowest version allowed by "^4.8.4"), so this is not confirmed',
    );
    expect(outside.hops[0]!.effort.counts.toolchain.typescriptBlockers).toBe(0);
    expect(outside.unverified).toContainEqual({ hop: 16, subject: 'TypeScript requirement', reason: typescript.reason });

    const inside = await plan(app(declared('>=18.10.0'), { version: '5.0.4', range: '~5.0.4', source: 'range-minimum' }));
    expect(inside.hops[0]!.toolchain.typescript).toMatchObject({ status: 'unverified' });
    expect(inside.hops[0]!.toolchain.typescript.reason).toMatch(/^typescript 5\.0\.4 would be inside/);
  });

  it('is unverified when typescript is not a direct dependency', async () => {
    const typescript = (await plan(app(declared('>=18.10.0'), null))).hops[0]!.toolchain.typescript;
    expect(typescript.status).toBe('unverified');
    expect(typescript.reason).toBe(
      'typescript is not a direct dependency, so the TypeScript the project uses was not checked against ">=4.9.3 <5.2"',
    );
  });

  it('keeps a stale range decided but lists it as unverified', async () => {
    const compilerCli = angularRecords().find((item) => item.name === '@angular/compiler-cli')!;
    const result = await buildPlan(
      app(declared('>=18.10.0'), { version: '4.8.4' }),
      memorySource(angularRecords(), {
        '@angular/compiler-cli': { status: 'ok', name: '@angular/compiler-cli', record: compilerCli, source: 'cache', stale: true },
      }),
      { targetMajor: 16, nodeVersion: null },
      GUIDE,
    );
    expect(result.hops[0]!.toolchain.typescript).toMatchObject({ status: 'blocker', range: { confidence: 'unverified', source: 'stale-cache' } });
    expect(result.unverified.map((item) => `${item.hop} ${item.subject}`)).toContain('16 TypeScript requirement');
  });
});

describe('toolchain effort', () => {
  it('weighs a Node.js blocker like a library blocker, a Node.js warning and a TypeScript blocker like an unmet requirement', () => {
    expect(TOOLCHAIN_POINTS).toEqual({ nodeBlocker: 8, nodeWarning: 2, typescriptBlocker: 2 });
    const effort = (node: Parameters<typeof toolchain>[0], typescript: Parameters<typeof toolchain>[1]) =>
      hopEffort({ steps: [], libraries: [], requirements: [], toolchain: toolchain(node, typescript), removedApis: [], rxjs: [] });
    expect(effort('blocker', 'blocker').breakdown.toolchain).toBe(10);
    expect(effort('warning', 'ok').breakdown.toolchain).toBe(2);
    expect(effort('ok', 'blocker').breakdown.toolchain).toBe(2);
    // Unverified results add nothing.
    expect(effort('unverified', 'unverified').breakdown.toolchain).toBe(0);
    expect(effort('warning', 'blocker').points).toBe(BASE_POINTS + 4);
    const total = totalEffort([{ effort: effort('blocker', 'ok') }, { effort: effort('warning', 'blocker') }]);
    expect(total.counts.toolchain).toEqual({ nodeBlockers: 1, nodeWarnings: 1, typescriptBlockers: 1 });
    expect(total.breakdown.toolchain).toBe(12);
    const { base, steps, majorBumps, requirements, blockers, toolchain: points, removedApis } = total.breakdown;
    expect(base + steps + majorBumps + requirements + blockers + points + removedApis).toBe(total.points);
  });

  it('adds the toolchain points to the hop effort of a plan', async () => {
    const result = await plan(app(declared('^14.20.0'), { version: '4.8.4' }));
    expect(result.hops[0]!.effort.breakdown.toolchain).toBe(TOOLCHAIN_POINTS.nodeBlocker + TOOLCHAIN_POINTS.typescriptBlocker);
    expect(result.effort.breakdown.toolchain).toBe(10);
  });
});

describe('intersectRanges', () => {
  it('keeps a single shared range as written', () => {
    expect(intersectRanges(['^18.13.0 || >=20.9.0', '^18.13.0 || >=20.9.0'])).toBe('^18.13.0 || >=20.9.0');
  });

  it('keeps only the versions every range accepts', () => {
    const combined = intersectRanges(['>=14.15.0', '^14.15.0 || >=16.10.0'])!;
    expect(combined).toBe('>=14.15.0 <15.0.0-0 || >=16.10.0');
    expect(intersectRanges(['^16.0.0', '^18.0.0'])).toBe('<0.0.0-0');
    expect(intersectRanges(['*', '>=18.0.0'])).toBe('>=18.0.0');
  });

  it('returns null for an invalid range', () => {
    expect(intersectRanges(['>=18', 'not a range'])).toBeNull();
    expect(intersectRanges([])).toBeNull();
  });
});

describe('documented toolchain weights', () => {
  it('match the effort constants in docs/WALKTHROUGH.md', () => {
    const text = readFileSync(new URL('../../docs/WALKTHROUGH.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');
    expect(text).toContain(`Toolchain: ${TOOLCHAIN_POINTS.nodeBlocker} per Node.js blocker`);
    expect(TOOLCHAIN_POINTS.nodeWarning).toBe(TOOLCHAIN_POINTS.typescriptBlocker);
    expect(text).toContain(`${TOOLCHAIN_POINTS.nodeWarning} per Node.js warning or TypeScript blocker, 0 if unverified`);
  });
});
