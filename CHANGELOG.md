# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
