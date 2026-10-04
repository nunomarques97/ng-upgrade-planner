#!/usr/bin/env node
// Fetches the open-source Angular apps listed in scripts/real-apps.json into .cache/real-apps/<id>
// (git-ignored), each at its pinned commit, so scripts/scan-real-apps.mjs can measure the precision
// of the removed-API scan on real code. Uses the network: public github.com over https only.
//
// Safety: every manifest field is checked against a strict pattern before use, git runs with an
// argument list and no shell, with an empty global configuration, no system configuration, no
// credential helper, no hooks or templates and no terminal prompts, and only an allow-list of
// environment variables is passed on. Nothing in the fetched apps is run: no install, no scripts.
//
// Usage: node scripts/fetch-real-apps.mjs [--only <id>]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST = path.join(ROOT, 'scripts', 'real-apps.json');
export const CACHE_DIR = path.join(ROOT, '.cache', 'real-apps');

export const PERMISSIVE_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'];
export const LOCKFILE_KINDS = ['npm', 'pnpm', 'yarn'];

const ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO = /^[A-Za-z0-9_.-]{1,100}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const REPOSITORY_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/;
const LICENSE_FILE = /^[A-Za-z0-9_.-]{1,100}$/;
const PATH_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const KEYS = ['id', 'repository', 'commit', 'license', 'licenseUrl', 'path', 'lockfile', 'angular'];

function fail(message) {
  console.error(`fetch-real-apps: ${message}`);
  process.exit(1);
}

/**
 * Returns the problems with one manifest app (empty when it is valid). On success the app also gets
 * `owner` and `repo`, taken from its repository URL.
 */
export function appProblems(app) {
  if (app === null || typeof app !== 'object' || Array.isArray(app)) return ['an app must be an object'];
  const label = typeof app.id === 'string' && ID.test(app.id) ? app.id : JSON.stringify(app.id);
  const problems = [];
  const add = (message) => problems.push(`${label}: ${message}`);
  for (const key of Object.keys(app)) if (!KEYS.includes(key)) add(`unknown field "${key}"`);
  for (const key of KEYS) if (typeof app[key] !== 'string') add(`"${key}" must be a string`);
  if (problems.length > 0) return problems;

  if (!ID.test(app.id)) add('id must be lowercase letters, digits and hyphens');
  const repository = REPOSITORY_URL.exec(app.repository);
  if (!repository) add('repository must be https://github.com/<owner>/<repo>');
  else {
    const [, owner, repo] = repository;
    if (!OWNER.test(owner)) add(`owner "${owner}" is not a valid GitHub owner name`);
    if (!REPO.test(repo) || repo === '.' || repo === '..' || repo.endsWith('.git')) {
      add(`repo "${repo}" is not a valid GitHub repository name`);
    }
  }
  if (!COMMIT.test(app.commit)) add('commit must be a full 40-character lowercase hexadecimal hash');
  if (!PERMISSIVE_LICENSES.includes(app.license)) add(`license must be one of ${PERMISSIVE_LICENSES.join(', ')}`);
  const licenseUrl = `${app.repository}/blob/${app.commit}/`;
  if (!app.licenseUrl.startsWith(licenseUrl) || !LICENSE_FILE.test(app.licenseUrl.slice(licenseUrl.length))) {
    add('licenseUrl must point at a licence file of the repository at the pinned commit');
  }
  if (app.path !== '.' && !app.path.split('/').every((segment) => PATH_SEGMENT.test(segment))) {
    add('path must be "." or a relative folder without "." or ".." segments');
  }
  if (!LOCKFILE_KINDS.includes(app.lockfile)) add(`lockfile must be one of ${LOCKFILE_KINDS.join(', ')}`);
  if (!VERSION.test(app.angular)) add('angular must be an exact version such as 16.2.10');
  if (problems.length === 0 && repository) {
    app.owner = repository[1];
    app.repo = repository[2];
  }
  return problems;
}

/** Parses and validates the manifest text; returns the apps or the problems found. */
export function parseManifest(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { apps: [], problems: [`not valid JSON (${error instanceof Error ? error.message : String(error)})`] };
  }
  if (data === null || typeof data !== 'object' || !Array.isArray(data.apps)) {
    return { apps: [], problems: ['must be an object with an "apps" array'] };
  }
  const problems = [];
  const seen = new Set();
  for (const app of data.apps) {
    problems.push(...appProblems(app));
    if (app && typeof app.id === 'string') {
      if (seen.has(app.id)) problems.push(`${app.id}: duplicate id`);
      seen.add(app.id);
    }
  }
  return { apps: data.apps, problems };
}

export function loadManifest(file = MANIFEST) {
  const { apps, problems } = parseManifest(readFileSync(file, 'utf8'));
  if (problems.length > 0) throw new Error(`${path.relative(ROOT, file)}: ${problems.join('; ')}`);
  return apps;
}

/** Environment for git: an allow-list, with prompts, credentials and outside configuration off. */
export function gitEnvironment(source, emptyConfig) {
  const allowed = ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LANG'];
  const proxies = ['HTTPS_PROXY', 'https_proxy', 'NO_PROXY', 'no_proxy'];
  const env = {};
  for (const key of allowed) if (typeof source[key] === 'string') env[key] = source[key];
  // A proxy is passed on only when its URL holds no user name or password.
  for (const key of proxies) if (typeof source[key] === 'string' && !source[key].includes('@')) env[key] = source[key];
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    GIT_LFS_SKIP_SMUDGE: '1',
  };
}

/** Options given to every git command: https only, no credential helper, no hooks. */
export const GIT_OPTIONS = [
  '-c', 'credential.helper=',
  '-c', 'protocol.allow=never',
  '-c', 'protocol.https.allow=always',
  '-c', 'core.hooksPath=.git/no-hooks',
  '-c', 'core.longpaths=true',
  '-c', 'core.symlinks=false',
  '-c', 'advice.detachedHead=false',
];

function git(args, cwd, env) {
  const result = spawnSync('git', [...GIT_OPTIONS, ...args], { cwd, env, shell: false, encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error(`git could not be started (${result.error.message})`);
  return { status: result.status ?? 1, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function headOf(dir, env) {
  if (!existsSync(path.join(dir, '.git'))) return null;
  const head = git(['rev-parse', '--verify', 'HEAD'], dir, env);
  return head.status === 0 ? head.stdout : null;
}

function fetchApp(app, env) {
  const dir = path.join(CACHE_DIR, app.id);
  if (path.dirname(dir) !== CACHE_DIR) throw new Error(`${app.id}: folder outside the cache`);
  if (headOf(dir, env) === app.commit) {
    const status = git(['status', '--porcelain', '--untracked-files=no'], dir, env);
    if (status.status === 0 && status.stdout === '') return 'already fetched';
  }
  // A folder from an earlier commit, or a broken fetch, is replaced. It lies inside the cache.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const url = `https://github.com/${app.owner}/${app.repo}.git`;
  const steps = [
    ['init', '--quiet', '--template=', '.'],
    ['fetch', '--quiet', '--depth', '1', '--no-tags', '--no-recurse-submodules', url, app.commit],
    ['checkout', '--quiet', '--force', '--detach', 'FETCH_HEAD'],
  ];
  for (const step of steps) {
    const result = git(step, dir, env);
    if (result.status !== 0) throw new Error(`${app.id}: git ${step[0]} failed: ${result.stderr || result.stdout}`);
  }
  const head = headOf(dir, env);
  if (head !== app.commit) throw new Error(`${app.id}: checked out ${head ?? 'nothing'}, expected ${app.commit}`);
  return 'fetched';
}

function main() {
  const args = process.argv.slice(2);
  let only = null;
  if (args[0] === '--only' && args.length === 2) only = args[1];
  else if (args.length > 0) fail('usage: node scripts/fetch-real-apps.mjs [--only <id>]');

  let apps;
  try {
    apps = loadManifest();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  if (only !== null) {
    apps = apps.filter((app) => app.id === only);
    if (apps.length === 0) fail(`no app with id "${only}" in scripts/real-apps.json`);
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  const emptyConfig = path.join(CACHE_DIR, '.empty-gitconfig');
  writeFileSync(emptyConfig, '');
  const env = gitEnvironment(process.env, emptyConfig);
  let failed = 0;
  for (const app of apps) {
    const started = Date.now();
    try {
      const outcome = fetchApp(app, env);
      console.log(`${app.id}: ${outcome} at ${app.commit.slice(0, 7)} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    } catch (error) {
      failed++;
      console.error(`${app.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed > 0) fail(`${failed} of ${apps.length} apps could not be fetched`);
  console.log(`fetch-real-apps: ${apps.length} apps in ${path.relative(ROOT, CACHE_DIR)}`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = fileURLToPath(import.meta.url);
if (process.platform === 'win32' ? invoked.toLowerCase() === self.toLowerCase() : invoked === self) main();
