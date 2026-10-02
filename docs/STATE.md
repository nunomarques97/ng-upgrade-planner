---
status: v0.2 built and checked locally (removed-API scan, JSON plan output, Agent Skill); GitHub CI passed on Node.js 20 and 22 (commit 59b7cc6), not published, repository still private, package version still 0.1.0
sponsor_action: decide on the gates - make the GitHub repository public, publish to npm (including which version number to publish), and confirm the 8-week usage review
kill_review: none scheduled; proposed for the Sponsor to confirm - review usage 8 weeks after the first npm publish
success_metric: v0.2 - the scan finds every synthetic true positive and nothing on the synthetic negative cases, the JSON plan is snapshot-tested on the 5 fixtures, the skill passes its spec and CLI checks, and each fixture plans with the scan on in under 30 s with a warm cache (met locally); the v0.1 metric (5 fixtures, 2 plans checked by the development agent, under 30 s) still holds
---

# State

## Goal
Running `npx ng-upgrade-planner` in an Angular repo prints a hop-by-hop upgrade plan (for example 14 to 22):
for each hop the official update steps, the newest compatible version of every Angular-dependent third-party
library, blockers (libraries with no compatible release) and an effort estimate.

Why now: Angular 20 leaves LTS on 28 Nov 2026 and v2 to v19 are unsupported; `ng update` moves one major at a
time and checks peers only for the current step.

## Current state (v0.2, 2026-10-02)

Done in v0.2:
- Removed-API scan of the project's TypeScript, component templates, `angular.json` and `tsconfig*.json`,
  skipping `node_modules`, build output, caches and gitignored paths. TypeScript findings are import-aware;
  template findings are text matches and are reported as unverified. `--no-scan` turns it off.
- Bundled data: 68 removed or breaking APIs for Angular 9 to 22 (none qualify for 12; the reason is recorded),
  each with an official source URL, the replacement and whether `ng update` fixes it. 36 changes that a scan
  cannot detect or that lack an official source are listed with the reason (`REMOVED_API_EXCLUDED`).
- Findings attached to the hop where they must be fixed, added to the effort estimate and shown in the terminal,
  Markdown and HTML reports, with confirmed and unverified results kept apart.
- JSON plan (`--json` on stdout, `ng-upgrade-plan.json` with the reports), schema version 1, documented in
  `skills/angular-upgrade-hops/references/plan-json.md` and snapshot-tested on the 5 fixtures.
- Agent Skill `skills/angular-upgrade-hops` (SKILL.md format) that executes the plan one hop at a time, shipped in
  the package; tests check its front-matter against the spec and that every CLI flag it names exists.
- Synthetic scan test sources in `test/fixtures/synthetic/scan`; the app fixtures are still only `package.json`
  and lockfiles.
- Warm cache with the scan on: 0.67 s to 1.23 s per fixture, each with 361 generated source files scanned
  (`npm run bench:warm`, Node.js 24 on Windows, 2026-10-02); the limit is 30 s.
- `npm run check:pack` confirms the package holds the README, licence, changelog, `package.json`, `dist/` and
  the two Markdown files of the skill (55 files, about 429 kB unpacked).

Done in v0.1:
- CLI with terminal summary, Markdown report and single-file HTML report; reads npm, pnpm and yarn (classic and
  berry) lockfiles; npm registry client with cache, rate limiting and offline mode.
- Five real open-source fixtures (Angular 11, 13, 15, 16 and 17; npm, pnpm and yarn lockfiles) with recorded
  registry data and snapshot tests of their plans. Sources and licences are in each `SOURCE.md`.
- Two plans verified line by line: `docs/verification/` (jira-clone-angular 11 to 22, yunikorn-web 16 to 22).
  The check was done by the development agent with a separate checker script, not yet by a person. It covers
  the v0.1 plan fields, not the scan.
- README, CONTRIBUTING, LICENSE (MIT), CHANGELOG, GitHub Actions CI (Node.js 20 and 22).
- `npm publish` is blocked by `prepublishOnly` until the Sponsor approves.

Confirmed on GitHub: the CI workflow passed on Node.js 20 and 22 for v0.1 (2026-10-02, commit 9348136). It also passed for
v0.2 (2026-10-02, commit 59b7cc6).

Not verified yet:
- A person has not yet reviewed the two verified plans.
- Effort points, including the removed-API weights, are not calibrated against real upgrades.
- The scan has run only on synthetic sources: the fixtures hold no application source, so its precision on real
  apps is not measured.
- The removed-API data was written from the official sources and checked by tests for an official URL on every
  entry, but a person has not re-read each entry against its source.
- The skill has not been run end to end by an agent on a real project. It calls `npx ng-upgrade-planner`, which
  works only after the npm publish.

## Roadmap
- v0.1: the CLI, fixtures, reports, open-source docs and CI. Not published.
- v0.2: scan for APIs removed in each hop; JSON plan output; an Agent Skill (open SKILL.md format) that executes the plan one hop at a time. Built locally, not published.
- v1: npm publish and an article written by the Sponsor.

## Sponsor gates
- Making the GitHub repo public.
- Publishing to npm, including the version number (package.json still says 0.1.0).
- Confirming the proposed usage review 8 weeks after the npm publish.
