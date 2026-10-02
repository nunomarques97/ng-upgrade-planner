// The removed-API dataset indexed for the scanners.
import type {
  RemovedApiData,
  RemovedApiEntry,
  RemovedConfigEntry,
  RemovedSymbolEntry,
  RemovedTemplateEntry,
} from '../data/types.js';

export interface TemplateMatcher {
  entry: RemovedTemplateEntry;
  pattern: RegExp;
}

/** A dataset entry found at an offset of a file's text. */
export interface RawMatch {
  entry: RemovedApiEntry;
  offset: number;
  /** Present when the match was made by text rather than structure. */
  heuristic?: string;
}

type SymbolIndex = ReadonlyMap<string, readonly RemovedSymbolEntry[]>;

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
  templates: readonly TemplateMatcher[];
  configs: readonly RemovedConfigEntry[];
}

const NONE: readonly RemovedSymbolEntry[] = [];

export function symbolKey(packageName: string, symbol: string): string {
  return `${packageName} ${symbol}`;
}

export function lookup(index: SymbolIndex, key: string): readonly RemovedSymbolEntry[] {
  return index.get(key) ?? NONE;
}

function add(index: Map<string, RemovedSymbolEntry[]>, key: string, entry: RemovedSymbolEntry): void {
  const list = index.get(key);
  if (list) list.push(entry);
  else index.set(key, [entry]);
}

export function buildMatchers(data: RemovedApiData): Matchers {
  const wholePackage = new Map<string, RemovedSymbolEntry[]>();
  const plain = new Map<string, RemovedSymbolEntry[]>();
  const member = new Map<string, RemovedSymbolEntry[]>();
  const callKey = new Map<string, RemovedSymbolEntry[]>();
  const memberCallKey = new Map<string, RemovedSymbolEntry[]>();
  const bareType = new Map<string, RemovedSymbolEntry[]>();
  const templates: TemplateMatcher[] = [];
  const configs: RemovedConfigEntry[] = [];

  for (const entry of data.entries) {
    if (entry.kind === 'template') {
      templates.push({ entry, pattern: new RegExp(entry.pattern, 'g') });
    } else if (entry.kind === 'config') {
      configs.push(entry);
    } else if (entry.symbol === '*') {
      add(wholePackage, entry.package, entry);
    } else {
      const key = symbolKey(entry.package, entry.symbol);
      if (entry.withoutTypeArguments) add(bareType, key, entry);
      else if (entry.member !== undefined && entry.key !== undefined) add(memberCallKey, key, entry);
      else if (entry.member !== undefined) add(member, key, entry);
      else if (entry.key !== undefined) add(callKey, key, entry);
      else add(plain, key, entry);
    }
  }
  return { wholePackage, plain, member, callKey, memberCallKey, bareType, templates, configs };
}
