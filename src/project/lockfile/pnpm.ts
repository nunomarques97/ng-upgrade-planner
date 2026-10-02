import { ProjectError } from '../errors.js';
import { isPlainObject, own, ownObject, type PlainObject } from '../own.js';
import { exactVersion, type ParsedLockfile } from './types.js';
import { parseYamlDocuments } from './yaml.js';

const NON_REGISTRY_PREFIXES = ['link:', 'file:', 'workspace:', 'git+', 'git:', 'github:', 'http:', 'https:'];

/**
 * Extracts the version from a pnpm importer version string. Forms across lockfile formats:
 *   v5: 14.2.12_rxjs@7.5.7+zone.js@0.11.8, or an alias path /real-name/1.2.3
 *   v6: 16.0.0(rxjs@7.8.1)(zone.js@0.13.0), or an alias path /real-name@1.2.3
 *   v9: 18.0.0(rxjs@7.8.1), or an alias real-name@1.2.3
 */
export function pnpmVersion(raw: unknown, legacy: boolean): string | undefined {
  if (typeof raw !== 'string') return undefined;
  if (NON_REGISTRY_PREFIXES.some((prefix) => raw.startsWith(prefix))) return undefined;
  let value = raw;
  const paren = value.indexOf('(');
  if (paren !== -1) value = value.slice(0, paren);
  // In v5 peer suffixes follow an underscore, which never appears in a semver version.
  if (legacy) {
    const underscore = value.indexOf('_');
    if (underscore !== -1) value = value.slice(0, underscore);
  }
  const direct = exactVersion(value);
  if (direct) return direct;
  const at = value.lastIndexOf('@');
  const afterAt = at > 0 ? exactVersion(value.slice(at + 1)) : undefined;
  if (afterAt) return afterAt;
  if (legacy && value.startsWith('/')) return exactVersion(value.slice(value.lastIndexOf('/') + 1));
  return undefined;
}

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];

function describesRootDependencies(doc: PlainObject): boolean {
  const importers = own(doc, 'importers');
  const root = isPlainObject(importers) ? (ownObject(importers, '.') ?? {}) : doc;
  return DEPENDENCY_SECTIONS.some((key) => own(root, key) !== undefined);
}

function pickMainDocument(documents: PlainObject[], file: string): PlainObject {
  // pnpm 10 may write a document for config and package manager dependencies before the main
  // one. Prefer the document that lists the root dependencies, else the last versioned one.
  const versioned = documents.filter((doc) => own(doc, 'lockfileVersion') !== undefined);
  const main = versioned.find(describesRootDependencies) ?? versioned.at(-1);
  if (!main) throw new ProjectError('MALFORMED_LOCKFILE', `${file} has no valid lockfileVersion.`, file);
  return main;
}

/** Parses pnpm-lock.yaml in the v5 (5.x), v6 (6.x) or v9 (9.x) formats. */
export function parsePnpmLockfile(text: string, file: string): ParsedLockfile {
  const data = pickMainDocument(parseYamlDocuments(text, file), file);
  const rawVersion = own(data, 'lockfileVersion');
  const formatVersion = typeof rawVersion === 'number' || typeof rawVersion === 'string' ? String(rawVersion) : '';
  const major = Number.parseInt(formatVersion, 10);
  if (Number.isNaN(major)) {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} has no valid lockfileVersion.`, file);
  }
  if (major < 5 || major > 9) {
    throw new ProjectError(
      'UNSUPPORTED_LOCKFILE',
      `${file} uses lockfileVersion ${formatVersion}; versions 5.x, 6.x and 9.x are supported.`,
      file,
    );
  }
  const legacy = major === 5;

  // Workspaces, and every v9 lockfile, keep the root project's dependencies under importers['.'].
  const importers = own(data, 'importers');
  let root: PlainObject = data;
  if (importers !== undefined) {
    if (!isPlainObject(importers)) {
      throw new ProjectError('MALFORMED_LOCKFILE', `${file} has an "importers" field that is not a map.`, file);
    }
    root = ownObject(importers, '.') ?? {};
  }

  const sections: PlainObject[] = [];
  for (const key of DEPENDENCY_SECTIONS) {
    const section = own(root, key);
    if (section === undefined || section === null) continue;
    if (!isPlainObject(section)) {
      throw new ProjectError('MALFORMED_LOCKFILE', `${file} has a "${key}" section that is not a map.`, file);
    }
    sections.push(section);
  }

  return {
    kind: 'pnpm',
    formatVersion,
    resolve(name) {
      for (const section of sections) {
        const entry = own(section, name);
        if (entry === undefined) continue;
        // v5 maps a name to a version string; v6 and v9 map it to { specifier, version }.
        const raw = isPlainObject(entry) ? own(entry, 'version') : entry;
        return pnpmVersion(raw, legacy);
      }
      return undefined;
    },
  };
}
