import { describe, expect, it } from 'vitest';
import { parseJsonc, propertiesAt } from '../../src/scan/jsonc.js';

describe('parseJsonc', () => {
  it('accepts comments, trailing commas and escapes, and keeps key offsets', () => {
    const text = '// head\n{ /* a */ "a": { "b\\"c": [1, -2.5e3, true, null, "x\\u0041",], }, "d": "e\\n" }';
    const root = parseJsonc(text);
    const [inner] = propertiesAt(root, ['a', 'b"c']);
    expect(inner?.value).toEqual({ kind: 'array', items: [{ kind: 'other' }, { kind: 'other' }, { kind: 'other' }, { kind: 'other' }, { kind: 'string', value: 'xA' }] });
    expect(text.slice(inner?.offset ?? 0)).toMatch(/^"b\\"c"/);
    expect(propertiesAt(root, ['d'])[0]?.value).toEqual({ kind: 'string', value: 'e\n' });
  });

  it('stores keys such as __proto__ as plain data', () => {
    const root = parseJsonc('{ "__proto__": { "polluted": 1 }, "constructor": 2 }');
    expect(propertiesAt(root, ['__proto__', 'polluted'])).toHaveLength(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('matches any key with * and keeps duplicate keys', () => {
    const root = parseJsonc('{ "p": { "x": { "k": 1 }, "y": { "k": 2 }, "x": { "k": 3 } } }');
    expect(propertiesAt(root, ['p', '*', 'k'])).toHaveLength(3);
    expect(propertiesAt(root, ['p', 'x', 'k'])).toHaveLength(2);
    expect(propertiesAt(root, ['missing', 'k'])).toEqual([]);
    expect(propertiesAt(parseJsonc('[1]'), ['k'])).toEqual([]);
  });

  it.each([
    ['an unterminated string', '{ "a": "b }'],
    ['an unterminated comment', '{ /* }'],
    ['a missing value', '{ "a": }'],
    ['a bare word', '{ "a": yes }'],
    ['an unquoted key', '{ a: 1 }'],
    ['a bad escape', '{ "a": "\\x" }'],
    ['content after the document', '{} {}'],
    ['a line break in a string', '{ "a": "b\nc" }'],
    ['too deep nesting', `${'['.repeat(300)}${']'.repeat(300)}`],
    ['an empty document', ''],
  ])('rejects %s', (_name, text) => {
    expect(() => parseJsonc(text)).toThrow(/at offset \d+/);
  });
});
