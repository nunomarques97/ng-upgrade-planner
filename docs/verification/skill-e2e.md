# Agent Skill end to end on a real app

The `angular-upgrade-hops` skill was followed step by step, by the development agent, on one real app for two
hops (Angular 19 to 20 and 20 to 21), and up to the stop condition of the third hop. This page records what was
run, what worked, what failed and where the skill or the plan misled. Date: 2026-10-04.

## Setup

| | |
| --- | --- |
| App | coreui-free-angular-admin-template, https://github.com/coreui/coreui-free-angular-admin-template (MIT), listed in `scripts/real-apps.json` |
| Commit | d5af5acca9ba67074be9471d08a94c9915536cac (Angular 19.2.14, npm lockfile, `engines.node` `^18.19.1 \|\| ^20.11.1 \|\| ^22.0.0`) |
| Node.js, npm | 24.14.0, 11.9.0 (the only Node.js installed on the machine) |
| Tests | Karma with Chrome Headless 154, 46 specs |
| OS | Windows 11, commands run from Git Bash |

- The app was copied from the git-ignored cache (`git archive` of the pinned commit) into a temporary folder
  outside the repository, made a git repository there with one commit, and upgraded on a branch. Nothing from
  the app was written into this repository; the cached clone was left unchanged.
- **Substitution:** 0.3.0 is not published, so every `npx ng-upgrade-planner --json --no-report` of the skill
  was run as `node <repository>/dist/cli.js --json --no-report --cache-dir <temporary folder>/planner-cache`,
  with the CLI built from the working tree (it reports version 0.2.0 because the version is not bumped yet).
  `--cache-dir` kept the registry cache in the temporary folder.
- Install scripts of the app's dependencies ran only in the temporary folder. npm used an empty user
  configuration (`NPM_CONFIG_USERCONFIG` pointing to an empty file) and a cache in the temporary folder, so no
  user npm configuration or credential was read. `NG_CLI_ANALYTICS=false` and `CI=true` were set. Nothing was
  pushed or published.

## Commands

Exit code and wall-clock duration of each command, in order. Commands run in the app folder.

| # | Skill step | Command | Exit | Seconds |
| --- | --- | --- | --- | --- |
| 1 | 1.2 | `git status --porcelain` (printed nothing) | 0 | 0.1 |
| 2 | 1.4 | `git switch -c angular-upgrade` | 0 | 0.1 |
| 3 | 2 | planner, see substitution (3 hops: 19 to 20, 20 to 21, 21 to 22) | 0 | 2.9 |
| 4 | not in the skill (see A) | `npm ci --no-audit --no-fund` | 0 | 45.5 |
| 5 | not in the skill (see A) | `npm run build` (baseline) | 0 | 132.2 |
| 6 | not in the skill (see A) | `npx --no-install ng test --watch=false --browsers=ChromeHeadless` (baseline, 46 of 46) | 0 | 84.2 |
| 7 | 3.1 | `node --version` (24.14.0, inside `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`) | 0 | 0.1 |
| 8 | 3.2 | `npx --no-install ng update @angular/core@20 @angular/cli@20` | 0 | 273.4 |
| 9 | check | `npm ls @angular/core @angular/cdk` (invalid peers, see C) | 1 | 1.9 |
| 10 | 3.4 as written | `npm install @angular/cdk@20.2.14` (ERESOLVE, see B) | 1 | 2.5 |
| 11 | 3.4 fixed | `npm install @angular/cdk@20.2.14 @coreui/angular@5.5.26 @coreui/angular-chartjs@5.5.26 @coreui/icons-angular@5.5.26` | 0 | 7.9 |
| 12 | check | `npm ls --all` | 0 | 2.4 |
| 13 | 3.9 | `npm run build` (2 errors, see D) | 1 | 86.7 |
| 14 | 3.9 | `npx --no-install ng test --watch=false --browsers=ChromeHeadless` (46 of 46) | 0 | 141.0 |
| 15 | 3.9 | `npm run build` after the fix | 0 | 96.3 |
| 16 | 3.9 | `npx --no-install ng test --watch=false --browsers=ChromeHeadless` (46 of 46) | 0 | 175.0 |
| 17 | 3.10 | `git add -A && git commit -m "Upgrade Angular 19 to 20"` | 0 | 3.6 |
| 18 | 4 | planner again (2 hops: 20 to 21, 21 to 22) | 0 | 34.4 |
| 19 | 3.2 | `npx --no-install ng update @angular/core@21 @angular/cli@21` | 0 | 352.0 |
| 20 | 3.4 fixed | `npm install @angular/cdk@21.2.14 @coreui/angular@5.6.25 @coreui/angular-chartjs@5.6.25 @coreui/icons-angular@5.6.25` | 0 | 7.4 |
| 21 | check | `npm ls --all` | 0 | 1.9 |
| 22 | 3.9 | `npm run build` | 0 | 130.9 |
| 23 | 3.9 | `npx --no-install ng test --watch=false --browsers=ChromeHeadless` (46 of 46) | 0 | 91.0 |
| 24 | 3.10 | `git add -A && git commit -m "Upgrade Angular 20 to 21"` | 0 | 0.3 |
| 25 | 4 | planner again (1 hop: 21 to 22) | 0 | 4.1 |
| 26 | 3.1 | `node --version` (24.14.0, outside `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`): stop | 0 | 0.2 |

Every `npm` command printed an `EBADENGINE` warning, because Node.js 24 is outside the app's `engines.node`.

## What worked (observed)

- The planner ran in the app folder with JSON on stdout only, wrote no report file and left the worktree clean.
  Replanning after each committed hop started from the version reached (20, then 21).
- Hop 19 to 20: the plan's command ran without added options. It moved the Angular packages,
  `@angular-devkit/build-angular` and TypeScript (5.7.3 to 5.9.3), and its migrations changed `angular.json`,
  `tsconfig.json` (`moduleResolution` to `bundler`) and the `DOCUMENT` import in two files. The plan's four
  library moves (`@angular/cdk` and three CoreUI packages) installed together and gave a valid dependency tree.
  After the fix in D the build and the 46 tests passed, and the hop was committed.
- Hop 20 to 21: the command, the four library moves, the build and the 46 tests passed without any manual
  change. The migration added `provideZoneChangeDetection()` to `src/main.ts`, which is the plan's basic step
  for zone-based apps. TypeScript 5.9.3 was already inside the plan's range (`toolchain.typescript.status` ok).
- The plan's Node.js status was `warning` for each hop (the app's `engines.node` allows versions outside the
  hop's range). The skill reported it and went on, as it says.
- Hop 21 to 22: the Node.js check of step 3.1 stopped the skill before any change, because 24.14.0 is outside
  the hop's range. This matches the skill's stop condition.
- Third-party library results were right: every planned version installed, and `ngx-scrollbar` 13.0.3, which
  the plan kept, worked with Angular 20 and 21.

## Where the skill or the plan misled

| | Observed | Outcome |
| --- | --- | --- |
| A | The skill never said to install the dependencies before `ng update`, and its example `npx ng update ...` would, in a folder without `node_modules`, make npx download and run an unrelated npm package named `ng`. It also had no baseline build and test run, so a failure after a hop could not be told apart from an existing one. | Fixed in SKILL.md: step 1 installs from the lockfile (`npm ci`, `pnpm install --frozen-lockfile`, `yarn install --frozen-lockfile` or `--immutable`), then builds and tests once and stops if that fails; commands run as `npx --no-install ng`, `pnpm exec ng` or `yarn ng`. Tested in `test/skill/skill.test.ts`. |
| B | Step 4 said to install each library "for each entry". Installing the first one alone failed with ERESOLVE (exit 1), because the CoreUI packages not moved yet still required Angular 19. All four in one command worked. | Fixed in SKILL.md: all of a hop's library moves go in one install command, with the reason. Tested. |
| C | `ng update` installed Angular 20 although three CoreUI packages required `^19.2.0`, leaving invalid peer dependencies until step 4. | Not a defect: step 4 fixes it in the same hop, and the build runs after step 4. No change. |
| D | The build failed after `ng update`: the official `moduleResolution: bundler` change makes TypeScript honour package exports, so the app's deep import `chart.js/dist/types/utils` no longer resolves. Fixed in the app by typing the value with the public `ChartOptions['plugins']`. | Not fixed in the planner: it is a third-party deep import, outside the Angular removed-API data. The skill's step 9 (fix failures caused by the hop) covered it. |
| E | The plan called TypeScript 5.7.3 a blocker resolved by installing a TypeScript "after ng update", but `ng update` moved it into the range itself. | Fixed in the plan text (`src/plan/requirements.ts`, `src/report/model.ts`): "install a TypeScript inside that range if ng update did not move it there", and in SKILL.md step 5 and `plan-json.md`. Snapshots and tests updated. The status stays `blocker`, as decided for the toolchain task. |
| F | Karma's `ng test` watches by default; the skill would have asked the user how to run the tests once. | Fixed in SKILL.md step 1.3: `ng test --watch=false`, with `--browsers=ChromeHeadless` for Karma. Tested. |
| G | `npm install name@version` rewrote the CoreUI ranges from `~5.4.14` to `^5.5.26`. | Not fixed: the lockfile pins the exact version and the range style is the project's choice; noted for the report. |

## Not run or not observed

- Removed-API fixes (step 6), RxJS 7 fixes (step 7) and deprecation notes (step 8): the two executed hops had no
  removed-API, RxJS or deprecation entry. None of the 11 apps in `scan-precision.json` has a removed-API
  finding in its first two hops, so no app from the list could exercise step 6 within two hops. The 11
  deprecation warnings of this app attach to the hop to 22, which stopped on Node.js.
- A TypeScript blocker that `ng update` leaves outside the range (step 5 install path), and the hop to 22,
  which needs Node.js 24.15 or newer; only Node.js 24.14.0 was available.
- pnpm and yarn projects, `ng update <library>` instead of an install, `--to`, `--offline`, a library
  `blocker` or `unknown` status, and a dirty worktree at the start.
- `npx ng-upgrade-planner` itself: the published 0.2.0 has no toolchain, deprecation or RxJS fields and schema
  version 1, so the skill would stop on it; the local build stood in for it.
- Optional migrations printed by `ng update` (control flow, `use-application-builder`) were not run, as the
  skill runs only the plan's commands.
- The upgraded app was built and tested, not served or checked in a browser.
