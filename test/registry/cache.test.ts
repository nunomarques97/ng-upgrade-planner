import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RecordCache, cacheFileName, defaultCacheDir, trimRegistryDocument } from '../../src/registry/index.js';

const created: string[] = [];

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ngup-cache-'));
  created.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function record(name: string) {
  return trimRegistryDocument(
    { name, 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': { peerDependencies: { '@angular/core': '^14.0.0' } } } },
    name,
    new Date('2026-09-01T00:00:00.000Z'),
  )!;
}

const crafted = [
  '../x',
  '..',
  '.',
  '',
  '../../etc/passwd',
  '..\\..\\x',
  '/etc/passwd',
  'C:\\Windows\\x',
  'C:x',
  '\\\\server\\share\\x',
  '@scope/../../x',
  'nul',
  'a\u0000b',
];

describe('cacheFileName', () => {
  it('encodes names into a flat, safe file name', () => {
    expect(cacheFileName('@angular/core')).toBe('_40angular_2fcore.json');
    expect(cacheFileName('ngx-toastr')).toBe('ngx-toastr.json');
    expect(cacheFileName('lodash.merge')).toBe('lodash_2emerge.json');
    for (const name of crafted) {
      const file = cacheFileName(name);
      expect(file).toMatch(/^[a-z0-9_~-]+\.json$/);
      expect(file).not.toContain('..');
    }
  });

  it('avoids Windows device names and empty names', () => {
    expect(cacheFileName('nul')).toBe('~nul.json');
    expect(cacheFileName('com1')).toBe('~com1.json');
    expect(cacheFileName('')).toBe('~.json');
    expect(cacheFileName('nullable')).toBe('nullable.json');
  });

  it('keeps names that differ only in case apart', () => {
    expect(cacheFileName('JSONStream')).not.toBe(cacheFileName('jsonstream'));
  });

  it('shortens very long names and keeps them distinct', () => {
    const a = cacheFileName(`${'a'.repeat(200)}-one`);
    const b = cacheFileName(`${'a'.repeat(200)}-two`);
    expect(a.length).toBeLessThanOrEqual(170);
    expect(a).not.toBe(b);
  });
});

describe('RecordCache', () => {
  it('writes atomically and reads back the record', async () => {
    const dir = path.join(await tempRoot(), 'cache');
    const cache = new RecordCache(dir);
    const rec = record('@angular/core');
    await cache.write(rec);
    await cache.write(rec);
    expect(await readdir(dir)).toEqual(['_40angular_2fcore.json']);
    expect(await cache.read('@angular/core')).toEqual(rec);
    expect(await cache.read('@angular/common')).toBeUndefined();
  });

  it('keeps crafted names such as ../x or absolute paths inside the cache folder', async () => {
    const root = await tempRoot();
    const dir = path.join(root, 'cache');
    const cache = new RecordCache(dir);
    for (const name of crafted) {
      expect(path.dirname(cache.filePath(name))).toBe(path.resolve(dir));
      await cache.write(record(name));
      expect(await cache.read(name)).toEqual(record(name));
    }
    // Nothing was written next to or above the cache folder.
    expect(await readdir(root)).toEqual(['cache']);
    expect((await readdir(dir)).length).toBe(crafted.length);
  });

  it('treats a corrupt or schema-invalid file as a miss', async () => {
    const dir = await tempRoot();
    const cache = new RecordCache(dir);
    await writeFile(cache.filePath('ngx-a'), '{"schema": 1, "name": "ngx-a", "fetch');
    await writeFile(cache.filePath('ngx-b'), JSON.stringify({ ...record('ngx-b'), schema: 99 }));
    await writeFile(cache.filePath('ngx-c'), JSON.stringify(record('ngx-other')));
    await writeFile(cache.filePath('ngx-d'), '\u0000\u0001binary');
    for (const name of ['ngx-a', 'ngx-b', 'ngx-c', 'ngx-d']) expect(await cache.read(name)).toBeUndefined();
  });

  it('leaves no temporary file behind when the rename fails', async () => {
    const dir = await tempRoot();
    const cache = new RecordCache(dir);
    // A folder where the cache file should be makes the rename fail.
    await mkdir(path.join(cache.filePath('ngx-a'), 'blocker'), { recursive: true });
    await expect(cache.write(record('ngx-a'))).rejects.toThrow();
    expect(await readdir(dir)).toEqual(['ngx-a.json']);
  });
});

describe('defaultCacheDir', () => {
  it('uses the OS user cache directory', () => {
    expect(defaultCacheDir({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, homedir: 'C:\\Users\\u' })).toBe(
      'C:\\Users\\u\\AppData\\Local\\ng-upgrade-planner\\Cache\\registry',
    );
    expect(defaultCacheDir({ platform: 'win32', env: {}, homedir: 'C:\\Users\\u' })).toBe(
      'C:\\Users\\u\\AppData\\Local\\ng-upgrade-planner\\Cache\\registry',
    );
    expect(defaultCacheDir({ platform: 'darwin', env: {}, homedir: '/Users/u' })).toBe(
      '/Users/u/Library/Caches/ng-upgrade-planner/registry',
    );
    expect(defaultCacheDir({ platform: 'linux', env: { XDG_CACHE_HOME: '/var/cache/u' }, homedir: '/home/u' })).toBe(
      '/var/cache/u/ng-upgrade-planner/registry',
    );
    // A relative XDG_CACHE_HOME is ignored, as the XDG specification requires.
    expect(defaultCacheDir({ platform: 'linux', env: { XDG_CACHE_HOME: 'rel' }, homedir: '/home/u' })).toBe(
      '/home/u/.cache/ng-upgrade-planner/registry',
    );
  });
});
