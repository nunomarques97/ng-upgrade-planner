// Framework requirements of a hop: TypeScript, RxJS, zone.js and Node ranges declared by the
// target @angular/core, @angular/compiler-cli and @angular/cli releases.
import { satisfiesPeer } from './compat.js';
import { fact, newestInMajor, recordEvidence, unavailableReason, unverified } from './evidence.js';
import type { PackageResult } from '../registry/types.js';
import type { Fact, Requirement, RequirementName, RequirementStatus } from './types.js';

interface RequirementSource {
  name: RequirementName;
  from: '@angular/core' | '@angular/compiler-cli' | '@angular/cli';
  field: 'peerDependencies' | 'engines';
}

const SOURCES: readonly RequirementSource[] = [
  { name: 'typescript', from: '@angular/compiler-cli', field: 'peerDependencies' },
  { name: 'rxjs', from: '@angular/core', field: 'peerDependencies' },
  { name: 'zone.js', from: '@angular/core', field: 'peerDependencies' },
  { name: 'node', from: '@angular/core', field: 'engines' },
  { name: 'node', from: '@angular/cli', field: 'engines' },
];

export interface RequirementContext {
  lookup(name: string): PackageResult | undefined;
  /** Installed version of a requirement; value null with source 'none' when it is not installed. */
  installed(name: RequirementName): Fact<string | null>;
}

function statusOf(range: string | null, installed: Fact<string | null>): RequirementStatus {
  if (range === null) return 'unknown';
  if (installed.value === null) return installed.source === 'none' ? 'not-installed' : 'unknown';
  return satisfiesPeer(installed.value, range) ? 'met' : 'unmet';
}

export function hopRequirements(major: number, context: RequirementContext): Requirement[] {
  const requirements: Requirement[] = [];
  for (const source of SOURCES) {
    const result = context.lookup(source.from);
    const installed = context.installed(source.name);
    let range: Fact<string | null>;
    let requiredBy = `${source.from} ${source.field}`;
    let optional = false;

    if (result?.status !== 'ok') {
      range = unverified(null, `${source.from}: ${unavailableReason(result)}`);
    } else {
      const version = newestInMajor(result.record, major);
      if (version === undefined) {
        range = unverified(null, `the registry data for ${source.from} has no stable ${major}.x release`);
      } else {
        const record = result.record.versions[version]!;
        const value = record[source.field]?.[source.name];
        // Not declared by this release: nothing to require.
        if (value === undefined) continue;
        requiredBy = `${source.from}@${version} ${source.field}`;
        optional = source.field === 'peerDependencies' && record.peerDependenciesMeta?.[source.name]?.optional === true;
        range = fact(value, recordEvidence(result));
      }
    }

    const status = statusOf(range.value, installed);
    requirements.push({
      name: source.name,
      requiredBy,
      range,
      installed,
      optional,
      status,
      flagged: status === 'unmet' || (status === 'not-installed' && !optional),
    });
  }
  return requirements;
}
