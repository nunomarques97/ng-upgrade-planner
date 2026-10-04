#!/usr/bin/env node
// Runs the built scan (removed APIs, deprecated APIs and RxJS 7 breaking changes, as the CLI runs it) on every
// app fetched by scripts/fetch-real-apps.mjs and keeps
// the labelled results in docs/verification/scan-precision.json, from which it generates
// docs/verification/scan-precision.md. Works offline; build first (npm run build).
//
// Usage:
//   node scripts/scan-real-apps.mjs           scan, update the JSON (labels of unchanged findings are kept;
//                                             new findings are marked "unlabelled") and regenerate the Markdown
//   node scripts/scan-real-apps.mjs --render  regenerate the Markdown from the JSON only
//   node scripts/scan-real-apps.mjs --check   scan again and fail when the findings differ from the JSON, a fixed
//                                             false positive is found again or the Markdown is not what the JSON
//                                             generates
//
// A false positive is either fixed or kept. A fixed one moves from "findings" to "fixed" with "fix" (the change
// to src/scan or src/data) and "test" (the synthetic regression case and its test); a kept one stays in
// "findings" with "notFixed" (why it was not fixed). The Markdown shows precision before the fixes (findings
// plus fixed) and after (findings). "baseline" holds the counts of the first measurement, before the v0.3 data; it
// is kept as it is and shown next to the current numbers.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CACHE_DIR, ROOT, loadManifest } from './fetch-real-apps.mjs';

export const RESULTS_JSON = path.join(ROOT, 'docs', 'verification', 'scan-precision.json');
export const RESULTS_MD = path.join(ROOT, 'docs', 'verification', 'scan-precision.md');

/** Rule families, in report order. */
export const FAMILIES = [
  { id: 'symbol', title: 'TypeScript symbol' },
  { id: 'template', title: 'Template pattern' },
  { id: 'config-path', title: 'Config path' },
  { id: 'builder-option', title: 'Builder option' },
  { id: 'builder', title: 'Builder' },
  { id: 'components', title: 'Material and CDK' },
  { id: 'deprecation', title: 'Deprecation warning' },
  { id: 'rxjs', title: 'RxJS 7 change' },
];
export const CONFIDENCES = ['confirmed', 'heuristic'];
export const LABELS = ['tp', 'fp'];
const COMPARED = ['app', 'file', 'line', 'column', 'entryId', 'api', 'family', 'confidence', 'major'];

function fail(message) {
  console.error(`scan-real-apps: ${message}`);
  process.exit(1);
}

/** The rule family of a removed-API, deprecated-API or RxJS dataset entry. */
export function familyOf(entry) {
  if ('rxjsMajor' in entry) return 'rxjs';
  if ('removalMajor' in entry) return 'deprecation';
  if (/^@angular\/(material|cdk)(\/|$)/.test(entry.package)) return 'components';
  if (entry.kind === 'symbol') return 'symbol';
  if (entry.kind === 'template') return 'template';
  if (entry.option !== undefined) return 'builder-option';
  if (entry.builders !== undefined) return 'builder';
  return 'config-path';
}

export function findingKey(finding) {
  return `${finding.app} ${finding.file} ${finding.line} ${finding.column} ${finding.entryId}`;
}

function compareFindings(a, b) {
  const ka = [a.app, a.file];
  const kb = [b.app, b.file];
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
  return a.line - b.line || a.column - b.column || (a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0);
}

/** Lines describing how two finding lists differ in the compared fields (empty when they match). */
export function diffFindings(expected, actual) {
  const describe = (finding) => COMPARED.map((key) => finding[key]).join(' | ');
  const before = new Map(expected.map((finding) => [findingKey(finding), describe(finding)]));
  const after = new Map(actual.map((finding) => [findingKey(finding), describe(finding)]));
  const lines = [];
  for (const [key, value] of before) {
    if (!after.has(key)) lines.push(`gone: ${value}`);
    else if (after.get(key) !== value) lines.push(`changed: ${value} -> ${after.get(key)}`);
  }
  for (const [key, value] of after) if (!before.has(key)) lines.push(`new: ${value}`);
  return lines;
}

/** Problems with the labels and app list of a results file (empty when it is complete). */
export function labelProblems(results, apps) {
  const problems = [];
  const ids = new Set(apps.map((app) => app.id));
  const listed = new Set(results.apps.map((app) => app.id));
  for (const app of apps) if (!listed.has(app.id)) problems.push(`${app.id}: in the manifest but not scanned`);
  for (const app of results.apps) if (!ids.has(app.id)) problems.push(`${app.id}: scanned but not in the manifest`);
  const text = (value) => typeof value === 'string' && value.trim() !== '';
  const check = (finding, where) => {
    if (!ids.has(finding.app)) problems.push(`${where}: unknown app`);
    if (!LABELS.includes(finding.label)) problems.push(`${where}: label must be tp or fp`);
    if (!text(finding.reason)) problems.push(`${where}: reason missing`);
    if (!FAMILIES.some((family) => family.id === finding.family)) problems.push(`${where}: unknown family`);
    if (!CONFIDENCES.includes(finding.confidence)) problems.push(`${where}: unknown confidence`);
  };
  for (const finding of results.findings) {
    const where = `${finding.app} ${finding.file}:${finding.line} ${finding.entryId}`;
    check(finding, where);
    if (finding.label === 'fp' && !text(finding.notFixed)) problems.push(`${where}: false positive neither fixed nor given a notFixed reason`);
    if (finding.label !== 'fp' && finding.notFixed !== undefined) problems.push(`${where}: notFixed is only for false positives`);
  }
  const current = new Set(results.findings.map(findingKey));
  for (const finding of results.fixed ?? []) {
    const where = `fixed ${finding.app} ${finding.file}:${finding.line} ${finding.entryId}`;
    check(finding, where);
    if (finding.label !== 'fp') problems.push(`${where}: only false positives can be fixed`);
    if (!text(finding.fix)) problems.push(`${where}: fix missing`);
    if (!text(finding.test)) problems.push(`${where}: regression test missing`);
    if (current.has(findingKey(finding))) problems.push(`${where}: still in the findings`);
  }
  return problems;
}

function count(findings) {
  const tp = findings.filter((finding) => finding.label === 'tp').length;
  const fp = findings.filter((finding) => finding.label === 'fp').length;
  return { total: findings.length, tp, fp };
}

/** Precision as a percentage with one decimal, or n/a when nothing was found. */
export function precision({ tp, fp }) {
  return tp + fp === 0 ? 'n/a' : `${((100 * tp) / (tp + fp)).toFixed(1)}%`;
}

function majorOf(version) {
  return Number(version.split('.')[0]);
}

/** The major of an entry: where a removed API breaks, where a deprecated one is removed, or the RxJS major. */
export function majorOfEntry(entry) {
  return entry.rxjsMajor ?? entry.removalMajor ?? entry.major;
}

/**
 * Whether a plan to the default target lists the finding, as build-plan attaches it: a removed API in the hop to its
 * major, a deprecation in the hop before its removal, and RxJS changes only when the installed rxjs is 6.x.
 */
export function listedInPlan(finding, angularMajor, rxjsVersion, target) {
  if (finding.family === 'rxjs') return rxjsVersion !== null && majorOf(rxjsVersion) === 6;
  const hop = finding.family === 'deprecation' ? finding.major - 1 : finding.major;
  return hop > angularMajor && hop <= target;
}

/** Counts per family and confidence, per app and in total, as rendered in the Markdown. */
export function summarize(results, apps) {
  const angular = new Map(apps.map((app) => [app.id, majorOf(app.angular)]));
  const rxjs = new Map(results.apps.map((app) => [app.id, app.rxjs ?? null]));
  const listed = (finding) =>
    listedInPlan(finding, angular.get(finding.app) ?? Infinity, rxjs.get(finding.app) ?? null, results.scan.target);
  const families = [];
  for (const family of FAMILIES) {
    for (const confidence of CONFIDENCES) {
      const findings = results.findings.filter((f) => f.family === family.id && f.confidence === confidence);
      families.push({ family: family.id, title: family.title, confidence, ...count(findings) });
    }
  }
  const confidences = CONFIDENCES.map((confidence) => ({
    confidence,
    ...count(results.findings.filter((finding) => finding.confidence === confidence)),
  }));
  const perApp = apps.map((app) => {
    const findings = results.findings.filter((finding) => finding.app === app.id);
    return { app: app.id, ...count(findings), listed: count(findings.filter(listed)) };
  });
  return {
    families,
    confidences,
    apps: perApp,
    total: count(results.findings),
    listed: count(results.findings.filter(listed)),
  };
}

function cell(text) {
  return String(text).replace(/\|/g, '\\|');
}

/** The results as they were before the fixes, when the fixed false positives were still found. */
export function beforeFixes(results) {
  return { ...results, findings: [...results.findings, ...(results.fixed ?? [])] };
}

/** The section comparing the first measurement with this run, when the results keep one. */
function renderBaseline(results, summary, line) {
  const { baseline } = results;
  if (baseline === undefined) return;
  const then = (c) => (c === undefined ? 'not scanned | not scanned | not scanned' : `${c.total} | ${c.fp} | ${precision(c)}`);
  const now = (c) => `${c.total} | ${c.fp} | ${precision(c)}`;
  line('## Earlier baseline');
  line();
  line(
    `The first measurement, on ${baseline.scan.date}, ran the scan of ng-upgrade-planner ${baseline.scan.version} ` +
      `with the Angular removed-API data only (read ${baseline.scan.dataRetrieved}, ${baseline.scan.entries} entries). It ` +
      `found ${baseline.total.total} findings, ${baseline.total.fp} of them false positives, so precision was ` +
      `${precision(baseline.total)} (${precision(baseline.listed)} on the ${baseline.listed.total} findings listed in ` +
      'a plan). Its counts are kept in the JSON file and compared with this run below; "not scanned" marks the ' +
      'families whose data did not exist yet.',
  );
  line();
  line(
    '| Rule family | Confidence | Baseline findings | Baseline false positives | Baseline precision | Findings now | ' +
      'False positives now | Precision now |',
  );
  line('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of summary.families) {
    const old = baseline.families.find((item) => item.family === row.family && item.confidence === row.confidence);
    line(`| ${row.title} | ${row.confidence} | ${then(old)} | ${now(row)} |`);
  }
  line(`| All families | all | ${then(baseline.total)} | ${now(summary.total)} |`);
  line();
  line('| App | Baseline findings | Baseline false positives | Baseline precision | Findings now | False positives now | Precision now |');
  line('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of summary.apps) line(`| ${row.app} | ${then(baseline.apps.find((item) => item.app === row.app))} | ${now(row)} |`);
  line();
}

/** The Markdown report generated from the results file and the manifest. */
export function renderMarkdown(results, apps) {
  const summary = summarize(results, apps);
  const scanned = new Map(results.apps.map((app) => [app.id, app]));
  const out = [];
  const line = (text = '') => out.push(text);
  const ratio = (c) => `${c.tp} | ${c.fp} | ${precision(c)}`;

  line('# Scan precision on real apps');
  line();
  line('Generated by `node scripts/scan-real-apps.mjs` from `scan-precision.json`. Do not edit by hand.');
  line();
  const { scan } = results;
  line(
    `The scan of ng-upgrade-planner ${scan.version} was run on ${apps.length} open-source Angular apps at pinned ` +
      `commits on ${scan.date}, each app from its own folder, with the data the CLI scans with by default: removed ` +
      `or changed APIs of Angular and of Angular Material and CDK (read ${scan.dataRetrieved}, ${scan.entries} ` +
      `entries), APIs deprecated with an announced removal (read ${scan.deprecationsRetrieved}, ` +
      `${scan.deprecationEntries} entries) and RxJS 7 breaking changes (read ${scan.rxjsRetrieved}, ${scan.rxjsEntries} ` +
      'entries). Every finding was labelled by reading the code at its file and line:',
  );
  line();
  line('- **True positive (tp)**: the line really uses the removed, changed or deprecated API the entry describes.');
  line('- **False positive (fp)**: the match is not a use of that API.');
  line();
  line(
    'The first five rule families are removed or changed Angular APIs, by how they are matched. "Material and CDK" ' +
      'counts the removed or changed APIs of @angular/material and @angular/cdk, "Deprecation warning" the ' +
      'deprecated APIs and "RxJS 7 change" the RxJS breaking changes.',
  );
  line();
  line(
    'Precision is true positives divided by all findings. The labels were set by the development agent, not yet ' +
      'reviewed by a person; each one has a one-sentence reason in the JSON file.',
  );
  line();
  line(
    '**Recall is not measured.** Uses of removed or deprecated APIs that the scan missed are not counted, because no ' +
      'complete list of the removed or deprecated APIs used in these apps exists.',
  );
  line();
  line(
    `The "Listed in plan" columns count only the findings a plan to Angular ${scan.target} shows: a removed or ` +
      'changed API when its major is above the installed one, a deprecation when the hop before its announced ' +
      'removal is in the plan, and an RxJS 7 change when the installed rxjs is 6.x. The other findings are counted ' +
      'here but not listed in a plan.',
  );
  line();
  line('## Totals');
  line();
  line('| Findings | Precision | True positives | False positives | Listed in plan | Precision listed |');
  line('| ---: | ---: | ---: | ---: | ---: | ---: |');
  line(
    `| ${summary.total.total} | ${precision(summary.total)} | ${summary.total.tp} | ${summary.total.fp} | ` +
      `${summary.listed.total} | ${precision(summary.listed)} |`,
  );
  line();
  line('## Precision per rule family');
  line();
  line('| Rule family | Confidence | Findings | True positives | False positives | Precision |');
  line('| --- | --- | ---: | ---: | ---: | ---: |');
  for (const row of summary.families) line(`| ${row.title} | ${row.confidence} | ${row.total} | ${ratio(row)} |`);
  for (const row of summary.confidences) line(`| All families | ${row.confidence} | ${row.total} | ${ratio(row)} |`);
  line();
  const empty = summary.families.filter((row) => row.total === 0).map((row) => `${row.title.toLowerCase()} (${row.confidence})`);
  if (empty.length > 0) {
    line(`No findings, so precision on these apps is not measured for: ${empty.join(', ')}.`);
    line();
  }
  line('## Precision per app');
  line();
  line('| App | Angular | Findings | True positives | False positives | Precision | Listed in plan | Precision listed |');
  line('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const app of apps) {
    const row = summary.apps.find((item) => item.app === app.id);
    line(`| ${app.id} | ${app.angular} | ${row.total} | ${ratio(row)} | ${row.listed.total} | ${precision(row.listed)} |`);
  }
  line();
  renderBaseline(results, summary, line);
  const before = summarize(beforeFixes(results), apps);
  const fixed = results.fixed ?? [];
  const kept = results.findings.filter((finding) => finding.label === 'fp');
  const change = (b, a) => `${b.total} | ${b.fp} | ${precision(b)} | ${a.total} | ${a.fp} | ${precision(a)}`;
  line('## Precision before and after the fixes');
  line();
  line(
    'Each false positive is either fixed by a change to the scan or the data, with a synthetic regression case and ' +
      'a test that the finding is gone, or kept and listed below as not fixed with the reason. "Before" counts the ' +
      'findings of this run plus the fixed false positives; "after" counts the findings of this run.',
  );
  line();
  if (fixed.length === 0 && kept.length === 0) {
    line('No false positive was found, so neither the scan nor the data was changed and the numbers are the same before and after.');
  } else {
    line(`False positives fixed: ${fixed.length}. Not fixed: ${kept.length}.`);
  }
  line();
  line(
    '| Rule family | Confidence | Findings before | False positives before | Precision before | Findings after | ' +
      'False positives after | Precision after |',
  );
  line('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  summary.families.forEach((row, i) => line(`| ${row.title} | ${row.confidence} | ${change(before.families[i], row)} |`));
  summary.confidences.forEach((row, i) => line(`| All families | ${row.confidence} | ${change(before.confidences[i], row)} |`));
  line(`| All families | all | ${change(before.total, summary.total)} |`);
  line();
  line('| App | Findings before | False positives before | Precision before | Findings after | False positives after | Precision after |');
  line('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  summary.apps.forEach((row, i) => line(`| ${row.app} | ${change(before.apps[i], row)} |`));
  line();
  line('## Apps');
  line();
  line('Only the labelled results are committed: API names, file paths and line numbers. No application source.');
  line();
  line('| App | Source | Commit | Licence | Lockfile | Files scanned |');
  line('| --- | --- | --- | --- | --- | ---: |');
  for (const app of apps) {
    const folder = app.path === '.' ? '' : ` (folder \`${app.path}\`)`;
    line(
      `| ${app.id} | ${app.repository}${folder} | \`${app.commit}\` | [${app.license}](${app.licenseUrl}) | ` +
        `${app.lockfile} | ${scanned.get(app.id)?.filesScanned ?? 'not scanned'} |`,
    );
  }
  line();
  line('## False positives');
  line();
  const where = (f) => `| ${f.app} | \`${cell(f.file)}\` | ${f.line} | ${f.entryId} | ${f.family}, ${f.confidence} | ${cell(f.reason)} |`;
  line('### Fixed');
  line();
  if (fixed.length === 0) line('None.');
  else {
    line('| App | File | Line | Entry | Family | Reason | Fix | Regression test |');
    line('| --- | --- | ---: | --- | --- | --- | --- | --- |');
    for (const f of fixed) line(`${where(f)} ${cell(f.fix)} | ${cell(f.test)} |`);
  }
  line();
  line('### Not fixed');
  line();
  if (kept.length === 0) line('None.');
  else {
    line('| App | File | Line | Entry | Family | Reason | Why not fixed |');
    line('| --- | --- | ---: | --- | --- | --- | --- |');
    for (const f of kept) line(`${where(f)} ${cell(f.notFixed)} |`);
  }
  line();
  line('## True positives by entry');
  line();
  const byEntry = new Map();
  for (const f of results.findings.filter((finding) => finding.label === 'tp')) {
    const key = `${f.entryId}|${f.api}|${f.major}|${f.family}|${f.confidence}`;
    const apps = byEntry.get(key) ?? new Map();
    apps.set(f.app, (apps.get(f.app) ?? 0) + 1);
    byEntry.set(key, apps);
  }
  if (byEntry.size === 0) line('None.');
  else {
    line('| Entry | API | Major | Family | Apps (findings) |');
    line('| --- | --- | ---: | --- | --- |');
    for (const key of [...byEntry.keys()].sort()) {
      const [entryId, api, major, family, confidence] = key.split('|');
      const list = [...byEntry.get(key)].map(([app, n]) => `${app} (${n})`).join(', ');
      const title = FAMILIES.find((item) => item.id === family)?.title ?? family;
      line(`| ${entryId} | \`${cell(api)}\` | ${major} | ${title}, ${confidence} | ${list} |`);
    }
  }
  return `${out.join('\n')}\n`;
}

export function readResults(file = RESULTS_JSON) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

async function loadBuilt() {
  const dist = path.join(ROOT, 'dist');
  const files = ['scan/index.js', 'data/removed-apis.js', 'data/deprecated-apis.js', 'data/rxjs-apis.js', 'project/index.js'];
  for (const file of files) {
    if (!existsSync(path.join(dist, file))) fail(`dist/${file} is missing; run npm run build first`);
  }
  const [{ scan }, { REMOVED_APIS }, { DEPRECATED_APIS }, { RXJS_APIS }, { readProject }] = await Promise.all(
    files.map((file) => import(pathToFileURL(path.join(dist, file)).href)),
  );
  return { scan, data: REMOVED_APIS, deprecations: DEPRECATED_APIS, rxjs: RXJS_APIS, readProject };
}

function appFolder(app) {
  return app.path === '.' ? path.join(CACHE_DIR, app.id) : path.join(CACHE_DIR, app.id, ...app.path.split('/'));
}

async function scanAll(apps) {
  const missing = apps.filter((app) => !existsSync(path.join(CACHE_DIR, app.id, '.git')));
  if (missing.length > 0) {
    fail(
      `the app cache is missing (${missing.map((app) => app.id).join(', ')} not in ` +
        `${path.relative(ROOT, CACHE_DIR)}). Run node scripts/fetch-real-apps.mjs first; it needs the network.`,
    );
  }
  for (const app of apps) {
    // The fetch script leaves a detached HEAD, so .git/HEAD holds the commit itself.
    const head = readFileSync(path.join(CACHE_DIR, app.id, '.git', 'HEAD'), 'utf8').trim();
    if (head !== app.commit) {
      fail(`${app.id}: the cache holds ${head}, the manifest pins ${app.commit}. Run node scripts/fetch-real-apps.mjs.`);
    }
  }
  const { scan, data, deprecations, rxjs, readProject } = await loadBuilt();
  const entries = new Map([...data.entries, ...deprecations.entries, ...rxjs.entries].map((entry) => [entry.id, entry]));
  const scanned = [];
  const findings = [];
  for (const app of apps) {
    const folder = appFolder(app);
    const project = await readProject(folder);
    const kind = project.lockfile?.kind.replace(/-(classic|berry)$/, '') ?? 'none';
    if (kind !== app.lockfile || project.angular.version !== app.angular || project.angular.source !== 'lockfile') {
      fail(
        `${app.id}: the manifest says ${app.lockfile} lockfile and Angular ${app.angular}, the project has ` +
          `${kind} and ${project.angular.version} (${project.angular.source})`,
      );
    }
    // The same data the CLI scans with by default.
    const result = await scan(folder, data, { deprecations, rxjs });
    const rxjsVersion = project.dependencies.find((dependency) => dependency.registryName === 'rxjs')?.version ?? null;
    scanned.push({ id: app.id, filesScanned: result.filesScanned, unscanned: result.unscanned.length, rxjs: rxjsVersion });
    for (const finding of [...result.findings, ...result.deprecations, ...result.rxjs]) {
      const entry = entries.get(finding.entryId);
      findings.push({
        app: app.id,
        file: finding.file,
        line: finding.line,
        column: finding.column,
        entryId: finding.entryId,
        api: finding.api,
        family: familyOf(entry),
        // RxJS findings are always found through an import.
        confidence: finding.confidence ?? 'confirmed',
        major: majorOfEntry(entry),
      });
    }
  }
  findings.sort(compareFindings);
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return {
    scan: {
      version: pkg.version,
      dataRetrieved: data.retrieved,
      entries: data.entries.length,
      deprecationsRetrieved: deprecations.retrieved,
      deprecationEntries: deprecations.entries.length,
      rxjsRetrieved: rxjs.retrieved,
      rxjsEntries: rxjs.entries.length,
      // The default target: the newest major of the removed-API data.
      target: Math.max(...data.entries.map((entry) => entry.major)),
    },
    apps: scanned,
    findings,
  };
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function writeResults(results) {
  writeFileSync(RESULTS_JSON, `${JSON.stringify(results, null, 2)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] ?? 'write';
  if (args.length > 1 || !['write', '--render', '--check'].includes(mode)) {
    fail('usage: node scripts/scan-real-apps.mjs [--render | --check]');
  }
  let apps;
  try {
    apps = loadManifest();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  if (mode === '--render') {
    writeFileSync(RESULTS_MD, renderMarkdown(readResults(), apps));
    console.log(`scan-real-apps: wrote ${path.relative(ROOT, RESULTS_MD)}`);
    return;
  }

  const fresh = await scanAll(apps);

  if (mode === '--check') {
    if (!existsSync(RESULTS_JSON)) fail(`${path.relative(ROOT, RESULTS_JSON)} is missing`);
    const results = readResults();
    const problems = diffFindings(results.findings, fresh.findings);
    for (const app of fresh.apps) {
      const recorded = results.apps.find((item) => item.id === app.id);
      if (
        !recorded ||
        recorded.filesScanned !== app.filesScanned ||
        recorded.unscanned !== app.unscanned ||
        recorded.rxjs !== app.rxjs
      ) {
        problems.push(
          `${app.id}: scanned ${app.filesScanned} files (${app.unscanned} unscanned, rxjs ${app.rxjs}), recorded differently`,
        );
      }
    }
    for (const key of Object.keys(fresh.scan)) {
      if (results.scan[key] !== fresh.scan[key]) problems.push(`scan ${key}: recorded ${results.scan[key]}, now ${fresh.scan[key]}`);
    }
    const found = new Set(fresh.findings.map(findingKey));
    for (const f of results.fixed ?? []) {
      if (found.has(findingKey(f))) problems.push(`fixed false positive found again: ${f.app} ${f.file}:${f.line} ${f.entryId}`);
    }
    problems.push(...labelProblems(results, apps));
    if (!existsSync(RESULTS_MD) || normalize(readFileSync(RESULTS_MD, 'utf8')) !== renderMarkdown(results, apps)) {
      problems.push(`${path.relative(ROOT, RESULTS_MD)} is not what the JSON generates; run node scripts/scan-real-apps.mjs --render`);
    }
    if (problems.length > 0) {
      console.error('scan-real-apps: the recorded results are out of date:');
      for (const problem of problems) console.error(`  ${problem}`);
      process.exit(1);
    }
    console.log(`scan-real-apps: OK (${fresh.findings.length} findings in ${fresh.apps.length} apps match the labels).`);
    return;
  }

  const previous = existsSync(RESULTS_JSON) ? readResults() : { findings: [] };
  const labels = new Map(previous.findings.map((finding) => [findingKey(finding), finding]));
  const findings = fresh.findings.map((finding) => {
    const old = labels.get(findingKey(finding));
    const same = old && diffFindings([old], [finding]).length === 0;
    const labelled = { ...finding, label: same ? old.label : 'unlabelled', reason: same ? old.reason : '' };
    return same && old.notFixed !== undefined ? { ...labelled, notFixed: old.notFixed } : labelled;
  });
  const date = new Date().toISOString().slice(0, 10);
  const results = { scan: { ...fresh.scan, date }, apps: fresh.apps, findings, fixed: previous.fixed ?? [] };
  if (previous.baseline !== undefined) results.baseline = previous.baseline;
  writeResults(results);
  writeFileSync(RESULTS_MD, renderMarkdown(results, apps));
  const unlabelled = findings.filter((finding) => finding.label === 'unlabelled').length;
  console.log(`scan-real-apps: ${findings.length} findings in ${apps.length} apps, ${unlabelled} unlabelled.`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = fileURLToPath(import.meta.url);
if (process.platform === 'win32' ? invoked.toLowerCase() === self.toLowerCase() : invoked === self) await main();
