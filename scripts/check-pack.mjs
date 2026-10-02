#!/usr/bin/env node
// Checks what `npm pack` would put in the published package, without writing a tarball.
// Fails unless the list holds only package.json, README.md, LICENSE, CHANGELOG.md and compiled
// JavaScript under dist/ (no tests, fixtures, source maps, TypeScript sources, docs or dotfiles),
// and dist/cli.js starts with a Node.js shebang.
//
// Usage: npm run build && npm run check:pack
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT_FILES = ['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md'];
export const CLI = 'dist/cli.js';
export const SHEBANG = '#!/usr/bin/env node';
const BANNED_FOLDERS = /^(src|test|tests|__tests__|__snapshots__|fixtures|docs|coverage|scripts|node_modules)$/i;

function fail(message) {
  console.error(`check-pack: ${message}`);
  process.exit(1);
}

/**
 * Returns one line per problem with a packed file list (paths relative to the package root).
 * `cliText` is the content of dist/cli.js; the shebang is checked only when it is given.
 */
export function packProblems(files, cliText) {
  const problems = [];
  const list = files.map((file) => file.replace(/\\/g, '/').replace(/^\.\//, ''));
  for (const file of list) {
    if (ROOT_FILES.includes(file)) continue;
    const segments = file.split('/');
    const base = segments[segments.length - 1] ?? '';
    if (segments[0] !== 'dist' || segments.length < 2) {
      problems.push(`${file}: not allowed in the package (only ${ROOT_FILES.join(', ')} and dist/)`);
    } else if (segments.some((segment) => segment.startsWith('.'))) {
      problems.push(`${file}: dotfile in the package`);
    } else if (segments.slice(1, -1).some((segment) => BANNED_FOLDERS.test(segment))) {
      problems.push(`${file}: tests, fixtures, sources or docs in the package`);
    } else if (/\.map$/i.test(base)) {
      problems.push(`${file}: source map in the package`);
    } else if (/\.[cm]?tsx?$/i.test(base)) {
      problems.push(`${file}: TypeScript source or declaration in the package`);
    } else if (/\.(test|spec)\.[cm]?js$/i.test(base)) {
      problems.push(`${file}: test file in the package`);
    } else if (!/\.js$/i.test(base)) {
      problems.push(`${file}: unexpected file type in dist/ (only compiled .js is expected)`);
    }
  }
  for (const required of [...ROOT_FILES, CLI]) {
    if (!list.includes(required)) problems.push(`${required}: missing from the package`);
  }
  if (cliText !== undefined) {
    const firstLine = cliText.split('\n', 1)[0];
    if (firstLine !== SHEBANG) {
      problems.push(`${CLI}: first line must be exactly "${SHEBANG}" with a LF line ending`);
    }
  }
  return problems;
}

/** Runs `npm pack --dry-run --json` and returns the packed file paths and the unpacked size. */
function dryRunPack() {
  const args = ['pack', '--dry-run', '--json', '--ignore-scripts'];
  const options = { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  // Under `npm run`, npm_execpath points at npm's own JavaScript entry point, which avoids
  // spawning npm.cmd on Windows. Otherwise go through the shell, which finds npm on both systems.
  const npmCli = process.env.npm_execpath;
  const result =
    npmCli && /npm-cli\.[cm]?js$/i.test(npmCli)
      ? spawnSync(process.execPath, [npmCli, ...args], options)
      : spawnSync(`npm ${args.join(' ')}`, { ...options, shell: true });
  if (result.error) fail(`could not run npm pack: ${result.error.message}`);
  if (result.status !== 0) fail(`npm pack exited with ${result.status}:\n${result.stderr}`);
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    fail(`npm pack did not print JSON:\n${result.stdout}`);
  }
  const entry = Array.isArray(report) ? report[0] : undefined;
  if (!entry || !Array.isArray(entry.files)) fail('npm pack printed no file list.');
  return { files: entry.files.map((file) => String(file.path)), size: Number(entry.unpackedSize) };
}

function main() {
  const cliPath = path.join(root, ...CLI.split('/'));
  if (!existsSync(cliPath)) fail(`${CLI} is missing; run "npm run build" first.`);
  const { files, size } = dryRunPack();
  const problems = packProblems(files, readFileSync(cliPath, 'utf8'));
  if (problems.length > 0) {
    console.error(`check-pack: the npm package is not clean (${files.length} files):`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  const kilobytes = Number.isFinite(size) ? `, ${(size / 1024).toFixed(1)} kB unpacked` : '';
  console.log(`check-pack: OK, ${files.length} files${kilobytes}.`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = fileURLToPath(import.meta.url);
if (process.platform === 'win32' ? invoked.toLowerCase() === self.toLowerCase() : invoked === self) main();
