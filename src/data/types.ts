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

interface RemovedApiBase {
  /** Stable identifier, lowercase words joined by hyphens. */
  id: string;
  /** Import specifier the API belongs to: an @angular/* package or one of its entry points. */
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
export interface RemovedConfigEntry extends RemovedApiBase {
  kind: 'config';
  /** angular.json, or any tsconfig*.json file. */
  file: 'angular.json' | 'tsconfig';
  /** Property paths from the document root; '*' matches any single key. */
  paths: readonly (readonly string[])[];
}

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
