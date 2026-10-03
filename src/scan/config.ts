// Structural matching of angular.json and tsconfig properties.
import type { RemovedBuilderEntry, RemovedBuilderOptionEntry } from '../data/types.js';
import { parseJsonc, propertiesAt, type JsoncProperty, type JsoncValue } from './jsonc.js';
import type { Matchers, RawMatch } from './matchers.js';

/** Where angular.json keeps targets; "targets" is an accepted alias of "architect". */
const TARGET_PATHS: readonly (readonly string[])[] = [
  ['projects', '*', 'architect', '*'],
  ['projects', '*', 'targets', '*'],
];

/**
 * Third-party builders that extend an Angular builder and accept its options. A removed option found under one of
 * them is reported as heuristic: the wrapper may handle the option itself.
 */
const WRAPPER_BUILDERS: ReadonlyMap<string, string> = new Map(
  ['browser', 'server', 'dev-server', 'karma', 'extract-i18n'].flatMap((name) => [
    [`@angular-builders/custom-webpack:${name}`, `@angular-devkit/build-angular:${name}`],
    [`ngx-build-plus:${name}`, `@angular-devkit/build-angular:${name}`],
  ]),
);

function wrapperReason(wrapper: string, wrapped: string): string {
  return `The target uses ${wrapper}, which extends ${wrapped} and takes its options; check that the option still reaches the Angular builder.`;
}

/** The target's "builder" key. With duplicate keys the last one counts, as with JSON.parse. */
function builderOf(target: JsoncValue): JsoncProperty | undefined {
  const builders = propertiesAt(target, ['builder']);
  return builders[builders.length - 1];
}

/** The option objects of a target: "options" and every entry of "configurations". */
function optionObjects(target: JsoncValue): JsoncValue[] {
  return [...propertiesAt(target, ['options']), ...propertiesAt(target, ['configurations', '*'])].map(
    (property) => property.value,
  );
}

function matchTargets(
  document: JsoncValue,
  options: readonly RemovedBuilderOptionEntry[],
  builders: readonly RemovedBuilderEntry[],
): RawMatch[] {
  const matches: RawMatch[] = [];
  for (const path of TARGET_PATHS) {
    for (const target of propertiesAt(document, path)) {
      const builder = builderOf(target.value);
      if (builder?.value.kind !== 'string') continue;
      const name = builder.value.value;
      for (const entry of builders) {
        if (entry.builders.includes(name)) matches.push({ entry, offset: builder.offset });
      }
      const wrapped = WRAPPER_BUILDERS.get(name);
      const optionName = wrapped ?? name;
      const applicable = options.filter((entry) => entry.builders.includes(optionName));
      if (applicable.length === 0) continue;
      const heuristic = wrapped === undefined ? undefined : wrapperReason(name, wrapped);
      for (const object of optionObjects(target.value)) {
        for (const entry of applicable) {
          for (const property of propertiesAt(object, [entry.option])) {
            matches.push(heuristic === undefined ? { entry, offset: property.offset } : { entry, offset: property.offset, heuristic });
          }
        }
      }
    }
  }
  return matches;
}

/** Throws when the file is not valid JSON with comments. */
export function matchConfig(text: string, file: 'angular.json' | 'tsconfig', matchers: Matchers): RawMatch[] {
  const entries = matchers.configs.filter((entry) => entry.file === file);
  if (entries.length === 0) return [];
  const document = parseJsonc(text);
  const matches: RawMatch[] = [];
  const builderOptions: RemovedBuilderOptionEntry[] = [];
  const builders: RemovedBuilderEntry[] = [];
  for (const entry of entries) {
    if (entry.builders === undefined) {
      for (const path of entry.paths) {
        for (const property of propertiesAt(document, path)) matches.push({ entry, offset: property.offset });
      }
    } else if (entry.option === undefined) {
      builders.push(entry);
    } else {
      builderOptions.push(entry);
    }
  }
  if (builderOptions.length > 0 || builders.length > 0) matches.push(...matchTargets(document, builderOptions, builders));
  return matches;
}
