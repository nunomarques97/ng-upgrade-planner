// Plans the real open-source apps in test/fixtures/apps offline, against the registry data
// recorded by scripts/record-fixtures.mjs, and compares the Markdown report and the plan model
// with committed snapshots. The network guard in test/setup.ts fails any test that reaches the
// network.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPlan, type PackageSource, type UpgradePlan } from '../src/plan/index.js';
import { readProject } from '../src/project/index.js';
import { RecordCache, RegistryClient, type PackageResult } from '../src/registry/index.js';
import { renderMarkdown } from '../src/report/index.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const appsDir = path.join(fixtures, 'apps');
const registryDir = path.join(fixtures, 'registry');
const APPS = readdirSync(appsDir).sort();
const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
// Fixed inputs, so the snapshots do not depend on the date, the Node.js version or the tool version.
const TARGET_MAJOR = 22;
const NODE_VERSION = '20.19.0';
const TOOL_VERSION = 'snapshot';

function folderSize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? folderSize(full) : statSync(full).size;
  }
  return total;
}

/** A clock just after the recording, so the recorded data counts as a warm cache within its TTL. */
async function recordingClock(): Promise<() => number> {
  const core = await new RecordCache(registryDir).read('@angular/core');
  if (!core) throw new Error('test/fixtures/registry has no @angular/core record; run scripts/record-fixtures.mjs');
  const now = Date.parse(core.fetchedAt) + 60_000;
  return () => now;
}

interface FixturePlan {
  plan: UpgradePlan;
  results: PackageResult[];
}

async function planFixture(app: string): Promise<FixturePlan> {
  const client = new RegistryClient({ cacheDir: registryDir, offline: true, now: await recordingClock() });
  const results: PackageResult[] = [];
  const source: PackageSource = {
    async getPackage(name) {
      const result = await client.getPackage(name);
      results.push(result);
      return result;
    },
  };
  const project = await readProject(path.join(appsDir, app));
  const plan = await buildPlan(project, source, { targetMajor: TARGET_MAJOR, nodeVersion: NODE_VERSION });
  return { plan, results };
}

describe('fixture apps', () => {
  it('are five real apps with provenance, spanning old and recent Angular and several lockfile formats', async () => {
    expect(APPS).toHaveLength(5);
    const majors = new Set<number>();
    const lockfiles = new Set<string>();
    for (const app of APPS) {
      const files = readdirSync(path.join(appsDir, app)).sort();
      const lockfile = files.filter((file) => LOCKFILES.includes(file));
      expect(lockfile, app).toHaveLength(1);
      expect(files, app).toEqual(['SOURCE.md', 'package.json', lockfile[0]!].sort());
      lockfiles.add(lockfile[0]!);

      const source = readFileSync(path.join(appsDir, app, 'SOURCE.md'), 'utf8');
      expect(source, app).toMatch(/^- Repository: https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/m);
      expect(source, app).toMatch(/^- Commit: [0-9a-f]{40} \(\d{4}-\d{2}-\d{2}\)$/m);
      expect(source, app).toMatch(/^- Licence: (MIT|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|ISC) /m);
      expect(source, app).toMatch(/^- Retrieved: \d{4}-\d{2}-\d{2}$/m);

      const project = await readProject(path.join(appsDir, app));
      expect(project.angular.source, app).toBe('lockfile');
      majors.add(Number(project.angular.version.split('.')[0]));
    }
    expect(majors.size).toBeGreaterThanOrEqual(4);
    expect(Math.min(...majors)).toBeLessThanOrEqual(12);
    expect(Math.max(...majors)).toBeGreaterThanOrEqual(17);
    expect(lockfiles.size).toBeGreaterThanOrEqual(2);
  });

  it('stay under 10 MB together with the recorded registry data', () => {
    expect(folderSize(fixtures)).toBeLessThan(10_000_000);
  });
});

describe.each(APPS)('plan for %s', (app) => {
  it('finds every package it needs in the recordings, as confirmed cache data', async () => {
    const { plan, results } = await planFixture(app);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result, result.name).toMatchObject({ status: 'ok', source: 'cache', stale: false });
    }
    expect(plan.unclassified).toEqual([]);
    expect(plan.target.major).toBe(TARGET_MAJOR);
    expect(plan.hops.at(-1)?.to).toBe(TARGET_MAJOR);
  });

  it('matches the snapshots of the Markdown report and the plan model', async () => {
    const { plan } = await planFixture(app);
    await expect(renderMarkdown(plan, { toolVersion: TOOL_VERSION })).toMatchFileSnapshot(
      `./__snapshots__/fixtures/${app}.md`,
    );
    await expect(`${JSON.stringify(plan, null, 2)}\n`).toMatchFileSnapshot(`./__snapshots__/fixtures/${app}.plan.json`);
  });
});
