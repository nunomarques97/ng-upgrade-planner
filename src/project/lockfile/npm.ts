import { describeCause, ProjectError } from '../errors.js';
import { isPlainObject, own, ownObject, stripBom, type PlainObject } from '../own.js';
import { exactVersion, type ParsedLockfile } from './types.js';

/** Version from a v1 `dependencies` entry; aliases are written as `npm:real-name@1.2.3`. */
function v1Version(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  if (raw.startsWith('npm:')) return exactVersion(raw.slice(raw.lastIndexOf('@') + 1));
  return exactVersion(raw);
}

function optionalObject(data: PlainObject, key: string, file: string): PlainObject | undefined {
  const value = own(data, key);
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} has a "${key}" field that is not an object.`, file);
  }
  return value;
}

/** Parses package-lock.json or npm-shrinkwrap.json, lockfileVersion 1, 2 or 3. */
export function parseNpmLockfile(text: string, file: string): ParsedLockfile {
  let data: unknown;
  try {
    data = JSON.parse(stripBom(text));
  } catch (error) {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} is not valid JSON (${describeCause(error)}).`, file);
  }
  if (!isPlainObject(data)) {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} does not contain a JSON object.`, file);
  }

  const lockfileVersion = own(data, 'lockfileVersion');
  if (typeof lockfileVersion !== 'number' || !Number.isInteger(lockfileVersion) || lockfileVersion < 1) {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} has no valid lockfileVersion.`, file);
  }
  if (lockfileVersion > 3) {
    throw new ProjectError(
      'UNSUPPORTED_LOCKFILE',
      `${file} uses lockfileVersion ${lockfileVersion}; versions 1 to 3 are supported.`,
      file,
    );
  }

  const packages = optionalObject(data, 'packages', file);
  const dependencies = optionalObject(data, 'dependencies', file);
  if (lockfileVersion === 3 && packages === undefined) {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} (lockfileVersion 3) has no "packages" field.`, file);
  }

  return {
    kind: 'npm',
    formatVersion: String(lockfileVersion),
    resolve(name) {
      // v2 and v3 describe the installed tree in "packages"; v1 only has "dependencies".
      if (packages !== undefined) {
        const entry = ownObject(packages, `node_modules/${name}`);
        if (!entry || own(entry, 'link') === true) return undefined;
        return exactVersion(own(entry, 'version'));
      }
      if (dependencies !== undefined) {
        const entry = ownObject(dependencies, name);
        return entry ? v1Version(own(entry, 'version')) : undefined;
      }
      return undefined;
    },
  };
}
