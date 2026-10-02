// Turns untrusted JSON (a registry document or a cache file) into a trimmed PackageRecord.
// Every map is rebuilt as a null-prototype object from own properties only, so keys such as
// `__proto__` or `constructor` can never reach or shadow Object.prototype.
import semver from 'semver';
import { isPlainObject, own, ownObject, type PlainObject } from '../project/own.js';
import { isValidPackageName } from '../project/package-name.js';
import { RECORD_SCHEMA, type PackageRecord, type VersionRecord } from './types.js';

function emptyMap<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function isCanonicalVersion(value: unknown): value is string {
  return typeof value === 'string' && semver.valid(value) === value;
}

function isoTime(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

function stringMap(value: unknown, validKey: (key: string) => boolean): Record<string, string> | undefined {
  if (!isPlainObject(value)) return undefined;
  const out = emptyMap<string>();
  let count = 0;
  for (const key of Object.keys(value)) {
    const range = own(value, key);
    if (typeof range !== 'string' || !validKey(key)) continue;
    out[key] = range;
    count++;
  }
  return count > 0 ? out : undefined;
}

function peerMeta(value: unknown): Record<string, { readonly optional: boolean }> | undefined {
  if (!isPlainObject(value)) return undefined;
  const out = emptyMap<{ readonly optional: boolean }>();
  let count = 0;
  for (const key of Object.keys(value)) {
    const meta = own(value, key);
    if (!isValidPackageName(key) || !isPlainObject(meta)) continue;
    out[key] = { optional: own(meta, 'optional') === true };
    count++;
  }
  return count > 0 ? out : undefined;
}

const isEngineName = (key: string): boolean => /^[A-Za-z0-9][\w.-]{0,63}$/.test(key);

function versionRecord(raw: PlainObject, time: unknown): VersionRecord {
  const record: VersionRecord = {};
  const peers = stringMap(own(raw, 'peerDependencies'), isValidPackageName);
  if (peers) record.peerDependencies = peers;
  const meta = peerMeta(own(raw, 'peerDependenciesMeta'));
  if (meta) record.peerDependenciesMeta = meta;
  const engines = stringMap(own(raw, 'engines'), isEngineName);
  if (engines) record.engines = engines;
  const deprecated = own(raw, 'deprecated');
  if (typeof deprecated === 'string' && deprecated.length > 0) record.deprecated = deprecated;
  const iso = isoTime(time);
  if (iso) record.time = iso;
  return record;
}

function distTags(value: unknown): Record<string, string> {
  const out = emptyMap<string>();
  if (!isPlainObject(value)) return out;
  for (const tag of Object.keys(value)) {
    const version = own(value, tag);
    if (tag.length > 0 && isCanonicalVersion(version)) out[tag] = version;
  }
  return out;
}

function versions(
  value: PlainObject,
  timeOf: (version: string, raw: PlainObject) => unknown,
): Record<string, VersionRecord> {
  const out = emptyMap<VersionRecord>();
  for (const version of Object.keys(value)) {
    const raw = own(value, version);
    if (!isCanonicalVersion(version) || !isPlainObject(raw)) continue;
    out[version] = versionRecord(raw, timeOf(version, raw));
  }
  return out;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as PlainObject)[key]);
  }
  return value;
}

/**
 * Trims a registry packument (full or abbreviated) to a PackageRecord. Returns undefined when
 * the document does not have the expected shape or describes a different package.
 */
export function trimRegistryDocument(doc: unknown, name: string, fetchedAt: Date): PackageRecord | undefined {
  if (!isPlainObject(doc)) return undefined;
  const docName = own(doc, 'name');
  if (docName !== undefined && docName !== name) return undefined;
  const rawVersions = ownObject(doc, 'versions');
  if (!rawVersions) return undefined;
  const times = ownObject(doc, 'time');
  return deepFreeze({
    schema: RECORD_SCHEMA,
    name,
    fetchedAt: fetchedAt.toISOString(),
    distTags: distTags(own(doc, 'dist-tags')),
    versions: versions(rawVersions, (version) => (times ? own(times, version) : undefined)),
  });
}

/**
 * Validates a stored record (cache file or recorded fixture). Returns undefined when the schema,
 * the package name or the fetch time does not match, so the caller treats it as a cache miss.
 */
export function parseRecord(data: unknown, name: string): PackageRecord | undefined {
  if (!isPlainObject(data)) return undefined;
  if (own(data, 'schema') !== RECORD_SCHEMA || own(data, 'name') !== name) return undefined;
  const fetchedAt = isoTime(own(data, 'fetchedAt'));
  const rawTags = own(data, 'distTags');
  const rawVersions = ownObject(data, 'versions');
  if (!fetchedAt || !isPlainObject(rawTags) || !rawVersions) return undefined;
  return deepFreeze({
    schema: RECORD_SCHEMA,
    name,
    fetchedAt,
    distTags: distTags(rawTags),
    versions: versions(rawVersions, (_version, raw) => own(raw, 'time')),
  });
}
