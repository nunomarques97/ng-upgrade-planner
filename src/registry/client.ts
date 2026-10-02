// npm registry client: cached, rate limited, deduplicated and able to work offline.
// It sends no credentials: it never reads .npmrc and only sets User-Agent and Accept headers.
import { readFileSync } from 'node:fs';
import { describeCause } from '../project/errors.js';
import { isValidPackageName } from '../project/package-name.js';
import { RecordCache, defaultCacheDir } from './cache.js';
import { ConcurrencyLimiter } from './limiter.js';
import { trimRegistryDocument } from './record.js';
import type { PackageRecord, PackageResult } from './types.js';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_MAX_ATTEMPTS = 4;

// Prefer the abbreviated document (much smaller); fall back to the full one, which also has
// publish times.
const ACCEPT = 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*; q=0.1';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface RegistryClientOptions {
  /** Registry base URL (http or https, no credentials). Default: the public npm registry. */
  registry?: string;
  /** Cache folder. Default: a folder in the OS user cache directory. */
  cacheDir?: string;
  /** Use only cached records, whatever their age; never touch the network. */
  offline?: boolean;
  /** Age after which a cached record is refreshed in online mode. Default: 24 hours. */
  ttlMs?: number;
  /** Maximum number of registry requests in progress at once. Default: 4. */
  concurrency?: number;
  /** Attempts per package, including the first, for 429, 5xx and network errors. Default: 4. */
  maxAttempts?: number;
  /** First retry delay; doubles on each retry. Default: 500 ms. */
  baseDelayMs?: number;
  /** Longest wait between attempts; a longer Retry-After ends the retries. Default: 30 s. */
  maxDelayMs?: number;
  /** Timeout of one request, body included. Default: 30 s. */
  timeoutMs?: number;
  userAgent?: string;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class RegistryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryConfigError';
  }
}

type Download =
  | { kind: 'ok'; doc: unknown }
  | { kind: 'not-found' }
  | { kind: 'failed'; reason: string };

let packageVersion: string | undefined;

function ownVersion(): string {
  if (packageVersion === undefined) {
    try {
      // Two levels up from both src/registry and dist/registry.
      const pkg: unknown = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
      const version = (pkg as { version?: unknown }).version;
      packageVersion = typeof version === 'string' ? version : 'unknown';
    } catch {
      packageVersion = 'unknown';
    }
  }
  return packageVersion;
}

export function defaultUserAgent(): string {
  return `ng-upgrade-planner/${ownVersion()} node/${process.version} ${process.platform}`;
}

/** Validates the registry option and returns it without a trailing slash. */
export function normalizeRegistryUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // The value is not echoed: it may contain credentials.
    throw new RegistryConfigError('Registry URL is not a valid URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RegistryConfigError('Registry URL must start with https:// or http://.');
  }
  if (url.username || url.password) {
    throw new RegistryConfigError('Registry URL must not contain a user name or password.');
  }
  if (url.search || url.hash) {
    throw new RegistryConfigError('Registry URL must not contain a query or fragment.');
  }
  return url.href.replace(/\/+$/, '');
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new RegistryConfigError(`${label} must be a positive integer.`);
  return value;
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RegistryConfigError(`${label} must be zero or more.`);
  return value;
}

/** Retry-After as milliseconds (delta seconds or an HTTP date), or undefined when absent or invalid. */
export function parseRetryAfter(header: string | null, now: number): number | undefined {
  if (header === null) return undefined;
  const text = header.trim();
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Nothing left to release.
  }
}

const frozen = <T extends object>(value: T): T => Object.freeze(value);

export class RegistryClient {
  readonly registry: string;
  readonly cache: RecordCache;
  readonly offline: boolean;
  private readonly ttlMs: number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly limiter: ConcurrencyLimiter;
  private readonly inFlight = new Map<string, Promise<PackageResult>>();
  private readonly settled = new Map<string, PackageResult>();

  constructor(options: RegistryClientOptions = {}) {
    this.registry = normalizeRegistryUrl(options.registry ?? DEFAULT_REGISTRY);
    this.cache = new RecordCache(options.cacheDir ?? defaultCacheDir());
    this.offline = options.offline ?? false;
    this.ttlMs = nonNegative(options.ttlMs ?? DEFAULT_TTL_MS, 'Cache TTL');
    this.limiter = new ConcurrencyLimiter(positiveInteger(options.concurrency ?? DEFAULT_CONCURRENCY, 'Concurrency'));
    this.maxAttempts = positiveInteger(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 'Maximum attempts');
    this.baseDelayMs = nonNegative(options.baseDelayMs ?? 500, 'Retry delay');
    this.maxDelayMs = nonNegative(options.maxDelayMs ?? 30_000, 'Maximum retry delay');
    this.timeoutMs = positiveInteger(options.timeoutMs ?? 30_000, 'Request timeout');
    this.userAgent = options.userAgent ?? defaultUserAgent();
    this.fetchImpl = options.fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
  }

  /**
   * Looks up one package. Never throws for registry or cache problems: they become
   * `unavailable`. Concurrent calls for the same name share one lookup; successful and
   * not-found results are kept for the life of the client, failures are not.
   */
  getPackage(name: string): Promise<PackageResult> {
    const done = this.settled.get(name);
    if (done) return Promise.resolve(done);
    const pending = this.inFlight.get(name);
    if (pending) return pending;

    const lookup = this.lookup(name)
      .catch((error: unknown): PackageResult => this.unavailable(name, `lookup failed: ${describeCause(error)}`))
      .then((result) => {
        if (result.status !== 'unavailable') this.settled.set(name, result);
        return result;
      })
      .finally(() => {
        if (this.inFlight.get(name) === lookup) this.inFlight.delete(name);
      });
    this.inFlight.set(name, lookup);
    return lookup;
  }

  /** Looks up several packages; the map has one entry per distinct name. */
  async getPackages(names: Iterable<string>): Promise<Map<string, PackageResult>> {
    const unique = [...new Set(names)];
    const results = await Promise.all(unique.map((name) => this.getPackage(name)));
    return new Map(unique.map((name, index) => [name, results[index]!]));
  }

  private unavailable(name: string, reason: string): PackageResult {
    return frozen({ status: 'unavailable', name, reason });
  }

  private fromCache(record: PackageRecord, stale: boolean, fallbackReason?: string): PackageResult {
    const result: PackageResult = { status: 'ok', name: record.name, record, source: 'cache', stale };
    return frozen(fallbackReason === undefined ? result : { ...result, fallbackReason });
  }

  private isFresh(record: PackageRecord): boolean {
    const age = this.now() - Date.parse(record.fetchedAt);
    return age >= 0 && age <= this.ttlMs;
  }

  private async lookup(name: string): Promise<PackageResult> {
    if (!isValidPackageName(name)) return this.unavailable(name, 'not a valid npm package name');

    const cached = await this.cache.read(name);
    if (this.offline) {
      return cached ? this.fromCache(cached, !this.isFresh(cached)) : this.unavailable(name, 'not in the offline cache');
    }
    if (cached && this.isFresh(cached)) return this.fromCache(cached, false);

    const download = await this.limiter.run(() => this.download(name));
    if (download.kind === 'not-found') return frozen({ status: 'not-found', name });

    let failure: string;
    if (download.kind === 'ok') {
      const record = trimRegistryDocument(download.doc, name, new Date(this.now()));
      if (record) {
        // The cache is an optimisation: a failed write must not fail the lookup.
        await this.cache.write(record).catch(() => undefined);
        return frozen({ status: 'ok', name, record, source: 'network', stale: false });
      }
      failure = 'the registry response does not have the expected shape';
    } else {
      failure = download.reason;
    }
    return cached ? this.fromCache(cached, true, failure) : this.unavailable(name, failure);
  }

  private packageUrl(name: string): string {
    // Valid names are URL-safe apart from the scope separator.
    return `${this.registry}/${name.replace('/', '%2f')}`;
  }

  private backoff(attempt: number): number {
    return Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (attempt - 1));
  }

  private async download(name: string): Promise<Download> {
    const fetchImpl = this.fetchImpl ?? globalThis.fetch;
    const url = this.packageUrl(name);
    let reason = 'no attempt was made';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const last = attempt === this.maxAttempts;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: { 'user-agent': this.userAgent, accept: ACCEPT },
          redirect: 'follow',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        reason = `network error: ${describeCause(error)}`;
        if (!last) await this.sleep(this.backoff(attempt));
        continue;
      }

      if (response.status === 404) {
        await discardBody(response);
        return { kind: 'not-found' };
      }

      if (response.status >= 200 && response.status < 300) {
        let text: string;
        try {
          text = await response.text();
        } catch (error) {
          reason = `network error while reading the response: ${describeCause(error)}`;
          if (!last) await this.sleep(this.backoff(attempt));
          continue;
        }
        try {
          return { kind: 'ok', doc: JSON.parse(text) as unknown };
        } catch {
          return { kind: 'failed', reason: 'the registry response is not valid JSON' };
        }
      }

      await discardBody(response);
      reason = `the registry answered HTTP ${response.status}`;
      if (response.status !== 429 && response.status < 500) return { kind: 'failed', reason };
      if (last) break;
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'), this.now());
      if (retryAfter !== undefined && retryAfter > this.maxDelayMs) {
        return { kind: 'failed', reason: `${reason} and asked to wait ${Math.ceil(retryAfter / 1000)} s` };
      }
      await this.sleep(retryAfter ?? this.backoff(attempt));
    }
    return { kind: 'failed', reason: `${reason} (${this.maxAttempts} attempts)` };
  }
}
