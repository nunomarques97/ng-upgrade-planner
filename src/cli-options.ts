// Command line option definitions, kept apart from src/cli.ts so they can be imported (for example
// by the tests that check the Agent Skill) without running the CLI.
import type { ParseArgsConfig } from 'node:util';

export const CLI_NAME = 'ng-upgrade-planner';

/** Options as given to node:util parseArgs. The CLI takes no positional arguments and no subcommands. */
export const CLI_OPTIONS = {
  cwd: { type: 'string' },
  to: { type: 'string' },
  offline: { type: 'boolean' },
  registry: { type: 'string' },
  'cache-dir': { type: 'string' },
  'out-dir': { type: 'string' },
  'no-report': { type: 'boolean' },
  'no-scan': { type: 'boolean' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const satisfies NonNullable<ParseArgsConfig['options']>;

export type CliOptionName = keyof typeof CLI_OPTIONS;
