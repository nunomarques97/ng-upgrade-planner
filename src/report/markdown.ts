// Markdown report. Every plan string is escaped with escapeMarkdown or markdownCode; step text
// keeps its code spans and https links only.
import type { Fact, Hop, LibraryHopResult, RemovedApiFinding, UpgradePlan } from '../plan/types.js';
import {
  LEVELS,
  LEVEL_TITLES,
  REMOVED_API_HELP,
  STATUS_HELP,
  UNVERIFIED_INTRO,
  confirmedStatements,
  effortBreakdown,
  effortText,
  factValue,
  findingLocation,
  hopTitle,
  hopView,
  libraryStatusText,
  peerCheckText,
  peerEvidence,
  removedApiCountText,
  removedApiEmptyText,
  requirementStatusText,
  scanNotes,
  scanStatusText,
  stepCountText,
  unverifiedGroups,
} from './model.js';
import { cleanText, escapeMarkdown as md, markdownCode, markdownUrl, safeHttpsUrl, stepMarkdown } from './text.js';

export interface ReportMeta {
  /** Version of ng-upgrade-planner that produced the report. */
  toolVersion: string;
}

function table(headers: string[], rows: string[][]): string[] {
  return [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.join(' | ')} |`)];
}

/** A value with "(unverified)" when the fact is not confirmed. */
function factCell(value: Fact<string | null>, fallback = 'unknown'): string {
  const text = md(factValue(value, fallback));
  return value.confidence === 'unverified' ? `${text} (unverified)` : text;
}

function peerCell(library: LibraryHopResult): string {
  const { version, peers } = peerEvidence(library);
  if (peers.length === 0) return 'none';
  const checks = peers.map((peer) => `${markdownCode(peer.name, true)} ${markdownCode(peer.range, true)}: ${md(peerCheckText(peer))}`);
  return `${version !== null ? `${md(version)}: ` : ''}${checks.join('<br>')}`;
}

function libraryRows(hop: Hop): string[][] {
  return hop.libraries.map((library) => {
    let status = md(libraryStatusText(library));
    if (library.deprecated !== null) status += `<br>deprecated: ${md(library.deprecated)}`;
    if (library.confidence === 'unverified' && library.status !== 'unknown') status += ' (unverified)';
    return [
      markdownCode(library.name, true),
      factCell(library.from),
      factCell(library.newestCompatible, 'none'),
      peerCell(library),
      status,
    ];
  });
}

function findingRow(finding: RemovedApiFinding): string[] {
  const confidence = finding.confidence === 'heuristic' ? `heuristic (unverified): ${md(finding.reason ?? '')}` : 'confirmed';
  return [
    markdownCode(findingLocation(finding), true),
    `${markdownCode(finding.api, true)} from ${markdownCode(finding.package, true)}`,
    md(finding.change),
    md(finding.replacement),
    md(finding.migration),
    confidence,
  ];
}

function removedApiSection(plan: UpgradePlan, hop: Hop): string[] {
  const out: string[] = ['### Removed or changed APIs', ''];
  const empty = removedApiEmptyText(plan, hop);
  if (empty !== null) return [...out, md(empty), ''];
  out.push(`${md(removedApiCountText(hop))}.`, '');
  out.push(
    ...table(['Location', 'API', 'Change', 'Replacement', 'Fixed by ng update migration', 'Confidence'], hop.removedApis.map(findingRow)),
    '',
  );
  return out;
}

function hopSection(plan: UpgradePlan, hop: Hop, index: number): string[] {
  const view = hopView(hop);
  const out: string[] = [`## Hop ${index + 1}: ${md(hopTitle(hop))}`, ''];
  out.push(`Target release: ${factCell(hop.angular)}. Effort: **${md(effortText(hop.effort))}**.`, '');

  out.push('### Update command', '');
  if (hop.commands.length > 0) out.push('```sh', ...hop.commands.map(cleanText), '```', '');
  if (hop.commandNote !== null) out.push(md(hop.commandNote), '');

  out.push(`### Official update steps: ${md(stepCountText(hop))}`, '');
  if (hop.stepsNote !== null) out.push(md(hop.stepsNote), '');
  for (const level of LEVELS) {
    const steps = view.steps[level];
    if (steps.length === 0) continue;
    out.push(`#### ${md(LEVEL_TITLES[level])}`, '');
    for (const step of steps) {
      const audience = step.appliesTo === 'all' ? '' : `, ${md(step.appliesTo)} only`;
      out.push(`- **${md(step.title)}** (required from ${md(step.necessaryAsOf)}${audience}): ${stepMarkdown(step.action)}`);
    }
    out.push('');
  }

  out.push('### Libraries', '');
  if (hop.libraries.length === 0) {
    out.push('No Angular-dependent third-party libraries found.', '');
  } else {
    out.push(...table(['Library', 'Current', 'Newest compatible', 'Peer range evidence', 'Status'], libraryRows(hop)), '');
  }

  out.push('### Blockers', '');
  if (view.blockers.length === 0) out.push('None.', '');
  else out.push(...view.blockers.map((library) => `- ${markdownCode(library.name)}: ${md(library.reason)}`), '');

  if (view.unknown.length > 0) {
    out.push('### Could not be decided', '');
    out.push(...view.unknown.map((library) => `- ${markdownCode(library.name)}: ${md(library.reason)}`), '');
  }

  out.push('### Framework requirements', '');
  if (hop.requirements.length === 0) {
    out.push('None found.', '');
  } else {
    const rows = hop.requirements.map((requirement) => [
      md(requirement.name),
      requirement.range.value === null ? factCell(requirement.range) : `${markdownCode(requirement.range.value, true)}${requirement.range.confidence === 'unverified' ? ' (unverified)' : ''}`,
      factCell(requirement.installed, 'not installed'),
      md(requirementStatusText(requirement)) + (requirement.flagged ? ' (action needed)' : ''),
      md(requirement.requiredBy),
    ]);
    out.push(...table(['Requirement', 'Required range', 'Installed', 'Status', 'Source'], rows), '');
  }

  out.push(...removedApiSection(plan, hop));

  out.push('### Effort', '');
  out.push(`${md(effortText(hop.effort))}: ${md(effortBreakdown(hop.effort))}.`, '');
  return out;
}

export function renderMarkdown(plan: UpgradePlan, meta: ReportMeta): string {
  const name = plan.project.name;
  const out: string[] = [`# Angular upgrade plan${name !== null ? ` for ${md(name)}` : ''}`, ''];
  out.push(`Generated by ng-upgrade-planner ${md(meta.toolVersion)}.`, '');

  const lockfile = plan.project.lockfile;
  const target = plan.target.angular.value !== null ? ` (${md(plan.target.angular.value)})` : '';
  out.push(
    ...table(
      ['Item', 'Value'],
      [
        ['Current Angular', factCell(plan.current.angular)],
        ['Target Angular', `${plan.target.major}${target}${plan.target.source === 'latest' ? ', latest release' : ''}`],
        ['Hops', String(plan.hops.length)],
        ['Total effort', plan.hops.length > 0 ? md(effortText(plan.effort)) : 'none'],
        ['Lockfile', lockfile !== null ? `${markdownCode(lockfile.file, true)} (${md(lockfile.kind)})` : 'none'],
        ['Source scan', md(scanStatusText(plan))],
      ],
    ),
    '',
  );

  if (plan.message !== null) out.push(md(plan.message), '');

  if (plan.project.warnings.length > 0) {
    out.push('## Project warnings', '', ...plan.project.warnings.map((warning) => `- ${md(warning)}`), '');
  }

  if (plan.hops.length > 0) {
    out.push('## Summary', '');
    const rows = plan.hops.map((hop, index) => {
      const view = hopView(hop);
      return [
        `${index + 1}. ${md(hopTitle(hop))}`,
        String(hop.steps.length),
        String(view.updates.length),
        String(view.blockers.length),
        String(view.unknown.length),
        String(view.warnings.length),
        String(hop.removedApis.length),
        md(effortText(hop.effort)),
      ];
    });
    out.push(
      ...table(['Hop', 'Steps', 'Library updates', 'Blockers', 'Unknown', 'Requirement warnings', 'Removed APIs', 'Effort'], rows),
      '',
    );
    out.push(md(STATUS_HELP), '');
    out.push([...scanNotes(plan), ...(plan.scan.status === 'ran' ? [REMOVED_API_HELP] : [])].map(md).join(' '), '');
    plan.hops.forEach((hop, index) => out.push(...hopSection(plan, hop, index)));
  }

  out.push('## Confirmed and unverified results', '');
  out.push('### Confirmed by evidence', '');
  out.push(...confirmedStatements(plan).map((line) => `- ${md(line)}`), '');
  out.push('### Could not be verified', '');
  const groups = unverifiedGroups(plan);
  if (groups.length === 0) {
    out.push('Nothing: every result above is backed by evidence.', '');
  } else {
    out.push(md(UNVERIFIED_INTRO), '');
    for (const group of groups) {
      out.push(`#### ${md(group.title)}`, '');
      out.push(...table(['Subject', 'Reason'], group.items.map((item) => [md(item.subject), md(item.reason)])), '');
    }
  }

  const guide = plan.updateGuide;
  const url = safeHttpsUrl(guide.url);
  const source = url !== null ? `[${md(url)}](${markdownUrl(url)})` : markdownCode(guide.url);
  out.push('---', '', `Update steps: Angular update guide data, ${md(guide.license)} licence, from ${source}.`, '');
  return out.join('\n');
}
