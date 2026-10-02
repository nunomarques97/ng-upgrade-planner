import { createRequire } from 'node:module';
import type * as YarnLockfile from '@yarnpkg/lockfile';
import { describeCause, ProjectError } from '../errors.js';
import { isPlainObject, own, ownObject, type PlainObject } from '../own.js';
import { exactVersion, type ParsedLockfile } from './types.js';
import { parseYamlDocuments } from './yaml.js';

// Loaded through require: the package is a CommonJS bundle that also sets __esModule, so ESM
// default-import interop differs between Node and bundlers.
const yarnClassic = createRequire(import.meta.url)('@yarnpkg/lockfile') as typeof YarnLockfile;

/** Yarn 2 and later (berry) write YAML with a __metadata block; Yarn 1 uses its own format. */
export function isYarnBerry(text: string): boolean {
  return /^__metadata:/m.test(text);
}

function parseClassic(text: string, file: string): ParsedLockfile {
  let result: ReturnType<typeof yarnClassic.parse>;
  try {
    // The Yarn 1 tokenizer scans for the next quote or newline without checking for the end of
    // the input, so an unterminated string or a final comment without a newline makes it grow a
    // string until memory runs out. A trailing comment holding a quote bounds both scans and is
    // ignored by the parser.
    result = yarnClassic.parse(`${text}\n# "\n`, file);
  } catch (error) {
    throw new ProjectError(
      'MALFORMED_LOCKFILE',
      `${file} could not be parsed as a Yarn 1 lockfile (${describeCause(error)}).`,
      file,
    );
  }
  if (result.type === 'conflict') {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} contains unresolved merge conflicts.`, file);
  }
  const entries: unknown = result.object;
  if (!isPlainObject(entries)) {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} could not be parsed as a Yarn 1 lockfile.`, file);
  }
  return {
    kind: 'yarn-classic',
    formatVersion: '1',
    resolve(name, range) {
      // Yarn 1 keys each entry by the exact descriptor from package.json, for example "rxjs@~7.5.0".
      const entry = ownObject(entries, `${name}@${range}`);
      return entry ? exactVersion(own(entry, 'version')) : undefined;
    },
  };
}

function parseBerry(text: string, file: string): ParsedLockfile {
  const data = parseYamlDocuments(text, file).find((doc) => isPlainObject(own(doc, '__metadata')));
  if (!data) throw new ProjectError('MALFORMED_LOCKFILE', `${file} has no __metadata block.`, file);
  const metadata = ownObject(data, '__metadata') ?? {};
  const rawVersion = own(metadata, 'version');
  const formatVersion = typeof rawVersion === 'number' || typeof rawVersion === 'string' ? String(rawVersion) : '';
  if (!formatVersion) throw new ProjectError('MALFORMED_LOCKFILE', `${file} has no __metadata version.`, file);

  // One entry can be keyed by several descriptors: "rxjs@npm:~7.5.0, rxjs@npm:^7.0.0".
  const byDescriptor = new Map<string, PlainObject>();
  let workspaceRoot: PlainObject | undefined;
  for (const [key, value] of Object.entries(data)) {
    if (key === '__metadata') continue;
    if (!isPlainObject(value)) {
      throw new ProjectError('MALFORMED_LOCKFILE', `${file} has an entry that is not a map.`, file);
    }
    for (const descriptor of key.split(',')) byDescriptor.set(descriptor.trim(), value);
    const resolution = own(value, 'resolution');
    if (typeof resolution === 'string' && resolution.endsWith('@workspace:.')) workspaceRoot = value;
  }
  const rootDependencies = workspaceRoot ? ownObject(workspaceRoot, 'dependencies') : undefined;

  return {
    kind: 'yarn-berry',
    formatVersion,
    resolve(name, range) {
      // Prefer the range the lockfile recorded for the root workspace, then the package.json range.
      const ranges: string[] = [];
      const recorded = rootDependencies ? own(rootDependencies, name) : undefined;
      if (typeof recorded === 'string') ranges.push(recorded);
      ranges.push(range);
      for (const candidate of ranges) {
        const entry = byDescriptor.get(`${name}@${candidate}`) ?? byDescriptor.get(`${name}@npm:${candidate}`);
        if (!entry) continue;
        if (own(entry, 'linkType') === 'soft') return undefined;
        const version = own(entry, 'version');
        return exactVersion(typeof version === 'number' ? String(version) : version);
      }
      return undefined;
    },
  };
}

/** Parses yarn.lock in the Yarn 1 (classic) or Yarn 2+ (berry) format. */
export function parseYarnLockfile(text: string, file: string): ParsedLockfile {
  return isYarnBerry(text) ? parseBerry(text, file) : parseClassic(text, file);
}
