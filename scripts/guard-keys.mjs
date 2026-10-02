#!/usr/bin/env node
// Blocks commits that contain credential files or key-shaped strings.
// Runs from .githooks/pre-commit (enable with: git config core.hooksPath .githooks).
//   node scripts/guard-keys.mjs        scan staged content
//   node scripts/guard-keys.mjs --all  scan tracked and untracked, non-ignored files
// A line holding a deliberately fake key-shaped value can end with: guard-allow-secret
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const all = process.argv.includes('--all');
const git = (...args) => execFileSync('git', args, { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
const root = git('rev-parse', '--show-toplevel').toString('utf8').trim();
const list = (buf) => buf.toString('utf8').split('\0').filter(Boolean);
const files = all
  ? list(git('-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'))
  : list(git('-C', root, 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'));

const forbiddenName = (f) => {
  const base = path.basename(f).toLowerCase();
  return (
    base === '.env' || base.startsWith('.env.') ||
    /\.(key|pem|jks|keystore|p12|pfx)$/.test(base) ||
    base === 'google-services.json' || base === 'credentials.json' ||
    base.includes('token') || base.includes('secret')
  );
};

const patterns = [
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['npm token', /\bnpm_[A-Za-z0-9]{30,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Anthropic/OpenAI key', /\bsk-(ant-)?[A-Za-z0-9_-]{24,}\b/],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['npm auth line', /_authToken\s*=\s*\S+/],
];

const problems = [];
for (const f of files) {
  if (forbiddenName(f)) { problems.push(`${f}: credential-type file name`); continue; }
  let content;
  if (all) {
    const abs = path.join(root, f);
    if (!existsSync(abs)) continue;
    content = readFileSync(abs);
  } else {
    try { content = git('-C', root, 'show', `:${f}`); } catch { continue; }
  }
  if (content.includes(0)) continue; // binary
  content.toString('utf8').split(/\r?\n/).forEach((line, i) => {
    if (line.endsWith('guard-allow-secret')) return;
    for (const [rule, re] of patterns) if (re.test(line)) problems.push(`${f}:${i + 1}: looks like a ${rule}`);
  });
}

if (problems.length) {
  console.error('Commit blocked: possible secrets found.');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`guard-keys: ${files.length} file(s) checked, no secrets found.`);
