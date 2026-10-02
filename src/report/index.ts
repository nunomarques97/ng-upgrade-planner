// Report rendering and writing.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { UpgradePlan } from '../plan/types.js';
import { renderHtml } from './html.js';
import { renderJson } from './json.js';
import { renderMarkdown, type ReportMeta } from './markdown.js';
import { REPORT_FILES } from './model.js';

export { renderHtml } from './html.js';
export { PLAN_JSON_SCHEMA_VERSION, planJson, renderJson, type PlanJson } from './json.js';
export { renderMarkdown, type ReportMeta } from './markdown.js';
export { renderTerminal, shouldUseColor, type TerminalOptions } from './terminal.js';
export { REPORT_FILES } from './model.js';
export { cleanText, escapeHtml, escapeMarkdown, safeHttpsUrl } from './text.js';

/** Writes the Markdown, HTML and JSON reports into `outDir` (created if needed) and returns their paths. */
export async function writeReports(plan: UpgradePlan, outDir: string, meta: ReportMeta): Promise<string[]> {
  const dir = path.resolve(outDir);
  await mkdir(dir, { recursive: true });
  const files: [string, string][] = [
    [path.join(dir, REPORT_FILES.markdown), renderMarkdown(plan, meta)],
    [path.join(dir, REPORT_FILES.html), renderHtml(plan, meta)],
    [path.join(dir, REPORT_FILES.json), renderJson(plan, meta)],
  ];
  for (const [file, content] of files) await writeFile(file, content, 'utf8');
  return files.map(([file]) => file);
}
