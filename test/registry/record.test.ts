import { describe, expect, it } from 'vitest';
import { parseRecord, trimRegistryDocument, RECORD_SCHEMA } from '../../src/registry/index.js';

const fetchedAt = new Date('2026-09-01T10:00:00.000Z');

const packument = {
  _id: 'ngx-demo',
  name: 'ngx-demo',
  readme: 'A long readme that must not be kept.',
  maintainers: [{ name: 'someone', email: 'someone@example.com' }],
  'dist-tags': { latest: '2.0.0', next: '3.0.0-rc.1', broken: 'not-a-version', empty: 42 },
  time: { created: '2020-01-01T00:00:00.000Z', '1.0.0': '2020-01-02T00:00:00.000Z', '2.0.0': 'garbage' },
  versions: {
    '1.0.0': {
      name: 'ngx-demo',
      version: '1.0.0',
      dependencies: { tslib: '^2.0.0' },
      dist: { tarball: 'https://example.com/ngx-demo-1.0.0.tgz', integrity: 'sha512-x' },
      scripts: { postinstall: 'node evil.js' },
      peerDependencies: { '@angular/core': '^14.0.0', rxjs: 7, '@angular/common': null, '../x': '^1.0.0' },
      peerDependenciesMeta: { rxjs: { optional: true }, '@angular/common': 'yes', '@angular/core': {} },
      engines: { node: '>=14.15.0', 'bad key/..': '1' },
      deprecated: 'Use 2.x',
    },
    '2.0.0': { peerDependencies: { '@angular/core': '^15.0.0 || ^16.0.0' }, engines: ['node >= 0.8'], deprecated: false },
    '3.0.0-rc.1': { peerDependencies: { '@angular/core': '^17.0.0-next.0' } },
    'v4.0.0': { peerDependencies: { '@angular/core': '^17.0.0' } },
    latest: { peerDependencies: { '@angular/core': '^17.0.0' } },
    '5.0': {},
    '6.0.0': 'not an object',
  },
};

describe('trimRegistryDocument', () => {
  it('keeps only dist-tags and the per-version fields the planner needs', () => {
    const record = trimRegistryDocument(packument, 'ngx-demo', fetchedAt);
    expect(record).toEqual({
      schema: RECORD_SCHEMA,
      name: 'ngx-demo',
      fetchedAt: '2026-09-01T10:00:00.000Z',
      distTags: { latest: '2.0.0', next: '3.0.0-rc.1' },
      versions: {
        '1.0.0': {
          peerDependencies: { '@angular/core': '^14.0.0' },
          peerDependenciesMeta: { rxjs: { optional: true }, '@angular/core': { optional: false } },
          engines: { node: '>=14.15.0' },
          deprecated: 'Use 2.x',
          time: '2020-01-02T00:00:00.000Z',
        },
        '2.0.0': { peerDependencies: { '@angular/core': '^15.0.0 || ^16.0.0' } },
        '3.0.0-rc.1': { peerDependencies: { '@angular/core': '^17.0.0-next.0' } },
      },
    });
    const text = JSON.stringify(record);
    for (const dropped of ['readme', 'tarball', 'postinstall', 'tslib', 'someone@example.com']) {
      expect(text).not.toContain(dropped);
    }
  });

  it('returns frozen records', () => {
    const record = trimRegistryDocument(packument, 'ngx-demo', fetchedAt)!;
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.versions['1.0.0']!.peerDependencies)).toBe(true);
  });

  it('rejects documents with the wrong shape or for another package', () => {
    expect(trimRegistryDocument(null, 'ngx-demo', fetchedAt)).toBeUndefined();
    expect(trimRegistryDocument([], 'ngx-demo', fetchedAt)).toBeUndefined();
    expect(trimRegistryDocument({ name: 'ngx-demo' }, 'ngx-demo', fetchedAt)).toBeUndefined();
    expect(trimRegistryDocument({ name: 'ngx-demo', versions: [] }, 'ngx-demo', fetchedAt)).toBeUndefined();
    expect(trimRegistryDocument({ ...packument, name: 'other' }, 'ngx-demo', fetchedAt)).toBeUndefined();
  });

  it('does not let __proto__ or constructor keys pollute objects', () => {
    const doc: unknown = JSON.parse(`{
      "name": "ngx-demo",
      "dist-tags": { "__proto__": "1.0.0", "latest": "1.0.0" },
      "time": { "__proto__": { "polluted": true } },
      "versions": {
        "__proto__": { "polluted": true },
        "constructor": { "polluted": true },
        "1.0.0": {
          "peerDependencies": { "__proto__": "^1.0.0", "constructor": "^2.0.0", "@angular/core": "^14.0.0" },
          "peerDependenciesMeta": { "__proto__": { "optional": true } },
          "engines": { "__proto__": ">=1" }
        }
      }
    }`);
    const record = trimRegistryDocument(doc, 'ngx-demo', fetchedAt)!;

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(record.versions)).toBeNull();
    expect(Object.keys(record.versions)).toEqual(['1.0.0']);
    expect(record.versions['constructor']).toBeUndefined();
    const v1 = record.versions['1.0.0']!;
    // `constructor` is a valid package name, so it is kept as a plain own entry.
    expect(Object.keys(v1.peerDependencies!)).toEqual(['constructor', '@angular/core']);
    expect(Object.getPrototypeOf(v1.peerDependencies)).toBeNull();
    expect(v1.peerDependenciesMeta).toBeUndefined();
    expect(v1.engines).toBeUndefined();
    // The `__proto__` dist-tag is stored as an own key of a null-prototype map, not as a prototype.
    expect(Object.getPrototypeOf(record.distTags)).toBeNull();
    expect(Object.keys(record.distTags).sort()).toEqual(['__proto__', 'latest']);
  });
});

describe('parseRecord', () => {
  const record = trimRegistryDocument(packument, 'ngx-demo', fetchedAt)!;

  it('reads back what was stored (the cache and fixture schema)', () => {
    expect(parseRecord(JSON.parse(JSON.stringify(record)), 'ngx-demo')).toEqual(record);
  });

  it('treats schema-invalid data as missing', () => {
    const stored = JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
    expect(parseRecord({ ...stored, schema: 2 }, 'ngx-demo')).toBeUndefined();
    expect(parseRecord(stored, 'other')).toBeUndefined();
    expect(parseRecord({ ...stored, fetchedAt: 'yesterday' }, 'ngx-demo')).toBeUndefined();
    expect(parseRecord({ ...stored, versions: null }, 'ngx-demo')).toBeUndefined();
    expect(parseRecord({ ...stored, distTags: [] }, 'ngx-demo')).toBeUndefined();
    expect(parseRecord('text', 'ngx-demo')).toBeUndefined();
  });

  it('drops malformed entries inside a stored record', () => {
    const stored = {
      schema: 1,
      name: 'ngx-demo',
      fetchedAt: '2026-09-01T10:00:00.000Z',
      distTags: { latest: '1.0.0' },
      versions: { '1.0.0': { peerDependencies: { '@angular/core': 14 }, time: 'never' }, 'x.y': {} },
    };
    expect(parseRecord(stored, 'ngx-demo')!.versions).toEqual({ '1.0.0': {} });
  });
});
