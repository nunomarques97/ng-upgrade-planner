// Results of the removed-API scan of a project's own source.
import type { RemovedApiChange, RemovedApiMigration } from '../data/types.js';

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

export interface UnscannedFile {
  /** Path relative to the project folder, with forward slashes. */
  file: string;
  reason: string;
}

export interface ScanResult {
  /** Sorted by file, line, column and entry id. */
  findings: ScanFinding[];
  /** Files or folders that were found but could not be scanned, sorted by file. */
  unscanned: UnscannedFile[];
  /** Number of files that were read and checked. */
  filesScanned: number;
}

export interface ScanOptions {
  /** Files larger than this are not read and are listed as unscanned. Default: 1 MiB. */
  maxFileBytes?: number;
}
