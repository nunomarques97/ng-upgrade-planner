# Walkthrough

How ng-upgrade-planner works, the decisions behind it, what was rejected and what it costs.

## Architecture

A single Node.js CLI in strict TypeScript, compiled to `dist/` and run with `npx`. Three runtime dependencies:
`semver`, `yaml` and `@yarnpkg/lockfile`. Data flows in one direction through four layers:

1. **Project** (`src/project`). Reads the root `package.json` and one lockfile (npm, pnpm, yarn classic or
   berry) and returns the installed version of every direct dependency. When the lockfile lacks a package, the
   version is guessed from the `package.json` range and marked unverified.
2. **Registry** (`src/registry`). Fetches package documents from the npm registry, trims each one to what the
   planner reads (versions, `@angular/*` peers, deprecation, a few framework ranges) and stores it as one JSON
   file per package in the user cache directory. At most four requests run at once; 429 and 5xx responses are
   retried with exponential backoff and `Retry-After`. Records are fresh for 24 hours; offline mode uses any
   cached record, and a failed refresh falls back to the stale record and says so.
3. **Plan** (`src/plan`). Pure functions over the project and the records:
   - the path: one hop per major, from the installed `@angular/core` to the target, each hop aimed at the
     newest stable release of that major;
   - the official steps for each hop, from a bundled copy of the Angular update guide data;
   - the framework requirements (TypeScript, RxJS, zone.js, Node.js) declared by that release;
   - the library matrix: for every direct dependency with `@angular/*` peers, whether the installed version
     accepts the hop, the newest release that does, or why none does;
   - an effort estimate from weighted counts.
   Every value is a `Fact` that carries its evidence, or is explicitly unverified with a reason.
4. **Report** (`src/report`). One shared model feeds three renderers: the terminal summary, Markdown and a
   single-file HTML page. Each renderer escapes for its own format.

The CLI (`src/cli.ts`) only parses options, wires the layers together and maps errors to exit codes.

## Decisions

**Compatibility comes only from `@angular/*` peer ranges.** They are the one machine-readable statement a
library makes about which Angular it supports. Each range is tested with npm's own `semver` library against
the newest stable release of each peer in the hop's major, so results match what npm would accept. A library
moves only when it must: an installed version that accepts the hop is kept, unless another library chosen for
the same hop requires a newer one.

**Unknown is a first-class result.** Many libraries declared no peers in older releases, or declare peers the
data cannot check. Such cases are "unknown", never "compatible", and every report ends with a list of what was
confirmed by evidence and what could not be verified. A wrong "compatible" costs a user far more than an honest
"check this by hand".

**Blockers are strict.** A library is a blocker only when no stable release accepts the hop and no release
without peer data could be the missing one. Otherwise it is unknown.

**Bundled update guide data.** The steps come from the data file behind angular.dev/update-guide, copied with
its commit, date and MIT attribution by `scripts/update-steps.mjs`, which parses the upstream TypeScript
without running it. Each step appears once, in the hop where it becomes necessary. Hops beyond the copy say that
no steps are available.

**All outside text is untrusted.** Registry metadata, lockfiles and step text can contain anything. Parsed maps
are rebuilt from own properties on null-prototype objects, cache file names are encoded safely for every OS,
terminal output strips control and bidirectional characters, and the HTML report has no scripts, a strict
Content Security Policy and escapes every string. No credentials are read or sent, so `.npmrc` tokens never
leave the machine.

**Tests never touch the network.** A guard fails any test that tries. Five real open-source apps (only their
`package.json` and lockfile, with source and licence noted) are planned against recorded registry data in the
same trimmed format as the cache, and their plans are compared with committed snapshots. Two of those plans were
recomputed independently and checked by hand (`docs/verification`).

**Release hygiene is checked by scripts.** `check:pack` inspects the `npm pack` file list, `check:docs` guards
the documents, and `prepublishOnly` refuses to publish without explicit approval.

## Rejected alternatives

- **Running `ng update` in a scratch copy for each hop.** It would give real migration results, but it needs a
  full install per hop, takes minutes, executes third-party code and still checks only one step at a time.
- **Scraping angular.dev/update-guide at run time.** The page is rendered by JavaScript and changes without
  notice. A versioned copy of its data file is reproducible and works offline.
- **A compatibility database maintained by hand.** It would go stale quickly and could not be traced back to
  evidence. Published peer ranges can be checked by anyone with `npm view`.
- **Writing a custom semver or lockfile parser.** The core decision is a range test, so it uses npm's own range
  implementation and standard parsers instead.
- **Node's built-in test runner.** It has no snapshot support on Node.js 20; Vitest provides snapshots and
  TypeScript support as a development dependency only.
- **Reading `.npmrc` for private registries.** It means handling credentials. In this version private packages
  are reported as not verified instead.
- **Workspace traversal.** Monorepos with several Angular apps exist, but they add many edge cases. This version
  reads the root `package.json` only.

## Trade-offs

- **Peer ranges can be wrong.** Open ranges such as `>=6` or `*` accept every future Angular, so some
  "compatible" results are optimistic. The evidence column shows the exact range so a reader can judge.
- **Only `@angular/*` peers are cross-checked.** Peers on `rxjs`, `@ngrx/*` or `@angular-devkit/*` between
  libraries are not, which keeps the model simple but can miss a conflict.
- **Effort is a heuristic.** Points are deterministic and explained per hop, but not calibrated against real
  upgrades.
- **Registry metadata only.** Nothing is installed or compiled, which makes a plan take well under a second with
  a warm cache, but it cannot see code that uses removed APIs. That scan is planned for v0.2.
- **The update guide copy ages.** New Angular majors need a refresh of the bundled data and a new release.
