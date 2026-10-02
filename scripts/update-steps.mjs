#!/usr/bin/env node
// Refreshes src/data/update-steps.ts, the vendored snapshot of the official Angular update guide
// data (angular/angular, adev/src/app/features/update, MIT licence).
//
// Usage: node scripts/update-steps.mjs [--commit <sha>]
//
// Uses the network (GitHub). Run it by hand; tests never run it. The upstream file is TypeScript:
// it is parsed with the TypeScript compiler API and only literal values are read, so nothing
// downloaded is ever executed.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REPOSITORY = 'angular/angular';
const DIR = 'adev/src/app/features/update';
const DATA_PATH = `${DIR}/recommendations.ts`;
const COMPONENT_PATH = `${DIR}/update.component.ts`;
const OUTPUT = fileURLToPath(new URL('../src/data/update-steps.ts', import.meta.url));
const FLAGS = ['material', 'ngUpgrade', 'windows'];
// Declared upstream but unused; accepted and dropped if they ever appear.
const IGNORED = ['angularCLI', 'pwa', 'renderedStep'];

function fail(message) {
  console.error(`update-steps: ${message}`);
  process.exit(1);
}

async function get(url, accept) {
  const response = await globalThis.fetch(url, {
    headers: { 'user-agent': 'ng-upgrade-planner update-steps script', accept },
    signal: globalThis.AbortSignal.timeout(30_000),
  });
  if (!response.ok) fail(`${url} answered HTTP ${response.status}`);
  return response.text();
}

async function latestCommit() {
  const url = `https://api.github.com/repos/${REPOSITORY}/commits?path=${encodeURIComponent(DATA_PATH)}&sha=main&per_page=1`;
  const list = JSON.parse(await get(url, 'application/vnd.github+json'));
  const sha = list?.[0]?.sha;
  if (typeof sha !== 'string') fail('could not read the latest commit of the update guide data');
  return sha;
}

async function commitDate(sha) {
  const url = `https://api.github.com/repos/${REPOSITORY}/commits/${sha}`;
  const commit = JSON.parse(await get(url, 'application/vnd.github+json'));
  const date = commit?.commit?.committer?.date;
  if (typeof date !== 'string') fail(`could not read the date of commit ${sha}`);
  return date.slice(0, 10);
}

function raw(sha, file) {
  return get(`https://raw.githubusercontent.com/${REPOSITORY}/${sha}/${file}`, 'text/plain');
}

function enumValues(source) {
  const values = new Map();
  for (const statement of source.statements) {
    if (!ts.isEnumDeclaration(statement) || statement.name.text !== 'ApplicationComplexity') continue;
    for (const member of statement.members) {
      if (member.initializer && ts.isNumericLiteral(member.initializer)) {
        values.set(member.name.getText(source), Number(member.initializer.text));
      }
    }
  }
  if (values.size === 0) fail('ApplicationComplexity enum not found');
  return values;
}

function literal(node, source, levels) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isParenthesizedExpression(node)) return literal(node.expression, source, levels);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = literal(node.left, source, levels);
    const right = literal(node.right, source, levels);
    if (typeof left === 'string' && typeof right === 'string') return left + right;
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'ApplicationComplexity' &&
    levels.has(node.name.text)
  ) {
    return levels.get(node.name.text);
  }
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  fail(`unsupported value on line ${line + 1}: ${node.getText(source).slice(0, 80)}`);
}

function readSteps(text) {
  const source = ts.createSourceFile('recommendations.ts', text, ts.ScriptTarget.Latest, true);
  const levels = enumValues(source);
  let array;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) === 'RECOMMENDATIONS' && declaration.initializer) {
        array = declaration.initializer;
      }
    }
  }
  if (!array || !ts.isArrayLiteralExpression(array)) fail('RECOMMENDATIONS array not found');

  return array.elements.map((element, index) => {
    if (!ts.isObjectLiteralExpression(element)) fail(`entry ${index} is not an object literal`);
    const entry = {};
    for (const property of element.properties) {
      if (!ts.isPropertyAssignment(property)) fail(`entry ${index} has an unsupported property`);
      entry[property.name.getText(source)] = literal(property.initializer, source, levels);
    }
    return validate(entry, index);
  });
}

function validate(entry, index) {
  const where = `entry ${index} (${JSON.stringify(entry.step)})`;
  for (const key of Object.keys(entry)) {
    const known = ['step', 'action', 'possibleIn', 'necessaryAsOf', 'level', ...FLAGS, ...IGNORED];
    if (!known.includes(key)) fail(`${where} has an unknown field ${key}`);
  }
  if (typeof entry.step !== 'string' || entry.step.trim() === '') fail(`${where}: step must be text`);
  if (typeof entry.action !== 'string' || entry.action.trim() === '') fail(`${where}: action must be text`);
  for (const key of ['possibleIn', 'necessaryAsOf']) {
    if (!Number.isInteger(entry[key]) || entry[key] < 200 || entry[key] > 9999) fail(`${where}: invalid ${key}`);
  }
  if (![1, 2, 3].includes(entry.level)) fail(`${where}: invalid level`);
  const step = {
    step: entry.step,
    action: entry.action,
    possibleIn: entry.possibleIn,
    necessaryAsOf: entry.necessaryAsOf,
    level: entry.level,
  };
  for (const flag of FLAGS) {
    if (entry[flag] === undefined) continue;
    if (typeof entry[flag] !== 'boolean') fail(`${where}: ${flag} must be true or false`);
    step[flag] = entry[flag];
  }
  return step;
}

/** Newest major in the guide's version picker, falling back to the newest step. */
function coveredMajor(componentText, steps) {
  const majors = [...componentText.matchAll(/\{\s*name:\s*'(\d+)\.\d+',\s*number:\s*\d+\s*\}/g)].map((m) => Number(m[1]));
  const fromSteps = steps.map((step) => Math.floor(step.necessaryAsOf / 100));
  return Math.max(...(majors.length > 0 ? majors : fromSteps));
}

/** JSON with every non-ASCII character escaped, so the file stays plain ASCII. */
function asciiJson(value) {
  return JSON.stringify(value, null, 2).replace(
    /[\u007f-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

const args = process.argv.slice(2);
let commit;
if (args.length === 2 && args[0] === '--commit' && /^[0-9a-f]{7,40}$/.test(args[1])) {
  commit = args[1];
} else if (args.length > 0) {
  fail('usage: node scripts/update-steps.mjs [--commit <sha>]');
}

commit ??= await latestCommit();
const [dataText, componentText, date] = await Promise.all([raw(commit, DATA_PATH), raw(commit, COMPONENT_PATH), commitDate(commit)]);
const steps = readSteps(dataText);
if (steps.length === 0) fail('the update guide data has no steps');

const source = {
  url: `https://github.com/${REPOSITORY}/blob/${commit}/${DATA_PATH}`,
  repository: `https://github.com/${REPOSITORY}`,
  path: DATA_PATH,
  commit,
  commitDate: date,
  retrieved: new Date().toISOString().slice(0, 10),
  license: 'MIT',
  licenseUrl: 'https://angular.dev/license',
  copyright: 'Copyright Google LLC',
  coversThroughMajor: coveredMajor(componentText, steps),
};

const output = `// Generated by scripts/update-steps.mjs; do not edit by hand.
// Snapshot of the official Angular update guide data (https://angular.dev/update-guide).
// Source: ${source.url}
// Commit ${commit} (${date}), retrieved ${source.retrieved}.
// Licence: MIT, ${source.copyright} (${source.licenseUrl}).
// Text is kept exactly as published; non-ASCII characters are written as escapes.
import type { UpdateGuideData } from './types.js';

export const UPDATE_GUIDE: UpdateGuideData = ${asciiJson({ source, steps })};
`;
writeFileSync(OUTPUT, output);
console.log(`Wrote ${steps.length} steps (Angular up to ${source.coversThroughMajor}, commit ${commit.slice(0, 12)}) to ${OUTPUT}`);
