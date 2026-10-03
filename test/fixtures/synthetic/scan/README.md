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

This folder is excluded from type checking and linting.
