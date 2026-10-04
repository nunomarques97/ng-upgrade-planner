// Builds the upgrade plan: the hop path, per-hop steps, framework requirements, the library
// compatibility matrix and the effort estimate.
import semver from 'semver';
import { UPDATE_GUIDE } from '../data/update-steps.js';
import type { UpdateGuideData } from '../data/types.js';
import { describeCause } from '../project/errors.js';
import type { NodeEngine, ProjectDependency, ProjectInfo } from '../project/types.js';
import type { PackageResult } from '../registry/types.js';
import type { DeprecationScanFinding, RxjsScanFinding, ScanFinding } from '../scan/types.js';
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
import { hopRequirements, hopToolchain } from './requirements.js';
import { encodedVersion, hopSteps } from './steps.js';
import {
  PLAN_SCHEMA,
  type DeprecationFinding,
  type Fact,
  type FrameworkPackage,
  type Hop,
  type Library,
  type PackageSource,
  type PlanDeprecations,
  type PlanOptions,
  type PlanScan,
  type PlanRxjs,
  type PlanScanInput,
  type RemovedApiFinding,
  type Requirement,
  type RxjsFinding,
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

/** The local Node.js version: context only, it never decides a status. */
function localNodeFact(nodeVersion: string | null | undefined): Fact<string | null> {
  if (nodeVersion === undefined || nodeVersion === null) return unverified(null, 'the Node.js version was not provided', 'option');
  const version = semver.valid(nodeVersion.trim().replace(/^v/, ''));
  if (version === null) return unverified(null, `"${nodeVersion}" is not a valid Node.js version`, 'option');
  return confirmed(version, 'option');
}

/** The project's engines.node, which decides the Node.js status of each hop. */
function enginesFact(engine: NodeEngine): Fact<string | null> {
  if (engine.status === 'declared' && engine.range !== null) return confirmed(engine.range, 'package-json');
  if (engine.status === 'invalid') {
    const text = engine.range !== null ? ` ${JSON.stringify(engine.range)}` : '';
    return unverified(engine.range, `engines.node${text} in package.json is not a valid version range`, 'package-json');
  }
  return unverified(null, 'package.json has no engines.node');
}

function planFinding(finding: ScanFinding): RemovedApiFinding {
  return {
    file: finding.file,
    line: finding.line,
    column: finding.column,
    entryId: finding.entryId,
    package: finding.package,
    api: finding.api,
    change: finding.change,
    major: finding.major,
    replacement: finding.replacement,
    migration: finding.migration,
    confidence: finding.confidence,
    reason: finding.confidence === 'heuristic' ? (finding.reason ?? 'found by text matching') : null,
  };
}

function planDeprecation(finding: DeprecationScanFinding): DeprecationFinding {
  return {
    file: finding.file,
    line: finding.line,
    column: finding.column,
    entryId: finding.entryId,
    package: finding.package,
    api: finding.api,
    deprecatedIn: finding.deprecatedIn,
    removalMajor: finding.removalMajor,
    replacement: finding.replacement,
    confidence: finding.confidence,
    reason: finding.confidence === 'heuristic' ? (finding.reason ?? 'found by text matching') : null,
  };
}

function planRxjs(finding: RxjsScanFinding): RxjsFinding {
  return {
    file: finding.file,
    line: finding.line,
    column: finding.column,
    entryId: finding.entryId,
    package: finding.package,
    api: finding.api,
    change: finding.change,
    replacement: finding.replacement,
  };
}

interface Attached<T> {
  byHop: Map<number, T[]>;
  attached: number;
  notAttached: { atOrBelowCurrent: number; aboveTarget: number; noHop: number };
}

/** Puts each item in the hop whose target is `hopOf(item)`; items outside the plan are only counted. */
function attach<S, T>(
  items: readonly S[],
  hopOf: (item: S) => number,
  convert: (item: S) => T,
  currentMajor: number,
  hopMajors: readonly number[],
  targetMajor: number,
): Attached<T> {
  const byHop = new Map<number, T[]>(hopMajors.map((major) => [major, []]));
  const notAttached = { atOrBelowCurrent: 0, aboveTarget: 0, noHop: 0 };
  let attached = 0;
  for (const item of items) {
    const major = hopOf(item);
    const hop = byHop.get(major);
    if (major <= currentMajor) notAttached.atOrBelowCurrent++;
    else if (major > targetMajor) notAttached.aboveTarget++;
    else if (!hop) notAttached.noHop++;
    else {
      hop.push(convert(item));
      attached++;
    }
  }
  return { byHop, attached, notAttached };
}

/**
 * Attaches each scan finding to the hop where it must be fixed: the hop whose target major is the
 * major where the API is removed or breaks. A deprecation finding is a warning in the hop before
 * the announced removal: the hop whose target is the removal major minus 1. Findings for hops at or
 * below the installed major, above the target, or without a stable release are only counted.
 */
export function attachFindings(
  input: PlanScanInput | null | undefined,
  currentMajor: number,
  hopMajors: readonly number[],
  targetMajor: number,
): {
  byHop: Map<number, RemovedApiFinding[]>;
  deprecationsByHop: Map<number, DeprecationFinding[]>;
  scan: Omit<PlanScan, 'rxjs'>;
} {
  const removed = attach(input?.result.findings ?? [], (finding) => finding.major, planFinding, currentMajor, hopMajors, targetMajor);
  const deprecated = attach(
    input?.result.deprecations ?? [],
    (finding) => finding.removalMajor - 1,
    planDeprecation,
    currentMajor,
    hopMajors,
    targetMajor,
  );
  const deprecations: PlanDeprecations = {
    coverage: input?.deprecations
      ? { removalMajors: [...input.deprecations.removalMajors], retrieved: input.deprecations.retrieved }
      : null,
    findings: input?.result.deprecations.length ?? 0,
    attached: deprecated.attached,
    notAttached: deprecated.notAttached,
  };
  if (!input) {
    return {
      byHop: removed.byHop,
      deprecationsByHop: deprecated.byHop,
      scan: {
        status: 'off',
        coverage: null,
        filesScanned: 0,
        findings: 0,
        attached: 0,
        notAttached: removed.notAttached,
        unscanned: [],
        deprecations,
      },
    };
  }
  const { result, coverage } = input;
  const empty = result.filesScanned === 0 && result.unscanned.length === 0;
  return {
    byHop: removed.byHop,
    deprecationsByHop: deprecated.byHop,
    scan: {
      status: empty ? 'no-source-files' : 'ran',
      coverage: { firstMajor: coverage.firstMajor, lastMajor: coverage.lastMajor, retrieved: coverage.retrieved },
      filesScanned: result.filesScanned,
      findings: result.findings.length,
      attached: removed.attached,
      notAttached: removed.notAttached,
      unscanned: result.unscanned.map((item) => ({ file: item.file, reason: item.reason })),
      deprecations,
    },
  };
}

/** Every RxJS 6 release: a hop whose rxjs range does not meet it forces RxJS 7 or later. */
const RXJS_6 = '>=6.0.0-0 <7.0.0-0';

/**
 * Whether a hop's @angular/core rxjs peer range accepts no RxJS 6 release. false when the release
 * declares no rxjs peer; null when the range is unknown or cannot be parsed.
 */
export function forcesRxjs7(requirements: readonly Requirement[]): boolean | null {
  const requirement = requirements.find((item) => item.name === 'rxjs');
  if (!requirement) return false;
  const range = requirement.range.value;
  if (range === null || semver.validRange(range) === null) return null;
  return !semver.intersects(range, RXJS_6, { includePrerelease: true });
}

/**
 * How the RxJS findings relate to the plan. They count only when the installed rxjs is 6.x: as work
 * in `forcedBy`, the first hop that accepts no RxJS 6, or else as a single advisory.
 */
export function rxjsResult(
  input: PlanScanInput | null | undefined,
  installed: Fact<string | null>,
  forcedBy: number | null,
  unknownHops: readonly number[],
): { plan: PlanRxjs; required: RxjsFinding[] } {
  const found = input?.result.rxjs ?? [];
  const coverage = input?.rxjs ? { rxjsMajor: input.rxjs.rxjsMajor, retrieved: input.rxjs.retrieved } : null;
  const version = installed.value;
  const result = (status: PlanRxjs['status'], reason: string, forced: number | null = null, advisory: RxjsFinding[] = []): PlanRxjs => ({
    coverage,
    installed: version,
    status,
    forcedBy: forced,
    uncheckedHops: [...unknownHops],
    reason,
    findings: found.length,
    advisory,
  });
  if (!input || !coverage) {
    return { plan: result('off', 'the source was not scanned for RxJS 7 breaking changes'), required: [] };
  }
  const major = version === null ? null : (semver.coerce(version)?.major ?? null);
  if (major === null) {
    const why = installed.source === 'none' ? 'rxjs is not a direct dependency' : 'the installed rxjs version is not known';
    return { plan: result('not-applicable', `${why}, so RxJS 7 breaking changes are not shown`), required: [] };
  }
  if (major !== 6) {
    const why = major > 6 ? 'already RxJS 7 or later' : 'older than RxJS 6, outside the data';
    return { plan: result('not-applicable', `the installed rxjs ${version} is ${why}, so RxJS 7 breaking changes are not shown`), required: [] };
  }
  const findings = found.map(planRxjs);
  if (forcedBy !== null) {
    const reason = `the @angular/core rxjs peer range of Angular ${forcedBy} accepts no RxJS 6, so the installed rxjs ${version} must move to RxJS 7 or later in that hop`;
    return { plan: result('required', reason, forcedBy), required: findings };
  }
  const unknown =
    unknownHops.length > 0 ? `; the range of Angular ${unknownHops.join(', ')} could not be read, so that hop may still force it` : '';
  const reason = `no hop of this plan forces RxJS 7: the @angular/core rxjs peer range of every hop read still accepts RxJS 6${unknown}. Fix these when moving rxjs to 7`;
  return { plan: result('advisory', reason, null, findings), required: [] };
}

const SCAN_SUBJECT = 'removed-API scan';

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
  const { scan } = plan;
  if (plan.hops.length > 0 && scan.status === 'off') {
    add(null, SCAN_SUBJECT, 'the scan was turned off, so the source was not checked for removed or changed Angular APIs');
  }
  if (plan.hops.length > 0 && scan.status === 'no-source-files') {
    add(null, SCAN_SUBJECT, 'no TypeScript, template or configuration file was found in the project folder, so no source was checked');
  }
  if (plan.hops.length > 0) {
    for (const item of scan.unscanned) add(null, `source ${item.file}`, `not scanned: ${item.reason}`);
  }
  if (scan.rxjs.status === 'advisory' && scan.rxjs.uncheckedHops.length > 0) {
    add(
      null,
      'RxJS 7 requirement',
      `the @angular/core rxjs peer range of Angular ${scan.rxjs.uncheckedHops.join(', ')} could not be read, so the advisory RxJS findings may be required work`,
    );
  }
  for (const hop of plan.hops) {
    addFact(hop.to, `Angular ${hop.to} release`, hop.angular);
    for (const check of [hop.toolchain.node, hop.toolchain.typescript]) {
      const subject = `${check.name === 'node' ? 'Node.js' : 'TypeScript'} requirement`;
      if (check.status === 'unverified') add(hop.to, subject, check.reason);
      else addFact(hop.to, subject, check.range);
    }
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
    const coverage = scan.status === 'ran' ? scan.coverage : null;
    if (coverage && (hop.to < coverage.firstMajor || hop.to > coverage.lastMajor)) {
      add(
        hop.to,
        SCAN_SUBJECT,
        `the bundled removed-API data covers Angular ${coverage.firstMajor} to ${coverage.lastMajor} only, so changes in Angular ${hop.to} were not checked`,
      );
    }
    for (const finding of hop.removedApis) {
      if (finding.confidence === 'heuristic') {
        add(hop.to, `removed API ${finding.api} at ${finding.file}:${finding.line}`, finding.reason);
      }
    }
    for (const finding of hop.deprecations) {
      if (finding.confidence === 'heuristic') {
        add(hop.to, `deprecated API ${finding.api} at ${finding.file}:${finding.line}`, finding.reason);
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
  const localNode = localNodeFact(options.nodeVersion);
  const engines = enginesFact(project.nodeEngine);
  const typescript = installedFact(byRegistryName.get('typescript'));
  const findings = attachFindings(options.scan, currentMajor, hopMajors, target.major);
  const rxjsInstalled = installedFact(byRegistryName.get('rxjs'));
  let rxjsForcedBy: number | null = null;
  const rxjsUnknownHops: number[] = [];

  const hops: Hop[] = [];
  let after = encodedVersion(currentMajor, installed.minor);
  let previous = currentMajor;
  for (const major of hopMajors) {
    const stepData = hopSteps(guide, after, major, features);
    const requirements = hopRequirements(major, {
      lookup: (name) => results.get(name),
      installed: (name) => installedFact(byRegistryName.get(name)),
    });
    const toolchain = hopToolchain(major, { lookup: (name) => results.get(name), engines, typescript });
    const libraries = alignRequiredVersions(
      contexts.map((context) => evaluateLibrary(context, major, fromVersions.get(context.name)!)),
      registryNames,
      major,
    );
    for (const result of libraries) fromVersions.set(result.name, nextFrom(result));
    const forces = forcesRxjs7(requirements);
    if (forces === null) rxjsUnknownHops.push(major);
    const forcedHere = rxjsForcedBy === null && forces === true;
    if (forcedHere) rxjsForcedBy = major;
    const rxjs = rxjsResult(options.scan, rxjsInstalled, forcedHere ? major : null, []);
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
      toolchain,
      libraries,
      removedApis: findings.byHop.get(major) ?? [],
      deprecations: findings.deprecationsByHop.get(major) ?? [],
      rxjs: forcedHere ? rxjs.required : [],
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
    toolchain: { engines, enginesStatus: project.nodeEngine.status, localNode },
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
    scan: { ...findings.scan, rxjs: rxjsResult(options.scan, rxjsInstalled, rxjsForcedBy, rxjsUnknownHops).plan },
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
