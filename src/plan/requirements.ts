// Framework requirements of a hop: the RxJS and zone.js peer ranges of the target @angular/core,
// and the toolchain: the Node.js engines ranges of @angular/core and @angular/cli and the
// TypeScript peer range of @angular/compiler-cli, checked against the project.
import semver from 'semver';
import { satisfiesPeer } from './compat.js';
import { combine, fact, newestInMajor, recordEvidence, unavailableReason, unverified } from './evidence.js';
import type { PackageResult } from '../registry/types.js';
import type {
  Fact,
  HopToolchain,
  Requirement,
  RequirementName,
  RequirementStatus,
  ToolchainCheck,
  ToolchainStatus,
} from './types.js';

type SourcePackage = '@angular/core' | '@angular/compiler-cli' | '@angular/cli';
type SourceField = 'peerDependencies' | 'engines';

interface RequirementSource {
  name: RequirementName;
  from: SourcePackage;
  field: SourceField;
}

const SOURCES: readonly RequirementSource[] = [
  { name: 'rxjs', from: '@angular/core', field: 'peerDependencies' },
  { name: 'zone.js', from: '@angular/core', field: 'peerDependencies' },
];

const NODE_SOURCES: readonly SourcePackage[] = ['@angular/core', '@angular/cli'];

type Lookup = (name: string) => PackageResult | undefined;

export interface RequirementContext {
  lookup: Lookup;
  /** Installed version of a requirement; value null with source 'none' when it is not installed. */
  installed(name: RequirementName): Fact<string | null>;
}

export interface ToolchainContext {
  lookup: Lookup;
  /** The project's engines.node: confirmed from package.json, or unverified when missing or invalid. */
  engines: Fact<string | null>;
  /** The installed typescript version, as for any dependency. */
  typescript: Fact<string | null>;
}

interface Declared {
  /** null: the release declares nothing in that field, so there is nothing to require. */
  range: Fact<string | null> | null;
  requiredBy: string;
  optional: boolean;
}

/** The range `name` of the newest stable `major` release of `from` declares in `field`. */
function declared(major: number, lookup: Lookup, from: SourcePackage, field: SourceField, name: string): Declared {
  const result = lookup(from);
  if (result?.status !== 'ok') {
    return { range: unverified(null, `${from}: ${unavailableReason(result)}`), requiredBy: `${from} ${field}`, optional: false };
  }
  const version = newestInMajor(result.record, major);
  if (version === undefined) {
    return {
      range: unverified(null, `the registry data for ${from} has no stable ${major}.x release`),
      requiredBy: `${from} ${field}`,
      optional: false,
    };
  }
  const record = result.record.versions[version]!;
  const value = record[field]?.[name];
  return {
    range: value === undefined ? null : fact(value, recordEvidence(result)),
    requiredBy: `${from}@${version} ${field}`,
    optional: field === 'peerDependencies' && record.peerDependenciesMeta?.[name]?.optional === true,
  };
}

function statusOf(range: string | null, installed: Fact<string | null>): RequirementStatus {
  if (range === null) return 'unknown';
  if (installed.value === null) return installed.source === 'none' ? 'not-installed' : 'unknown';
  return satisfiesPeer(installed.value, range) ? 'met' : 'unmet';
}

export function hopRequirements(major: number, context: RequirementContext): Requirement[] {
  const requirements: Requirement[] = [];
  for (const source of SOURCES) {
    const found = declared(major, context.lookup, source.from, source.field, source.name);
    // Not declared by this release: nothing to require.
    if (found.range === null) continue;
    const installed = context.installed(source.name);
    const status = statusOf(found.range.value, installed);
    requirements.push({
      name: source.name,
      requiredBy: found.requiredBy,
      range: found.range,
      installed,
      optional: found.optional,
      status,
      flagged: status === 'unmet' || (status === 'not-installed' && !found.optional),
    });
  }
  return requirements;
}

/**
 * A range that holds exactly the versions every one of `ranges` accepts, or null when one of them
 * is not a valid range. Each comparator set of the result keeps the highest lower bound and the
 * lowest upper bound of a combination of sets; combinations that accept nothing are dropped.
 */
export function intersectRanges(ranges: readonly string[]): string | null {
  const parsed = ranges.map((range) => (semver.validRange(range) === null ? null : new semver.Range(range)));
  if (parsed.length === 0 || parsed.some((range) => range === null)) return null;
  if (new Set(ranges).size === 1) return ranges[0]!;
  let sets: semver.Comparator[][] = [[]];
  for (const range of parsed as semver.Range[]) {
    sets = sets.flatMap((left) => range.set.map((right) => [...left, ...right]));
  }
  const kept = new Set<string>();
  for (const set of sets) {
    const text = simplify(set);
    if (text !== null) kept.add(text);
  }
  // Nothing satisfies them all: a range no version satisfies.
  return kept.size === 0 ? '<0.0.0-0' : [...kept].join(' || ');
}

/** One comparator set reduced to its tightest bounds, or null when no version satisfies it. */
function simplify(set: readonly semver.Comparator[]): string | null {
  let lower: semver.Comparator | undefined;
  let upper: semver.Comparator | undefined;
  const exact: semver.Comparator[] = [];
  for (const comparator of set) {
    // The comparator of "*" has an empty value and accepts every version.
    if (comparator.value === '') continue;
    const op = comparator.operator;
    if (op === '>' || op === '>=') {
      const tighter = !lower || semver.gt(comparator.semver, lower.semver) || (semver.eq(comparator.semver, lower.semver) && op === '>');
      if (tighter) lower = comparator;
    } else if (op === '<' || op === '<=') {
      const tighter = !upper || semver.lt(comparator.semver, upper.semver) || (semver.eq(comparator.semver, upper.semver) && op === '<');
      if (tighter) upper = comparator;
    } else {
      exact.push(comparator);
    }
  }
  const parts = [...new Set([...exact, lower, upper].filter((part): part is semver.Comparator => part !== undefined).map((part) => part.value))];
  const text = parts.length === 0 ? '*' : parts.join(' ');
  try {
    return semver.minVersion(text) === null ? null : text;
  } catch {
    return null;
  }
}

function nodeCheck(major: number, context: ToolchainContext): ToolchainCheck {
  const found = NODE_SOURCES.map((from) => declared(major, context.lookup, from, 'engines', 'node'));
  const known = found.filter((item): item is Declared & { range: Fact<string | null> } => item.range !== null);
  const requiredBy = known.map((item) => item.requiredBy);
  const engines = context.engines;
  const missingRange = known.find((item) => item.range.value === null);
  let range: Fact<string | null>;
  if (known.length === 0) {
    range = unverified(null, `neither @angular/core nor @angular/cli ${major}.x declares a Node.js engines range`);
  } else if (missingRange) {
    range = missingRange.range;
  } else {
    const values = known.map((item) => item.range.value!);
    const combined = intersectRanges(values);
    const evidence = combine(known.map((item) => item.range), known[0]!.range);
    range =
      combined === null
        ? unverified(null, `the Node.js engines range "${values.join('" and "')}" is not a valid version range`, evidence.source)
        : fact(combined, evidence);
  }

  const result = (status: ToolchainStatus, reason: string): ToolchainCheck => ({
    name: 'node',
    range,
    requiredBy,
    project: engines,
    status,
    reason,
  });
  if (range.value === null) return result('unverified', `the Node.js range of Angular ${major} is not known: ${range.note ?? 'no data'}`);
  if (engines.value === null || engines.confidence === 'unverified') {
    return result('unverified', `${engines.note ?? 'engines.node is not known'}, so the Node.js range "${range.value}" of Angular ${major} was not checked`);
  }
  const options = { includePrerelease: false };
  if (!semver.intersects(engines.value, range.value, options)) {
    return result(
      'blocker',
      `engines.node "${engines.value}" allows no Node.js version inside "${range.value}": move the project to a Node.js version inside that range and update engines.node`,
    );
  }
  if (!semver.subset(engines.value, range.value, options)) {
    return result(
      'warning',
      `engines.node "${engines.value}" also allows Node.js versions outside "${range.value}": use a version inside both and narrow engines.node`,
    );
  }
  return result('ok', `engines.node "${engines.value}" is inside "${range.value}"`);
}

function typescriptCheck(major: number, context: ToolchainContext): ToolchainCheck {
  const found = declared(major, context.lookup, '@angular/compiler-cli', 'peerDependencies', 'typescript');
  const range = found.range ?? unverified(null, `@angular/compiler-cli ${major}.x declares no typescript peer range`);
  const installed = context.typescript;
  const result = (status: ToolchainStatus, reason: string): ToolchainCheck => ({
    name: 'typescript',
    range,
    requiredBy: found.range === null ? [] : [found.requiredBy],
    project: installed,
    status,
    reason,
  });
  if (range.value === null) return result('unverified', `the TypeScript range of Angular ${major} is not known: ${range.note ?? 'no data'}`);
  if (installed.value === null) {
    const why = installed.source === 'none' ? 'typescript is not a direct dependency' : (installed.note ?? 'the installed typescript is not known');
    return result('unverified', `${why}, so the TypeScript the project uses was not checked against "${range.value}"`);
  }
  const inside = satisfiesPeer(installed.value, range.value);
  if (installed.source !== 'lockfile') {
    const guess = inside ? 'would be inside' : 'would be outside';
    return result(
      'unverified',
      `typescript ${installed.value} ${guess} "${range.value}", but it is guessed (${installed.note ?? 'not from the lockfile'}), so this is not confirmed`,
    );
  }
  if (!inside) {
    return result(
      'blocker',
      `typescript ${installed.value} from the lockfile is outside "${range.value}": after ng update, install a TypeScript inside that range if ng update did not move it there`,
    );
  }
  return result('ok', `typescript ${installed.value} from the lockfile is inside "${range.value}"`);
}

/** Node.js and TypeScript requirements of the hop to `major`, checked against the project. */
export function hopToolchain(major: number, context: ToolchainContext): HopToolchain {
  return { node: nodeCheck(major, context), typescript: typescriptCheck(major, context) };
}
