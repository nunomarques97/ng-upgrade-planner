// The upgrade plan model. It is a plain, JSON-serializable object (no Maps, no undefined, no
// class instances) and every value records whether it was confirmed by evidence or not.
import type { DependencyKind } from '../project/types.js';
import type { PackageResult } from '../registry/types.js';

export const PLAN_SCHEMA = 1;

/**
 * confirmed: backed by the lockfile, current registry data (network or a cache entry within its
 * time to live), the bundled update guide snapshot or an explicit option.
 * unverified: a fallback or missing value; `note` says why.
 */
export type Confidence = 'confirmed' | 'unverified';

export type EvidenceSource =
  | 'lockfile'
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
   * Node.js version checked against the Node requirements of each hop, for example the version
   * running the CLI. null or absent: the Node requirement status is unknown.
   */
  nodeVersion?: string | null;
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

export type RequirementName = 'typescript' | 'rxjs' | 'zone.js' | 'node';

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
}

export type EffortLabel = 'S' | 'M' | 'L' | 'XL';

export interface Effort {
  points: number;
  label: EffortLabel;
  counts: EffortCounts;
  /** Points per contributor; they add up to `points`. */
  breakdown: { base: number; steps: number; majorBumps: number; requirements: number; blockers: number };
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
  libraries: LibraryHopResult[];
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
  updateGuide: { url: string; commit: string; commitDate: string; license: string; coversThroughMajor: number };
  /** Everything that could not be verified, in a stable order. */
  unverified: UnverifiedItem[];
}
