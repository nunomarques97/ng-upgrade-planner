// Helpers for reading parsed JSON or YAML without trusting inherited properties: a dependency
// called `constructor` must not resolve to Object.prototype.constructor.

export type PlainObject = Record<string, unknown>;

export function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function own(obj: PlainObject, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

export function ownObject(obj: PlainObject, key: string): PlainObject | undefined {
  const value = own(obj, key);
  return isPlainObject(value) ? value : undefined;
}

export function ownString(obj: PlainObject, key: string): string | undefined {
  const value = own(obj, key);
  return typeof value === 'string' ? value : undefined;
}

/** Strips a UTF-8 byte order mark, which some editors add to JSON files. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
