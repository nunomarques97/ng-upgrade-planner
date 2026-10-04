# Verification

## Scan precision on real apps

[scan-precision.md](scan-precision.md) reports how many scan findings are real uses, per rule family (removed
Angular APIs by match kind, Material and CDK, deprecation warnings, RxJS 7 changes) and per app, on 11
open-source Angular apps (Angular 9 to 19; npm, pnpm and yarn) at pinned commits. The labels, one per finding
with a reason, are in [scan-precision.json](scan-precision.json). They were set by the development agent, not
yet reviewed by a person. Recall is not measured. The report also shows precision before and after the
false-positive fixes, and the first measurement (removed-API data only) next to the current one.

The apps are listed in `scripts/real-apps.json`. `node scripts/fetch-real-apps.mjs` fetches them from GitHub into
the git-ignored `.cache/real-apps`, and `node scripts/scan-real-apps.mjs --check` scans them again and fails when
the findings or the report no longer match the labels. No application source is committed.

## Removed-API data audit

[data-audit.md](data-audit.md) records, per entry of the bundled removed-API data, the result of reading its
official source again: confirmed, corrected (with the change), removed (with the reason) or unverified (source
not retrieved), plus the entries added in place of removed ones. Every entry, Angular 9 to 22, is audited: 105
read, 95 confirmed, 8 corrected, 2 removed, 0 unverified, 1 added. The audit was done by the development agent,
not yet by a person.

## Agent Skill end to end

[skill-e2e.md](skill-e2e.md) records the `angular-upgrade-hops` skill followed by the development agent on one
real app (coreui-free-angular-admin-template, Angular 19, npm) for two hops, 19 to 20 and 20 to 21, in a
temporary folder outside the repository, with the locally built CLI in place of `npx ng-upgrade-planner`: each
command with its exit code and duration, what worked, where the skill or the plan misled and how that was
fixed, and what was not run.

## Plans checked by the development agent

Two fixture plans were checked line by line against the data they were built from. The check was done by the
development agent with a separate checker script, not yet by a person:

- [yunikorn-web-16.md](yunikorn-web-16.md): Apache YuniKorn web UI, Angular 16 to 22, pnpm lockfile.
- [jira-clone-angular-11.md](jira-clone-angular-11.md): jira-clone-angular, Angular 11 to 22, npm lockfile.

Checked on 2026-10-02 against the registry data recorded on 2026-10-02 (`test/fixtures/registry`) and the
bundled update guide snapshot (angular/angular commit 647bf8e, 2026-08-13). The plans checked are the committed
snapshots `test/__snapshots__/fixtures/<app>.plan.json` and `.md`, produced with target Angular 22 and Node.js
20.19.0.

The check covers the plan fields of version 0.1: hops, steps, commands, libraries, blockers and requirements.
The removed-API scan added later is not part of it, because the fixtures hold no source code to scan.

### Method

1. **Independent recomputation.** A separate checker script, written for this verification and not part of
   the tool, read only the fixture `package.json` and lockfile, the recorded registry files and the vendored
   update guide data, and used the `semver` package (npm's own range implementation) for every range test.
   For each hop it worked out from those files:
   - the hop's Angular release: the newest stable `@angular/core` of the major;
   - for each library, every stable release whose `@angular/*` peer ranges accept the newest stable release of
     each peer in that major (optional peers the app does not use are skipped), the newest such release that is
     not deprecated, and whether the version going into the hop already accepts it;
   - that no version kept in a hop conflicts with a peer range declared by another library chosen for the
     same hop;
   - the TypeScript and zone.js peer ranges and the Node.js engine ranges of the newest stable
     `@angular/compiler-cli`, `@angular/core` and `@angular/cli` of the major, tested against the installed
     versions from the lockfile and Node.js 20.19.0;
   - the update guide steps whose "necessary as of" version falls inside the hop, with Material steps only for
     apps that use `@angular/material`, and the `ng update` commands.

   Each value was compared with the plan field by field.
2. **Reading the records.** Every library result that is not "compatible" (blockers and unknowns) was checked by
   reading the recorded versions and peer ranges directly, as were the decisive releases listed in each document.
3. **Comparison with what the maintainers did.** Both projects later upgraded Angular themselves. Their
   committed `package.json` files show which library versions they picked for each major. These are listed next
   to the plan.

### Shared limitations

These apply to every plan, not only to the two checked here:

- **Peer ranges are taken as published.** An open range such as `>=6.0.0` or `*` accepts every future Angular
  version, so a library can be reported as compatible when it is not.
- **Only `@angular/*` peers decide compatibility.** Peers on other packages, such as `@angular-devkit/*`,
  `@ngrx/store` or `rxjs`, are not checked between libraries. For example, `@nx/angular` declares only
  `@angular-devkit/*` peers, so it is reported as unknown in the angular-spotify fixture.
- **A library that already accepts a hop is kept** at its current version, even if a newer major exists. It
  moves only when another release chosen for the same hop requires a newer version of it.
- **Steps are listed in the hop where they become necessary.** The official update guide also shows steps
  that are only possible at that point and become necessary in a later version. The plan lists such a step
  once, in the hop where it becomes necessary.
- **Effort is an estimate.** It is a weighted count of steps, major version changes, unmet requirements,
  blockers and removed-API findings. It was not verified against real upgrade effort.
- **Nothing was installed or built.** The verification checks the plan against registry metadata. It does not
  show that the apps install, compile or pass their tests after each hop.
