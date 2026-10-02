import { parseAllDocuments } from 'yaml';
import { describeCause, ProjectError } from '../errors.js';
import { isPlainObject, stripBom, type PlainObject } from '../own.js';

/**
 * Parses every YAML document in a lockfile into plain objects. Alias expansion is capped so a
 * crafted file cannot blow up memory.
 */
export function parseYamlDocuments(text: string, file: string): PlainObject[] {
  const fail = (detail: string): never => {
    throw new ProjectError('MALFORMED_LOCKFILE', `${file} is not valid YAML (${detail}).`, file);
  };
  let documents;
  try {
    documents = parseAllDocuments(stripBom(text));
  } catch (error) {
    return fail(describeCause(error));
  }
  const list = Array.isArray(documents) ? documents : [documents];
  const parsed: PlainObject[] = [];
  for (const doc of list) {
    const first = doc.errors[0];
    if (first) fail(describeCause(first));
    let value: unknown;
    try {
      value = doc.toJS({ maxAliasCount: 100 });
    } catch (error) {
      fail(describeCause(error));
    }
    if (isPlainObject(value)) parsed.push(value);
  }
  return parsed;
}
