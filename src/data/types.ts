// Shape of the vendored Angular update guide snapshot (src/data/update-steps.ts).

/** Application complexity as used by the update guide: 1 basic, 2 medium, 3 advanced. */
export type UpdateGuideLevel = 1 | 2 | 3;

/**
 * One recommendation, with the field names of the upstream data. Versions are encoded as
 * major * 100 + minor * 10, so 1500 is 15.0 and 1020 is 10.2.
 */
export interface UpdateGuideStep {
  step: string;
  /** Markdown text; may contain inline HTML such as <br/>. Untrusted when rendered. */
  action: string;
  possibleIn: number;
  necessaryAsOf: number;
  level: UpdateGuideLevel;
  /** true: only for apps that use Angular Material. */
  material?: boolean;
  /** true: only for apps that combine AngularJS and Angular with ngUpgrade. */
  ngUpgrade?: boolean;
  /** true: only on Windows; false: only on other systems. */
  windows?: boolean;
}

export interface UpdateGuideSource {
  /** Upstream file the steps were taken from. */
  url: string;
  repository: string;
  path: string;
  commit: string;
  /** Date of that commit (YYYY-MM-DD). */
  commitDate: string;
  /** Date the snapshot was taken (YYYY-MM-DD). */
  retrieved: string;
  license: string;
  licenseUrl: string;
  copyright: string;
  /** Newest Angular major the upstream data describes at snapshot time. */
  coversThroughMajor: number;
}

export interface UpdateGuideData {
  source: UpdateGuideSource;
  steps: readonly UpdateGuideStep[];
}

// Shape of the bundled dataset of Angular APIs removed or changed per major (src/data/removed-apis.ts).

/** removed: the API no longer exists. breaking: it still exists but old usage stops compiling or working. */
export type RemovedApiChange = 'removed' | 'breaking';

/** Whether the official `ng update` migration of that major fixes the usage automatically. */
export type RemovedApiMigration = 'yes' | 'no' | 'unknown';

/** An official Angular document. Always https on an official Angular host. */
export interface RemovedApiSource {
  url: string;
  title: string;
}

/**
 * Outcome of re-reading an entry against its source (and migrationSource where present).
 * confirmed: the sources state what the entry says. corrected: the entry was changed where a source
 * contradicted it. removed: the entry was moved to REMOVED_API_EXCLUDED. unverified: a source could not
 * be retrieved, so the entry is kept as it was without confirmation. added: the entry was written from
 * its source after the audit, or by the audit in place of a removed entry, and was not re-read separately.
 */
export type RemovedApiAuditStatus = 'confirmed' | 'corrected' | 'removed' | 'unverified' | 'added';

/** The audit record of one entry or of an exclusion created by the audit. */
export interface RemovedApiAudit {
  status: RemovedApiAuditStatus;
  /** Date the sources were re-read (YYYY-MM-DD). */
  read: string;
  /**
   * Required unless confirmed: the change made (corrected), the reason (removed), why the source could
   * not be read (unverified) or why the entry was written (added). Optional context for confirmed.
   */
  note?: string;
}

interface RemovedApiBase {
  /** Stable identifier, lowercase words joined by hyphens. */
  id: string;
  /**
   * Import specifier the API belongs to: an @angular/* package or one of its entry points. Builder
   * entries name the builder package instead (@angular-devkit/build-angular, @angular/build or
   * @angular-devkit/build-ng-packagr).
   */
  package: string;
  /** Short human-readable name of the API, as shown in reports. */
  label: string;
  change: RemovedApiChange;
  /** Angular major where the API is removed or breaks; it must be fixed in the hop to this major. */
  major: number;
  /** What changes, in one sentence. */
  summary: string;
  /** What to use instead, or exactly 'none' together with noReplacementReason. */
  replacement: string;
  noReplacementReason?: string;
  migration: RemovedApiMigration;
  /** The migration list that backs a 'yes' or 'no' value. */
  migrationSource?: RemovedApiSource;
  /** Extra context, for example an earlier major's migration that already fixes the usage. */
  migrationNote?: string;
  /** The official document that states the removal or breaking change. */
  source: RemovedApiSource;
  /** Further official documents that confirm details such as the entry point or the exact name. */
  references?: readonly RemovedApiSource[];
  /** Result of the data audit (see docs/verification/data-audit.md). Every entry carries one. */
  audit: RemovedApiAudit;
}

/** A TypeScript usage that counts only when the symbol is imported from `package`. */
export interface RemovedSymbolEntry extends RemovedApiBase {
  kind: 'symbol';
  /** Exported name, or '*' for any import of the entry point. */
  symbol: string;
  /** Static member read on the symbol, for example `Native` in `ViewEncapsulation.Native`. */
  member?: string;
  /**
   * Property key of an object literal passed to the symbol (a decorator such as `@Component`) or,
   * with `member`, to a call of that member (such as `RouterModule.forRoot`).
   */
  key?: string;
  /** true: only a type reference written without type arguments counts. */
  withoutTypeArguments?: true;
}

/** A pattern in component templates (external .html files and inline templates). */
export interface RemovedTemplateEntry extends RemovedApiBase {
  kind: 'template';
  /** JavaScript regular expression source, matched case-sensitively against template text. */
  pattern: string;
}

/** A JSON property in a workspace or TypeScript configuration file. */
export interface RemovedConfigPathEntry extends RemovedApiBase {
  kind: 'config';
  /** angular.json, or any tsconfig*.json file. */
  file: 'angular.json' | 'tsconfig';
  /** Property paths from the document root; '*' matches any single key. */
  paths: readonly (readonly string[])[];
  builders?: never;
  option?: never;
}

/**
 * An option of an angular.json target, counted only when the target's "builder" is one of
 * `builders`. It matches in the target's "options" and in every entry of its "configurations".
 */
export interface RemovedBuilderOptionEntry extends RemovedApiBase {
  kind: 'config';
  file: 'angular.json';
  /** Full builder names, for example @angular-devkit/build-angular:dev-server. */
  builders: readonly string[];
  /** Option key, for example browserTarget. */
  option: string;
  paths?: never;
}

/** A removed builder: any angular.json target whose "builder" is one of `builders`. */
export interface RemovedBuilderEntry extends RemovedApiBase {
  kind: 'config';
  file: 'angular.json';
  /** Full builder names, for example @angular-devkit/build-angular:tslint. */
  builders: readonly string[];
  paths?: never;
  option?: never;
}

/** A configuration entry: a property path, a builder option or a builder name. */
export type RemovedConfigEntry = RemovedConfigPathEntry | RemovedBuilderOptionEntry | RemovedBuilderEntry;

export type RemovedApiEntry = RemovedSymbolEntry | RemovedTemplateEntry | RemovedConfigEntry;

/** Machine-readable record that a major has no entry that qualifies for the scan. */
export interface RemovedApiEmptyMajor {
  major: number;
  reason: string;
  source: RemovedApiSource;
}

export type RemovedApiExclusionReason =
  | 'no-official-source'
  | 'internal-api'
  | 'not-detectable'
  | 'outside-scope';

/** A candidate that was considered and left out of the dataset, with the reason. */
export interface RemovedApiExclusion {
  major: number;
  package: string;
  candidate: string;
  category: RemovedApiExclusionReason;
  reason: string;
  source?: RemovedApiSource;
  /** Present when the data audit removed the candidate from the entries (status 'removed'). */
  audit?: RemovedApiAudit;
}

export interface RemovedApiData {
  /** Date the sources were read (YYYY-MM-DD). */
  retrieved: string;
  /** Inclusive range of Angular majors the dataset covers. */
  firstMajor: number;
  lastMajor: number;
  entries: readonly RemovedApiEntry[];
  emptyMajors: readonly RemovedApiEmptyMajor[];
}

// Shape of the bundled dataset of Angular APIs deprecated with an announced removal major
// (src/data/deprecated-apis.ts). Entries match like removed-API entries but only warn.

interface DeprecatedApiBase {
  /** Stable identifier, lowercase words joined by hyphens. */
  id: string;
  /** Import specifier the API belongs to: an @angular/* package or one of its entry points. */
  package: string;
  /** Short human-readable name of the API, as shown in reports. */
  label: string;
  /** Angular major that deprecated the API. */
  deprecatedIn: number;
  /** Angular major the source announces for the removal; always greater than deprecatedIn. */
  removalMajor: number;
  /** What is deprecated, in one sentence. */
  summary: string;
  /** What to use instead, or exactly 'none' together with noReplacementReason. */
  replacement: string;
  noReplacementReason?: string;
  /** The official document that states the deprecation and the removal major. */
  source: RemovedApiSource;
  /** Further official documents, for example the deprecation of the same API on other symbols. */
  references?: readonly RemovedApiSource[];
  /** How the entry was written; every entry carries one. */
  audit: RemovedApiAudit;
}

/** A deprecated TypeScript usage; it counts only when the symbol is imported from `package`. */
export interface DeprecatedSymbolEntry extends DeprecatedApiBase {
  kind: 'symbol';
  /** Exported name, or '*' for any import of the entry point. */
  symbol: string;
  member?: string;
  /** Property key of an object literal passed to the symbol, such as `animations` in `@Component`. */
  key?: string;
  withoutTypeArguments?: true;
}

/** A deprecated pattern in component templates (always a heuristic match). */
export interface DeprecatedTemplateEntry extends DeprecatedApiBase {
  kind: 'template';
  /** JavaScript regular expression source, matched case-sensitively against template text. */
  pattern: string;
}

export type DeprecatedApiEntry = DeprecatedSymbolEntry | DeprecatedTemplateEntry;

/**
 * no-removal-major: the sources announce no removal major. removal-passed: the announced major is
 * released and the API was still there. not-detectable: a source scan cannot find the usage.
 * internal-api: not part of the public API.
 */
export type DeprecatedApiExclusionReason = 'no-removal-major' | 'removal-passed' | 'not-detectable' | 'internal-api';

/** A deprecated API that was considered and left out of the dataset, with the reason. */
export interface DeprecatedApiExclusion {
  package: string;
  candidate: string;
  /** Angular major that deprecated it, when a source states it. */
  deprecatedIn: number | null;
  category: DeprecatedApiExclusionReason;
  reason: string;
  source: RemovedApiSource;
}

export interface DeprecatedApiData {
  /** Date the sources were read (YYYY-MM-DD). */
  retrieved: string;
  entries: readonly DeprecatedApiEntry[];
}

/** Any entry the source scan matches: a removed or changed API, a deprecated one, or an RxJS 7 breaking change. */
export type ScanDataEntry = RemovedApiEntry | DeprecatedApiEntry | RxjsApiEntry;

// Shape of the bundled dataset of RxJS 7 breaking changes (src/data/rxjs-apis.ts). Entries match
// like removed-API symbol entries; the plan ties them to the hop that forces RxJS 7.

/** An official RxJS document: a file of the ReactiveX/rxjs repository at a pinned commit, or rxjs.dev. */
export interface RxjsApiSource {
  url: string;
  title: string;
}

/** A TypeScript usage of rxjs or one of its entry points that breaks in RxJS 7. */
export interface RxjsSymbolEntry {
  kind: 'symbol';
  /** Stable identifier: rx7- and lowercase words joined by hyphens. */
  id: string;
  /** Import specifier: rxjs or one of its entry points, such as rxjs/operators. */
  package: string;
  /** Exported name, or '*' for any import of the entry point. */
  symbol: string;
  /** Static member read on the symbol, for example `sortActions` in `VirtualTimeScheduler.sortActions`. */
  member?: string;
  /** Only a call of the symbol with fewer arguments than this counts (a call with a spread argument never does). */
  minArguments?: number;
  /** Short human-readable name of the API, as shown in reports. */
  label: string;
  change: RemovedApiChange;
  /** RxJS major where the usage breaks. */
  rxjsMajor: 7;
  /** What changes, in one sentence. */
  summary: string;
  /** What to use instead, or exactly 'none' together with noReplacementReason. */
  replacement: string;
  noReplacementReason?: string;
  /** The official document that states the breaking change. */
  source: RxjsApiSource;
  /** Further official documents, for example the CHANGELOG entry of the same change. */
  references?: readonly RxjsApiSource[];
  /** How the entry was written; every entry carries one. */
  audit: RemovedApiAudit;
}

export type RxjsApiEntry = RxjsSymbolEntry;

/**
 * not-detectable: the usage cannot be told apart by imports and syntax (an instance method, a
 * type-dependent or runtime-only change). outside-scope: a toolchain or dependency requirement, not a
 * source usage. no-official-source: visible in the published package but not stated in the official
 * documents. already-broken: RxJS 6 typings already reject the usage, so a TypeScript project cannot have it.
 */
export type RxjsApiExclusionReason = 'not-detectable' | 'outside-scope' | 'no-official-source' | 'already-broken';

/** An RxJS 7 breaking change that was considered and left out of the dataset, with the reason. */
export interface RxjsApiExclusion {
  package: string;
  candidate: string;
  category: RxjsApiExclusionReason;
  reason: string;
  source: RxjsApiSource;
}

export interface RxjsApiData {
  /** Date the sources were read (YYYY-MM-DD). */
  retrieved: string;
  /** RxJS major the entries describe breaking changes of. */
  rxjsMajor: 7;
  entries: readonly RxjsApiEntry[];
}
