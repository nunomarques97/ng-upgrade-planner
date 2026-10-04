// Results of the removed-API, deprecated-API and RxJS scan of a project's own source.
import type { DeprecatedApiData, RemovedApiChange, RemovedApiMigration, RxjsApiData } from '../data/types.js';

/**
 * confirmed: found by structure (an import from the matching package, or a parsed JSON property).
 * heuristic: found by text matching, so it may be a false positive.
 */
export type ScanConfidence = 'confirmed' | 'heuristic';

export interface ScanFinding {
  /** Path relative to the project folder, with forward slashes. */
  file: string;
  /** 1-based line and column of the usage. */
  line: number;
  column: number;
  /** Id of the dataset entry that matched. */
  entryId: string;
  package: string;
  /** The symbol, template pattern or config property, as labelled in the dataset. */
  api: string;
  change: RemovedApiChange;
  /** Angular major where the API is removed or breaks. */
  major: number;
  replacement: string;
  /** Whether the official `ng update` migration of that major fixes it automatically. */
  migration: RemovedApiMigration;
  confidence: ScanConfidence;
  /** Why the finding is heuristic; present only when confidence is 'heuristic'. */
  reason?: string;
}

/** A use of an API deprecated with an announced removal major. */
export interface DeprecationScanFinding {
  /** Path relative to the project folder, with forward slashes. */
  file: string;
  /** 1-based line and column of the usage. */
  line: number;
  column: number;
  /** Id of the deprecated-API entry that matched. */
  entryId: string;
  package: string;
  /** The symbol or template pattern, as labelled in the dataset. */
  api: string;
  /** Angular major that deprecated the API. */
  deprecatedIn: number;
  /** Angular major the official source announces for the removal. */
  removalMajor: number;
  replacement: string;
  confidence: ScanConfidence;
  /** Why the finding is heuristic; present only when confidence is 'heuristic'. */
  reason?: string;
}

/** A use of rxjs or one of its entry points that breaks in RxJS 7. Always found by an import. */
export interface RxjsScanFinding {
  /** Path relative to the project folder, with forward slashes. */
  file: string;
  /** 1-based line and column of the usage. */
  line: number;
  column: number;
  /** Id of the RxJS data entry that matched. */
  entryId: string;
  package: string;
  /** The symbol or call, as labelled in the dataset. */
  api: string;
  change: RemovedApiChange;
  /** RxJS major where the usage breaks. */
  rxjsMajor: number;
  replacement: string;
}

export interface UnscannedFile {
  /** Path relative to the project folder, with forward slashes. */
  file: string;
  reason: string;
}

export interface ScanResult {
  /** Uses of removed or changed APIs, sorted by file, line, column and entry id. */
  findings: ScanFinding[];
  /** Uses of deprecated APIs, sorted the same way; empty when no deprecation data was given. */
  deprecations: DeprecationScanFinding[];
  /** Uses of RxJS APIs that break in RxJS 7, sorted the same way; empty when no RxJS data was given. */
  rxjs: RxjsScanFinding[];
  /** Files or folders that were found but could not be scanned, sorted by file. */
  unscanned: UnscannedFile[];
  /** Number of files that were read and checked. */
  filesScanned: number;
}

export interface ScanOptions {
  /** Files larger than this are not read and are listed as unscanned. Default: 1 MiB. */
  maxFileBytes?: number;
  /** Deprecated APIs to look for as well. Absent: only removed or changed APIs are matched. */
  deprecations?: DeprecatedApiData;
  /**
   * RxJS breaking changes to look for as well. Absent: rxjs imports are not matched. When given,
   * TypeScript files that import rxjs without importing @angular/* are parsed too.
   */
  rxjs?: RxjsApiData;
}
