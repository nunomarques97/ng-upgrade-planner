import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { UpgradePlan } from '../../src/plan/types.js';
import { renderHtml, renderMarkdown, renderTerminal, shouldUseColor } from '../../src/report/index.js';
import { TERMINAL_FINDINGS_LIMIT } from '../../src/report/terminal.js';

const META = { toolVersion: '0.1.0' };

function sample(): UpgradePlan {
  return JSON.parse(readFileSync(new URL('./sample-plan.json', import.meta.url), 'utf8')) as UpgradePlan;
}

// Untrusted text as it could arrive from the registry, the project or the update guide data.
const SCRIPT = '<script>alert(1)</script>';
const JS_LINK = '[click](javascript:alert(1))';
const IMG = '<img src=x onerror=alert(1)>';
const ESC = '\u001b[31mRED\u001b[0m\u001b]8;;https://evil.example\u0007osc\u001b]8;;\u0007\u009b2J‮RTL';
const HOSTILE = `${SCRIPT} ${JS_LINK} ${IMG} a|b \`tick\`\` ${ESC}`;

/** The sample plan with hostile text in every field the reports print. */
function hostilePlan(): UpgradePlan {
  const plan = sample();
  plan.project.name = `app ${HOSTILE}`;
  plan.project.warnings.push(`warning ${HOSTILE}`);
  plan.unverified.push({ hop: null, subject: `subject ${HOSTILE}`, reason: `reason ${HOSTILE}` });
  const hop = plan.hops[0]!;
  const update = hop.libraries.find((library) => library.name === '@ngrx/store')!;
  update.name = `pkg ${HOSTILE}`;
  update.deprecated = `deprecated ${HOSTILE}`;
  update.peers[0]!.range = `^15.0.0 ${HOSTILE}`;
  const blocker = hop.libraries.find((library) => library.status === 'blocker')!;
  blocker.name = `blocked ${HOSTILE}`;
  blocker.reason = `reason ${HOSTILE}`;
  const step = hop.steps[0]!;
  step.title = `title ${HOSTILE}`;
  step.action = `Run ${HOSTILE} and read [the guide](https://angular.dev/update-guide) or [data](data:text/html,x) or [vb](vbscript:x) or [rel](/local)<br/>${IMG}`;
  hop.requirements[0]!.range.value = `>=4.8 ${HOSTILE}`;
  const finding = plan.hops[1]!.removedApis.find((item) => item.confidence === 'heuristic')!;
  finding.file = `src/${HOSTILE}.component.html`;
  finding.api = `pattern ${HOSTILE}`;
  finding.package = `@angular/${HOSTILE}`;
  finding.replacement = `replacement ${HOSTILE}`;
  finding.reason = `heuristic ${HOSTILE}`;
  plan.scan.unscanned.push({ file: `src/${HOSTILE}.ts`, reason: `unscanned ${HOSTILE}` });
  return plan;
}

/** Removes Markdown code spans and fenced blocks, whose content is literal text. */
function outsideCode(markdown: string): string {
  // A backslash-escaped backtick does not open a code span.
  return markdown.replace(/^```[\s\S]*?^```$/gm, '').replace(/(?<!\\)(`+)[\s\S]*?[^`]\1(?!`)/g, '');
}

describe('Markdown report', () => {
  it('has per-hop commands, grouped steps, library table, blockers, requirements and effort', () => {
    const md = renderMarkdown(sample(), META);
    expect(md).toContain('# Angular upgrade plan for demo-shop');
    for (const [index, title] of ['Angular 14 to 15', 'Angular 15 to 16', 'Angular 16 to 17'].entries()) {
      expect(md).toContain(`## Hop ${index + 1}: ${title}`);
    }
    expect(md).toContain('ng update @angular/core@15 @angular/cli@15\nng update @angular/material@15');
    expect(md).toContain('#### Basic (every app)');
    expect(md).toContain('#### Medium (apps using these features)');
    expect(md).toContain('#### Advanced (apps using these APIs)');
    expect(md).toContain('| Library | Current | Newest compatible | Peer range evidence | Status |');
    expect(md).toMatch(/\| `@ngrx\/store` \| 14\.3\.3 \| 15\.4\.0 \| 15\.4\.0: `@angular\/core` `\^15\.0\.0`: accepts 15\.2\.10 \| update \(major\) \|/);
    expect(md).toMatch(/### Blockers\n\n- `ngx-legacy-datepicker`: No release accepts Angular 15/);
    expect(md).toContain('| typescript | `>=4.8.2 <5.1` | 4.7.4 | not met (action needed) |');
    expect(md).toContain('### Effort');
    expect(md).toMatch(/L \(57 points\): base 2, steps \d+, major library updates 9, framework requirements 2, blockers 8, removed APIs 4\./);
  });

  it('lists removed-API findings per hop with location, API, replacement and migration', () => {
    const md = renderMarkdown(sample(), META);
    expect(md).toContain('| Source scan | 312 files, 8 findings |');
    expect(md).toContain('| Hop | Steps | Library updates | Blockers | Unknown | Requirement warnings | Removed APIs | Effort |');
    expect(md).toMatch(/\| 2\. Angular 15 to 16 \| \d+ \| \d+ \| \d+ \| \d+ \| \d+ \| 5 \| XL \(73 points\) \|/);
    expect(md).toContain('The removed-API scan checked 312 source files against the bundled data for Angular 9 to 22');
    expect(md).toContain('1 finding is for Angular 14 or earlier and not listed');
    expect(md).toContain('1 finding is for Angular versions after 17 and not part of this plan.');
    expect(md).toContain('### Removed or changed APIs\n\n5 uses of 4 APIs (4 confirmed, 1 heuristic).');
    expect(md).toContain('| Location | API | Change | Replacement | Fixed by ng update migration | Confidence |');
    expect(md).toContain(
      '| `src/app/admin/admin.module.ts:22` | `@NgModule entryComponents` from `@angular/core` | removed | none | no | confirmed |',
    );
    expect(md).toContain('| `angular.json:5` | `angular.json defaultProject` from `@angular/cli` |');
    expect(md).toMatch(/\| `src\/app\/checkout\/checkout\.component\.html:44` \| .* \| unknown \| heuristic \(unverified\): Matched by text/);
  });

  it('keeps heuristic findings and unscanned files under "could not be verified"', () => {
    const md = renderMarkdown(sample(), META);
    const confirmed = md.slice(md.indexOf('### Confirmed by evidence'), md.indexOf('### Could not be verified'));
    expect(confirmed).toContain('4 removed-API findings confirmed by imports or parsed configuration');
    expect(confirmed).toContain('Removed-API scan of 312 source files, against data for Angular 9 to 22');
    expect(confirmed).not.toContain('checkout.component.html');
    const rest = md.slice(md.indexOf('### Could not be verified'));
    expect(rest).toContain('| source src/app/generated/api-client.ts | not scanned: larger than 1024 kB, not read |');
    expect(rest).toContain('| removed API sampleLegacy template binding at src/app/checkout/checkout.component.html:44 | Matched by text');
  });

  it('says why a hop has no findings', () => {
    const off = sample();
    for (const hop of off.hops) hop.removedApis = [];
    off.scan = { ...off.scan, status: 'off', coverage: null, filesScanned: 0 };
    expect(renderMarkdown(off, META)).toContain('### Removed or changed APIs\n\nNot checked: the scan was turned off.');
    expect(renderMarkdown(off, META)).toContain('| Source scan | turned off |');
    const none = sample();
    none.hops[2]!.removedApis = [];
    expect(renderMarkdown(none, META)).toMatch(/## Hop 3[\s\S]*### Removed or changed APIs\n\nNone found\./);
    const empty = sample();
    for (const hop of empty.hops) hop.removedApis = [];
    empty.scan = { ...empty.scan, status: 'no-source-files', filesScanned: 0 };
    expect(renderMarkdown(empty, META)).toContain('Not checked: no source files were found.');
    const old = sample();
    old.scan.coverage = { firstMajor: 9, lastMajor: 15, retrieved: '2026-10-02' };
    old.hops[2]!.removedApis = [];
    expect(renderMarkdown(old, META)).toContain('Not checked: the bundled data covers Angular 9 to 15 only.');
  });

  it('separates confirmed results from what could not be verified', () => {
    const md = renderMarkdown(sample(), META);
    const confirmed = md.indexOf('### Confirmed by evidence');
    const unverified = md.indexOf('### Could not be verified');
    expect(confirmed).toBeGreaterThan(0);
    expect(unverified).toBeGreaterThan(confirmed);
    expect(md.slice(confirmed, unverified)).toContain('Installed Angular 14.2.12, read from the lockfile.');
    const rest = md.slice(unverified);
    expect(rest).toContain('| private-ui-kit | could not tell whether it depends on Angular');
    expect(rest).toContain('| registry data for ngx-toastr | registry data cached on 2026-06-14 could not be refreshed');
    expect(rest).toContain('| installed @ngx-translate/core | not resolved in a lockfile; lowest version allowed by "^14.0.0" |');
    expect(rest).toContain('| ngx-flex-grid | Could not check 2.0.0 against Angular 15');
  });

  it('neutralises HTML, links, pipes and escape sequences from untrusted text', () => {
    const md = renderMarkdown(hostilePlan(), META);
    // eslint-disable-next-line no-control-regex
    expect(md).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/);
    const prose = outsideCode(md);
    // Raw HTML: the only tag left is the line break the renderer adds.
    expect(prose.replace(/<br>/g, '')).not.toMatch(/(?<!\\)</);
    // Every link that survives points to https.
    const links = [...prose.matchAll(/(?<!\\)\[(?:\\.|[^\]\\])*\]\(([^)]*)\)/g)].map((match) => match[1]!);
    expect(links.length).toBeGreaterThan(0);
    for (const target of links) expect(target).toMatch(/^https:\/\//);
    expect(md).toContain('[the guide](https://angular.dev/update-guide)');
    expect(prose).not.toMatch(/(?<!\\)\]\((?:javascript|data|vbscript):/i);
    expect(md).toContain('\\<script\\>alert(1)\\</script\\>');
    expect(md).toContain('\\[click\\](javascript:alert(1))');
    // Table rows keep their column count: pipes in cells are escaped, also inside code spans.
    const lines = md.split('\n');
    lines.forEach((line, index) => {
      if (!line.startsWith('| ') || lines[index + 1]?.startsWith('| ---') !== true) return;
      const columns = (line.match(/(?<!\\)\|/g) ?? []).length;
      for (let row = index + 2; lines[row]?.startsWith('| '); row++) {
        expect((lines[row]!.match(/(?<!\\)\|/g) ?? []).length, lines[row]).toBe(columns);
      }
    });
    // A code span holding backticks uses a longer fence, so it cannot close early.
    expect(md).toContain('```pkg <script>alert(1)</script> [click](javascript:alert(1)) <img src=x onerror=alert(1)> a\\|b `tick`` REDoscRTL```');
  });
});

describe('HTML report', () => {
  it('is one self-contained document with no scripts or external requests', () => {
    const html = renderHtml(sample(), META);
    expect(html.startsWith('<!doctype html>\n<html lang="en">')).toBe(true);
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'`);
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).not.toMatch(/<script|<link|<img|<iframe|<object|<embed|\ssrc=|@import|url\(/i);
    expect(html).toMatch(/@media \(prefers-color-scheme: dark\)/);
    for (const [, href] of html.matchAll(/href="([^"]*)"/g)) expect(href).toMatch(/^(?:https:\/\/|#hop-\d+$)/);
  });

  it('uses semantic headings, table headers and scroll containers for every table', () => {
    const html = renderHtml(sample(), META);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<h2 id="hop-15-title">Hop 1: Angular 14 to 15</h2>');
    expect(html).toContain('<section id="evidence" aria-labelledby="evidence-title">');
    const tables = html.match(/<table>/g)?.length ?? 0;
    expect(tables).toBeGreaterThan(3);
    expect(html.match(/<div class="table-wrap"><table><caption>/g)).toHaveLength(tables);
    expect(html.match(/<thead><tr><th scope="col">/g)).toHaveLength(tables);
    expect(html).toMatch(/\.table-wrap \{ overflow-x: auto;/);
    expect(html).toContain('<th scope="row"><code>ngx-legacy-datepicker</code></th>');
    expect(html).toContain('<span class="badge bad">blocker</span>');
    expect(html).toContain('<h3>Confirmed by evidence</h3>');
    expect(html).toContain('<h3>Could not be verified</h3>');
    expect(html).toContain('<h3 id="hop-16-removed-apis">Removed or changed APIs</h3>');
    expect(html).toContain('<caption>Removed or changed APIs to fix in the hop to Angular 16</caption>');
    expect(html).toContain(
      '<tr><th scope="row"><code>src/app/admin/admin.module.ts:22</code></th><td><code>@NgModule entryComponents</code><div class="note">@angular/core, removed</div></td><td>none</td><td><span class="badge bad">no</span></td><td><span class="badge ok">confirmed</span></td></tr>',
    );
    expect(html).toContain('<span class="badge ok">yes</span>');
    expect(html).toMatch(/<td><span class="badge warn">heuristic<\/span> <span class="tag">unverified<\/span><\/td><\/tr>/);
    expect(html).toContain('<tr><th scope="row">removed API sampleLegacy template binding at src/app/checkout/checkout.component.html:44</th><td>Matched by text');
    expect(html).toContain('<div><dt>Source scan</dt><dd>312 files, 8 findings</dd></div>');
  });

  it('escapes untrusted text and keeps only https links', () => {
    const html = renderHtml(hostilePlan(), META);
    expect(html).not.toMatch(/<script|<img|onerror=alert\(1\)>/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toMatch(/<[^>]*\son\w+\s*=/i);
    for (const [, href] of html.matchAll(/href="([^"]*)"/g)) expect(href).toMatch(/^(?:https:\/\/|#hop-\d+$)/);
    expect(html).toContain('<a href="https://angular.dev/update-guide" rel="noopener noreferrer">the guide</a>');
    expect(html).toContain('<th scope="row"><code>src/&lt;script&gt;alert(1)&lt;/script&gt; [click](javascript:alert(1))');
    expect(html).toContain('<td>replacement &lt;script&gt;');
    expect(html).toContain('[click](javascript:alert(1))');
    expect(html).toContain('data (data:text/html,x)');
    // eslint-disable-next-line no-control-regex
    expect(html).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/);
    expect(html).toContain('<title>Angular upgrade plan for app &lt;script&gt;');
  });
});

describe('terminal summary', () => {
  const reports = ['/work/ng-upgrade-plan.md', '/work/ng-upgrade-plan.html'];

  it('shows versions, one block per hop and the report paths', () => {
    const text = renderTerminal(sample(), { color: false, reports });
    expect(text).toContain('Current: Angular 14.2.12\n');
    expect(text).toContain('Target:  Angular 17 (17.3.12)\n');
    expect(text).toMatch(/Total effort: L \(184 points\) over 3 hops, 3 blockers/);
    expect(text).toContain('Source scan: 312 files, 8 findings\n');
    expect(text).toContain('Hop 1: Angular 14 to 15 (15.2.10), effort L (57 points)\n  Steps: 21 (11 basic, 8 medium, 2 advanced)\n  Library updates: 3\n');
    expect(text).toContain(
      '  Removed APIs: 5 uses of 4 APIs (4 confirmed, 1 heuristic)\n    angular.json:5 angular.json defaultProject (@angular/cli); replacement: ',
    );
    expect(text).toContain(
      '    src/app/admin/admin.module.ts:22 @NgModule entryComponents (@angular/core); replacement: none; fixed by ng update migration: no\n',
    );
    expect(text).toMatch(/src\/app\/checkout\/checkout\.component\.html:44 .*; fixed by ng update migration: unknown \(heuristic, unverified\)\n/);
    expect(text).toContain('    @ngrx/store 14.3.3 to 15.4.0, major\n');
    expect(text).toContain('  Blockers: 1\n    ngx-legacy-datepicker: No release accepts Angular 15');
    expect(text).toContain('  Could not decide: ngx-flex-grid\n');
    expect(text).toContain('  Framework requirements:\n    typescript must satisfy ">=4.8.2 <5.1"');
    expect(text).toContain('node must satisfy "^18.13.0 || ^20.9.0" (@angular/core@17.3.12 engines); 16.20.2 is installed');
    expect(text).toContain('Reports:\n  /work/ng-upgrade-plan.md\n  /work/ng-upgrade-plan.html\n');
    expect(text).not.toContain('\u001b');
    expect(text).not.toMatch(/—/);
  });

  it('lists at most a fixed number of findings per hop', () => {
    const plan = sample();
    const hop = plan.hops[0]!;
    const first = hop.removedApis[0]!;
    hop.removedApis = Array.from({ length: TERMINAL_FINDINGS_LIMIT + 3 }, (_, index) => ({ ...first, line: index + 1 }));
    const text = renderTerminal(plan, { color: false, reports });
    const block = text.slice(text.indexOf('Hop 1:'), text.indexOf('Hop 2:'));
    expect(block.match(/; fixed by ng update migration: /g)).toHaveLength(TERMINAL_FINDINGS_LIMIT);
    expect(block).toContain('    and 3 more (listed in the reports)\n');
    expect(renderTerminal(plan, { color: false, reports: null })).toContain('    and 3 more (write the reports to see them)\n');
  });

  it('says when the scan was turned off or found no source', () => {
    const plan = sample();
    for (const hop of plan.hops) hop.removedApis = [];
    plan.scan = { ...plan.scan, status: 'off', coverage: null };
    const text = renderTerminal(plan, { color: false, reports });
    expect(text).toContain('Source scan: turned off (--no-scan)\n');
    expect(text).toContain('  Removed APIs: Not checked: the scan was turned off.\n');
    plan.scan = { ...plan.scan, status: 'no-source-files', filesScanned: 0 };
    expect(renderTerminal(plan, { color: false, reports })).toContain('Source scan: no source files found\n');
  });

  it('says when reports were not written', () => {
    expect(renderTerminal(sample(), { color: false, reports: null })).toContain('Reports: not written (--no-report).');
  });

  it('adds colour codes only when asked to', () => {
    const coloured = renderTerminal(sample(), { color: true, reports });
    expect(coloured).toContain('\u001b[1mHop 1: Angular 14 to 15\u001b[22m');
    expect(coloured).toContain('\u001b[31mngx-legacy-datepicker\u001b[39m');
  });

  it('strips escape sequences and control characters from untrusted text, with and without colour', () => {
    for (const color of [false, true]) {
      const text = renderTerminal(hostilePlan(), { color, reports });
      // Only the renderer's own SGR colour codes may remain.
      // eslint-disable-next-line no-control-regex
      const withoutOwnCodes = text.replace(/\u001b\[(?:1|2|22|31|32|33|39)m/g, '');
      // eslint-disable-next-line no-control-regex
      expect(withoutOwnCodes).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/);
      expect(withoutOwnCodes).toContain('pkg <script>alert(1)</script> [click](javascript:alert(1))');
      expect(withoutOwnCodes).toContain('REDoscRTL');
      expect(withoutOwnCodes).toContain('src/<script>alert(1)</script> [click](javascript:alert(1))');
    }
  });
});

describe('shouldUseColor', () => {
  it('honours NO_COLOR, TERM=dumb and non-TTY output', () => {
    expect(shouldUseColor({ isTTY: true }, {})).toBe(true);
    expect(shouldUseColor({ isTTY: true }, { NO_COLOR: '1' })).toBe(false);
    expect(shouldUseColor({ isTTY: true }, { NO_COLOR: '' })).toBe(true);
    expect(shouldUseColor({ isTTY: true }, { TERM: 'dumb' })).toBe(false);
    expect(shouldUseColor({ isTTY: false }, {})).toBe(false);
    expect(shouldUseColor({}, {})).toBe(false);
  });
});

describe('a plan with nothing to do', () => {
  it('prints the message in every format', () => {
    const plan = sample();
    plan.hops = [];
    plan.unverified = plan.unverified.filter((item) => item.hop === null);
    plan.message = 'The project is already on Angular 17 (17.3.12), the target version. There is nothing to plan.';
    expect(renderTerminal(plan, { color: false, reports: null })).toContain(plan.message);
    const md = renderMarkdown(plan, META);
    expect(md).toContain(plan.message);
    expect(md).not.toContain('## Summary');
    expect(renderHtml(plan, META)).toContain(plan.message);
  });
});
