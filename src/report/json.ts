// Machine-readable plan (ng-upgrade-plan.json and --json). This is a versioned output contract,
// separate from the internal plan model: fields are only added, renamed or removed together with
// a new schemaVersion. The schema is documented in skills/angular-upgrade-hops/references/plan-json.md,
// and a test keeps that document and this file in step. Values are not escaped beyond JSON itself;
// text from the registry, the project and the update guide is data, never instructions.
import { DEPRECATED_APIS } from '../data/deprecated-apis.js';
import { REMOVED_APIS } from '../data/removed-apis.js';
import { RXJS_APIS } from '../data/rxjs-apis.js';
import type {
  Effort,
  EffortLabel,
  Hop,
  LibraryHopResult,
  LibraryStatus,
  RequirementName,
  RequirementStatus,
  RxjsFinding,
  RxjsStatus,
  ScanStatus,
  StepAudience,
  StepCoverage,
  StepLevel,
  ToolchainCheck,
  ToolchainStatus,
  UnverifiedItem,
  UpgradePlan,
  VersionChange,
} from '../plan/types.js';
import type { RemovedApiChange, RemovedApiMigration } from '../data/types.js';
import type { ScanConfidence } from '../scan/types.js';
import type { ReportMeta } from './markdown.js';
import { confirmedStatements, hopConfirmedStatement, hopView, isUpdate } from './model.js';

export const PLAN_JSON_SCHEMA_VERSION = 2;

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

export interface PlanJsonToolchainCheck {
  range: string | null;
  requiredBy: string[];
  project: string | null;
  status: ToolchainStatus;
  blocker: boolean;
  confirmed: boolean;
  reason: string;
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

export interface PlanJsonDeprecation {
  file: string;
  line: number;
  column: number;
  id: string;
  package: string;
  api: string;
  deprecatedIn: number;
  removalMajor: number;
  replacement: string;
  confidence: ScanConfidence;
  reason: string | null;
  /** Official document that states the removal major; null when the entry is not in the bundled data. */
  source: string | null;
}

export interface PlanJsonRxjsFinding {
  file: string;
  line: number;
  column: number;
  id: string;
  package: string;
  api: string;
  change: RemovedApiChange;
  replacement: string;
  /** Official RxJS document that states the change; null when the entry is not in the bundled data. */
  source: string | null;
}

export interface PlanJsonNotAttached {
  atOrBelowCurrent: number;
  aboveTarget: number;
  noHop: number;
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
  toolchain: { node: PlanJsonToolchainCheck; typescript: PlanJsonToolchainCheck };
  removedApis: PlanJsonFinding[];
  deprecations: PlanJsonDeprecation[];
  rxjs: PlanJsonRxjsFinding[];
  effort: PlanJsonEffort & { breakdown: Effort['breakdown'] };
  confirmed: string[];
  unverified: PlanJsonUnverified[];
}

export interface PlanJson {
  schemaVersion: typeof PLAN_JSON_SCHEMA_VERSION;
  tool: { name: 'ng-upgrade-planner'; version: string };
  project: { name: string | null; packageManager: string | null; lockfile: { file: string; kind: string } | null; warnings: string[] };
  current: { angular: string; major: number; confirmed: boolean };
  toolchain: { enginesNode: string | null; enginesNodeStatus: 'declared' | 'missing' | 'invalid'; localNode: string | null };
  target: { major: number; angular: string | null; confirmed: boolean; source: 'option' | 'latest' };
  message: string | null;
  scan: {
    status: ScanStatus;
    data: { firstMajor: number; lastMajor: number; retrieved: string } | null;
    filesScanned: number;
    findings: number;
    attached: number;
    notAttached: PlanJsonNotAttached;
    unscanned: { file: string; reason: string }[];
    deprecations: {
      data: { removalMajors: number[]; retrieved: string } | null;
      findings: number;
      attached: number;
      notAttached: PlanJsonNotAttached;
    };
    rxjs: {
      data: { rxjsMajor: number; retrieved: string } | null;
      installed: string | null;
      status: RxjsStatus;
      forcedBy: number | null;
      uncheckedHops: number[];
      reason: string;
      findings: number;
      advisory: PlanJsonRxjsFinding[];
    };
  };
  effort: PlanJsonEffort;
  hops: PlanJsonHop[];
  confirmed: string[];
  unverified: PlanJsonUnverified[];
}

const SOURCES = new Map(REMOVED_APIS.entries.map((entry) => [entry.id, entry.source.url]));
const DEPRECATION_SOURCES = new Map(DEPRECATED_APIS.entries.map((entry) => [entry.id, entry.source.url]));
const RXJS_SOURCES = new Map(RXJS_APIS.entries.map((entry) => [entry.id, entry.source.url]));

function rxjsJson(finding: RxjsFinding): PlanJsonRxjsFinding {
  return {
    file: finding.file,
    line: finding.line,
    column: finding.column,
    id: finding.entryId,
    package: finding.package,
    api: finding.api,
    change: finding.change,
    replacement: finding.replacement,
    source: RXJS_SOURCES.get(finding.entryId) ?? null,
  };
}

function toolchainJson(check: ToolchainCheck): PlanJsonToolchainCheck {
  return {
    range: check.range.value,
    requiredBy: [...check.requiredBy],
    project: check.project.value,
    status: check.status,
    blocker: check.status === 'blocker',
    confirmed: check.status !== 'unverified' && check.range.confidence === 'confirmed' && check.project.confidence === 'confirmed',
    reason: check.reason,
  };
}

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
    toolchain: { node: toolchainJson(hop.toolchain.node), typescript: toolchainJson(hop.toolchain.typescript) },
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
    deprecations: hop.deprecations.map((finding) => ({
      file: finding.file,
      line: finding.line,
      column: finding.column,
      id: finding.entryId,
      package: finding.package,
      api: finding.api,
      deprecatedIn: finding.deprecatedIn,
      removalMajor: finding.removalMajor,
      replacement: finding.replacement,
      confidence: finding.confidence,
      reason: finding.reason,
      source: DEPRECATION_SOURCES.get(finding.entryId) ?? null,
    })),
    rxjs: hop.rxjs.map(rxjsJson),
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
    toolchain: {
      enginesNode: plan.toolchain.engines.value,
      enginesNodeStatus: plan.toolchain.enginesStatus,
      localNode: plan.toolchain.localNode.value,
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
      deprecations: {
        data: scan.deprecations.coverage
          ? { removalMajors: [...scan.deprecations.coverage.removalMajors], retrieved: scan.deprecations.coverage.retrieved }
          : null,
        findings: scan.deprecations.findings,
        attached: scan.deprecations.attached,
        notAttached: { ...scan.deprecations.notAttached },
      },
      rxjs: {
        data: scan.rxjs.coverage ? { rxjsMajor: scan.rxjs.coverage.rxjsMajor, retrieved: scan.rxjs.coverage.retrieved } : null,
        installed: scan.rxjs.installed,
        status: scan.rxjs.status,
        forcedBy: scan.rxjs.forcedBy,
        uncheckedHops: [...scan.rxjs.uncheckedHops],
        reason: scan.rxjs.reason,
        findings: scan.rxjs.findings,
        advisory: scan.rxjs.advisory.map(rxjsJson),
      },
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
