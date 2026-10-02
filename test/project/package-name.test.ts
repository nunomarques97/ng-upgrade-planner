import { describe, expect, it } from 'vitest';
import { isValidPackageName, packageNameProblem } from '../../src/project/package-name.js';

describe('package name validation', () => {
  it.each([
    '@angular/core',
    '@ngrx/store',
    'ngx-toastr',
    'zone.js',
    'rxjs',
    'lodash.get',
    'constructor',
    // Older registry names may contain capitals and are still valid to depend on.
    'JSONStream',
    '@types/node',
    'a'.repeat(214),
  ])('accepts %s', (name) => {
    expect(packageNameProblem(name)).toBeNull();
    expect(isValidPackageName(name)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    [' rxjs', 'spaces'],
    ['.hidden', 'period'],
    ['_private', 'underscore'],
    ['__proto__', 'underscore'],
    ['../x', 'period'],
    ['/etc/passwd', 'URL-safe'],
    ['C:\\temp\\x', 'URL-safe'],
    ['foo/bar', 'URL-safe'],
    ['@scope', 'no package part'],
    ['@scope/', 'URL-safe'],
    ['@/pkg', 'URL-safe'],
    ['@scope/../x', 'URL-safe'],
    ['@../x', 'period'],
    ['@scope/.x', 'period'],
    ['@scope/_x', 'underscore'],
    ['with space', 'URL-safe'],
    ['bad<script>', 'URL-safe'],
    ['\u001b[31mred', 'URL-safe'],
    ['node_modules', 'reserved'],
    ['a'.repeat(215), 'longer'],
  ])('rejects %j (%s)', (name, reason) => {
    expect(packageNameProblem(name)).toContain(reason);
    expect(isValidPackageName(name)).toBe(false);
  });
});
