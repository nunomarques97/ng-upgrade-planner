import semver from 'semver';
import type { LockfileKind } from '../types.js';

export interface ParsedLockfile {
  kind: LockfileKind;
  formatVersion: string;
  /**
   * The version the lockfile resolved for a direct dependency of the root project, or
   * undefined when the lockfile has no usable entry (missing, linked, git or file source).
   */
  resolve(name: string, range: string): string | undefined;
}

/** Returns the normalised version when `raw` is a valid semver version. */
export function exactVersion(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  return semver.valid(raw) ?? undefined;
}
