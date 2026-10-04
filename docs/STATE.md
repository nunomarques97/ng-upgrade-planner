---
status: v0.3 prepared as 0.3.0 and not published (version, CHANGELOG, README with the measured precision; npm run ci and npm run bench:warm pass locally on 2026-10-04); 0.2.0 published to npm on 2026-10-03 (first public version); repository public since 2026-10-02
sponsor_action: approve or hold the npm publish of 0.3.0 (Sponsor gate; nothing was published, prepublishOnly still refuses without approval); review the RxJS 6 to 7 decision, which differs from the v0.3 goal (see Decisions); confirm the usage review on 2026-11-28 (8 weeks after the 0.2.0 publish); write the v1 article
kill_review: proposed 2026-11-28 (8 weeks after the 2026-10-03 npm publish), awaiting Sponsor confirmation
success_metric: v0.3 - scan precision measured on at least 10 real apps and quoted in the README, kept equal to the labels by a test (11 apps, 105 findings, 100%), every removed-API entry carries an audit status (tested), deprecation, Material and CDK, RxJS and toolchain checks covered by synthetic tests, the skill run end to end on a real app, npm run ci passes and each fixture plans with the scan on in under 30 s with a warm cache (met locally on 2026-10-04); the v0.2 and v0.1 metrics still hold
---

# State

## Goal
Running `npx ng-upgrade-planner` in an Angular repo prints a hop-by-hop upgrade plan (for example 14 to 22):
for each hop the official update steps, the newest compatible version of every Angular-dependent third-party
library, blockers (libraries with no compatible release) and an effort estimate.

Why now: Angular 20 leaves LTS on 28 Nov 2026 and v2 to v19 are unsupported; `ng update` moves one major at a
time and checks peers only for the current step.

## Current state (v0.3, 2026-10-04)

Release 0.3.0 prepared, not published (2026-10-04):
- `package.json` and `package-lock.json` are at 0.3.0. `prepublishOnly` and `scripts/prepublish-guard.mjs` are
  unchanged, so `npm publish` still refuses without the Sponsor's approval. Nothing was published.
- CHANGELOG: a 0.3.0 entry, dated "unreleased" until the publish, with the precision measurement, data audit,
  deprecation warnings, Material and CDK, RxJS 6 to 7, toolchain blockers, skill fixes and the JSON schema
  version 2 differences.
- README: the new coverage (Material and CDK, deprecations, RxJS, a Node.js and TypeScript section) and a
  precision table. `test/readme.test.ts` recomputes that table from `docs/verification/scan-precision.json` and
  checks the dataset sizes the README quotes against the bundled data; changing one figure made it fail. The
  terminal example was regenerated from an offline run of the jira-clone fixture.
- JSON schema version 2 is documented in `skills/angular-upgrade-hops/references/plan-json.md` with its
  changes from version 1; the JSON snapshots of the 5 fixtures have `schemaVersion` 2 and pass.
- The precision run was redone for the version number (`node scripts/scan-real-apps.mjs`): only the recorded
  version changed, the 105 labelled findings are the same and `--check` passes.
- Evidence, 2026-10-04, Node.js 24.14.0 on Windows: `npm run ci` passed (lint, docs check with WALKTHROUGH at
  1096 words, typecheck, 36 test files with 610 tests passed and 1 expected failure, build, pack check with 58
  files and 620.6 kB unpacked). `npm run bench:warm`: 0.98 s to 1.72 s per fixture, 361 files scanned each;
  the limit is 30 s.

Done in v0.2:
- Removed-API scan of the project's TypeScript, component templates, `angular.json` and `tsconfig*.json`,
  skipping `node_modules`, build output, caches and gitignored paths. TypeScript findings are import-aware;
  template findings are text matches and are reported as unverified. `--no-scan` turns it off.
- Bundled data: 105 removed or breaking APIs for Angular 9 to 22, each with an official source URL, the
  replacement and whether `ng update` fixes it. 36 of them are `angular.json` builder options and builders
  removed by the Angular CLI, matched only in targets of the affected builder (added 2026-10-03, see below).
  69 changes that a scan cannot detect or that lack an official source are listed with the reason
  (`REMOVED_API_EXCLUDED`).
- Findings attached to the hop where they must be fixed, added to the effort estimate and shown in the terminal,
  Markdown and HTML reports, with confirmed and unverified results kept apart.
- JSON plan (`--json` on stdout, `ng-upgrade-plan.json` with the reports), schema version 1, documented in
  `skills/angular-upgrade-hops/references/plan-json.md` and snapshot-tested on the 5 fixtures.
- Agent Skill `skills/angular-upgrade-hops` (SKILL.md format) that executes the plan one hop at a time, shipped in
  the package; tests check its front-matter against the spec and that every CLI flag it names exists.
- Synthetic scan test sources in `test/fixtures/synthetic/scan`; the app fixtures are still only `package.json`
  and lockfiles.
- Warm cache with the scan on: 0.79 s to 1.85 s per fixture, each with 361 generated source files scanned
  (`npm run bench:warm`, Node.js 24 on Windows, 2026-10-03, with the builder data); the limit is 30 s.
- `npm run check:pack` confirms the package holds the README, licence, changelog, `package.json`, `dist/` and
  the two Markdown files of the skill (55 files, about 482 kB unpacked).

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

Pre-publish test on real apps (2026-10-03): the packed tarball was run once on the full source of two fixture
apps at their pinned commits, jira-clone-angular (Angular 11, commit e773fbe) and ngx-admin (Angular 15, commit
dc6a442). The scan found `defaultProject`, `defaultCollection` and `fullTemplateTypeCheck` in jira-clone-angular
but missed `extractCss` in its `angular.json` (removed in 13), and it reported nothing for ngx-admin, whose
`angular.json` uses `browserTarget` 3 times (removed in 19). Cause: the data held no builder options. The gap is
closed by the 36 builder option and builder entries, read from the Angular CLI CHANGELOG (12 to 22) and release
notes (9 to 11), with synthetic tests for both cases. jira-clone-angular sets `extractCss` under
`@angular-builders/custom-webpack:browser`, which extends the Angular browser builder, so options under that
wrapper and under `ngx-build-plus` are now reported as heuristic findings. Run again with the new data, both apps
show every gap listed above: `extractCss` (hop to 13), `browserTarget` (hop to 19, 3 in ngx-admin and 3 in
jira-clone-angular) and the removed Protractor builder (hop to 19).

Done in v0.3 (2026-10-03 to 2026-10-04, ships in 0.3.0):
- Scan precision baseline on 11 open-source apps (Angular 9 to 19; 5 npm, 4 yarn, 2 pnpm) at pinned commits:
  61 findings, all 61 labelled true positives after reading each line (55 confirmed, 6 heuristic builder
  options under the custom-webpack and ngx-build-plus wrappers), so precision is 100% on this set, with no
  false positive to fix. Two apps (Angular 18 and 19) had no finding. Details, labels and per-app numbers:
  `docs/verification/scan-precision.md`; `node scripts/scan-real-apps.mjs --check` reproduces them from the
  cache.
- False-positive fixes: none were needed, because the baseline has no false positive. The report now has a
  "before and after the fixes" section per rule family and per app (identical numbers here), and the labels
  file records each future false positive as fixed (with the change and its regression test) or not fixed
  (with the reason); a test rejects a false positive that is neither. No scan code, data or fixture snapshot
  changed.
- Removed-API data audit: every entry of 0.2.0, Angular 9 to 22, was read again against its official source, its
  migration list and its references, and carries an audit record (`audit` on the entry; a test fails on an
  entry without a well-formed one). 105 entries read: 95 confirmed, 8 corrected, 2 removed, 0 unverified; every
  source was retrieved. Corrections: four `migrationNote` or `migration` values of the v12 i18n options, and four
  `migration` values from unknown to no in 21 and 22 (`ignoreChangesOutsideZone`, `getAngularLib`,
  `setAngularLib`, `fullTemplateTypeCheck`), each read in the migration's source. Removed: `NgModuleFactory`
  (still exported by `@angular/core` 21 and 22; the 21.0.0 change removed the `ngModuleFactory` input of
  `NgComponentOutlet`, now a template entry) and `HttpXhrBackend` (still exported and provided in 22; the change
  is the default backend of `provideHttpClient()`). The dataset now holds 104 entries. The audit was done by
  the development agent on 2026-10-03, not by a person. The 11 real apps give the same 61 findings; the fixture
  snapshots did not change. Details: `docs/verification/data-audit.md`.
- Deprecation warnings: 11 entries in `src/data/deprecated-apis.ts` for APIs deprecated with an announced
  removal major (the `@angular/animations` packages and their `@angular/platform-browser` providers and
  `Component.animations`, deprecated in 20.2 for removal in 23; `withIncrementalHydration`, deprecated in 22
  for removal in 24), each citing the `@deprecated` notice at Angular v22.2.1 that names the removal major, with
  audit status `added`. 8 candidates are excluded with the reason (`DEPRECATED_API_EXCLUDED`). The scan matches
  them with the same import-aware and template rules; the plan shows them as non-blocking warnings, without
  effort points, in the hop whose target is the removal major minus 1, and counts the others as not attached.
  All four reports show them; the JSON plan is now schema version 2. Synthetic tests cover a positive, an
  aliased import, a same-named symbol from another package, comments and strings. The 5 fixture snapshots
  changed only in the schema numbers, the new empty fields and a deprecation column; no effort changed.
- Angular Material and CDK data added (2026-10-03): 185 removed-API entries for `@angular/material`,
  `@angular/cdk` and their entry points, majors 9 to 22 (`src/data/components-apis.ts`), each citing the
  angular/components CHANGELOG at a pinned commit, with the export checked in the public API golden of the last
  release that had it, and 27 exclusions with the reason. They include the `@angular/material` primary entry
  point (9), the 44 legacy entry points (17), `MatCommonModule` and the unused factories and animation
  constants (21), and three template patterns. Every entry has audit status added and is listed in
  `docs/verification/data-audit.md`. Findings attach to the hop of their Angular major and show in all four
  reports (tested). The 11 real apps gave no new finding (`node scripts/scan-real-apps.mjs --check` passes
  with the larger dataset), so the new entries have no precision measured on real code yet.
- RxJS 6 to 7 breaking changes (2026-10-04): 4 entries in `src/data/rxjs-apis.ts` (the `rxjs/Rx` import,
  `VirtualTimeScheduler.sortActions`, `defaultIfEmpty()` without a value, `iif()` without both results), each
  citing the RxJS breaking-changes document or CHANGELOG at a pinned commit, checked against the typings of the
  published rxjs 6.6.7 and 7.0.0, with audit status added; 14 breaking changes a source scan cannot find are
  excluded with the reason. Files that import rxjs without `@angular/*` are scanned too. The plan shows the
  findings only when the installed rxjs is 6.x: as work in the first hop whose `@angular/core` accepts no
  RxJS 6, or else once as a non-blocking advisory without effort points. All four reports show them (tested,
  and the sample report screenshots at 1440 and 390 px show the advisory with no page overflow). Synthetic
  tests cover positives, an aliased import, a same-named symbol from another package, comments and strings.
  In the 5 fixture snapshots the rxjs 6 apps get an empty advisory and the others "not applicable"; no effort
  changed.
- Scan precision rerun with the final v0.3 data (2026-10-04): the real-app script now scans with the data the
  CLI uses by default (removed APIs including Material and CDK, deprecations, RxJS) and reports Material and
  CDK, deprecation warnings and RxJS 7 changes as their own rule families. 105 findings, all true positives
  (100%): the 61 removed-API findings of the baseline, unchanged by the audit corrections, plus 44 deprecation
  warnings in 8 apps; no Material, CDK or RxJS finding. No new false positive, so no scan or data change. The
  report keeps the baseline (61 findings, 100%) next to the current numbers;
  `node scripts/scan-real-apps.mjs --check` passes.
- Toolchain per hop (2026-10-04): the project reader reads `engines.node` (a missing or invalid value is a
  project warning). Each hop states the Node.js range (the intersection of the `@angular/core` and
  `@angular/cli` engines) and the TypeScript range (the `@angular/compiler-cli` peer), from the recorded
  registry data. Node.js: blocker when `engines.node` allows no version in the range, warning when it also
  allows versions outside it, unverified when it is missing or invalid. TypeScript: blocker when the
  lockfile's version is outside the range; a version guessed from a package.json range is unverified. The local
  Node.js version is shown in every report as context and decides nothing. Tested: engines inside, partly
  outside, fully outside, missing and invalid; TypeScript in range, out of range and guessed. All four reports
  and the JSON (`hops[].toolchain`, `toolchain`, `effort.breakdown.toolchain`, within the unreleased schema 2)
  show it; the skill stops on a Node.js blocker and installs a TypeScript inside the range after `ng update`
  (skill tests pass). The sample report screenshots at 1440 and 390 px, light and dark, show the toolchain
  section with no page overflow. Fixture snapshots, reviewed: only yunikorn-web declares `engines.node`
  (`"18"`), giving a warning for hops 17 to 19 and a blocker for 20 to 22 (+26 points); the other four get an
  unverified Node.js status and lose 4 points each, because the local Node.js no longer counts as an unmet
  requirement in the hop to 22.
- Skill end to end (2026-10-04, `docs/verification/skill-e2e.md`): the skill was followed on
  coreui-free-angular-admin-template (commit d5af5ac, Angular 19, npm) in a temporary folder outside the
  repository, with Node.js 24.14.0 and npm 11.9.0, and the locally built CLI in place of `npx
  ng-upgrade-planner` (0.3.0 is not published). Hops 19 to 20 and 20 to 21 ran: the plan's `ng update`
  commands, the library moves (`@angular/cdk` and three CoreUI packages), the production build and 46 Karma
  tests in Chrome Headless all passed, with one manual fix in hop 19 to 20 (a deep `chart.js` import broken by
  the official `moduleResolution: bundler` change); each hop was committed and the replans started from the
  version reached. The hop to 22 stopped, as the skill says, on the local Node.js being outside its range.
  Fixed from it, with skill tests: install from the lockfile and run a baseline build and test before the first
  hop; run `ng` only through the installed CLI (`npx --no-install ng`); move all of a hop's libraries in one
  install, because one at a time gave ERESOLVE; run Karma once headless. The TypeScript blocker text now says
  to install a TypeScript only if `ng update` did not move it into the range, since `ng update` did.

Confirmed on GitHub: the CI workflow passed on Node.js 20 and 22 for v0.1 (2026-10-02, commit 9348136). It also passed for
v0.2 (2026-10-02, commit 59b7cc6).

Not verified yet:
- 0.3.0 has not run from the npm registry (not published), and the GitHub CI workflow has not run on the v0.3
  changes (nothing was committed or pushed in this run). Locally only Node.js 24.14.0 was used; Node.js 20 and
  22 are covered by the GitHub CI once the changes are pushed.
- A person has not yet reviewed the two verified plans.
- Effort points, including the removed-API weights, are not calibrated against real upgrades.
- The scan's recall on real apps is not measured: uses of removed APIs that the scan misses are not counted.
  Precision is measured (below), but the labels were set by the development agent and a person has not
  reviewed them. Template patterns had no finding on the 11 apps, so their precision on real code is still
  unknown.
- A person has not reviewed the removed-API data audit; the development agent did it (see above).
- Only the 105 entries of 0.2.0 were read again against their sources. The entries added in 0.3.0 (the
  `NgComponentOutlet` input, 185 Material and CDK, 11 deprecations, 4 RxJS) have audit status added: they were
  written from their sources and not read again separately. The README and CHANGELOG say so.
- The deprecation entries were written from their sources by the development agent; a person has not
  reviewed them. On the 11 real apps they gave 44 findings, all true positives, but only 5 of the 11 entries
  matched (the animations providers and modules, `@Component` animations and the `@angular/animations`
  import), so the other 6 have no precision measured on real code.
- The Material and CDK entries were written from their sources by the development agent; a person has not
  reviewed them, and none of them matched on the 11 real apps (rerun 2026-10-04 with the final v0.3 data), so
  their precision on real code is unknown.
  Migration values of 17 to 22 rest on the upgrade data being empty; ng update was not run.
- The RxJS entries were written from their sources by the development agent; a person has not reviewed them,
  and none of them matched on the 11 real apps (rerun 2026-10-04), so their precision on real code is unknown.
  The required-work path (a hop that forces
  RxJS 7) is covered only by unit tests with in-memory registry data, because no recorded Angular release
  through 22 forces it.
- The toolchain effort weights (8 per Node.js blocker, 2 per Node.js warning, 2 per TypeScript blocker) are
  not calibrated. The TypeScript check compares each hop with the TypeScript locked today; it does not model
  the TypeScript the earlier hops would install, so later hops show a blocker until the skill replans.
- The skill end-to-end run covers one npm app and two hops only (see above). Not exercised: the removed-API,
  RxJS and deprecation steps (the hops had no such entry, and none of the 11 real apps has a removed-API finding
  in its first two hops), a TypeScript blocker that `ng update` leaves outside the range, pnpm and yarn
  projects, library blockers, and `npx ng-upgrade-planner` itself, which needs the 0.3.0 publish (0.2.0 emits
  schema version 1, which the skill refuses). A person has not repeated the run.

## Decisions
- 2026-10-03, real apps for the precision measurement. Chosen from public GitHub repositories with a licence
  file under MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause or ISC and a committed npm, pnpm or yarn lockfile,
  pinned at a commit where the lockfile installs one Angular major from 9 to 19. The five fixture apps are
  reused at their fixture commits; six more were picked to cover Angular 9, 10, 18 and 19 and a second pnpm
  app. Candidates were left out for a missing or unclear licence (angular-challenges, the realworld example),
  a bun lockfile (the realworld example) or no committed lockfile (ng-alain). angular-hub uses pnpm only from
  Angular 20, so it is pinned at its last Angular 18 commit with yarn, and spartan is the second pnpm app.
- 2026-10-03, how the apps are fetched. `scripts/fetch-real-apps.mjs` runs git with an argument list and no
  shell (`init`, a depth-1 `fetch` of the pinned commit over https from github.com, a detached `checkout`) and
  verifies the checked-out commit. Git gets an allow-listed environment, an empty global configuration, no
  system configuration, no credential helper and no prompts, so no token or account is used. Nothing from
  the apps is installed or run. The apps live in the git-ignored `.cache/real-apps`; only the labels (paths,
  lines, entry ids, API names, reasons) are committed. git was chosen over codeload tarballs because it can
  verify the commit it checked out and needs no new dependency.
- 2026-10-03, what precision counts. Every raw scan finding is labelled, including findings for majors the app
  has already passed, because the scan reports them too; the report also gives precision for the findings a
  plan would list (a major above the installed one). A finding is a true positive when the line really uses
  the API its entry describes; whether the entry's data is right is the data audit's question, not this one.
- 2026-10-03, false-positive fixes. Before fixing, five of the 61 baseline labels were re-read at their lines in
  the cache (spartan `fullTemplateTypeCheck`, angular-spotify `enableIvy`, yunikorn-web `HAMMER_LOADER`,
  ng-matero `relativeLinkResolution`, angular-ngrx-material-starter `async`) and all were real uses, so the
  zero false-positive result stands and `src/scan` and `src/data` were left unchanged; no synthetic case was
  added because there is no false positive to reproduce. To keep later fixes traceable, a fixed false positive
  moves from `findings` to a `fixed` list in `scan-precision.json` with the change and the regression test,
  and a kept one carries a `notFixed` reason; the report computes "before" as findings plus fixed. The five
  fixture snapshots did not change.
- 2026-10-03, data audit rules. An entry is removed, not corrected, when its source shows the usage it finds
  still compiles in the target major (`NgModuleFactory`, `HttpXhrBackend`); its record moves to
  `REMOVED_API_EXCLUDED` with a note that starts with the former id. When the change the source describes is
  detectable, the audit writes a new entry for it with status `added` (the `NgComponentOutlet` input), the same
  status later v0.3 entries use, and the summary counts it apart from the entries read. `migration` is set to no,
  not unknown, when the migration's source shows it never edits the usage the entry finds. Every entry must now
  carry an audit record (`audit` is required in `src/data/types.ts`). The removal lowers the dataset size
  recorded in `docs/verification/scan-precision.json` from 105 to 104; nothing else in it changed.
- 2026-10-03, deprecation warnings. Only deprecations whose official source names the removal major are
  entries, so a warning never guesses a date; the source is the `@deprecated` notice in the Angular sources
  at the v22.2.1 tag, which is where the removal major is written (the CHANGELOG gives none for these). A
  deprecation with no removal major, or whose announced removal passed without happening (`moduleId`), is
  excluded with the reason. A warning attaches to the hop whose target is the removal major minus 1, so it is
  seen one hop before it becomes a removal; it never blocks and adds no effort points, because the hop works
  without changing it. Warnings are kept in their own list per hop, apart from removed APIs, and the summary
  gets a deprecation column. Per-symbol entries are used where a package is only partly deprecated
  (`@angular/platform-browser/animations` keeps `ANIMATION_MODULE_TYPE`); a whole-package `*` entry where every
  export is deprecated. Template trigger bindings get no text entry, because the component also imports
  `trigger()` from `@angular/animations`, which the import-aware entry finds. The JSON plan becomes schema
  version 2, the first shape change: `hops[].deprecations` and `scan.deprecations` are added and the skill
  accepts version 2 only; later v0.3 fields go into the same unreleased version 2. The internal plan schema
  number moves to 3 for the same reason.
- 2026-10-03, Angular Material and CDK data. The source is the angular/components CHANGELOG at commit
  `f6c2a19` (the test now accepts files of github.com/angular/components and still rejects other repositories
  and hosts); every symbol and entry point was checked in the public API golden of the last release that
  exported it, because the CHANGELOG misspells two names (`MAT_CHECKBOX_VALUE_ACCESSOR`,
  `MAT_DATE_LOCAL_FACTORY`) and the entry for a name that never existed would never match. Material and the CDK
  release with Angular's major, so an entry's major is the Angular hop it belongs to. Only exports, entry points
  and three template inputs or outputs are entries; instance members, constructor parameters, typing changes,
  Sass and CSS changes, and other packages of the repository (google-maps, aria, the date adapters) are
  exclusions. `migration` is yes only where the upgrade data rewrites the usage, no where the rule lists name
  nothing or only report it (all of 17 to 22, whose upgrade data is empty; the 17 migration even sets
  `@angular/material` back to ^16.2.0 while legacy imports remain), and unknown where migration code runs whose
  effect on the usage was not established (9, 10). The entries live in their own file, spread into the
  removed-API data, to keep `removed-apis.ts` readable. The dataset size recorded in
  `docs/verification/scan-precision.json` goes from 104 to 289; nothing else in it changed.
- 2026-10-04, RxJS 6 to 7 (differs from the goal, for the Sponsor). The goal assumes an Angular upgrade forces
  RxJS 7. The recorded registry data says otherwise: the newest `@angular/core` of every major from 13 to 22
  has the rxjs peer `^6.5.3 || ^7.4.0` (12 has `^6.5.3 || ^7.0.0`, 9 to 11 `^6.5.3`), so no Angular hop
  through 22 forces RxJS 7. RxJS findings are therefore work in a hop only when that hop's `@angular/core`
  rxjs range shares no version with 6.x (tested with in-memory registry data), and otherwise shown once as a
  non-blocking advisory, with that reason and no effort points, so the plan never claims a forced move that
  the data does not show. A hop is checked against 6.x rather than the exact installed version, because an old
  6.x below `^6.5.3` needs a minor rxjs update, not the RxJS 7 changes. A hop whose rxjs range cannot be read
  is listed in `scan.rxjs.uncheckedHops`. With rxjs 7 or later, or no direct rxjs, findings are counted but
  not shown. Forced RxJS findings count as manual removed-API work (no `ng update` migration covers them).
  Only changes that make a use stop compiling or change behaviour and that a scan can tie to an import are
  entries; changes to instance methods and return types (such as `toPromise()` resolving to `T | undefined`)
  and the TypeScript or `@types/node` requirements are exclusions. The JSON adds `hops[].rxjs` and `scan.rxjs` within the unreleased schema
  version 2.
- 2026-10-04, toolchain per hop. Node.js and TypeScript leave the framework requirements and become
  `hops[].toolchain` with a status of ok, warning, blocker or unverified; rxjs and zone.js stay requirements.
  The project's `engines.node` decides the Node.js status, because it is what the project, its CI and its
  deployments promise; the local Node.js version changes from machine to machine, so it is shown as context
  and never decides a status (the skill still checks `node --version` before a hop). The hop's Node.js range is
  the intersection of the `@angular/core` and `@angular/cli` engines (9 to 11 have only the CLI's). A Node.js
  blocker weighs as much as a library blocker (8 points: runtime, CI and deployment change), a Node.js warning
  2, and a TypeScript blocker 2 (one dev dependency the skill installs after `ng update`); unverified results
  add nothing. `hops[].blockers` stays library-only for the JSON shape; the reports' blocker counts and lists
  include toolchain blockers. The JSON adds these fields within the unreleased schema version 2.

- 2026-10-04, precision rerun. The real-app script scans with the same three datasets as the CLI, so the
  measured precision is that of the released scan. Rule families stay by match kind for the Angular removed
  APIs; Material and CDK entries (package `@angular/material` or `@angular/cdk`), deprecations and RxJS
  entries each get one family, because they are separate datasets with separate sources and the README quotes
  them apart. A finding's `major` is the entry's removal major for a deprecation and 7 for RxJS; "listed in
  plan" follows `build-plan` (a deprecation in the hop before its removal, RxJS only when the installed rxjs is
  6.x, which the script now records per app), with the default target taken as the newest major of the
  removed-API data (22). The baseline is kept as counts in `scan-precision.json` (not as a second list of
  findings) with its original dataset size of 105 entries, since the audit and Material tasks had rewritten
  the recorded size. The recorded package version is compared by `--check`, so the 0.3.0 bump must rerun
  `node scripts/scan-real-apps.mjs`, which keeps the labels.
- 2026-10-04, release preparation. The CHANGELOG entry is dated "unreleased" rather than a guessed publish
  date; the publish step sets the date. The README precision table sits between `precision:start` and
  `precision:end` markers in the same format the test computes, so a new measurement that is not copied to the
  README fails CI. The README counts the Material and CDK entries as those of `src/data/components-apis.ts`
  (185) and the rest as Angular framework and CLI (104), as the data audit does; the precision report puts the
  one CDK entry kept in the Angular data (`v14-cdk-testing-protractor`) in its Material and CDK family. It had
  no finding, so no number differs. The terminal example shows local Node.js 20.19.0, the value of the
  Markdown excerpt beneath it. The JSON schema stays at version 2, set in the deprecations task; nothing in this
  task changed the shape.
- 2026-10-04, skill end-to-end run. The app is coreui-free-angular-admin-template: a small app (268 files) from
  the real-app list with an npm lockfile, Karma tests that run headless, and next hops whose Node.js range
  accepts the only Node.js installed (24.14.0). The run used an empty npm user configuration
  and caches inside the temporary folder, so no user credential was read. Two hops were run, the most the task
  allows; the third stopped on Node.js before any change. Misleading points were fixed in SKILL.md and the
  TypeScript blocker text; the TypeScript status stays `blocker` (toolchain decision above), only its wording
  changed. A deep third-party import broken by the official `moduleResolution` change is left to the build
  step, since it is outside the Angular removed-API data. The 5 fixture snapshots changed only in that wording.
- 2026-10-04, screenshot script. `scripts/screenshot-report.mjs` started one headless browser per capture (30
  starts). On a busy machine a start took 2 to 80 s, so a run took 12.5 minutes and hit the check time limit.
  It now starts one browser and drives it over the DevTools protocol on a pipe (no new dependency), sets the
  width and colour scheme by emulation, and measures the report in place. The same views and files are
  written; a run took 41 s on the same machine, and the layout numbers matched the old run.

## Roadmap
- v0.1: the CLI, fixtures, reports, open-source docs and CI. Never published on its own; shipped in 0.2.0.
- v0.2: scan for APIs removed in each hop; JSON plan output; an Agent Skill (open SKILL.md format) that executes the plan one hop at a time. Published to npm as 0.2.0 on 2026-10-03.
- v0.3: scan precision on real apps, data audit, deprecation warnings, Angular Material and CDK, RxJS 6 to 7,
  Node.js and TypeScript blockers per hop, a skill run end to end. Prepared as 0.3.0 on 2026-10-04; not
  published (Sponsor gate).
- v1: npm publish and an article written by the Sponsor.

## Sponsor gates
- Making the GitHub repo public: approved and done on 2026-10-02.
- Publishing to npm: 0.2.0 approved and published on 2026-10-03. Every later publish is a separate Sponsor gate.
  0.3.0 is prepared and waits for that approval; it is not published.
  npm uses staged publishing: a publish waits until the Sponsor approves it with 2FA on npmjs.com.
- Confirming the proposed usage review 8 weeks after the npm publish.
