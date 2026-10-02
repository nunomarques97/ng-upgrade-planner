// Checks the Agent Skill shipped in skills/: the SKILL.md front-matter follows the Agent Skills
// specification (https://agentskills.io/specification), every ng-upgrade-planner command line and
// flag it mentions exists in the CLI, and the JSON schema reference documents exactly the keys the
// planner produces.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CLI_NAME, CLI_OPTIONS } from '../../src/cli-options.js';
import type { UpgradePlan } from '../../src/plan/types.js';
import { planJson } from '../../src/report/json.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const skillsDir = path.join(root, 'skills');
const SKILLS = readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const SKILL = 'angular-upgrade-hops';
const skillDir = path.join(skillsDir, SKILL);
const SCHEMA_DOC = path.join(skillDir, 'references', 'plan-json.md');
const SPEC_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];

function read(file: string): string {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

/** Every Markdown file of the skill, relative to its folder. */
function markdownFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return markdownFiles(path.join(dir, entry.name), relative);
    return entry.name.endsWith('.md') ? [relative] : [];
  });
}

/** Splits SKILL.md into its YAML front-matter and body, as the specification describes. */
function splitSkill(text: string): { front: unknown; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error('SKILL.md must start with YAML front-matter between "---" lines');
  return { front: parse(match[1]!) as unknown, body: match[2]! };
}

/** Problems with SKILL.md front-matter under the Agent Skills specification. */
function frontMatterProblems(front: unknown, folder: string): string[] {
  if (front === null || typeof front !== 'object' || Array.isArray(front)) return ['front-matter is not a mapping'];
  const fields = front as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(fields)) if (!SPEC_FIELDS.includes(key)) problems.push(`unknown field "${key}"`);
  const { name, description, compatibility, metadata, license } = fields;
  if (typeof name !== 'string' || name.length < 1 || name.length > 64) {
    problems.push('name must be a string of 1 to 64 characters');
  } else {
    if (!/^[a-z0-9-]+$/.test(name)) problems.push('name may only hold lowercase letters, digits and hyphens');
    if (name.startsWith('-') || name.endsWith('-')) problems.push('name must not start or end with a hyphen');
    if (name.includes('--')) problems.push('name must not hold consecutive hyphens');
    if (name !== folder) problems.push(`name "${name}" must equal the folder name "${folder}"`);
  }
  if (typeof description !== 'string' || description.trim().length < 1 || description.length > 1024) {
    problems.push('description must be a non-empty string of at most 1024 characters');
  }
  if (license !== undefined && (typeof license !== 'string' || license.trim() === '')) problems.push('license must be a string');
  if (compatibility !== undefined && (typeof compatibility !== 'string' || compatibility.length < 1 || compatibility.length > 500)) {
    problems.push('compatibility must be a string of 1 to 500 characters');
  }
  if (metadata !== undefined) {
    const valid =
      metadata !== null &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      Object.values(metadata).every((value) => typeof value === 'string');
    if (!valid) problems.push('metadata must map strings to strings');
  }
  if (fields['allowed-tools'] !== undefined && typeof fields['allowed-tools'] !== 'string') {
    problems.push('allowed-tools must be a string');
  }
  return problems;
}

/** Inline code spans and fenced code lines of a Markdown text. */
function codeTexts(markdown: string): string[] {
  const texts: string[] = [];
  const prose = markdown.replace(/^```[^\n]*\n([\s\S]*?)^```$/gm, (_block, code: string) => {
    texts.push(...code.split('\n').filter((line) => line.trim() !== ''));
    return '';
  });
  for (const match of prose.matchAll(/`([^`\n]+)`/g)) texts.push(match[1]!);
  return texts;
}

const OPTIONS: Readonly<Record<string, { type: string; short?: string }>> = CLI_OPTIONS;
const SHORT = new Map(Object.entries(OPTIONS).flatMap(([name, option]) => (option.short ? [[`-${option.short}`, name]] : [])));

/** Problems with one ng-upgrade-planner command line: unknown flags, subcommands or positional arguments. */
function commandProblems(args: string[]): string[] {
  const problems: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    const flag = /^--([a-z][a-z-]*)(=.*)?$/.exec(arg);
    const name = flag ? flag[1]! : SHORT.get(arg);
    if (name === undefined || OPTIONS[name] === undefined) {
      problems.push(`"${arg}" is not an option of ${CLI_NAME}`);
      continue;
    }
    if (OPTIONS[name].type === 'string' && !flag?.[2]) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('-')) problems.push(`--${name} needs a value`);
      index++;
    }
  }
  return problems;
}

/**
 * ng-upgrade-planner command lines (arguments after the command name) and code that starts with a
 * flag, such as `--to <major>`, which names a planner option.
 */
function references(markdown: string): { commands: string[][]; flags: string[][] } {
  const commands: string[][] = [];
  const flags: string[][] = [];
  for (const text of codeTexts(markdown)) {
    const words = text.trim().split(/\s+/);
    const start = words[0] === 'npx' ? 1 : 0;
    if (words[start] === CLI_NAME) {
      commands.push(words.slice(start + 1));
    } else if (words[0]!.startsWith('-')) {
      flags.push(words);
    }
  }
  return { commands, flags };
}

/** Key paths of a JSON value: "a.b" for object keys, "a[]" for array elements. */
function children(value: unknown, at: string, out: Map<string, Set<string>[]>): void {
  if (Array.isArray(value)) {
    for (const item of value) children(item, `${at}[]`, out);
  } else if (value !== null && typeof value === 'object') {
    const list = out.get(at) ?? [];
    list.push(new Set(Object.keys(value)));
    out.set(at, list);
    for (const [key, child] of Object.entries(value)) children(child, at === '' ? key : `${at}.${key}`, out);
  }
}

/** Documented paths of the schema reference, grouped by their parent path. */
function documented(): Map<string, Set<string>> {
  const parents = new Map<string, Set<string>>();
  for (const match of read(SCHEMA_DOC).matchAll(/^\| `([^`]+)` \|/gm)) {
    const full = match[1]!;
    const dot = full.lastIndexOf('.');
    const parent = dot === -1 ? '' : full.slice(0, dot);
    const key = full.slice(dot + 1);
    if (!parents.has(parent)) parents.set(parent, new Set());
    expect(parents.get(parent)!.has(key), `${full} is documented twice`).toBe(false);
    parents.get(parent)!.add(key);
  }
  return parents;
}

function producedDocuments(): { label: string; document: unknown }[] {
  const sample = JSON.parse(read(path.join(root, 'test', 'report', 'sample-plan.json'))) as UpgradePlan;
  const scanOff: UpgradePlan = {
    ...sample,
    scan: { ...sample.scan, status: 'off', coverage: null, filesScanned: 0, findings: 0, attached: 0, unscanned: [] },
  };
  const nothingToPlan: UpgradePlan = { ...sample, hops: [], message: 'Already on Angular 17.' };
  const fixtures = path.join(root, 'test', '__snapshots__', 'fixtures');
  return [
    { label: 'sample plan', document: planJson(sample, { toolVersion: '0.1.0' }) },
    { label: 'sample plan, scan off', document: planJson(scanOff, { toolVersion: '0.1.0' }) },
    { label: 'nothing to plan', document: planJson(nothingToPlan, { toolVersion: '0.1.0' }) },
    ...readdirSync(fixtures)
      .filter((file) => file.endsWith('.ng-upgrade-plan.json'))
      .map((file) => ({ label: file, document: JSON.parse(read(path.join(fixtures, file))) as unknown })),
  ];
}

describe('Agent Skill', () => {
  it('is the only skill in skills/ and has a SKILL.md', () => {
    expect(SKILLS).toEqual([SKILL]);
    expect(markdownFiles(skillDir)).toContain('SKILL.md');
  });

  it('has front-matter that follows the Agent Skills specification', () => {
    const { front, body } = splitSkill(read(path.join(skillDir, 'SKILL.md')));
    expect(frontMatterProblems(front, SKILL)).toEqual([]);
    const description = (front as { description: string }).description;
    // The description says what the skill does and when to use it.
    expect(description).toMatch(/one major version/i);
    expect(description).toMatch(/\bUse it when\b/);
    expect(body.split('\n').length).toBeLessThan(500);
  });

  it.each([
    ['a missing name', { description: 'x' }, 'name must be a string of 1 to 64 characters'],
    ['an empty name', { name: '', description: 'x' }, 'name must be a string of 1 to 64 characters'],
    ['a long name', { name: 'a'.repeat(65), description: 'x' }, 'name must be a string of 1 to 64 characters'],
    ['an uppercase name', { name: 'Angular-upgrade-hops', description: 'x' }, 'name may only hold lowercase letters, digits and hyphens', 'Angular-upgrade-hops'],
    ['a leading hyphen', { name: '-angular-upgrade-hops', description: 'x' }, 'name must not start or end with a hyphen', '-angular-upgrade-hops'],
    ['a trailing hyphen', { name: 'angular-upgrade-hops-', description: 'x' }, 'name must not start or end with a hyphen', 'angular-upgrade-hops-'],
    ['a double hyphen', { name: 'angular--upgrade-hops', description: 'x' }, 'name must not hold consecutive hyphens', 'angular--upgrade-hops'],
    ['another folder name', { name: 'angular-upgrade', description: 'x' }, 'name "angular-upgrade" must equal the folder name "angular-upgrade-hops"'],
    ['no description', { name: SKILL }, 'description must be a non-empty string of at most 1024 characters'],
    ['a blank description', { name: SKILL, description: '  ' }, 'description must be a non-empty string of at most 1024 characters'],
    ['a long description', { name: SKILL, description: 'x'.repeat(1025) }, 'description must be a non-empty string of at most 1024 characters'],
    ['a field outside the specification', { name: SKILL, description: 'x', version: '1' }, 'unknown field "version"'],
    ['a long compatibility', { name: SKILL, description: 'x', compatibility: 'x'.repeat(501) }, 'compatibility must be a string of 1 to 500 characters'],
    ['non-string metadata', { name: SKILL, description: 'x', metadata: { level: 2 } }, 'metadata must map strings to strings'],
  ] as [string, Record<string, unknown>, string, string?][])('front-matter check rejects %s', (_label, front, problem, folder) => {
    // The folder matches the name unless the case is about the folder.
    expect(frontMatterProblems(front, folder ?? SKILL)).toEqual([problem]);
  });

  it('accepts the limits of the specification', () => {
    expect(frontMatterProblems({ name: 'a'.repeat(64), description: 'x'.repeat(1024) }, 'a'.repeat(64))).toEqual([]);
    expect(frontMatterProblems({ name: 'a1-b2', description: 'x', metadata: { author: 'x' } }, 'a1-b2')).toEqual([]);
  });

  it('gives the agent every rule of the hop-by-hop workflow', () => {
    const text = read(path.join(skillDir, 'SKILL.md'));
    for (const rule of [
      /Never start on a dirty worktree/,
      /git status --porcelain/,
      /Work on a branch/,
      /exactly one hop at a time/,
      /commit once per hop/,
      /Run the official commands/,
      /Move the libraries/,
      /Fix the removed APIs/,
      /Build and test/,
      /Stop and report/,
      /Run the planner again/,
      /Never publish/,
      /Never push, unless the user asks you to/,
    ]) {
      expect(text).toMatch(rule);
    }
  });

  it('runs the planner with --json and links the schema reference', () => {
    const text = read(path.join(skillDir, 'SKILL.md'));
    const { commands } = references(text);
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every((args) => args.includes('--json'))).toBe(true);
    expect(text).toContain('](references/plan-json.md)');
  });

  it.each(markdownFiles(skillDir))('%s names only ng-upgrade-planner commands and flags that exist', (file) => {
    const { commands, flags } = references(read(path.join(skillDir, file)));
    for (const args of commands) expect(commandProblems(args), args.join(' ')).toEqual([]);
    for (const words of flags) expect(commandProblems(words), words.join(' ')).toEqual([]);
  });

  it('command check rejects unknown flags, subcommands and missing values', () => {
    expect(commandProblems(['--json', '--to', '18', '--no-report'])).toEqual([]);
    expect(commandProblems(['-h'])).toEqual([]);
    expect(commandProblems(['--jsno'])).toEqual([`"--jsno" is not an option of ${CLI_NAME}`]);
    expect(commandProblems(['run', '--json'])).toEqual([`"run" is not an option of ${CLI_NAME}`]);
    expect(commandProblems(['--to'])).toEqual(['--to needs a value']);
    expect(commandProblems(['--to=18'])).toEqual([]);
  });

  it('finds command lines and flags in code spans and fenced blocks, not in prose', () => {
    const markdown = [
      'Run `npx ng-upgrade-planner --jsno` or --prose-flag.',
      '```sh',
      'ng-upgrade-planner deploy --json',
      'git status --porcelain',
      '```',
      'Then `--bogus <x>` and `ng update @angular/core@15 --force`.',
    ].join('\n');
    const { commands, flags } = references(markdown);
    expect(commands).toEqual([['deploy', '--json'], ['--jsno']]);
    expect(flags).toEqual([['--bogus', '<x>']]);
    expect(commands.flatMap(commandProblems)).toEqual([
      `"deploy" is not an option of ${CLI_NAME}`,
      `"--jsno" is not an option of ${CLI_NAME}`,
    ]);
    expect(commandProblems(flags[0]!)).toEqual([`"--bogus" is not an option of ${CLI_NAME}`, `"<x>" is not an option of ${CLI_NAME}`]);
  });
});

describe('JSON schema reference', () => {
  it('documents every key the planner produces, and only those', () => {
    const doc = documented();
    const seen = new Map<string, Set<string>>();
    for (const { label, document } of producedDocuments()) {
      const objects = new Map<string, Set<string>[]>();
      children(document, '', objects);
      for (const [at, list] of objects) {
        for (const keys of list) {
          // Every object at a path has exactly the documented keys: none missing, none extra.
          expect([...keys].sort(), `${label}: keys of ${at === '' ? 'the document' : at}`).toEqual([...(doc.get(at) ?? [])].sort());
          seen.set(at, keys);
        }
      }
    }
    // Every documented object path occurs in at least one produced document.
    expect([...seen.keys()].sort()).toEqual([...doc.keys()].sort());
  });

  it('is read against at least the five fixture snapshots', () => {
    expect(producedDocuments().filter(({ label }) => label.endsWith('.json'))).toHaveLength(5);
  });
});
