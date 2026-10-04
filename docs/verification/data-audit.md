# Removed-API data audit

Every entry of the bundled removed-API data (`src/data/removed-apis.ts`), Angular 9 to 22, was read again
against its cited source, its `migrationSource` and its `references`, and given an audit record (`audit` on the
entry). The audit was done by the development agent on 2026-10-03, not by a person.

**Summary.** 105 entries read: 95 confirmed, 8 corrected, 2 removed, 0 unverified. Every cited source was
retrieved. One entry was added by the audit in place of a removed one, so the audited Angular data holds 104 entries.
The 185 Material and CDK entries added afterwards (see [Angular Material and CDK](#angular-material-and-cdk))
are counted under Added, so the dataset now holds 289 entries.

| Major | Entries read | Confirmed | Corrected | Removed | Unverified | Added |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | 6 | 6 | 0 | 0 | 0 | 1 |
| 10 | 10 | 10 | 0 | 0 | 0 | 12 |
| 11 | 8 | 8 | 0 | 0 | 0 | 12 |
| 12 | 7 | 3 | 4 | 0 | 0 | 0 |
| 13 | 16 | 16 | 0 | 0 | 0 | 10 |
| 14 | 3 | 3 | 0 | 0 | 0 | 2 |
| 15 | 3 | 3 | 0 | 0 | 0 | 0 |
| 16 | 9 | 9 | 0 | 0 | 0 | 0 |
| 17 | 3 | 3 | 0 | 0 | 0 | 44 |
| 18 | 9 | 9 | 0 | 0 | 0 | 0 |
| 19 | 5 | 5 | 0 | 0 | 0 | 10 |
| 20 | 6 | 6 | 0 | 0 | 0 | 24 |
| 21 | 6 | 4 | 1 | 1 | 0 | 63 |
| 22 | 14 | 10 | 3 | 1 | 0 | 8 |
| All | 105 | 95 | 8 | 2 | 0 | 186 |

**Corrections, removals and additions:**

- `v12-build-angular-i18n-file`, `v12-build-angular-i18n-locale`: `migration` yes to unknown and `migrationNote`
  rewritten; `v12-build-angular-i18n-format`, `v12-build-angular-extract-i18n-locale`: `migrationNote`
  rewritten (see [Angular 9 to 15](#angular-9-to-15)).
- `v21-core-ignore-changes-outside-zone`, `v22-compiler-cli-full-template-type-check`: `migration` unknown to
  no, `migrationSource` added, `migrationNote` rewritten.
- `v22-upgrade-get-angular-lib`, `v22-upgrade-set-angular-lib`: `migration` unknown to no, `migrationSource` and
  `migrationNote` added.
- Removed `v21-core-ng-module-factory`: `NgModuleFactory` is still exported by `@angular/core` 21 and 22.
  Added `v21-common-ng-component-outlet-ng-module-factory` for the change the source describes.
- Removed `v22-common-http-xhr-backend`: an import of `HttpXhrBackend` keeps working in 22.

Statuses:

- **confirmed**: the sources state what the entry says.
- **corrected**: a source contradicted the entry; only that part was changed, as stated in the note.
- **removed**: the entry was moved to `REMOVED_API_EXCLUDED` with the reason and its audit record, whose note
  starts with "Was entry" and the former id.
- **unverified**: a source could not be retrieved; the entry is kept as it was and is not called confirmed.
- **added**: written from its source by the audit in place of a removed entry, or after the audit; not counted
  as read.

A test (`test/data/removed-apis-data.test.ts`) checks that every bundled entry carries a well-formed record,
that every status other than confirmed has a note, that the table above and the per-entry tables below match
the data, and that every corrected entry is named above.

## Angular 9 to 15

53 entries read: 49 confirmed, 4 corrected, 0 removed, 0 unverified. Every cited source was retrieved.

### Sources read

Files were fetched from `raw.githubusercontent.com` at the commit or tag in the cited URL.

- **NG**: Angular CHANGELOG at commit `c0dc8c4`: `CHANGELOG_ARCHIVE.md` for 9.0.0 to 13.0.0 and `CHANGELOG.md`
  for 14.0.0 and 15.0.0, section "Breaking Changes" of each major release.
- **CLI-RN**: Angular CLI release notes v10.0.0 and v11.0.0, section "Breaking Changes". The text was read
  through the GitHub releases API (`api.github.com/repos/angular/angular-cli/releases/tags/<tag>`), which returns
  the same release body as the cited release page.
- **CLI**: Angular CLI `CHANGELOG.md` at commit `f61de66`, section "Breaking Changes" of v12.0.0, 13.0.0,
  14.0.0 and 15.0.0.
- **CORE-MIG**: `packages/core/schematics/migrations.json` at tags 9.0.0 to 15.0.0.
- **CLI-MIG**: `packages/schematics/angular/migrations/migration-collection.json` at the CLI tags v10.0.0 to
  15.0.0, and the source of each migration an entry names (for example `update-10/update-angular-config.ts`,
  `update-9/update-i18n.ts` used by `remove-deprecated-i18n-options`, `update-13/update-angular-config.ts`), to
  check what the migration changes.
- **GUIDE**: `adev/src/app/features/update/recommendations.ts` at commit `647bf8e`, the step named in the
  reference.
- **SCHEMA**: builder `schema.json` files of `@angular-devkit/build-angular` at the CLI tags of 9 to 15, to check
  that each option existed on the listed builders before the removal and was gone after it.

### Corrections

All four corrections are in Angular 12 and come from the source of the `remove-deprecated-i18n-options` migration
(`update-9/update-i18n.ts` at the CLI tag v12.0.0, functions `addProjectI18NOptions`, `addBuilderI18NOptions`,
`removeFormatOption` and `removeExtracti18nDeprecatedOptions`).

| Entry | Field | Before | After |
| --- | --- | --- | --- |
| `v12-build-angular-i18n-file` | `migration` | yes | unknown |
| `v12-build-angular-i18n-file` | `migrationNote` | remove-deprecated-i18n-options converts it to the non-deprecated options. | remove-deprecated-i18n-options deletes it and adds the project i18n locales only when the project has an extract-i18n target and a build target using the browser builder; when outputPath does not end in the locale it keeps the option and logs a warning. |
| `v12-build-angular-i18n-format` | `migrationNote` | remove-deprecated-i18n-options converts it to the non-deprecated options. | remove-deprecated-i18n-options deletes it from every browser and server configuration. |
| `v12-build-angular-i18n-locale` | `migration` | yes | unknown |
| `v12-build-angular-i18n-locale` | `migrationNote` | remove-deprecated-i18n-options converts it to the non-deprecated options. | remove-deprecated-i18n-options replaces it with localize; when outputPath does not end in the locale it keeps the option and logs a warning. |
| `v12-build-angular-extract-i18n-locale` | `migrationNote` | remove-deprecated-i18n-options converts it to the non-deprecated options. | remove-deprecated-i18n-options deletes it and copies the value to i18n.sourceLocale only when the project build target uses the browser builder and sets i18nLocale and i18nFile. |

Why `migration` changed for two entries: for each browser or server configuration that sets `i18nLocale` and
`i18nFile`, `addBuilderI18NOptions` logs "Keeping existing options for the target configuration of locale ..."
and leaves both options in place when `outputPath` does not end in a `/<locale>` segment (for example
`"outputPath": "dist/my-project-fr/"` with `"i18nLocale": "fr"`). The v12 build then rejects the options. The
migration fixes the option in some configurations and not in others, and a source scan of `angular.json` does
not decide which, so the value is `unknown`, as for other entries the migration covers only in part. The
`i18nFormat` and extract-i18n `i18nLocale` options are deleted unconditionally, so their `migration` stays `yes`.

Effect on plans: a finding of `v12-build-angular-i18n-file` or `v12-build-angular-i18n-locale` now reads "fixed
by ng update migration: unknown" and adds 3 effort points per distinct API instead of 1. `migrationNote` is not
shown in any report. No scan result changed, and no fixture snapshot or real-app precision label changed: no
finding of these two entries appears in the five fixture snapshots, the synthetic scan tests or
`docs/verification/scan-precision.json`.

### Angular 9

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v9-core-renderer` | confirmed | NG 9.0.0 (core); CORE-MIG 9 `migration-v9-renderer-to-renderer2` | |
| `v9-core-render-component-type` | confirmed | NG 9.0.0 (core) | |
| `v9-core-root-renderer` | confirmed | NG 9.0.0 (core) | |
| `v9-forms-ngform-element` | confirmed | NG 9.0.0 (forms); CORE-MIG 9 (no ngForm migration); GUIDE "ngForm selector" | |
| `v9-forms-ngform-selector-warning` | confirmed | NG 9.0.0; CORE-MIG 9 | |
| `v9-forms-forms-module-with-config` | confirmed | NG 9.0.0; CORE-MIG 9; NG 15.0.0 (forms) for the later withConfig | |

### Angular 10

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v10-core-module-with-providers-generic` | confirmed | NG 10.0.0 (core); CORE-MIG 10 `migration-v10-module-with-providers` | |
| `v10-build-angular-eval-source-map` | confirmed | CLI-RN 10 (build-angular, 8fb7e58); CLI-MIG 10 `update-angular-config`; SCHEMA 9 | |
| `v10-build-angular-vendor-source-map` | confirmed | CLI-RN 10 (8fb7e58); CLI-MIG 10 `update-angular-config`; SCHEMA 9 | When sourceMap is false the migration drops the value instead of moving it. |
| `v10-build-angular-profile` | confirmed | CLI-RN 10 (8fb7e58); CLI-MIG 10; SCHEMA 9 | |
| `v10-build-angular-skip-app-shell` | confirmed | CLI-RN 10 (8fb7e58); CLI-MIG 10; SCHEMA 9 | |
| `v10-build-angular-element-explorer` | confirmed | CLI-RN 10 (5395cec); CLI-MIG 10; SCHEMA 9 protractor | |
| `v10-build-angular-server-common-chunk` | confirmed | CLI-RN 10 (08062e9); CLI-MIG 10 (server targets) | |
| `v10-build-angular-server-vendor-chunk` | confirmed | CLI-RN 10 (08062e9); CLI-MIG 10 (server targets) | |
| `v10-build-angular-es5-browser-support` | confirmed | CLI-MIG 10 `remove-es5-browser-support-option`; GUIDE "es5browser"; SCHEMA 9 and 10 browser | |
| `v10-cli-typescript-mismatch` | confirmed | CLI-RN 10 (28f87cb); CLI-MIG 10 `update-angular-config` (root and project level) | |

### Angular 11

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v11-core-collection-change-record` | confirmed | NG 11.0.0 (core, fdea180); CORE-MIG 11; GUIDE "v11 CollectionChangeRecord" | |
| `v11-core-view-encapsulation-native` | confirmed | NG 11.0.0 (core, 4a1c12c); CORE-MIG 11 `migration-v11-native-view-encapsulation` | |
| `v11-router-preserve-query-params-template` | confirmed | NG 11.0.0 (router, 783a5bd); GUIDE "routerlink preserveQueryParams"; CORE-MIG 11 | The migration description covers NavigationExtras only. |
| `v11-platform-webworker` | confirmed | NG 11.0.0 (platform-webworker); CORE-MIG 11; GUIDE "platform-webworker" | |
| `v11-platform-webworker-dynamic` | confirmed | NG 11.0.0 (platform-webworker); CORE-MIG 11; GUIDE "platform-webworker" | |
| `v11-build-angular-rebase-root-relative-css-urls` | confirmed | CLI-RN 11 (7535f4f); CLI-MIG 11 `update-angular-config-v11`; SCHEMA 10 and 11 browser | |
| `v11-build-angular-karma-environment` | confirmed | CLI-RN 11 (aab73e2); CLI-MIG 11 `update-angular-config-v11`; SCHEMA 10 karma | |
| `v11-build-ng-packagr-builder` | confirmed | CLI-RN 11 (b1f0858); CLI-MIG 11 `replace-ng-packagr-builder` | |

### Angular 12

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v12-build-angular-i18n-file` | corrected | CLI v12.0.0 (5cf9a08); CLI-MIG 12 `remove-deprecated-i18n-options` source | migration and migrationNote: see Corrections. |
| `v12-build-angular-i18n-format` | corrected | CLI v12.0.0 (5cf9a08); CLI-MIG 12 `remove-deprecated-i18n-options` source | migrationNote: see Corrections. |
| `v12-build-angular-i18n-locale` | corrected | CLI v12.0.0 (5cf9a08); CLI-MIG 12 `remove-deprecated-i18n-options` source | migration and migrationNote: see Corrections. |
| `v12-build-angular-extract-i18n-locale` | corrected | CLI v12.0.0 (eca5a01); CLI-MIG 12 `remove-deprecated-i18n-options` source | migrationNote: see Corrections. |
| `v12-build-angular-extract-i18n-format` | confirmed | CLI v12.0.0 (eca5a01); CLI-MIG 12 `remove-deprecated-i18n-options` source | |
| `v12-build-angular-extract-i18n-ivy` | confirmed | CLI v12.0.0 (012700a); CLI-MIG 12 (no migration deletes it); SCHEMA 11 extract-i18n | |
| `v12-build-angular-lazy-modules` | confirmed | CLI v12.0.0 (8d66912); CLI-MIG 12 `update-angular-config-v12` source | |

### Angular 13

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v13-core-wrapped-value` | confirmed | NG 13.0.0 (core); CORE-MIG 13 | |
| `v13-core-ng-module-factory-loader` | confirmed | NG 13.0.0 (router); CORE-MIG 13 | |
| `v13-router-spy-ng-module-factory-loader` | confirmed | NG 13.0.0 (router); GUIDE "v13 removed symbols"; CORE-MIG 13 | Exported from `@angular/router/testing` in 12.0.0 (`router_testing_module.ts`). |
| `v13-router-deprecated-load-children` | confirmed | NG 13.0.0 (router); GUIDE "v13 removed symbols"; CORE-MIG 13 | |
| `v13-build-angular-extract-css` | confirmed | CLI 13.0.0 (build-angular); CLI-MIG 13 and 11 `update-angular-config` sources; SCHEMA 12 and 13 browser | |
| `v13-build-angular-dev-server-aot` | confirmed | CLI 13.0.0 (build-angular); CLI-MIG 13 `update-angular-config-v13` source | The migration deletes the option; it does not copy the value to the browser target. |
| `v13-build-angular-dev-server-source-map` | confirmed | CLI 13.0.0; CLI-MIG 13 source | The migration deletes the option; it does not copy the value to the browser target. |
| `v13-build-angular-dev-server-deploy-url` | confirmed | CLI 13.0.0; CLI-MIG 13 source | The migration deletes the option; it does not copy the value to the browser target. |
| `v13-build-angular-dev-server-base-href` | confirmed | CLI 13.0.0; CLI-MIG 13 source | The migration deletes the option; it does not copy the value to the browser target. |
| `v13-build-angular-dev-server-vendor-chunk` | confirmed | CLI 13.0.0; CLI-MIG 13 source | The migration deletes the option; it does not copy the value to the browser target. |
| `v13-build-angular-dev-server-common-chunk` | confirmed | CLI 13.0.0; CLI-MIG 13 source | The migration deletes the option; it does not copy the value to the browser target. |
| `v13-build-angular-dev-server-optimization` | confirmed | CLI 13.0.0; CLI-MIG 13 source | The migration deletes the option; it does not copy the value to the browser target. |
| `v13-build-angular-dev-server-progress` | confirmed | CLI 13.0.0; CLI-MIG 13 source | The migration deletes the option; it does not copy the value to the browser target. |
| `v13-build-angular-serve-path-default-warning` | confirmed | CLI 13.0.0; CLI-MIG 13 source | |
| `v13-build-angular-hmr-warning` | confirmed | CLI 13.0.0; CLI-MIG 13 source | |
| `v13-build-angular-tslint-builder` | confirmed | CLI 13.0.0; CLI-MIG 13 source (deletes the target) | |

### Angular 14

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v14-core-testing-aot-summaries` | confirmed | NG 14.0.0 (core); CORE-MIG 14; GUIDE "v14 aotSummaries" | Only the configureTestingModule key is detected; initTestEnvironment also took aotSummaries. |
| `v14-cdk-testing-protractor` | confirmed | GUIDE "v14 deprecate protractor entry" | |
| `v14-build-angular-show-circular-dependencies` | confirmed | CLI 14.0.0 (build-angular); CLI-MIG 14 `remove-show-circular-dependencies-option` source | |

### Angular 15

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v15-compiler-cli-enable-ivy` | confirmed | NG 15.0.0 (compiler-cli); GUIDE "v15 no-ivy" | |
| `v15-router-relative-link-resolution` | confirmed | NG 15.0.0 (router); CORE-MIG 15 `migration-v15-relative-link-resolution` | |
| `v15-build-angular-bundle-dependencies` | confirmed | CLI 15.0.0 (build-angular); CLI-MIG 15 `update-workspace-config` source | |

## Angular 16 to 22

52 entries read: 46 confirmed, 4 corrected, 2 removed, 0 unverified; 1 entry added. Every cited source was
retrieved.

### Sources read

Files were fetched from `raw.githubusercontent.com` at the commit or tag in the cited URL. The GitHub contents
API (`api.github.com/repos/angular/angular/contents/...`) was used only to list the files of a migration folder.

- **NG**: Angular CHANGELOG at commit `c0dc8c4`, `CHANGELOG.md`, section "Breaking Changes" of 16.0.0 to 22.0.0.
- **CLI**: Angular CLI `CHANGELOG.md` at commit `f61de66`, section "Breaking Changes" of 16.0.0 to 22.0.0.
- **CORE-MIG**: `packages/core/schematics/migrations.json` at tags 16.0.0 to v22.0.0, and at 11.0.0, 12.0.0 and
  14.0.0 for the earlier migrations that entries name.
- **CORE-SRC**: the source or README of a core migration an entry relies on: `entry-components` (14.0.0),
  `remove-module-id` (16.0.0), `bootstrap-options-migration/migration.ts` (21.0.0),
  `strict-templates-default/index.ts` and `http-xhr-backend/migration.ts` (v22.0.0).
- **CLI-MIG**: `packages/schematics/angular/migrations/migration-collection.json` at the CLI tags 16.0.0 to
  v22.0.0, and the source of each migration an entry names or that could touch it: `update-16/
  remove-default-project-option.ts`, `update-16/replace-default-collection-option.ts`,
  `update-workspace-config/migration.ts` (19.0.0 and v22.0.0), `update-ssr-imports/migration.ts` (19.0.0) and
  `migrate-karma-to-vitest/migration.ts` (v22.0.0).
- **GUIDE**: `adev/src/app/features/update/recommendations.ts` at commit `647bf8e`, the step named in the
  reference.
- **PKG**: package sources at release tags, to check exports: `platform-browser/src/platform-browser.ts` (21.0.0,
  v22.0.0), `core/src/linker.ts` (20.0.0, 21.0.0, v22.0.0), `core/testing/src/testing.ts` (17.0.0),
  `common/src/directives/ng_component_outlet.ts` (20.0.0, 21.0.0), `common/http/src/xhr.ts`, `provider.ts` and
  `module.ts` (21.0.0, v22.0.0), `upgrade/package.json` (v22.0.0), and the `builders.json` of
  `@angular-devkit/build-angular` 19.0.0 and `@angular/build` v22.0.0.

### Corrections and removals

- `v21-core-ignore-changes-outside-zone`: `migration` was unknown ("whether it drops this one is not stated").
  `bootstrap-options-migration` returns before any change in every bootstrap call that already has
  `provideZoneChangeDetection` or `provideZonelessChangeDetection` (`hasChangeDetectionProvider`). The entry
  finds the key inside a `provideZoneChangeDetection` call, so the migration never removes it: `migration` is
  now no. The migration drops `ignoreChangesOutsideZone` only from `bootstrapModule` options, which the entry
  does not find.
- `v22-compiler-cli-full-template-type-check`: `migration` was unknown. `strict-templates-default` writes
  `angularCompilerOptions.strictTemplates = false` in each build and test tsconfig where `strictTemplates` is
  not set (following `extends`) and never reads or deletes `fullTemplateTypeCheck`: `migration` is now no.
- `v22-upgrade-get-angular-lib`, `v22-upgrade-set-angular-lib`: `migration` was unknown with no
  `migrationSource`. `@angular/upgrade` 22.0.0 has no `schematics/migrations.json` (its `ng-update` field holds
  only the package group) and the `@angular/core` 22.0.0 list has no such migration: `migration` is now no.
- `v21-core-ng-module-factory` (removed): the NG 21.0.0 line "NgModuleFactory has been removed, use NgModule
  instead" is in the `common` section; its commit (`25f593ce2a`, "remove ngModuleFactory input of
  NgComponentOutlet") removed the `ngComponentOutletNgModuleFactory` input, which `ng_component_outlet.ts` has at
  20.0.0 and not at 21.0.0. `@angular/core` still exports `NgModuleFactory` at 21.0.0 and v22.0.0
  (`core/src/linker.ts`), so an import of it is not work for the upgrade. The candidate is in
  `REMOVED_API_EXCLUDED` (no-official-source), and the new template entry
  `v21-common-ng-component-outlet-ng-module-factory` finds the input in templates (`[ngComponentOutletNgModuleFactory]`
  or `ngModuleFactory` in a `*ngComponentOutlet` expression).
- `v22-common-http-xhr-backend` (removed): `HttpXhrBackend` is still exported and `@Injectable({providedIn:
  'root'})` at v22.0.0, and `HttpClientModule` still provides it through `withXhr()`. What changed is the default
  backend of `provideHttpClient()`, now `FetchBackend`. That matters only to apps that need XHR-only features
  such as upload progress, which an import scan cannot tell. The `http-xhr-backend` migration adds `withXhr()` to
  every `provideHttpClient()` call without `withFetch()` or `withXhr()`, whatever the app imports, and the plan
  already shows the update guide step `22.0.0-http-xhr-backend-explicit-opt-in`. The candidate is in
  `REMOVED_API_EXCLUDED` (not-detectable).

### Effect on scans, plans and snapshots

- The four corrected entries now read "fixed by ng update migration: no" instead of unknown. Effort does not
  change: only `yes` counts as fixed by the migration (`src/plan/effort.ts`), unknown and no both count as manual.
- An import of `NgModuleFactory` or `HttpXhrBackend` no longer gives a finding; a template that uses the removed
  `NgComponentOutlet` input now does. `test/scan/bundled-data.test.ts` scans a temporary project with the
  bundled data to check both.
- The five fixture snapshots did not change: the fixtures hold no source code, so no plan in them has a scan
  finding. The update guide steps they show are unchanged.
- Real apps: `node scripts/scan-real-apps.mjs` found the same 61 findings on the 11 apps as before; the only
  change to `docs/verification/scan-precision.json` and `.md` is the dataset size, 105 to 104 entries. No app
  imports `NgModuleFactory` or `HttpXhrBackend` or uses `ngModuleFactory` in a template. The four real-app
  findings of `v22-compiler-cli-full-template-type-check` keep their labels, which do not depend on the
  migration value.

### Angular 16

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v16-common-http-xhr-factory` | confirmed | NG 16.0.0 (common); CORE-MIG 16; CORE-MIG 12 `migration-v12-xhr-factory` | |
| `v16-core-ng-module-entry-components` | confirmed | NG 16.0.0 (core); CORE-MIG 16; CORE-MIG 14 and CORE-SRC `entry-components` | |
| `v16-core-component-entry-components` | confirmed | NG 16.0.0 (core); CORE-MIG 16; CORE-MIG 14 and CORE-SRC `entry-components` | |
| `v16-core-analyze-for-entry-components` | confirmed | NG 16.0.0 (core); CORE-MIG 16 | |
| `v16-core-reflective-injector` | confirmed | NG 16.0.0 (core); CORE-MIG 16 | |
| `v16-platform-browser-browser-transfer-state-module` | confirmed | NG 16.0.0 (platform-browser); CORE-MIG 16 | |
| `v16-platform-server-render-module-factory` | confirmed | NG 16.0.0 (platform-server); CORE-MIG 16 | |
| `v16-cli-default-project` | confirmed | CLI 16.0.0 (@angular/cli); CLI-MIG 16 `remove-default-project-option` source | |
| `v16-cli-default-collection` | confirmed | CLI 16.0.0 (@angular/cli); CLI-MIG 16 `replace-default-collection-option` source (workspace and project level) | |

### Angular 17

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v17-platform-browser-with-no-dom-reuse` | confirmed | NG 17.0.0 (platform-browser); CORE-MIG 17 | |
| `v17-router-testing-setup-testing-router` | confirmed | NG 17.0.0 (router); CORE-MIG 17 | |
| `v17-router-malformed-uri-error-handler` | confirmed | NG 17.0.0 (router); CORE-MIG 17 | |

### Angular 18

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v18-core-testing-async` | confirmed | NG 18.0.0 (core); CORE-MIG 18; CORE-MIG 11 `migration-v11-wait-for-async`; GUIDE "18.0.0: async"; PKG `core/testing` 17.0.0 | The guide step says `@angular/core`; the export is in `@angular/core/testing`. |
| `v18-platform-browser-transfer-state` | confirmed | NG 18.0.0 (platform-browser); CORE-MIG 18; CORE-MIG 17 `migration-transfer-state` | |
| `v18-platform-browser-state-key` | confirmed | NG 18.0.0 (platform-browser); CORE-MIG 18; CORE-MIG 17 `migration-transfer-state` | |
| `v18-platform-browser-make-state-key` | confirmed | NG 18.0.0 (platform-browser); CORE-MIG 18; CORE-MIG 17 `migration-transfer-state` | |
| `v18-common-is-platform-worker-ui` | confirmed | NG 18.0.0 (common); CORE-MIG 18 | |
| `v18-common-is-platform-worker-app` | confirmed | NG 18.0.0 (common); CORE-MIG 18 | |
| `v18-platform-browser-dynamic-resource-cache-provider` | confirmed | NG 18.0.0 (platform-browser-dynamic); CORE-MIG 18 | |
| `v18-platform-server-platform-dynamic-server` | confirmed | NG 18.0.0 (platform-server); CORE-MIG 18 | |
| `v18-platform-server-server-transfer-state-module` | confirmed | NG 18.0.0 (platform-server); CORE-MIG 18 | |

### Angular 19

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v19-core-experimental-pending-tasks` | confirmed | NG 19.0.0 (core); CORE-MIG 19 `pending-tasks` | |
| `v19-platform-browser-with-server-transition` | confirmed | NG 19.0.0 (platform-browser); CORE-MIG 19 | |
| `v19-ssr-common-engine` | confirmed | CLI 19.0.0 (@angular/ssr); CLI-MIG 19 `update-ssr-imports` source | |
| `v19-build-angular-browser-target` | confirmed | CLI 19.0.0 (build-angular); CLI-MIG 19 `update-workspace-config` source | The migration renames the option only in projects whose `projectType` is application. |
| `v19-build-angular-protractor-builder` | confirmed | CLI 19.0.0 (build-angular); CLI-MIG 19; PKG build-angular 19.0.0 `builders.json` | |

### Angular 20

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v20-core-testing-test-bed-get` | confirmed | NG 20.0.0 (core); CORE-MIG 20 `test-bed-get` | |
| `v20-core-inject-flags` | confirmed | NG 20.0.0 (core); CORE-MIG 20 `inject-flags` | |
| `v20-core-testing-flush-effects` | confirmed | NG 20.0.0 (core); CORE-MIG 20 | |
| `v20-core-provide-experimental-check-no-changes` | confirmed | NG 20.0.0 (core); CORE-MIG 20 | |
| `v20-core-provide-experimental-zoneless` | confirmed | NG 20.0.0 (core); CORE-MIG 20 | |
| `v20-core-after-render` | confirmed | NG 20.0.0 (core); CORE-MIG 20 | |

### Angular 21

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v21-core-ng-module-factory` | removed | NG 21.0.0 (common, 25f593ce2a); GUIDE "21.0.0-ngmodulefactory-removed"; PKG `core/src/linker.ts`, `ng_component_outlet.ts` | See Corrections and removals. |
| `v21-common-ng-component-outlet-ng-module-factory` | added | NG 21.0.0 (common, 25f593ce2a); CORE-MIG 21; GUIDE "21.0.0-ngmodulefactory-removed"; PKG `ng_component_outlet.ts` 20.0.0 and 21.0.0 | Written in place of `v21-core-ng-module-factory`. |
| `v21-core-component-module-id` | confirmed | NG 21.0.0 (core); CORE-MIG 21; CORE-MIG 16 and CORE-SRC `remove-module-id`; GUIDE "21.0.0-remove-moduleid-property" | |
| `v21-core-component-interpolation` | confirmed | NG 21.0.0 (core); CORE-MIG 21; GUIDE "21.0.0-remove-interpolation-option" | |
| `v21-core-ignore-changes-outside-zone` | corrected | NG 21.0.0 (core); CORE-MIG 21; CORE-SRC `bootstrap-options-migration` | migration, migrationSource and migrationNote: see Corrections and removals. |
| `v21-platform-browser-application-config` | confirmed | NG 21.0.0 (platform-browser); CORE-MIG 21 `application-config-core` | |
| `v21-upgrade-upgrade-adapter` | confirmed | NG 21.0.0 (upgrade); CORE-MIG 21 | |

### Angular 22

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v22-core-component-factory-resolver` | confirmed | NG 22.0.0 (core); CORE-MIG 22; GUIDE "22.0.0-remove-component-factory-resolver" | |
| `v22-core-component-factory` | confirmed | NG 22.0.0 (core); CORE-MIG 22 | |
| `v22-core-create-ng-module-ref` | confirmed | NG 22.0.0 (core); CORE-MIG 22 | |
| `v22-router-provide-routes` | confirmed | NG 22.0.0 (router); CORE-MIG 22 | |
| `v22-upgrade-get-angular-lib` | corrected | NG 22.0.0 (upgrade); GUIDE "22.0.0-upgrade-angular-js-global-migration"; CORE-MIG 22; PKG `upgrade/package.json` | migration, migrationSource and migrationNote: see Corrections and removals. |
| `v22-upgrade-set-angular-lib` | corrected | NG 22.0.0 (upgrade); GUIDE "22.0.0-upgrade-angular-js-global-migration"; CORE-MIG 22; PKG `upgrade/package.json` | migration, migrationSource and migrationNote: see Corrections and removals. |
| `v22-platform-browser-hammer-module` | confirmed | NG 22.0.0 (platform-browser); CORE-MIG 22; PKG `platform-browser.ts` 21.0.0 and v22.0.0 | The `HammerLoader` type was removed too; it is not an entry. |
| `v22-platform-browser-hammer-gesture-config` | confirmed | NG 22.0.0 (platform-browser); CORE-MIG 22; PKG `platform-browser.ts` 21.0.0 and v22.0.0 | |
| `v22-platform-browser-hammer-gesture-config-token` | confirmed | NG 22.0.0 (platform-browser); CORE-MIG 22; PKG `platform-browser.ts` 21.0.0 and v22.0.0 | |
| `v22-platform-browser-hammer-loader` | confirmed | NG 22.0.0 (platform-browser); CORE-MIG 22; PKG `platform-browser.ts` 21.0.0 and v22.0.0 | |
| `v22-common-http-xhr-backend` | removed | NG 22.0.0 (http); GUIDE "22.0.0-http-xhr-backend-explicit-opt-in"; CORE-MIG 22 and CORE-SRC `http-xhr-backend`; PKG `common/http` 21.0.0 and v22.0.0 | See Corrections and removals. |
| `v22-compiler-cli-full-template-type-check` | corrected | GUIDE "22.0.0-full-template-type-check-removed" and "22.0.0-strict-templates-default"; CORE-MIG 22 and CORE-SRC `strict-templates-default` | migration, migrationSource and migrationNote: see Corrections and removals. NG 22.0.0 does not mention the option. |
| `v22-build-angular-jest-builder` | confirmed | CLI 22.0.0; CLI-MIG 22 (`update-workspace-config` and `migrate-karma-to-vitest` sources do not touch it); PKG `@angular/build` v22.0.0 `builders.json` | |
| `v22-build-angular-web-test-runner-builder` | confirmed | CLI 22.0.0; CLI-MIG 22 (`update-workspace-config` and `migrate-karma-to-vitest` sources do not touch it); PKG `@angular/build` v22.0.0 `builders.json` | |

## Angular Material and CDK

185 entries for `@angular/material`, `@angular/cdk` and their entry points were added after the audit
(`src/data/components-apis.ts`, spread into the removed-API data), all with status added: written from the
sources below on 2026-10-03 and not re-read separately. Candidates a source scan cannot find are in
`REMOVED_API_EXCLUDED` with the reason (27 records: instance members, constructor
parameters, typing changes, Sass and CSS changes, and packages other than Material and the CDK).

### Sources read

- **COMP**: angular/components CHANGELOG at commit `f6c2a19` (`CHANGELOG_ARCHIVE.md` for 9 to 11,
  `CHANGELOG.md` from 12), the breaking changes of each major release. The removal of the `@angular/material`
  primary entry point is listed under 9.0.0-next.0; the removal of the legacy entry points is the 17.0.0
  material row "remove legacy components". 12 lists one typing change, 16 none, and 15 and 18 only DOM, CSS and
  Sass changes, so those majors have no entry.
- **API**: the public API golden of the entry point (`tools/public_api_guard` up to 18,
  `goldens/<entry point>/index.api.md` from 19) at the last release that still exports the symbol. It confirms
  the exact name and the entry point; the golden of the removal major was read to confirm the symbol is gone.
  Two names differ from the CHANGELOG: it writes `MAT_CHECKBOX_VALUE_ACCESSOR` and `MAT_DATE_LOCAL_FACTORY` for
  the exports `MAT_CHECKBOX_CONTROL_VALUE_ACCESSOR` and `MAT_DATE_LOCALE_FACTORY`.
- **MIG**: `src/material/schematics/migration.json` or `src/cdk/schematics/migration.json` at the major's tag,
  with the `ng-update/index.ts` it runs and the upgrade data files (`ng-update/data/*.ts`) of that tag.
  **MIG-SRC** names the file that decides the migration value. From 17 the upgrade data holds no rule, so
  those entries say no; where a migration runs code whose effect on the usage was not established (the
  hammer-gestures migration of 10, the secondary entry points rule of 9) the value is unknown.

### Material and CDK 9

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v9-material-primary-entry-point` | added | COMP 9.0.0-next.0; MIG-SRC `upgrade-rules/package-imports-v8/secondary-entry-points-rule.ts` 9.0.0 | migration unknown |

### Material and CDK 10

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v10-material-core-mat-hammer-options` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-core-gesture-config` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-core-hammer-input` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-core-hammer-static` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-core-recognizer` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-core-recognizer-static` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-core-hammer-instance` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-core-hammer-manager` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-core-hammer-options` | added | COMP 10.0.0; API `material/core` 9.2.4; MIG-SRC `migrations/hammer-gestures-v9/hammer-gestures-migration.ts` 10.0.0 | migration unknown |
| `v10-material-button-toggle-mat-button-toggle-group-multiple` | added | COMP 10.0.0; API `material/button-toggle` 9.2.4; MIG-SRC `data/class-names.ts` 10.0.0; MIG material 10 | migration yes |
| `v10-cdk-drag-drop-cdk-drag-config-factory` | added | COMP 10.0.0; API `cdk/drag-drop` 9.2.4; MIG cdk 10 | migration no |
| `v10-cdk-clipboard-copied-output` | added | COMP 10.0.0; MIG-SRC `data/output-names.ts` 10.0.0; MIG cdk 10 | migration yes |

### Material and CDK 11

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v11-material-core-jan` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-feb` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-mar` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-apr` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-may` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-jun` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-jul` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-aug` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-sep` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-oct` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-nov` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |
| `v11-material-core-dec` | added | COMP 11.0.0; API `material/core` 10.2.7; MIG material 11 | migration no |

### Material and CDK 13

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v13-cdk-clipboard-ckd-copy-to-clipboard-config` | added | COMP 13.0.0; API `cdk/clipboard` 12.2.13; MIG cdk 13 | migration no |
| `v13-cdk-overlay-connected-position-strategy` | added | COMP 13.0.0; API `cdk/overlay` 12.2.13; MIG-SRC `data/constructor-checks.ts` 13.0.0; MIG cdk 13 | migration no |
| `v13-material-core-can-color-ctor` | added | COMP 13.0.0; API `material/core` 12.2.13; MIG-SRC `data/symbol-removal.ts` 13.0.0; MIG material 13 | migration no |
| `v13-material-core-can-disable-ripple-ctor` | added | COMP 13.0.0; API `material/core` 12.2.13; MIG-SRC `data/symbol-removal.ts` 13.0.0; MIG material 13 | migration no |
| `v13-material-core-can-disable-ctor` | added | COMP 13.0.0; API `material/core` 12.2.13; MIG-SRC `data/symbol-removal.ts` 13.0.0; MIG material 13 | migration no |
| `v13-material-core-can-update-error-state-ctor` | added | COMP 13.0.0; API `material/core` 12.2.13; MIG-SRC `data/symbol-removal.ts` 13.0.0; MIG material 13 | migration no |
| `v13-material-core-has-initialized-ctor` | added | COMP 13.0.0; API `material/core` 12.2.13; MIG-SRC `data/symbol-removal.ts` 13.0.0; MIG material 13 | migration no |
| `v13-material-core-has-tab-index-ctor` | added | COMP 13.0.0; API `material/core` 12.2.13; MIG-SRC `data/symbol-removal.ts` 13.0.0; MIG material 13 | migration no |
| `v13-material-input-mat-textarea-autosize` | added | COMP 13.0.0; API `material/input` 12.2.13; MIG material 13 | migration no |
| `v13-material-input-textarea-autosize-template` | added | COMP 13.0.0; API `material/input` 12.2.13; MIG material 13 | migration no |

### Material and CDK 14

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v14-material-stepper-mat-vertical-stepper` | added | COMP 14.0.0; API `material/stepper` 13.3.9; MIG-SRC `data/constructor-checks.ts` 14.0.0; MIG material 14 | migration no |
| `v14-material-stepper-mat-horizontal-stepper` | added | COMP 14.0.0; API `material/stepper` 13.3.9; MIG-SRC `data/constructor-checks.ts` 14.0.0; MIG material 14 | migration no |

### Material and CDK 17

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v17-material-legacy-autocomplete` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-autocomplete` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-autocomplete-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-autocomplete-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-button` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-button` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-button-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-button-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-card` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-card` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-card-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-card-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-checkbox` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-checkbox` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-checkbox-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-checkbox-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-chips` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-chips` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-chips-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-chips-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-core` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-core` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-core-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-core-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-dialog` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-dialog` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-dialog-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-dialog-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-form-field` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-form-field` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-form-field-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-form-field-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-input` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-input` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-input-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-input-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-list` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-list` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-list-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-list-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-menu` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-menu` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-menu-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-menu-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-paginator` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-paginator` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-paginator-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-paginator-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-progress-bar` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-progress-bar` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-progress-bar-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-progress-bar-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-progress-spinner` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-progress-spinner` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-progress-spinner-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-progress-spinner-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-radio` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-radio` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-radio-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-radio-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-select` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-select` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-select-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-select-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-slide-toggle` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-slide-toggle` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-slide-toggle-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-slide-toggle-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-slider` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-slider` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-slider-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-slider-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-snack-bar` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-snack-bar` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-snack-bar-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-snack-bar-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-table` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-table` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-table-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-table-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-tabs` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-tabs` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-tabs-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-tabs-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-tooltip` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-tooltip` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |
| `v17-material-legacy-tooltip-testing` | added | COMP 17.0.0 (material, "remove legacy components"); API `material/legacy-tooltip-testing` 16.2.14; MIG-SRC `migrations/legacy-imports-error.ts` 17.0.0; MIG material 17 | migration no |

### Material and CDK 19

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v19-material-core-mixin-color` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-can-color` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-mixin-disable-ripple` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-can-disable-ripple` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-mixin-disabled` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-can-disable` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-mixin-initialized` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-has-initialized` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-mixin-tab-index` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |
| `v19-material-core-has-tab-index` | added | COMP 19.0.0; API `material/core` 18.2.14; MIG material 19 | migration no |

### Material and CDK 20

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v20-cdk-dialog-dialog-scroll-strategy-provider` | added | COMP 20.0.0; API `cdk/dialog` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-dialog-dialog-scroll-strategy-provider-factory` | added | COMP 20.0.0; API `cdk/dialog` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-portal-dom-portal-host` | added | COMP 20.0.0; API `cdk/portal` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-portal-portal-injector` | added | COMP 20.0.0; API `cdk/portal` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-portal-portal-host` | added | COMP 20.0.0; API `cdk/portal` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-portal-base-portal-host` | added | COMP 20.0.0; API `cdk/portal` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-table-constructor` | added | COMP 20.0.0; API `cdk/table` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-table-can-stick-ctor` | added | COMP 20.0.0; API `cdk/table` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-table-mixin-has-sticky-input` | added | COMP 20.0.0; API `cdk/table` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-table-can-stick` | added | COMP 20.0.0; API `cdk/table` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-table-cdk-table-template` | added | COMP 20.0.0; API `cdk/table` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-table-sticky-direction` | added | COMP 20.0.0; API `cdk/table` 19.2.19; MIG cdk 20 | migration no |
| `v20-cdk-table-sticky-styler` | added | COMP 20.0.0; API `cdk/table` 19.2.19; MIG cdk 20 | migration no |
| `v20-material-checkbox-mat-checkbox-required-validator-provider` | added | COMP 20.0.0; API `material/checkbox` 19.2.19; MIG material 20 | migration no |
| `v20-material-checkbox-mat-checkbox-control-value-accessor` | added | COMP 20.0.0; API `material/checkbox` 19.2.19; MIG material 20 | The CHANGELOG writes MAT_CHECKBOX_VALUE_ACCESSOR; the export of that name in 19.2.19 is MAT_CHECKBOX_CONTROL_VALUE_ACCESSOR, absent in 20.2.14. migration no |
| `v20-material-checkbox-mat-checkbox-required-validator` | added | COMP 20.0.0; API `material/checkbox` 19.2.19; MIG material 20 | migration no |
| `v20-material-checkbox-mat-checkbox-required-validator-module` | added | COMP 20.0.0; API `material/checkbox` 19.2.19; MIG material 20 | migration no |
| `v20-material-dialog-mat-dialog-scroll-strategy-provider` | added | COMP 20.0.0; API `material/dialog` 19.2.19; MIG material 20 | migration no |
| `v20-material-dialog-mat-dialog-scroll-strategy-provider-factory` | added | COMP 20.0.0; API `material/dialog` 19.2.19; MIG material 20 | migration no |
| `v20-material-select-mat-select-animations-transform-panel-wrap` | added | COMP 20.0.0; API `material/select` 19.2.19; MIG material 20 | migration no |
| `v20-material-slide-toggle-mat-slide-toggle-required-validator-provider` | added | COMP 20.0.0; API `material/slide-toggle` 19.2.19; MIG material 20 | migration no |
| `v20-material-slide-toggle-mat-slide-toggle-value-accessor` | added | COMP 20.0.0; API `material/slide-toggle` 19.2.19; MIG material 20 | migration no |
| `v20-material-slide-toggle-mat-slide-toggle-required-validator` | added | COMP 20.0.0; API `material/slide-toggle` 19.2.19; MIG material 20 | migration no |
| `v20-material-slide-toggle-mat-slide-toggle-required-validator-module` | added | COMP 20.0.0; API `material/slide-toggle` 19.2.19; MIG material 20 | migration no |

### Material and CDK 21

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v21-cdk-a11y-live-announcer-element-token-factory` | added | COMP 21.0.0; API `cdk/a11y` 20.2.14; MIG cdk 21 | migration no |
| `v21-cdk-a11y-tree-key-manager-factory` | added | COMP 21.0.0; API `cdk/a11y` 20.2.14; MIG cdk 21 | migration no |
| `v21-cdk-a11y-tree-key-manager-factory-provider` | added | COMP 21.0.0; API `cdk/a11y` 20.2.14; MIG cdk 21 | migration no |
| `v21-cdk-portal-template-portal-directive` | added | COMP 21.0.0; API `cdk/portal` 20.2.14; MIG cdk 21 | migration no |
| `v21-cdk-portal-portal-host-directive` | added | COMP 21.0.0; API `cdk/portal` 20.2.14; MIG cdk 21 | migration no |
| `v21-material-autocomplete-mat-autocomplete-default-options-factory` | added | COMP 21.0.0; API `material/autocomplete` 20.2.14; MIG material 21 | migration no |
| `v21-material-autocomplete-mat-autocomplete-scroll-strategy-factory` | added | COMP 21.0.0; API `material/autocomplete` 20.2.14; MIG material 21 | migration no |
| `v21-material-autocomplete-mat-autocomplete-scroll-strategy-factory-provider` | added | COMP 21.0.0; API `material/autocomplete` 20.2.14; MIG material 21 | migration no |
| `v21-material-bottom-sheet-mat-bottom-sheet-animations` | added | COMP 21.0.0; API `material/bottom-sheet` 20.2.14; MIG material 21 | migration no |
| `v21-material-button-toggle-mat-button-toggle-group-default-options-factory` | added | COMP 21.0.0; API `material/button-toggle` 20.2.14; MIG material 21 | migration no |
| `v21-material-button-mat-fab-default-options-factory` | added | COMP 21.0.0; API `material/button` 20.2.14; MIG material 21 | migration no |
| `v21-material-checkbox-mat-checkbox-default-options-factory` | added | COMP 21.0.0; API `material/checkbox` 20.2.14; MIG material 21 | migration no |
| `v21-material-core-animation-curves` | added | COMP 21.0.0; API `material/core` 20.2.14; MIG material 21 | migration no |
| `v21-material-core-animation-durations` | added | COMP 21.0.0; API `material/core` 20.2.14; MIG material 21 | migration no |
| `v21-material-core-mat-date-locale-factory` | added | COMP 21.0.0; API `material/core` 20.2.14; MIG material 21 | The CHANGELOG writes MAT_DATE_LOCAL_FACTORY; the export of that name in 20.2.14 is MAT_DATE_LOCALE_FACTORY. migration no |
| `v21-material-core-mat-common-module` | added | COMP 21.0.0; API `material/core` 20.2.14; MIG material 21 | migration no |
| `v21-material-core-granular-sanity-checks` | added | COMP 21.0.0; API `material/core` 20.2.14; MIG material 21 | migration no |
| `v21-material-core-material-sanity-checks` | added | COMP 21.0.0; API `material/core` 20.2.14; MIG material 21 | migration no |
| `v21-material-core-sanity-checks` | added | COMP 21.0.0; API `material/core` 20.2.14; MIG material 21 | migration no |
| `v21-material-datepicker-mat-datepicker-animations` | added | COMP 21.0.0; API `material/datepicker` 20.2.14; MIG material 21 | migration no |
| `v21-material-datepicker-mat-datepicker-scroll-strategy-factory` | added | COMP 21.0.0; API `material/datepicker` 20.2.14; MIG material 21 | migration no |
| `v21-material-datepicker-mat-datepicker-scroll-strategy-factory-provider` | added | COMP 21.0.0; API `material/datepicker` 20.2.14; MIG material 21 | migration no |
| `v21-material-datepicker-mat-range-date-selection-model-factory` | added | COMP 21.0.0; API `material/datepicker` 20.2.14; MIG material 21 | migration no |
| `v21-material-datepicker-mat-range-date-selection-model-provider` | added | COMP 21.0.0; API `material/datepicker` 20.2.14; MIG material 21 | migration no |
| `v21-material-datepicker-mat-single-date-selection-model-factory` | added | COMP 21.0.0; API `material/datepicker` 20.2.14; MIG material 21 | migration no |
| `v21-material-datepicker-mat-single-date-selection-model-provider` | added | COMP 21.0.0; API `material/datepicker` 20.2.14; MIG material 21 | migration no |
| `v21-material-dialog-default-params` | added | COMP 21.0.0; API `material/dialog` 20.2.14; MIG material 21 | migration no |
| `v21-material-dialog-mat-dialog-animations` | added | COMP 21.0.0; API `material/dialog` 20.2.14; MIG material 21 | migration no |
| `v21-material-expansion-expansion-panel-animation-timing` | added | COMP 21.0.0; API `material/expansion` 20.2.14; MIG material 21 | migration no |
| `v21-material-expansion-mat-expansion-animations` | added | COMP 21.0.0; API `material/expansion` 20.2.14; MIG material 21 | migration no |
| `v21-material-form-field-mat-form-field-animations` | added | COMP 21.0.0; API `material/form-field` 20.2.14; MIG material 21 | migration no |
| `v21-material-icon-icon-registry-provider` | added | COMP 21.0.0; API `material/icon` 20.2.14; MIG material 21 | migration no |
| `v21-material-icon-icon-registry-provider-factory` | added | COMP 21.0.0; API `material/icon` 20.2.14; MIG material 21 | migration no |
| `v21-material-icon-mat-icon-location-factory` | added | COMP 21.0.0; API `material/icon` 20.2.14; MIG material 21 | migration no |
| `v21-material-menu-fade-in-items` | added | COMP 21.0.0; API `material/menu` 20.2.14; MIG material 21 | migration no |
| `v21-material-menu-transform-menu` | added | COMP 21.0.0; API `material/menu` 20.2.14; MIG material 21 | migration no |
| `v21-material-menu-mat-menu-animations` | added | COMP 21.0.0; API `material/menu` 20.2.14; MIG material 21 | migration no |
| `v21-material-menu-mat-menu-scroll-strategy-factory-provider` | added | COMP 21.0.0; API `material/menu` 20.2.14; MIG material 21 | migration no |
| `v21-material-paginator-mat-paginator-intl-provider` | added | COMP 21.0.0; API `material/paginator` 20.2.14; MIG material 21 | migration no |
| `v21-material-paginator-mat-paginator-intl-provider-factory` | added | COMP 21.0.0; API `material/paginator` 20.2.14; MIG material 21 | migration no |
| `v21-material-progress-bar-mat-progress-bar-location-factory` | added | COMP 21.0.0; API `material/progress-bar` 20.2.14; MIG material 21 | migration no |
| `v21-material-progress-spinner-mat-progress-spinner-default-options-factory` | added | COMP 21.0.0; API `material/progress-spinner` 20.2.14; MIG material 21 | migration no |
| `v21-material-radio-mat-radio-default-options-factory` | added | COMP 21.0.0; API `material/radio` 20.2.14; MIG material 21 | migration no |
| `v21-material-select-mat-select-animations` | added | COMP 21.0.0; API `material/select` 20.2.14; MIG material 21 | migration no |
| `v21-material-select-mat-select-scroll-strategy-provider` | added | COMP 21.0.0; API `material/select` 20.2.14; MIG material 21 | migration no |
| `v21-material-select-mat-select-scroll-strategy-provider-factory` | added | COMP 21.0.0; API `material/select` 20.2.14; MIG material 21 | migration no |
| `v21-material-sidenav-mat-drawer-animations` | added | COMP 21.0.0; API `material/sidenav` 20.2.14; MIG material 21 | migration no |
| `v21-material-sidenav-mat-drawer-default-autosize-factory` | added | COMP 21.0.0; API `material/sidenav` 20.2.14; MIG material 21 | migration no |
| `v21-material-snack-bar-mat-snack-bar-animations` | added | COMP 21.0.0; API `material/snack-bar` 20.2.14; MIG material 21 | migration no |
| `v21-material-snack-bar-mat-snack-bar-default-options-factory` | added | COMP 21.0.0; API `material/snack-bar` 20.2.14; MIG material 21 | migration no |
| `v21-material-sort-mat-sort-animations` | added | COMP 21.0.0; API `material/sort` 20.2.14; MIG material 21 | migration no |
| `v21-material-sort-mat-sort-header-intl-provider` | added | COMP 21.0.0; API `material/sort` 20.2.14; MIG material 21 | migration no |
| `v21-material-sort-mat-sort-header-intl-provider-factory` | added | COMP 21.0.0; API `material/sort` 20.2.14; MIG material 21 | migration no |
| `v21-material-stepper-mat-stepper-animations` | added | COMP 21.0.0; API `material/stepper` 20.2.14; MIG material 21 | migration no |
| `v21-material-stepper-mat-stepper-intl-provider` | added | COMP 21.0.0; API `material/stepper` 20.2.14; MIG material 21 | migration no |
| `v21-material-stepper-mat-stepper-intl-provider-factory` | added | COMP 21.0.0; API `material/stepper` 20.2.14; MIG material 21 | migration no |
| `v21-material-tabs-mat-tabs-animations` | added | COMP 21.0.0; API `material/tabs` 20.2.14; MIG material 21 | migration no |
| `v21-material-tabs-mat-ink-bar-positioner-factory` | added | COMP 21.0.0; API `material/tabs` 20.2.14; MIG material 21 | migration no |
| `v21-material-tooltip-mat-tooltip-animations` | added | COMP 21.0.0; API `material/tooltip` 20.2.14; MIG material 21 | migration no |
| `v21-material-tooltip-mat-tooltip-default-options-factory` | added | COMP 21.0.0; API `material/tooltip` 20.2.14; MIG material 21 | migration no |
| `v21-material-tooltip-mat-tooltip-scroll-strategy-factory` | added | COMP 21.0.0; API `material/tooltip` 20.2.14; MIG material 21 | migration no |
| `v21-material-tooltip-mat-tooltip-scroll-strategy-factory-provider` | added | COMP 21.0.0; API `material/tooltip` 20.2.14; MIG material 21 | migration no |

### Material and CDK 22

| Entry | Status | Source section read | Change, reason or context |
| --- | --- | --- | --- |
| `v22-cdk-a11y-cdk-describedby-host-attribute` | added | COMP 22.0.0; API `cdk/a11y` 21.0.2; MIG cdk 22 | migration no |
| `v22-cdk-a11y-cdk-describedby-id-prefix` | added | COMP 22.0.0; API `cdk/a11y` 21.0.2; MIG cdk 22 | migration no |
| `v22-cdk-a11y-messages-container-id` | added | COMP 22.0.0; API `cdk/a11y` 21.0.2; MIG cdk 22 | migration no |
| `v22-cdk-menu-context-menu-tracker` | added | COMP 22.0.0; API `cdk/menu` 21.0.2; MIG cdk 22 | In 21.0.2 it is an alias export of MenuTracker. migration no |
| `v22-material-list-mat-list-option-checkbox-position` | added | COMP 22.0.0; API `material/list` 21.0.2; MIG material 22 | In 21.0.2 it is an alias export of MatListOptionTogglePosition. migration no |
| `v22-material-list-checkbox-position-input` | added | COMP 22.0.0; API `material/list` 21.0.2; MIG material 22 | migration no |
| `v22-material-sort-arrow-view-state` | added | COMP 22.0.0; API `material/sort` 21.0.2; MIG material 22 | migration no |
| `v22-material-sort-arrow-view-state-transition` | added | COMP 22.0.0; API `material/sort` 21.0.2; MIG material 22 | migration no |
