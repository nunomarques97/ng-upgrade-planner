// Scan of a project's own source for Angular APIs removed or changed in a later major, for APIs
// deprecated with an announced removal, and for RxJS APIs that break in RxJS 7.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DeprecatedApiEntry, RemovedApiData, RemovedApiEntry, RxjsApiEntry, ScanDataEntry } from '../data/types.js';
import { stripBom } from '../project/own.js';
import { matchConfig } from './config.js';
import { buildMatchers, type Matchers, type RawMatch } from './matchers.js';
import { matchTemplate } from './template.js';
import { LineIndex, shortMessage } from './text.js';
import type { DeprecationScanFinding, RxjsScanFinding, ScanFinding, ScanOptions, ScanResult, UnscannedFile } from './types.js';
import { scanTypeScript } from './typescript-source.js';
import { walkProject, type ProjectFile } from './walk.js';

export type * from './types.js';
export { SKIPPED_FOLDERS } from './walk.js';

export const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;

/** External templates are read when a component points at them or their name says so. */
const COMPONENT_TEMPLATE = /\.component\.html$/;

function isDeprecation(entry: ScanDataEntry): entry is DeprecatedApiEntry {
  return 'removalMajor' in entry;
}

function isRxjs(entry: ScanDataEntry): entry is RxjsApiEntry {
  return 'rxjsMajor' in entry;
}

/** An import of rxjs or one of its entry points, as written in a module specifier. */
const RXJS_IMPORT = /['"]rxjs(?:\/[^'"]*)?['"]/;

function toFinding(file: string, lines: LineIndex, match: RawMatch, entry: RemovedApiEntry): ScanFinding {
  const { line, column } = lines.position(match.offset);
  const api = entry.label;
  const finding: ScanFinding = {
    file,
    line,
    column,
    entryId: entry.id,
    package: entry.package,
    api,
    change: entry.change,
    major: entry.major,
    replacement: entry.replacement,
    migration: entry.migration,
    confidence: match.heuristic === undefined ? 'confirmed' : 'heuristic',
  };
  if (match.heuristic !== undefined) finding.reason = match.heuristic;
  return finding;
}

function toDeprecation(file: string, lines: LineIndex, match: RawMatch, entry: DeprecatedApiEntry): DeprecationScanFinding {
  const { line, column } = lines.position(match.offset);
  const finding: DeprecationScanFinding = {
    file,
    line,
    column,
    entryId: entry.id,
    package: entry.package,
    api: entry.label,
    deprecatedIn: entry.deprecatedIn,
    removalMajor: entry.removalMajor,
    replacement: entry.replacement,
    confidence: match.heuristic === undefined ? 'confirmed' : 'heuristic',
  };
  if (match.heuristic !== undefined) finding.reason = match.heuristic;
  return finding;
}

function toRxjs(file: string, lines: LineIndex, match: RawMatch, entry: RxjsApiEntry): RxjsScanFinding {
  const { line, column } = lines.position(match.offset);
  return {
    file,
    line,
    column,
    entryId: entry.id,
    package: entry.package,
    api: entry.label,
    change: entry.change,
    rxjsMajor: entry.rxjsMajor,
    replacement: entry.replacement,
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type AnyFinding = ScanFinding | DeprecationScanFinding | RxjsScanFinding;

function compareFindings(a: AnyFinding, b: AnyFinding): number {
  return compareText(a.file, b.file) || a.line - b.line || a.column - b.column || compareText(a.entryId, b.entryId);
}

/**
 * Scans TypeScript sources, component templates, angular.json and tsconfig files under
 * `projectDir` for the entries of `data`, `options.deprecations` and `options.rxjs`. Never throws
 * for a single file: unreadable or unparsable files are listed in `unscanned`. Rejects only when
 * the project folder itself cannot be listed.
 */
export async function scan(projectDir: string, data: RemovedApiData, options: ScanOptions = {}): Promise<ScanResult> {
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const sizeLimit = maxFileBytes >= 1024 ? `${Math.floor(maxFileBytes / 1024)} kB` : `${maxFileBytes} bytes`;
  const root = path.resolve(projectDir);
  const walk = await walkProject(root, maxFileBytes);
  if (walk.unscanned.some((item) => item.file === '.')) {
    throw new Error(`Cannot list the project folder ${root}`);
  }
  const matchers: Matchers = buildMatchers([
    ...data.entries,
    ...(options.deprecations?.entries ?? []),
    ...(options.rxjs?.entries ?? []),
  ]);
  const withRxjs = (options.rxjs?.entries.length ?? 0) > 0;
  const findings: ScanFinding[] = [];
  const deprecations: DeprecationScanFinding[] = [];
  const rxjs: RxjsScanFinding[] = [];
  const unscanned: UnscannedFile[] = [...walk.unscanned];
  const seen = new Set<string>();
  let filesScanned = 0;

  const record = (file: string, text: string, matches: readonly RawMatch[]): void => {
    if (matches.length === 0) return;
    const lines = new LineIndex(text);
    for (const match of matches) {
      const key = `${match.offset} ${match.entry.id}`;
      if (seen.has(`${file} ${key}`)) continue;
      seen.add(`${file} ${key}`);
      const { entry } = match;
      if (isDeprecation(entry)) deprecations.push(toDeprecation(file, lines, match, entry));
      else if (isRxjs(entry)) rxjs.push(toRxjs(file, lines, match, entry));
      else findings.push(toFinding(file, lines, match, entry));
    }
  };

  const read = async (item: ProjectFile): Promise<string | null> => {
    if (item.size > maxFileBytes) {
      unscanned.push({ file: item.file, reason: `larger than ${sizeLimit}, not read` });
      return null;
    }
    try {
      return stripBom(await readFile(item.absolute, 'utf8'));
    } catch (error) {
      const reason = error instanceof Error ? shortMessage(error.message) : 'unknown error';
      unscanned.push({ file: item.file, reason: `could not be read (${reason})` });
      return null;
    }
  };

  const htmlFiles = new Map<string, ProjectFile>();
  const referencedTemplates = new Set<string>();

  for (const item of walk.files) {
    if (item.kind === 'html') {
      htmlFiles.set(item.file, item);
      continue;
    }
    const text = await read(item);
    if (text === null) continue;
    try {
      if (item.kind === 'typescript') {
        // Without an Angular or RxJS import nothing in the file can be confirmed, so it is not parsed.
        if (text.includes('@angular/') || (withRxjs && RXJS_IMPORT.test(text))) {
          const result = scanTypeScript(text, matchers);
          record(item.file, text, result.matches);
          for (const url of result.templateUrls) {
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(item.file), url.replace(/\\/g, '/')));
            if (target === '..' || target.startsWith('../')) {
              unscanned.push({ file: item.file, reason: 'its templateUrl points outside the project folder' });
            } else {
              referencedTemplates.add(target);
            }
          }
        }
      } else {
        record(item.file, text, matchConfig(text, item.kind === 'angular-json' ? 'angular.json' : 'tsconfig', matchers));
      }
      filesScanned++;
    } catch (error) {
      const reason = error instanceof Error ? shortMessage(error.message) : 'unknown error';
      unscanned.push({ file: item.file, reason: `could not be parsed (${reason})` });
    }
  }

  for (const [file, item] of htmlFiles) {
    if (!referencedTemplates.has(file) && !COMPONENT_TEMPLATE.test(file)) continue;
    const text = await read(item);
    if (text === null) continue;
    record(file, text, matchTemplate(text, 0, matchers.templates));
    filesScanned++;
  }

  findings.sort(compareFindings);
  deprecations.sort(compareFindings);
  rxjs.sort(compareFindings);
  unscanned.sort((a, b) => compareText(a.file, b.file) || compareText(a.reason, b.reason));
  return { findings, deprecations, rxjs, unscanned, filesScanned };
}
