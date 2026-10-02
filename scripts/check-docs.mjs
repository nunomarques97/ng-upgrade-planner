#!/usr/bin/env node
// Checks the project documents: the required files exist, docs/STATE.md starts with YAML
// front-matter holding every state key, docs/WALKTHROUGH.md stays within its word budget, and
// no em-dash appears in src/, docs/, README.md, CONTRIBUTING.md or CHANGELOG.md.
//
// Usage: node scripts/check-docs.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const REQUIRED_DOCS = ['README.md', 'CONTRIBUTING.md', 'LICENSE', 'CHANGELOG.md', 'docs/STATE.md', 'docs/WALKTHROUGH.md'];
export const STATE_KEYS = ['status', 'sponsor_action', 'kill_review', 'success_metric'];
export const WALKTHROUGH_MAX_WORDS = 1100;
const DASH_FOLDERS = ['src', 'docs'];
const DASH_FILES = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md'];
const EM_DASH = '\u2014';

function read(file) {
  return readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function filesUnder(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/** Counts words: whitespace-separated tokens holding at least one letter or digit. */
export function countWords(text) {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Returns the problems with the STATE.md front-matter (empty when it is valid). */
export function frontMatterProblems(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!match) return ['docs/STATE.md: must start with YAML front-matter between "---" lines'];
  let data;
  try {
    data = parse(match[1] ?? '');
  } catch (error) {
    return [`docs/STATE.md: front-matter is not valid YAML (${error instanceof Error ? error.message : String(error)})`];
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return ['docs/STATE.md: front-matter must be a YAML mapping'];
  }
  const problems = [];
  for (const key of STATE_KEYS) {
    const value = data[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      problems.push(`docs/STATE.md: front-matter lacks "${key}"`);
    } else if (typeof value === 'object') {
      problems.push(`docs/STATE.md: front-matter "${key}" must be a single value`);
    }
  }
  return problems;
}

/** Checks the documents of the project in `root` and returns one line per problem. */
export function checkDocs(root) {
  const problems = [];
  for (const doc of REQUIRED_DOCS) {
    if (!existsSync(path.join(root, doc))) problems.push(`${doc}: missing`);
  }

  const state = path.join(root, 'docs', 'STATE.md');
  if (existsSync(state)) problems.push(...frontMatterProblems(read(state)));

  const walkthrough = path.join(root, 'docs', 'WALKTHROUGH.md');
  if (existsSync(walkthrough)) {
    const words = countWords(read(walkthrough));
    if (words > WALKTHROUGH_MAX_WORDS) {
      problems.push(`docs/WALKTHROUGH.md: ${words} words, the limit is ${WALKTHROUGH_MAX_WORDS}`);
    }
  }

  const scanned = [];
  for (const folder of DASH_FOLDERS) {
    const dir = path.join(root, folder);
    if (existsSync(dir) && statSync(dir).isDirectory()) scanned.push(...filesUnder(dir));
  }
  for (const file of DASH_FILES) {
    const full = path.join(root, file);
    if (existsSync(full)) scanned.push(full);
  }
  for (const file of scanned.sort()) {
    const content = readFileSync(file);
    if (content.includes(0)) continue; // binary
    const relative = path.relative(root, file).split(path.sep).join('/');
    content
      .toString('utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (line.includes(EM_DASH)) problems.push(`${relative}:${index + 1}: contains an em-dash`);
      });
  }
  return problems;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = checkDocs(root);
  if (problems.length > 0) {
    console.error('check-docs: problems found:');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  const words = countWords(read(path.join(root, 'docs', 'WALKTHROUGH.md')));
  console.log(`check-docs: OK (WALKTHROUGH.md has ${words} words).`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = fileURLToPath(import.meta.url);
if (process.platform === 'win32' ? invoked.toLowerCase() === self.toLowerCase() : invoked === self) main();
