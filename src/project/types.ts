export type DependencyKind = 'dependencies' | 'devDependencies';

/**
 * Where a dependency version came from:
 * - lockfile: the exact version resolved in the lockfile
 * - range-minimum: no lockfile entry, so the lowest version allowed by the package.json range
 * - unresolved: neither source gave a usable version (for example a git or file dependency)
 */
export type VersionSource = 'lockfile' | 'range-minimum' | 'unresolved';

export type LockfileKind = 'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry';

export type PackageManagerName = 'npm' | 'pnpm' | 'yarn';

export interface ProjectDependency {
  /** Name as declared in package.json. */
  name: string;
  /** Name to look up in the registry; differs from `name` for `npm:` aliases. */
  registryName: string;
  kind: DependencyKind;
  /** Declared range exactly as written in package.json. */
  range: string;
  version: string | null;
  source: VersionSource;
}

export interface LockfileInfo {
  kind: LockfileKind;
  /** File name relative to the project root, for example `pnpm-lock.yaml`. */
  file: string;
  path: string;
  formatVersion: string;
}

export type ProjectWarningCode =
  | 'multiple-lockfiles'
  | 'package-manager-lockfile-missing'
  | 'no-lockfile'
  | 'invalid-package-name'
  | 'invalid-dependency-spec'
  | 'duplicate-dependency'
  | 'not-in-lockfile'
  | 'unresolved-version';

export interface ProjectWarning {
  code: ProjectWarningCode;
  message: string;
  packageName?: string;
}

export interface ProjectInfo {
  root: string;
  name: string | null;
  /** Raw `packageManager` field from package.json, if any. */
  packageManager: string | null;
  lockfile: LockfileInfo | null;
  angular: {
    range: string;
    version: string;
    source: Exclude<VersionSource, 'unresolved'>;
  };
  /** Direct dependencies and devDependencies, sorted by name. */
  dependencies: ProjectDependency[];
  warnings: ProjectWarning[];
}
