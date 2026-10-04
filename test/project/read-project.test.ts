import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectError, readProject, type ProjectErrorCode } from '../../src/project/index.js';

// Projects are written to a temporary directory from inline strings; test/fixtures is reserved
// for real open-source app files.
const created: string[] = [];

async function project(files: Record<string, string | object>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ngup-project-'));
  created.push(dir);
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function expectProjectError(dir: string, code: ProjectErrorCode): Promise<ProjectError> {
  let caught: unknown;
  try {
    await readProject(dir);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ProjectError);
  const error = caught as ProjectError;
  expect(error.code).toBe(code);
  expect(error.message).not.toMatch(/\n/);
  return error;
}

const pkg = {
  name: 'demo-app',
  engines: { node: '^18.19.0 || >=20.11.0' },
  dependencies: {
    '@angular/core': '~14.2.0',
    '@ngrx/store': '^14.3.0',
    rxjs: '~7.5.0',
  },
  devDependencies: {
    typescript: '~4.7.2',
  },
};

const npmLock = JSON.stringify({
  name: 'demo-app',
  lockfileVersion: 3,
  packages: {
    '': { name: 'demo-app' },
    'node_modules/@angular/core': { version: '14.2.12' },
    'node_modules/@ngrx/store': { version: '14.3.3' },
    'node_modules/rxjs': { version: '7.5.7' },
    'node_modules/typescript': { version: '4.7.4' },
  },
});

const pnpmLock = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      '@angular/core':
        specifier: ~14.2.0
        version: 14.2.10(rxjs@7.5.6)
      rxjs:
        specifier: ~7.5.0
        version: 7.5.6
`;

const yarnLock = `# yarn lockfile v1

"@angular/core@~14.2.0":
  version "14.2.11"
`;

describe('readProject', () => {
  it('reads every direct dependency with its range, resolved version and source', async () => {
    const dir = await project({ 'package.json': pkg, 'package-lock.json': npmLock });
    const info = await readProject(dir);
    expect(info.root).toBe(path.resolve(dir));
    expect(info.name).toBe('demo-app');
    expect(info.lockfile).toMatchObject({ kind: 'npm', file: 'package-lock.json', formatVersion: '3' });
    expect(info.angular).toEqual({ range: '~14.2.0', version: '14.2.12', source: 'lockfile' });
    expect(info.dependencies).toEqual([
      { name: '@angular/core', registryName: '@angular/core', kind: 'dependencies', range: '~14.2.0', version: '14.2.12', source: 'lockfile' },
      { name: '@ngrx/store', registryName: '@ngrx/store', kind: 'dependencies', range: '^14.3.0', version: '14.3.3', source: 'lockfile' },
      { name: 'rxjs', registryName: 'rxjs', kind: 'dependencies', range: '~7.5.0', version: '7.5.7', source: 'lockfile' },
      { name: 'typescript', registryName: 'typescript', kind: 'devDependencies', range: '~4.7.2', version: '4.7.4', source: 'lockfile' },
    ]);
    expect(info.nodeEngine).toEqual({ status: 'declared', range: '^18.19.0 || >=20.11.0' });
    expect(info.warnings).toEqual([]);
    // The result is plain data.
    expect(JSON.parse(JSON.stringify(info))).toEqual(info);
  });

  it('falls back to the range minimum, marked as such, when there is no lockfile', async () => {
    const dir = await project({ 'package.json': pkg });
    const info = await readProject(dir);
    expect(info.lockfile).toBeNull();
    expect(info.angular).toEqual({ range: '~14.2.0', version: '14.2.0', source: 'range-minimum' });
    expect(info.dependencies.find((d) => d.name === '@ngrx/store')).toMatchObject({ version: '14.3.0', source: 'range-minimum' });
    expect(info.warnings.map((w) => w.code)).toEqual(['no-lockfile']);
  });

  it('falls back per dependency when the lockfile has no entry for it', async () => {
    const dir = await project({ 'package.json': pkg, 'pnpm-lock.yaml': pnpmLock });
    const info = await readProject(dir);
    expect(info.lockfile).toMatchObject({ kind: 'pnpm', formatVersion: '9.0' });
    expect(info.angular).toEqual({ range: '~14.2.0', version: '14.2.10', source: 'lockfile' });
    expect(info.dependencies.find((d) => d.name === 'typescript')).toMatchObject({ version: '4.7.2', source: 'range-minimum' });
    expect(info.warnings.filter((w) => w.code === 'not-in-lockfile').map((w) => w.packageName)).toEqual([
      '@ngrx/store',
      'typescript',
    ]);
  });

  it('marks dependencies without a usable version as unresolved', async () => {
    const dir = await project({
      'package.json': {
        dependencies: {
          '@angular/core': '^15.0.0',
          'git-lib': 'github:example/git-lib',
          'tagged-lib': 'latest',
          'toastr-alias': 'npm:ngx-toastr@^16.0.0',
        },
      },
    });
    const info = await readProject(dir);
    expect(info.dependencies.find((d) => d.name === 'git-lib')).toMatchObject({ version: null, source: 'unresolved' });
    expect(info.dependencies.find((d) => d.name === 'tagged-lib')).toMatchObject({ version: null, source: 'unresolved' });
    expect(info.dependencies.find((d) => d.name === 'toastr-alias')).toMatchObject({
      registryName: 'ngx-toastr',
      version: '16.0.0',
      source: 'range-minimum',
    });
    expect(info.warnings.filter((w) => w.code === 'unresolved-version').map((w) => w.packageName)).toEqual([
      'git-lib',
      'tagged-lib',
    ]);
  });

  describe('lockfile selection', () => {
    it('uses a fixed order and warns when several lockfiles exist', async () => {
      const dir = await project({ 'package.json': pkg, 'yarn.lock': yarnLock, 'pnpm-lock.yaml': pnpmLock, 'package-lock.json': npmLock });
      const info = await readProject(dir);
      expect(info.lockfile?.file).toBe('package-lock.json');
      expect(info.warnings.find((w) => w.code === 'multiple-lockfiles')?.message).toBe(
        'Found package-lock.json, pnpm-lock.yaml, yarn.lock; using package-lock.json.',
      );
    });

    it('prefers npm-shrinkwrap.json over package-lock.json', async () => {
      const shrinkwrap = npmLock.replace('14.2.12', '14.2.1');
      const dir = await project({ 'package.json': pkg, 'npm-shrinkwrap.json': shrinkwrap, 'package-lock.json': npmLock });
      const info = await readProject(dir);
      expect(info.lockfile?.file).toBe('npm-shrinkwrap.json');
      expect(info.angular.version).toBe('14.2.1');
    });

    it('follows the packageManager field first', async () => {
      const dir = await project({
        'package.json': { ...pkg, packageManager: 'yarn@1.22.19+sha512.abc' },
        'yarn.lock': yarnLock,
        'package-lock.json': npmLock,
      });
      const info = await readProject(dir);
      expect(info.packageManager).toBe('yarn@1.22.19+sha512.abc');
      expect(info.lockfile).toMatchObject({ kind: 'yarn-classic', file: 'yarn.lock' });
      expect(info.angular.version).toBe('14.2.11');
      expect(info.warnings.find((w) => w.code === 'multiple-lockfiles')?.message).toBe(
        'Found package-lock.json, yarn.lock; using yarn.lock.',
      );
    });

    it('warns and uses the fixed order when the packageManager lockfile is missing', async () => {
      const dir = await project({ 'package.json': { ...pkg, packageManager: 'pnpm@9.1.0' }, 'yarn.lock': yarnLock });
      const info = await readProject(dir);
      expect(info.lockfile?.file).toBe('yarn.lock');
      expect(info.warnings.map((w) => w.code)).toContain('package-manager-lockfile-missing');
    });

    it('ignores an unknown packageManager value', async () => {
      const dir = await project({ 'package.json': { ...pkg, packageManager: 'bun@1.1.0' }, 'pnpm-lock.yaml': pnpmLock });
      const info = await readProject(dir);
      expect(info.lockfile?.file).toBe('pnpm-lock.yaml');
      expect(info.warnings.map((w) => w.code)).not.toContain('package-manager-lockfile-missing');
    });

    it('ignores a directory named like a lockfile', async () => {
      const dir = await project({ 'package.json': pkg, 'pnpm-lock.yaml': pnpmLock });
      await mkdir(path.join(dir, 'package-lock.json'));
      const info = await readProject(dir);
      expect(info.lockfile?.file).toBe('pnpm-lock.yaml');
    });
  });

  describe('package names', () => {
    it('reports and skips names that break npm naming rules', async () => {
      const dir = await project({
        'package.json': {
          dependencies: {
            '@angular/core': '14.2.0',
            '../escape': '1.0.0',
            '.hidden': '1.0.0',
            'Bad Name': '1.0.0',
            '\u001b[31mred': '1.0.0',
            constructor: '^1.0.0',
          },
        },
      });
      const info = await readProject(dir);
      expect(info.dependencies.map((d) => d.name)).toEqual(['@angular/core', 'constructor']);
      const invalid = info.warnings.filter((w) => w.code === 'invalid-package-name');
      expect(invalid).toHaveLength(4);
      // Untrusted names are quoted, so control characters cannot reach the terminal.
      // eslint-disable-next-line no-control-regex
      for (const warning of invalid) expect(warning.message).not.toMatch(/[\u0000-\u001f]/);
      expect(invalid.map((w) => w.message)).toContain(
        'Skipped "../escape" in dependencies: not a valid npm package name (name starts with a period).',
      );
    });

    it('reports an alias whose target is not a valid name', async () => {
      const dir = await project({
        'package.json': { engines: { node: '>=18' }, dependencies: { '@angular/core': '14.2.0', sneaky: 'npm:../../x@1.0.0' } },
      });
      const info = await readProject(dir);
      expect(info.dependencies.map((d) => d.name)).toEqual(['@angular/core']);
      expect(info.warnings.map((w) => w.code)).toEqual(['no-lockfile', 'invalid-package-name']);
    });

    it('skips non-string ranges and duplicate entries with a warning', async () => {
      const dir = await project({
        'package.json': {
          engines: { node: '>=18' },
          dependencies: { '@angular/core': '14.2.0', rxjs: 7 },
          devDependencies: { '@angular/core': '15.0.0' },
        },
      });
      const info = await readProject(dir);
      expect(info.angular.version).toBe('14.2.0');
      expect(info.dependencies).toHaveLength(1);
      expect(info.warnings.map((w) => w.code)).toEqual(['no-lockfile', 'invalid-dependency-spec', 'duplicate-dependency']);
    });
  });

  describe('engines.node', () => {
    const withEngines = (engines: unknown) => ({ ...pkg, engines });

    it.each([
      ['a range', { node: '>=18.19.0' }, '>=18.19.0'],
      ['a bare major', { node: '18' }, '18'],
      ['a union of ranges', { node: '^18.19.1 || ^20.11.1 || >=22.0.0' }, '^18.19.1 || ^20.11.1 || >=22.0.0'],
    ])('reads %s as declared, with no warning', async (_label, engines, range) => {
      const info = await readProject(await project({ 'package.json': withEngines(engines), 'package-lock.json': npmLock }));
      expect(info.nodeEngine).toEqual({ status: 'declared', range });
      expect(info.warnings).toEqual([]);
    });

    it.each([
      ['no engines field', undefined],
      ['engines without node', { npm: '>=9' }],
      ['engines that is not an object', '>=18'],
      ['a null node entry', { node: null }],
    ])('reports %s as missing, with a project warning', async (_label, engines) => {
      const info = await readProject(await project({ 'package.json': withEngines(engines), 'package-lock.json': npmLock }));
      expect(info.nodeEngine).toEqual({ status: 'missing', range: null });
      expect(info.warnings).toEqual([
        {
          code: 'engines-node-missing',
          message:
            'package.json has no engines.node, so the Node.js versions the project runs on are not known and the Node.js requirement of each hop cannot be checked.',
        },
      ]);
    });

    const ESC = String.fromCharCode(27);
    it.each([
      ['text that is not a range', { node: 'lts/hydrogen' }, 'lts/hydrogen', '"lts/hydrogen"'],
      ['an empty string', { node: '  ' }, '  ', '"  "'],
      ['control characters', { node: `>=18${ESC}[2J` }, `>=18${ESC}[2J`, '">=18\\u001b[2J"'],
      ['a number', { node: 18 }, null, 'in package.json'],
    ])('reports %s as invalid, with a project warning', async (_label, engines, range, shown) => {
      const info = await readProject(await project({ 'package.json': withEngines(engines), 'package-lock.json': npmLock }));
      expect(info.nodeEngine).toEqual({ status: 'invalid', range });
      expect(info.warnings).toEqual([
        {
          code: 'engines-node-invalid',
          message: `engines.node ${shown} is not a valid version range, so the Node.js requirement of each hop cannot be checked.`,
        },
      ]);
      // eslint-disable-next-line no-control-regex
      expect(info.warnings[0]!.message).not.toMatch(/[\u0000-\u001f]/);
    });
  });

  describe('errors', () => {
    it('reports a missing package.json', async () => {
      const dir = await project({});
      const error = await expectProjectError(dir, 'NO_PACKAGE_JSON');
      expect(error.message).toContain('No package.json found');
    });

    it('reports a directory that does not exist', async () => {
      const dir = await project({});
      await expectProjectError(path.join(dir, 'missing'), 'NO_PACKAGE_JSON');
    });

    it('reports invalid JSON in package.json on one line', async () => {
      const dir = await project({ 'package.json': '{\n  "dependencies": {\n    "@angular/core": "14.2.0",\n' });
      const error = await expectProjectError(dir, 'INVALID_PACKAGE_JSON');
      expect(error.message).toContain('is not valid JSON');
    });

    it.each([
      ['an array', '[]'],
      ['a string', '"hello"'],
      ['null', 'null'],
      ['dependencies that are not an object', '{"dependencies": ["@angular/core"]}'],
    ])('reports package.json holding %s', async (_label, content) => {
      const dir = await project({ 'package.json': content });
      await expectProjectError(dir, 'INVALID_PACKAGE_JSON');
    });

    it('accepts a package.json with a byte order mark', async () => {
      const dir = await project({ 'package.json': String.fromCharCode(0xfeff) + JSON.stringify(pkg) });
      expect((await readProject(dir)).angular.version).toBe('14.2.0');
    });

    it('reports a project without @angular/core', async () => {
      const dir = await project({ 'package.json': { dependencies: { react: '^18.0.0' } } });
      const error = await expectProjectError(dir, 'NO_ANGULAR_CORE');
      expect(error.message).toContain('has no @angular/core dependency');
    });

    it('reports an AngularJS-only project distinctly', async () => {
      const dir = await project({ 'package.json': { dependencies: { angular: '1.8.3', 'angular-route': '1.8.3' } } });
      const error = await expectProjectError(dir, 'NO_ANGULAR_CORE');
      expect(error.message).toContain('AngularJS');
    });

    it('reports an @angular/core version that cannot be determined', async () => {
      const dir = await project({ 'package.json': { dependencies: { '@angular/core': 'latest' } } });
      await expectProjectError(dir, 'ANGULAR_VERSION_UNKNOWN');
    });

    it.each([
      ['package-lock.json', '{"lockfileVersion": 3, "packages": '],
      ['pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters: [\n"],
      ['yarn.lock', '# yarn lockfile v1\n\n"@angular/core@~14.2.0":\n  version "14.2.11\n'],
      ['yarn.lock', '__metadata:\n  version: 6\n"@angular/core@npm:~14.2.0": [\n'],
    ])('reports a malformed %s', async (file, content) => {
      const dir = await project({ 'package.json': pkg, [file]: content });
      const error = await expectProjectError(dir, 'MALFORMED_LOCKFILE');
      expect(error.path).toBe(file);
      expect(error.message.startsWith(file)).toBe(true);
    });

    it('reports an unsupported lockfile version', async () => {
      const dir = await project({ 'package.json': pkg, 'package-lock.json': '{"lockfileVersion": 7, "packages": {}}' });
      await expectProjectError(dir, 'UNSUPPORTED_LOCKFILE');
    });
  });
});
