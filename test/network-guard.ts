// Blocks real network access from tests. Every attempt is recorded and rejected, and the
// setup file fails the running test afterwards, so code that swallows the rejection
// (for example an offline fallback) still cannot hide a real network call.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';

export class NetworkAccessError extends Error {
  constructor(what: string) {
    super(`Tests must not use the network (blocked ${what}). Inject a fake fetch or use recorded fixtures.`);
    this.name = 'NetworkAccessError';
  }
}

const attempts: string[] = [];
let installed = false;

function describeTarget(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  if (input && typeof input === 'object') {
    const o = input as { host?: unknown; hostname?: unknown; port?: unknown; path?: unknown };
    const host = typeof o.hostname === 'string' ? o.hostname : typeof o.host === 'string' ? o.host : '?';
    const port = typeof o.port === 'string' || typeof o.port === 'number' ? `:${o.port}` : '';
    return `${host}${port}${typeof o.path === 'string' ? o.path : ''}`;
  }
  return String(input);
}

function block(what: string, target: unknown): NetworkAccessError {
  const label = `${what} ${describeTarget(target)}`;
  attempts.push(label);
  return new NetworkAccessError(label);
}

export function installNetworkGuard(): void {
  if (installed) return;
  installed = true;

  globalThis.fetch = (input: unknown) => Promise.reject(block('fetch', input));

  const throwing = (what: string) =>
    function blocked(target: unknown): never {
      throw block(what, target);
    };
  http.request = throwing('http.request');
  http.get = throwing('http.get');
  https.request = throwing('https.request');
  https.get = throwing('https.get');
  net.connect = throwing('net.connect');
  net.createConnection = throwing('net.createConnection');
  tls.connect = throwing('tls.connect');
  // Propagate the patched functions to named ESM imports such as `import { request } from 'node:https'`.
  syncBuiltinESMExports();
}

/** Returns and clears the recorded network attempts. */
export function takeNetworkAttempts(): string[] {
  return attempts.splice(0, attempts.length);
}
