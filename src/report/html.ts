// Single-file HTML report: inline CSS, no scripts and no external resources. A Content Security
// Policy blocks scripts and remote loads as a second line of defence; every plan string is
// escaped with escapeHtml and step text keeps only code spans, line breaks and https links.
import type { Confidence, Fact, Hop, LibraryHopResult, RemovedApiFinding, Requirement, UpgradePlan } from '../plan/types.js';
import type { ReportMeta } from './markdown.js';
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
  hopAnchor,
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
import { escapeHtml as h, safeHttpsUrl, stepHtml } from './text.js';

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

const CSS = `
:root {
  color-scheme: light dark;
  --bg: #ffffff; --fg: #1c2128; --muted: #59636e; --border: #d1d9e0; --surface: #f6f8fa; --accent: #0a58ca;
  --ok-bg: #dcfce7; --ok-fg: #166534; --info-bg: #dbeafe; --info-fg: #1e40af;
  --warn-bg: #fef3c7; --warn-fg: #854d0e; --bad-bg: #fee2e2; --bad-fg: #991b1b;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1419; --fg: #e6edf3; --muted: #9aa5b1; --border: #333c47; --surface: #171d24; --accent: #6cb6ff;
    --ok-bg: #12301f; --ok-fg: #7ee2a8; --info-bg: #132a4a; --info-fg: #9cc7ff;
    --warn-bg: #3a2c0b; --warn-fg: #f5d27a; --bad-bg: #401717; --bad-fg: #ffaaa5;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1120px; margin: 0 auto; padding: 32px 28px 64px; }
h1 { font-size: 1.8rem; line-height: 1.25; margin: 0 0 4px; overflow-wrap: anywhere; }
h2 { font-size: 1.4rem; line-height: 1.3; margin: 44px 0 12px; padding-top: 20px; border-top: 1px solid var(--border); overflow-wrap: anywhere; }
h3 { font-size: 1.12rem; margin: 26px 0 8px; }
h4 { font-size: 1rem; margin: 18px 0 6px; color: var(--muted); }
p, li, dd { overflow-wrap: anywhere; }
a { color: var(--accent); }
code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; font-size: 0.9em; }
p code, li code { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; }
pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; overflow-x: auto; margin: 8px 0 16px; }
.lead { color: var(--muted); margin: 0 0 20px; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 0 0 20px; padding: 0; }
.facts div { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; min-width: 0; }
.facts dt { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.facts dd { margin: 2px 0 0; font-size: 1.1rem; font-weight: 600; }
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; margin: 8px 0 18px; }
table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
caption { text-align: left; padding: 8px 12px; color: var(--muted); font-size: 0.85rem; }
th, td { text-align: left; vertical-align: top; padding: 8px 12px; border-top: 1px solid var(--border); }
thead th { background: var(--surface); white-space: nowrap; }
td code { white-space: nowrap; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.peers { margin: 0; padding: 0; list-style: none; }
.peers li { white-space: nowrap; overflow-wrap: normal; }
.badge { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
.ok { background: var(--ok-bg); color: var(--ok-fg); }
.info { background: var(--info-bg); color: var(--info-fg); }
.warn { background: var(--warn-bg); color: var(--warn-fg); }
.bad { background: var(--bad-bg); color: var(--bad-fg); }
.tag { font-size: 0.78rem; color: var(--warn-fg); white-space: nowrap; }
.note { color: var(--muted); font-size: 0.9rem; }
.callout { border: 1px solid var(--border); border-left: 4px solid var(--warn-fg); border-radius: 8px; padding: 10px 14px; background: var(--surface); }
ol.steps, ul.plain { padding-left: 1.4em; }
ol.steps li { margin: 8px 0; }
.step-title { font-weight: 600; }
.nowrap { white-space: nowrap; }
.hop-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 0 0 8px; color: var(--muted); }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; overflow-wrap: anywhere; }
@media (max-width: 640px) {
  main { padding: 20px 16px 48px; }
  h1 { font-size: 1.45rem; }
  h2 { font-size: 1.2rem; }
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .facts dd { font-size: 1rem; }
}
`;

function tableHtml(headers: string[], rows: string[][], caption: string, numeric: number[] = []): string {
  const head = headers.map((header) => `<th scope="col">${h(header)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) =>
            index === 0 ? `<th scope="row">${cell}</th>` : `<td${numeric.includes(index) ? ' class="num"' : ''}>${cell}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('\n');
  return `<div class="table-wrap"><table><caption>${h(caption)}</caption><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}

function unverifiedTag(value: { confidence: Confidence }): string {
  return value.confidence === 'unverified' ? ` <span class="tag">unverified</span>` : '';
}

function factHtml(value: Fact<string | null>, fallback = 'unknown'): string {
  return `${h(factValue(value, fallback))}${unverifiedTag(value)}`;
}

function badge(text: string, tone: 'ok' | 'info' | 'warn' | 'bad'): string {
  return `<span class="badge ${tone}">${h(text)}</span>`;
}

function libraryBadge(library: LibraryHopResult): string {
  const text = libraryStatusText(library);
  if (library.status === 'blocker') return badge(text, 'bad');
  if (library.status === 'unknown') return badge(text, 'warn');
  return badge(text, text === 'no change needed' ? 'ok' : 'info');
}

function requirementBadge(requirement: Requirement): string {
  const text = requirementStatusText(requirement);
  if (requirement.status === 'met') return badge(text, 'ok');
  if (requirement.status === 'unknown') return badge(text, 'warn');
  return badge(text, requirement.flagged ? 'bad' : 'warn');
}

function peerCell(library: LibraryHopResult): string {
  const { version, peers } = peerEvidence(library);
  if (peers.length === 0) return 'none';
  const items = peers
    .map((peer) => `<li><code>${h(peer.name)}</code> <code>${h(peer.range)}</code> ${h(peerCheckText(peer))}</li>`)
    .join('');
  return `${version !== null ? `<div>${h(version)}:</div>` : ''}<ul class="peers">${items}</ul>`;
}

function findingRow(finding: RemovedApiFinding): string[] {
  const migration = badge(finding.migration, finding.migration === 'yes' ? 'ok' : finding.migration === 'no' ? 'bad' : 'warn');
  // The reason of a heuristic finding is listed under "Could not be verified", which keeps the table narrow.
  const confidence =
    finding.confidence === 'heuristic' ? `${badge('heuristic', 'warn')} <span class="tag">unverified</span>` : badge('confirmed', 'ok');
  return [
    `<code>${h(findingLocation(finding))}</code>`,
    `<code>${h(finding.api)}</code><div class="note">${h(finding.package)}, ${h(finding.change)}</div>`,
    h(finding.replacement),
    migration,
    confidence,
  ];
}

function removedApiSection(plan: UpgradePlan, hop: Hop): string {
  const out: string[] = [`<h3 id="${hopAnchor(hop)}-removed-apis">Removed or changed APIs</h3>`];
  const empty = removedApiEmptyText(plan, hop);
  if (empty !== null) {
    out.push(`<p>${h(empty)}</p>`);
  } else {
    out.push(`<p>${h(removedApiCountText(hop))}.</p>`);
    out.push(
      tableHtml(
        ['Location', 'API', 'Replacement', 'Fixed by ng update migration', 'Confidence'],
        hop.removedApis.map(findingRow),
        `Removed or changed APIs to fix in the hop to Angular ${hop.to}`,
      ),
    );
  }
  return out.join('\n');
}

function hopSection(plan: UpgradePlan, hop: Hop, index: number): string {
  const view = hopView(hop);
  const out: string[] = [`<section id="${hopAnchor(hop)}" aria-labelledby="${hopAnchor(hop)}-title">`];
  out.push(`<h2 id="${hopAnchor(hop)}-title">Hop ${index + 1}: ${h(hopTitle(hop))}</h2>`);
  out.push(
    `<p class="hop-meta"><span>Target release: ${factHtml(hop.angular)}</span><span>Effort: ${badge(effortText(hop.effort), hop.effort.label === 'S' ? 'ok' : hop.effort.label === 'M' ? 'info' : 'warn')}</span><span>${view.blockers.length} blocker${view.blockers.length === 1 ? '' : 's'}</span></p>`,
  );

  out.push('<h3>Update command</h3>');
  if (hop.commands.length > 0) out.push(`<pre><code>${hop.commands.map(h).join('\n')}</code></pre>`);
  if (hop.commandNote !== null) out.push(`<p>${h(hop.commandNote)}</p>`);

  out.push(`<h3>Official update steps: ${h(stepCountText(hop))}</h3>`);
  if (hop.stepsNote !== null) out.push(`<p class="callout">${h(hop.stepsNote)}</p>`);
  for (const level of LEVELS) {
    const steps = view.steps[level];
    if (steps.length === 0) continue;
    out.push(`<h4>${h(LEVEL_TITLES[level])}</h4>`, '<ol class="steps">');
    for (const step of steps) {
      const audience = step.appliesTo === 'all' ? '' : `, ${h(step.appliesTo)} only`;
      out.push(
        `<li><span class="step-title">${h(step.title)}</span> <span class="note">(required from ${h(step.necessaryAsOf)}${audience})</span><br>${stepHtml(step.action)}</li>`,
      );
    }
    out.push('</ol>');
  }

  out.push(`<h3 id="${hopAnchor(hop)}-libraries">Libraries</h3>`);
  if (hop.libraries.length === 0) {
    out.push('<p>No Angular-dependent third-party libraries found.</p>');
  } else {
    const rows = hop.libraries.map((library) => {
      let status = libraryBadge(library);
      if (library.deprecated !== null) status += `<div class="note">Deprecated: ${h(library.deprecated)}</div>`;
      if (library.confidence === 'unverified' && library.status !== 'unknown') status += `<div>${unverifiedTag(library)}</div>`;
      return [`<code>${h(library.name)}</code>`, factHtml(library.from), factHtml(library.newestCompatible, 'none'), peerCell(library), status];
    });
    out.push(
      tableHtml(
        ['Library', 'Current', 'Newest compatible', 'Peer range evidence', 'Status'],
        rows,
        `Angular-dependent libraries for the hop to Angular ${hop.to}`,
      ),
    );
  }

  out.push('<h3>Blockers</h3>');
  if (view.blockers.length === 0) out.push('<p>None.</p>');
  else out.push(`<ul class="plain">${view.blockers.map((library) => `<li><code>${h(library.name)}</code>: ${h(library.reason)}</li>`).join('')}</ul>`);

  if (view.unknown.length > 0) {
    out.push('<h3>Could not be decided</h3>');
    out.push(`<ul class="plain">${view.unknown.map((library) => `<li><code>${h(library.name)}</code>: ${h(library.reason)}</li>`).join('')}</ul>`);
  }

  out.push('<h3>Framework requirements</h3>');
  if (hop.requirements.length === 0) {
    out.push('<p>None found.</p>');
  } else {
    const rows = hop.requirements.map((requirement) => [
      h(requirement.name),
      requirement.range.value === null ? factHtml(requirement.range) : `<code>${h(requirement.range.value)}</code>${unverifiedTag(requirement.range)}`,
      factHtml(requirement.installed, 'not installed'),
      requirementBadge(requirement) + (requirement.flagged ? ' <span class="tag">action needed</span>' : ''),
      h(requirement.requiredBy),
    ]);
    out.push(
      tableHtml(['Requirement', 'Required range', 'Installed', 'Status', 'Source'], rows, `Framework requirements of Angular ${hop.to}`),
    );
  }

  out.push(removedApiSection(plan, hop));

  out.push('<h3>Effort</h3>');
  out.push(`<p>${h(effortText(hop.effort))}: ${h(effortBreakdown(hop.effort))}.</p>`);
  out.push('</section>');
  return out.join('\n');
}

export function renderHtml(plan: UpgradePlan, meta: ReportMeta): string {
  const name = plan.project.name;
  const title = `Angular upgrade plan${name !== null ? ` for ${name}` : ''}`;
  const body: string[] = ['<main>', '<header>', `<h1>${h(title)}</h1>`];
  body.push(`<p class="lead">Generated by ng-upgrade-planner ${h(meta.toolVersion)}.</p>`);

  const lockfile = plan.project.lockfile;
  const target = `${plan.target.major}${plan.target.angular.value !== null ? ` (${plan.target.angular.value})` : ''}`;
  const facts: [string, string][] = [
    ['Current Angular', factHtml(plan.current.angular)],
    ['Target Angular', `${h(target)}${plan.target.source === 'latest' ? ' <span class="note">latest</span>' : ''}`],
    ['Hops', String(plan.hops.length)],
    ['Total effort', plan.hops.length > 0 ? h(effortText(plan.effort)) : 'none'],
    ['Lockfile', lockfile !== null ? `${h(lockfile.file)} <span class="note">${h(lockfile.kind)}</span>` : 'none'],
    ['Source scan', h(scanStatusText(plan))],
  ];
  body.push(`<dl class="facts">${facts.map(([label, value]) => `<div><dt>${h(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`);
  body.push('</header>');

  if (plan.message !== null) body.push(`<p class="callout">${h(plan.message)}</p>`);

  if (plan.project.warnings.length > 0) {
    body.push('<h2>Project warnings</h2>', `<ul class="plain">${plan.project.warnings.map((warning) => `<li>${h(warning)}</li>`).join('')}</ul>`);
  }

  if (plan.hops.length > 0) {
    body.push('<h2>Summary</h2>');
    const rows = plan.hops.map((hop, index) => {
      const view = hopView(hop);
      return [
        `<a class="nowrap" href="#${hopAnchor(hop)}">${index + 1}. ${h(hopTitle(hop))}</a>`,
        String(hop.steps.length),
        String(view.updates.length),
        view.blockers.length > 0 ? badge(String(view.blockers.length), 'bad') : '0',
        String(view.unknown.length),
        String(view.warnings.length),
        String(hop.removedApis.length),
        h(effortText(hop.effort)),
      ];
    });
    body.push(
      tableHtml(
        ['Hop', 'Steps', 'Library updates', 'Blockers', 'Unknown', 'Requirement warnings', 'Removed APIs', 'Effort'],
        rows,
        'Work per hop',
        [1, 2, 3, 4, 5, 6],
      ),
    );
    body.push(`<p class="note">${h(STATUS_HELP)}</p>`);
    body.push(`<p class="note">${[...scanNotes(plan), ...(plan.scan.status === 'ran' ? [REMOVED_API_HELP] : [])].map(h).join(' ')}</p>`);
    plan.hops.forEach((hop, index) => body.push(hopSection(plan, hop, index)));
  }

  body.push('<section id="evidence" aria-labelledby="evidence-title">', '<h2 id="evidence-title">Confirmed and unverified results</h2>');
  body.push('<h3>Confirmed by evidence</h3>');
  body.push(`<ul class="plain">${confirmedStatements(plan).map((line) => `<li>${h(line)}</li>`).join('')}</ul>`);
  body.push('<h3>Could not be verified</h3>');
  const groups = unverifiedGroups(plan);
  if (groups.length === 0) {
    body.push('<p>Nothing: every result above is backed by evidence.</p>');
  } else {
    body.push(`<p class="callout">${h(UNVERIFIED_INTRO)}</p>`);
    for (const group of groups) {
      body.push(`<h4>${h(group.title)}</h4>`);
      body.push(
        tableHtml(['Subject', 'Reason'], group.items.map((item) => [h(item.subject), h(item.reason)]), `Unverified: ${group.title}`),
      );
    }
  }
  body.push('</section>');

  const guide = plan.updateGuide;
  const url = safeHttpsUrl(guide.url);
  const source = url !== null ? `<a href="${h(url)}" rel="noopener noreferrer">${h(url)}</a>` : `<code>${h(guide.url)}</code>`;
  body.push(`<footer>Update steps: Angular update guide data, ${h(guide.license)} licence, from ${source}.</footer>`);
  body.push('</main>');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    '<meta name="color-scheme" content="light dark">',
    `<title>${h(title)}</title>`,
    `<style>${CSS}</style>`,
    '</head>',
    '<body>',
    ...body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
