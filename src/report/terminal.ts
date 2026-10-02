// Terminal summary. Every plan string goes through cleanText, which strips ANSI escape sequences
// and control characters, so registry or project data cannot move the cursor, change colours or
// rewrite earlier lines. The only escape codes in the output are the colours added here, and only
// when colour is enabled.
import type { UpgradePlan } from '../plan/types.js';
import {
  effortText,
  findingLocation,
  hopTitle,
  hopView,
  libraryUpdateText,
  migrationText,
  plural,
  removedApiCountText,
  removedApiEmptyText,
  requirementWarning,
  scanStatusText,
  stepCountText,
} from './model.js';
import { cleanText as t } from './text.js';

/** Removed-API findings listed per hop; the reports list all of them. */
export const TERMINAL_FINDINGS_LIMIT = 10;

export interface TerminalOptions {
  color: boolean;
  /** Paths of the reports written, or null when reports were turned off. */
  reports: readonly string[] | null;
}

type Style = 'bold' | 'red' | 'yellow' | 'green' | 'dim';
const CODES: Readonly<Record<Style, [number, number]>> = {
  bold: [1, 22],
  red: [31, 39],
  yellow: [33, 39],
  green: [32, 39],
  dim: [2, 22],
};

/**
 * Colour is used only on a terminal, and never when NO_COLOR is set to a non-empty value
 * (https://no-color.org) or TERM is "dumb".
 */
export function shouldUseColor(stream: { isTTY?: boolean }, env: NodeJS.ProcessEnv): boolean {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.TERM === 'dumb') return false;
  return stream.isTTY === true;
}

export function renderTerminal(plan: UpgradePlan, options: TerminalOptions): string {
  const paint = (style: Style, text: string): string => {
    if (!options.color) return text;
    const [open, close] = CODES[style];
    return `\u001b[${open}m${text}\u001b[${close}m`;
  };
  const lines: string[] = [];
  const name = plan.project.name;
  lines.push(paint('bold', `Angular upgrade plan${name !== null ? ` for ${t(name)}` : ''}`));

  const current = plan.current.angular;
  lines.push(`Current: Angular ${t(current.value)}${current.confidence === 'unverified' ? ' (unverified, no lockfile entry)' : ''}`);
  const details = [plan.target.angular.value, plan.target.source === 'latest' ? 'latest release' : null].filter(
    (detail): detail is string => detail !== null,
  );
  lines.push(`Target:  Angular ${plan.target.major}${details.length > 0 ? ` (${t(details.join(', '))})` : ''}`);
  if (plan.hops.length > 0) lines.push(`Source scan: ${t(scanStatusText(plan))}${plan.scan.status === 'off' ? ' (--no-scan)' : ''}`);
  for (const warning of plan.project.warnings) lines.push(paint('yellow', `Warning: ${t(warning)}`));

  if (plan.message !== null) {
    lines.push('', t(plan.message));
  } else {
    const blockers = plan.hops.reduce((sum, hop) => sum + hopView(hop).blockers.length, 0);
    const blockerText = blockers > 0 ? paint('red', `${blockers} ${plural(blockers, 'blocker', 'blockers')}`) : 'no blockers';
    lines.push(
      `Total effort: ${paint('bold', effortText(plan.effort))} over ${plan.hops.length} ${plural(plan.hops.length, 'hop', 'hops')}, ${blockerText}`,
    );
  }

  plan.hops.forEach((hop, index) => {
    const view = hopView(hop);
    lines.push('');
    const release = hop.angular.value !== null ? ` (${t(hop.angular.value)})` : '';
    lines.push(`${paint('bold', `Hop ${index + 1}: ${hopTitle(hop)}`)}${release}, effort ${paint('bold', effortText(hop.effort))}`);
    lines.push(`  Steps: ${stepCountText(hop)}${hop.stepCoverage === 'not-covered' ? paint('yellow', ' (not covered by the bundled update guide data)') : ''}`);

    lines.push(`  Library updates: ${view.updates.length}`);
    for (const library of view.updates) {
      const deprecated = library.deprecated !== null ? paint('yellow', ` (deprecated: ${t(library.deprecated)})`) : '';
      lines.push(`    ${t(libraryUpdateText(library))}${deprecated}`);
    }

    const blockerCount = `${view.blockers.length}`;
    lines.push(`  Blockers: ${view.blockers.length > 0 ? paint('red', blockerCount) : blockerCount}`);
    for (const library of view.blockers) lines.push(`    ${paint('red', t(library.name))}: ${t(library.reason)}`);

    if (view.unknown.length > 0) {
      lines.push(`  Could not decide: ${view.unknown.map((library) => t(library.name)).join(', ')}`);
    }

    if (view.warnings.length > 0) {
      lines.push('  Framework requirements:');
      for (const requirement of view.warnings) lines.push(`    ${paint('yellow', t(requirementWarning(requirement)))}`);
    }

    const empty = removedApiEmptyText(plan, hop);
    if (empty !== null) {
      lines.push(`  Removed APIs: ${t(empty)}`);
    } else {
      lines.push(`  Removed APIs: ${t(removedApiCountText(hop))}`);
      for (const finding of hop.removedApis.slice(0, TERMINAL_FINDINGS_LIMIT)) {
        const heuristic = finding.confidence === 'heuristic' ? paint('yellow', ' (heuristic, unverified)') : '';
        lines.push(
          `    ${t(findingLocation(finding))} ${t(finding.api)} (${t(finding.package)}); replacement: ${t(finding.replacement)}; ${t(migrationText(finding))}${heuristic}`,
        );
      }
      const more = hop.removedApis.length - TERMINAL_FINDINGS_LIMIT;
      if (more > 0) {
        const where = options.reports === null ? 'write the reports to see them' : 'listed in the reports';
        lines.push(`    and ${more} more (${where})`);
      }
    }
  });

  lines.push('');
  const unverified = plan.unverified.length;
  if (unverified > 0) {
    const where = options.reports === null ? 'write the reports to see them' : 'listed in the reports';
    lines.push(paint('yellow', `Could not be verified: ${unverified} ${plural(unverified, 'item', 'items')} (${where}).`));
  } else {
    lines.push(paint('green', 'Every result is backed by evidence.'));
  }

  if (options.reports === null) {
    lines.push('Reports: not written (--no-report).');
  } else {
    lines.push('Reports:');
    for (const file of options.reports) lines.push(`  ${t(file)}`);
  }
  return `${lines.join('\n')}\n`;
}
