// The removed-API, deprecated-API and RxJS datasets indexed for the scanners. All kinds of entry
// match by the same rules; the scan sorts the matches into removed-API, deprecation and RxJS findings.
import type {
  DeprecatedSymbolEntry,
  DeprecatedTemplateEntry,
  RemovedConfigEntry,
  RemovedSymbolEntry,
  RemovedTemplateEntry,
  RxjsSymbolEntry,
  ScanDataEntry,
} from '../data/types.js';

type SymbolEntry = RemovedSymbolEntry | DeprecatedSymbolEntry | RxjsSymbolEntry;

export interface TemplateMatcher {
  entry: RemovedTemplateEntry | DeprecatedTemplateEntry;
  pattern: RegExp;
}

/** A dataset entry found at an offset of a file's text. */
export interface RawMatch {
  entry: ScanDataEntry;
  offset: number;
  /** Present when the match was made by text rather than structure. */
  heuristic?: string;
}

type SymbolIndex = ReadonlyMap<string, readonly SymbolEntry[]>;

export interface Matchers {
  /** Any import of the entry point (symbol '*'), by package. */
  wholePackage: SymbolIndex;
  /** The symbol itself, by package and symbol. */
  plain: SymbolIndex;
  /** A static member read on the symbol (member without key). */
  member: SymbolIndex;
  /** A property of an object literal passed to a call of the symbol (key without member). */
  callKey: SymbolIndex;
  /** A property of an object literal passed to a call of a member (member and key). */
  memberCallKey: SymbolIndex;
  /** A type reference without type arguments. */
  bareType: SymbolIndex;
  /** A call of the symbol with fewer arguments than the entry's minArguments. */
  fewerArguments: SymbolIndex;
  templates: readonly TemplateMatcher[];
  configs: readonly RemovedConfigEntry[];
}

const NONE: readonly SymbolEntry[] = [];

export function symbolKey(packageName: string, symbol: string): string {
  return `${packageName} ${symbol}`;
}

export function lookup(index: SymbolIndex, key: string): readonly SymbolEntry[] {
  return index.get(key) ?? NONE;
}

function add(index: Map<string, SymbolEntry[]>, key: string, entry: SymbolEntry): void {
  const list = index.get(key);
  if (list) list.push(entry);
  else index.set(key, [entry]);
}

export function buildMatchers(entries: readonly ScanDataEntry[]): Matchers {
  const wholePackage = new Map<string, SymbolEntry[]>();
  const plain = new Map<string, SymbolEntry[]>();
  const member = new Map<string, SymbolEntry[]>();
  const callKey = new Map<string, SymbolEntry[]>();
  const memberCallKey = new Map<string, SymbolEntry[]>();
  const bareType = new Map<string, SymbolEntry[]>();
  const fewerArguments = new Map<string, SymbolEntry[]>();
  const templates: TemplateMatcher[] = [];
  const configs: RemovedConfigEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === 'template') {
      templates.push({ entry, pattern: new RegExp(entry.pattern, 'g') });
    } else if (entry.kind === 'config') {
      configs.push(entry);
    } else if (entry.symbol === '*') {
      add(wholePackage, entry.package, entry);
    } else {
      const key = symbolKey(entry.package, entry.symbol);
      if ('minArguments' in entry && entry.minArguments !== undefined) add(fewerArguments, key, entry);
      else if ('withoutTypeArguments' in entry && entry.withoutTypeArguments) add(bareType, key, entry);
      else if (entry.member !== undefined && 'key' in entry && entry.key !== undefined) add(memberCallKey, key, entry);
      else if (entry.member !== undefined) add(member, key, entry);
      else if ('key' in entry && entry.key !== undefined) add(callKey, key, entry);
      else add(plain, key, entry);
    }
  }
  return { wholePackage, plain, member, callKey, memberCallKey, bareType, fewerArguments, templates, configs };
}
