# Verified plan: jira-clone-angular, Angular 11 to 22

Fixture: `test/fixtures/apps/jira-clone-angular-11` (trungvose/jira-clone-angular at commit e773fbe,
`frontend/` folder, npm lockfile version 1). Plan checked: `test/__snapshots__/fixtures/jira-clone-angular-11.plan.json`
and `.md`, target Angular 22, Node.js 20.19.0. The method and the limitations shared by all plans are in
[README.md](README.md).

## Result

- **680 values compared, 0 differences** between the plan and the independent recomputation: the library list,
  11 hop releases, 143 library results (version going in, status, and for compatible results the version
  chosen and whether it is kept), 55 requirement ranges and statuses, 11 command lists and every step title of
  the 11 hops.
- The 13 results that are not "compatible" (3 unknown, 10 blockers) were checked by reading the records; see
  below.
- **1 defect found and fixed** (below). The comparison above was run after the fix.

## Inputs read from the lockfile

`@angular/core` 11.0.5. Libraries with `@angular/*` peers: `@angular-builders/custom-webpack` 10.0.1,
`@angular-eslint/template-parser` 1.1.0, `@angular/cdk` 11.0.3, `@datorama/akita-ng-entity-service` 5.1.1,
`@datorama/akita-ng-router-store` 5.1.9, `@datorama/akita-ngdevtools` 5.0.3, `@ngneat/content-loader` 6.0.0,
`@ngneat/until-destroy` 8.0.3, `@sentry/angular` 5.29.2, `@storybook/angular` 6.1.11, `codelyzer` 6.0.1,
`ng-zorro-antd` 11.0.0 and `ngx-quill` 13.0.1. The checker reached the same list. TypeScript 4.0.3, RxJS 6.6.3
and zone.js 0.10.3 are installed.

## Hops, steps and framework requirements

Each hop goes to the newest stable release of the major. The app does not use `@angular/material`, so Material
steps are left out and each hop has the single command `ng update @angular/core@N @angular/cli@N`. Ranges come from the newest stable
`@angular/compiler-cli` (typescript), `@angular/core` (rxjs, zone.js, Node.js) and `@angular/cli` (Node.js) of
the major.

| Hop | Angular release | Steps | typescript | rxjs | zone.js | node (core) | node (cli) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 12 | 12.2.17 | 17 | `>=4.2.3 <4.4`: unmet | `^6.5.3 \|\| ^7.0.0`: met | `~0.11.4`: unmet | `^12.14.1 \|\| >=14.0.0`: met | `^12.14.1 \|\| >=14.0.0`: met |
| 13 | 13.4.0 | 13 | `>=4.4.2 <4.7`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.11.4`: unmet | `^12.20.0 \|\| ^14.15.0 \|\| >=16.10.0`: met | `^12.20.0 \|\| ^14.15.0 \|\| >=16.10.0`: met |
| 14 | 14.3.0 | 17 | `>=4.6.2 <4.9`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.11.4 \|\| ~0.12.0`: unmet | `^14.15.0 \|\| >=16.10.0`: met | `^14.15.0 \|\| >=16.10.0`: met |
| 15 | 15.2.10 | 19 | `>=4.8.2 <5.0`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.11.4 \|\| ~0.12.0 \|\| ~0.13.0`: unmet | `^14.20.0 \|\| ^16.13.0 \|\| >=18.10.0`: met | `^14.20.0 \|\| ^16.13.0 \|\| >=18.10.0`: met |
| 16 | 16.2.12 | 30 | `>=4.9.3 <5.2`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.13.0`: unmet | `^16.14.0 \|\| >=18.10.0`: met | `^16.14.0 \|\| >=18.10.0`: met |
| 17 | 17.3.12 | 15 | `>=5.2 <5.5`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.14.0`: unmet | `^18.13.0 \|\| >=20.9.0`: met | `^18.13.0 \|\| >=20.9.0`: met |
| 18 | 18.2.14 | 24 | `>=5.4 <5.6`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.14.10`: unmet | `^18.19.1 \|\| ^20.11.1 \|\| >=22.0.0`: met | `^18.19.1 \|\| ^20.11.1 \|\| >=22.0.0`: met |
| 19 | 19.2.25 | 17 | `>=5.5 <5.9`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.15.0`: unmet | `^18.19.1 \|\| ^20.11.1 \|\| >=22.0.0`: met | `^18.19.1 \|\| ^20.11.1 \|\| >=22.0.0`: met |
| 20 | 20.3.33 | 27 | `>=5.8 <6.0`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.15.0`: unmet | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`: met | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`: met |
| 21 | 21.2.25 | 21 | `>=5.9 <6.1`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.15.0 \|\| ~0.16.0`: unmet | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`: met | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`: met |
| 22 | 22.2.1 | 36 | `>=6.0 <6.1`: unmet | `^6.5.3 \|\| ^7.4.0`: met | `~0.15.0 \|\| ~0.16.0`: unmet | `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`: unmet | `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`: unmet |

The Node.js requirement of Angular 22 is unmet only because the snapshot uses Node.js 20.19.0 as a fixed input.

## Library versions per hop

"keep" means the version going into the hop already accepts it; a version in bold is the change the plan
recommends for that hop; "no" means no compatible release was found, detailed in the next section.

| Library | Installed | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@angular-builders/custom-webpack` | 10.0.1 | no | no | **14.1.0** | **15.0.0** | **16.0.1** | **17.0.2** | **18.0.0** | **19.0.1** | **20.0.0** | **21.1.0** | **22.0.1** |
| `@angular-eslint/template-parser` | 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 | keep 1.1.0 |
| `@angular/cdk` | 11.0.3 | keep 11.0.3 | **13.3.9** | keep 13.3.9 | **15.2.9** | keep 15.2.9 | **17.3.10** | keep 17.3.10 | **19.2.19** | keep 19.2.19 | **21.2.14** | keep 21.2.14 |
| `@datorama/akita-ng-entity-service` | 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 | keep 5.1.1 |
| `@datorama/akita-ng-router-store` | 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 | keep 5.1.9 |
| `@datorama/akita-ngdevtools` | 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 | keep 5.0.3 |
| `@ngneat/content-loader` | 6.0.0 | no | **7.0.0** | keep 7.0.0 | keep 7.0.0 | keep 7.0.0 | keep 7.0.0 | keep 7.0.0 | keep 7.0.0 | keep 7.0.0 | keep 7.0.0 | keep 7.0.0 |
| `@ngneat/until-destroy` | 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 | keep 8.0.3 |
| `@sentry/angular` | 5.29.2 | **7.120.4** | keep 7.120.4 | keep 7.120.4 | keep 7.120.4 | **11.3.0** | keep 11.3.0 | keep 11.3.0 | keep 11.3.0 | keep 11.3.0 | keep 11.3.0 | keep 11.3.0 |
| `@storybook/angular` | 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 | keep 6.1.11 |
| `codelyzer` | 6.0.1 | **6.0.2** | no | no | no | no | no | no | no | no | no | no |
| `ng-zorro-antd` | 11.0.0 | **12.1.1** | **13.4.0** | **14.3.0** | **15.1.1** | **16.2.2** | **17.4.1** | **18.2.1** | **19.3.1** | **20.4.4** | **21.3.3** | **22.1.1** |
| `ngx-quill` | 13.0.1 | **15.0.0** | keep 15.0.0 | **20.0.1** | keep 20.0.1 | **23.0.3** | **25.3.3** | **26.0.10** | **27.1.2** | **28.0.2** | **30.1.3** | **31.0.1** |

The peer ranges that decided the compatible results, read from the recordings:

| Release | @angular peer ranges as recorded |
| --- | --- |
| `@angular-builders/custom-webpack` 14.1.0 | `@angular/compiler-cli` `^14.0.0` |
| `@angular-builders/custom-webpack` 15.0.0 | `@angular/compiler-cli` `^15.0.0` |
| `@angular-builders/custom-webpack` 16.0.1 | `@angular/compiler-cli` `^16.0.0` |
| `@angular-builders/custom-webpack` 17.0.2 | `@angular/compiler-cli` `^17.0.0` |
| `@angular-builders/custom-webpack` 18.0.0 | `@angular/compiler-cli` `^18.0.0` |
| `@angular-builders/custom-webpack` 19.0.1 | `@angular/compiler-cli` `^19.0.0` |
| `@angular-builders/custom-webpack` 20.0.0 | `@angular/compiler-cli` `^20.0.0` |
| `@angular-builders/custom-webpack` 21.1.0 | `@angular/compiler-cli` `^21.0.0` |
| `@angular-builders/custom-webpack` 22.0.1 | `@angular/compiler-cli` `^22.0.0` |
| `@angular-eslint/template-parser` 1.1.0 | `@angular/compiler` `*` |
| `@angular/cdk` 11.0.3 | `@angular/common` `^11.0.0 \|\| ^12.0.0-0`, `@angular/core` `^11.0.0 \|\| ^12.0.0-0` |
| `@angular/cdk` 13.3.9 | `@angular/common` `^13.0.0 \|\| ^14.0.0-0`, `@angular/core` `^13.0.0 \|\| ^14.0.0-0` |
| `@angular/cdk` 15.2.9 | `@angular/common` `^15.0.0 \|\| ^16.0.0`, `@angular/core` `^15.0.0 \|\| ^16.0.0` |
| `@angular/cdk` 17.3.10 | `@angular/common` `^17.0.0 \|\| ^18.0.0`, `@angular/core` `^17.0.0 \|\| ^18.0.0` |
| `@angular/cdk` 19.2.19 | `@angular/common` `^19.0.0 \|\| ^20.0.0`, `@angular/core` `^19.0.0 \|\| ^20.0.0` |
| `@angular/cdk` 21.2.14 | `@angular/common` `^21.0.0 \|\| ^22.0.0`, `@angular/core` `^21.0.0 \|\| ^22.0.0`, `@angular/platform-browser` `^21.0.0 \|\| ^22.0.0` |
| `@datorama/akita-ng-entity-service` 5.1.1 | `@angular/core` `>= 8.0.0` |
| `@datorama/akita-ng-router-store` 5.1.9 | `@angular/common` `>= 8.0.0`, `@angular/core` `>= 8.0.0`, `@angular/router` `>= 8.0.0` |
| `@datorama/akita-ngdevtools` 5.0.3 | `@angular/core` `>= 8.0.0` |
| `@ngneat/content-loader` 7.0.0 | `@angular/core` `>= 13.0.0` |
| `@ngneat/until-destroy` 8.0.3 | `@angular/core` `>=10.0.5` |
| `@sentry/angular` 11.3.0 | `@angular/common` `>= 14.x <= 22.x`, `@angular/core` `>= 14.x <= 22.x`, `@angular/router` `>= 14.x <= 22.x` |
| `@sentry/angular` 7.120.4 | `@angular/common` `>= 10.x <= 15.x`, `@angular/core` `>= 10.x <= 15.x`, `@angular/router` `>= 10.x <= 15.x` |
| `@storybook/angular` 6.1.11 | `@angular/common` `>=6.0.0`, `@angular/compiler` `>=6.0.0`, `@angular/compiler-cli` `>=6.0.0`, `@angular/core` `>=6.0.0`, `@angular/forms` `>=6.0.0`, `@angular/platform-browser` `>=6.0.0`, `@angular/platform-browser-dynamic` `>=6.0.0` |
| `codelyzer` 6.0.2 | `@angular/compiler` `>=2.3.1 <13.0.0 \|\| ^12.0.0-next \|\| ^12.1.0-next \|\| ^12.2.0-next`, `@angular/core` `>=2.3.1 <13.0.0 \|\| ^12.0.0-next \|\| ^12.1.0-next \|\| ^12.2.0-next` |
| `ng-zorro-antd` 12.1.1 | `@angular/animations` `^12.1.0`, `@angular/common` `^12.1.0`, `@angular/core` `^12.1.0`, `@angular/forms` `^12.1.0`, `@angular/platform-browser` `^12.1.0`, `@angular/router` `^12.1.0` |
| `ng-zorro-antd` 13.4.0 | `@angular/animations` `^13.0.1`, `@angular/common` `^13.0.1`, `@angular/core` `^13.0.1`, `@angular/forms` `^13.0.1`, `@angular/platform-browser` `^13.0.1`, `@angular/router` `^13.0.1` |
| `ng-zorro-antd` 14.3.0 | `@angular/animations` `^14.1.0`, `@angular/common` `^14.1.0`, `@angular/core` `^14.1.0`, `@angular/forms` `^14.1.0`, `@angular/platform-browser` `^14.1.0`, `@angular/router` `^14.1.0` |
| `ng-zorro-antd` 15.1.1 | `@angular/animations` `^15.0.1`, `@angular/common` `^15.0.1`, `@angular/core` `^15.0.1`, `@angular/forms` `^15.0.1`, `@angular/platform-browser` `^15.0.1`, `@angular/router` `^15.0.1` |
| `ng-zorro-antd` 16.2.2 | `@angular/animations` `^16.0.0`, `@angular/common` `^16.0.0`, `@angular/core` `^16.0.0`, `@angular/forms` `^16.0.0`, `@angular/platform-browser` `^16.0.0`, `@angular/router` `^16.0.0` |
| `ng-zorro-antd` 17.4.1 | `@angular/animations` `^17.0.0`, `@angular/common` `^17.0.0`, `@angular/core` `^17.0.0`, `@angular/forms` `^17.0.0`, `@angular/platform-browser` `^17.0.0`, `@angular/router` `^17.0.0` |
| `ng-zorro-antd` 18.2.1 | `@angular/animations` `^18.0.0`, `@angular/common` `^18.0.0`, `@angular/core` `^18.0.0`, `@angular/forms` `^18.0.0`, `@angular/platform-browser` `^18.0.0`, `@angular/router` `^18.0.0` |
| `ng-zorro-antd` 19.3.1 | `@angular/animations` `^19.0.0`, `@angular/common` `^19.0.0`, `@angular/core` `^19.0.0`, `@angular/forms` `^19.0.0`, `@angular/platform-browser` `^19.0.0`, `@angular/router` `^19.0.0` |
| `ng-zorro-antd` 20.4.4 | `@angular/animations` `^20.0.0`, `@angular/common` `^20.0.0`, `@angular/core` `^20.0.0`, `@angular/forms` `^20.0.0`, `@angular/platform-browser` `^20.0.0`, `@angular/router` `^20.0.0` |
| `ng-zorro-antd` 21.3.3 | `@angular/common` `^21.0.0`, `@angular/core` `^21.0.0`, `@angular/forms` `^21.0.0`, `@angular/platform-browser` `^21.0.0`, `@angular/router` `^21.0.0` |
| `ng-zorro-antd` 22.1.1 | `@angular/common` `^22.0.0`, `@angular/core` `^22.0.0`, `@angular/forms` `^22.0.0`, `@angular/platform-browser` `^22.0.0`, `@angular/router` `^22.0.0` |
| `ngx-quill` 15.0.0 | `@angular/common` `^11.0.0 \|\| ^12.0.0 \|\| ^13.0.0`, `@angular/core` `^11.0.0 \|\| ^12.0.0 \|\| ^13.0.0`, `@angular/forms` `^11.0.0 \|\| ^12.0.0 \|\| ^13.0.0`, `@angular/platform-browser` `^11.0.0 \|\| ^12.0.0 \|\| ^13.0.0` |
| `ngx-quill` 20.0.1 | `@angular/core` `^14.0.0 \|\| ^15.0.0` |
| `ngx-quill` 23.0.3 | `@angular/core` `^16.0.0` |
| `ngx-quill` 25.3.3 | `@angular/core` `^17.0.0` |
| `ngx-quill` 26.0.10 | `@angular/core` `^18.0.0` |
| `ngx-quill` 27.1.2 | `@angular/core` `^19.0.0` |
| `ngx-quill` 28.0.2 | `@angular/core` `^20.0.0` |
| `ngx-quill` 30.1.3 | `@angular/core` `^21.0.0` |
| `ngx-quill` 31.0.1 | `@angular/core` `^22.0.0` |

## Results without a compatible release, checked by reading the records

| Library | Hops | Plan | What the records show |
| --- | --- | --- | --- |
| `@angular-builders/custom-webpack` | 12, 13 | unknown | Every stable release up to 13.1.0 (46 of them) declares no `@angular/*` peer. Peers start at 14.0.0 with `@angular/compiler-cli` `^14.0.0`, and every later major declares `^N.0.0` for its own major. So no release with peers accepts Angular 12 or 13, but the older releases without peers may. Unknown is correct. |
| `@ngneat/content-loader` | 12 | unknown | Releases 4.0.0 to 6.1.0 declare no peers; 7.0.0, the only release with peers, declares `@angular/core` `>= 13.0.0`. Unknown is correct for 12, and 7.0.0 is chosen for 13. |
| `codelyzer` | 13 to 22 | blocker | Every stable release from 2.0.0 to 6.0.2 caps `@angular/core` below 13: 6.0.2, the newest, declares `>=2.3.1 <13.0.0 \|\| ^12.0.0-next \|\| ^12.1.0-next \|\| ^12.2.0-next`. The 20 releases without peers are 0.0.x builds older than all of them. A blocker is correct. For hop 12 the installed 6.0.1 (`>=2.3.1 <12.0.0 \|\| ^11.0.0-next ...`) does not accept 12.2.17, so 6.0.2 is chosen. |

## Discrepancies

| Found | Status |
| --- | --- |
| Before the fix, `@angular-builders/custom-webpack` (hops 12 and 13) and `@ngneat/content-loader` (hop 12) were reported as blockers ("no release accepts Angular 12"). Their older releases declare no `@angular/*` peers, and custom-webpack 12.x and 13.x are the releases made for those majors. | Fixed. A library is now a blocker only if no unchecked release could fill the gap: when releases without peers are older than a release that requires a newer Angular, the result is unknown and says why. Regression tests in `test/plan/compat.test.ts`. The same fix turned `angular-cli-ghpages` in the ng-matero fixture (hops 14 to 17) from a blocker into unknown, for the same reason. |
| `@storybook/angular` 6.1.11 is kept up to Angular 22 because every `@angular/*` peer it declares is `>=6.0.0`. The same applies to the `@datorama/akita-*` packages (`>= 8.0.0`) and `@ngneat/until-destroy` 8.0.3 (`>=10.0.5`). Storybook 6.1 almost certainly does not work with Angular 22. | Known limitation: open peer ranges are taken as published. |
| `@angular-eslint/template-parser` 1.1.0 declares `@angular/compiler` `*`, so it is kept up to Angular 22. The 98 newer stable releases from 12.6.0 onwards declare no `@angular/*` peer and cannot be checked. | Known limitation. The plan lists it under "could not be verified" for every hop. |
| `@angular/cdk` is kept on every other hop, because each cdk release accepts two Angular majors (for example 17.3.10 declares `^17.0.0 \|\| ^18.0.0`). The maintainers moved it with every major. | By design: a library that accepts the hop is kept. Both choices satisfy the published peers. |

## Comparison with the maintainers' upgrade

The project later upgraded itself to Angular 20 one major at a time. Its committed `package.json` at the end of each
major, against the plan for the same hop:

| Angular | Commit | `ng-zorro-antd` | `@angular-builders/custom-webpack` | `ngx-quill` | `@angular/cdk` | typescript, zone.js |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | 5efc8b5 | 16.2.2, plan 16.2.2 | 16.0.0, plan 16.0.1 | 22.1.1, plan 23.0.3 | 16.2.14, plan keeps 15.2.9 | 5.1.6 and `~0.13.3`, inside the plan's `>=4.9.3 <5.2` and `~0.13.0` |
| 17 | 027b803 | 17.4.1, plan 17.4.1 | 17.0.2, plan 17.0.2 | 24.0.5, plan 25.3.3 | 17.3.10, plan 17.3.10 | 5.4.5 and `~0.14.10`, inside `>=5.2 <5.5` and `~0.14.0` |
| 18 | d1d7850 | 18.2.1, plan 18.2.1 | 18.0.0, plan 18.0.0 | 26.0.10, plan 26.0.10 | 18.2.14, plan keeps 17.3.10 | 5.4.5 and `~0.14.10`, inside `>=5.4 <5.6` and `~0.14.10` |
| 19 | c4db81b | 19.3.1, plan 19.3.1 | 19.0.1, plan 19.0.1 | 27.1.2, plan 27.1.2 | 19.2.19, plan 19.2.19 | 5.8.3 and `~0.15.1`, inside `>=5.5 <5.9` and `~0.15.0` |
| 20 | 33619d0 | 20.4.4, plan 20.4.4 | 20.0.0, plan 20.0.0 | 28.0.2, plan 28.0.2 | 20.2.14, plan keeps 19.2.19 | 5.8.3 and `~0.15.1`, inside `>=5.8 <6.0` and `~0.15.0` |

Where the versions differ, both declare the same peer range for that major (custom-webpack 16.0.0 and 16.0.1:
`^16.0.0`; ngx-quill 22.1.1 and 23.0.3: `^16.0.0`; 24.0.5 and 25.3.3: `^17.0.0`), and the plan picks the newest.
The maintainers kept `codelyzer` `^6.0.0` through Angular 20, which the plan reports as a blocker; their
update commits ran `ng update ... --force`, which skips the peer check that codelyzer fails.

## What could not be verified

- Whether the app installs, builds and passes its tests after each hop.
- Whether the libraries kept on open peer ranges (`@storybook/angular`, `@datorama/akita-*`,
  `@ngneat/until-destroy`, `@angular-eslint/template-parser`) really work with the newer Angular releases.
- Which `@angular-builders/custom-webpack` release fits Angular 12 and 13: the records cannot tell, so the plan
  says unknown.
- Registry changes after the recording date, 2026-10-02.
- The effort estimate (556 points, XL), which is a heuristic.
