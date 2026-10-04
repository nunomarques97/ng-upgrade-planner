// Checks the scan precision baseline on real apps without the network or the app cache: the
// manifest of apps (scripts/real-apps.json), the labels in docs/verification/scan-precision.json,
// that docs/verification/scan-precision.md holds the numbers of that JSON, and that the fetch
// script rejects unsafe manifest values.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEPRECATED_APIS } from '../../src/data/deprecated-apis.js';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { RXJS_APIS } from '../../src/data/rxjs-apis.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface App {
  id: string;
  repository: string;
  commit: string;
  license: string;
  licenseUrl: string;
  path: string;
  lockfile: string;
  angular: string;
}

interface Finding {
  app: string;
  file: string;
  line: number;
  column: number;
  entryId: string;
  api: string;
  family: string;
  confidence: string;
  major: number;
  label: string;
  reason: string;
  notFixed?: string;
}

interface FixedFinding extends Finding {
  fix: string;
  test: string;
}

interface Counts {
  total: number;
  tp: number;
  fp: number;
}

interface Baseline {
  scan: { version: string; dataRetrieved: string; entries: number; date: string };
  families: (Counts & { family: string; confidence: string })[];
  apps: (Counts & { app: string; listed: Counts })[];
  total: Counts;
  listed: Counts;
  fixed: number;
}

interface Results {
  scan: {
    version: string;
    dataRetrieved: string;
    entries: number;
    deprecationsRetrieved: string;
    deprecationEntries: number;
    rxjsRetrieved: string;
    rxjsEntries: number;
    target: number;
    date: string;
  };
  apps: { id: string; filesScanned: number; unscanned: number; rxjs: string | null }[];
  findings: Finding[];
  fixed: FixedFinding[];
  baseline?: Baseline;
}

interface FetchScript {
  PERMISSIVE_LICENSES: string[];
  GIT_OPTIONS: string[];
  parseManifest: (text: string) => { apps: App[]; problems: string[] };
  appProblems: (app: unknown) => string[];
  gitEnvironment: (source: Record<string, string>, emptyConfig: string) => Record<string, string>;
}

interface ScanScript {
  labelProblems: (results: Results, apps: App[]) => string[];
  renderMarkdown: (results: Results, apps: App[]) => string;
  familyOf: (entry: unknown) => string;
  majorOfEntry: (entry: unknown) => number;
  listedInPlan: (finding: Finding, angularMajor: number, rxjsVersion: string | null, target: number) => boolean;
}

async function script<T>(name: string): Promise<T> {
  return (await import(pathToFileURL(path.join(root, 'scripts', name)).href)) as T;
}

function read(file: string): string {
  return readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
}

const manifestText = read('scripts/real-apps.json');
const results = JSON.parse(read('docs/verification/scan-precision.json')) as Results;
const markdown = read('docs/verification/scan-precision.md');

async function apps(): Promise<App[]> {
  const { parseManifest } = await script<FetchScript>('fetch-real-apps.mjs');
  const parsed = parseManifest(manifestText);
  expect(parsed.problems).toEqual([]);
  return parsed.apps;
}

function precision(tp: number, fp: number): string {
  return tp + fp === 0 ? 'n/a' : `${((100 * tp) / (tp + fp)).toFixed(1)}%`;
}

function falsePositive(app: string): Finding {
  return {
    app,
    file: 'src/app/a.ts',
    line: 4,
    column: 10,
    entryId: 'some-entry',
    api: 'some API',
    family: 'symbol',
    confidence: 'heuristic',
    major: 19,
    label: 'fp',
    reason: 'Not a use of the API.',
  };
}

describe('real app manifest', () => {
  it('lists at least 10 permissively licensed apps across Angular 9 to 19 and all three lockfile kinds', async () => {
    const list = await apps();
    const { PERMISSIVE_LICENSES } = await script<FetchScript>('fetch-real-apps.mjs');
    expect(list.length).toBeGreaterThanOrEqual(10);
    const majors = list.map((app) => Number(app.angular.split('.')[0]));
    expect(new Set(majors).size).toBeGreaterThanOrEqual(6);
    expect(Math.min(...majors)).toBeLessThanOrEqual(10);
    expect(Math.max(...majors)).toBeGreaterThanOrEqual(18);
    for (const major of majors) expect(major >= 9 && major <= 19).toBe(true);
    for (const kind of ['npm', 'pnpm', 'yarn']) {
      expect(list.filter((app) => app.lockfile === kind).length).toBeGreaterThanOrEqual(2);
    }
    for (const app of list) {
      expect(PERMISSIVE_LICENSES).toContain(app.license);
      expect(app.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(app.repository).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
      expect(app.licenseUrl.startsWith(`${app.repository}/blob/${app.commit}/`)).toBe(true);
    }
  });
});

describe('fetch script input validation', () => {
  const valid: App = {
    id: 'demo-app',
    repository: 'https://github.com/someone/demo-app',
    commit: '0123456789abcdef0123456789abcdef01234567',
    license: 'MIT',
    licenseUrl: 'https://github.com/someone/demo-app/blob/0123456789abcdef0123456789abcdef01234567/LICENSE',
    path: '.',
    lockfile: 'npm',
    angular: '16.2.10',
  };

  it('accepts a valid app', async () => {
    const { appProblems } = await script<FetchScript>('fetch-real-apps.mjs');
    expect(appProblems({ ...valid })).toEqual([]);
    expect(appProblems({ ...valid, path: 'apps/web' })).toEqual([]);
  });

  it.each([
    ['another host', { repository: 'https://gitlab.com/someone/demo-app' }],
    ['plain http', { repository: 'http://github.com/someone/demo-app' }],
    ['credentials in the URL', { repository: 'https://user:pass@github.com/someone/demo-app' }],
    ['an extra path segment', { repository: 'https://github.com/someone/demo-app/tree/main' }],
    ['an owner with a dot', { repository: 'https://github.com/some.one/demo-app' }],
    ['an owner starting with a hyphen', { repository: 'https://github.com/-someone/demo-app' }],
    ['a repo named ..', { repository: 'https://github.com/someone/..' }],
    ['a repo ending in .git', { repository: 'https://github.com/someone/demo-app.git' }],
    ['a short commit', { commit: '0123456' }],
    ['an uppercase commit', { commit: '0123456789ABCDEF0123456789ABCDEF01234567' }],
    ['a branch name as commit', { commit: 'main' }],
    ['an option-like commit', { commit: '--upload-pack=evil' }],
    ['a copyleft licence', { license: 'GPL-3.0' }],
    ['a licence URL at another commit', { licenseUrl: 'https://github.com/someone/demo-app/blob/main/LICENSE' }],
    ['a licence URL in another repository', { licenseUrl: valid.licenseUrl.replace('someone', 'other') }],
    ['a path leaving the repository', { path: '../outside' }],
    ['an absolute path', { path: '/etc' }],
    ['a dot segment in the path', { path: 'apps/./web' }],
    ['an unknown lockfile kind', { lockfile: 'bun' }],
    ['a range instead of a version', { angular: '^16.0.0' }],
    ['an id with a path separator', { id: '../demo' }],
    ['a field that is not a string', { commit: 123 }],
  ])('rejects %s', async (_name, change) => {
    const { appProblems } = await script<FetchScript>('fetch-real-apps.mjs');
    expect(appProblems({ ...valid, ...change }).length).toBeGreaterThan(0);
  });

  it('rejects unknown fields, duplicate ids and a manifest that is not JSON', async () => {
    const { appProblems, parseManifest } = await script<FetchScript>('fetch-real-apps.mjs');
    expect(appProblems({ ...valid, install: 'npm ci' })).toEqual(['demo-app: unknown field "install"']);
    expect(parseManifest(JSON.stringify({ apps: [valid, valid] })).problems).toEqual(['demo-app: duplicate id']);
    expect(parseManifest('{').problems).toHaveLength(1);
    expect(parseManifest('{"apps": {}}').problems).toEqual(['must be an object with an "apps" array']);
  });

  it('passes git no tokens, no credential helper and no outside configuration', async () => {
    const { gitEnvironment, GIT_OPTIONS } = await script<FetchScript>('fetch-real-apps.mjs');
    const env = gitEnvironment(
      {
        PATH: '/usr/bin',
        GITHUB_TOKEN: 'x',
        GH_TOKEN: 'x',
        NPM_TOKEN: 'x',
        GIT_ASKPASS: '/bin/askpass',
        SSH_AUTH_SOCK: '/tmp/agent',
        HTTPS_PROXY: 'http://user:password@proxy:8080',
        NO_PROXY: 'localhost',
      },
      '/cache/.empty-gitconfig',
    );
    expect(env).toEqual({
      PATH: '/usr/bin',
      NO_PROXY: 'localhost',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/cache/.empty-gitconfig',
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
      GIT_LFS_SKIP_SMUDGE: '1',
    });
    const options = GIT_OPTIONS.filter((_, index) => index % 2 === 1);
    expect(options).toContain('credential.helper=');
    expect(options).toContain('protocol.allow=never');
    expect(options).toContain('protocol.https.allow=always');
  });

  it('starts only git, without a shell, and never installs or runs project scripts', () => {
    const source = read('scripts/fetch-real-apps.mjs');
    const spawns = [...source.matchAll(/spawnSync\(([^,]+),/g)].map((match) => match[1]);
    expect(spawns).toEqual(["'git'"]);
    expect(source).toContain('shell: false');
    expect(source).not.toMatch(/\bexecSync\b|(?<!\.)\bexec\(|\bexecFile|\bfork\(|\bspawn\(|shell: true|(npm|pnpm|yarn) (ci|install|run)/);
  });
});

describe('labelled scan results', () => {
  it('labels every finding tp or fp with a one-sentence reason and covers every app', async () => {
    const list = await apps();
    const { labelProblems } = await script<ScanScript>('scan-real-apps.mjs');
    expect(labelProblems(results, list)).toEqual([]);
    expect(results.apps.map((app) => app.id)).toEqual(list.map((app) => app.id));
    for (const finding of results.findings) {
      expect(['tp', 'fp']).toContain(finding.label);
      expect(finding.reason.trim()).not.toBe('');
      expect(finding.reason.trim()).toMatch(/^[^\n]+\.$/);
    }
  });

  it('reports unlabelled findings, missing reasons and apps outside the manifest', async () => {
    const list = await apps();
    const { labelProblems } = await script<ScanScript>('scan-real-apps.mjs');
    const first = list[0] as App;
    const finding: Finding = {
      app: first.id,
      file: 'angular.json',
      line: 3,
      column: 5,
      entryId: 'some-entry',
      api: 'some API',
      family: 'builder',
      confidence: 'confirmed',
      major: 19,
      label: 'unlabelled',
      reason: ' ',
    };
    const broken: Results = {
      scan: results.scan,
      apps: [...results.apps, { id: 'unknown-app', filesScanned: 1, unscanned: 0, rxjs: null }],
      findings: [finding, { ...finding, app: 'unknown-app', label: 'tp', reason: 'A reason.', family: 'other' }],
      fixed: [],
    };
    expect(labelProblems(broken, list)).toEqual([
      'unknown-app: scanned but not in the manifest',
      `${first.id} angular.json:3 some-entry: label must be tp or fp`,
      `${first.id} angular.json:3 some-entry: reason missing`,
      'unknown-app angular.json:3 some-entry: unknown app',
      'unknown-app angular.json:3 some-entry: unknown family',
    ]);
  });

  it('holds only paths, positions, entry ids, API names and labels, no application source', () => {
    const keys = ['app', 'file', 'line', 'column', 'entryId', 'api', 'family', 'confidence', 'major', 'label', 'reason'];
    expect(Object.keys(results).sort()).toEqual(['apps', 'baseline', 'findings', 'fixed', 'scan']);
    for (const app of results.apps) expect(Object.keys(app)).toEqual(['id', 'filesScanned', 'unscanned', 'rxjs']);
    for (const finding of results.findings) {
      expect(Object.keys(finding)).toEqual(finding.label === 'fp' ? [...keys, 'notFixed'] : keys);
      expect(finding.reason.length).toBeLessThanOrEqual(240);
      expect(finding.file).not.toMatch(/^\/|^[A-Za-z]:|\.\./);
    }
    for (const finding of results.fixed) {
      expect(Object.keys(finding)).toEqual([...keys, 'fix', 'test']);
      expect(finding.reason.length).toBeLessThanOrEqual(240);
      expect(finding.file).not.toMatch(/^\/|^[A-Za-z]:|\.\./);
    }
  });

  it('fixes every false positive or keeps it with a reason, and keeps fixed ones out of the findings', async () => {
    const list = await apps();
    const { labelProblems } = await script<ScanScript>('scan-real-apps.mjs');
    const fp = falsePositive((list[0] as App).id);
    const fixed: FixedFinding = { ...fp, fix: 'The matcher now checks the import.', test: 'test/scan/scan.test.ts' };
    const base = { scan: results.scan, apps: results.apps };
    const where = `${fp.app} src/app/a.ts:4 some-entry`;
    expect(labelProblems({ ...base, findings: [{ ...fp, notFixed: 'Needs type information.' }], fixed: [] }, list)).toEqual([]);
    expect(labelProblems({ ...base, findings: [], fixed: [fixed] }, list)).toEqual([]);
    expect(labelProblems({ ...base, findings: [fp], fixed: [] }, list)).toEqual([
      `${where}: false positive neither fixed nor given a notFixed reason`,
    ]);
    expect(labelProblems({ ...base, findings: [{ ...fp, label: 'tp', notFixed: 'x' }], fixed: [] }, list)).toEqual([
      `${where}: notFixed is only for false positives`,
    ]);
    const broken = { ...fixed, label: 'tp', fix: ' ', test: '' };
    expect(labelProblems({ ...base, findings: [{ ...fp, notFixed: 'x' }], fixed: [broken] }, list)).toEqual([
      `fixed ${where}: only false positives can be fixed`,
      `fixed ${where}: fix missing`,
      `fixed ${where}: regression test missing`,
      `fixed ${where}: still in the findings`,
    ]);
  });

  it('gives each finding the rule family of its dataset entry', async () => {
    const { familyOf, majorOfEntry } = await script<ScanScript>('scan-real-apps.mjs');
    const all = [...REMOVED_APIS.entries, ...DEPRECATED_APIS.entries, ...RXJS_APIS.entries];
    const entries = new Map(all.map((entry) => [entry.id, entry]));
    for (const finding of results.findings) {
      const entry = entries.get(finding.entryId);
      // Entries removed from the dataset later are caught by `scan-real-apps.mjs --check`.
      if (entry) {
        expect(familyOf(entry)).toBe(finding.family);
        expect(majorOfEntry(entry)).toBe(finding.major);
        expect(entry.label).toBe(finding.api);
      }
    }
  });

  it('puts Material and CDK, deprecations and RxJS entries in their own families', async () => {
    const { familyOf, majorOfEntry } = await script<ScanScript>('scan-real-apps.mjs');
    const families = (entries: readonly unknown[]) => new Set(entries.map(familyOf));
    expect(families(DEPRECATED_APIS.entries)).toEqual(new Set(['deprecation']));
    expect(families(RXJS_APIS.entries)).toEqual(new Set(['rxjs']));
    const components = REMOVED_APIS.entries.filter((entry) => /^@angular\/(material|cdk)(\/|$)/.test(entry.package));
    expect(components.length).toBeGreaterThan(0);
    expect(families(components)).toEqual(new Set(['components']));
    const angular = REMOVED_APIS.entries.filter((entry) => !components.includes(entry));
    expect([...families(angular)].sort()).toEqual(['builder', 'builder-option', 'config-path', 'symbol', 'template']);
    for (const entry of DEPRECATED_APIS.entries) expect(majorOfEntry(entry)).toBe(entry.removalMajor);
    for (const entry of RXJS_APIS.entries) expect(majorOfEntry(entry)).toBe(7);
    for (const entry of REMOVED_APIS.entries) expect(majorOfEntry(entry)).toBe(entry.major);
  });

  it('counts a finding as listed in a plan the way the plan attaches it', async () => {
    const { listedInPlan } = await script<ScanScript>('scan-real-apps.mjs');
    const base = falsePositive('app');
    const removed = { ...base, family: 'symbol', major: 16 };
    expect(listedInPlan(removed, 15, null, 22)).toBe(true);
    expect(listedInPlan(removed, 16, null, 22)).toBe(false);
    expect(listedInPlan(removed, 13, null, 15)).toBe(false);
    // A deprecation removed in 23 warns in the hop to 22.
    const deprecation = { ...base, family: 'deprecation', major: 23 };
    expect(listedInPlan(deprecation, 19, null, 22)).toBe(true);
    expect(listedInPlan(deprecation, 22, null, 22)).toBe(false);
    expect(listedInPlan(deprecation, 19, null, 21)).toBe(false);
    expect(listedInPlan({ ...deprecation, major: 24 }, 19, null, 22)).toBe(false);
    const rxjs = { ...base, family: 'rxjs', major: 7 };
    expect(listedInPlan(rxjs, 19, '6.6.7', 22)).toBe(true);
    expect(listedInPlan(rxjs, 9, '7.8.1', 22)).toBe(false);
    expect(listedInPlan(rxjs, 9, null, 22)).toBe(false);
  });

  it('records the data the CLI scans with and the installed rxjs of every app', () => {
    expect(results.scan.entries).toBe(REMOVED_APIS.entries.length);
    expect(results.scan.dataRetrieved).toBe(REMOVED_APIS.retrieved);
    expect(results.scan.deprecationEntries).toBe(DEPRECATED_APIS.entries.length);
    expect(results.scan.deprecationsRetrieved).toBe(DEPRECATED_APIS.retrieved);
    expect(results.scan.rxjsEntries).toBe(RXJS_APIS.entries.length);
    expect(results.scan.rxjsRetrieved).toBe(RXJS_APIS.retrieved);
    expect(results.scan.target).toBe(Math.max(...REMOVED_APIS.entries.map((entry) => entry.major)));
    for (const app of results.apps) expect(app.rxjs === null || /^\d+\.\d+\.\d+/.test(app.rxjs)).toBe(true);
  });
});

describe('scan-precision.md', () => {
  it('is exactly what the script generates from the JSON', async () => {
    const { renderMarkdown } = await script<ScanScript>('scan-real-apps.mjs');
    expect(markdown).toBe(renderMarkdown(results, await apps()));
  });

  it('shows precision before and after the fixes per rule family and per app', async () => {
    const list = await apps();
    const { renderMarkdown } = await script<ScanScript>('scan-real-apps.mjs');
    const app = list[0] as App;
    const fp = falsePositive(app.id);
    const text = renderMarkdown(
      {
        scan: results.scan,
        apps: results.apps,
        findings: [{ ...fp, line: 9, label: 'tp', reason: 'A use of the API.' }, { ...fp, line: 12, notFixed: 'Needs type information.' }],
        fixed: [{ ...fp, fix: 'The matcher now checks the import.', test: 'test/scan/scan.test.ts' }],
      },
      list,
    );
    expect(text).toContain('False positives fixed: 1. Not fixed: 1.');
    expect(text).toContain('| TypeScript symbol | heuristic | 3 | 2 | 33.3% | 2 | 1 | 50.0% |');
    expect(text).toContain('| All families | all | 3 | 2 | 33.3% | 2 | 1 | 50.0% |');
    expect(text).toContain(`| ${app.id} | 3 | 2 | 33.3% | 2 | 1 | 50.0% |`);
    expect(text).toContain('| Not a use of the API. | The matcher now checks the import. | test/scan/scan.test.ts |');
    expect(text).toContain('| Not a use of the API. | Needs type information. |');

    const kept = results.findings.filter((finding) => finding.label === 'fp').length;
    if (results.fixed.length === 0 && kept === 0) {
      expect(markdown).toContain('No false positive was found, so neither the scan nor the data was changed');
    } else {
      expect(markdown).toContain(`False positives fixed: ${results.fixed.length}. Not fixed: ${kept}.`);
    }
    const counts = (own: Finding[]) => {
      const n = own.filter((finding) => finding.label === 'fp').length;
      return `${own.length} | ${n} | ${precision(own.length - n, n)}`;
    };
    const all = [...results.findings, ...results.fixed];
    for (const item of list) {
      const own = (finding: Finding) => finding.app === item.id;
      expect(markdown).toContain(`| ${item.id} | ${counts(all.filter(own))} | ${counts(results.findings.filter(own))} |`);
    }
    expect(markdown).toContain(`| All families | all | ${counts(all)} | ${counts(results.findings)} |`);
  });

  it('reports the counts of the JSON per app and in total, and says recall is not measured', async () => {
    const tp = results.findings.filter((finding) => finding.label === 'tp').length;
    const fp = results.findings.filter((finding) => finding.label === 'fp').length;
    expect(markdown).toContain(`| ${tp + fp} | ${precision(tp, fp)} | ${tp} | ${fp} |`);
    for (const app of await apps()) {
      const own = results.findings.filter((finding) => finding.app === app.id);
      const appTp = own.filter((finding) => finding.label === 'tp').length;
      const appFp = own.length - appTp;
      expect(markdown).toContain(`| ${app.id} | ${app.angular} | ${own.length} | ${appTp} | ${appFp} | ${precision(appTp, appFp)} |`);
      expect(markdown).toContain(app.commit);
      expect(markdown).toContain(app.licenseUrl);
    }
    for (const [family, title] of [
      ['symbol', 'TypeScript symbol'],
      ['template', 'Template pattern'],
      ['config-path', 'Config path'],
      ['builder-option', 'Builder option'],
      ['builder', 'Builder'],
      ['components', 'Material and CDK'],
      ['deprecation', 'Deprecation warning'],
      ['rxjs', 'RxJS 7 change'],
    ]) {
      for (const confidence of ['confirmed', 'heuristic']) {
        const own = results.findings.filter((finding) => finding.family === family && finding.confidence === confidence);
        const famTp = own.filter((finding) => finding.label === 'tp').length;
        const famFp = own.length - famTp;
        expect(markdown).toContain(`| ${title} | ${confidence} | ${own.length} | ${famTp} | ${famFp} | ${precision(famTp, famFp)} |`);
      }
    }
    expect(markdown).toContain('**Recall is not measured.**');
  });
});

describe('earlier baseline', () => {
  const baseline = results.baseline as Baseline;

  it('keeps the counts of the first measurement, with the removed-API families only', () => {
    expect(baseline.scan.date <= results.scan.date).toBe(true);
    const old = ['symbol', 'template', 'config-path', 'builder-option', 'builder'];
    expect([...new Set(baseline.families.map((row) => row.family))]).toEqual(old);
    const sum = (rows: Counts[]) => rows.reduce((total, row) => total + row.total, 0);
    expect(sum(baseline.families)).toBe(baseline.total.total);
    expect(sum(baseline.apps)).toBe(baseline.total.total);
    for (const row of [...baseline.families, ...baseline.apps, baseline.total, baseline.listed]) {
      expect(row.tp + row.fp).toBe(row.total);
    }
  });

  it('is shown next to the numbers of this run', async () => {
    expect(markdown).toContain('## Earlier baseline');
    expect(markdown).toContain(
      `ran the scan of ng-upgrade-planner ${baseline.scan.version} with the Angular removed-API data only ` +
        `(read ${baseline.scan.dataRetrieved}, ${baseline.scan.entries} entries). It found ${baseline.total.total} findings`,
    );
    const now = (own: Finding[]) => {
      const fp = own.filter((finding) => finding.label === 'fp').length;
      return `${own.length} | ${fp} | ${precision(own.length - fp, fp)}`;
    };
    const then = (row: Counts) => `${row.total} | ${row.fp} | ${precision(row.tp, row.fp)}`;
    expect(markdown).toContain(`| All families | all | ${then(baseline.total)} | ${now(results.findings)} |`);
    for (const app of await apps()) {
      const row = baseline.apps.find((item) => item.app === app.id) as Counts;
      expect(markdown).toContain(`| ${app.id} | ${then(row)} | ${now(results.findings.filter((f) => f.app === app.id))} |`);
    }
    expect(markdown).toContain('| Deprecation warning | confirmed | not scanned | not scanned | not scanned |');
  });
});
