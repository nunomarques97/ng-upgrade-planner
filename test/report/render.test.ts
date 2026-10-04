import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { UpgradePlan } from '../../src/plan/types.js';
import { renderHtml, renderMarkdown, renderTerminal, shouldUseColor } from '../../src/report/index.js';
import { TERMINAL_FINDINGS_LIMIT } from '../../src/report/terminal.js';

const META = { toolVersion: '0.1.0' };

function sample(): UpgradePlan {
  return JSON.parse(readFileSync(new URL('./sample-plan.json', import.meta.url), 'utf8')) as UpgradePlan;
}

/** The sample with its RxJS findings as required work in the hop to 16, as when that hop accepts no RxJS 6. */
function rxjsForced(): UpgradePlan {
  const plan = sample();
  plan.hops[1]!.rxjs = plan.scan.rxjs.advisory;
  plan.scan.rxjs = { ...plan.scan.rxjs, status: 'required', forcedBy: 16, advisory: [] };
  return plan;
}

/** The sample with rxjs 7 installed: the RxJS findings are counted, not listed. */
function rxjsNotApplicable(): UpgradePlan {
  const plan = sample();
  plan.scan.rxjs = {
    ...plan.scan.rxjs,
    installed: '7.8.1',
    status: 'not-applicable',
    reason: 'the installed rxjs 7.8.1 is already RxJS 7 or later, so RxJS 7 breaking changes are not shown',
    advisory: [],
  };
  return plan;
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
  const warning = plan.hops[1]!.deprecations.find((item) => item.confidence === 'heuristic')!;
  warning.file = `src/${HOSTILE}.warn.html`;
  warning.api = `deprecated ${HOSTILE}`;
  warning.package = `@angular/${HOSTILE}`;
  warning.replacement = `use ${HOSTILE}`;
  warning.reason = `heuristic ${HOSTILE}`;
  plan.scan.unscanned.push({ file: `src/${HOSTILE}.ts`, reason: `unscanned ${HOSTILE}` });
  // engines.node and its reasons come from the project's package.json.
  plan.toolchain.engines.value = `>=18 ${HOSTILE}`;
  plan.toolchain.localNode.value = `22 ${HOSTILE}`;
  hop.toolchain.node.project.value = `>=18 ${HOSTILE}`;
  hop.toolchain.node.reason = `engines ${HOSTILE}`;
  hop.toolchain.node.status = 'blocker';
  hop.toolchain.typescript.range.value = `>=5 ${HOSTILE}`;
  hop.toolchain.typescript.requiredBy = [`compiler ${HOSTILE}`];
  const rxjs = plan.scan.rxjs.advisory[0]!;
  rxjs.file = `src/${HOSTILE}.rx.ts`;
  rxjs.api = `rxjs api ${HOSTILE}`;
  rxjs.package = `rxjs/${HOSTILE}`;
  rxjs.replacement = `rx replacement ${HOSTILE}`;
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
    expect(md).toContain('| zone.js | `~0.13.0` | 0.11.8 | not met (action needed) |');
    expect(md).not.toMatch(/^\| (typescript|node) \|/m);
    expect(md).toContain('### Effort');
    expect(md).toMatch(/L \(59 points\): base 2, steps \d+, major library updates 9, framework requirements 0, blockers 8, toolchain 4, removed APIs 4\./);
  });

  it('lists removed-API findings per hop with location, API, replacement and migration', () => {
    const md = renderMarkdown(sample(), META);
    expect(md).toContain('| Source scan | 312 files, 8 findings |');
    expect(md).toContain(
      '| Hop | Steps | Library updates | Blockers | Unknown | Requirement warnings | Removed APIs | Deprecation warnings | Effort |',
    );
    expect(md).toMatch(/\| 2\. Angular 15 to 16 \| \d+ \| \d+ \| \d+ \| \d+ \| \d+ \| 5 \| 2 \| XL \(75 points\) \|/);
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

  it('lists deprecation warnings apart from removed APIs, only in the hop before the removal', () => {
    const md = renderMarkdown(sample(), META);
    const hop2 = md.slice(md.indexOf('## Hop 2:'), md.indexOf('## Hop 3:'));
    const removed = hop2.indexOf('### Removed or changed APIs');
    const warnings = hop2.indexOf('### Deprecation warnings');
    expect(removed).toBeGreaterThan(0);
    expect(warnings).toBeGreaterThan(removed);
    expect(hop2.slice(warnings)).toContain(
      '2 uses of 2 deprecated APIs (1 confirmed, 1 heuristic). Deprecation warnings are uses of Angular APIs whose removal is announced for the next major. They do not block this hop',
    );
    expect(hop2).toContain('| Location | API | Deprecated in | Removal announced for | Replacement | Confidence |');
    expect(hop2).toContain(
      '| `src/app/core/legacy-token.provider.ts:3` | `SAMPLE_LEGACY_TOKEN` from `@angular/common` | 15 | 17 | the SAMPLE\\_TOKEN injection token | confirmed |',
    );
    expect(hop2).toMatch(/\| `src\/app\/checkout\/checkout\.component\.html:12` \| .* \| 15 \| 17 \| .* \| heuristic \(unverified\): Matched by text/);
    // The removed-API table holds no warning, and the other hops have no warning section.
    expect(hop2.slice(removed, warnings)).not.toContain('SAMPLE_LEGACY_TOKEN');
    expect(md.match(/### Deprecation warnings/g)).toHaveLength(1);
    // Plan-level notes: what the data covers and the warning outside the plan.
    expect(md).toContain(
      'It also looked for Angular APIs whose removal is announced for Angular 17, Angular 23 or Angular 24 (official sources read on 2026-10-03)',
    );
    expect(md).toContain(
      '1 deprecation warning is not listed because the hop before the announced removal is not part of this plan (1 for a removal after Angular 18).',
    );
    const confirmed = md.slice(md.indexOf('### Confirmed by evidence'), md.indexOf('### Could not be verified'));
    expect(confirmed).toContain('1 deprecation warning confirmed by imports');
    expect(md.slice(md.indexOf('### Could not be verified'))).toContain(
      '| deprecated API sampleOld template attribute at src/app/checkout/checkout.component.html:12 | Matched by text',
    );
  });

  it('shows the RxJS advisory once, before the hops, with its reason and no effort', () => {
    const md = renderMarkdown(sample(), META);
    const advisory = md.indexOf('## RxJS 7 advisory');
    expect(advisory).toBeGreaterThan(md.indexOf('## Summary'));
    expect(advisory).toBeLessThan(md.indexOf('## Hop 1:'));
    const section = md.slice(advisory, md.indexOf('## Hop 1:'));
    expect(section).toContain(
      '3 uses of 3 RxJS APIs. Not blockers and no effort points: no hop of this plan forces RxJS 7: the @angular/core rxjs peer range of every hop read still accepts RxJS 6. Fix these when moving rxjs to 7.',
    );
    expect(section).toContain('| Location | API | Change | Replacement |');
    expect(section).toContain('| `src/app/checkout/payment-options.service.ts:27` | `iif() without both results` from `rxjs` | breaking |');
    expect(section).toContain('| `src/app/legacy/rx-helpers.ts:1` | `rxjs/Rx` from `rxjs/Rx` | removed |');
    expect(md).not.toContain('### RxJS 7 breaking changes');
    expect(md).toContain(
      'It also looked for RxJS 7 breaking changes in files that import rxjs (official RxJS sources read on 2026-10-03) and found 3 uses. No hop of this plan forces RxJS 7, so they are listed once as an advisory, without effort points.',
    );
    const confirmed = md.slice(md.indexOf('### Confirmed by evidence'), md.indexOf('### Could not be verified'));
    expect(confirmed).toContain('RxJS 7 advisory: 3 uses of 3 RxJS APIs, found by imports; no hop of this plan forces RxJS 7.');
  });

  it('lists required RxJS changes in the hop that forces RxJS 7 only', () => {
    const md = renderMarkdown(rxjsForced(), META);
    expect(md).not.toContain('## RxJS 7 advisory');
    expect(md.match(/### RxJS 7 breaking changes/g)).toHaveLength(1);
    const hop2 = md.slice(md.indexOf('## Hop 2:'), md.indexOf('## Hop 3:'));
    const section = hop2.slice(hop2.indexOf('### RxJS 7 breaking changes'), hop2.indexOf('### Effort'));
    expect(section).toContain(
      '3 uses of 3 RxJS APIs. Required in this hop: Angular 16 accepts no RxJS 6, so rxjs 6.6.7 must move to RxJS 7 or later here.',
    );
    expect(section).toContain('| `src/app/catalog/catalog.service.ts:41` | `defaultIfEmpty() without a value` from `rxjs/operators` | breaking |');
    expect(md).toContain('They are work in the hop to Angular 16, the first whose @angular/core accepts no RxJS 6.');
    const confirmed = md.slice(md.indexOf('### Confirmed by evidence'), md.indexOf('### Could not be verified'));
    expect(confirmed).toContain('3 RxJS 7 breaking changes confirmed by imports');
  });

  it('only counts RxJS findings when rxjs 7 is installed', () => {
    const md = renderMarkdown(rxjsNotApplicable(), META);
    expect(md).not.toContain('## RxJS 7 advisory');
    expect(md).not.toContain('### RxJS 7 breaking changes');
    expect(md).toContain('They are not listed: the installed rxjs 7.8.1 is already RxJS 7 or later, so RxJS 7 breaking changes are not shown.');
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

  it('shows deprecation warnings in their own table after the removed APIs, without blocking', () => {
    const html = renderHtml(sample(), META);
    const removed = html.indexOf('<h3 id="hop-16-removed-apis">');
    const warnings = html.indexOf('<h3 id="hop-16-deprecations">Deprecation warnings</h3>');
    expect(removed).toBeGreaterThan(0);
    expect(warnings).toBeGreaterThan(removed);
    expect(html.match(/-deprecations">/g)).toHaveLength(1);
    expect(html).toContain('<caption>Deprecated APIs to replace before Angular 17; not blockers of the hop to Angular 16</caption>');
    expect(html).toContain(
      '<tr><th scope="row"><code>src/app/core/legacy-token.provider.ts:3</code></th><td><code>SAMPLE_LEGACY_TOKEN</code><div class="note">@angular/common, deprecated in Angular 15</div></td><td><span class="badge warn">Angular 17</span></td><td>the SAMPLE_TOKEN injection token</td><td><span class="badge ok">confirmed</span></td></tr>',
    );
    expect(html).toContain('<th scope="col">Deprecation warnings</th>');
    // The hop's blocker count (a library and the TypeScript toolchain blocker) does not include warnings.
    expect(html).toMatch(/<h2 id="hop-16-title">[\s\S]*?<span>2 blockers<\/span>/);
  });

  it('shows the RxJS advisory as its own section before the hops, and required changes in the forcing hop', () => {
    const html = renderHtml(sample(), META);
    const advisory = html.indexOf('<section id="rxjs-advisory" aria-labelledby="rxjs-advisory-title">');
    expect(advisory).toBeGreaterThan(0);
    expect(advisory).toBeLessThan(html.indexOf('<section id="hop-15"'));
    expect(html).toContain('<h2 id="rxjs-advisory-title">RxJS 7 advisory</h2>');
    expect(html).toContain('<caption>RxJS 7 breaking changes; advisory, not part of any hop</caption>');
    expect(html).toContain(
      '<tr><th scope="row"><code>src/app/legacy/rx-helpers.ts:1</code></th><td><code>rxjs/Rx</code><div class="note">rxjs/Rx, removed</div></td>',
    );
    expect(html).not.toContain('-rxjs">');

    const forced = renderHtml(rxjsForced(), META);
    expect(forced).not.toContain('id="rxjs-advisory"');
    expect(forced.match(/-rxjs">/g)).toHaveLength(1);
    const hop16 = forced.slice(forced.indexOf('<section id="hop-16"'), forced.indexOf('<section id="hop-17"'));
    expect(hop16).toContain('<h3 id="hop-16-rxjs">RxJS 7 breaking changes</h3>');
    expect(hop16).toContain('<caption>RxJS 7 breaking changes to fix in the hop to Angular 16</caption>');
    expect(hop16.indexOf('hop-16-rxjs')).toBeGreaterThan(hop16.indexOf('hop-16-deprecations'));

    expect(renderHtml(rxjsNotApplicable(), META)).not.toMatch(/rxjs-advisory|-rxjs">/);
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
    expect(html).toContain('<code>deprecated &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('<td>use &lt;script&gt;');
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
    expect(text).toMatch(/Total effort: L \(192 points\) over 3 hops, 7 blockers/);
    expect(text).toContain('Source scan: 312 files, 8 findings\n');
    expect(text).toContain('Hop 1: Angular 14 to 15 (15.2.10), effort L (59 points)\n  Steps: 21 (11 basic, 8 medium, 2 advanced)\n  Library updates: 3\n');
    expect(text).toContain(
      '  Removed APIs: 5 uses of 4 APIs (4 confirmed, 1 heuristic)\n    angular.json:5 angular.json defaultProject (@angular/cli); replacement: ',
    );
    expect(text).toContain(
      '    src/app/admin/admin.module.ts:22 @NgModule entryComponents (@angular/core); replacement: none; fixed by ng update migration: no\n',
    );
    expect(text).toMatch(/src\/app\/checkout\/checkout\.component\.html:44 .*; fixed by ng update migration: unknown \(heuristic, unverified\)\n/);
    expect(text).toContain(
      '  Deprecation warnings: 2 uses of 2 deprecated APIs (1 confirmed, 1 heuristic), not blockers\n    src/app/core/legacy-token.provider.ts:3 SAMPLE_LEGACY_TOKEN (@angular/common); deprecated in Angular 15, removal announced for Angular 17; replacement: the SAMPLE_TOKEN injection token\n',
    );
    expect(text.match(/Deprecation warnings:/g)).toHaveLength(1);
    expect(text).toMatch(/checkout\.component\.html:12 .*; replacement: the sampleNew attribute \(heuristic, unverified\)\n/);
    expect(text).toContain('    @ngrx/store 14.3.3 to 15.4.0, major\n');
    expect(text).toContain('  Blockers: 2\n    ngx-legacy-datepicker: No release accepts Angular 15');
    expect(text).toContain(
      '    TypeScript: typescript 4.7.4 from the lockfile is outside ">=4.8.2 <5.1": after ng update, install a TypeScript inside that range if ng update did not move it there\n',
    );
    expect(text).toContain('  Could not decide: ngx-flex-grid\n');
    expect(text).toContain('Node.js: engines.node ^14.15.0 || ^16.13.0; local 16.20.2 (context only)\n');
    expect(text).toContain('  Framework requirements:\n    zone.js must satisfy "~0.13.0"');
    expect(text).not.toMatch(/(typescript|node) must satisfy/);
    expect(text).toContain('Reports:\n  /work/ng-upgrade-plan.md\n  /work/ng-upgrade-plan.html\n');
    expect(text).not.toContain('\u001b');
    expect(text).not.toMatch(/—/);
  });

  it('shows the RxJS advisory after the hops, or the required changes in the forcing hop', () => {
    const text = renderTerminal(sample(), { color: false, reports });
    const advisory = text.indexOf('RxJS 7 advisory: 3 uses of 3 RxJS APIs. Not blockers and no effort points: no hop of this plan forces RxJS 7');
    expect(advisory).toBeGreaterThan(text.indexOf('Hop 3:'));
    expect(text).toContain(
      '    src/app/catalog/catalog.service.ts:41 defaultIfEmpty() without a value (rxjs/operators); replacement: pass the default value explicitly, for example defaultIfEmpty(null)\n',
    );
    expect(text).not.toContain('RxJS 7 breaking changes:');

    const forced = renderTerminal(rxjsForced(), { color: false, reports });
    expect(forced).not.toContain('RxJS 7 advisory');
    const hop2 = forced.slice(forced.indexOf('Hop 2:'), forced.indexOf('Hop 3:'));
    expect(hop2).toContain(
      '  RxJS 7 breaking changes: 3 uses of 3 RxJS APIs. Required in this hop: Angular 16 accepts no RxJS 6, so rxjs 6.6.7 must move to RxJS 7 or later here.\n    src/app/catalog/catalog.service.ts:41 ',
    );
    expect(forced.match(/RxJS 7 breaking changes:/g)).toHaveLength(1);

    const counted = renderTerminal(rxjsNotApplicable(), { color: false, reports });
    expect(counted).not.toMatch(/RxJS 7 (advisory|breaking changes:)/);
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

    const warned = sample();
    const warning = warned.hops[1]!.deprecations[0]!;
    warned.hops[1]!.deprecations = Array.from({ length: TERMINAL_FINDINGS_LIMIT + 2 }, (_, index) => ({ ...warning, line: index + 1 }));
    const second = renderTerminal(warned, { color: false, reports });
    const hop2 = second.slice(second.indexOf('Hop 2:'), second.indexOf('Hop 3:'));
    expect(hop2.match(/removal announced for Angular 17/g)).toHaveLength(TERMINAL_FINDINGS_LIMIT);
    expect(hop2).toContain('    and 2 more (listed in the reports)\n');
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
      expect(withoutOwnCodes).toContain('deprecated <script>alert(1)</script>');
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

describe('toolchain in the reports', () => {
  /** The sample with engines.node missing: Node.js is unverified in every hop. */
  function enginesMissing(): UpgradePlan {
    const plan = sample();
    plan.toolchain.engines = { value: null, confidence: 'unverified', source: 'none', note: 'package.json has no engines.node' };
    plan.toolchain.enginesStatus = 'missing';
    for (const hop of plan.hops) {
      hop.toolchain.node = {
        ...hop.toolchain.node,
        project: plan.toolchain.engines,
        status: 'unverified',
        reason: `package.json has no engines.node, so the Node.js range "${hop.toolchain.node.range.value}" of Angular ${hop.to} was not checked`,
      };
    }
    return plan;
  }

  it('shows the Node.js and TypeScript ranges of each hop with the status in Markdown', () => {
    const md = renderMarkdown(sample(), META);
    expect(md).toContain('| engines.node | ^14.15.0 \\|\\| ^16.13.0 |');
    expect(md).toContain('| Local Node.js | 16.20.2 (context only) |');
    for (const hop of ['## Hop 1:', '## Hop 2:', '## Hop 3:']) {
      const section = md.slice(md.indexOf(hop));
      expect(section).toContain('### Toolchain\n\n| Tool | Required range | Project | Status | Why |');
    }
    const hop3 = md.slice(md.indexOf('## Hop 3:'), md.indexOf('## Confirmed and unverified results'));
    expect(hop3).toContain(
      '| Node.js | `^18.13.0 \\|\\| ^20.9.0`<br>from @angular/core@17.3.12 engines, @angular/cli@17.3.11 engines | ^14.15.0 \\|\\| ^16.13.0<br>engines.node | **blocker** |',
    );
    expect(hop3).toContain('| TypeScript | `>=5.2 <5.5`<br>from @angular/compiler-cli@17.3.12 peerDependencies | 4.7.4<br>typescript from the lockfile | **blocker** |');
    expect(hop3).toMatch(/### Blockers\n\n- `ngx-legacy-datepicker`: .*\n- Node\.js \(toolchain\): engines\.node .* allows no Node\.js version inside .*\n- TypeScript \(toolchain\): typescript 4\.7\.4 from the lockfile is outside/);
    expect(hop3).toContain('Local Node.js: 16.20.2 (context only).');
    const hop1 = md.slice(md.indexOf('## Hop 1:'), md.indexOf('## Hop 2:'));
    expect(hop1).toMatch(/\| Node\.js \| .* \| warning \| engines\.node .* also allows Node\.js versions outside/);
    // Summary: blockers include the toolchain, requirement warnings include the Node.js warning.
    expect(md).toMatch(/\| 1\. Angular 14 to 15 \| 21 \| 3 \| 2 \| 1 \| 1 \|/);
    expect(md).toMatch(/\| 3\. Angular 16 to 17 \| \d+ \| \d+ \| 3 \| 1 \| 1 \|/);
    expect(md).toContain('engines.node "^14.15.0 \\|\\| ^16.13.0", read from package.json, decides the Node.js status of each hop.');
  });

  it('shows the toolchain table with badges and the blocker flag in HTML', () => {
    const html = renderHtml(sample(), META);
    expect(html).toContain('<div><dt>engines.node</dt><dd>^14.15.0 || ^16.13.0</dd></div>');
    expect(html).toContain('<div><dt>Local Node.js</dt><dd>16.20.2 <span class="note">context only</span></dd></div>');
    expect(html.match(/<h3 id="hop-\d+-toolchain">Toolchain<\/h3>/g)).toHaveLength(3);
    const hop17 = html.slice(html.indexOf('<section id="hop-17"'), html.indexOf('<section id="evidence"'));
    expect(hop17).toContain('<caption>Node.js and TypeScript for the hop to Angular 17</caption>');
    expect(hop17).toContain(
      '<tr><th scope="row">Node.js</th><td><span class="badge bad">blocker</span></td><td><code>^18.13.0 || ^20.9.0</code><div class="note">from @angular/core@17.3.12 engines, @angular/cli@17.3.11 engines</div></td><td>^14.15.0 || ^16.13.0<div class="note">engines.node</div></td></tr>',
    );
    expect(hop17).toContain(
      '<li><strong>TypeScript</strong>: typescript 4.7.4 from the lockfile is outside &quot;&gt;=5.2 &lt;5.5&quot;: after ng update, install a TypeScript inside that range if ng update did not move it there</li>',
    );
    expect(hop17).toContain('<li>Node.js <span class="note">(toolchain)</span>: engines.node &quot;^14.15.0 || ^16.13.0&quot; allows no Node.js version');
    expect(hop17).toMatch(/<span>3 blockers<\/span>/);
    const hop15 = html.slice(html.indexOf('<section id="hop-15"'), html.indexOf('<section id="hop-16"'));
    expect(hop15).toContain('<span class="badge warn">warning</span>');
    expect(hop15).toContain('<p class="note">Local Node.js: 16.20.2 (context only).');
  });

  it('shows the toolchain per hop in the terminal, with local Node.js as context', () => {
    const text = renderTerminal(sample(), { color: false, reports: null });
    expect(text).toContain('Node.js: engines.node ^14.15.0 || ^16.13.0; local 16.20.2 (context only)\n');
    const hop3 = text.slice(text.indexOf('Hop 3:'));
    expect(hop3).toContain(
      '  Toolchain:\n    Node.js ^18.13.0 || ^20.9.0, engines.node ^14.15.0 || ^16.13.0: blocker\n    TypeScript >=5.2 <5.5, typescript 4.7.4: blocker\n',
    );
    expect(hop3).toContain('  Blockers: 3\n');
    const hop1 = text.slice(text.indexOf('Hop 1:'), text.indexOf('Hop 2:'));
    expect(hop1).toContain('    Node.js ^14.20.0 || ^16.13.0 || >=18.10.0, engines.node ^14.15.0 || ^16.13.0: warning; engines.node "^14.15.0 || ^16.13.0" also allows');
    const colored = renderTerminal(sample(), { color: true, reports: null });
    expect(colored).toContain('TypeScript >=5.2 <5.5, typescript 4.7.4: \u001b[31mblocker\u001b[39m');
  });

  it('shows a missing engines.node as unverified in every format, never as a blocker', () => {
    const plan = enginesMissing();
    const text = renderTerminal(plan, { color: false, reports: null });
    expect(text).toContain('Node.js: engines.node none; local 16.20.2 (context only)\n');
    expect(text).toContain(
      '    Node.js ^18.13.0 || ^20.9.0, no engines.node: unverified; package.json has no engines.node, so the Node.js range "^18.13.0 || ^20.9.0" of Angular 17 was not checked\n',
    );
    expect(text).not.toMatch(/Node\.js: engines\.node "/);
    const md = renderMarkdown(plan, META);
    expect(md).toContain('| engines.node | none |');
    expect(md).toMatch(/\| Node\.js \| `\^18\.13\.0 \\\|\\\| \^20\.9\.0`<br>.* \| none \(unverified\)<br>engines\.node \| unverified \|/);
    expect(md).not.toContain('Node.js (toolchain)');
    const html = renderHtml(plan, META);
    expect(html).toContain('<div><dt>engines.node</dt><dd>none</dd></div>');
    expect(html).not.toContain('<li>Node.js <span class="note">(toolchain)</span>');
  });
});
