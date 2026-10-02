# ng-upgrade-planner

Plan an Angular upgrade hop by hop. Run it inside an Angular project and it prints the whole path from the
installed major version to the target (for example 14 to 22). For each hop it lists:

- the official update steps from the Angular update guide;
- the newest compatible version of every library in the project that declares `@angular/*` peer dependencies;
- blockers: libraries with no release that accepts the hop's Angular version;
- the framework requirements (TypeScript, RxJS, zone.js, Node.js) and whether the installed versions meet them;
- an effort estimate.

`ng update` moves one major version at a time and only checks peer dependencies for that step. This tool looks
at every hop up front, so you can see which libraries will hold you back before you start.

## Quick start

You need Node.js 20 or newer. Nothing is installed globally.

```sh
cd my-angular-app
npx ng-upgrade-planner
```

The package is not published to npm yet. Until it is, run it from a clone of this repository:

```sh
npm ci
npm run build
node dist/cli.js --cwd path/to/my-angular-app
```

The tool reads `package.json` and the lockfile (`package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml` or
`yarn.lock`, both yarn classic and yarn berry). It prints a summary in the terminal and writes two reports to the
project folder:

- `ng-upgrade-plan.md`: the full plan in Markdown;
- `ng-upgrade-plan.html`: the same plan as a single HTML file with no external resources.

### Options

| Option | Meaning |
| --- | --- |
| `--cwd <dir>` | Project folder (default: the current folder) |
| `--to <major>` | Target Angular major version, for example `18` (default: the latest release) |
| `--offline` | Use only the local registry cache; never contact the registry |
| `--registry <url>` | npm registry URL (default: `https://registry.npmjs.org`) |
| `--cache-dir <dir>` | Registry cache folder (default: a folder in your user cache directory) |
| `--out-dir <dir>` | Folder for the two reports (default: the project folder) |
| `--no-report` | Print the summary only; write no report files |
| `-h`, `--help` | Show the help |
| `-v`, `--version` | Show the version |

Exit codes: `0` when a plan was printed (also when it has blockers), `1` for a project or planning error, `2` for
a usage error.

### Registry access and the cache

The tool downloads package metadata from the public npm registry, at most four requests at a time, and retries
politely on rate limits and server errors (it honours `Retry-After`). Records are cached for 24 hours in your user
cache directory: `%LOCALAPPDATA%\ng-upgrade-planner\Cache\registry` on Windows,
`~/Library/Caches/ng-upgrade-planner/registry` on macOS and `$XDG_CACHE_HOME/ng-upgrade-planner/registry` (or
`~/.cache/...`) elsewhere. With `--offline` it works from the cache alone, whatever the age of the records. If
the registry cannot be reached, an older cached record is used and the report says so.

It sends no credentials and never reads `.npmrc`, so private packages show up as "could not be verified".

## Example

This is the start of the plan for an open-source app on Angular 11
([jira-clone-angular](https://github.com/trungvose/jira-clone-angular), one of the test fixtures), targeting
Angular 22. Terminal summary:

```text
Angular upgrade plan for jira-clone-angular-frontend
Current: Angular 11.0.5
Target:  Angular 22 (22.2.1)
Total effort: XL (556 points) over 11 hops, 10 blockers

Hop 1: Angular 11 to 12 (12.2.17), effort M (36 points)
  Steps: 17 (4 basic, 4 medium, 9 advanced)
  Library updates: 4
    @sentry/angular 5.29.2 to 7.120.4, major
    codelyzer 6.0.1 to 6.0.2, patch
    ng-zorro-antd 11.0.0 to 12.1.1, major
    ngx-quill 13.0.1 to 15.0.0, major
  Blockers: 0
  Could not decide: @angular-builders/custom-webpack, @ngneat/content-loader
  Framework requirements:
    typescript must satisfy ">=4.2.3 <4.4" (@angular/compiler-cli@12.2.17 peerDependencies); 4.0.3 is installed
    zone.js must satisfy "~0.11.4" (@angular/core@12.2.17 peerDependencies); 0.10.3 is installed

Hop 2: Angular 12 to 13 (13.4.0), effort M (39 points)
  Steps: 13 (3 basic, 5 medium, 5 advanced)
  Library updates: 3
    @angular/cdk 11.0.3 to 13.3.9, major
    @ngneat/content-loader 6.0.0 to 7.0.0, major
    ng-zorro-antd 12.1.1 to 13.4.0, major
  Blockers: 1
    codelyzer: No release accepts Angular 13; the newest, 6.0.2, requires @angular/compiler ">=2.3.1 <13.0.0 || ^12.0.0-next || ^12.1.0-next || ^12.2.0-next", @angular/core ">=2.3.1 <13.0.0 || ^12.0.0-next || ^12.1.0-next || ^12.2.0-next".
  Could not decide: @angular-builders/custom-webpack
```

An excerpt of the Markdown report for the same plan (`...` marks skipped parts):

<!-- example:start -->
````md
| Item | Value |
| --- | --- |
| Current Angular | 11.0.5 |
| Target Angular | 22 (22.2.1) |
| Hops | 11 |
| Total effort | XL (556 points) |
| Lockfile | `package-lock.json` (npm) |

## Summary

| Hop | Steps | Library updates | Blockers | Unknown | Requirement warnings | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Angular 11 to 12 | 17 | 4 | 0 | 2 | 2 | M (36 points) |
| 2. Angular 12 to 13 | 13 | 3 | 1 | 1 | 2 | M (39 points) |
| 3. Angular 13 to 14 | 17 | 3 | 1 | 0 | 2 | L (43 points) |
...

## Hop 1: Angular 11 to 12

Target release: 12.2.17. Effort: **M (36 points)**.
...

### Libraries

| Library | Current | Newest compatible | Peer range evidence | Status |
| --- | --- | --- | --- | --- |
| `@angular-builders/custom-webpack` | 10.0.1 | none (unverified) | 14.0.0: `@angular/compiler-cli` `^14.0.0`: rejects 12.2.17 | unknown |
| `@angular/cdk` | 11.0.3 | 12.2.13 | 11.0.3: `@angular/common` `^11.0.0 \|\| ^12.0.0-0`: accepts 12.2.17<br>`@angular/core` `^11.0.0 \|\| ^12.0.0-0`: accepts 12.2.17 | no change needed |
| `ng-zorro-antd` | 11.0.0 | 12.1.1 | 12.1.1: `@angular/animations` `^12.1.0`: accepts 12.2.17<br>`@angular/common` `^12.1.0`: accepts 12.2.17<br>`@angular/core` `^12.1.0`: accepts 12.2.17<br>`@angular/forms` `^12.1.0`: accepts 12.2.17<br>`@angular/platform-browser` `^12.1.0`: accepts 12.2.17<br>`@angular/router` `^12.1.0`: accepts 12.2.17 | update (major) |
...

### Could not be decided

- `@angular-builders/custom-webpack`: No release with @angular peers accepts Angular 12, but 46 releases older than 14.0.0 declare no @angular peer dependency and may support it; 14.0.0 requires @angular/compiler-cli "^14.0.0".
...

### Framework requirements

| Requirement | Required range | Installed | Status | Source |
| --- | --- | --- | --- | --- |
| typescript | `>=4.2.3 <4.4` | 4.0.3 | not met (action needed) | @angular/compiler-cli@12.2.17 peerDependencies |
| rxjs | `^6.5.3 \|\| ^7.0.0` | 6.6.3 | met | @angular/core@12.2.17 peerDependencies |
| zone.js | `~0.11.4` | 0.10.3 | not met (action needed) | @angular/core@12.2.17 peerDependencies |
...

## Confirmed and unverified results

### Confirmed by evidence

- Installed Angular 11.0.5, read from the lockfile.
...

### Could not be verified

These results could not be confirmed: unknown libraries, data from an outdated cache, versions guessed from package.json ranges and anything the registry data could not decide. Check them by hand before relying on them.
````
<!-- example:end -->

## Reading the results

Every library result is one of:

- **no change needed**: the installed version already accepts the hop's Angular release;
- **update (patch, minor or major)**: the newest release whose `@angular/*` peer ranges accept the hop;
- **blocker**: no stable release accepts the hop according to its published `@angular/*` peer ranges, and no
  release without such ranges could be the missing one;
- **unknown**: the registry data cannot decide, for example because some releases declare no `@angular/*` peers.
  Unknown is never shown as compatible.

Packages the registry does not have (such as private packages) or that could not be fetched are not guessed
either: they are listed under "could not be verified".

Each report ends with two lists:

- **Confirmed by evidence**: what was read from your lockfile, the registry data and the update guide, with the
  number of library results decided from published peer ranges in each hop.
- **Could not be verified**: unknown libraries, data from an outdated cache, versions guessed from
  `package.json` ranges because the lockfile did not have them, packages without registry data, and newer
  releases that could not be checked.
  Check these by hand before relying on them.

The peer range evidence column shows the exact range each decision was based on, so any line can be checked
against `npm view <package>@<version> peerDependencies`.

## Limitations

- **Peer ranges are taken as published.** An open range such as `>=6.0.0` or `*` accepts every future Angular
  version, so a library can be reported as compatible when it is not in practice.
- **Only `@angular/*` peers decide compatibility.** Peers on other packages, such as `@angular-devkit/*`,
  `@ngrx/store` or `rxjs`, are not checked between libraries.
- **A library that already accepts a hop is kept** at its installed version, even when a newer major exists.
- **Steps are listed in the hop where they become necessary**, once, even when the update guide shows them
  earlier as optional.
- **Update steps cover Angular up to 22**, from a bundled copy of the update guide data. Later hops say that no
  steps are available instead of guessing.
- **Effort is an estimate**: a weighted count of steps, major library updates, unmet requirements and blockers.
  It has not been calibrated against real upgrades.
- **Only the root `package.json` is read.** Workspaces and monorepo packages are not traversed.
- **Nothing is installed or built.** The plan is based on registry metadata only; it does not run your build or
  your tests.
- The tool does not scan your code for removed APIs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Licence

MIT, see [LICENSE](LICENSE).

The official update steps come from the Angular update guide data
([angular/angular](https://github.com/angular/angular), `adev/src/app/features/update/recommendations.ts`),
Copyright Google LLC, used under the MIT licence (https://angular.dev/license). The bundled copy records the
upstream commit it was taken from, and every report links to it.
