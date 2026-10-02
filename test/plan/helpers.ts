// In-memory registry data and project builders for plan tests. Nothing here touches the network.
import type { UpdateGuideData, UpdateGuideStep } from '../../src/data/types.js';
import type { PackageSource } from '../../src/plan/index.js';
import type { ProjectDependency, ProjectInfo } from '../../src/project/types.js';
import type { PackageRecord, PackageResult, VersionRecord } from '../../src/registry/types.js';

export const FETCHED_AT = '2026-10-01T12:00:00.000Z';

export function record(name: string, versions: Record<string, VersionRecord>, latest?: string): PackageRecord {
  const keys = Object.keys(versions);
  return {
    schema: 1,
    name,
    fetchedAt: FETCHED_AT,
    distTags: { latest: latest ?? keys[keys.length - 1]! },
    versions,
  };
}

export const peers = (map: Record<string, string>): VersionRecord => ({ peerDependencies: map });

/** Angular framework releases 14 to 17 (with a prerelease of 18 that must never be used) and tooling records. */
export function angularRecords(): PackageRecord[] {
  const coreVersion = (rxjs: string, zone: string, node: string): VersionRecord => ({
    peerDependencies: { rxjs, 'zone.js': zone },
    engines: { node },
  });
  const core = record(
    '@angular/core',
    {
      '14.0.0': coreVersion('^6.5.3 || ^7.4.0', '~0.11.4', '^14.15.0 || >=16.10.0'),
      '14.2.12': coreVersion('^6.5.3 || ^7.4.0', '~0.11.4', '^14.15.0 || >=16.10.0'),
      '15.0.0': coreVersion('^6.5.3 || ^7.4.0', '~0.11.4 || ~0.12.0', '^14.20.0 || ^16.13.0 || >=18.10.0'),
      '15.2.10': coreVersion('^6.5.3 || ^7.4.0', '~0.11.4 || ~0.12.0 || ~0.13.0', '^14.20.0 || ^16.13.0 || >=18.10.0'),
      '16.0.0-rc.0': coreVersion('^6.5.3 || ^7.4.0', '~0.13.0', '^16.14.0 || >=18.10.0'),
      '16.2.12': coreVersion('^6.5.3 || ^7.4.0', '~0.13.0', '^16.14.0 || >=18.10.0'),
      '17.3.12': coreVersion('^6.5.3 || ^7.4.0', '~0.14.0', '^18.13.0 || ^20.9.0'),
      '18.0.0-next.1': coreVersion('^6.5.3 || ^7.4.0', '~0.14.0', '^18.19.1 || ^20.11.1'),
    },
    '17.3.12',
  );
  const compilerCli = record('@angular/compiler-cli', {
    '14.2.12': peers({ '@angular/compiler': '14.2.12', typescript: '>=4.6.2 <4.9' }),
    '15.2.10': peers({ '@angular/compiler': '15.2.10', typescript: '>=4.8.2 <5.1' }),
    '16.2.12': peers({ '@angular/compiler': '16.2.12', typescript: '>=4.9.3 <5.2' }),
    '17.3.12': peers({ '@angular/compiler': '17.3.12', typescript: '>=5.2 <5.5' }),
  });
  const cli = record('@angular/cli', {
    '14.2.13': { engines: { node: '^14.15.0 || >=16.10.0' } },
    '15.2.11': { engines: { node: '^14.20.0 || ^16.13.0 || >=18.10.0' } },
    '16.2.16': { engines: { node: '^16.14.0 || >=18.10.0' } },
    '17.3.11': { engines: { node: '^18.13.0 || ^20.9.0' } },
  });
  // Tooling packages declare no Angular peers, so they are never in the library matrix.
  const tooling = ['rxjs', 'typescript', 'zone.js'].map((name) => record(name, { '1.0.0': {} }));
  return [core, compilerCli, cli, ...tooling];
}

export interface MemorySource extends PackageSource {
  calls: string[];
}

/** A package source backed by records; any other name is unavailable, as in an offline cache miss. */
export function memorySource(
  records: readonly PackageRecord[],
  overrides: Record<string, PackageResult | Error> = {},
): MemorySource {
  const byName = new Map(records.map((r) => [r.name, r]));
  const calls: string[] = [];
  return {
    calls,
    getPackage(name) {
      calls.push(name);
      const override = overrides[name];
      if (override instanceof Error) return Promise.reject(override);
      if (override) return Promise.resolve(override);
      const found = byName.get(name);
      return Promise.resolve(
        found
          ? { status: 'ok', name, record: found, source: 'cache', stale: false }
          : { status: 'unavailable', name, reason: 'not in the offline cache' },
      );
    },
  };
}

export function dependency(
  name: string,
  version: string | null,
  options: Partial<Pick<ProjectDependency, 'kind' | 'range' | 'source' | 'registryName'>> = {},
): ProjectDependency {
  return {
    name,
    registryName: options.registryName ?? name,
    kind: options.kind ?? 'dependencies',
    range: options.range ?? (version === null ? 'github:owner/repo' : `^${version}`),
    version,
    source: options.source ?? (version === null ? 'unresolved' : 'lockfile'),
  };
}

/** A project on `angular` with the usual framework packages plus `extra` dependencies. */
export function project(angular: string, extra: ProjectDependency[] = [], tooling: Record<string, string> = {}): ProjectInfo {
  const deps = [
    dependency('@angular/common', angular),
    dependency('@angular/core', angular),
    dependency('@angular/compiler-cli', angular, { kind: 'devDependencies' }),
    dependency('@angular/cli', angular, { kind: 'devDependencies' }),
    dependency('@angular-devkit/build-angular', angular, { kind: 'devDependencies' }),
    dependency('rxjs', tooling.rxjs ?? '7.8.1'),
    dependency('zone.js', tooling['zone.js'] ?? '0.11.8'),
    dependency('typescript', tooling.typescript ?? '4.8.4', { kind: 'devDependencies' }),
    ...extra,
  ].filter((dep) => dep.version !== 'absent');
  return {
    root: '/project',
    name: 'demo-app',
    packageManager: null,
    lockfile: { kind: 'npm', file: 'package-lock.json', path: '/project/package-lock.json', formatVersion: '3' },
    angular: { range: `^${angular}`, version: angular, source: 'lockfile' },
    dependencies: deps.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    warnings: [],
  };
}

export function step(necessaryAsOf: number, level: UpdateGuideStep['level'], title: string, extra: Partial<UpdateGuideStep> = {}): UpdateGuideStep {
  return { step: title, action: `Do ${title}.`, possibleIn: necessaryAsOf - 100, necessaryAsOf, level, ...extra };
}

export function guide(steps: UpdateGuideStep[], coversThroughMajor = 17): UpdateGuideData {
  return {
    source: {
      url: 'https://example.invalid/recommendations.ts',
      repository: 'https://example.invalid',
      path: 'recommendations.ts',
      commit: '0000000',
      commitDate: '2026-01-01',
      retrieved: '2026-01-02',
      license: 'MIT',
      licenseUrl: 'https://example.invalid/license',
      copyright: 'test',
      coversThroughMajor,
    },
    steps,
  };
}
