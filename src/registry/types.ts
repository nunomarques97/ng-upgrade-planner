// The trimmed package record. The local cache and the recorded test fixtures use this exact
// schema, so a fixture folder can be used as a cache directory.

export const RECORD_SCHEMA = 1;

/** The fields kept for one published version. Maps are null-prototype objects. */
export interface VersionRecord {
  peerDependencies?: Readonly<Record<string, string>>;
  peerDependenciesMeta?: Readonly<Record<string, { readonly optional: boolean }>>;
  engines?: Readonly<Record<string, string>>;
  /** Deprecation message as published; present only when the version is deprecated. */
  deprecated?: string;
  /** Publish time as an ISO 8601 string, when the registry provided it. */
  time?: string;
}

export interface PackageRecord {
  schema: typeof RECORD_SCHEMA;
  name: string;
  /** When the record was fetched from the registry, as an ISO 8601 string. */
  fetchedAt: string;
  distTags: Readonly<Record<string, string>>;
  versions: Readonly<Record<string, Readonly<VersionRecord>>>;
}

/**
 * Result of looking up one package:
 * - ok: a record from the network or the cache. `stale` is true when the record is older than
 *   the cache TTL, or when it was used because the registry could not be reached.
 * - not-found: the registry answered 404.
 * - unavailable: no data could be obtained (offline cache miss, repeated failures, invalid name).
 */
export type PackageResult =
  | {
      status: 'ok';
      name: string;
      record: PackageRecord;
      source: 'network' | 'cache';
      stale: boolean;
      /** Why the registry could not be used, when a cached record was used as a fallback. */
      fallbackReason?: string;
    }
  | { status: 'not-found'; name: string }
  | { status: 'unavailable'; name: string; reason: string };
