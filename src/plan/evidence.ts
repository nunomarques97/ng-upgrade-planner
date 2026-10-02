// Helpers that turn registry results and project data into Facts, and pick versions from records.
import semver from 'semver';
import type { ProjectDependency } from '../project/types.js';
import type { PackageRecord, PackageResult } from '../registry/types.js';
import type { Confidence, EvidenceSource, Fact } from './types.js';

export type OkResult = Extract<PackageResult, { status: 'ok' }>;

export interface Evidence {
  confidence: Confidence;
  source: EvidenceSource;
  note: string | null;
}

export function fact<T>(value: T, evidence: Evidence): Fact<T> {
  return { value, confidence: evidence.confidence, source: evidence.source, note: evidence.note };
}

export function unverified<T>(value: T, note: string, source: EvidenceSource = 'none'): Fact<T> {
  return { value, confidence: 'unverified', source, note };
}

export function confirmed<T>(value: T, source: EvidenceSource): Fact<T> {
  return { value, confidence: 'confirmed', source, note: null };
}

/** Evidence of a registry record: fresh data is confirmed, stale cache data is not. */
export function recordEvidence(result: OkResult): Evidence {
  if (!result.stale) {
    return { confidence: 'confirmed', source: result.source === 'network' ? 'registry' : 'registry-cache', note: null };
  }
  const reason = result.fallbackReason === undefined ? '' : ` (${result.fallbackReason})`;
  return {
    confidence: 'unverified',
    source: 'stale-cache',
    note: `registry data cached on ${result.record.fetchedAt.slice(0, 10)} could not be refreshed${reason}`,
  };
}

/** Combines evidence: the result is confirmed only when every part is. */
export function combine(parts: readonly Evidence[], fallback: Evidence): Evidence {
  return parts.find((part) => part.confidence === 'unverified') ?? parts[0] ?? fallback;
}

export function unavailableReason(result: PackageResult | undefined): string {
  if (result === undefined) return 'registry data was not looked up';
  if (result.status === 'not-found') return 'not found on the registry (private or unpublished package)';
  if (result.status === 'unavailable') return `registry data unavailable: ${result.reason}`;
  return 'registry data available';
}

/** Installed version of a direct dependency with its evidence. */
export function installedFact(dependency: ProjectDependency | undefined): Fact<string | null> {
  if (!dependency) return unverified(null, 'not a direct dependency of the project');
  if (dependency.source === 'lockfile') return confirmed(dependency.version, 'lockfile');
  if (dependency.source === 'range-minimum') {
    return unverified(
      dependency.version,
      `not resolved in a lockfile; lowest version allowed by "${dependency.range}"`,
      'package-json-range',
    );
  }
  return unverified(null, `could not determine the installed version from "${dependency.range}"`, 'package-json-range');
}

const sortedVersions = new WeakMap<PackageRecord, readonly string[]>();

/** Stable (non-prerelease) versions of a record, newest first. */
export function stableVersions(record: PackageRecord): readonly string[] {
  let versions = sortedVersions.get(record);
  if (!versions) {
    versions = Object.keys(record.versions)
      .filter((version) => semver.prerelease(version) === null)
      .sort(semver.rcompare);
    sortedVersions.set(record, versions);
  }
  return versions;
}

/** Newest stable release of a major, preferring releases that are not deprecated. */
export function newestInMajor(record: PackageRecord, major: number): string | undefined {
  const inMajor = stableVersions(record).filter((version) => semver.major(version) === major);
  return inMajor.find((version) => record.versions[version]?.deprecated === undefined) ?? inMajor[0];
}

export function majorsWithStableRelease(record: PackageRecord): Set<number> {
  return new Set(stableVersions(record).map((version) => semver.major(version)));
}

export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
