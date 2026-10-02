import http from 'node:http';
import https from 'node:https';
import { request as namedHttpsRequest } from 'node:https';
import { describe, expect, it } from 'vitest';
import { NetworkAccessError, takeNetworkAttempts } from './network-guard.js';

// Each test drains the recorded attempts itself so the global afterEach check stays green.
describe('network guard', () => {
  it('rejects globalThis.fetch', async () => {
    await expect(fetch('https://registry.npmjs.org/@angular%2fcore')).rejects.toBeInstanceOf(NetworkAccessError);
    expect(takeNetworkAttempts()).toEqual(['fetch https://registry.npmjs.org/@angular%2fcore']);
  });

  it('rejects node:http and node:https requests, including named imports', () => {
    expect(() => http.get('http://example.com/')).toThrow(NetworkAccessError);
    expect(() => https.request({ hostname: 'example.com', path: '/x' })).toThrow(NetworkAccessError);
    expect(() => namedHttpsRequest('https://example.com/')).toThrow(NetworkAccessError);
    expect(takeNetworkAttempts()).toEqual([
      'http.get http://example.com/',
      'https.request example.com/x',
      'https.request https://example.com/',
    ]);
  });

  it('records an attempt even when the caller swallows the error', async () => {
    const offlineFallback = await fetch('https://example.com/').catch(() => 'fallback');
    expect(offlineFallback).toBe('fallback');
    // Without this drain the global afterEach hook would fail this test.
    expect(takeNetworkAttempts()).toHaveLength(1);
  });
});

// Expected to fail: the global afterEach hook rejects any test that reached for the network,
// even when the code under test caught the error.
it.fails('fails a test whose network call was swallowed', async () => {
  await fetch('https://example.com/').catch(() => undefined);
});
