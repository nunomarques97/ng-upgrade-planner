import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';
import { describeCause, ProjectError, systemErrorCode } from './errors.js';
import { parseNpmLockfile } from './lockfile/npm.js';
import { parsePnpmLockfile } from './lockfile/pnpm.js';
import type { ParsedLockfile } from './lockfile/types.js';
import { parseYarnLockfile } from './lockfile/yarn.js';
import { isPlainObject, own, stripBom, type PlainObject } from './own.js';
import { packageNameProblem } from './package-name.js';
import type {
  DependencyKind,
  LockfileInfo,
  PackageManagerName,
  ProjectDependency,
  ProjectInfo,
  ProjectWarning,
} from './types.js';

interface LockfileCandidate {
  file: string;
  manager: PackageManagerName;
  parse: (text: string, file: string) => ParsedLockfile;
}

/** Fixed lookup order used when package.json has no usable packageManager field. */
const LOCKFILES: readonly LockfileCandidate[] = [
  { file: 'npm-shrinkwrap.json', manager: 'npm', parse: parseNpmLockfile },
  { file: 'package-lock.json', manager: 'npm', parse: parseNpmLockfile },
  { file: 'pnpm-lock.yaml', manager: 'pnpm', parse: parsePnpmLockfile },
  { file: 'yarn.lock', manager: 'yarn', parse: parseYarnLockfile },
];

const DEPENDENCY_KINDS: readonly DependencyKind[] = ['dependencies', 'devDependencies'];

/** Renders an untrusted value for a message so control characters cannot reach the terminal. */
function quote(value: string): string {
  return JSON.stringify(value);
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    throw new ProjectError('READ_FAILED', `Could not read ${file} (${systemErrorCode(error) ?? 'unknown error'}).`, file);
  }
}

async function readPackageJson(root: string): Promise<PlainObject> {
  const file = path.join(root, 'package.json');
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    const code = systemErrorCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new ProjectError('NO_PACKAGE_JSON', `No package.json found in ${root}. Run this inside an Angular project.`, file);
    }
    if (code === 'EISDIR') throw new ProjectError('NO_PACKAGE_JSON', `${file} is not a file.`, file);
    throw new ProjectError('READ_FAILED', `Could not read ${file} (${code ?? 'unknown error'}).`, file);
  }
  let data: unknown;
  try {
    data = JSON.parse(stripBom(text));
  } catch (error) {
    throw new ProjectError('INVALID_PACKAGE_JSON', `${file} is not valid JSON (${describeCause(error)}).`, file);
  }
  if (!isPlainObject(data)) {
    throw new ProjectError('INVALID_PACKAGE_JSON', `${file} must contain a JSON object.`, file);
  }
  return data;
}

function parsePackageManager(field: unknown): PackageManagerName | undefined {
  if (typeof field !== 'string') return undefined;
  const match = /^(npm|pnpm|yarn)@/.exec(field.trim());
  return match ? (match[1] as PackageManagerName) : undefined;
}

async function selectLockfile(
  root: string,
  manager: PackageManagerName | undefined,
  warnings: ProjectWarning[],
): Promise<LockfileCandidate | undefined> {
  const present: LockfileCandidate[] = [];
  for (const candidate of LOCKFILES) {
    if (await isFile(path.join(root, candidate.file))) present.push(candidate);
  }

  let chosen: LockfileCandidate | undefined;
  if (manager) {
    chosen = present.find((candidate) => candidate.manager === manager);
    if (!chosen) {
      warnings.push({
        code: 'package-manager-lockfile-missing',
        message: `package.json names ${manager} as its package manager but no ${manager} lockfile was found.`,
      });
    }
  }
  chosen ??= present[0];

  if (present.length > 1 && chosen) {
    warnings.push({
      code: 'multiple-lockfiles',
      message: `Found ${present.map((c) => c.file).join(', ')}; using ${chosen.file}.`,
    });
  }
  if (!chosen) {
    warnings.push({
      code: 'no-lockfile',
      message: 'No lockfile found; versions are the minimum allowed by the package.json ranges.',
    });
  }
  return chosen;
}

/** Splits an `npm:real-name@range` alias; other specs keep their own name. */
function splitAlias(name: string, range: string): { registryName: string; range: string } {
  if (!range.startsWith('npm:')) return { registryName: name, range };
  const spec = range.slice(4);
  const at = spec.indexOf('@', 1);
  return at === -1 ? { registryName: spec, range: '' } : { registryName: spec.slice(0, at), range: spec.slice(at + 1) };
}

function rangeMinimum(range: string): string | undefined {
  const valid = semver.validRange(range);
  if (valid === null) return undefined;
  try {
    return semver.minVersion(valid)?.version;
  } catch {
    return undefined;
  }
}

function readDependencies(
  pkg: PlainObject,
  packageJsonPath: string,
  lockfile: ParsedLockfile | undefined,
  lockfileName: string | undefined,
  warnings: ProjectWarning[],
): ProjectDependency[] {
  const byName = new Map<string, ProjectDependency>();
  for (const kind of DEPENDENCY_KINDS) {
    const section = own(pkg, kind);
    if (section === undefined || section === null) continue;
    if (!isPlainObject(section)) {
      throw new ProjectError('INVALID_PACKAGE_JSON', `"${kind}" in ${packageJsonPath} must be an object.`, packageJsonPath);
    }
    for (const [name, value] of Object.entries(section)) {
      const problem = packageNameProblem(name);
      if (problem) {
        warnings.push({
          code: 'invalid-package-name',
          message: `Skipped ${quote(name)} in ${kind}: not a valid npm package name (${problem}).`,
        });
        continue;
      }
      if (typeof value !== 'string') {
        warnings.push({
          code: 'invalid-dependency-spec',
          message: `Skipped ${name} in ${kind}: its version range is not a string.`,
          packageName: name,
        });
        continue;
      }
      if (byName.has(name)) {
        warnings.push({
          code: 'duplicate-dependency',
          message: `${name} is listed in both dependencies and devDependencies; using the dependencies entry.`,
          packageName: name,
        });
        continue;
      }

      const alias = splitAlias(name, value);
      if (alias.registryName !== name && packageNameProblem(alias.registryName)) {
        warnings.push({
          code: 'invalid-package-name',
          message: `Skipped ${name} in ${kind}: alias target ${quote(alias.registryName)} is not a valid npm package name.`,
          packageName: name,
        });
        continue;
      }

      const dependency: ProjectDependency = {
        name,
        registryName: alias.registryName,
        kind,
        range: value,
        version: null,
        source: 'unresolved',
      };
      const locked = lockfile?.resolve(name, value);
      if (locked) {
        dependency.version = locked;
        dependency.source = 'lockfile';
      } else {
        if (lockfile && lockfileName) {
          warnings.push({
            code: 'not-in-lockfile',
            message: `${name} has no usable entry in ${lockfileName}; falling back to the package.json range.`,
            packageName: name,
          });
        }
        const minimum = rangeMinimum(alias.range);
        if (minimum) {
          dependency.version = minimum;
          dependency.source = 'range-minimum';
        } else {
          warnings.push({
            code: 'unresolved-version',
            message: `Could not determine a version for ${name} from ${quote(value)}.`,
            packageName: name,
          });
        }
      }
      byName.set(name, dependency);
    }
  }
  return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Reads the Angular project rooted at `dir`: the installed @angular/core version and the
 * declared range and resolved version of every direct dependency and devDependency.
 * Expected problems are thrown as ProjectError with a one-line message.
 */
export async function readProject(dir: string): Promise<ProjectInfo> {
  const root = path.resolve(dir);
  const packageJsonPath = path.join(root, 'package.json');
  const pkg = await readPackageJson(root);
  const warnings: ProjectWarning[] = [];

  const packageManagerField = own(pkg, 'packageManager');
  const manager = parsePackageManager(packageManagerField);
  const candidate = await selectLockfile(root, manager, warnings);

  let lockfile: ParsedLockfile | undefined;
  let lockfileInfo: LockfileInfo | null = null;
  if (candidate) {
    const lockfilePath = path.join(root, candidate.file);
    lockfile = candidate.parse(await readText(lockfilePath), candidate.file);
    lockfileInfo = { kind: lockfile.kind, file: candidate.file, path: lockfilePath, formatVersion: lockfile.formatVersion };
  }

  const dependencies = readDependencies(pkg, packageJsonPath, lockfile, candidate?.file, warnings);
  const core = dependencies.find((dependency) => dependency.name === '@angular/core');
  if (!core) {
    const angularJs = dependencies.some((dependency) => dependency.name === 'angular');
    throw new ProjectError(
      'NO_ANGULAR_CORE',
      angularJs
        ? `${packageJsonPath} depends on AngularJS ("angular"), not Angular. ng-upgrade-planner plans upgrades for Angular 2 and later (@angular/core).`
        : `${packageJsonPath} has no @angular/core dependency, so this is not an Angular project.`,
      packageJsonPath,
    );
  }
  if (core.version === null || core.source === 'unresolved') {
    throw new ProjectError(
      'ANGULAR_VERSION_UNKNOWN',
      `Could not determine the installed @angular/core version from the lockfile or the range ${quote(core.range)}.`,
      packageJsonPath,
    );
  }

  const name = own(pkg, 'name');
  return {
    root,
    name: typeof name === 'string' ? name : null,
    packageManager: typeof packageManagerField === 'string' ? packageManagerField : null,
    lockfile: lockfileInfo,
    angular: { range: core.range, version: core.version, source: core.source },
    dependencies,
    warnings,
  };
}
