#!/usr/bin/env node
// Warm-cache benchmark: runs the built CLI (dist/cli.js) on every fixture app, offline, with the
// recorded registry data in test/fixtures/registry as its cache, writing both reports to a
// temporary folder. Prints each duration and fails if any run fails or takes 30 s or more.
//
// Usage: npm run build && node scripts/bench-warm.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'dist', 'cli.js');
const appsDir = path.join(root, 'test', 'fixtures', 'apps');
const registryDir = path.join(root, 'test', 'fixtures', 'registry');
const LIMIT_MS = 30_000;

if (!existsSync(cli)) {
  console.error('bench-warm: dist/cli.js is missing; run "npm run build" first.');
  process.exit(1);
}

const apps = readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (apps.length === 0) {
  console.error('bench-warm: no fixture apps found.');
  process.exit(1);
}
const out = mkdtempSync(path.join(os.tmpdir(), 'ngup-bench-'));
const failures = [];

try {
  for (const app of apps) {
    const args = [cli, '--cwd', path.join(appsDir, app), '--offline', '--cache-dir', registryDir, '--out-dir', path.join(out, app)];
    const started = performance.now();
    // The CLI gets twice the limit to finish, so a slow run is still measured and reported.
    const run = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: LIMIT_MS * 2, env: { ...process.env, NO_COLOR: '1' } });
    const ms = performance.now() - started;
    let problem = null;
    if (run.error) problem = run.error.message;
    else if (run.status !== 0) problem = `exit code ${run.status}: ${run.stderr.trim().split('\n')[0] ?? ''}`;
    else if (ms >= LIMIT_MS) problem = `took ${(ms / 1000).toFixed(2)} s (limit ${LIMIT_MS / 1000} s)`;
    const summary = /^Total effort: .*$/m.exec(run.stdout ?? '')?.[0] ?? '';
    console.log(`${problem ? 'FAIL' : 'ok  '} ${app.padEnd(24)} ${(ms / 1000).toFixed(2).padStart(6)} s  ${problem ?? summary}`);
    if (problem) failures.push(app);
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`bench-warm: ${failures.length} of ${apps.length} runs failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`bench-warm: all ${apps.length} runs finished in under ${LIMIT_MS / 1000} s.`);
