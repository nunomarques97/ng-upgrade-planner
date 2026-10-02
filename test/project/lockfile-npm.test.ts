import { describe, expect, it } from 'vitest';
import { ProjectError } from '../../src/project/errors.js';
import { parseNpmLockfile } from '../../src/project/lockfile/npm.js';

const FILE = 'package-lock.json';

const v1 = JSON.stringify({
  name: 'legacy-app',
  version: '0.0.0',
  lockfileVersion: 1,
  requires: true,
  dependencies: {
    '@angular/core': { version: '9.1.13', resolved: 'https://registry.npmjs.org/@angular/core/-/core-9.1.13.tgz' },
    rxjs: { version: '6.5.5', requires: { tslib: '^1.9.0' } },
    'my-alias': { version: 'npm:ngx-toastr@12.1.0' },
    'git-dep': { version: 'git+https://github.com/example/git-dep.git#0123456789abcdef' },
  },
});

const v2 = JSON.stringify({
  name: 'app',
  lockfileVersion: 2,
  requires: true,
  packages: {
    '': { name: 'app', dependencies: { '@angular/core': '~13.3.0' } },
    'node_modules/@angular/core': { version: '13.3.12' },
    'node_modules/@ngrx/store': { version: '13.2.0' },
    'node_modules/some-lib/node_modules/@ngrx/store': { version: '12.0.0' },
    'node_modules/local-lib': { resolved: 'libs/local-lib', link: true },
  },
  dependencies: {
    '@angular/core': { version: '13.3.0' },
  },
});

const v3 = JSON.stringify({
  name: 'app',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': { name: 'app' },
    'node_modules/@angular/core': { version: '17.3.12' },
    'node_modules/zone.js': { version: '0.14.10', dev: true },
  },
});

describe('parseNpmLockfile', () => {
  it('reads lockfileVersion 1 from the top-level dependencies', () => {
    const lock = parseNpmLockfile(v1, FILE);
    expect(lock.kind).toBe('npm');
    expect(lock.formatVersion).toBe('1');
    expect(lock.resolve('@angular/core', '~9.1.0')).toBe('9.1.13');
    expect(lock.resolve('rxjs', '~6.5.4')).toBe('6.5.5');
    expect(lock.resolve('my-alias', 'npm:ngx-toastr@^12.0.0')).toBe('12.1.0');
    expect(lock.resolve('git-dep', 'github:example/git-dep')).toBeUndefined();
    expect(lock.resolve('missing', '^1.0.0')).toBeUndefined();
  });

  it('reads lockfileVersion 2 from the packages map, ignoring nested copies and links', () => {
    const lock = parseNpmLockfile(v2, FILE);
    expect(lock.formatVersion).toBe('2');
    // "packages" wins over the legacy "dependencies" section in v2.
    expect(lock.resolve('@angular/core', '~13.3.0')).toBe('13.3.12');
    expect(lock.resolve('@ngrx/store', '^13.0.0')).toBe('13.2.0');
    expect(lock.resolve('local-lib', '*')).toBeUndefined();
  });

  it('reads lockfileVersion 3', () => {
    const lock = parseNpmLockfile(v3, FILE);
    expect(lock.formatVersion).toBe('3');
    expect(lock.resolve('@angular/core', '^17.3.0')).toBe('17.3.12');
    expect(lock.resolve('zone.js', '~0.14.0')).toBe('0.14.10');
  });

  it('does not treat inherited object properties as entries', () => {
    const lock = parseNpmLockfile(JSON.stringify({ lockfileVersion: 1, dependencies: {} }), FILE);
    expect(lock.resolve('constructor', '^1.0.0')).toBeUndefined();
    expect(lock.resolve('toString', '^1.0.0')).toBeUndefined();
    const lock3 = parseNpmLockfile(
      '{"lockfileVersion":3,"packages":{"node_modules/__proto__":{"version":"1.0.0"}}}',
      FILE,
    );
    expect(lock3.resolve('constructor', '^1.0.0')).toBeUndefined();
    expect(({} as Record<string, unknown>).version).toBeUndefined();
  });

  it.each([
    ['invalid JSON', '{"lockfileVersion": 3,', 'MALFORMED_LOCKFILE'],
    ['a JSON array', '[]', 'MALFORMED_LOCKFILE'],
    ['a missing lockfileVersion', '{"packages":{}}', 'MALFORMED_LOCKFILE'],
    ['a string lockfileVersion', '{"lockfileVersion":"3","packages":{}}', 'MALFORMED_LOCKFILE'],
    ['packages that is not an object', '{"lockfileVersion":3,"packages":[]}', 'MALFORMED_LOCKFILE'],
    ['v3 without packages', '{"lockfileVersion":3}', 'MALFORMED_LOCKFILE'],
    ['an unknown future version', '{"lockfileVersion":4,"packages":{}}', 'UNSUPPORTED_LOCKFILE'],
  ])('rejects %s with a typed error', (_label, text, code) => {
    let caught: unknown;
    try {
      parseNpmLockfile(text, FILE);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProjectError);
    expect((caught as ProjectError).code).toBe(code);
    expect((caught as ProjectError).message).toContain(FILE);
    expect((caught as ProjectError).message).not.toMatch(/\n/);
  });
});
