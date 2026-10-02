import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RecordCache,
  RegistryClient,
  RegistryConfigError,
  parseRecord,
  trimRegistryDocument,
  type FetchLike,
  type PackageResult,
  type RegistryClientOptions,
} from '../../src/registry/index.js';

// Every test injects a scripted fetch and a temporary cache folder; nothing reaches the network.
const created: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ngup-registry-'));
  created.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

type Step = (() => Response | Promise<Response>) | Error;

interface Call {
  url: string;
  init: RequestInit;
}

function scriptedFetch(script: Record<string, Step[]>): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const name = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
    const step = script[name]?.shift();
    if (!step) throw new Error(`unexpected request for ${url}`);
    if (step instanceof Error) throw step;
    return step();
  };
  return { fetch, calls };
}

function packument(name: string, latest = '2.0.0') {
  return {
    name,
    readme: 'not kept',
    'dist-tags': { latest },
    versions: {
      '1.0.0': { name, version: '1.0.0', peerDependencies: { '@angular/core': '^14.0.0' }, dist: { tarball: 'x' } },
      [latest]: { name, version: latest, peerDependencies: { '@angular/core': '^15.0.0' } },
    },
  };
}

const json = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number, headers: Record<string, string> = {}) => () => new Response(null, { status: code, headers });
const networkError = () => new TypeError('fetch failed: getaddrinfo ENOTFOUND registry.npmjs.org');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function client(options: RegistryClientOptions & { cacheDir?: string } = {}) {
  const sleeps: number[] = [];
  const instance = new RegistryClient({
    cacheDir: options.cacheDir ?? (await tempDir()),
    now: () => NOW,
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    ...options,
  });
  return { instance, sleeps };
}

async function seed(cacheDir: string, name: string, ageMs: number, latest = '1.5.0'): Promise<void> {
  const record = trimRegistryDocument(packument(name, latest), name, new Date(NOW - ageMs))!;
  await new RecordCache(cacheDir).write(record);
}

function ok(result: PackageResult) {
  if (result.status !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result;
}

describe('RegistryClient online', () => {
  it('fetches, trims and caches a package with an identifying User-Agent and no credentials', async () => {
    const cacheDir = await tempDir();
    const { fetch, calls } = scriptedFetch({ '@angular/material': [json(packument('@angular/material'))] });
    const prev = process.env.NPM_TOKEN;
    process.env.NPM_TOKEN = 'npm_should_never_be_sent';
    try {
      const { instance } = await client({ fetch, cacheDir });
      const result = ok(await instance.getPackage('@angular/material'));
      expect(result).toMatchObject({ source: 'network', stale: false });
      expect(result.record.distTags).toEqual({ latest: '2.0.0' });
      expect(result.record.versions['2.0.0']).toEqual({ peerDependencies: { '@angular/core': '^15.0.0' } });
    } finally {
      if (prev === undefined) delete process.env.NPM_TOKEN;
      else process.env.NPM_TOKEN = prev;
    }

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://registry.npmjs.org/@angular%2fmaterial');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(Object.keys(headers).sort()).toEqual(['accept', 'user-agent']);
    expect(headers['user-agent']).toMatch(/^ng-upgrade-planner\/\d+\.\d+\.\d+ /);
    expect(JSON.stringify(calls[0]!.init)).not.toContain('npm_should_never_be_sent');

    // The cache file uses the fixture schema and holds only trimmed data.
    const text = await readFile(new RecordCache(cacheDir).filePath('@angular/material'), 'utf8');
    expect(text).not.toContain('readme');
    expect(parseRecord(JSON.parse(text), '@angular/material')).toEqual(
      ok(await (await client({ cacheDir, offline: true })).instance.getPackage('@angular/material')).record,
    );
  });

  it('uses a configurable registry and rejects unsafe registry URLs', async () => {
    const { fetch, calls } = scriptedFetch({ 'ngx-a': [json(packument('ngx-a'))] });
    const { instance } = await client({ fetch, registry: 'https://mirror.example.com/npm/' });
    ok(await instance.getPackage('ngx-a'));
    expect(calls[0]!.url).toBe('https://mirror.example.com/npm/ngx-a');

    for (const registry of ['https://user:pass@example.com', 'file:///etc', 'ftp://example.com', 'not a url', 'https://e.com/?a=1']) {
      expect(() => new RegistryClient({ registry })).toThrow(RegistryConfigError);
    }
    try {
      new RegistryClient({ registry: 'https://user:hunter2@example.com' });
    } catch (error) {
      expect((error as Error).message).not.toContain('hunter2');
    }
  });

  it('reports 404 as not found without retrying', async () => {
    const { fetch, calls } = scriptedFetch({ 'ngx-missing': [status(404)] });
    const { instance, sleeps } = await client({ fetch });
    expect(await instance.getPackage('ngx-missing')).toEqual({ status: 'not-found', name: 'ngx-missing' });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('retries after 429 honoring Retry-After, then succeeds', async () => {
    const { fetch, calls } = scriptedFetch({
      'ngx-a': [status(429, { 'retry-after': '3' }), status(429), json(packument('ngx-a'))],
    });
    const { instance, sleeps } = await client({ fetch, baseDelayMs: 100 });
    expect(ok(await instance.getPackage('ngx-a')).source).toBe('network');
    expect(calls).toHaveLength(3);
    // Retry-After wins when present; otherwise exponential backoff (100 ms, then 200 ms).
    expect(sleeps).toEqual([3000, 200]);
  });

  it('accepts Retry-After as an HTTP date', async () => {
    const { fetch } = scriptedFetch({
      'ngx-a': [status(503, { 'retry-after': new Date(NOW + 5000).toUTCString() }), json(packument('ngx-a'))],
    });
    const { instance, sleeps } = await client({ fetch });
    ok(await instance.getPackage('ngx-a'));
    expect(sleeps).toEqual([5000]);
  });

  it('gives up after the capped number of attempts on 5xx', async () => {
    const { fetch, calls } = scriptedFetch({ 'ngx-a': [status(500), status(502), status(503), status(503)] });
    const { instance, sleeps } = await client({ fetch, maxAttempts: 3, baseDelayMs: 100 });
    const result = await instance.getPackage('ngx-a');
    expect(result).toEqual({
      status: 'unavailable',
      name: 'ngx-a',
      reason: 'the registry answered HTTP 503 (3 attempts)',
    });
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([100, 200]);
  });

  it('stops when Retry-After is longer than the maximum delay', async () => {
    const { fetch, calls } = scriptedFetch({ 'ngx-a': [status(429, { 'retry-after': '3600' })] });
    const { instance, sleeps } = await client({ fetch });
    const result = await instance.getPackage('ngx-a');
    expect(result).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('3600 s') as unknown });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('does not retry other client errors such as 403', async () => {
    const { fetch, calls } = scriptedFetch({ '@private/lib': [status(403)] });
    const { instance } = await client({ fetch });
    expect(await instance.getPackage('@private/lib')).toMatchObject({ status: 'unavailable', reason: 'the registry answered HTTP 403' });
    expect(calls).toHaveLength(1);
  });

  it('treats a malformed registry response as unavailable', async () => {
    const { fetch } = scriptedFetch({
      'ngx-a': [() => new Response('{"name": "ngx-a", "vers', { status: 200 })],
      'ngx-b': [json({ name: 'ngx-b', versions: 'all of them' })],
      'ngx-c': [json(packument('ngx-other'))],
    });
    const { instance } = await client({ fetch });
    const results = await instance.getPackages(['ngx-a', 'ngx-b', 'ngx-c']);
    expect([...results.values()].map((r) => r.status)).toEqual(['unavailable', 'unavailable', 'unavailable']);
  });

  it('rejects invalid package names without any request or file', async () => {
    const cacheDir = await tempDir();
    const { fetch, calls } = scriptedFetch({});
    const { instance } = await client({ fetch, cacheDir });
    for (const name of ['../x', '/etc/passwd', 'C:\\x', '..', '']) {
      expect(await instance.getPackage(name)).toMatchObject({ status: 'unavailable', reason: 'not a valid npm package name' });
    }
    expect(calls).toHaveLength(0);
    expect(await readdir(cacheDir)).toEqual([]);
  });
});

describe('RegistryClient cache and offline mode', () => {
  it('serves a fresh cache entry without a request', async () => {
    const cacheDir = await tempDir();
    await seed(cacheDir, 'ngx-a', HOUR);
    const { fetch, calls } = scriptedFetch({});
    const { instance } = await client({ fetch, cacheDir });
    expect(ok(await instance.getPackage('ngx-a'))).toMatchObject({ source: 'cache', stale: false });
    expect(calls).toHaveLength(0);
  });

  it('refreshes a stale entry online (default TTL 24 h)', async () => {
    const cacheDir = await tempDir();
    await seed(cacheDir, 'ngx-a', 25 * HOUR, '1.5.0');
    const { fetch, calls } = scriptedFetch({ 'ngx-a': [json(packument('ngx-a', '3.0.0'))] });
    const { instance } = await client({ fetch, cacheDir });
    const result = ok(await instance.getPackage('ngx-a'));
    expect(result).toMatchObject({ source: 'network', stale: false });
    expect(result.record.distTags.latest).toBe('3.0.0');
    expect(calls).toHaveLength(1);
    expect((await new RecordCache(cacheDir).read('ngx-a'))!.distTags.latest).toBe('3.0.0');
  });

  it('honours a custom TTL', async () => {
    const cacheDir = await tempDir();
    await seed(cacheDir, 'ngx-a', 2 * HOUR);
    const { fetch, calls } = scriptedFetch({ 'ngx-a': [json(packument('ngx-a'))] });
    const { instance } = await client({ fetch, cacheDir, ttlMs: HOUR });
    expect(ok(await instance.getPackage('ngx-a')).source).toBe('network');
    expect(calls).toHaveLength(1);
  });

  it('offline: uses a cached entry of any age and never fetches', async () => {
    const cacheDir = await tempDir();
    await seed(cacheDir, 'ngx-old', 400 * 24 * HOUR);
    await seed(cacheDir, 'ngx-new', HOUR);
    const { fetch, calls } = scriptedFetch({});
    const { instance } = await client({ fetch, cacheDir, offline: true });
    expect(ok(await instance.getPackage('ngx-old'))).toMatchObject({ source: 'cache', stale: true });
    expect(ok(await instance.getPackage('ngx-new'))).toMatchObject({ source: 'cache', stale: false });
    expect(calls).toHaveLength(0);
  });

  it('offline: a cache miss is unavailable, not an error', async () => {
    const { fetch, calls } = scriptedFetch({});
    const { instance } = await client({ fetch, offline: true });
    await expect(instance.getPackage('ngx-a')).resolves.toEqual({
      status: 'unavailable',
      name: 'ngx-a',
      reason: 'not in the offline cache',
    });
    expect(calls).toHaveLength(0);
  });

  it('falls back to a stale entry when the network fails, and flags it stale', async () => {
    const cacheDir = await tempDir();
    await seed(cacheDir, 'ngx-a', 48 * HOUR, '1.5.0');
    const { fetch, calls } = scriptedFetch({ 'ngx-a': [networkError(), networkError()] });
    const { instance } = await client({ fetch, cacheDir, maxAttempts: 2 });
    const result = ok(await instance.getPackage('ngx-a'));
    expect(result).toMatchObject({ source: 'cache', stale: true });
    expect(result.fallbackReason).toMatch(/^network error: fetch failed/);
    expect(result.record.distTags.latest).toBe('1.5.0');
    expect(calls).toHaveLength(2);
  });

  it('treats a corrupt or schema-invalid cache file as a miss', async () => {
    const cacheDir = await tempDir();
    const cache = new RecordCache(cacheDir);
    await writeFile(cache.filePath('ngx-a'), 'not json at all');
    await writeFile(cache.filePath('ngx-b'), JSON.stringify({ schema: 7, name: 'ngx-b' }));

    const offline = (await client({ cacheDir, offline: true, fetch: scriptedFetch({}).fetch })).instance;
    expect((await offline.getPackage('ngx-a')).status).toBe('unavailable');
    expect((await offline.getPackage('ngx-b')).status).toBe('unavailable');

    const { fetch, calls } = scriptedFetch({ 'ngx-a': [json(packument('ngx-a'))], 'ngx-b': [json(packument('ngx-b'))] });
    const online = (await client({ cacheDir, fetch })).instance;
    expect(ok(await online.getPackage('ngx-a')).source).toBe('network');
    expect(ok(await online.getPackage('ngx-b')).source).toBe('network');
    expect(calls).toHaveLength(2);
    // The corrupt files were replaced by valid records, with no temporary files left behind.
    expect((await cache.read('ngx-a'))?.name).toBe('ngx-a');
    expect((await readdir(cacheDir)).sort()).toEqual(['ngx-a.json', 'ngx-b.json']);
  });

  it('still answers when the cache folder cannot be written', async () => {
    const root = await tempDir();
    const blocked = path.join(root, 'file');
    await writeFile(blocked, 'a file where the cache folder should be');
    const { fetch } = scriptedFetch({ 'ngx-a': [json(packument('ngx-a'))] });
    const { instance } = await client({ fetch, cacheDir: path.join(blocked, 'cache') });
    expect(ok(await instance.getPackage('ngx-a')).source).toBe('network');
  });
});

describe('RegistryClient concurrency', () => {
  it('shares one in-flight fetch between concurrent calls for the same package', async () => {
    const gate = deferred<Response>();
    const { fetch, calls } = scriptedFetch({ 'ngx-a': [() => gate.promise] });
    const { instance } = await client({ fetch });
    const first = instance.getPackage('ngx-a');
    const second = instance.getPackage('ngx-a');
    expect(second).toBe(first);
    gate.resolve(json(packument('ngx-a'))());
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(b);
    expect(calls).toHaveLength(1);
    // Later calls reuse the result without another request.
    expect(await instance.getPackage('ngx-a')).toBe(a);
    expect(calls).toHaveLength(1);
  });

  it('does not keep a failure: a later call retries', async () => {
    const gate = deferred<Response>();
    const { fetch, calls } = scriptedFetch({ 'ngx-a': [networkError(), () => gate.promise] });
    const { instance } = await client({ fetch, maxAttempts: 1 });
    const [a, b] = await Promise.all([instance.getPackage('ngx-a'), instance.getPackage('ngx-a')]);
    expect(a.status).toBe('unavailable');
    expect(b).toBe(a);
    expect(calls).toHaveLength(1);

    const retry = instance.getPackage('ngx-a');
    gate.resolve(json(packument('ngx-a'))());
    expect(ok(await retry).source).toBe('network');
    expect(calls).toHaveLength(2);
  });

  it('keeps at most 4 requests in progress by default, and honours a custom limit', async () => {
    for (const [limit, expected] of [[undefined, 4], [2, 2]] as const) {
      let active = 0;
      let peak = 0;
      const fetch: FetchLike = async (url) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        const name = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
        return json(packument(name))();
      };
      const options: RegistryClientOptions = { fetch };
      if (limit !== undefined) options.concurrency = limit;
      const { instance } = await client(options);
      const names = Array.from({ length: 12 }, (_, i) => `ngx-lib-${i}`);
      const results = await instance.getPackages(names);
      expect([...results.values()].every((r) => r.status === 'ok')).toBe(true);
      expect(peak).toBe(expected);
    }
  });

  it('rejects invalid limits', () => {
    expect(() => new RegistryClient({ concurrency: 0 })).toThrow(RegistryConfigError);
    expect(() => new RegistryClient({ maxAttempts: 1.5 })).toThrow(RegistryConfigError);
    expect(() => new RegistryClient({ ttlMs: -1 })).toThrow(RegistryConfigError);
  });
});
