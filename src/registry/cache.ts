// On-disk cache of trimmed package records: one JSON file per package, written atomically.
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stripBom } from '../project/own.js';
import { parseRecord } from './record.js';
import type { PackageRecord } from './types.js';

const APP_DIR = 'ng-upgrade-planner';
const MAX_ENCODED_LENGTH = 160;
// Device names Windows reserves even with an extension, such as nul.json.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/;

export interface CacheDirEnvironment {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  homedir: string;
}

/** The registry cache folder inside the OS user cache directory. */
export function defaultCacheDir(
  environment: CacheDirEnvironment = { platform: process.platform, env: process.env, homedir: os.homedir() },
): string {
  const { platform, env, homedir } = environment;
  let base: string;
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA;
    base = local && path.win32.isAbsolute(local) ? local : path.win32.join(homedir, 'AppData', 'Local');
    return path.win32.join(base, APP_DIR, 'Cache', 'registry');
  }
  if (platform === 'darwin') return path.posix.join(homedir, 'Library', 'Caches', APP_DIR, 'registry');
  const xdg = env.XDG_CACHE_HOME;
  base = xdg && path.posix.isAbsolute(xdg) ? xdg : path.posix.join(homedir, '.cache');
  return path.posix.join(base, APP_DIR, 'registry');
}

/**
 * File name for a package. Only lowercase letters, digits and `-` are kept; every other UTF-8
 * byte becomes `_` plus two hex digits, so separators, dots and drive letters cannot form a
 * path, and names differing only in case do not collide on case-insensitive file systems.
 * Windows device names get a `~` prefix. Very long names are shortened and made unique with
 * a hash.
 */
export function cacheFileName(name: string): string {
  let encoded = '';
  for (const byte of Buffer.from(name, 'utf8')) {
    const isSafe = (byte >= 0x61 && byte <= 0x7a) || (byte >= 0x30 && byte <= 0x39) || byte === 0x2d;
    encoded += isSafe ? String.fromCharCode(byte) : `_${byte.toString(16).padStart(2, '0')}`;
  }
  if (encoded.length === 0 || WINDOWS_RESERVED.test(encoded)) encoded = `~${encoded}`;
  if (encoded.length > MAX_ENCODED_LENGTH) {
    const hash = createHash('sha256').update(name, 'utf8').digest('hex').slice(0, 32);
    encoded = `${encoded.slice(0, MAX_ENCODED_LENGTH - 34)}~${hash}`;
  }
  return `${encoded}.json`;
}

const RENAME_RETRY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

export class RecordCache {
  readonly dir: string;

  constructor(dir: string) {
    this.dir = path.resolve(dir);
  }

  /** Absolute path of the cache file for `name`; always a direct child of the cache folder. */
  filePath(name: string): string {
    const file = path.join(this.dir, cacheFileName(name));
    if (path.dirname(file) !== this.dir) throw new Error('Cache file name escapes the cache folder.');
    return file;
  }

  /** Reads a record; a missing, unreadable, corrupt or schema-invalid file is a miss. */
  async read(name: string): Promise<PackageRecord | undefined> {
    let text: string;
    try {
      text = await readFile(this.filePath(name), 'utf8');
    } catch {
      return undefined;
    }
    try {
      return parseRecord(JSON.parse(stripBom(text)), name);
    } catch {
      return undefined;
    }
  }

  /** Writes a record atomically: a temporary file in the same folder, then a rename. */
  async write(record: PackageRecord): Promise<void> {
    const file = this.filePath(record.name);
    await mkdir(this.dir, { recursive: true });
    const temp = path.join(this.dir, `.${process.pid}-${randomBytes(6).toString('hex')}.tmp`);
    try {
      await writeFile(temp, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'wx' });
      await renameWithRetry(temp, file);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}

// On Windows a rename onto a file that another process is reading can fail briefly.
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      if (attempt >= 5 || typeof code !== 'string' || !RENAME_RETRY_CODES.has(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 20));
    }
  }
}
