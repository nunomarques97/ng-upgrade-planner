// A small JSON-with-comments reader for angular.json and tsconfig files. It keeps the offset of
// every property key so findings can point at a line, and stores objects as entry lists, so keys
// such as __proto__ are plain data.

export interface JsoncProperty {
  key: string;
  /** Offset of the opening quote of the key. */
  offset: number;
  value: JsoncValue;
}

export interface JsoncString {
  kind: 'string';
  value: string;
}

export type JsoncValue =
  | { kind: 'object'; properties: JsoncProperty[] }
  | { kind: 'array'; items: JsoncValue[] }
  | JsoncString
  | { kind: 'other' };

export class JsoncError extends Error {
  constructor(message: string, offset: number) {
    super(`${message} at offset ${offset}`);
    this.name = 'JsoncError';
  }
}

const MAX_DEPTH = 256;
/** Space, tab, line feed, carriage return and the byte order mark. */
const BLANK_CODES: ReadonlySet<number> = new Set([0x20, 0x09, 0x0a, 0x0d, 0xfeff]);
const LITERAL = /true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

/** Parses JSON that may contain comments and trailing commas, as the Angular CLI and tsc accept. */
export function parseJsonc(text: string): JsoncValue {
  let index = 0;

  function skipBlank(): void {
    while (index < text.length) {
      const char = text[index];
      if (BLANK_CODES.has(text.charCodeAt(index))) {
        index++;
      } else if (char === '/' && text[index + 1] === '/') {
        const end = text.indexOf('\n', index);
        index = end === -1 ? text.length : end + 1;
      } else if (char === '/' && text[index + 1] === '*') {
        const end = text.indexOf('*/', index + 2);
        if (end === -1) throw new JsoncError('Unterminated comment', index);
        index = end + 2;
      } else {
        return;
      }
    }
  }

  function readString(): string {
    const start = index;
    index++;
    let value = '';
    while (index < text.length) {
      const char = text[index] ?? '';
      if (char === '"') {
        index++;
        return value;
      }
      if (char === '\\') {
        const next = text[index + 1] ?? '';
        if (next === 'u') {
          const hex = text.slice(index + 2, index + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new JsoncError('Invalid unicode escape', index);
          value += String.fromCharCode(parseInt(hex, 16));
          index += 6;
        } else {
          const escaped = Object.hasOwn(ESCAPES, next) ? ESCAPES[next] : undefined;
          if (escaped === undefined) throw new JsoncError('Invalid escape', index);
          value += escaped;
          index += 2;
        }
      } else if (char === '\n' || char === '\r') {
        throw new JsoncError('Line break in string', index);
      } else {
        value += char;
        index++;
      }
    }
    throw new JsoncError('Unterminated string', start);
  }

  function readValue(depth: number): JsoncValue {
    if (depth > MAX_DEPTH) throw new JsoncError('Nesting too deep', index);
    skipBlank();
    const char = text[index];
    if (char === '{') {
      index++;
      const properties: JsoncProperty[] = [];
      for (;;) {
        skipBlank();
        if (text[index] === '}') {
          index++;
          return { kind: 'object', properties };
        }
        if (text[index] !== '"') throw new JsoncError('Expected a property name', index);
        const offset = index;
        const key = readString();
        skipBlank();
        if (text[index] !== ':') throw new JsoncError('Expected ":"', index);
        index++;
        properties.push({ key, offset, value: readValue(depth + 1) });
        skipBlank();
        if (text[index] === ',') index++;
        else if (text[index] !== '}') throw new JsoncError('Expected "," or "}"', index);
      }
    }
    if (char === '[') {
      index++;
      const items: JsoncValue[] = [];
      for (;;) {
        skipBlank();
        if (text[index] === ']') {
          index++;
          return { kind: 'array', items };
        }
        items.push(readValue(depth + 1));
        skipBlank();
        if (text[index] === ',') index++;
        else if (text[index] !== ']') throw new JsoncError('Expected "," or "]"', index);
      }
    }
    if (char === '"') return { kind: 'string', value: readString() };
    LITERAL.lastIndex = index;
    const literal = LITERAL.exec(text);
    if (!literal) throw new JsoncError('Unexpected character', index);
    index += literal[0].length;
    return { kind: 'other' };
  }

  const root = readValue(0);
  skipBlank();
  if (index < text.length) throw new JsoncError('Unexpected content after the document', index);
  return root;
}

/** Properties reached by a path from the root; '*' matches any key. Keeps duplicate keys. */
export function propertiesAt(root: JsoncValue, path: readonly string[]): JsoncProperty[] {
  let current: JsoncValue[] = [root];
  let found: JsoncProperty[] = [];
  for (const part of path) {
    found = [];
    for (const value of current) {
      if (value.kind !== 'object') continue;
      for (const property of value.properties) {
        if (part === '*' || property.key === part) found.push(property);
      }
    }
    current = found.map((property) => property.value);
  }
  return found;
}
