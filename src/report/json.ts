// Machine-readable plan (ng-upgrade-plan.json and --json). This is a versioned output contract,
// separate from the internal plan model: fields are only added, renamed or removed together with
// a new schemaVersion. The schema is documented in skills/angular-upgrade-hops/references/plan-json.md,
// and a test keeps that document and this file in step. Values are not escaped beyond JSON itself;
// text from the registry, the project and the update guide is data, never instructions.
import { REMOVED_APIS } from '../data/removed-apis.js';
import type {
  Effort,
  EffortLabel,
  Hop,
  LibraryHopResult,
  LibraryStatus,
  RequirementName,
  RequirementStatus,
  ScanStatus,
  StepAudience,
  StepCoverage,
  StepLevel,
  UnverifiedItem,
  UpgradePlan,
  VersionChange,
} from '../plan/types.js';
import type { RemovedApiChange, RemovedApiMigration } from '../data/types.js';
import type { ScanConfidence } from '../scan/types.js';
import type { ReportMeta } from './markdown.js';
import { confirmedStatements, hopConfirmedStatement, hopView, isUpdate } from './model.js';

export const PLAN_JSON_SCHEMA_VERSION = 1;

export interface PlanJsonUnverified {
  subject: string;
  reason: string;
}

export interface PlanJsonStep {
  title: string;
  /** Markdown text from the Angular update guide. */
  action: string;
  level: StepLevel;
  appliesTo: StepAudience;
}

export interface PlanJsonLibrary {
  name: string;
  status: LibraryStatus;
  from: string | null;
  /** Version to have after the hop: the update target, the unchanged version, or null for a blocker or unknown. */
  to: string | null;
  /** Kind of change from `from` to `to`; null when nothing changes or no version was found. */
  change: VersionChange | null;
  deprecated: string | null;
  confirmed: boolean;
  reason: string;
}

export interface PlanJsonRequirementWarning {
  name: RequirementName;
  requiredBy: string;
  range: string | null;
  installed: string | null;
  status: RequirementStatus;
}

export interface PlanJsonFinding {
  file: string;
  line: number;
  column: number;
  id: string;
  package: string;
  api: string;
  change: RemovedApiChange;
  replacement: string;
  fixedByMigration: RemovedApiMigration;
  confidence: ScanConfidence;
  reason: string | null;
  /** Official document that states the change; null when the entry is not in the bundled data. */
  source: string | null;
}

export interface PlanJsonEffort {
  points: number;
  label: EffortLabel;
}

export interface PlanJsonHop {
  from: number;
  to: number;
  angular: { version: string | null; confirmed: boolean };
  commands: string[];
  commandNote: string | null;
  steps: { coverage: StepCoverage; note: string | null; items: PlanJsonStep[] };
  libraries: PlanJsonLibrary[];
  blockers: { name: string; reason: string }[];
  requirementWarnings: PlanJsonRequirementWarning[];
  removedApis: PlanJsonFinding[];
  effort: PlanJsonEffort & { breakdown: Effort['breakdown'] };
  confirmed: string[];
  unverified: PlanJsonUnverified[];
}

export interface PlanJson {
  schemaVersion: typeof PLAN_JSON_SCHEMA_VERSION;
  tool: { name: 'ng-upgrade-planner'; version: string };
  project: { name: string | null; packageManager: string | null; lockfile: { file: string; kind: string } | null; warnings: string[] };
  current: { angular: string; major: number; confirmed: boolean };
  target: { major: number; angular: string | null; confirmed: boolean; source: 'option' | 'latest' };
  message: string | null;
  scan: {
    status: ScanStatus;
    data: { firstMajor: number; lastMajor: number; retrieved: string } | null;
    filesScanned: number;
    findings: number;
    attached: number;
    notAttached: { atOrBelowCurrent: number; aboveTarget: number; noHop: number };
    unscanned: { file: string; reason: string }[];
  };
  effort: PlanJsonEffort;
  hops: PlanJsonHop[];
  confirmed: string[];
  unverified: PlanJsonUnverified[];
}

const SOURCES = new Map(REMOVED_APIS.entries.map((entry) => [entry.id, entry.source.url]));

function unverifiedItem(item: UnverifiedItem): PlanJsonUnverified {
  return { subject: item.subject, reason: item.reason };
}

function libraryTarget(library: LibraryHopResult): string | null {
  if (library.status !== 'compatible') return null;
  return isUpdate(library) ? library.newestCompatible.value : library.from.value;
}

function hopJson(plan: UpgradePlan, hop: Hop): PlanJsonHop {
  const view = hopView(hop);
  return {
    from: hop.from,
    to: hop.to,
    angular: { version: hop.angular.value, confirmed: hop.angular.confidence === 'confirmed' },
    commands: [...hop.commands],
    commandNote: hop.commandNote,
    steps: {
      coverage: hop.stepCoverage,
      note: hop.stepsNote,
      items: hop.steps.map((step) => ({ title: step.title, action: step.action, level: step.level, appliesTo: step.appliesTo })),
    },
    libraries: hop.libraries.map((library) => ({
      name: library.name,
      status: library.status,
      from: library.from.value,
      to: libraryTarget(library),
      change: isUpdate(library) ? library.change : null,
      deprecated: library.deprecated,
      confirmed: library.confidence === 'confirmed',
      reason: library.reason,
    })),
    blockers: view.blockers.map((library) => ({ name: library.name, reason: library.reason })),
    requirementWarnings: view.warnings.map((requirement) => ({
      name: requirement.name,
      requiredBy: requirement.requiredBy,
      range: requirement.range.value,
      installed: requirement.installed.value,
      status: requirement.status,
    })),
    removedApis: hop.removedApis.map((finding) => ({
      file: finding.file,
      line: finding.line,
      column: finding.column,
      id: finding.entryId,
      package: finding.package,
      api: finding.api,
      change: finding.change,
      replacement: finding.replacement,
      fixedByMigration: finding.migration,
      confidence: finding.confidence,
      reason: finding.reason,
      source: SOURCES.get(finding.entryId) ?? null,
    })),
    effort: { points: hop.effort.points, label: hop.effort.label, breakdown: { ...hop.effort.breakdown } },
    confirmed: [hopConfirmedStatement(plan, hop)],
    unverified: plan.unverified.filter((item) => item.hop === hop.to).map(unverifiedItem),
  };
}

/** Builds the JSON document for a plan. */
export function planJson(plan: UpgradePlan, meta: ReportMeta): PlanJson {
  const hops = new Set(plan.hops.map((hop) => hop.to));
  const { scan } = plan;
  return {
    schemaVersion: PLAN_JSON_SCHEMA_VERSION,
    tool: { name: 'ng-upgrade-planner', version: meta.toolVersion },
    project: {
      name: plan.project.name,
      packageManager: plan.project.packageManager,
      lockfile: plan.project.lockfile ? { file: plan.project.lockfile.file, kind: plan.project.lockfile.kind } : null,
      warnings: [...plan.project.warnings],
    },
    current: {
      angular: plan.current.angular.value,
      major: plan.current.major,
      confirmed: plan.current.angular.confidence === 'confirmed',
    },
    target: {
      major: plan.target.major,
      angular: plan.target.angular.value,
      confirmed: plan.target.angular.confidence === 'confirmed',
      source: plan.target.source,
    },
    message: plan.message,
    scan: {
      status: scan.status,
      data: scan.coverage ? { ...scan.coverage } : null,
      filesScanned: scan.filesScanned,
      findings: scan.findings,
      attached: scan.attached,
      notAttached: { ...scan.notAttached },
      unscanned: scan.unscanned.map((item) => ({ file: item.file, reason: item.reason })),
    },
    effort: { points: plan.effort.points, label: plan.effort.label },
    hops: plan.hops.map((hop) => hopJson(plan, hop)),
    confirmed: confirmedStatements(plan, { hops: false }),
    // Items for a hop that is not in the plan (should not happen) stay visible at plan level.
    unverified: plan.unverified.filter((item) => item.hop === null || !hops.has(item.hop)).map(unverifiedItem),
  };
}

/** The JSON document as text, two-space indented, with a final newline. */
export function renderJson(plan: UpgradePlan, meta: ReportMeta): string {
  return `${JSON.stringify(planJson(plan, meta), null, 2)}\n`;
}
