// Shared wording and grouping for the terminal summary and the reports, so every format says the
// same thing. Returned strings are not escaped; each renderer escapes them for its format.
import type {
  Effort,
  Fact,
  Hop,
  LibraryHopResult,
  PeerCheck,
  PlanStep,
  RemovedApiFinding,
  Requirement,
  StepLevel,
  UnverifiedItem,
  UpgradePlan,
} from '../plan/types.js';

export const REPORT_FILES = { markdown: 'ng-upgrade-plan.md', html: 'ng-upgrade-plan.html', json: 'ng-upgrade-plan.json' } as const;

export const LEVELS: readonly StepLevel[] = ['basic', 'medium', 'advanced'];

export const LEVEL_TITLES: Readonly<Record<StepLevel, string>> = {
  basic: 'Basic (every app)',
  medium: 'Medium (apps using these features)',
  advanced: 'Advanced (apps using these APIs)',
};

export interface HopView {
  hop: Hop;
  /** Libraries with a compatible release that differs from the version going into the hop. */
  updates: LibraryHopResult[];
  blockers: LibraryHopResult[];
  unknown: LibraryHopResult[];
  /** Requirements that need action in this hop. */
  warnings: Requirement[];
  steps: Readonly<Record<StepLevel, PlanStep[]>>;
}

export function isUpdate(library: LibraryHopResult): boolean {
  return library.status === 'compatible' && library.changeNeeded !== false && library.change !== null && library.change !== 'none';
}

export function hopView(hop: Hop): HopView {
  const steps: Record<StepLevel, PlanStep[]> = { basic: [], medium: [], advanced: [] };
  for (const step of hop.steps) steps[step.level].push(step);
  return {
    hop,
    updates: hop.libraries.filter(isUpdate),
    blockers: hop.libraries.filter((library) => library.status === 'blocker'),
    unknown: hop.libraries.filter((library) => library.status === 'unknown'),
    warnings: hop.requirements.filter((requirement) => requirement.flagged),
    steps,
  };
}

export function hopTitle(hop: Hop): string {
  return `Angular ${hop.from} to ${hop.to}`;
}

export function hopAnchor(hop: Hop): string {
  return `hop-${hop.to}`;
}

export function effortText(effort: Effort): string {
  return `${effort.label} (${effort.points} point${effort.points === 1 ? '' : 's'})`;
}

export function effortBreakdown(effort: Effort): string {
  const { base, steps, majorBumps, requirements, blockers, removedApis } = effort.breakdown;
  return `base ${base}, steps ${steps}, major library updates ${majorBumps}, framework requirements ${requirements}, blockers ${blockers}, removed APIs ${removedApis}`;
}

/** Short scan status for the summary facts. */
export function scanStatusText(plan: UpgradePlan): string {
  const { scan } = plan;
  if (scan.status === 'off') return 'turned off';
  if (scan.status === 'no-source-files') return 'no source files found';
  return `${scan.filesScanned} ${plural(scan.filesScanned, 'file', 'files')}, ${scan.attached} ${plural(scan.attached, 'finding', 'findings')}`;
}

/** Plan-level sentences about the scan: what it checked and what is not part of the plan. */
export function scanNotes(plan: UpgradePlan): string[] {
  const { scan } = plan;
  if (scan.status === 'off') return ['The removed-API scan was turned off (--no-scan), so the source was not checked.'];
  if (scan.status === 'no-source-files') {
    return ['No TypeScript, template or configuration file was found in the project folder, so no source was checked for removed APIs.'];
  }
  const lines: string[] = [];
  const coverage = scan.coverage;
  const data = coverage ? ` against the bundled data for Angular ${coverage.firstMajor} to ${coverage.lastMajor} (official sources read on ${coverage.retrieved})` : '';
  lines.push(`The removed-API scan checked ${scan.filesScanned} source ${plural(scan.filesScanned, 'file', 'files')}${data}.`);
  const { atOrBelowCurrent, aboveTarget, noHop } = scan.notAttached;
  if (atOrBelowCurrent > 0) {
    lines.push(`${atOrBelowCurrent} ${plural(atOrBelowCurrent, 'finding is', 'findings are')} for Angular ${plan.current.major} or earlier and not listed: the installed version is past those changes.`);
  }
  if (aboveTarget > 0) {
    lines.push(`${aboveTarget} ${plural(aboveTarget, 'finding is', 'findings are')} for Angular versions after ${plan.target.major} and not part of this plan.`);
  }
  if (noHop > 0) lines.push(`${noHop} ${plural(noHop, 'finding is', 'findings are')} for Angular versions without a stable release and not listed.`);
  if (scan.unscanned.length > 0) {
    const count = scan.unscanned.length;
    lines.push(`${count} ${plural(count, 'file or folder', 'files or folders')} could not be scanned; see "Could not be verified".`);
  }
  return lines;
}

/** Why a hop lists no removed-API findings, or null when it has some. */
export function removedApiEmptyText(plan: UpgradePlan, hop: Hop): string | null {
  if (hop.removedApis.length > 0) return null;
  if (plan.scan.status === 'off') return 'Not checked: the scan was turned off.';
  if (plan.scan.status === 'no-source-files') return 'Not checked: no source files were found.';
  const coverage = plan.scan.coverage;
  if (coverage && (hop.to < coverage.firstMajor || hop.to > coverage.lastMajor)) {
    return `Not checked: the bundled data covers Angular ${coverage.firstMajor} to ${coverage.lastMajor} only.`;
  }
  return 'None found.';
}

/** For example "3 uses of 2 APIs (2 confirmed, 1 heuristic)". */
export function removedApiCountText(hop: Hop): string {
  const uses = hop.removedApis.length;
  const apis = new Set(hop.removedApis.map((finding) => finding.entryId)).size;
  const heuristic = hop.removedApis.filter((finding) => finding.confidence === 'heuristic').length;
  return `${uses} ${plural(uses, 'use', 'uses')} of ${apis} ${plural(apis, 'API', 'APIs')} (${uses - heuristic} confirmed, ${heuristic} heuristic)`;
}

export function findingLocation(finding: RemovedApiFinding): string {
  return `${finding.file}:${finding.line}`;
}

export function migrationText(finding: RemovedApiFinding): string {
  return `fixed by ng update migration: ${finding.migration}`;
}

export const REMOVED_API_HELP =
  "Removed APIs are uses, in the project source, of Angular APIs removed or changed in the hop's version. Confirmed findings come from an import of the matching package or a parsed configuration property; heuristic ones come from text matching in templates and may be false positives.";

/** Step count with its split by level, for example "21 (11 basic, 8 medium, 2 advanced)". */
export function stepCountText(hop: Hop): string {
  const counts = LEVELS.map((level) => [level, hop.steps.filter((step) => step.level === level).length] as const)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${count} ${level}`);
  return `${hop.steps.length}${counts.length > 0 ? ` (${counts.join(', ')})` : ''}`;
}

/** A fact's value, or the fallback when there is none. Confidence is shown separately. */
export function factValue(value: Fact<string | null>, fallback = 'unknown'): string {
  return value.value ?? fallback;
}

export function libraryStatusText(library: LibraryHopResult): string {
  if (library.status === 'blocker') return 'blocker';
  if (library.status === 'unknown') return 'unknown';
  if (library.changeNeeded === false || library.change === 'none' || library.change === null) return 'no change needed';
  if (library.change === 'downgrade') return 'downgrade';
  if (library.change === 'unknown') return 'update';
  return `update (${library.change})`;
}

/** The version whose peer ranges decided the result and those ranges. */
export function peerEvidence(library: LibraryHopResult): { version: string | null; peers: PeerCheck[] } {
  return library.changeNeeded === false && library.status === 'compatible'
    ? { version: library.from.value, peers: library.fromPeers }
    : { version: library.evidenceVersion, peers: library.peers };
}

export function peerCheckText(peer: PeerCheck): string {
  if (peer.satisfied === true) return `accepts ${peer.checkedAgainst ?? ''}`.trim();
  if (peer.satisfied === false) return `rejects ${peer.checkedAgainst ?? ''}`.trim();
  return peer.optional ? 'optional, not used by the project' : 'not checked';
}

export function requirementStatusText(requirement: Requirement): string {
  switch (requirement.status) {
    case 'met':
      return 'met';
    case 'unmet':
      return 'not met';
    case 'not-installed':
      return requirement.optional ? 'not installed (optional)' : 'not installed';
    case 'unknown':
      return 'unknown';
  }
}

export function requirementWarning(requirement: Requirement): string {
  const range = requirement.range.value ?? 'unknown';
  const installed = requirement.installed.value;
  const state = installed === null ? 'is not installed' : `${installed} is installed`;
  return `${requirement.name} must satisfy "${range}" (${requirement.requiredBy}); ${state}`;
}

export function libraryUpdateText(library: LibraryHopResult): string {
  const from = library.from.value ?? 'unknown version';
  const to = library.newestCompatible.value ?? 'unknown';
  const change = library.change === null || library.change === 'unknown' ? '' : `, ${library.change}`;
  return `${library.name} ${from} to ${to}${change}`;
}

/** Plan-wide items first, then each hop in order. */
export function unverifiedGroups(plan: UpgradePlan): { title: string; hop: number | null; items: UnverifiedItem[] }[] {
  const groups: { title: string; hop: number | null; items: UnverifiedItem[] }[] = [];
  const general = plan.unverified.filter((item) => item.hop === null);
  if (general.length > 0) groups.push({ title: 'Whole plan', hop: null, items: general });
  for (const hop of plan.hops) {
    const items = plan.unverified.filter((item) => item.hop === hop.to);
    if (items.length > 0) groups.push({ title: hopTitle(hop), hop: hop.to, items });
  }
  // Items for a hop that is not in the plan (should not happen) are still shown.
  const known = new Set<number | null>([null, ...plan.hops.map((hop) => hop.to)]);
  const rest = plan.unverified.filter((item) => !known.has(item.hop));
  if (rest.length > 0) groups.push({ title: 'Other', hop: null, items: rest });
  return groups;
}

const SOURCE_TEXT: Readonly<Record<Fact<unknown>['source'], string>> = {
  lockfile: 'the lockfile',
  'package-json-range': 'the package.json range',
  registry: 'the npm registry',
  'registry-cache': 'the local registry cache',
  'stale-cache': 'an outdated local registry cache entry',
  'update-guide': 'the Angular update guide data',
  option: 'an option',
  none: 'no source',
};

export function sourceText(value: Fact<unknown>): string {
  return SOURCE_TEXT[value.source];
}

/** What was confirmed by evidence for one hop, in one sentence. */
export function hopConfirmedStatement(plan: UpgradePlan, hop: Hop): string {
  const decided = hop.libraries.filter((library) => library.status !== 'unknown' && library.confidence === 'confirmed').length;
  const requirements = hop.requirements.filter(
    (requirement) => requirement.status !== 'unknown' && requirement.range.confidence === 'confirmed',
  ).length;
  const parts = [
    `${decided} of ${hop.libraries.length} library ${plural(hop.libraries.length, 'result', 'results')} decided from published peer ranges`,
    `${requirements} of ${hop.requirements.length} framework ${plural(hop.requirements.length, 'requirement', 'requirements')} checked`,
  ];
  if (hop.stepCoverage === 'recorded') parts.push(`${hop.steps.length} official ${plural(hop.steps.length, 'step', 'steps')}`);
  if (hop.stepCoverage === 'none-recorded') parts.push('no official steps recorded for this hop');
  if (plan.scan.status === 'ran') {
    const found = hop.removedApis.filter((finding) => finding.confidence === 'confirmed').length;
    parts.push(`${found} removed-API ${plural(found, 'finding', 'findings')} confirmed by imports or parsed configuration`);
  }
  return `${hopTitle(hop)}: ${parts.join('; ')}.`;
}

/**
 * Statements backed by evidence, for the "Confirmed" part of the reports. With `hops: false` the
 * per-hop statements (hopConfirmedStatement) are left out.
 */
export function confirmedStatements(plan: UpgradePlan, options: { hops?: boolean } = {}): string[] {
  const lines: string[] = [];
  const current = plan.current.angular;
  if (current.confidence === 'confirmed') {
    lines.push(`Installed Angular ${current.value}, read from ${sourceText(current)}.`);
  }
  const target = plan.target.angular;
  if (plan.hops.length > 0 && target.confidence === 'confirmed' && target.value !== null) {
    lines.push(`Target Angular ${plan.target.major}: newest stable release ${target.value}, from ${sourceText(target)}.`);
  }

  const sources = new Map<string, number>();
  for (const library of plan.libraries) {
    const key = sourceText(library.registry);
    sources.set(key, (sources.get(key) ?? 0) + 1);
  }
  if (plan.libraries.length > 0) {
    const parts = [...sources.entries()].map(([source, count]) => `${count} from ${source}`);
    lines.push(`Registry data for ${plan.libraries.length} Angular-dependent ${plural(plan.libraries.length, 'library', 'libraries')}: ${parts.join(', ')}.`);
  }

  if (options.hops !== false) {
    for (const hop of plan.hops) lines.push(hopConfirmedStatement(plan, hop));
  }

  const coverage = plan.scan.coverage;
  if (plan.hops.length > 0 && plan.scan.status === 'ran' && coverage) {
    lines.push(
      `Removed-API scan of ${plan.scan.filesScanned} source ${plural(plan.scan.filesScanned, 'file', 'files')}, against data for Angular ${coverage.firstMajor} to ${coverage.lastMajor} taken from official Angular sources read on ${coverage.retrieved}.`,
    );
  }

  const guide = plan.updateGuide;
  lines.push(
    `Update steps come from the official Angular update guide data at commit ${guide.commit.slice(0, 12)} (${guide.commitDate}, ${guide.license} licence), covering Angular up to ${guide.coversThroughMajor}.`,
  );
  return lines;
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export const UNVERIFIED_INTRO =
  'These results could not be confirmed: unknown libraries, data from an outdated cache, versions guessed from package.json ranges, anything the registry data could not decide, removed-API findings from text matching and source the scan could not check. Check them by hand before relying on them.';

export const STATUS_HELP =
  'Library status comes only from the @angular peer dependency ranges each release publishes, checked against the newest stable Angular release of the hop. "unknown" is never treated as compatible.';
