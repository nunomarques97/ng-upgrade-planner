# ng-upgrade-planner

Plan an Angular upgrade hop by hop. Run it inside an Angular project and it prints the whole path from the
installed major version to the target (for example 14 to 22). For each hop it lists:

- the official update steps from the Angular update guide;
- the newest compatible version of every library in the project that declares `@angular/*` peer dependencies;
- blockers: libraries with no release that accepts the hop's Angular version;
- the Node.js and TypeScript ranges of the hop, with a blocker when the project's `engines.node` or its locked
  TypeScript falls outside them (your local Node.js version is shown for context only);
- the RxJS and zone.js requirements and whether the installed versions meet them;
- the places in your own source that use Angular, Angular Material or CDK APIs removed or changed in that hop,
  with the replacement;
- warnings for APIs you use that are deprecated with an announced removal, one hop before the removal;
- the RxJS 6 to 7 breaking changes found in your source, when you are still on RxJS 6;
- an effort estimate.

It can also print the plan as JSON, and it ships an Agent Skill that lets a coding agent carry out the plan one
hop at a time.

`ng update` moves one major version at a time and only checks peer dependencies for that step. This tool looks
at every hop up front, so you can see which libraries will hold you back before you start.

## Quick start

You need Node.js 20 or newer. Nothing is installed globally.

```sh
cd my-angular-app
npx ng-upgrade-planner
```

To run the latest development version instead, use a clone of this repository:

```sh
npm ci
npm run build
node dist/cli.js --cwd path/to/my-angular-app
```

The tool reads `package.json` and the lockfile (`package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml` or
`yarn.lock`, both yarn classic and yarn berry), and scans the project source for removed and deprecated APIs. It
prints a summary in the terminal and writes three reports to the project folder:

- `ng-upgrade-plan.md`: the full plan in Markdown;
- `ng-upgrade-plan.html`: the same plan as a single HTML file with no external resources;
- `ng-upgrade-plan.json`: the same plan as JSON for scripts and agents (see [JSON output](#json-output)).

### Options

| Option | Meaning |
| --- | --- |
| `--cwd <dir>` | Project folder (default: the current folder) |
| `--to <major>` | Target Angular major version, for example `18` (default: the latest release) |
| `--offline` | Use only the local registry cache; never contact the registry |
| `--registry <url>` | npm registry URL (default: `https://registry.npmjs.org`) |
| `--cache-dir <dir>` | Registry cache folder (default: a folder in your user cache directory) |
| `--out-dir <dir>` | Folder for the three reports (default: the project folder) |
| `--no-report` | Write no report files |
| `--no-scan` | Do not scan the project source for removed or changed Angular APIs |
| `--json` | Print the plan as JSON instead of the terminal summary |
| `-h`, `--help` | Show the help |
| `-v`, `--version` | Show the version |

Exit codes: `0` when a plan was printed (also when it has blockers), `1` for a project or planning error, `2` for
a usage error.

### Registry access and the cache

The tool downloads package metadata from the public npm registry, at most four requests at a time, and retries
politely on rate limits and server errors (it honours `Retry-After`). Records are cached for 24 hours in your user
cache directory: `%LOCALAPPDATA%\ng-upgrade-planner\Cache\registry` on Windows,
`~/Library/Caches/ng-upgrade-planner/registry` on macOS and `$XDG_CACHE_HOME/ng-upgrade-planner/registry` (or
`~/.cache/...`) elsewhere. With `--offline` it works from the cache alone, whatever the age of the records. If
the registry cannot be reached, an older cached record is used and the report says so.

It sends no credentials and never reads `.npmrc`, so private packages show up as "could not be verified".

## Example

This is the start of the plan for an open-source app on Angular 11
([jira-clone-angular](https://github.com/trungvose/jira-clone-angular), one of the test fixtures), targeting
Angular 22. Terminal summary:

```text
Angular upgrade plan for jira-clone-angular-frontend
Current: Angular 11.0.5
Target:  Angular 22 (22.2.1)
Source scan: no source files found
Node.js: engines.node none; local 20.19.0 (context only)
Warning: package.json has no engines.node, so the Node.js versions the project runs on are not known and the Node.js requirement of each hop cannot be checked.
Total effort: XL (552 points) over 11 hops, 21 blockers

Hop 1: Angular 11 to 12 (12.2.17), effort M (36 points)
  Steps: 17 (4 basic, 4 medium, 9 advanced)
  Library updates: 4
    @sentry/angular 5.29.2 to 7.120.4, major
    codelyzer 6.0.1 to 6.0.2, patch
    ng-zorro-antd 11.0.0 to 12.1.1, major
    ngx-quill 13.0.1 to 15.0.0, major
  Blockers: 1
    TypeScript: typescript 4.0.3 from the lockfile is outside ">=4.2.3 <4.4": after ng update, install a TypeScript inside that range if ng update did not move it there
  Could not decide: @angular-builders/custom-webpack, @ngneat/content-loader
  Toolchain:
    Node.js ^12.14.1 || >=14.0.0, no engines.node: unverified; package.json has no engines.node, so the Node.js range "^12.14.1 || >=14.0.0" of Angular 12 was not checked
    TypeScript >=4.2.3 <4.4, typescript 4.0.3: blocker
  Framework requirements:
    zone.js must satisfy "~0.11.4" (@angular/core@12.2.17 peerDependencies); 0.10.3 is installed
  Removed APIs: Not checked: no source files were found.

Hop 2: Angular 12 to 13 (13.4.0), effort M (39 points)
  Steps: 13 (3 basic, 5 medium, 5 advanced)
  Library updates: 3
    @angular/cdk 11.0.3 to 13.3.9, major
    @ngneat/content-loader 6.0.0 to 7.0.0, major
    ng-zorro-antd 12.1.1 to 13.4.0, major
  Blockers: 2
    codelyzer: No release accepts Angular 13; the newest, 6.0.2, requires @angular/compiler ">=2.3.1 <13.0.0 || ^12.0.0-next || ^12.1.0-next || ^12.2.0-next", @angular/core ">=2.3.1 <13.0.0 || ^12.0.0-next || ^12.1.0-next || ^12.2.0-next".
    TypeScript: typescript 4.0.3 from the lockfile is outside ">=4.4.2 <4.7": after ng update, install a TypeScript inside that range if ng update did not move it there
  Could not decide: @angular-builders/custom-webpack
  ...
```

An excerpt of the Markdown report for the same plan (`...` marks skipped parts):

<!-- example:start -->
````md
| Item | Value |
| --- | --- |
| Current Angular | 11.0.5 |
| Target Angular | 22 (22.2.1) |
| Hops | 11 |
| Total effort | XL (552 points) |
| Lockfile | `package-lock.json` (npm) |
| Source scan | no source files found |
| engines.node | none |
| Local Node.js | 20.19.0 (context only) |

## Summary

| Hop | Steps | Library updates | Blockers | Unknown | Requirement warnings | Removed APIs | Deprecation warnings | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Angular 11 to 12 | 17 | 4 | 1 | 2 | 1 | 0 | 0 | M (36 points) |
| 2. Angular 12 to 13 | 13 | 3 | 2 | 1 | 1 | 0 | 0 | M (39 points) |
| 3. Angular 13 to 14 | 17 | 3 | 2 | 0 | 1 | 0 | 0 | L (43 points) |
...

## Hop 1: Angular 11 to 12

Target release: 12.2.17. Effort: **M (36 points)**.
...

### Libraries

| Library | Current | Newest compatible | Peer range evidence | Status |
| --- | --- | --- | --- | --- |
| `@angular-builders/custom-webpack` | 10.0.1 | none (unverified) | 14.0.0: `@angular/compiler-cli` `^14.0.0`: rejects 12.2.17 | unknown |
| `@angular/cdk` | 11.0.3 | 12.2.13 | 11.0.3: `@angular/common` `^11.0.0 \|\| ^12.0.0-0`: accepts 12.2.17<br>`@angular/core` `^11.0.0 \|\| ^12.0.0-0`: accepts 12.2.17 | no change needed |
| `ng-zorro-antd` | 11.0.0 | 12.1.1 | 12.1.1: `@angular/animations` `^12.1.0`: accepts 12.2.17<br>`@angular/common` `^12.1.0`: accepts 12.2.17<br>`@angular/core` `^12.1.0`: accepts 12.2.17<br>`@angular/forms` `^12.1.0`: accepts 12.2.17<br>`@angular/platform-browser` `^12.1.0`: accepts 12.2.17<br>`@angular/router` `^12.1.0`: accepts 12.2.17 | update (major) |
...

### Could not be decided

- `@angular-builders/custom-webpack`: No release with @angular peers accepts Angular 12, but 46 releases older than 14.0.0 declare no @angular peer dependency and may support it; 14.0.0 requires @angular/compiler-cli "^14.0.0".
...

### Toolchain

| Tool | Required range | Project | Status | Why |
| --- | --- | --- | --- | --- |
| TypeScript | `>=4.2.3 <4.4`<br>from @angular/compiler-cli@12.2.17 peerDependencies | 4.0.3<br>typescript from the lockfile | **blocker** | typescript 4.0.3 from the lockfile is outside "\>=4.2.3 \<4.4": after ng update, install a TypeScript inside that range if ng update did not move it there |
...

### Framework requirements

| Requirement | Required range | Installed | Status | Source |
| --- | --- | --- | --- | --- |
| rxjs | `^6.5.3 \|\| ^7.0.0` | 6.6.3 | met | @angular/core@12.2.17 peerDependencies |
| zone.js | `~0.11.4` | 0.10.3 | not met (action needed) | @angular/core@12.2.17 peerDependencies |
...

## Confirmed and unverified results

### Confirmed by evidence

- Installed Angular 11.0.5, read from the lockfile.
...

### Could not be verified

These results could not be confirmed: unknown libraries, data from an outdated cache, versions guessed from package.json ranges, anything the registry data could not decide, removed-API and deprecation findings from text matching and source the scan could not check. Check them by hand before relying on them.
````
<!-- example:end -->

## Reading the results

Every library result is one of:

- **no change needed**: the installed version already accepts the hop's Angular release;
- **update (patch, minor or major)**: the newest release whose `@angular/*` peer ranges accept the hop;
- **blocker**: no stable release accepts the hop according to its published `@angular/*` peer ranges, and no
  release without such ranges could be the missing one;
- **unknown**: the registry data cannot decide, for example because some releases declare no `@angular/*` peers.
  Unknown is never shown as compatible.

Packages the registry does not have (such as private packages) or that could not be fetched are not guessed
either: they are listed under "could not be verified".

Each report ends with two lists:

- **Confirmed by evidence**: what was read from your lockfile, the registry data and the update guide, with the
  number of library results decided from published peer ranges in each hop.
- **Could not be verified**: unknown libraries, data from an outdated cache, versions guessed from
  `package.json` ranges because the lockfile did not have them, packages without registry data, newer
  releases that could not be checked, heuristic removed-API findings, files the scan could not read and hops
  outside the removed-API data.
  Check these by hand before relying on them.

The peer range evidence column shows the exact range each decision was based on, so any line can be checked
against `npm view <package>@<version> peerDependencies`.

## Removed-API scan

The tool checks your own source for Angular APIs that are removed, or changed in a breaking way, in a later
major. It reads:

- TypeScript files (`.ts`, not `.d.ts`), including inline component templates;
- external component templates: `.html` files that a component points at with `templateUrl`, or whose name
  ends in `.component.html`;
- `angular.json` and `tsconfig*.json` files.

It skips `node_modules`, `dist`, `out-tsc`, `.angular`, `coverage`, `.git`, the output folders declared in
`angular.json` and everything your `.gitignore` files exclude. Symbolic links are not followed, and files over
1 MB are not read.

The findings come from bundled data. Every entry cites the official document that states the change and records
the replacement and whether the official `ng update` migration for that major fixes it:

- **Angular framework and CLI** (104 entries, Angular 9 to 22): from the Angular or Angular CLI CHANGELOG, the
  Angular CLI release notes for 9 to 11, or the angular.dev update guide data. 36 of them are `angular.json`
  builder options and builders removed by the Angular CLI, such as `extractCss` (13) or `browserTarget` (19); an
  option counts only in a target whose `builder` is the affected one, in its `options` and in every entry of its
  `configurations`. Under the known wrappers `@angular-builders/custom-webpack` and `ngx-build-plus` the same
  options are reported as heuristic findings.
- **Angular Material and CDK** (185 entries, 9 to 22): exports and entry points removed from `@angular/material`
  and `@angular/cdk`, such as the `legacy-*` entry points (17) and `MatCommonModule` (21), from the
  angular/components CHANGELOG.
- **Deprecations with an announced removal** (11 entries): for example the `@angular/animations` package and
  `provideAnimationsAsync()`, deprecated in 20.2 for removal in 23. They come from the `@deprecated` notices in
  the Angular sources that name the removal major.
- **RxJS 6 to 7** (4 entries): the `rxjs/Rx` import, `VirtualTimeScheduler.sortActions`, `defaultIfEmpty()`
  without a value and `iif()` without both results, from the RxJS breaking-changes document.

The 105 entries of 0.2.0 were checked again against their sources before this release; the entries added in
0.3.0 were written from their sources (audit status `added`) and not read again separately. The result per entry
is in [docs/verification/data-audit.md](docs/verification/data-audit.md).

Each removed-API finding is attached to the hop where it must be fixed and shows `file:line`, the API, the
replacement and "fixed by ng update migration: yes, no or unknown". Findings for majors you are already past, or
beyond the target, are counted but not listed. A deprecation is shown as a warning in the hop before its removal
(the hop to 22 for a removal in 23); it does not block and adds no effort, because the hop works without the
change. RxJS findings are shown only while the installed rxjs is 6.x: as work in the first hop whose
`@angular/core` no longer accepts RxJS 6, or else once as a non-blocking advisory. No Angular release up to 22
requires RxJS 7, so today they are an advisory.

Findings are of two kinds:

- **Confirmed**: a TypeScript symbol that is imported from the matching package (named, aliased or namespace
  imports and re-exports all count), or a property read from a parsed configuration file. A symbol of the same
  name from another package, and text in comments or strings, never counts.
- **Heuristic**: template patterns found by text matching, without the Angular template parser. These may be
  false positives, so they are listed under "could not be verified".

Each hop's effort gets 1 point for every distinct API the `ng update` migration fixes (it still needs a review)
and 3 points for every distinct API it does not fix or may not fix. Points count APIs, not uses, so a large
codebase does not swamp the estimate.

Use `--no-scan` to plan from the dependencies alone. The reports then say that the source was not checked.

## Node.js and TypeScript

Each hop states the Node.js range of its Angular release (from the `engines` of `@angular/core` and
`@angular/cli`) and its TypeScript range (from the `@angular/compiler-cli` peer dependency):

- **Node.js** is checked against the `engines.node` field of your `package.json`, because that is what your
  project, CI and deployments promise. It is a blocker when no version it allows is in the hop's range, a
  warning when it also allows versions outside it, and unverified when it is missing. Your local Node.js version
  is shown for context and decides nothing.
- **TypeScript** is checked against the version in your lockfile. Outside the hop's range it is a blocker: after
  `ng update`, install a TypeScript inside the range if `ng update` did not move it there. Later hops compare
  with the TypeScript locked today, so plan again after each hop.

## Scan precision on real apps

The scan was run on real open-source Angular apps at pinned commits, and every finding was labelled true or
false positive by reading the code at its line. Precision is true positives divided by all findings:

<!-- precision:start -->
Measured with ng-upgrade-planner 0.3.0 on 11 open-source Angular apps (Angular 9 to 19) on 2026-10-04: 105
findings, 105 true positives, 0 false positives, precision 100.0%.

| Rule family | Findings | True positives | False positives | Precision |
| --- | ---: | ---: | ---: | ---: |
| TypeScript symbol | 17 | 17 | 0 | 100.0% |
| Template pattern | 0 | 0 | 0 | n/a |
| Config path | 11 | 11 | 0 | 100.0% |
| Builder option | 25 | 25 | 0 | 100.0% |
| Builder | 8 | 8 | 0 | 100.0% |
| Material and CDK | 0 | 0 | 0 | n/a |
| Deprecation warning | 44 | 44 | 0 | 100.0% |
| RxJS 7 change | 0 | 0 | 0 | n/a |
| All | 105 | 105 | 0 | 100.0% |
<!-- precision:end -->

"n/a" means the family had no finding on these apps, so its precision on real code is not known yet. Recall
is not measured: uses the scan missed are not counted. The labels have not been reviewed independently yet. The
apps, the labels with their reasons and the numbers per app are in
[docs/verification/scan-precision.md](docs/verification/scan-precision.md).

## JSON output

`--json` prints the plan as a single JSON document on stdout instead of the terminal summary. Unless
`--no-report` is given, the same document is written to `ng-upgrade-plan.json` next to the other reports.

```sh
npx ng-upgrade-planner --json --no-report > plan.json
```

The document has a `schemaVersion` (currently `2`). For each hop it holds the official steps and `ng update`
commands, the library target versions, blockers, the Node.js and TypeScript checks, removed-API findings,
deprecation warnings, RxJS 7 changes, the effort and the confirmed and unverified results. A field is renamed,
removed or changes meaning only together with a new schema version. Version 2 came with 0.3.0; 0.2.0 wrote
version 1. Every field, and what changed from version 1, is described in the schema reference,
[skills/angular-upgrade-hops/references/plan-json.md](skills/angular-upgrade-hops/references/plan-json.md).

## Agent Skill

The package includes an Agent Skill in the open [Agent Skills](https://agentskills.io) format:
[skills/angular-upgrade-hops](skills/angular-upgrade-hops/SKILL.md). It tells a coding agent to carry out the
plan one hop at a time:

- refuse to start when the worktree has uncommitted changes, and work on a branch;
- plan with `--json`, then for the first hop only: run its official `ng update` commands, move libraries to the
  planned versions, fix the removed APIs, build and run the project's tests;
- commit once per hop, then plan again before the next hop;
- stop and report on any blocker, failed build or test, or unverified result that needs a human;
- never publish, and never push unless you ask.

To install it, copy the `angular-upgrade-hops` folder, unchanged, into the folder where your agent looks for
skills. The folder is `skills/angular-upgrade-hops` in a clone of this repository, or
`node_modules/ng-upgrade-planner/skills/angular-upgrade-hops` once the package is installed.

- **Claude Code**: copy it to `.claude/skills/angular-upgrade-hops` in your project (for that project only) or
  to `~/.claude/skills/angular-upgrade-hops` (for all projects). Then ask, for example, "upgrade this app to
  Angular 18 one hop at a time".
- **Other agents that read SKILL.md**: copy it to the skills folder named in your agent's documentation. Keep
  the folder name: it must match the `name` field in `SKILL.md`. The folder holds only Markdown, so nothing
  runs until the agent follows the instructions.

The skill runs `npx ng-upgrade-planner` and reads JSON schema version 2, so it needs ng-upgrade-planner 0.3.0
or later; it stops on the version 1 output of 0.2.0.

## Limitations

- **Peer ranges are taken as published.** An open range such as `>=6.0.0` or `*` accepts every future Angular
  version, so a library can be reported as compatible when it is not in practice.
- **Only `@angular/*` peers decide compatibility.** Peers on other packages, such as `@angular-devkit/*`,
  `@ngrx/store` or `rxjs`, are not checked between libraries.
- **A library that already accepts a hop is kept** at its installed version, even when a newer major exists.
- **Steps are listed in the hop where they become necessary**, once, even when the update guide shows them
  earlier as optional.
- **Update steps cover Angular up to 22**, from a bundled copy of the update guide data. Later hops say that no
  steps are available instead of guessing.
- **Effort is an estimate**: a weighted count of steps, major library updates, unmet requirements, blockers,
  Node.js and TypeScript problems and removed APIs. It has not been calibrated against real upgrades.
- **Only the root `package.json` is read.** Workspaces and monorepo packages are not traversed. The scan does
  read every source file under the project folder.
- **Nothing is installed or built.** The plan is based on registry metadata and your source text; it does not
  run your build or your tests.
- **The scan finds only what its data lists.** The data covers Angular, Angular Material and the CDK 9 to 22
  and RxJS 6 to 7, and only changes a source scan can see: a removed or renamed export, a decorator or method
  option, a template pattern or a configuration property. Behaviour and timing changes, typing changes the
  compiler reports, methods called on injected instances, Sass and CSS changes and other packages (such as
  zone.js) are not covered. Of the Angular CLI
  changes, only `angular.json` options and builders are: command-line flags, environment variables and
  options that only third-party builders define are not.
- **The scan has no type information.** A local variable that shadows an imported name is still matched. An
  API that your code re-exports from its own file is found at the re-export, not where it is used, and an API
  reached only through a variable is missed.
- **Template findings are text matches.** They may be false positives and are always listed as unverified.
- **A clean scan does not mean a clean upgrade.** The compiler, the `ng update` migrations and your tests
  remain the final check.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Licence

MIT, see [LICENSE](LICENSE).

The official update steps come from the Angular update guide data
([angular/angular](https://github.com/angular/angular), `adev/src/app/features/update/recommendations.ts`),
Copyright Google LLC, used under the MIT licence (https://angular.dev/license). The bundled copy records the
upstream commit it was taken from, and every report links to it.
