// Builds the upgrade plan: the hop path, per-hop steps, framework requirements, the library
// compatibility matrix and the effort estimate.
import semver from 'semver';
import { UPDATE_GUIDE } from '../data/update-steps.js';
import type { UpdateGuideData } from '../data/types.js';
import { describeCause } from '../project/errors.js';
import type { ProjectDependency, ProjectInfo } from '../project/types.js';
import type { PackageResult } from '../registry/types.js';
import {
  alignRequiredVersions,
  angularPeers,
  evaluateLibrary,
  nextFrom,
  type LibraryContext,
  type ReferenceVersions,
} from './compat.js';
import { hopEffort, totalEffort } from './effort.js';
import { PlanError } from './errors.js';
import {
  byName,
  confirmed,
  fact,
  installedFact,
  majorsWithStableRelease,
  newestInMajor,
  recordEvidence,
  stableVersions,
  unavailableReason,
  unverified,
  type OkResult,
} from './evidence.js';
import { isAngularPackage, isFrameworkPackage, isLockstepPackage } from './framework.js';
import { hopRequirements } from './requirements.js';
import { encodedVersion, hopSteps } from './steps.js';
import {
  PLAN_SCHEMA,
  type Fact,
  type FrameworkPackage,
  type Hop,
  type Library,
  type PackageSource,
  type PlanOptions,
  type UnclassifiedDependency,
  type UnverifiedItem,
  type UpgradePlan,
} from './types.js';

const CORE = '@angular/core';
const COMPILER_CLI = '@angular/compiler-cli';
const CLI = '@angular/cli';

type Results = Map<string, PackageResult>;

async function lookupAll(source: PackageSource, names: Iterable<string>, results: Results): Promise<void> {
  const missing = [...new Set(names)].filter((name) => !results.has(name));
  const found = await Promise.all(
    missing.map(async (name): Promise<PackageResult> => {
      try {
        return await source.getPackage(name);
      } catch (error) {
        return { status: 'unavailable', name, reason: `lookup failed: ${describeCause(error)}` };
      }
    }),
  );
  missing.forEach((name, index) => results.set(name, found[index]!));
}

function ok(result: PackageResult | undefined): OkResult | undefined {
  return result?.status === 'ok' ? result : undefined;
}

function validTarget(value: number): number {
  if (!Number.isInteger(value) || value < 2 || value > 999) {
    throw new PlanError('INVALID_TARGET', `The target must be an Angular major version such as 18 (got ${String(value)}).`);
  }
  return value;
}

interface Target {
  major: number;
  source: 'option' | 'latest';
  latest: string | null;
}

function resolveTarget(options: PlanOptions, core: OkResult | undefined, coreResult: PackageResult | undefined): Target {
  const latest = core?.record.distTags.latest ?? null;
  if (options.targetMajor !== undefined) return { major: validTarget(options.targetMajor), source: 'option', latest };
  if (latest === null) {
    const why = core ? 'the registry data has no "latest" tag' : unavailableReason(coreResult);
    throw new PlanError(
      'TARGET_UNKNOWN',
      `Could not find the latest Angular version (@angular/core: ${why}). Choose a target major explicitly.`,
    );
  }
  return { major: semver.major(latest), source: 'latest', latest };
}

function referenceVersions(results: Results): ReferenceVersions {
  const memo = new Map<string, Fact<string | null>>();
  return {
    get(name, major) {
      const key = `${name}@${major}`;
      let value = memo.get(key);
      if (!value) {
        // Framework packages share @angular/core's version numbers.
        const owner = isLockstepPackage(name) ? CORE : name;
        const result = results.get(owner);
        const record = ok(result);
        if (!record) {
          value = unverified(null, `no reference version for ${name}: ${unavailableReason(result)}`);
        } else {
          const version = newestInMajor(record.record, major);
          value =
            version === undefined
              ? unverified(null, `no stable ${owner} ${major}.x release in the registry data`)
              : fact(version, recordEvidence(record));
        }
        memo.set(key, value);
      }
      return value;
    },
  };
}

interface Candidate {
  dependency: ProjectDependency;
  record: OkResult;
  library: Library;
}

function classify(dependency: ProjectDependency, result: OkResult): Library | undefined {
  const { record } = result;
  let version = dependency.version;
  let peers = version !== null ? angularPeers(record.versions[version]) : [];
  if (peers.length === 0) {
    const versions = stableVersions(record);
    version = versions[0] ?? Object.keys(record.versions).sort(semver.rcompare)[0] ?? null;
    peers = version !== null ? angularPeers(record.versions[version]) : [];
  }
  if (version === null || peers.length === 0) return undefined;
  return {
    name: dependency.name,
    registryName: dependency.registryName,
    kind: dependency.kind,
    declaredRange: dependency.range,
    current: installedFact(dependency),
    registry: fact(record.fetchedAt, recordEvidence(result)),
    angularPeers: { version, peers },
  };
}

function nodeFact(nodeVersion: string | null | undefined): Fact<string | null> {
  if (nodeVersion === undefined || nodeVersion === null) return unverified(null, 'the Node.js version was not provided', 'option');
  const version = semver.valid(nodeVersion.trim().replace(/^v/, ''));
  if (version === null) return unverified(null, `"${nodeVersion}" is not a valid Node.js version`, 'option');
  return confirmed(version, 'option');
}

function collectUnverified(plan: Omit<UpgradePlan, 'unverified'>): UnverifiedItem[] {
  const items = new Map<string, UnverifiedItem>();
  const add = (hop: number | null, subject: string, reason: string | null): void => {
    const item = { hop, subject, reason: reason ?? 'could not be verified' };
    items.set(JSON.stringify(item), item);
  };
  const addFact = (hop: number | null, subject: string, value: Fact<unknown>): void => {
    if (value.confidence === 'unverified') add(hop, subject, value.note);
  };

  addFact(null, `installed ${CORE}`, plan.current.angular);
  if (plan.hops.length > 0) addFact(null, `target Angular ${plan.target.major}`, plan.target.angular);
  for (const pkg of plan.framework) addFact(null, `installed ${pkg.name}`, pkg.current);
  for (const library of plan.libraries) {
    addFact(null, `installed ${library.name}`, library.current);
    addFact(null, `registry data for ${library.name}`, library.registry);
  }
  for (const dependency of plan.unclassified) {
    add(null, dependency.name, `could not tell whether it depends on Angular: ${dependency.reason}`);
  }
  for (const hop of plan.hops) {
    addFact(hop.to, `Angular ${hop.to} release`, hop.angular);
    if (hop.stepCoverage === 'not-covered') add(hop.to, 'update steps', hop.stepsNote);
    for (const requirement of hop.requirements) {
      const subject = `${requirement.name} requirement (${requirement.requiredBy})`;
      if (requirement.status === 'unknown') {
        add(hop.to, subject, requirement.range.note ?? requirement.installed.note);
      } else {
        addFact(hop.to, subject, requirement.range);
        // met or unmet against a version guessed from a range is not confirmed either.
        if (requirement.installed.source !== 'none') {
          addFact(hop.to, `installed ${requirement.name} (${requirement.requiredBy})`, requirement.installed);
        }
      }
    }
    for (const library of hop.libraries) {
      if (library.status === 'unknown') add(hop.to, library.name, library.reason);
      else addFact(hop.to, library.name, library.newestCompatible);
      if (library.status !== 'unknown' && library.uncheckedNewer > 0) {
        const count = library.uncheckedNewer;
        add(
          hop.to,
          `newest compatible ${library.name}`,
          `${count} newer release${count === 1 ? '' : 's'} could not be checked, so a newer compatible release may exist`,
        );
      }
    }
  }

  return [...items.values()].sort(
    (a, b) =>
      (a.hop ?? -1) - (b.hop ?? -1) ||
      (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0) ||
      (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0),
  );
}

/**
 * Builds the plan for a project. Registry data comes from `source` (a RegistryClient, or
 * in-memory data in tests). Throws PlanError for an invalid or unreachable target.
 */
export async function buildPlan(
  project: ProjectInfo,
  source: PackageSource,
  options: PlanOptions = {},
  guide: UpdateGuideData = UPDATE_GUIDE,
): Promise<UpgradePlan> {
  const installed = semver.parse(project.angular.version);
  if (installed === null) {
    throw new PlanError('INVALID_CURRENT', `The installed @angular/core version "${project.angular.version}" is not a valid version.`);
  }
  if (options.targetMajor !== undefined) validTarget(options.targetMajor);

  const framework = project.dependencies.filter((dependency) => isFrameworkPackage(dependency.registryName));
  const others = project.dependencies.filter((dependency) => !isFrameworkPackage(dependency.registryName));
  const projectPackages = new Set(project.dependencies.map((dependency) => dependency.registryName));

  const results: Results = new Map();
  await lookupAll(source, [CORE, COMPILER_CLI, CLI, ...others.map((dependency) => dependency.registryName)], results);

  const coreResult = results.get(CORE);
  const core = ok(coreResult);
  const target = resolveTarget(options, core, coreResult);
  const currentMajor = installed.major;
  if (target.source === 'option' && target.major < currentMajor) {
    throw new PlanError(
      'TARGET_BELOW_CURRENT',
      `The target Angular ${target.major} is lower than the installed Angular ${currentMajor} (${installed.version}); downgrades are not planned.`,
    );
  }
  const released = core ? majorsWithStableRelease(core.record) : undefined;
  const newestReleased = released && released.size > 0 ? Math.max(...released) : undefined;
  if (newestReleased !== undefined && target.major > newestReleased && target.major > currentMajor) {
    throw new PlanError(
      'TARGET_NOT_RELEASED',
      `Angular ${target.major} has no stable release yet; the newest is Angular ${newestReleased}.`,
    );
  }

  // Classify direct dependencies; those without registry data cannot be classified.
  const candidates: Candidate[] = [];
  const unclassified: UnclassifiedDependency[] = [];
  for (const dependency of others) {
    const result = results.get(dependency.registryName);
    const record = ok(result);
    if (!record) {
      unclassified.push({ name: dependency.name, reason: unavailableReason(result) });
      continue;
    }
    const library = classify(dependency, record);
    if (library) candidates.push({ dependency, record, library });
  }

  // Reference data for @angular peers that do not share @angular/core's versions (cdk, material...).
  const peerNames = new Set<string>();
  for (const { record } of candidates) {
    for (const version of Object.values(record.record.versions)) {
      for (const name of Object.keys(version.peerDependencies ?? {})) {
        if (isAngularPackage(name) && !isLockstepPackage(name)) peerNames.add(name);
      }
    }
  }
  await lookupAll(source, [...peerNames].sort(), results);
  const refs = referenceVersions(results);

  const hopMajors: number[] = [];
  for (let major = currentMajor + 1; major <= target.major; major++) {
    // Angular 3 was never released; with registry data, any major without a stable release is skipped.
    if (released ? released.has(major) : major !== 3) hopMajors.push(major);
  }

  const features = { material: projectPackages.has('@angular/material'), ngUpgrade: projectPackages.has('@angular/upgrade') };
  const contexts: LibraryContext[] = candidates
    .map(({ library, record }) => ({
      name: library.name,
      record: record.record,
      evidence: recordEvidence(record),
      refs,
      projectPackages,
    }))
    .sort(byName);
  const fromVersions = new Map(candidates.map(({ library }) => [library.name, library.current]));
  const registryNames = new Map(candidates.map(({ library }) => [library.name, library.registryName]));
  const byRegistryName = new Map(project.dependencies.map((dependency) => [dependency.registryName, dependency]));
  const node = nodeFact(options.nodeVersion);

  const hops: Hop[] = [];
  let after = encodedVersion(currentMajor, installed.minor);
  let previous = currentMajor;
  for (const major of hopMajors) {
    const stepData = hopSteps(guide, after, major, features);
    const requirements = hopRequirements(major, {
      lookup: (name) => results.get(name),
      installed: (name) => (name === 'node' ? node : installedFact(byRegistryName.get(name))),
    });
    const libraries = alignRequiredVersions(
      contexts.map((context) => evaluateLibrary(context, major, fromVersions.get(context.name)!)),
      registryNames,
      major,
    );
    for (const result of libraries) fromVersions.set(result.name, nextFrom(result));
    const hop = {
      from: previous,
      to: major,
      angular: refs.get(CORE, major),
      commands: stepData.commands,
      commandNote: stepData.commandNote,
      steps: stepData.steps,
      stepCoverage: stepData.coverage,
      stepsNote: stepData.note,
      requirements,
      libraries,
    };
    hops.push({ ...hop, effort: hopEffort(hop) });
    after = major * 100 + 99;
    previous = major;
  }

  let message: string | null = null;
  if (hops.length === 0) {
    message =
      target.major < currentMajor
        ? `The installed Angular ${installed.version} is newer than the latest release${target.latest ? ` (${target.latest})` : ''}. There is nothing to plan.`
        : `The project is already on Angular ${currentMajor} (${installed.version}), the target version. There is nothing to plan.`;
  }

  const angularSource = project.angular.source;
  const plan: Omit<UpgradePlan, 'unverified'> = {
    schema: PLAN_SCHEMA,
    project: {
      name: project.name,
      packageManager: project.packageManager,
      lockfile: project.lockfile ? { file: project.lockfile.file, kind: project.lockfile.kind } : null,
      warnings: project.warnings.map((warning) => warning.message),
    },
    current: {
      angular:
        angularSource === 'lockfile'
          ? confirmed(installed.version, 'lockfile')
          : unverified(
              installed.version,
              `not resolved in a lockfile; lowest version allowed by "${project.angular.range}"`,
              'package-json-range',
            ),
      major: currentMajor,
    },
    target: {
      major: target.major,
      source: target.source,
      angular: refs.get(CORE, target.major),
    },
    message,
    hops,
    framework: framework.map((dependency): FrameworkPackage => ({ name: dependency.name, current: installedFact(dependency) })),
    libraries: candidates.map(({ library }) => library).sort(byName),
    unclassified: unclassified.sort(byName),
    effort: totalEffort(hops),
    updateGuide: {
      url: guide.source.url,
      commit: guide.source.commit,
      commitDate: guide.source.commitDate,
      license: guide.source.license,
      coversThroughMajor: guide.source.coversThroughMajor,
    },
  };
  return { ...plan, unverified: collectUnverified(plan) };
}
