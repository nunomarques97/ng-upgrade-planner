# Synthetic scan sources

Everything in this folder was written for this repository to test the removed-API scan
(`src/scan`). None of it is copied from any application. The files are not meant to compile: they
only exercise the cases the scan must tell apart (named, aliased and namespace imports, re-exports,
the same name from another package, comments and strings, inline and external templates, config
files and a file that does not parse).

`project/angular.json` is a synthetic workspace file, not a real one. Its targets exercise the
builder-scoped matching: removed builder options in `options` and in `configurations` entries
(under `architect` and under its alias `targets`), a removed builder name, and the same option
names under a third-party builder, under a target without a builder and outside any target, which
must give no finding, and two targets of known wrapper builders (`@angular-builders/custom-webpack`,
`ngx-build-plus`) whose options give heuristic findings. Lines 1 to 9 stay where they are because the tests point at them.

`project/` is the project the tests scan. The tests copy it to a temporary folder and add the
folders that must be skipped (`node_modules`, `dist`, a build output path and gitignored paths) at
run time, because the repository's own `.gitignore` would keep them out of version control.

`deprecations/` is a second project for the deprecated-API scan (`test/scan/deprecations.test.ts`): uses of
APIs whose removal is announced (named, aliased and namespace imports, the `animations` key of `@Component`),
the same names from other packages, a local file and another framework's decorator, comments and strings, an
external template with animation bindings, and a file that mixes a removed and a deprecated API.

`material/` is a third project for the Angular Material and CDK entries (`test/scan/components.test.ts`): Material
and CDK symbols, a static member, whole entry points (`@angular/material` itself and a legacy entry point),
aliased and namespace imports, the same names from a local file, another package and look-alike entry points
(`@angular/material/button`, `@angular/material-moment-adapter`, `@angular/cdk-experimental/menu`), comments and
strings, and an external template with the three Material and CDK template patterns next to look-alikes on
other elements and in an HTML comment.

`rxjs/` is a fourth project for the RxJS 7 entries (`test/scan/rxjs.test.ts`): files that import rxjs with and
without an Angular import, calls of `iif` and `defaultIfEmpty` with too few arguments next to complete calls and a
call with spread arguments, a static member, `rxjs/Rx` as an import and a re-export, aliased and namespace imports,
the same names from another package and a local file, comments and strings, a file that imports rxjs and does
not parse (so it must be listed as unscanned) and a file that does not parse and only mentions rxjs (so it must
not be read as TypeScript).

This folder is excluded from type checking and linting.
