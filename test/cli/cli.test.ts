// Runs the compiled CLI as a child process against a temporary project and a temporary registry
// cache written here. The sources are compiled into .cache/test-build first, so these tests do
// not depend on `npm run build` having run. The child loads a guard that blocks and reports any
// network use, so the tests also prove that a warm cache needs no network.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RecordCache } from '../../src/registry/cache.js';
import type { PackageRecord } from '../../src/registry/types.js';
import { angularRecords, record } from '../plan/helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const created: string[] = [];
let buildDir: string;
let cli: string;
let guard: string;

const GUARD = `import net from 'node:net';
const block = (what) => {
  process.stderr.write('NETWORK-ATTEMPT ' + what + '\\n');
  throw new Error('network access is blocked in tests');
};
globalThis.fetch = (input) => block(String(input));
net.Socket.prototype.connect = function () { block('socket'); };
`;

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[], cwd: string, env: Record<string, string> = {}): Run {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  delete childEnv.NODE_OPTIONS;
  const result = spawnSync(process.execPath, ['--import', pathToFileURL(guard).href, cli, ...args], {
    cwd,
    env: childEnv,
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const fresh = (value: PackageRecord): PackageRecord => ({ ...value, fetchedAt: new Date().toISOString() });

function cacheRecords(): PackageRecord[] {
  return [
    ...angularRecords(),
    record('@ngrx/store', {
      '14.3.3': { peerDependencies: { '@angular/core': '^14.0.0' } },
      '15.4.0': { peerDependencies: { '@angular/core': '^15.0.0' } },
      '16.3.0': { peerDependencies: { '@angular/core': '^16.0.0' } },
      '17.2.0': { peerDependencies: { '@angular/core': '^17.0.0' } },
    }),
    record('ngx-legacy-datepicker', {
      '2.0.0': { peerDependencies: { '@angular/core': '>=12.0.0 <15.0.0' }, deprecated: 'No longer maintained.' },
    }),
  ].map(fresh);
}

async function writeCache(dir: string): Promise<void> {
  const cache = new RecordCache(dir);
  for (const value of cacheRecords()) await cache.write(value);
}

function writeProject(dir: string): void {
  const pkg = {
    name: 'cli-demo',
    dependencies: {
      '@angular/common': '~14.2.0',
      '@angular/core': '~14.2.0',
      '@ngrx/store': '^14.3.0',
      'ngx-legacy-datepicker': '^2.0.0',
      rxjs: '~7.5.0',
      'zone.js': '~0.11.4',
    },
    devDependencies: { '@angular/cli': '~14.2.0', '@angular/compiler-cli': '~14.2.0', typescript: '~4.8.2' },
  };
  const versions: Record<string, string> = {
    '@angular/common': '14.2.12',
    '@angular/core': '14.2.12',
    '@angular/cli': '14.2.13',
    '@angular/compiler-cli': '14.2.12',
    '@ngrx/store': '14.3.3',
    'ngx-legacy-datepicker': '2.0.0',
    rxjs: '7.5.7',
    typescript: '4.8.4',
    'zone.js': '0.11.8',
  };
  const packages: Record<string, unknown> = { '': { name: 'cli-demo' } };
  for (const [name, version] of Object.entries(versions)) packages[`node_modules/${name}`] = { version };
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ name: 'cli-demo', lockfileVersion: 3, packages }, null, 2));
}

let project: string;
let cacheDir: string;

beforeAll(async () => {
  buildDir = path.join(root, '.cache', 'test-build', `${process.pid}-${Date.now()}`);
  mkdirSync(buildDir, { recursive: true });
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  const build = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.build.json', '--outDir', path.join(buildDir, 'dist')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (build.status !== 0) throw new Error(`Compiling the CLI failed:\n${build.stdout}${build.stderr}`);
  // dist/cli.js reads ../package.json for its version, as in the published package.
  copyFileSync(path.join(root, 'package.json'), path.join(buildDir, 'package.json'));
  cli = path.join(buildDir, 'dist', 'cli.js');
  guard = path.join(buildDir, 'network-guard.mjs');
  writeFileSync(guard, GUARD);

  project = tempDir('ngup-cli-project-');
  writeProject(project);
  cacheDir = tempDir('ngup-cli-cache-');
  await writeCache(cacheDir);
}, 180_000);

afterAll(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
  if (buildDir) rmSync(buildDir, { recursive: true, force: true });
});

const reportFiles = (dir: string): string[] => readdirSync(dir).filter((name) => name.startsWith('ng-upgrade-plan')).sort();

function expectNoNetwork(result: Run): void {
  expect(result.stderr).not.toContain('NETWORK-ATTEMPT');
}

describe('successful runs', () => {
  it('plans to the latest release from the offline cache, writes the reports and exits 0 despite a blocker', () => {
    const result = run(['--offline', '--cache-dir', cacheDir], project);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Angular upgrade plan for cli-demo\nCurrent: Angular 14.2.12\nTarget:  Angular 17 (17.3.12, latest release)\n');
    expect(result.stdout).toContain('Hop 1: Angular 14 to 15 (15.2.10), effort');
    expect(result.stdout).toContain('Hop 3: Angular 16 to 17 (17.3.12), effort');
    expect(result.stdout).toContain('    @ngrx/store 14.3.3 to 15.4.0, major\n');
    expect(result.stdout).toContain('  Blockers: 1\n    ngx-legacy-datepicker: No release accepts Angular 15');
    const md = path.join(project, 'ng-upgrade-plan.md');
    const html = path.join(project, 'ng-upgrade-plan.html');
    const json = path.join(project, 'ng-upgrade-plan.json');
    expect(result.stdout).toContain(`Reports:\n  ${md}\n  ${html}\n  ${json}\n`);
    // Piped output is not a terminal: no colour codes.
    expect(result.stdout).not.toContain('\u001b');
    expect(reportFiles(project)).toEqual(['ng-upgrade-plan.html', 'ng-upgrade-plan.json', 'ng-upgrade-plan.md']);
    const markdown = readFileSync(md, 'utf8');
    expect(markdown).toContain('# Angular upgrade plan for cli-demo');
    expect(markdown).toContain('Generated by ng-upgrade-planner 0.2.0.');
    expect(markdown).toContain('## Hop 3: Angular 16 to 17');
    expect(markdown).toContain('ng update @angular/core@17 @angular/cli@17');
    expect(markdown).toContain('| `ngx-legacy-datepicker` | 2.0.0 | none |');
    expect(markdown).toContain('### Could not be verified');
    const page = readFileSync(html, 'utf8');
    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(page).toContain('<h2 id="hop-17-title">Hop 3: Angular 16 to 17</h2>');
    expect(page).not.toMatch(/<script/i);
    const document = JSON.parse(readFileSync(json, 'utf8')) as { schemaVersion: number; tool: { version: string } };
    expect(document.schemaVersion).toBe(1);
    expect(document.tool.version).toBe('0.2.0');
    expectNoNetwork(result);
  });

  it('uses a fresh cache without the network, honours --to and --out-dir, and works with --cwd', () => {
    const out = path.join(tempDir('ngup-cli-out-'), 'nested', 'reports');
    const elsewhere = tempDir('ngup-cli-elsewhere-');
    const result = run(['--cwd', project, '--to', '15', '--out-dir', out, '--cache-dir', cacheDir, '--registry', 'https://registry.example.invalid'], elsewhere);
    expectNoNetwork(result);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Target:  Angular 15 (15.2.10)\n');
    expect(result.stdout).toContain('Total effort:');
    expect(result.stdout).not.toContain('Hop 2:');
    expect(reportFiles(out)).toEqual(['ng-upgrade-plan.html', 'ng-upgrade-plan.json', 'ng-upgrade-plan.md']);
    expect(readdirSync(elsewhere)).toEqual([]);
  });

  it('writes nothing with --no-report', () => {
    const dir = tempDir('ngup-cli-noreport-');
    writeProject(dir);
    const result = run(['--offline', '--cache-dir', cacheDir, '--to', '16', '--no-report'], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Reports: not written (--no-report).');
    expect(reportFiles(dir)).toEqual([]);
    expect(readdirSync(dir).sort()).toEqual(['package-lock.json', 'package.json']);
  });

  it('prints help and version', () => {
    const help = run(['--help'], project);
    expect(help.status).toBe(0);
    for (const option of ['--cwd', '--to', '--offline', '--registry', '--cache-dir', '--out-dir', '--no-report', '--no-scan', '--json', '--help', '--version']) {
      expect(help.stdout).toContain(option);
    }
    expect(help.stdout).not.toMatch(/—/);
    const version = run(['--version'], project);
    expect(version.status).toBe(0);
    expect(version.stdout).toBe(`${(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version}\n`);
  });
});

describe('JSON output', () => {
  interface Document {
    schemaVersion: number;
    tool: { name: string; version: string };
    target: { major: number };
    message: string | null;
    hops: { from: number; to: number; commands: string[]; blockers: { name: string }[]; libraries: { name: string; to: string | null }[] }[];
  }

  it('--json prints only the JSON document and writes the same document next to the other reports', () => {
    const dir = tempDir('ngup-cli-json-');
    writeProject(dir);
    const result = run(['--offline', '--cache-dir', cacheDir, '--json'], dir);
    expectNoNetwork(result);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const document = JSON.parse(result.stdout) as Document;
    expect(result.stdout.endsWith('}\n')).toBe(true);
    expect(result.stdout).not.toContain('Angular upgrade plan for');
    expect(result.stdout).not.toContain('Reports:');
    expect(document.schemaVersion).toBe(1);
    expect(document.tool).toEqual({ name: 'ng-upgrade-planner', version: '0.2.0' });
    expect(document.hops.map((hop) => hop.to)).toEqual([15, 16, 17]);
    expect(document.hops[0]!.commands).toEqual(['ng update @angular/core@15 @angular/cli@15']);
    expect(document.hops[0]!.blockers.map((blocker) => blocker.name)).toEqual(['ngx-legacy-datepicker']);
    expect(document.hops[0]!.libraries.find((library) => library.name === '@ngrx/store')?.to).toBe('15.4.0');
    expect(reportFiles(dir)).toEqual(['ng-upgrade-plan.html', 'ng-upgrade-plan.json', 'ng-upgrade-plan.md']);
    expect(readFileSync(path.join(dir, 'ng-upgrade-plan.json'), 'utf8')).toBe(result.stdout);
  });

  it('--json with --no-report writes no file', () => {
    const dir = tempDir('ngup-cli-json-noreport-');
    writeProject(dir);
    const result = run(['--offline', '--cache-dir', cacheDir, '--json', '--no-report', '--to', '16'], dir);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const document = JSON.parse(result.stdout) as Document;
    expect(document.target.major).toBe(16);
    expect(readdirSync(dir).sort()).toEqual(['package-lock.json', 'package.json']);
  });

  it('--json prints a document with no hops when there is nothing to plan', () => {
    const result = run(['--offline', '--cache-dir', cacheDir, '--json', '--no-report', '--to', '14'], project);
    expect(result.status).toBe(0);
    const document = JSON.parse(result.stdout) as Document;
    expect(document.hops).toEqual([]);
    expect(document.message).toEqual(expect.any(String));
  });

  it('--json keeps errors on stderr and prints nothing on stdout', () => {
    const result = run(['--offline', '--cache-dir', cacheDir, '--json', '--to', '12', '--no-report'], project);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^ng-upgrade-planner: [^\n]+\n$/);
  });
});

describe('removed-API scan', () => {
  // Synthetic source written for this test, not taken from any app.
  const LEGACY = "import { ReflectiveInjector } from '@angular/core';\n\nexport const injector = ReflectiveInjector.resolveAndCreate([]);\n";

  function writeSource(dir: string): void {
    mkdirSync(path.join(dir, 'src', 'app'), { recursive: true });
    writeFileSync(path.join(dir, 'src', 'app', 'legacy.ts'), LEGACY);
    writeFileSync(path.join(dir, 'src', 'app', 'clean.ts'), "import { Injector } from '@angular/core';\n\nexport const make = Injector.create;\n");
    // Dependencies are never scanned.
    mkdirSync(path.join(dir, 'node_modules', 'some-lib'), { recursive: true });
    writeFileSync(path.join(dir, 'node_modules', 'some-lib', 'index.ts'), LEGACY);
  }

  it('runs by default and attaches a finding to the hop where it must be fixed', () => {
    const dir = tempDir('ngup-cli-scan-');
    writeProject(dir);
    writeSource(dir);
    const result = run(['--offline', '--cache-dir', cacheDir], dir);
    expectNoNetwork(result);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Source scan: 2 files, 1 finding\n');
    const hop2 = result.stdout.slice(result.stdout.indexOf('Hop 2:'), result.stdout.indexOf('Hop 3:'));
    expect(hop2).toContain(
      '  Removed APIs: 1 use of 1 API (1 confirmed, 0 heuristic)\n    src/app/legacy.ts:1 ReflectiveInjector (@angular/core); replacement: ',
    );
    expect(hop2).toContain('; fixed by ng update migration: no\n');
    expect(result.stdout).not.toContain('node_modules');
    const markdown = readFileSync(path.join(dir, 'ng-upgrade-plan.md'), 'utf8');
    expect(markdown).toContain('| `src/app/legacy.ts:1` | `ReflectiveInjector` from `@angular/core` | removed |');
    expect(markdown).toContain('| Source scan | 2 files, 1 finding |');
    const html = readFileSync(path.join(dir, 'ng-upgrade-plan.html'), 'utf8');
    expect(html).toContain('<th scope="row"><code>src/app/legacy.ts:1</code></th><td><code>ReflectiveInjector</code>');
    // A second run does not scan the reports the first one wrote.
    expect(run(['--offline', '--cache-dir', cacheDir], dir).stdout).toContain('Source scan: 2 files, 1 finding\n');
  });

  it('is turned off with --no-scan', () => {
    const dir = tempDir('ngup-cli-noscan-');
    writeProject(dir);
    writeSource(dir);
    const result = run(['--offline', '--cache-dir', cacheDir, '--no-scan'], dir);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Source scan: turned off (--no-scan)\n');
    expect(result.stdout).toContain('  Removed APIs: Not checked: the scan was turned off.\n');
    expect(result.stdout).not.toContain('legacy.ts');
    const markdown = readFileSync(path.join(dir, 'ng-upgrade-plan.md'), 'utf8');
    expect(markdown).toContain('| Source scan | turned off |');
    expect(markdown).toContain('| removed-API scan | the scan was turned off, so the source was not checked');
  });
});

describe('usage errors exit 2', () => {
  const cases: [string, string[], RegExp][] = [
    ['an unknown option', ['--bogus'], /Unknown option "--bogus"\./],
    ['an unknown short option', ['-x'], /Unknown option "-x"\./],
    ['a positional argument', ['extra'], /Unexpected argument "extra"/],
    ['a missing value', ['--to'], /Option --to needs a value\./],
    ['an invalid target', ['--to', 'abc'], /--to must be an Angular major version such as 18 \(got "abc"\)/],
    ['a target below 2', ['--to', '1'], /--to must be an Angular major version/],
    ['an empty folder option', ['--cwd='], /Option --cwd needs a value\./],
    ['a non-http registry', ['--registry', 'ftp://registry.example'], /Registry URL must start with https:\/\/ or http:\/\//],
    ['a registry with credentials', ['--registry', 'https://user:secret@registry.example'], /must not contain a user name or password/],
  ];
  it.each(cases)('for %s', (_name, args, message) => {
    const dir = tempDir('ngup-cli-usage-');
    writeProject(dir);
    const result = run([...args, '--cache-dir', cacheDir], dir);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(message);
    expect(result.stderr).toMatch(/^ng-upgrade-planner: [^\n]+\nRun "ng-upgrade-planner --help" for usage\.\n$/);
    expect(result.stderr).not.toContain('secret');
    expect(reportFiles(dir)).toEqual([]);
  });
});

describe('project and planning errors exit 1 with one line', () => {
  function expectError(result: Run, message: RegExp): void {
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^ng-upgrade-planner: [^\n]+\n$/);
    expect(result.stderr).not.toContain('unexpected error');
    expect(result.stderr).toMatch(message);
  }

  it('when there is no package.json', () => {
    expectError(run(['--offline', '--cache-dir', cacheDir], tempDir('ngup-cli-empty-')), /package\.json/);
  });

  it('when the latest Angular release is not in the offline cache', () => {
    const result = run(['--offline', '--cache-dir', tempDir('ngup-cli-emptycache-')], project);
    expectError(result, /Could not find the latest Angular version/);
    expectNoNetwork(result);
  });

  it('when the target is below the installed version', () => {
    expectError(run(['--offline', '--cache-dir', cacheDir, '--to', '12', '--no-report'], project), /lower than the installed Angular 14/);
  });

  it('when the reports cannot be written', () => {
    const file = path.join(tempDir('ngup-cli-file-'), 'not-a-folder');
    writeFileSync(file, 'x');
    expectError(run(['--offline', '--cache-dir', cacheDir, '--to', '15', '--out-dir', file], project), /Could not write the reports to /);
    expect(existsSync(path.join(file, 'ng-upgrade-plan.md'))).toBe(false);
  });
});
