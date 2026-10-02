// Vendored lists of the packages that `ng update @angular/core @angular/cli` moves together.
// They are excluded from the library matrix. Review them when a new Angular major adds a package.

/**
 * Framework packages published from angular/angular. They are released together with
 * @angular/core and share its version numbers, so @angular/core is the reference for their
 * peer ranges.
 */
export const LOCKSTEP_PACKAGES: readonly string[] = [
  '@angular/animations',
  '@angular/common',
  '@angular/compiler',
  '@angular/compiler-cli',
  '@angular/core',
  '@angular/elements',
  '@angular/forms',
  '@angular/language-service',
  '@angular/localize',
  '@angular/platform-browser',
  '@angular/platform-browser-dynamic',
  '@angular/platform-server',
  '@angular/router',
  '@angular/service-worker',
  '@angular/upgrade',
];

/**
 * Core packages that angular/angular published in lockstep with @angular/core and later removed.
 * Old apps still list them; the update guide covers their migration (for example the "Http" step
 * in 8.0 and "platform-webworker" in 11.0), so they are framework packages, not blockers.
 */
export const REMOVED_PACKAGES: readonly string[] = [
  '@angular/bazel',
  '@angular/http',
  '@angular/platform-webworker',
  '@angular/platform-webworker-dynamic',
];

/** Tooling packages published from angular/angular-cli and updated by `ng update @angular/cli`. */
export const CLI_PACKAGES: readonly string[] = [
  '@angular/build',
  '@angular/cli',
  '@angular/ssr',
  '@ngtools/webpack',
  '@schematics/angular',
];

const FRAMEWORK = new Set([...LOCKSTEP_PACKAGES, ...REMOVED_PACKAGES, ...CLI_PACKAGES]);
// Removed packages shared @angular/core's version numbers while they were published.
const LOCKSTEP = new Set([...LOCKSTEP_PACKAGES, ...REMOVED_PACKAGES]);

/** true for packages that move with ng update and are therefore not in the library matrix. */
export function isFrameworkPackage(name: string): boolean {
  return FRAMEWORK.has(name) || name.startsWith('@angular-devkit/');
}

export function isLockstepPackage(name: string): boolean {
  return LOCKSTEP.has(name);
}

export function isAngularPackage(name: string): boolean {
  return name.startsWith('@angular/');
}
