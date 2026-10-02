// Programmatic API: read a project, build its upgrade plan and render the reports.
export { readProject, ProjectError, isProjectError } from './project/index.js';
export type * from './project/types.js';
export { buildPlan, PlanError, isPlanError, PLAN_SCHEMA } from './plan/index.js';
export type * from './plan/types.js';
export { RegistryClient, RegistryConfigError, DEFAULT_REGISTRY, defaultCacheDir, type RegistryClientOptions } from './registry/index.js';
export type { PackageRecord, PackageResult, VersionRecord } from './registry/index.js';
export {
  renderHtml,
  renderMarkdown,
  renderTerminal,
  shouldUseColor,
  writeReports,
  REPORT_FILES,
  type ReportMeta,
  type TerminalOptions,
} from './report/index.js';
