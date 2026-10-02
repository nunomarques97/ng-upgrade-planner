#!/usr/bin/env node
// Records the npm registry data that the fixture apps need into test/fixtures/registry, in the
// same schema as the runtime cache, so tests and the warm-cache benchmark can run offline.
//
// Usage: npm run build && node scripts/record-fixtures.mjs
//
// Uses the network (the public npm registry). Run it by hand; tests never run it. It replaces
// every recording in test/fixtures/registry.
//
// Recordings are trimmed to what the planner reads, which leaves every plan unchanged:
// - dist-tags: only "latest";
// - every published version is kept, with only its @angular/* peer dependencies (and their
//   optional flags) and its deprecation message, except that framework packages (@angular/core,
//   @angular/cli and the others ng update moves) keep stable versions only, and a package with no
//   @angular/* peer in any version keeps only its latest version: the planner reads nothing else
//   from them;
// - @angular/core and @angular/compiler-cli also keep their typescript, rxjs and zone.js peers,
//   and @angular/core and @angular/cli keep engines.node;
// - publish times are dropped, and every record gets the same fetch time (the recording time).
// Before writing, the script checks that each fixture's plan is the same with the full and the
// trimmed data.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appsDir = path.join(root, 'test', 'fixtures', 'apps');
const registryDir = path.join(root, 'test', 'fixtures', 'registry');
const dist = path.join(root, 'dist');
// 10 MB in decimal units, the stricter reading; Windows checkouts with CRLF line ends add about 2%.
const MAX_FIXTURES_BYTES = 10_000_000;

const REQUIREMENT_PEERS = {
  '@angular/core': ['rxjs', 'zone.js'],
  '@angular/compiler-cli': ['typescript'],
};
const NODE_ENGINE = new Set(['@angular/core', '@angular/cli']);

function fail(message) {
  console.error(`record-fixtures: ${message}`);
  process.exit(1);
}

if (!existsSync(path.join(dist, 'index.js'))) fail('dist/ is missing; run "npm run build" first.');
const { buildPlan, readProject, RegistryClient } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { isFrameworkPackage } = await import(pathToFileURL(path.join(dist, 'plan', 'index.js')).href);
const { cacheFileName } = await import(pathToFileURL(path.join(dist, 'registry', 'index.js')).href);

function keepPeer(packageName, peer) {
  return peer.startsWith('@angular/') || (REQUIREMENT_PEERS[packageName] ?? []).includes(peer);
}

function hasAngularPeer(version) {
  return Object.keys(version.peerDependencies ?? {}).some((peer) => peer.startsWith('@angular/'));
}

function pick(map, keep) {
  if (!map) return undefined;
  const names = Object.keys(map).filter(keep).sort();
  return names.length > 0 ? Object.fromEntries(names.map((name) => [name, map[name]])) : undefined;
}

/** The trimmed copy of a record; key order is fixed so recordings diff cleanly. */
function trimRecord(record, fetchedAt) {
  const latest = record.distTags.latest;
  let kept = Object.keys(record.versions);
  if (isFrameworkPackage(record.name)) {
    kept = kept.filter((version) => !version.includes('-'));
  } else if (!record.name.startsWith('@angular/') && !kept.some((version) => hasAngularPeer(record.versions[version]))) {
    kept = kept.filter((version) => version === latest);
  }
  const versions = {};
  for (const version of kept) {
    const raw = record.versions[version];
    const out = {};
    const peers = pick(raw.peerDependencies, (peer) => keepPeer(record.name, peer));
    if (peers) out.peerDependencies = peers;
    const meta = pick(raw.peerDependenciesMeta, (peer) => keepPeer(record.name, peer));
    if (meta) out.peerDependenciesMeta = Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, { optional: v.optional }]));
    if (NODE_ENGINE.has(record.name) && raw.engines?.node !== undefined) out.engines = { node: raw.engines.node };
    if (raw.deprecated !== undefined) out.deprecated = raw.deprecated;
    versions[version] = out;
  }
  return {
    schema: record.schema,
    name: record.name,
    fetchedAt,
    distTags: latest === undefined ? {} : { latest },
    versions,
  };
}

/** Compact JSON with one version per line, so recordings stay small and still diff and read well. */
function serialize(record) {
  const { versions, ...head } = record;
  const lines = Object.keys(versions).map((version) => `${JSON.stringify(version)}:${JSON.stringify(versions[version])}`);
  return `${JSON.stringify(head).slice(0, -1)},"versions":{\n${lines.join(',\n')}\n}}\n`;
}

/** The plan as JSON without the registry fetch times, which differ between full and trimmed data. */
function comparable(plan) {
  return JSON.stringify(plan, (key, value) => (key === 'registry' ? undefined : value));
}

function folderSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? folderSize(full) : statSync(full).size;
  }
  return total;
}

const apps = readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (apps.length === 0) fail(`no fixture apps in ${appsDir}`);

const fetchedAt = new Date().toISOString();
const work = mkdtempSync(path.join(os.tmpdir(), 'ngup-record-'));
const fullDir = path.join(work, 'full');
const trimmedDir = path.join(work, 'trimmed');

async function record() {
  // 1. Plan every fixture online and remember every package the planner asked for.
  const client = new RegistryClient({ cacheDir: fullDir });
  const requested = new Set();
  const source = {
    getPackage(name) {
      requested.add(name);
      return client.getPackage(name);
    },
  };
  const projects = new Map();
  for (const app of apps) {
    const project = await readProject(path.join(appsDir, app));
    projects.set(app, project);
    await buildPlan(project, source, { nodeVersion: '20.0.0' });
    console.log(`${app}: Angular ${project.angular.version}, ${requested.size} packages so far`);
  }

  // 2. Trim. A package the registry does not have, or could not serve, cannot be replayed offline.
  const results = await client.getPackages([...requested].sort());
  const problems = [...results.values()].filter((result) => result.status !== 'ok');
  if (problems.length > 0) {
    throw new Error(`could not record ${problems.map((result) => `${result.name} (${result.status})`).join(', ')}`);
  }
  mkdirSync(trimmedDir, { recursive: true });
  for (const name of [...results.keys()].sort()) {
    writeFileSync(path.join(trimmedDir, cacheFileName(name)), serialize(trimRecord(results.get(name).record, fetchedAt)), 'utf8');
  }

  // 3. The trimmed data must give the same plans as the full data (planned to the latest release).
  for (const [app, project] of projects) {
    const options = { nodeVersion: '20.0.0' };
    const full = await buildPlan(project, new RegistryClient({ cacheDir: fullDir, offline: true }), options);
    const trimmed = await buildPlan(project, new RegistryClient({ cacheDir: trimmedDir, offline: true }), options);
    if (comparable(full) !== comparable(trimmed)) throw new Error(`${app}: the trimmed recordings change the plan`);
  }

  // 4. Check the size, then replace the recordings.
  writeFileSync(
    path.join(trimmedDir, 'README.md'),
    [
      '# Recorded registry data',
      '',
      `Recorded from https://registry.npmjs.org on ${fetchedAt.slice(0, 10)} by scripts/record-fixtures.mjs for the apps`,
      'in ../apps. Each file is one package in the runtime cache schema, trimmed to the fields the planner',
      'reads (see the script header). Do not edit by hand; record again instead.',
      '',
    ].join('\n'),
    'utf8',
  );
  const size = folderSize(appsDir) + folderSize(trimmedDir);
  const megabytes = (size / 1024 / 1024).toFixed(2);
  if (size >= MAX_FIXTURES_BYTES) throw new Error(`test/fixtures would be ${megabytes} MB; it must stay under 10 MB.`);
  rmSync(registryDir, { recursive: true, force: true });
  cpSync(trimmedDir, registryDir, { recursive: true });
  console.log(`Recorded ${results.size} packages at ${fetchedAt}; test/fixtures is ${megabytes} MB.`);
}

try {
  await record();
} catch (error) {
  console.error(`record-fixtures: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
