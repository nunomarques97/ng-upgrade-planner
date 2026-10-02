// Lists the project files the scan reads. Never follows symbolic links, so it cannot leave the
// project folder, and skips dependency, build and cache folders and everything .gitignore excludes.
import type { Dirent } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ignore from 'ignore';
import { stripBom } from '../project/own.js';
import { parseJsonc, propertiesAt, type JsoncString } from './jsonc.js';
import { shortMessage } from './text.js';
import type { UnscannedFile } from './types.js';

/** Folder names skipped at any depth: dependencies, build output, caches and Git metadata. */
export const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'out-tsc',
  '.angular',
  'coverage',
  '.git',
]);

export type ProjectFileKind = 'typescript' | 'html' | 'angular-json' | 'tsconfig';

export interface ProjectFile {
  /** Relative to the project folder, with forward slashes. */
  file: string;
  absolute: string;
  kind: ProjectFileKind;
  size: number;
}

export interface WalkResult {
  /** In walk order: folders and names sorted by code unit. */
  files: ProjectFile[];
  unscanned: UnscannedFile[];
}

interface IgnoreScope {
  /** Folder of the .gitignore file, relative to the project ('' for the root). */
  base: string;
  rules: ignore.Ignore;
}

export function fileKind(name: string): ProjectFileKind | null {
  if (name.endsWith('.d.ts')) return null;
  if (name.endsWith('.ts')) return 'typescript';
  if (name.endsWith('.html')) return 'html';
  if (name === 'angular.json') return 'angular-json';
  if (/^tsconfig.*\.json$/.test(name)) return 'tsconfig';
  return null;
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return error instanceof Error ? shortMessage(error.message) : 'unknown error';
}

function isIgnored(file: string, isFolder: boolean, scopes: readonly IgnoreScope[]): boolean {
  let ignored = false;
  for (const scope of scopes) {
    const relative = scope.base === '' ? file : file.slice(scope.base.length + 1);
    try {
      const result = scope.rules.test(isFolder ? `${relative}/` : relative);
      if (result.ignored) ignored = true;
      else if (result.unignored) ignored = false;
    } catch {
      // A name the rules cannot express (for example one with a backslash) is not ignored.
    }
  }
  return ignored;
}

/**
 * Output folders that angular.json declares for any target (`outputPath`, a string or an object
 * with `base`), relative to the project. Paths outside the project are dropped.
 */
export async function buildOutputFolders(root: string, maxFileBytes: number): Promise<string[]> {
  const file = path.join(root, 'angular.json');
  let text: string;
  try {
    const stats = await lstat(file);
    if (!stats.isFile() || stats.size > maxFileBytes) return [];
    text = stripBom(await readFile(file, 'utf8'));
  } catch {
    return [];
  }
  let document;
  try {
    document = parseJsonc(text);
  } catch {
    return [];
  }
  const folders = new Set<string>();
  for (const property of propertiesAt(document, ['projects', '*', 'architect', '*', 'options', 'outputPath'])) {
    const candidates = property.value.kind === 'string' ? [property.value] : propertiesAt(property.value, ['base']).map((base) => base.value);
    const value = candidates.find((candidate): candidate is JsoncString => candidate.kind === 'string')?.value;
    if (!value) continue;
    const normalized = path.posix.normalize(value.replace(/\\/g, '/')).replace(/\/+$/, '');
    if (normalized === '' || normalized === '.' || normalized.startsWith('../') || normalized === '..') continue;
    if (path.posix.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) continue;
    folders.add(normalized.replace(/^\.\//, ''));
  }
  return [...folders].sort();
}

async function entryType(absolute: string, entry: Dirent): Promise<'file' | 'folder' | 'other'> {
  if (entry.isSymbolicLink()) return 'other';
  if (entry.isFile()) return 'file';
  if (entry.isDirectory()) return 'folder';
  // Some file systems do not report the type; ask without following links.
  try {
    const stats = await lstat(absolute);
    if (stats.isFile()) return 'file';
    if (stats.isDirectory()) return 'folder';
  } catch {
    // Treated as other.
  }
  return 'other';
}

export async function walkProject(root: string, maxFileBytes: number): Promise<WalkResult> {
  const files: ProjectFile[] = [];
  const unscanned: UnscannedFile[] = [];
  const outputFolders = new Set(await buildOutputFolders(root, maxFileBytes));

  async function visit(folder: string, inherited: readonly IgnoreScope[]): Promise<void> {
    const absoluteFolder = folder === '' ? root : path.join(root, ...folder.split('/'));
    let entries: Dirent[];
    try {
      entries = await readdir(absoluteFolder, { withFileTypes: true });
    } catch (error) {
      unscanned.push({ file: folder === '' ? '.' : folder, reason: `folder could not be read (${errorCode(error)})` });
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    let scopes = inherited;
    const gitignore = entries.find((entry) => entry.name === '.gitignore' && entry.isFile());
    if (gitignore) {
      try {
        const rules = ignore().add(stripBom(await readFile(path.join(absoluteFolder, '.gitignore'), 'utf8')));
        scopes = [...inherited, { base: folder, rules }];
      } catch (error) {
        const file = folder === '' ? '.gitignore' : `${folder}/.gitignore`;
        unscanned.push({ file, reason: `could not be read, its rules were not applied (${errorCode(error)})` });
      }
    }

    for (const entry of entries) {
      const file = folder === '' ? entry.name : `${folder}/${entry.name}`;
      const absolute = path.join(absoluteFolder, entry.name);
      const type = await entryType(absolute, entry);
      if (type === 'folder') {
        if (SKIPPED_FOLDERS.has(entry.name) || outputFolders.has(file)) continue;
        if (isIgnored(file, true, scopes)) continue;
        await visit(file, scopes);
      } else if (type === 'file') {
        const kind = fileKind(entry.name);
        if (kind === null || isIgnored(file, false, scopes)) continue;
        try {
          const stats = await lstat(absolute);
          files.push({ file, absolute, kind, size: stats.size });
        } catch (error) {
          unscanned.push({ file, reason: `could not be read (${errorCode(error)})` });
        }
      }
    }
  }

  await visit('', []);
  return { files, unscanned };
}
