# Synthetic scan sources

Everything in this folder was written for this repository to test the removed-API scan
(`src/scan`). None of it is copied from any application. The files are not meant to compile: they
only exercise the cases the scan must tell apart (named, aliased and namespace imports, re-exports,
the same name from another package, comments and strings, inline and external templates, config
files and a file that does not parse).

`project/` is the project the tests scan. The tests copy it to a temporary folder and add the
folders that must be skipped (`node_modules`, `dist`, a build output path and gitignored paths) at
run time, because the repository's own `.gitignore` would keep them out of version control.

This folder is excluded from type checking and linting.
