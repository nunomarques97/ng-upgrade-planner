# Contributing

Thanks for helping. Bug reports with a `package.json` and lockfile that produce a wrong plan are especially
useful: say which hop and library is wrong and what the registry shows for it.

## Setup

You need Node.js 20 or 22 (CI runs both) and npm.

```sh
git clone https://github.com/nunomarques97/ng-upgrade-planner.git
cd ng-upgrade-planner
npm ci
git config core.hooksPath .githooks
```

The last command turns on the pre-commit secret guard (see below). Run the CLI from source with
`npm run build` and then `node dist/cli.js --cwd path/to/an/angular-app`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run lint` | ESLint on sources, tests and scripts |
| `npm run check:docs` | Required docs exist, `docs/STATE.md` front-matter is complete, `docs/WALKTHROUGH.md` stays under 1100 words, no em-dash in `src`, `docs`, README, CONTRIBUTING or CHANGELOG |
| `npm run typecheck` | TypeScript in strict mode, sources and tests |
| `npm test` | Vitest, including the fixture snapshot tests |
| `npm run build` | Cleans `dist/` and compiles `src/` to `dist/` |
| `npm run check:pack` | Runs `npm pack --dry-run` and fails unless the package holds only `package.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, compiled `dist/` files and the Markdown files of the Agent Skill in `skills/angular-upgrade-hops/` (`SKILL.md` required), and `dist/cli.js` has its shebang (build first) |
| `npm run ci` | All of the above in the same order as GitHub Actions |
| `npm run bench:warm` | Plans every fixture offline with the built CLI and the removed-API scan on. Each fixture's `package.json` and lockfile are copied to a temporary project with 361 generated source files (components, templates, services and `angular.json`, some using removed APIs). Fails if a run fails, scans fewer files than generated or takes 30 s or more (build first) |
| `npm run record:fixtures` | Records registry data for the fixtures (uses the network; see below) |

Before opening a pull request, run `npm run ci`. It must pass on Node.js 20 and 22.

## Tests never use the network

`test/setup.ts` installs a guard that fails any test that tries to reach the network. Registry data comes from
recordings in `test/fixtures/registry`, which use the same trimmed format as the runtime cache, or from records
built in the test itself. Unit test inputs such as small lockfiles are written inline in the test code.

## Fixtures

`test/fixtures/apps` holds real open-source Angular apps. The rules:

- Copy only `package.json` and one lockfile, unchanged. No source code, no other files.
- Use only apps under a licence that allows it, and add a `SOURCE.md` next to them with the repository, the
  commit, the files copied, the licence with a link, the copyright line and the retrieval date. Include the
  NOTICE text when the licence asks for it.
- After adding or changing an app, record its registry data and review the updated snapshots.

`test/fixtures/synthetic/scan` holds source files written for this repository to test the removed-API scan.
They are labelled synthetic and must never be copied from an application. Keep them in that folder, apart from
the app fixtures.

## Removed-API data

`src/data/removed-apis.ts` lists the Angular APIs the scan looks for. Every entry must cite an official Angular
source (the Angular, Angular CLI or angular/components CHANGELOG, or the angular.dev update guide or
deprecations guide; Angular Material and CDK entries are in `src/data/components-apis.ts`) and say
whether the official `ng update` migration fixes it; a test rejects entries without one. A change that a source
scan cannot detect goes into `REMOVED_API_EXCLUDED` with the reason instead.

## Recording registry data

```sh
npm run record:fixtures
```

This is the only script that contacts the npm registry, and tests never run it. It replaces every file in
`test/fixtures/registry`, trims each record to what the planner reads, and checks that every fixture plan is the
same with the full and the trimmed data. After recording, update the snapshots with `npx vitest run -u`, read the
diff of `test/__snapshots__/fixtures`, and explain the changes in the pull request.

## Scan precision on real apps

`scripts/real-apps.json` lists open-source Angular apps, each with its GitHub repository, a full pinned commit,
a permissive licence (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause or ISC) with a link, the folder of the app,
the lockfile kind and the installed Angular version. Two scripts measure the scan on them:

```sh
node scripts/fetch-real-apps.mjs              # uses the network: public github.com only
npm run build
node scripts/scan-real-apps.mjs --check
```

- `fetch-real-apps.mjs` fetches each pinned commit with git into `.cache/real-apps/<id>`, which is git-ignored,
  and skips apps already fetched at that commit. It checks every manifest value against a strict pattern, runs
  git without a shell, credentials, hooks or outside configuration, and never installs or runs anything from
  the apps. `--only <id>` fetches one app.
- `scan-real-apps.mjs` runs the built scan on every cached app, after checking the commit, lockfile kind and
  Angular version against the manifest. Without a flag it updates `docs/verification/scan-precision.json`,
  keeping the labels of unchanged findings and marking new ones `unlabelled`, and regenerates
  `docs/verification/scan-precision.md`. Label each new finding `tp` or `fp` with a one-sentence reason, then
  run it with `--render` to regenerate the Markdown. `--check` fails when the findings or the Markdown differ
  from the JSON, when a fixed false positive is found again, or when the cache is missing.

Every false positive is either fixed or kept. To fix one, change `src/scan` or `src/data`, add a minimal
synthetic case under `test/fixtures/synthetic/scan` with a test that the finding is gone and that a nearby real
use is still found, then move the finding from `findings` to `fixed` in the JSON with `fix` (the change) and
`test` (the test and synthetic file). To keep one, give it a `notFixed` reason. The report shows precision before
and after the fixes.

Never commit application source: the JSON holds only paths, line numbers, entry ids, API names and labels. A
test checks the manifest, the labels and the numbers in the Markdown offline, without the cache.

The README quotes the precision between `<!-- precision:start -->` and `<!-- precision:end -->`, and
`test/readme.test.ts` fails when that block differs from the JSON. After a new measurement, or a version bump
(the JSON records the version, and `--check` compares it), run `scan-real-apps.mjs` and copy the numbers into
that block in the format the test expects.

## Update guide data

`src/data/update-steps.ts` is a generated copy of the Angular update guide data from
[angular/angular](https://github.com/angular/angular) (`adev/src/app/features/update/recommendations.ts`,
MIT licence, Copyright Google LLC). Do not edit it by hand. Refresh it with:

```sh
node scripts/update-steps.mjs
```

The script reads the upstream file with the TypeScript compiler API without running it, and records the
commit, its date and the licence in the generated file. Keep that attribution.

## Secret guard

`scripts/guard-keys.mjs` blocks commits that contain credential files or key-shaped strings. With
`git config core.hooksPath .githooks` it runs on every commit. To scan the whole working tree:

```sh
node scripts/guard-keys.mjs --all
```

Never commit `.env` files, keys or any file whose name contains `token` or `secret`; `.gitignore` excludes them,
so do not give source files such names either. A line with a deliberately fake key-shaped value can end with
the comment `guard-allow-secret`.

## Style

- Plain English in code, comments, CLI messages and docs. No em-dashes.
- TypeScript in strict mode. Match the style of the surrounding code.
- Tests for every behaviour change, including the failure cases.
- Add a line to the "Unreleased" section of `CHANGELOG.md` for user-visible changes.

## Publishing

`npm publish` is blocked by a `prepublishOnly` script. Releases are made by the maintainer.
