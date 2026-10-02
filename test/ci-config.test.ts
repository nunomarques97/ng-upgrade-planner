// Checks the release tooling: the GitHub Actions workflow matches the local "ci" script, the
// npm package check rejects unwanted files, the docs check catches its failure cases, and the
// example report in README.md is still a verbatim excerpt of a fixture snapshot.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const created: string[] = [];

afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

interface PackageJson {
  scripts: Record<string, string>;
  engines: { node: string };
  files: string[];
}

interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface Workflow {
  on: Record<string, unknown>;
  jobs: Record<string, { strategy?: { matrix?: { node?: unknown[] } }; steps: Step[] }>;
}

interface CheckPack {
  packProblems: (files: string[], cliText?: string) => string[];
  SKILL_DIR: string;
}

interface CheckDocs {
  checkDocs: (root: string) => string[];
  WALKTHROUGH_MAX_WORDS: number;
}

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as PackageJson;
const workflow = parse(readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8')) as Workflow;

async function script<T>(name: string): Promise<T> {
  return (await import(pathToFileURL(path.join(root, 'scripts', name)).href)) as T;
}

/** Maps "npm test" and "npm run <name>" to a script name; anything else to null. */
function npmScript(command: string): string | null {
  const text = command.trim();
  if (/^npm (test|t)$/.test(text)) return 'test';
  return /^npm run ([\w:.-]+)$/.exec(text)?.[1] ?? null;
}

describe('GitHub Actions workflow', () => {
  const jobs = Object.values(workflow.jobs);

  it('runs on push and pull requests', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push']);
  });

  it('tests on Node.js 20 and 22 with the matrix version', () => {
    expect(jobs).toHaveLength(1);
    const job = jobs[0]!;
    expect((job.strategy?.matrix?.node ?? []).map(String)).toEqual(['20', '22']);
    const setup = job.steps.find((step) => step.uses?.startsWith('actions/setup-node@'));
    expect(setup?.with?.['node-version']).toBe('${{ matrix.node }}');
  });

  it('installs with npm ci, then runs only existing npm scripts, in the order of the ci script', () => {
    const runs = jobs[0]!.steps.flatMap((step) => (step.run === undefined ? [] : [step.run.trim()]));
    expect(runs[0]).toBe('npm ci');
    const names = runs.slice(1).map((command) => {
      const name = npmScript(command);
      expect(name, `"${command}" is not an npm script step`).not.toBeNull();
      expect(pkg.scripts, `"${command}" names a missing script`).toHaveProperty([name!]);
      return name!;
    });
    const local = pkg.scripts.ci!.split('&&').map((command) => npmScript(command));
    expect(names).toEqual(local);
    for (const required of ['lint', 'typecheck', 'test', 'build', 'check:pack']) expect(names).toContain(required);
    expect(names.indexOf('build')).toBeLessThan(names.indexOf('check:pack'));
  });

  it('matches the Node.js versions the package supports', () => {
    expect(pkg.engines.node).toBe('>=20');
  });
});

describe('check-pack', () => {
  const clean = [
    'package.json',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'dist/cli.js',
    'dist/index.js',
    'dist/plan/build-plan.js',
    'skills/angular-upgrade-hops/SKILL.md',
    'skills/angular-upgrade-hops/references/plan-json.md',
  ];
  const cli = '#!/usr/bin/env node\n// entry point\n';

  it('packs the skills folder, and its skill is the one in the repository', async () => {
    const { SKILL_DIR } = await script<CheckPack>('check-pack.mjs');
    expect(pkg.files).toEqual(['dist', 'skills', 'CHANGELOG.md']);
    expect(SKILL_DIR).toBe('skills/angular-upgrade-hops');
    expect(readdirSync(path.join(root, 'skills'))).toEqual(['angular-upgrade-hops']);
  });

  it('accepts the expected package contents', async () => {
    const { packProblems } = await script<CheckPack>('check-pack.mjs');
    expect(packProblems(clean, cli)).toEqual([]);
    expect(packProblems(clean.map((file) => file.replace(/\//g, '\\')), cli)).toEqual([]);
  });

  it.each([
    ['a test file', 'dist/plan/build-plan.test.js'],
    ['a test folder', 'dist/test/helpers.js'],
    ['a fixture', 'test/fixtures/apps/app/package.json'],
    ['a fixture under dist', 'dist/fixtures/registry.js'],
    ['a source map', 'dist/cli.js.map'],
    ['a TypeScript source', 'src/cli.ts'],
    ['a declaration under dist', 'dist/cli.d.ts'],
    ['a document', 'docs/STATE.md'],
    ['a root dotfile', '.npmrc'],
    ['a dotfile under dist', 'dist/.env'],
    ['an unexpected root file', 'CONTRIBUTING.md'],
    ['a non-JavaScript file under dist', 'dist/data/update-steps.json'],
    ['a snapshot', 'dist/__snapshots__/plan.js'],
    ['another skill', 'skills/other-skill/SKILL.md'],
    ['a file at the top of skills/', 'skills/README.md'],
    ['a script in the skill', 'skills/angular-upgrade-hops/scripts/run.sh'],
    ['a JSON file in the skill', 'skills/angular-upgrade-hops/references/plan.json'],
    ['a dotfile in the skill', 'skills/angular-upgrade-hops/.env.md'],
  ])('rejects %s', async (_label, file) => {
    const { packProblems } = await script<CheckPack>('check-pack.mjs');
    const problems = packProblems([...clean, file], cli);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(file);
  });

  it.each(['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'dist/cli.js', 'skills/angular-upgrade-hops/SKILL.md'])('requires %s', async (file) => {
    const { packProblems } = await script<CheckPack>('check-pack.mjs');
    expect(packProblems(clean.filter((entry) => entry !== file), cli)).toEqual([`${file}: missing from the package`]);
  });

  it.each([
    ['no shebang', '// entry point\n'],
    ['a CRLF shebang', '#!/usr/bin/env node\r\n// entry point\r\n'],
    ['another interpreter', '#!/usr/bin/node\n'],
  ])('rejects dist/cli.js with %s', async (_label, text) => {
    const { packProblems } = await script<CheckPack>('check-pack.mjs');
    const problems = packProblems(clean, text);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('dist/cli.js');
  });
});

describe('check-docs', () => {
  const STATE = `---
status: v0.1 ready
sponsor_action: decide
kill_review: none
success_metric: correct plans
---

# State
`;

  function project(overrides: Record<string, string | null> = {}): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'ngup-docs-'));
    created.push(dir);
    const files: Record<string, string | null> = {
      'README.md': '# Readme\n',
      'CONTRIBUTING.md': '# Contributing\n',
      LICENSE: 'MIT\n',
      'CHANGELOG.md': '# Changelog\n',
      'docs/STATE.md': STATE,
      'docs/WALKTHROUGH.md': '# Walkthrough\n\nShort text.\n',
      'src/index.ts': 'export {};\n',
      ...overrides,
    };
    for (const [name, content] of Object.entries(files)) {
      if (content === null) continue;
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), content);
    }
    return dir;
  }

  it('accepts a complete set of documents', async () => {
    const { checkDocs } = await script<CheckDocs>('check-docs.mjs');
    expect(checkDocs(project())).toEqual([]);
    expect(checkDocs(project({ 'docs/STATE.md': STATE.replace(/\n/g, '\r\n') }))).toEqual([]);
  });

  it('passes on this repository', async () => {
    const { checkDocs } = await script<CheckDocs>('check-docs.mjs');
    expect(checkDocs(root)).toEqual([]);
  });

  it.each(['README.md', 'CONTRIBUTING.md', 'LICENSE', 'CHANGELOG.md', 'docs/STATE.md', 'docs/WALKTHROUGH.md'])(
    'reports a missing %s',
    async (file) => {
      const { checkDocs } = await script<CheckDocs>('check-docs.mjs');
      expect(checkDocs(project({ [file]: null }))).toEqual([`${file}: missing`]);
    },
  );

  it.each(['status', 'sponsor_action', 'kill_review', 'success_metric'])(
    'reports front-matter without %s',
    async (key) => {
      const { checkDocs } = await script<CheckDocs>('check-docs.mjs');
      const state = STATE.split('\n').filter((line) => !line.startsWith(`${key}:`)).join('\n');
      expect(checkDocs(project({ 'docs/STATE.md': state }))).toEqual([`docs/STATE.md: front-matter lacks "${key}"`]);
      const empty = STATE.replace(new RegExp(`^${key}:.*$`, 'm'), `${key}:`);
      expect(checkDocs(project({ 'docs/STATE.md': empty }))).toEqual([`docs/STATE.md: front-matter lacks "${key}"`]);
    },
  );

  it('reports a STATE.md without front-matter or with broken YAML', async () => {
    const { checkDocs } = await script<CheckDocs>('check-docs.mjs');
    expect(checkDocs(project({ 'docs/STATE.md': '# State\n' }))).toEqual([
      'docs/STATE.md: must start with YAML front-matter between "---" lines',
    ]);
    const broken = checkDocs(project({ 'docs/STATE.md': '---\nstatus: [unclosed\n---\n' }));
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain('not valid YAML');
  });

  it('reports a WALKTHROUGH.md over the word limit', async () => {
    const { checkDocs, WALKTHROUGH_MAX_WORDS } = await script<CheckDocs>('check-docs.mjs');
    const words = (count: number): string => `# Walkthrough\n\n${'word '.repeat(count - 1)}\n`;
    expect(checkDocs(project({ 'docs/WALKTHROUGH.md': words(WALKTHROUGH_MAX_WORDS) }))).toEqual([]);
    expect(checkDocs(project({ 'docs/WALKTHROUGH.md': words(WALKTHROUGH_MAX_WORDS + 1) }))).toEqual([
      `docs/WALKTHROUGH.md: ${WALKTHROUGH_MAX_WORDS + 1} words, the limit is ${WALKTHROUGH_MAX_WORDS}`,
    ]);
  });

  it.each(['src/plan/deep/file.ts', 'README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'docs/verification/notes.md'])(
    'reports an em-dash in %s',
    async (file) => {
      const { checkDocs } = await script<CheckDocs>('check-docs.mjs');
      const problems = checkDocs(project({ [file]: 'first line\nsecond \u2014 line\n' }));
      expect(problems).toEqual([`${file}:2: contains an em-dash`]);
    },
  );

  it('does not scan files outside the listed places', async () => {
    const { checkDocs } = await script<CheckDocs>('check-docs.mjs');
    expect(checkDocs(project({ 'scripts/tool.mjs': '// \u2014\n', LICENSE: 'MIT \u2014\n' }))).toEqual([]);
  });
});

describe('README example report', () => {
  it('is a verbatim excerpt of the jira-clone-angular-11 fixture snapshot', () => {
    const readme = readFileSync(path.join(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
    const match = /<!-- example:start -->\n([\s\S]*?)\n<!-- example:end -->/.exec(readme);
    expect(match, 'README.md has no example block').not.toBeNull();
    const snapshot = readFileSync(
      path.join(root, 'test', '__snapshots__', 'fixtures', 'jira-clone-angular-11.md'),
      'utf8',
    ).replace(/\r\n/g, '\n');
    const lines = new Set(snapshot.split('\n'));
    // The excerpt sits in a four-backtick fence; "..." marks skipped parts.
    const excerpt = match![1]!
      .split('\n')
      .filter((line) => line.trim() !== '' && line !== '...' && !line.startsWith('````'));
    expect(excerpt.length).toBeGreaterThan(10);
    for (const line of excerpt) expect(lines.has(line), line).toBe(true);
  });
});
