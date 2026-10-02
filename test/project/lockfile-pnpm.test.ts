import { describe, expect, it } from 'vitest';
import { ProjectError } from '../../src/project/errors.js';
import { parsePnpmLockfile, pnpmVersion } from '../../src/project/lockfile/pnpm.js';

const FILE = 'pnpm-lock.yaml';

const v5 = `lockfileVersion: 5.4

specifiers:
  '@angular/core': ~14.2.0
  '@ngrx/store': ^14.3.0
  rxjs: ~7.5.0
  toastr-alias: npm:ngx-toastr@^15.0.0
  local-lib: link:../local-lib
  typescript: ~4.7.2

dependencies:
  '@angular/core': 14.2.12_rxjs@7.5.7+zone.js@0.11.8
  '@ngrx/store': 14.3.3_vbs7lxtl2ze5ty5ii4ff3ypr3a
  rxjs: 7.5.7
  toastr-alias: /ngx-toastr/15.2.2_@angular+core@14.2.12
  local-lib: link:../local-lib

devDependencies:
  typescript: 4.7.4

packages:

  /@angular/core/14.2.12_rxjs@7.5.7+zone.js@0.11.8:
    resolution: {integrity: sha512-AAAA}
    dependencies:
      rxjs: 7.5.7
`;

const v5Workspace = `lockfileVersion: 5.3

importers:

  .:
    specifiers:
      '@angular/core': ~12.2.0
    dependencies:
      '@angular/core': 12.2.17_rxjs@6.6.7+zone.js@0.11.4

  packages/lib:
    specifiers:
      '@angular/core': ~11.0.0
    dependencies:
      '@angular/core': 11.0.9
`;

const v6 = `lockfileVersion: '6.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

dependencies:
  '@angular/core':
    specifier: ^16.2.0
    version: 16.2.12(rxjs@7.8.1)(zone.js@0.13.3)
  toastr-alias:
    specifier: npm:ngx-toastr@^17.0.0
    version: /ngx-toastr@17.0.2(@angular/common@16.2.12)(@angular/core@16.2.12)

devDependencies:
  typescript:
    specifier: ~5.1.3
    version: 5.1.6

packages:

  /@angular/core@16.2.12(rxjs@7.8.1)(zone.js@0.13.3):
    resolution: {integrity: sha512-AAAA}
`;

const v9 = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      '@angular/core':
        specifier: ^18.2.0
        version: 18.2.13(rxjs@7.8.1)(zone.js@0.14.10)
      toastr-alias:
        specifier: npm:ngx-toastr@^19.0.0
        version: ngx-toastr@19.0.0(@angular/common@18.2.13)(@angular/core@18.2.13)
      shared:
        specifier: workspace:*
        version: link:packages/shared
    devDependencies:
      typescript:
        specifier: ~5.5.2
        version: 5.5.4

  packages/shared:
    dependencies:
      '@angular/core':
        specifier: ^17.0.0
        version: 17.3.12

packages:

  '@angular/core@18.2.13':
    resolution: {integrity: sha512-AAAA}
`;

describe('parsePnpmLockfile', () => {
  it('reads the v5 format with peer suffixes, aliases and links', () => {
    const lock = parsePnpmLockfile(v5, FILE);
    expect(lock.kind).toBe('pnpm');
    expect(lock.formatVersion).toBe('5.4');
    expect(lock.resolve('@angular/core', '~14.2.0')).toBe('14.2.12');
    expect(lock.resolve('@ngrx/store', '^14.3.0')).toBe('14.3.3');
    expect(lock.resolve('rxjs', '~7.5.0')).toBe('7.5.7');
    expect(lock.resolve('toastr-alias', 'npm:ngx-toastr@^15.0.0')).toBe('15.2.2');
    expect(lock.resolve('local-lib', 'link:../local-lib')).toBeUndefined();
    expect(lock.resolve('typescript', '~4.7.2')).toBe('4.7.4');
    expect(lock.resolve('missing', '^1.0.0')).toBeUndefined();
  });

  it('reads the root importer of a v5 workspace lockfile', () => {
    const lock = parsePnpmLockfile(v5Workspace, FILE);
    expect(lock.formatVersion).toBe('5.3');
    expect(lock.resolve('@angular/core', '~12.2.0')).toBe('12.2.17');
  });

  it('reads the v6 format', () => {
    const lock = parsePnpmLockfile(v6, FILE);
    expect(lock.formatVersion).toBe('6.0');
    expect(lock.resolve('@angular/core', '^16.2.0')).toBe('16.2.12');
    expect(lock.resolve('toastr-alias', 'npm:ngx-toastr@^17.0.0')).toBe('17.0.2');
    expect(lock.resolve('typescript', '~5.1.3')).toBe('5.1.6');
  });

  it('reads the v9 format from the root importer only', () => {
    const lock = parsePnpmLockfile(v9, FILE);
    expect(lock.formatVersion).toBe('9.0');
    expect(lock.resolve('@angular/core', '^18.2.0')).toBe('18.2.13');
    expect(lock.resolve('toastr-alias', 'npm:ngx-toastr@^19.0.0')).toBe('19.0.0');
    expect(lock.resolve('shared', 'workspace:*')).toBeUndefined();
    expect(lock.resolve('typescript', '~5.5.2')).toBe('5.5.4');
  });

  it('picks the main document when pnpm writes a config document first', () => {
    const multi = `---
lockfileVersion: '9.0'

importers:

  .:
    configDependencies: {}

packageManagerDependencies:

  pnpm:
    specifier: 10.12.1
    version: 10.12.1

---
${v9}`;
    const lock = parsePnpmLockfile(multi, FILE);
    expect(lock.formatVersion).toBe('9.0');
    expect(lock.resolve('@angular/core', '^18.2.0')).toBe('18.2.13');
  });

  it('does not treat inherited properties or __proto__ keys as entries', () => {
    const text = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      __proto__:
        specifier: ^1.0.0
        version: 1.0.0
`;
    const lock = parsePnpmLockfile(text, FILE);
    expect(lock.resolve('constructor', '^1.0.0')).toBeUndefined();
    expect(lock.resolve('hasOwnProperty', '^1.0.0')).toBeUndefined();
    expect(({} as Record<string, unknown>).version).toBeUndefined();
  });

  it.each([
    ['invalid YAML', 'lockfileVersion: 5.4\ndependencies:\n  a: [1, 2\n', 'MALFORMED_LOCKFILE'],
    ['a document without lockfileVersion', 'dependencies:\n  rxjs: 7.5.7\n', 'MALFORMED_LOCKFILE'],
    ['a scalar document', 'just text\n', 'MALFORMED_LOCKFILE'],
    ['a dependencies list instead of a map', "lockfileVersion: '6.0'\ndependencies:\n  - rxjs\n", 'MALFORMED_LOCKFILE'],
    ['importers that is not a map', "lockfileVersion: '9.0'\nimporters: 3\n", 'MALFORMED_LOCKFILE'],
    ['an unsupported version', 'lockfileVersion: 3.9\ndependencies: {}\n', 'UNSUPPORTED_LOCKFILE'],
    ['an alias bomb', `lockfileVersion: '9.0'\na: &a [x, x, x, x, x, x, x, x, x]\nb: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]\nc: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]\nd: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c]\ne: [*d, *d, *d, *d, *d, *d, *d, *d, *d]\n`, 'MALFORMED_LOCKFILE'],
  ])('rejects %s with a typed error', (_label, text, code) => {
    let caught: unknown;
    try {
      parsePnpmLockfile(text, FILE);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProjectError);
    expect((caught as ProjectError).code).toBe(code);
    expect((caught as ProjectError).message).toContain(FILE);
    expect((caught as ProjectError).message).not.toMatch(/\n/);
  });
});

describe('pnpmVersion', () => {
  it.each([
    ['14.2.12', true, '14.2.12'],
    ['14.2.12_rxjs@7.5.7', true, '14.2.12'],
    ['/@scope/real/1.2.3_abc', true, '1.2.3'],
    ['16.2.12(rxjs@7.8.1)', false, '16.2.12'],
    ['/@scope/real@1.2.3(@angular/core@16.2.12)', false, '1.2.3'],
    ['@scope/real@1.2.3', false, '1.2.3'],
    ['17.0.0-rc.1', false, '17.0.0-rc.1'],
    ['link:../lib', false, undefined],
    ['file:vendor/lib.tgz', true, undefined],
    ['github.com/example/repo/0123456789abcdef', true, undefined],
    [42, false, undefined],
  ])('reads %j (legacy=%s) as %s', (raw, legacy, expected) => {
    expect(pnpmVersion(raw, legacy)).toBe(expected);
  });
});
