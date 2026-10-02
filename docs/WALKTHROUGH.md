# Walkthrough

How ng-upgrade-planner works, the decisions behind it, what was rejected and what it costs.

## Architecture

A Node.js CLI in strict TypeScript, compiled to `dist/` and run with `npx`. Five runtime dependencies:
`semver`, `yaml`, `@yarnpkg/lockfile`, `@babel/parser` and `ignore`. Data flows one way through five layers:

1. **Project** (`src/project`). Reads the root `package.json` and one lockfile (npm, pnpm, yarn classic or
   berry). A version missing from the lockfile is guessed from the `package.json` range and marked unverified.
2. **Registry** (`src/registry`). Fetches trimmed npm package records into a local cache, four requests at a
   time, retrying with backoff and `Retry-After`. Offline mode and failed refreshes use older records and say so.
3. **Scan** (`src/scan`). Walks the project folder without following links, skipping dependency, build and
   cache folders, the output paths in `angular.json` and gitignored paths. TypeScript files that mention
   `@angular/` are parsed, and a symbol counts only when its local name was imported from the entry's package
   (named, aliased, namespace or re-export). Inline and external templates are matched as text; `angular.json`
   and `tsconfig*.json` are parsed as JSON with comments. A file that cannot be read or parsed is listed as
   unscanned, never fatal.
4. **Plan** (`src/plan`). Pure functions: one hop per major up to the target, the official steps, the framework
   requirements, a library matrix from peer ranges, scan findings attached to the hop of their major, and an
   effort estimate. Every value is a `Fact` with its evidence, or is explicitly unverified with a reason.
5. **Report** (`src/report`). One model feeds the terminal summary, Markdown, a single-file HTML page and the
   JSON document. Each renderer escapes for its own format.

## Decisions

**Compatibility comes only from `@angular/*` peer ranges**, tested with npm's `semver` against the hop's
newest stable releases. A library moves only when it must.

**Unknown is a first-class result.** What the data cannot decide is "unknown", never "compatible", and every
report lists confirmed and unverified results apart. A wrong "compatible" costs a user far more than
"check this by hand". A library is a blocker only when no stable release accepts the hop and no release
without peer data could.

**Bundled, cited data.** The steps are a copy of the data behind angular.dev/update-guide, with its commit,
date and MIT attribution, parsed without running it. The removed-API list (`src/data/removed-apis.ts`) holds 68
entries for Angular 9 to 22, taken from the Angular and Angular CLI CHANGELOGs and the update guide data. Each
entry cites its source URL and records the replacement and whether the official `ng update` migration fixes
it, backed by that release's migration list, or "unknown" when no source says. Angular 12 has no entry: its
breaking changes are behaviour and platform changes. Left out, with reasons in `REMOVED_API_EXCLUDED` (36
items): behaviour, timing and typing changes; members of injected instances, which need type information;
option values usually held in variables; changes outside `@angular/*` such as zone.js and builder options; and
names no official document confirms.

**Confirmed versus heuristic findings.** Import-matched symbols and parsed configuration properties are
confirmed. Template patterns are text matches without the Angular template parser, so they are heuristic and
listed under "could not be verified".

**Effort weights.** Per hop: 2 base points, 2 per basic step and 1 per medium or advanced step, 3 per major
library update, 2 per unmet requirement and 8 per blocker. Removed APIs add 1 point per distinct API the
migration fixes (it needs a review) and 3 per distinct API it does not or may not fix (hand work). They count
APIs, not uses, so a large codebase does not swamp the estimate.

**A versioned JSON contract.** `--json` and `ng-upgrade-plan.json` emit a document separate from the internal
model, with `schemaVersion` 1: every key always present, null rather than missing, and the confirmed and
unverified split per hop. Renaming or removing a field needs a new version. The schema reference ships inside
the skill, so agents and the package share one source.

**The skill drives, the CLI plans.** `skills/angular-upgrade-hops` is Markdown in the open SKILL.md format. It
reads only the JSON, executes the first hop, builds, tests, commits once and plans again before the next hop,
stopping on blockers, failures and unverified items. It never publishes and pushes only when asked. Tests
check its front-matter against the spec and every flag it names.

**All outside text is untrusted.** Maps are rebuilt on null-prototype objects, cache file names are encoded
safely, terminal output strips control characters, the HTML has no scripts and a strict Content Security
Policy, and the scan never leaves the project folder. No credentials are read or sent.

**Tests never touch the network.** Five real open-source apps (only `package.json` and lockfile, with source
and licence noted) are planned against recorded registry data and compared with snapshots. Scan tests use
synthetic sources written for this repository. The development agent recomputed two plans with an independent
script (`docs/verification`). `check:pack`, `check:docs` and `prepublishOnly` guard releases.

## Scan dependencies

- **`@babel/parser`** (MIT, about 2 MB). A real syntax tree tells imports, aliases, comments and strings apart
  exactly and handles decorators. The TypeScript compiler would add type information but is about ten times
  larger on every `npx` run. A hand-written lexer would be smaller but fragile with template literals, regular
  expressions and nested syntax.
- **`ignore`** (MIT, about 120 kB, no dependencies). Implements gitignore rules without git. Calling
  `git check-ignore` would need git installed, a repository and a subprocess per walk.

With 361 source files, a warm-cache plan takes about 1 s per fixture.

## Rejected alternatives

- **Running `ng update` in a scratch copy per hop**: a full install per hop, minutes each, third-party code
  executed.
- **Scraping angular.dev at run time**: rendered by JavaScript and changes without notice.
- **A hand-maintained compatibility database**: goes stale and cannot be traced to evidence.
- **Plain text search for removed APIs**: matches comments, strings and same-named symbols from other packages.
- **Reading `.npmrc`**: means handling credentials; private packages are reported as unverified instead.

## Trade-offs

- **Peer ranges can be wrong.** Open ranges such as `>=6` accept every future Angular; the evidence column
  shows the exact range.
- **Only `@angular/*` peers are cross-checked**, so a conflict on `rxjs` or `@ngrx/*` can be missed.
- **The scan has no scope or type analysis.** A shadowing local is still matched, and APIs reached through
  variables or instance methods are missed. It finds only what the data lists: a clean scan is not a clean
  upgrade.
- **Effort is a heuristic**, deterministic and explained per hop but not calibrated against real upgrades.
- **Bundled data ages.** A new Angular major needs refreshed step and removed-API data and a new release.
