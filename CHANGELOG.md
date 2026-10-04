# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [0.3.0] - unreleased

### Added

- Deprecation warnings: 11 APIs deprecated with an announced removal major, such as the `@angular/animations`
  package, `provideAnimationsAsync()` and `Component.animations` (deprecated in 20.2, removed in 23) and
  `withIncrementalHydration` (removed in 24). Each cites the `@deprecated` notice that names the removal major. A
  warning appears in the hop before the removal; it does not block and adds no effort points. Every report has a
  deprecation column or list.
- Angular Material and CDK: 185 removed or breaking APIs of `@angular/material`, `@angular/cdk` and their entry
  points for majors 9 to 22, such as the `legacy-*` entry points (17), the mixin helpers (19) and `MatCommonModule`
  (21). Each cites the angular/components CHANGELOG and was checked against the public API of the last release
  that exported it. The bundled scan data now holds 289 entries.
- RxJS 6 to 7: 4 breaking changes a source scan can find (the `rxjs/Rx` import, `VirtualTimeScheduler.sortActions`,
  `defaultIfEmpty()` without a value and `iif()` without both results), each citing the RxJS breaking-changes
  document. Files that import `rxjs` without `@angular/*` are scanned too. The findings are shown only while the
  installed rxjs is 6.x: as work in the first hop whose `@angular/core` no longer accepts RxJS 6, or else once as
  a non-blocking advisory. No Angular release up to 22 requires RxJS 7, so today they are an advisory.
- Node.js and TypeScript per hop: each hop states the Node.js range of its Angular release (the `engines` of
  `@angular/core` and `@angular/cli`) and its TypeScript range (the `@angular/compiler-cli` peer). The project's
  `engines.node` is a blocker when it allows no version in the range, a warning when it also allows versions
  outside it, and unverified when it is missing or invalid. The lockfile's TypeScript is a blocker when it is
  outside the range. The local Node.js version is shown as context and decides nothing. Effort: 8 points per
  Node.js blocker, 2 per Node.js warning and 2 per TypeScript blocker.
- Scan precision measured on 11 open-source Angular apps (Angular 9 to 19; npm, pnpm and yarn) at pinned commits:
  105 findings, all true positives after reading each line. Recall is not measured. The labels and numbers per
  rule family and per app are in `docs/verification/scan-precision.md`; the README quotes them, and a test keeps
  the two in step.
- Data audit: every removed-API entry carries an audit status (confirmed, corrected, removed, unverified or
  added); a test fails on an entry without one. The 105 entries of 0.2.0 were read again against their official
  sources: 95 confirmed, 8 corrected and 2 removed. The entries added in 0.3.0 were written from their sources
  and have status added; they were not read again separately. Details in `docs/verification/data-audit.md`.

### Changed

- JSON plan: `schemaVersion` is now `2`. Differences from version 1, documented in
  `skills/angular-upgrade-hops/references/plan-json.md`:
  - new `hops[].deprecations` and `scan.deprecations` for the deprecation warnings;
  - new `hops[].rxjs` and `scan.rxjs` for the RxJS 7 changes; `hops[].effort.breakdown.removedApis` also counts
    `hops[].rxjs`;
  - new `hops[].toolchain`, `toolchain` and `hops[].effort.breakdown.toolchain` for the Node.js and TypeScript
    checks;
  - `hops[].requirementWarnings` holds only `"rxjs"` and `"zone.js"`; `"node"` (checked against the local Node.js
    in version 1) and `"typescript"` moved to `hops[].toolchain`.

  Every other field keeps its name, type and meaning. A consumer written for version 1 must stop on version 2.
- The local Node.js version no longer counts as an unmet requirement, so plans of projects without
  `engines.node` lose the 2 points it added to a hop.
- Removed-API data corrections from the audit: the `migration` value of `ignoreChangesOutsideZone`,
  `getAngularLib`, `setAngularLib` and `fullTemplateTypeCheck` (21 and 22) is now "no" instead of "unknown", and
  four v12 i18n entries have corrected migration notes. `NgModuleFactory` and `HttpXhrBackend` were removed from
  the data, because both are still exported in Angular 22; the `ngModuleFactory` input of `NgComponentOutlet`
  (removed in 21) was added in their place.
- Agent Skill `angular-upgrade-hops`, from a run on a real Angular 19 app: it requires JSON schema version 2;
  installs from the lockfile and runs a baseline build and test before the first hop; runs `ng` only through the
  installed CLI (`npx --no-install ng` with npm); moves all of a hop's libraries in one install, because moving
  them one at a time can fail on peer conflicts; runs Karma tests once, headless; stops on a Node.js blocker; and
  after `ng update` installs a TypeScript inside the hop's range only if `ng update` did not move it there.

## [0.2.0] - 2026-10-03

### Added

- Removed-API scan: the project's own TypeScript sources, component templates (external and inline),
  `angular.json` and `tsconfig*.json` files are checked for Angular APIs removed or changed in a breaking way in
  each hop. It skips `node_modules`, build output, caches and everything `.gitignore` excludes.
- Bundled removed-API data for Angular 9 to 22 (105 entries). Every entry cites the official Angular document
  that states the change and records the replacement and whether the official `ng update` migration fixes it.
- Each finding is attached to the hop where it must be fixed, with `file:line`, the API, the replacement and
  "fixed by ng update migration: yes, no or unknown". TypeScript findings count only when the symbol is imported
  from the matching package; template findings come from text matching and are listed under "could not be
  verified".
- Removed-API findings add to each hop's effort: 1 point per distinct API the migration fixes, 3 points per
  distinct API it does not fix or may not fix.
- The removed-API data covers `angular.json` builder options and builders removed by the Angular CLI in 10 to
  22 (36 of the entries), such as `extractCss` (13) and `browserTarget` (19). An option counts only in a target
  whose `builder` is the affected one, in `options` and every `configurations` entry.
- `--no-scan` turns the scan off.
- `--json` prints the plan as JSON on stdout instead of the terminal summary, and every run that writes reports
  also writes `ng-upgrade-plan.json`. The format has a schema version (1) and is documented in
  `skills/angular-upgrade-hops/references/plan-json.md`.
- Agent Skill `angular-upgrade-hops` (open SKILL.md format), shipped in the package under `skills/`. It tells an
  agent to execute the plan one hop at a time on a branch, with one commit per hop, and to stop on any blocker,
  failed build or test, or result that needs a human.

### Changed

- The terminal summary, Markdown and HTML reports show the scan status and the removed APIs of each hop; the
  Markdown and HTML summary tables have a removed-API column.
- `--out-dir` now also receives `ng-upgrade-plan.json`.

## [0.1.0] - not published; its changes ship in 0.2.0

First version.

### Added

- `ng-upgrade-planner` command: plans an Angular upgrade from the installed major version to a target major
  (`--to`, default the latest release), one hop per major version.
- Reads `package.json` and the npm (`package-lock.json`, `npm-shrinkwrap.json`), pnpm (`pnpm-lock.yaml`) and yarn
  classic and berry (`yarn.lock`) lockfiles.
- For each hop: the official update steps, the `ng update` commands, the newest compatible release of every
  library with `@angular/*` peer dependencies, blockers, TypeScript, RxJS, zone.js and Node.js requirements, and
  an effort estimate.
- Library compatibility decided only from published `@angular/*` peer ranges, using npm's own `semver` range
  rules. Results the data cannot decide are marked "unknown" and never shown as compatible.
- Every report separates results confirmed by evidence from results that could not be verified.
- npm registry client with a local cache (24 hours), at most four concurrent requests, retries with backoff that
  honour `Retry-After`, and an `--offline` mode that works from the cache alone. No credentials are sent.
- Terminal summary, Markdown report (`ng-upgrade-plan.md`) and single-file HTML report (`ng-upgrade-plan.html`).
- Update steps from a bundled copy of the Angular update guide data (angular/angular, commit 647bf8e, 2026-08-13,
  MIT licence, Copyright Google LLC), covering Angular up to 22.
