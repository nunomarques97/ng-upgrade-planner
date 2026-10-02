# ng-upgrade-planner

Open-source CLI (MIT). Run `npx ng-upgrade-planner` inside an Angular repo to get a hop-by-hop upgrade plan
(for example 14 to 22): per hop the official update steps, the newest compatible version of each
Angular-dependent third-party library, blockers and an effort estimate. Audience: teams stuck on old Angular.

## Stack & essentials
Node + TypeScript CLI. No global installs required by users. Reads package.json and the lockfile
(npm, pnpm, yarn), queries the public npm registry for peerDependencies with a local cache and polite
rate limiting, and works offline from the cache. Outputs: terminal summary, Markdown report, single-file HTML report.

Commands:
- Full local CI (lint, docs check, typecheck, tests, build, pack check): `npm run ci`
- Tests: `npm test` (Vitest; never hits the network)
- Warm-cache benchmark: `npm run bench:warm`
- Re-record registry fixtures (uses the network): `npm run record:fixtures`
- Secret guard: `node scripts/guard-keys.mjs --all`

## Invariants
- Package name `ng-upgrade-planner`, licence MIT.
- Tests never hit the network: registry responses are recorded under test fixtures.
- Fixtures contain only package.json and lockfiles from open-source apps, each with source and licence noted.
- Never publish to npm: Sponsor gate. The GitHub repo is public (Sponsor decision, 2026-10-02).
- Never commit credentials. `.gitignore` excludes `.env*`, keys, and any name containing `token` or `secret`
  (so do not give source files such names). Pre-commit guard: `git config core.hooksPath .githooks`.

## Conventions
- All source, comments, docs and CLI copy in plain English. No em-dashes. Nothing in user-facing docs about how
  the project was built.

## Verification
Done means lint, typecheck and tests pass locally (same as CI on Node 20 and 22), `npm pack` is clean, and any
report separates what was confirmed by evidence from what could not be verified.

## Where things live
- Product goal, roadmap, current state and Sponsor gates: `docs/STATE.md`
- Architecture, decisions, trade-offs: `docs/WALKTHROUGH.md`
- Work tracking: no Linear (small single-milestone tool); priorities and roadmap live in `docs/STATE.md`
- Project skills/hooks: `.githooks/pre-commit` (secret guard)
- Tooling configured here: n/a (CLI, no app UI; the HTML report is generated output) - catalog: `C:\Users\User\Desktop\PLAYBOOK\TOOLING.md`
- Design reference: n/a

<!-- forja-core:begin -->
## FORJA core
New FORJA tasks use Core. The conversation agent prepares the goal, starts the controller and reports its result; it does not act as Lead or manually dispatch the legacy crew.
Resolve `<forja>` from the caller-provided installation, `FORJA_ROOT`, or an existing FORJA hook path in `.claude/settings.json`. If unavailable, ask for the installation path; do not guess or install another copy.
Read `<forja>/docs/CORE.md` and `<forja>/docs/CORE-RUNBOOK.md`. From this project: `node "<forja>/bin/forja.mjs" start --goal "..." --provider claude|codex|kilo`. Supply the explicitly selected profile with `--config`; installing or updating FORJA does not select models.
The controller owns planning, development, checks and independent review. Workers read only the phase and applicable domain methods supplied in `specialist_context`. Do not load `forja-lead` or other legacy crew skills for Core work.
Core state and usage live in `.forja/`. Inspect existing changes before starting; preserve them and use `--allow-dirty` only when work on that snapshot is authorized. Git delivery requires explicit configuration and the controller delivery contract.
Preparation does not start a run. Never silently resume or replace an active Core or legacy run. Stop existing executors before an explicitly authorized handover; preserve their state and unfinished work.
Legacy `runner` and `run start` are compatibility commands only when explicitly requested. Their state remains in `docs/forja/`; read legacy methods as files for that workflow. Restart the conversation after migration to discard previously loaded legacy instructions.
<!-- forja-core:end -->
