// Which files the scan reads: skipped folders, .gitignore rules, symbolic links and size limits.
import { mkdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scan, type ScanResult } from '../../src/scan/index.js';
import { buildOutputFolders, fileKind } from '../../src/scan/walk.js';
import { HIT, TEST_DATA, copySyntheticProject, removeFolder, tempFolder, writeFiles } from './helpers.js';

let root: string;
let outside: string;
let linked = false;
let result: ScanResult;

beforeAll(async () => {
  root = copySyntheticProject();
  outside = tempFolder('ngup-scan-outside-');
  writeFiles(outside, { 'hit.ts': HIT });
  writeFiles(root, {
    'node_modules/some-lib/index.ts': HIT,
    'src/node_modules/nested/index.ts': HIT,
    'dist/main.ts': HIT,
    'out-tsc/app/main.ts': HIT,
    '.angular/cache/main.ts': HIT,
    'coverage/main.ts': HIT,
    '.git/hooks/main.ts': HIT,
    // Build output paths declared in angular.json (a string and an object with base).
    'build/app/main.ts': HIT,
    'out/server/main.ts': HIT,
    '.gitignore': 'generated/\n*.local.ts\n!keep.local.ts\nsrc/app/ignored.component.html\n',
    'generated/api.ts': HIT,
    'src/app/dev.local.ts': HIT,
    'src/app/keep.local.ts': HIT,
    'src/.gitignore': 'app/private/\n',
    'src/app/private/hidden.ts': HIT,
    'src/app/private.ts': HIT,
    'src/app/ignored.component.html': '<ngForm></ngForm>\n',
  });
  try {
    mkdirSync(path.join(root, 'links'));
    symlinkSync(outside, path.join(root, 'links', 'outside'), 'junction');
    linked = true;
  } catch {
    linked = false;
  }
  result = await scan(root, TEST_DATA);
});

afterAll(() => {
  removeFolder(root);
  removeFolder(outside);
});

function scannedFiles(): string[] {
  return [...new Set(result.findings.map((finding) => finding.file))];
}

describe('file walk', () => {
  it('skips dependency, build, cache and Git folders at any depth', () => {
    const files = scannedFiles();
    for (const folder of ['node_modules/', 'src/node_modules/', 'dist/', 'out-tsc/', '.angular/', 'coverage/', '.git/']) {
      expect(files.filter((file) => file.startsWith(folder)), folder).toEqual([]);
    }
  });

  it('skips the output paths angular.json declares', async () => {
    expect(scannedFiles().filter((file) => file.startsWith('build/') || file.startsWith('out/'))).toEqual([]);
    expect(await buildOutputFolders(root, 1024 * 1024)).toEqual(['build/app', 'out/server']);
  });

  it('applies .gitignore rules from the root and nested folders, including negation', () => {
    const files = scannedFiles();
    expect(files).not.toContain('generated/api.ts');
    expect(files).not.toContain('src/app/dev.local.ts');
    expect(files).not.toContain('src/app/private/hidden.ts');
    expect(files).not.toContain('src/app/ignored.component.html');
    expect(files).toContain('src/app/keep.local.ts');
    expect(files).toContain('src/app/private.ts');
  });

  it('does not follow symbolic links out of the project', (context) => {
    if (!linked) context.skip();
    expect(scannedFiles().filter((file) => file.startsWith('links/'))).toEqual([]);
  });

  it('lists oversized files as unscanned without reading them', async () => {
    const project = tempFolder('ngup-scan-size-');
    try {
      writeFiles(project, {
        'small.ts': HIT,
        'large.ts': `${HIT}${'// padding\n'.repeat(20)}`,
        'large.component.html': `<ngForm></ngForm>${' '.repeat(200)}`,
        'large-unused.html': ' '.repeat(200),
      });
      const sized = await scan(project, TEST_DATA, { maxFileBytes: 100 });
      expect(sized.findings.map((finding) => finding.file)).toEqual(['small.ts']);
      expect(sized.unscanned).toEqual([
        { file: 'large.component.html', reason: 'larger than 100 bytes, not read' },
        { file: 'large.ts', reason: 'larger than 100 bytes, not read' },
      ]);
    } finally {
      removeFolder(project);
    }
  });
});

describe('file kinds', () => {
  it('reads TypeScript, HTML, angular.json and tsconfig files only', () => {
    expect(fileKind('app.component.ts')).toBe('typescript');
    expect(fileKind('typings.d.ts')).toBeNull();
    expect(fileKind('app.component.html')).toBe('html');
    expect(fileKind('angular.json')).toBe('angular-json');
    expect(fileKind('tsconfig.json')).toBe('tsconfig');
    expect(fileKind('tsconfig.app.json')).toBe('tsconfig');
    expect(fileKind('package.json')).toBeNull();
    expect(fileKind('main.js')).toBeNull();
  });
});
