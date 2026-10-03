# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

## [0.1.0] - not yet released

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
