# Verified plan: yunikorn-web, Angular 16 to 22

Fixture: `test/fixtures/apps/yunikorn-web-16` (apache/yunikorn-web at commit 21ebe5d, pnpm lockfile 9.0).
Plan checked: `test/__snapshots__/fixtures/yunikorn-web-16.plan.json` and `.md`, target Angular 22, Node.js
20.19.0. The method and the limitations shared by all plans are in [README.md](README.md).

## Result

- **194 values compared, 0 differences** between the plan and the independent recomputation: the library list,
  6 hop releases, 30 library results (version going in, status, version chosen, kept or changed), 30
  requirement ranges and statuses, 6 command lists and every step title of the 6 hops.
- **1 defect found and fixed** (below). The comparison above was run after the fix.
- Every library result is "compatible". There are no blockers and no unknowns in this plan.

## Inputs read from the lockfile

`@angular/core` 16.2.10. Libraries with `@angular/*` peers: `@angular-architects/module-federation` 16.0.4,
`@angular/cdk` 16.2.9, `@angular/material` 16.2.9, `ng-mocks` 14.11.0, `ngx-spinner` 16.0.2. The other direct
dependencies declare no `@angular/*` peer in any recorded release, so they are not in the library matrix; the
checker reached the same list. TypeScript 5.1.6, RxJS 7.8.1 and zone.js 0.13.0 are installed.

## Hops, steps and framework requirements

Each hop goes to the newest stable release of the major. The step counts include Material steps, because the
app uses `@angular/material`, and every hop has the commands `ng update @angular/core@N @angular/cli@N` and
`ng update @angular/material@N`. Ranges come from the newest stable `@angular/compiler-cli` (typescript),
`@angular/core` (rxjs, zone.js, Node.js) and `@angular/cli` (Node.js) of the major.

| Hop | Angular release | Steps | typescript | rxjs | zone.js | node (core) | node (cli) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 17 | 17.3.12 | 16 | `>=5.2 <5.5`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.14.0`: unmet | `^18.13.0 \|\| >=20.9.0`: met | `^18.13.0 \|\| >=20.9.0`: met |
| 18 | 18.2.14 | 25 | `>=5.4 <5.6`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.14.10`: unmet | `^18.19.1 \|\| ^20.11.1 \|\| >=22.0.0`: met | `^18.19.1 \|\| ^20.11.1 \|\| >=22.0.0`: met |
| 19 | 19.2.25 | 18 | `>=5.5 <5.9`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.15.0`: unmet | `^18.19.1 \|\| ^20.11.1 \|\| >=22.0.0`: met | `^18.19.1 \|\| ^20.11.1 \|\| >=22.0.0`: met |
| 20 | 20.3.33 | 28 | `>=5.8 <6.0`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.15.0`: unmet | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`: met | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`: met |
| 21 | 21.2.25 | 23 | `>=5.9 <6.1`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.15.0 \|\| ~0.16.0`: unmet | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`: met | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`: met |
| 22 | 22.2.1 | 37 | `>=6.0 <6.1`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.15.0 \|\| ~0.16.0`: unmet | `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`: unmet | `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`: unmet |

The Node.js requirement of Angular 22 is unmet only because the snapshot uses Node.js 20.19.0 as a fixed input.

## Library versions per hop

"keep" means the version going into the hop already accepts it; a version in bold is the change the plan
recommends for that hop.

| Library | Installed | 17 | 18 | 19 | 20 | 21 | 22 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `@angular-architects/module-federation` | 16.0.4 | keep 16.0.4 | keep 16.0.4 | keep 16.0.4 | keep 16.0.4 | keep 16.0.4 | keep 16.0.4 |
| `@angular/cdk` | 16.2.9 | **17.3.10** | **18.2.14** | **19.2.19** | **20.2.14** | **21.2.14** | **22.2.1** |
| `@angular/material` | 16.2.9 | **17.3.10** | **18.2.14** | **19.2.19** | **20.2.14** | **21.2.14** | **22.2.1** |
| `ng-mocks` | 14.11.0 | **14.18.1** | keep 14.18.1 | keep 14.18.1 | keep 14.18.1 | keep 14.18.1 | keep 14.18.1 |
| `ngx-spinner` | 16.0.2 | keep 16.0.2 | keep 16.0.2 | keep 16.0.2 | keep 16.0.2 | keep 16.0.2 | keep 16.0.2 |

The peer ranges that decided these results, read from the recordings:

| Release | @angular peer ranges as recorded |
| --- | --- |
| `@angular-architects/module-federation` 16.0.4 | `@angular/common` `>=16.0.0`, `@angular/core` `>=16.0.0`, `@angular/platform-browser-dynamic` `>=16.0.0` |
| `@angular/cdk` 17.3.10 | `@angular/common` `^17.0.0 \|\| ^18.0.0`, `@angular/core` `^17.0.0 \|\| ^18.0.0` |
| `@angular/cdk` 18.2.14 | `@angular/common` `^18.0.0 \|\| ^19.0.0`, `@angular/core` `^18.0.0 \|\| ^19.0.0` |
| `@angular/cdk` 19.2.19 | `@angular/common` `^19.0.0 \|\| ^20.0.0`, `@angular/core` `^19.0.0 \|\| ^20.0.0` |
| `@angular/cdk` 20.2.14 | `@angular/common` `^20.0.0 \|\| ^21.0.0`, `@angular/core` `^20.0.0 \|\| ^21.0.0` |
| `@angular/cdk` 21.2.14 | `@angular/common` `^21.0.0 \|\| ^22.0.0`, `@angular/core` `^21.0.0 \|\| ^22.0.0`, `@angular/platform-browser` `^21.0.0 \|\| ^22.0.0` |
| `@angular/cdk` 22.2.1 | `@angular/common` `^22.0.0 \|\| ^23.0.0`, `@angular/core` `^22.0.0 \|\| ^23.0.0`, `@angular/forms` `^22.0.0 \|\| ^23.0.0`, `@angular/platform-browser` `^22.0.0 \|\| ^23.0.0` |
| `@angular/material` 17.3.10 | `@angular/animations` `^17.0.0 \|\| ^18.0.0`, `@angular/cdk` `17.3.10`, `@angular/common` `^17.0.0 \|\| ^18.0.0`, `@angular/core` `^17.0.0 \|\| ^18.0.0`, `@angular/forms` `^17.0.0 \|\| ^18.0.0`, `@angular/platform-browser` `^17.0.0 \|\| ^18.0.0` |
| `@angular/material` 18.2.14 | `@angular/animations` `^18.0.0 \|\| ^19.0.0`, `@angular/cdk` `18.2.14`, `@angular/common` `^18.0.0 \|\| ^19.0.0`, `@angular/core` `^18.0.0 \|\| ^19.0.0`, `@angular/forms` `^18.0.0 \|\| ^19.0.0`, `@angular/platform-browser` `^18.0.0 \|\| ^19.0.0` |
| `@angular/material` 19.2.19 | `@angular/cdk` `19.2.19`, `@angular/common` `^19.0.0 \|\| ^20.0.0`, `@angular/core` `^19.0.0 \|\| ^20.0.0`, `@angular/forms` `^19.0.0 \|\| ^20.0.0`, `@angular/platform-browser` `^19.0.0 \|\| ^20.0.0` |
| `@angular/material` 20.2.14 | `@angular/cdk` `20.2.14`, `@angular/common` `^20.0.0 \|\| ^21.0.0`, `@angular/core` `^20.0.0 \|\| ^21.0.0`, `@angular/forms` `^20.0.0 \|\| ^21.0.0`, `@angular/platform-browser` `^20.0.0 \|\| ^21.0.0` |
| `@angular/material` 21.2.14 | `@angular/cdk` `21.2.14`, `@angular/common` `^21.0.0 \|\| ^22.0.0`, `@angular/core` `^21.0.0 \|\| ^22.0.0`, `@angular/forms` `^21.0.0 \|\| ^22.0.0`, `@angular/platform-browser` `^21.0.0 \|\| ^22.0.0` |
| `@angular/material` 22.2.1 | `@angular/cdk` `22.2.1`, `@angular/common` `^22.0.0 \|\| ^23.0.0`, `@angular/core` `^22.0.0 \|\| ^23.0.0`, `@angular/forms` `^22.0.0 \|\| ^23.0.0`, `@angular/platform-browser` `^22.0.0 \|\| ^23.0.0` |
| `ng-mocks` 14.18.1 | `@angular/common` `5.0.0-alpha - 5 \|\| 6.0.0-alpha - 6 \|\| 7.0.0-alpha - 7 \|\| 8.0.0-alpha - 8 \|\| 9.0.0-alpha - 9 \|\| 10.0.0-alpha - 10 \|\| 11.0.0-alpha - 11 \|\| 12.0.0-alpha - 12 \|\| 13.0.0-alpha - 13 \|\| 14.0.0-alpha - 14 \|\| 15.0.0-alpha - 15 \|\| 16.0.0-alpha - 16 \|\| 17.0.0-alpha - 17 \|\| 18.0.0-alpha - 18 \|\| 19.0.0-alpha - 19 \|\| 20.0.0-alpha - 20 \|\| 21.0.0-alpha - 21 \|\| 22.0.0-alpha - 22`, `@angular/core` `5.0.0-alpha - 5 \|\| 6.0.0-alpha - 6 \|\| 7.0.0-alpha - 7 \|\| 8.0.0-alpha - 8 \|\| 9.0.0-alpha - 9 \|\| 10.0.0-alpha - 10 \|\| 11.0.0-alpha - 11 \|\| 12.0.0-alpha - 12 \|\| 13.0.0-alpha - 13 \|\| 14.0.0-alpha - 14 \|\| 15.0.0-alpha - 15 \|\| 16.0.0-alpha - 16 \|\| 17.0.0-alpha - 17 \|\| 18.0.0-alpha - 18 \|\| 19.0.0-alpha - 19 \|\| 20.0.0-alpha - 20 \|\| 21.0.0-alpha - 21 \|\| 22.0.0-alpha - 22`, `@angular/forms` `5.0.0-alpha - 5 \|\| 6.0.0-alpha - 6 \|\| 7.0.0-alpha - 7 \|\| 8.0.0-alpha - 8 \|\| 9.0.0-alpha - 9 \|\| 10.0.0-alpha - 10 \|\| 11.0.0-alpha - 11 \|\| 12.0.0-alpha - 12 \|\| 13.0.0-alpha - 13 \|\| 14.0.0-alpha - 14 \|\| 15.0.0-alpha - 15 \|\| 16.0.0-alpha - 16 \|\| 17.0.0-alpha - 17 \|\| 18.0.0-alpha - 18 \|\| 19.0.0-alpha - 19 \|\| 20.0.0-alpha - 20 \|\| 21.0.0-alpha - 21 \|\| 22.0.0-alpha - 22`, `@angular/platform-browser` `5.0.0-alpha - 5 \|\| 6.0.0-alpha - 6 \|\| 7.0.0-alpha - 7 \|\| 8.0.0-alpha - 8 \|\| 9.0.0-alpha - 9 \|\| 10.0.0-alpha - 10 \|\| 11.0.0-alpha - 11 \|\| 12.0.0-alpha - 12 \|\| 13.0.0-alpha - 13 \|\| 14.0.0-alpha - 14 \|\| 15.0.0-alpha - 15 \|\| 16.0.0-alpha - 16 \|\| 17.0.0-alpha - 17 \|\| 18.0.0-alpha - 18 \|\| 19.0.0-alpha - 19 \|\| 20.0.0-alpha - 20 \|\| 21.0.0-alpha - 21 \|\| 22.0.0-alpha - 22` |
| `ngx-spinner` 16.0.2 | `@angular/animations` `>=15.0.0`, `@angular/common` `>=15.0.0`, `@angular/core` `>=15.0.0` |

Direct checks of the decisive lines, read from the records:

- `@angular/material` 16.2.9 declares `@angular/cdk` `16.2.9`. Against Angular 17 the reference `@angular/cdk`
  is 17.3.10, the newest stable 17.x release, so 16.2.9 does not accept the hop and 17.3.10 is chosen. The same
  pattern repeats in every hop, so Material moves one major per hop.
- `@angular/cdk` 16.2.9 declares `^16.0.0 || ^17.0.0`, so on its own it accepts Angular 17. It must still move
  to 17.3.10, because `@angular/material` 17.3.10 declares `@angular/cdk` `17.3.10` exactly. See the defect below.
- `ng-mocks` 14.11.0 lists majors up to 16 only, so it moves to 14.18.1, which lists every major from 5 to 22.
- `ngx-spinner` 16.0.2 (`>=15.0.0`) and `@angular-architects/module-federation` 16.0.4 (`>=16.0.0`) have open
  ranges, so they are kept on every hop.

## Discrepancies

| Found | Status |
| --- | --- |
| Hop 17 kept `@angular/cdk` 16.2.9 ("no change needed") while moving `@angular/material` to 17.3.10, which requires `@angular/cdk` `17.3.10` exactly. Installing that combination fails the peer check. | Fixed. After choosing versions for a hop, the planner moves any kept library that another chosen release requires at a newer version. Regression test in `test/plan/build-plan.test.ts`. |
| `@angular-architects/module-federation` 16.0.4 is kept up to Angular 22 because its peers are `>=16.0.0`. The 26 newer stable releases (17.0.0 onwards) declare no `@angular/*` peer, so none of them can be checked. | Known limitation. The plan lists it under "could not be verified" for every hop. |

## Comparison with the maintainers' upgrade

The project moved to Angular 18 in commit 7f8c742 (2024-09-27). Its `package.json` then had `@angular/core`,
`@angular/cdk` and `@angular/material` `^18.2.5` (the plan for hop 18: 18.2.14, the newest 18.x release),
`typescript` 5.5.4 (inside the plan's `>=5.4 <5.6`), `zone.js` `~0.14.10` (the plan's range),
`ng-mocks` `^14.13.1` (the plan: 14.18.1), `ngx-spinner` `^17.0.0` and `@angular-architects/module-federation`
`^18.0.6`. The plan keeps the last two at 16.0.2 and 16.0.4, which their published peer ranges allow; the
maintainers chose to follow the Angular major.

## What could not be verified

- Whether the app installs, builds and passes its tests after each hop.
- Whether the libraries kept on open peer ranges (`ngx-spinner`, `@angular-architects/module-federation`)
  really work with the newer Angular releases.
- Whether a newer `@angular-architects/module-federation` release would be a better choice; its newer releases
  publish no `@angular/*` peers.
- Registry changes after the recording date, 2026-10-02.
- The effort estimate (261 points, XL), which is a heuristic.
