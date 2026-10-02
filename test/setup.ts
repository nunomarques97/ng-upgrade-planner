import { afterAll, afterEach } from 'vitest';
import { installNetworkGuard, takeNetworkAttempts } from './network-guard.js';

installNetworkGuard();

function failOnNetworkAttempts(): void {
  const attempts = takeNetworkAttempts();
  if (attempts.length > 0) {
    throw new Error(`Test attempted real network access: ${attempts.join(', ')}`);
  }
}

afterEach(failOnNetworkAttempts);
afterAll(failOnNetworkAttempts);
