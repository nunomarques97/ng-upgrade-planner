// The upgrade plan model. It is a plain, JSON-serializable object (no Maps, no undefined, no
// class instances) and every value records whether it was confirmed by evidence or not.
import type { RemovedApiChange, RemovedApiMigration } from '../data/types.js';
import type { DependencyKind } from '../project/types.js';
import type { PackageResult } from '../registry/types.js';
import type { ScanConfidence, ScanResult, UnscannedFile } from '../scan/types.js';

export const PLAN_SCHEMA = 3;

/**
 * confirmed: backed by the lockfile, current registry data (network or a cache entry within its
 * time to live), the bundled update guide snapshot or an explicit option.
 * unverified: a fallback or missing value; `note` says why.
 */
export type Confidence = 'confirmed' | 'unverified';

export type EvidenceSource =
  | 'lockfile'
  | 'package-json'
  | 'package-json-range'
  | 'registry'
  | 'registry-cache'
  | 'stale-cache'
  | 'update-guide'
  | 'option'
  | 'none';

export interface Fact<T> {
  value: T;
  confidence: Confidence;
  source: EvidenceSource;
  /** Why the value is unverified, or a short qualifier; null when there is nothing to add. */
  note: string | null;
}

/** Anything that can look up a package record; RegistryClient implements it. */
export interface PackageSource {
  getPackage(name: string): Promise<PackageResult>;
}

export interface PlanOptions {
  /** Target Angular major. Default: the major of @angular/core dist-tags.latest. */
  targetMajor?: number;
  /**
   * Local Node.js version, for example the one running the CLI. It is shown as context only: the
   * Node.js status of each hop comes from the project's engines.node. null or absent: not known.
   */
  nodeVersion?: string | null;
  /** Result of the removed-API scan of the project's source. Absent or null: the scan was turned off. */
  scan?: PlanScanInput | null;
}

/** Range of Angular majors the removed-API data describes. */
export interface ScanCoverage {
  firstMajor: number;
  lastMajor: number;
  /** Date the data's official sources were read (YYYY-MM-DD). */
  retrieved: string;
}

/** What the bundled deprecated-API data covers. */
export interface DeprecationCoverage {
  /** Removal majors the entries announce, ascending. */
  removalMajors: number[];
  /** Date the data's official sources were read (YYYY-MM-DD). */
  retrieved: string;
}

/** What the bundled RxJS data covers. */
export interface RxjsCoverage {
  /** RxJS major whose breaking changes the entries describe. */
  rxjsMajor: number;
  /** Date the data's official sources were read (YYYY-MM-DD). */
  retrieved: string;
}

export interface PlanScanInput {
  result: ScanResult;
  coverage: ScanCoverage;
  /** The deprecated-API data the scan also matched; absent or null when it matched none. */
  deprecations?: DeprecationCoverage | null;
  /** The RxJS data the scan also matched; absent or null when it matched none. */
  rxjs?: RxjsCoverage | null;
}

export type StepLevel = 'basic' | 'medium' | 'advanced';

/** Which apps a step applies to, from the update guide options. */
export type StepAudience = 'all' | 'material' | 'ngUpgrade' | 'windows' | 'not-windows';

export interface PlanStep {
  title: string;
  /** Markdown text from the update guide, unescaped. */
  action: string;
  level: StepLevel;
  /** Version from which the step is required, for example "15.0". */
  necessaryAsOf: string;
  /** Version from which the step can be done, for example "14.0". */
  possibleIn: string;
  appliesTo: StepAudience;
}

export type StepCoverage = 'recorded' | 'none-recorded' | 'not-covered';

/** Peer requirements of @angular/core; Node.js and TypeScript are in the hop's toolchain. */
export type RequirementName = 'rxjs' | 'zone.js';

export type RequirementStatus = 'met' | 'unmet' | 'not-installed' | 'unknown';

export interface Requirement {
  name: RequirementName;
  /** Package and field the range comes from, for example "@angular/core@15.2.10 peerDependencies". */
  requiredBy: string;
  range: Fact<string | null>;
  installed: Fact<string | null>;
  /** The peer dependency is marked optional, so a missing install is not a problem. */
  optional: boolean;
  status: RequirementStatus;
  /** true when the requirement needs action in this hop (unmet, or a required package is missing). */
  flagged: boolean;
}

export type ToolchainName = 'node' | 'typescript';

/**
 * ok: the project is inside the hop's range. blocker: the project's engines.node allows no Node.js
 * version in the range, or the lockfile's TypeScript is outside it. warning: engines.node allows
 * some versions inside the range and some outside (Node.js only). unverified: the project value or
 * the range is missing, invalid or guessed, so nothing is decided.
 */
export type ToolchainStatus = 'ok' | 'warning' | 'blocker' | 'unverified';

export interface ToolchainCheck {
  name: ToolchainName;
  /**
   * Range the hop needs. For Node.js the engines ranges of @angular/core and @angular/cli together
   * (a version must satisfy both); for TypeScript the @angular/compiler-cli peer range.
   */
  range: Fact<string | null>;
  /** Package, release and field each range comes from, for example "@angular/core@17.3.12 engines". */
  requiredBy: string[];
  /** The project's side: engines.node from package.json, or the installed typescript version. */
  project: Fact<string | null>;
  status: ToolchainStatus;
  /** Why the check has this status, in one sentence. */
  reason: string;
}

/** Node.js and TypeScript requirements of a hop, checked against the project. */
export interface HopToolchain {
  node: ToolchainCheck;
  typescript: ToolchainCheck;
}

export interface PeerCheck {
  name: string;
  /** Peer range text exactly as published. */
  range: string;
  /** The newest stable release of `name` for the hop that the range was checked against. */
  checkedAgainst: string | null;
  /** null when the range was not checked (no reference version, or an optional peer that is not used). */
  satisfied: boolean | null;
  optional: boolean;
}

export type LibraryStatus = 'compatible' | 'blocker' | 'unknown';

export type VersionChange = 'none' | 'patch' | 'minor' | 'major' | 'downgrade' | 'unknown';

export interface LibraryHopResult {
  name: string;
  status: LibraryStatus;
  /** Version expected going into this hop: the installed one or the one chosen by an earlier hop. */
  from: Fact<string | null>;
  /** Newest stable release whose @angular peers accept this hop, preferring non-deprecated ones. */
  newestCompatible: Fact<string | null>;
  /** false: the `from` version already accepts this hop (no change needed); null: could not tell. */
  changeNeeded: boolean | null;
  /** Change from `from` to `newestCompatible` when a change is needed; null when none is needed or no version was found. */
  change: VersionChange | null;
  /** Version whose peer ranges decided the status, and those ranges. */
  evidenceVersion: string | null;
  peers: PeerCheck[];
  /** `from` version's peer ranges when they show that no change is needed. */
  fromPeers: PeerCheck[];
  /** Deprecation message when only deprecated releases accept this hop. */
  deprecated: string | null;
  /** Newer stable releases that could not be checked (no @angular peer or no reference version). */
  uncheckedNewer: number;
  reason: string;
  confidence: Confidence;
}

export interface EffortCounts {
  steps: Record<StepLevel, number>;
  majorBumps: number;
  unmetRequirements: number;
  blockers: number;
  /** Toolchain results that add effort: Node.js blockers and warnings, TypeScript blockers. */
  toolchain: { nodeBlockers: number; nodeWarnings: number; typescriptBlockers: number };
  /**
   * Distinct removed or changed APIs found in the source, by whether ng update fixes them. RxJS 7
   * breaking changes required in the hop count as manual.
   */
  removedApis: { migrated: number; manual: number };
}

export type EffortLabel = 'S' | 'M' | 'L' | 'XL';

export interface Effort {
  points: number;
  label: EffortLabel;
  counts: EffortCounts;
  /** Points per contributor; they add up to `points`. */
  breakdown: {
    base: number;
    steps: number;
    majorBumps: number;
    requirements: number;
    blockers: number;
    toolchain: number;
    removedApis: number;
  };
}

/** A use of an API that is removed or changed in a hop's major, found in the project's source. */
export interface RemovedApiFinding {
  /** Path relative to the project folder, with forward slashes. */
  file: string;
  line: number;
  column: number;
  /** Id of the removed-API data entry that matched. */
  entryId: string;
  package: string;
  /** The symbol, template pattern or config property. */
  api: string;
  change: RemovedApiChange;
  major: number;
  replacement: string;
  /** Whether the official ng update migration of that major fixes it automatically. */
  migration: RemovedApiMigration;
  /** confirmed: found by an import or a parsed configuration property; heuristic: found by text matching. */
  confidence: ScanConfidence;
  /** Why a heuristic finding may be wrong; null for confirmed findings. */
  reason: string | null;
}

/**
 * A use of an API deprecated with an announced removal, shown as a warning in the hop to the major
 * before the removal. It never blocks and adds no effort points.
 */
export interface DeprecationFinding {
  /** Path relative to the project folder, with forward slashes. */
  file: string;
  line: number;
  column: number;
  /** Id of the deprecated-API data entry that matched. */
  entryId: string;
  package: string;
  /** The symbol or template pattern. */
  api: string;
  /** Angular major that deprecated the API. */
  deprecatedIn: number;
  /** Angular major the official source announces for the removal. */
  removalMajor: number;
  replacement: string;
  /** confirmed: found by an import of the matching package; heuristic: found by text matching. */
  confidence: ScanConfidence;
  /** Why a heuristic finding may be wrong; null for confirmed findings. */
  reason: string | null;
}

/** Deprecation findings of the scan and how they relate to the plan. */
export interface PlanDeprecations {
  /** Data coverage; null when the scan was off or matched no deprecated-API data. */
  coverage: DeprecationCoverage | null;
  /** Every deprecation finding, attached to a hop or not. */
  findings: number;
  /** Findings attached to a hop of this plan (the hop to the removal major minus 1). */
  attached: number;
  /** Findings that are not part of this plan, by why. */
  notAttached: {
    /** The hop before the removal is at or below the installed major. */
    atOrBelowCurrent: number;
    /** The hop before the removal is above the target. */
    aboveTarget: number;
    /** The hop before the removal is in range but has no stable release. */
    noHop: number;
  };
}

/** A use of rxjs or one of its entry points that breaks in RxJS 7, found by an import. */
export interface RxjsFinding {
  /** Path relative to the project folder, with forward slashes. */
  file: string;
  line: number;
  column: number;
  /** Id of the RxJS data entry that matched. */
  entryId: string;
  package: string;
  /** The symbol or call. */
  api: string;
  change: RemovedApiChange;
  replacement: string;
}

/**
 * required: the installed rxjs is 6.x and a hop's @angular/core peer range accepts no RxJS 6, so the
 * findings are work in that hop. advisory: the installed rxjs is 6.x and no hop of the plan forces
 * RxJS 7, so the findings are shown once, without effort points. not-applicable: rxjs is 7 or later,
 * not a dependency, or of unknown version, so the findings are only counted. off: the scan was off or
 * matched no RxJS data.
 */
export type RxjsStatus = 'required' | 'advisory' | 'not-applicable' | 'off';

/** RxJS 7 breaking changes found by the scan and how they relate to the plan. */
export interface PlanRxjs {
  /** Data coverage; null when the scan was off or matched no RxJS data. */
  coverage: RxjsCoverage | null;
  /** Installed rxjs version, as in the hop requirements; null when it is not a dependency or unknown. */
  installed: string | null;
  status: RxjsStatus;
  /** Target major of the first hop whose @angular/core rxjs peer range accepts no RxJS 6; null when none. */
  forcedBy: number | null;
  /** Target majors of the hops whose @angular/core rxjs peer range could not be read. */
  uncheckedHops: number[];
  /** Why the findings are required, advisory or not shown. */
  reason: string;
  /** Every RxJS finding, shown or not. */
  findings: number;
  /** The findings, shown once, when the status is advisory; empty otherwise (required ones are in the hop). */
  advisory: RxjsFinding[];
}

/**
 * ran: the source was scanned. off: the scan was turned off. no-source-files: the project folder
 * has no TypeScript, template or configuration file to scan.
 */
export type ScanStatus = 'ran' | 'off' | 'no-source-files';

export interface PlanScan {
  status: ScanStatus;
  /** Data coverage; null when the scan was turned off. */
  coverage: ScanCoverage | null;
  filesScanned: number;
  /** Every finding of the scan, attached to a hop or not. */
  findings: number;
  /** Findings attached to a hop of this plan. */
  attached: number;
  /** Findings that are not part of this plan, by why. */
  notAttached: {
    /** The API changed in a major at or below the installed one. */
    atOrBelowCurrent: number;
    /** The API changes in a major above the target. */
    aboveTarget: number;
    /** The major is in range but has no hop (no stable release). */
    noHop: number;
  };
  /** Files or folders that were found but could not be scanned. */
  unscanned: UnscannedFile[];
  /** Uses of deprecated APIs; counted apart from the removed-API findings above. */
  deprecations: PlanDeprecations;
  /** Uses of RxJS APIs that break in RxJS 7; counted apart from the findings above. */
  rxjs: PlanRxjs;
}

export interface Hop {
  from: number;
  to: number;
  /** Newest stable @angular/core release of the target major. */
  angular: Fact<string | null>;
  commands: string[];
  commandNote: string | null;
  steps: PlanStep[];
  stepCoverage: StepCoverage;
  /** Explains an empty or missing step list; null when steps are recorded. */
  stepsNote: string | null;
  requirements: Requirement[];
  /** Node.js and TypeScript ranges of the hop and how the project compares. */
  toolchain: HopToolchain;
  libraries: LibraryHopResult[];
  /** Uses of APIs removed or changed in this hop's major, sorted by file and position. */
  removedApis: RemovedApiFinding[];
  /**
   * Warnings: uses of APIs whose removal is announced for the next major, sorted by file and
   * position. Not blockers and not part of the effort.
   */
  deprecations: DeprecationFinding[];
  /**
   * Uses of RxJS APIs that break in RxJS 7, in the first hop whose @angular/core rxjs peer range
   * accepts no RxJS 6; empty in every other hop. Required work, part of the effort.
   */
  rxjs: RxjsFinding[];
  effort: Effort;
}

export interface PeerRange {
  name: string;
  range: string;
}

export interface Library {
  name: string;
  /** Registry name; differs from `name` for npm: aliases. */
  registryName: string;
  kind: DependencyKind;
  declaredRange: string;
  current: Fact<string | null>;
  /** Registry record age: the fetch time of the data used. */
  registry: Fact<string>;
  /** Why it counts as Angular-dependent: a version and its @angular peer ranges. */
  angularPeers: { version: string; peers: PeerRange[] };
}

export interface FrameworkPackage {
  name: string;
  current: Fact<string | null>;
}

export interface UnclassifiedDependency {
  name: string;
  reason: string;
}

export interface UnverifiedItem {
  /** Hop target major, or null for the whole plan. */
  hop: number | null;
  subject: string;
  reason: string;
}

export interface UpgradePlan {
  schema: typeof PLAN_SCHEMA;
  project: {
    name: string | null;
    packageManager: string | null;
    lockfile: { file: string; kind: string } | null;
    warnings: string[];
  };
  current: { angular: Fact<string>; major: number };
  /**
   * The project's engines.node (which decides the Node.js status of each hop) and the local Node.js
   * version, which is context only.
   */
  toolchain: { engines: Fact<string | null>; enginesStatus: 'declared' | 'missing' | 'invalid'; localNode: Fact<string | null> };
  target: { major: number; source: 'option' | 'latest'; angular: Fact<string | null> };
  /** Set when there is nothing to plan, for example when the project is already on the target. */
  message: string | null;
  hops: Hop[];
  /** Framework packages updated by ng update; they are not part of the library matrix. */
  framework: FrameworkPackage[];
  libraries: Library[];
  /** Direct dependencies whose registry data was missing, so they could not be classified. */
  unclassified: UnclassifiedDependency[];
  effort: Effort;
  /** The removed-API scan of the project's source. */
  scan: PlanScan;
  updateGuide: { url: string; commit: string; commitDate: string; license: string; coversThroughMajor: number };
  /** Everything that could not be verified, in a stable order. */
  unverified: UnverifiedItem[];
}
