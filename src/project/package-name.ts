// Package name validation following the npm naming rules that apply to every package on the
// registry (the rules npm enforces as errors, so older names with capitals are still accepted).

const MAX_LENGTH = 214;
const RESERVED = new Set(['node_modules', 'favicon.ico']);

function urlSafe(part: string): boolean {
  return part.length > 0 && encodeURIComponent(part) === part;
}

/** Returns why `name` is not a valid npm package name, or null when it is valid. */
export function packageNameProblem(name: string): string | null {
  if (name.length === 0) return 'name is empty';
  if (name.length > MAX_LENGTH) return `name is longer than ${MAX_LENGTH} characters`;
  if (name.trim() !== name) return 'name has leading or trailing spaces';
  if (name.startsWith('.')) return 'name starts with a period';
  if (name.startsWith('_')) return 'name starts with an underscore';
  if (RESERVED.has(name.toLowerCase())) return 'name is reserved';

  if (name.startsWith('@')) {
    const slash = name.indexOf('/');
    if (slash === -1) return 'scoped name has no package part';
    const scope = name.slice(1, slash);
    const pkg = name.slice(slash + 1);
    if (!urlSafe(scope) || !urlSafe(pkg)) return 'name contains characters that are not URL-safe';
    if (scope.startsWith('.') || pkg.startsWith('.')) return 'name part starts with a period';
    if (pkg.startsWith('_')) return 'name part starts with an underscore';
    return null;
  }

  if (!urlSafe(name)) return 'name contains characters that are not URL-safe';
  return null;
}

export function isValidPackageName(name: string): boolean {
  return packageNameProblem(name) === null;
}
