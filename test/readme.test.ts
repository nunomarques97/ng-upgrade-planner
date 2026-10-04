// Checks that the figures README.md quotes match their sources: the precision block against the labelled
// results in docs/verification/scan-precision.json and the app manifest, and the dataset sizes against the
// bundled data.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPONENTS_REMOVED_APIS } from '../src/data/components-apis.js';
import { DEPRECATED_APIS } from '../src/data/deprecated-apis.js';
import { REMOVED_APIS } from '../src/data/removed-apis.js';
import { RXJS_APIS } from '../src/data/rxjs-apis.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface Results {
  scan: { version: string; date: string };
  apps: { id: string }[];
  findings: { app: string; family: string; label: string }[];
}

interface Counts {
  total: number;
  tp: number;
  fp: number;
}

function read(file: string): string {
  return readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
}

const readme = read('README.md');
const results = JSON.parse(read('docs/verification/scan-precision.json')) as Results;
const manifest = JSON.parse(read('scripts/real-apps.json')) as { apps: { id: string; angular: string }[] };

function count(findings: Results['findings']): Counts {
  return {
    total: findings.length,
    tp: findings.filter((finding) => finding.label === 'tp').length,
    fp: findings.filter((finding) => finding.label === 'fp').length,
  };
}

function precision(counts: Counts): string {
  return counts.tp + counts.fp === 0 ? 'n/a' : `${((100 * counts.tp) / (counts.tp + counts.fp)).toFixed(1)}%`;
}

function row(title: string, counts: Counts): string {
  return `| ${title} | ${counts.total} | ${counts.tp} | ${counts.fp} | ${precision(counts)} |`;
}

/** The precision block README.md must hold, computed from the labelled results. */
async function expectedBlock(): Promise<string> {
  const { FAMILIES } = (await import(pathToFileURL(path.join(root, 'scripts', 'scan-real-apps.mjs')).href)) as {
    FAMILIES: { id: string; title: string }[];
  };
  const majors = manifest.apps.map((app) => Number(app.angular.split('.')[0]));
  const total = count(results.findings);
  const sentence =
    `Measured with ng-upgrade-planner ${results.scan.version} on ${results.apps.length} open-source Angular apps ` +
    `(Angular ${Math.min(...majors)} to ${Math.max(...majors)}) on ${results.scan.date}: ${total.total} findings, ` +
    `${total.tp} true positives, ${total.fp} false positives, precision ${precision(total)}.`;
  return [
    sentence,
    '',
    '| Rule family | Findings | True positives | False positives | Precision |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...FAMILIES.map((family) =>
      row(family.title, count(results.findings.filter((finding) => finding.family === family.id))),
    ),
    row('All', total),
  ].join('\n');
}

function readmeBlock(): string {
  const match = /<!-- precision:start -->\n([\s\S]*?)\n<!-- precision:end -->/.exec(readme);
  expect(match, 'README.md has no precision block').not.toBeNull();
  // The sentence may be wrapped over several lines; the table rows may not.
  const [sentence, ...rest] = match![1]!.split('\n\n');
  return [sentence!.replace(/\n/g, ' '), ...rest].join('\n\n');
}

describe('README precision figures', () => {
  it('match docs/verification/scan-precision.json', async () => {
    expect(readmeBlock()).toBe(await expectedBlock());
  });

  it('count every labelled finding in exactly one rule family', async () => {
    const { FAMILIES } = (await import(pathToFileURL(path.join(root, 'scripts', 'scan-real-apps.mjs')).href)) as {
      FAMILIES: { id: string }[];
    };
    const ids = FAMILIES.map((family) => family.id);
    for (const finding of results.findings) expect(ids).toContain(finding.family);
    expect(results.apps.map((app) => app.id)).toEqual(manifest.apps.map((app) => app.id));
  });

  it('are measured with the version being released', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    expect(results.scan.version).toBe(pkg.version);
  });
});

describe('README dataset sizes', () => {
  const components = COMPONENTS_REMOVED_APIS.length;
  const angular = REMOVED_APIS.entries.length - components;
  const builders = REMOVED_APIS.entries.filter((entry) => 'option' in entry || 'builders' in entry).length;

  it.each([
    [`**Angular framework and CLI** (${angular} entries, Angular 9 to 22)`],
    [`${builders} of them are \`angular.json\`\n  builder options and builders`],
    [`**Angular Material and CDK** (${components} entries, 9 to 22)`],
    [`**Deprecations with an announced removal** (${DEPRECATED_APIS.entries.length} entries)`],
    [`**RxJS 6 to 7** (${RXJS_APIS.entries.length} entries)`],
  ])('quotes %s', (text) => {
    expect(readme).toContain(text);
  });

  it('covers the majors of the bundled data', () => {
    expect(REMOVED_APIS.firstMajor).toBe(9);
    expect(REMOVED_APIS.lastMajor).toBe(22);
  });
});
