// Import-aware matching of TypeScript sources. A symbol counts only when the name it is used
// under was imported from the dataset entry's package: named, aliased or namespace imports, and
// re-exports. Comments and strings are never matched because only the syntax tree is read.
// There is no scope analysis, so a local variable that shadows an import is still matched.
import { parse, type ParserOptions, type ParserPlugin } from '@babel/parser';
import type * as t from '@babel/types';
import { lookup, symbolKey, type Matchers, type RawMatch } from './matchers.js';
import { matchTemplate } from './template.js';

export interface TypeScriptScan {
  matches: RawMatch[];
  /** templateUrl values of @Component decorators, as written. */
  templateUrls: string[];
}

interface Binding {
  packageName: string;
  /** Exported name, '*' for a namespace import, 'default' for a default import. */
  imported: string;
}

interface Resolved {
  packageName: string;
  symbol: string;
}

const SKIPPED_KEYS = new Set([
  'type',
  'loc',
  'start',
  'end',
  'range',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'comments',
  'errors',
]);

function isNode(value: unknown): value is t.Node {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function offsetOf(node: t.Node): number {
  return node.start ?? 0;
}

function nameOf(node: t.Identifier | t.StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}

function memberName(node: t.MemberExpression | t.OptionalMemberExpression): string | null {
  const { property } = node;
  if (node.computed) return property.type === 'StringLiteral' ? property.value : null;
  return property.type === 'Identifier' ? property.name : null;
}

function propertyName(node: t.ObjectExpression['properties'][number]): string | null {
  if (node.type === 'SpreadElement') return null;
  const { key } = node;
  if (key.type === 'StringLiteral') return key.value;
  if (!node.computed && key.type === 'Identifier') return key.name;
  return null;
}

function isMember(node: t.Node): node is t.MemberExpression | t.OptionalMemberExpression {
  return node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression';
}

const COMMON_PLUGINS: ParserPlugin[] = ['typescript', 'decoratorAutoAccessors', 'explicitResourceManagement'];

/**
 * Angular code uses TypeScript's experimental decorators, including parameter decorators, which
 * Babel parses with `decorators-legacy`. Standard decorators placed after `export` need the
 * `decorators` plugin, so that is the fallback. Throws the first error when neither parses.
 */
function parseSource(text: string): t.File {
  const options = (decorators: ParserPlugin): ParserOptions => ({
    sourceType: 'module',
    plugins: [...COMMON_PLUGINS, decorators],
    attachComment: false,
  });
  try {
    return parse(text, options('decorators-legacy'));
  } catch (legacyError) {
    try {
      return parse(text, options('decorators'));
    } catch {
      throw legacyError;
    }
  }
}

/** Throws when the source cannot be parsed. */
export function scanTypeScript(text: string, matchers: Matchers): TypeScriptScan {
  const ast = parseSource(text);
  const matches: RawMatch[] = [];
  const templateUrls: string[] = [];
  const bindings = new Map<string, Binding>();

  const matchAll = (entries: readonly RawMatch['entry'][], node: t.Node): void => {
    for (const entry of entries) matches.push({ entry, offset: offsetOf(node) });
  };

  const namespaceOf = (node: t.Node): string | null => {
    if (node.type !== 'Identifier') return null;
    const binding = bindings.get(node.name);
    return binding?.imported === '*' ? binding.packageName : null;
  };

  /** The imported symbol an expression or type name refers to, if any. */
  const resolve = (node: t.Node): Resolved | null => {
    if (node.type === 'TSNonNullExpression' || node.type === 'TSAsExpression' || node.type === 'ParenthesizedExpression') {
      return resolve(node.expression);
    }
    if (node.type === 'Identifier') {
      const binding = bindings.get(node.name);
      if (!binding || binding.imported === '*' || binding.imported === 'default') return null;
      return { packageName: binding.packageName, symbol: binding.imported };
    }
    if (isMember(node)) {
      const packageName = namespaceOf(node.object);
      const symbol = memberName(node);
      return packageName !== null && symbol !== null ? { packageName, symbol } : null;
    }
    if (node.type === 'TSQualifiedName') {
      const packageName = namespaceOf(node.left);
      return packageName !== null ? { packageName, symbol: node.right.name } : null;
    }
    return null;
  };

  const wholeImport = (source: t.StringLiteral): void => {
    matchAll(lookup(matchers.wholePackage, source.value), source);
  };

  // Imports and re-exports are module-level statements.
  for (const statement of ast.program.body) {
    if (statement.type === 'ImportDeclaration') {
      const packageName = statement.source.value;
      wholeImport(statement.source);
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') {
          bindings.set(specifier.local.name, { packageName, imported: '*' });
        } else if (specifier.type === 'ImportDefaultSpecifier') {
          bindings.set(specifier.local.name, { packageName, imported: 'default' });
        } else {
          const imported = nameOf(specifier.imported);
          bindings.set(specifier.local.name, { packageName, imported });
          matchAll(lookup(matchers.plain, symbolKey(packageName, imported)), specifier);
        }
      }
    } else if (statement.type === 'ExportNamedDeclaration' && statement.source) {
      const packageName = statement.source.value;
      wholeImport(statement.source);
      for (const specifier of statement.specifiers) {
        if (specifier.type !== 'ExportSpecifier') continue;
        // In `export { X as Y } from 'pkg'` the name in the package is the local one.
        matchAll(lookup(matchers.plain, symbolKey(packageName, nameOf(specifier.local))), specifier);
      }
    } else if (statement.type === 'ExportAllDeclaration') {
      wholeImport(statement.source);
    }
  }

  const objectArguments = (call: t.CallExpression | t.OptionalCallExpression): t.ObjectExpression[] =>
    call.arguments.filter((argument): argument is t.ObjectExpression => argument.type === 'ObjectExpression');

  const keyedProperties = (
    call: t.CallExpression | t.OptionalCallExpression,
    entries: readonly RawMatch['entry'][],
  ): void => {
    if (entries.length === 0) return;
    for (const object of objectArguments(call)) {
      for (const property of object.properties) {
        const name = propertyName(property);
        if (name === null || property.type === 'SpreadElement') continue;
        for (const entry of entries) {
          if (entry.kind === 'symbol' && entry.key === name) matches.push({ entry, offset: offsetOf(property.key) });
        }
      }
    }
  };

  const componentMetadata = (call: t.CallExpression | t.OptionalCallExpression): void => {
    for (const object of objectArguments(call)) {
      for (const property of object.properties) {
        if (property.type !== 'ObjectProperty') continue;
        const name = propertyName(property);
        const { value } = property;
        if (name === 'template') {
          if (value.type === 'StringLiteral') {
            const start = offsetOf(value) + 1;
            matches.push(...matchTemplate(text.slice(start, (value.end ?? start + 1) - 1), start, matchers.templates));
          } else if (value.type === 'TemplateLiteral') {
            for (const quasi of value.quasis) {
              const start = offsetOf(quasi);
              matches.push(...matchTemplate(text.slice(start, quasi.end ?? start), start, matchers.templates));
            }
          }
        } else if (name === 'templateUrl') {
          if (value.type === 'StringLiteral') templateUrls.push(value.value);
          else if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
            const cooked = value.quasis[0]?.value.cooked;
            if (cooked) templateUrls.push(cooked);
          }
        }
      }
    }
  };

  const visitCall = (call: t.CallExpression | t.OptionalCallExpression): void => {
    const { callee } = call;
    if (callee.type === 'Import') {
      const [source] = call.arguments;
      if (source?.type === 'StringLiteral') wholeImport(source);
      return;
    }
    const target = resolve(callee);
    if (target) {
      keyedProperties(call, lookup(matchers.callKey, symbolKey(target.packageName, target.symbol)));
      if (target.packageName === '@angular/core' && target.symbol === 'Component') componentMetadata(call);
    }
    if (isMember(callee)) {
      const owner = resolve(callee.object);
      const member = memberName(callee);
      if (owner && member !== null) {
        const entries = lookup(matchers.memberCallKey, symbolKey(owner.packageName, owner.symbol));
        keyedProperties(
          call,
          entries.filter((entry) => entry.member === member),
        );
      }
    }
  };

  const visit = (node: t.Node): void => {
    switch (node.type) {
      case 'CallExpression':
      case 'OptionalCallExpression':
        visitCall(node);
        break;
      case 'ImportExpression':
        if (node.source.type === 'StringLiteral') wholeImport(node.source);
        break;
      case 'MemberExpression':
      case 'OptionalMemberExpression': {
        const viaNamespace = resolve(node);
        if (viaNamespace) matchAll(lookup(matchers.plain, symbolKey(viaNamespace.packageName, viaNamespace.symbol)), node);
        const owner = resolve(node.object);
        const member = memberName(node);
        if (owner && member !== null) {
          const entries = lookup(matchers.member, symbolKey(owner.packageName, owner.symbol));
          matchAll(
            entries.filter((entry) => entry.member === member),
            node,
          );
        }
        break;
      }
      case 'TSQualifiedName': {
        const viaNamespace = resolve(node);
        if (viaNamespace) matchAll(lookup(matchers.plain, symbolKey(viaNamespace.packageName, viaNamespace.symbol)), node);
        break;
      }
      case 'TSTypeReference': {
        const target = resolve(node.typeName);
        const withArguments = node.typeParameters ?? (node as { typeArguments?: unknown }).typeArguments;
        if (target && !withArguments) {
          matchAll(lookup(matchers.bareType, symbolKey(target.packageName, target.symbol)), node);
        }
        break;
      }
      default:
        break;
    }
  };

  // Iterative walk over every node, so deeply nested code cannot overflow the stack.
  const stack: t.Node[] = [ast.program];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    visit(node);
    const fields = node as unknown as Record<string, unknown>;
    for (const key of Object.keys(fields)) {
      if (SKIPPED_KEYS.has(key)) continue;
      const value = fields[key];
      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index--) {
          const item: unknown = value[index];
          if (isNode(item)) stack.push(item);
        }
      } else if (isNode(value)) {
        stack.push(value);
      }
    }
  }

  return { matches, templateUrls };
}
