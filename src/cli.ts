#!/usr/bin/env node
// Command line entry point. Exit codes: 0 when a plan was printed (blockers included), 1 for a
// project, planning or file problem, 2 for a usage error.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { isPlanError, buildPlan } from './plan/index.js';
import { describeCause, isProjectError } from './project/errors.js';
import { readProject } from './project/index.js';
import { DEFAULT_REGISTRY, RegistryClient, RegistryConfigError, defaultCacheDir } from './registry/index.js';
import { cleanText, renderTerminal, shouldUseColor, writeReports } from './report/index.js';

const NAME = 'ng-upgrade-planner';

function usage(): string {
  return `Usage: ${NAME} [options]

Plans an Angular upgrade hop by hop for the project in the current folder: official update steps,
the newest compatible version of each Angular-dependent library, blockers and an effort estimate.

Options:
  --cwd <dir>        Project folder (default: the current folder)
  --to <major>       Target Angular major version, for example 18 (default: the latest release)
  --offline          Use only the local registry cache; never contact the registry
  --registry <url>   npm registry URL (default: ${DEFAULT_REGISTRY})
  --cache-dir <dir>  Registry cache folder (default: ${defaultCacheDir()})
  --out-dir <dir>    Folder for ng-upgrade-plan.md and ng-upgrade-plan.html (default: the project folder)
  --no-report        Print the summary only; write no report files
  -h, --help         Show this help
  -v, --version      Show the version

Exit codes: 0 plan printed (also when it has blockers), 1 project or planning error, 2 usage error.
`;
}

function ownVersion(): string {
  try {
    const pkg: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const version = (pkg as { version?: unknown }).version;
    return typeof version === 'string' ? version : 'unknown';
  } catch {
    return 'unknown';
  }
}

class UsageError extends Error {}
class FileError extends Error {}

interface Options {
  help: boolean;
  version: boolean;
  cwd: string;
  to: number | undefined;
  offline: boolean;
  registry: string | undefined;
  cacheDir: string | undefined;
  outDir: string | undefined;
  report: boolean;
}

function quoted(text: string): string {
  return `"${cleanText(text).slice(0, 80)}"`;
}

function parseError(error: unknown): UsageError {
  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : String(error);
  const subject = /'([^']*)'/.exec(message)?.[1] ?? '';
  switch (code) {
    case 'ERR_PARSE_ARGS_UNKNOWN_OPTION':
      return new UsageError(`Unknown option ${quoted(subject)}.`);
    case 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL':
      return new UsageError(`Unexpected argument ${quoted(subject)}; this command takes options only.`);
    case 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE': {
      const option = /--?[\w-]+/.exec(message)?.[0];
      return new UsageError(option ? `Option ${option} needs a value.` : 'An option is missing its value.');
    }
    default:
      return new UsageError(cleanText(message));
  }
}

function nonEmpty(value: string | undefined, option: string): string | undefined {
  if (value === undefined) return undefined;
  if (value.trim() === '') throw new UsageError(`Option ${option} needs a value.`);
  return value;
}

function parseOptions(argv: string[]): Options {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        cwd: { type: 'string' },
        to: { type: 'string' },
        offline: { type: 'boolean' },
        registry: { type: 'string' },
        'cache-dir': { type: 'string' },
        'out-dir': { type: 'string' },
        'no-report': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    throw parseError(error);
  }
  const values = parsed.values;
  let to: number | undefined;
  const toText = nonEmpty(values.to, '--to');
  if (toText !== undefined) {
    const major = /^\d{1,3}$/.test(toText.trim()) ? Number(toText.trim()) : NaN;
    if (!(major >= 2)) {
      throw new UsageError(`Option --to must be an Angular major version such as 18 (got ${quoted(toText)}).`);
    }
    to = major;
  }
  return {
    help: values.help === true,
    version: values.version === true,
    cwd: path.resolve(nonEmpty(values.cwd, '--cwd') ?? '.'),
    to,
    offline: values.offline === true,
    registry: nonEmpty(values.registry, '--registry'),
    cacheDir: nonEmpty(values['cache-dir'], '--cache-dir'),
    outDir: nonEmpty(values['out-dir'], '--out-dir'),
    report: values['no-report'] !== true,
  };
}

async function run(argv: string[]): Promise<number> {
  let options: Options;
  let client: RegistryClient;
  try {
    options = parseOptions(argv);
    if (options.help) {
      process.stdout.write(usage());
      return 0;
    }
    if (options.version) {
      process.stdout.write(`${ownVersion()}\n`);
      return 0;
    }
    client = new RegistryClient({
      ...(options.registry !== undefined ? { registry: options.registry } : {}),
      ...(options.cacheDir !== undefined ? { cacheDir: path.resolve(options.cacheDir) } : {}),
      offline: options.offline,
    });
  } catch (error) {
    if (error instanceof UsageError || error instanceof RegistryConfigError) {
      process.stderr.write(`${NAME}: ${cleanText(error.message)}\nRun "${NAME} --help" for usage.\n`);
      return 2;
    }
    throw error;
  }

  const project = await readProject(options.cwd);
  const plan = await buildPlan(project, client, {
    ...(options.to !== undefined ? { targetMajor: options.to } : {}),
    nodeVersion: process.version,
  });

  let reports: string[] | null = null;
  if (options.report) {
    const outDir = path.resolve(options.outDir ?? options.cwd);
    try {
      reports = await writeReports(plan, outDir, { toolVersion: ownVersion() });
    } catch (error) {
      throw new FileError(`Could not write the reports to ${outDir}: ${describeCause(error)}`);
    }
  }

  process.stdout.write(renderTerminal(plan, { color: shouldUseColor(process.stdout, process.env), reports }));
  return 0;
}

run(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const expected = isProjectError(error) || isPlanError(error) || error instanceof FileError;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${NAME}: ${expected ? '' : 'unexpected error: '}${cleanText(message)}\n`);
    process.exitCode = 1;
  },
);
