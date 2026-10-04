// A real scan of the synthetic projects with the bundled data, fed into a plan: builder option
// findings must land in the hop to the major that removed them, and deprecation warnings in the
// hop before the announced removal.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEPRECATED_APIS, deprecationCoverage } from '../../src/data/deprecated-apis.js';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { buildPlan, type UpgradePlan } from '../../src/plan/index.js';
import { renderHtml } from '../../src/report/html.js';
import { planJson } from '../../src/report/json.js';
import { renderMarkdown } from '../../src/report/markdown.js';
import { renderTerminal } from '../../src/report/terminal.js';
import type { PackageRecord, VersionRecord } from '../../src/registry/types.js';
import { scan } from '../../src/scan/index.js';
import { copySyntheticProject, removeFolder } from '../scan/helpers.js';
import { guide, memorySource, project, record } from './helpers.js';

/** @angular/core releases 11 to `last`, one per major, with peers and engines that never block. */
function coreRecords(last = 20): PackageRecord[] {
  const versions: Record<string, VersionRecord> = {};
  for (let major = 11; major <= last; major++) {
    versions[`${major}.2.0`] = { peerDependencies: { rxjs: '^6.5.3 || ^7.4.0', 'zone.js': '*' }, engines: { node: '>=10' } };
  }
  return [record('@angular/core', versions, `${last}.2.0`)];
}

let root: string;
let result: UpgradePlan;

beforeAll(async () => {
  root = copySyntheticProject();
  const scanned = await scan(root, REMOVED_APIS);
  result = await buildPlan(
    project('11.2.0'),
    memorySource(coreRecords()),
    { nodeVersion: '22.12.0', targetMajor: 20, scan: { result: scanned, coverage: REMOVED_APIS } },
    guide([], 20),
  );
});

afterAll(() => removeFolder(root));

describe('builder option findings in the plan', () => {
  const angularJsonFindings = (to: number): string[] =>
    (result.hops.find((hop) => hop.to === to)?.removedApis ?? [])
      .filter((finding) => finding.file === 'angular.json')
      .map((finding) => `${finding.line} ${finding.entryId}`);

  it('plans one hop per major from 12 to 20', () => {
    expect(result.hops.map((hop) => hop.to)).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('attaches extractCss and the tslint builder to the hop to 13', () => {
    expect(angularJsonFindings(13)).toEqual([
      '14 v13-build-angular-extract-css',
      '16 v13-build-angular-extract-css',
      '43 v13-build-angular-tslint-builder',
      '62 v13-build-angular-extract-css',
      '67 v13-build-angular-extract-css',
    ]);
  });

  it('attaches browserTarget in the dev-server and extract-i18n targets to the hop to 19', () => {
    expect(angularJsonFindings(19)).toEqual([
      '26 v19-build-angular-browser-target',
      '28 v19-build-angular-browser-target',
      '33 v19-build-angular-browser-target',
      '34 v19-build-angular-browser-target',
      '71 v19-build-angular-browser-target',
    ]);
    const finding = result.hops.find((hop) => hop.to === 19)?.removedApis.find((item) => item.line === 26);
    expect(finding).toMatchObject({
      package: '@angular-devkit/build-angular',
      api: 'angular.json browserTarget (dev-server, extract-i18n)',
      replacement: 'buildTarget',
      migration: 'yes',
      confidence: 'confirmed',
    });
  });

  it('attaches no angular.json finding to the other hops', () => {
    for (const hop of result.hops) {
      if (hop.to === 13 || hop.to === 16 || hop.to === 19) continue;
      expect(angularJsonFindings(hop.to), `hop to ${hop.to}`).toEqual([]);
    }
    // The hop to 16 holds only the workspace options defaultProject and defaultCollection.
    expect(angularJsonFindings(16).every((line) => line.includes('v16-cli-default-'))).toBe(true);
  });
});

describe('bundled deprecation warnings in the plan', () => {
  const DEPRECATIONS = fileURLToPath(new URL('../fixtures/synthetic/scan/deprecations', import.meta.url));
  let plan: UpgradePlan;

  beforeAll(async () => {
    const scanned = await scan(DEPRECATIONS, REMOVED_APIS, { deprecations: DEPRECATED_APIS });
    plan = await buildPlan(
      project('20.3.0'),
      memorySource(coreRecords(22)),
      {
        nodeVersion: '22.12.0',
        targetMajor: 22,
        scan: { result: scanned, coverage: REMOVED_APIS, deprecations: deprecationCoverage(DEPRECATED_APIS) },
      },
      guide([], 22),
    );
  });

  it('warns about removals announced for 23 in the hop to 22 and counts the removal in 24 as outside the plan', () => {
    expect(plan.hops.map((hop) => [hop.to, hop.deprecations.length])).toEqual([
      [21, 0],
      [22, 11],
    ]);
    const ids = new Set(plan.hops[1]!.deprecations.map((finding) => finding.entryId));
    expect([...ids].every((id) => id.startsWith('d23-'))).toBe(true);
    expect(plan.scan.deprecations).toEqual({
      coverage: { removalMajors: [23, 24], retrieved: DEPRECATED_APIS.retrieved },
      findings: 12,
      attached: 11,
      notAttached: { atOrBelowCurrent: 0, aboveTarget: 1, noHop: 0 },
    });
  });

  it('keeps the warnings out of the removed APIs and the effort', () => {
    const hop = plan.hops[1]!;
    expect(hop.removedApis.some((finding) => finding.entryId.startsWith('d2'))).toBe(false);
    expect(hop.effort.breakdown.removedApis).toBe(0);
    expect(hop.effort.counts.blockers).toBe(0);
  });
});

describe('Angular Material and CDK findings in the plan and the reports', () => {
  const MATERIAL = fileURLToPath(new URL('../fixtures/synthetic/scan/material', import.meta.url));
  const META = { toolVersion: '0.0.0-test' };
  let plan: UpgradePlan;

  beforeAll(async () => {
    const scanned = await scan(MATERIAL, REMOVED_APIS);
    plan = await buildPlan(
      project('16.2.0'),
      memorySource(coreRecords(22)),
      { nodeVersion: '22.12.0', targetMajor: 22, scan: { result: scanned, coverage: REMOVED_APIS } },
      guide([], 22),
    );
  });

  const ids = (to: number): string[] => (plan.hops.find((hop) => hop.to === to)?.removedApis ?? []).map((finding) => finding.entryId);

  it('attaches each finding to the hop of the Angular major that removed the API', () => {
    expect(plan.hops.map((hop) => hop.to)).toEqual([17, 18, 19, 20, 21, 22]);
    expect(ids(17)).toEqual(['v17-material-legacy-button']);
    expect(ids(18)).toEqual([]);
    expect(ids(19)).toEqual([]);
    expect(ids(20).sort()).toEqual([
      'v20-cdk-portal-dom-portal-host',
      'v20-cdk-portal-portal-injector',
      'v20-material-select-mat-select-animations-transform-panel-wrap',
    ]);
    expect(ids(21).sort()).toEqual(['v21-material-core-mat-common-module', 'v21-material-select-mat-select-animations']);
    expect(ids(22)).toEqual(['v22-material-list-checkbox-position-input']);
    // 9, 10, 11, 13 and 14 are at or below the installed 16: counted, not listed.
    expect(plan.scan.findings).toBe(15);
    expect(plan.scan.attached).toBe(7);
  });

  it('adds the Material and CDK findings to the effort of their hop', () => {
    // migration no: 3 points per distinct API.
    expect(plan.hops.find((hop) => hop.to === 17)?.effort.breakdown.removedApis).toBe(3);
    expect(plan.hops.find((hop) => hop.to === 20)?.effort.breakdown.removedApis).toBe(9);
  });

  it('shows the findings in the terminal, Markdown, HTML and JSON reports', () => {
    const terminal = renderTerminal(plan, { color: false, reports: null });
    const markdown = renderMarkdown(plan, META);
    const html = renderHtml(plan, META);
    const json = planJson(plan, META);
    for (const [name, text] of [
      ['terminal', terminal],
      ['markdown', markdown],
      ['html', html],
    ] as const) {
      expect(text, name).toContain('@angular/material/legacy-button');
      expect(text, name).toContain('MatCommonModule');
    }
    expect(markdown).toContain('src/app/lists.component.html:3');
    expect(html).toContain('src/app/lists.component.html:3');
    const hop = (to: number) => json.hops.find((item) => item.to === to);
    expect(hop(17)?.removedApis.map((finding) => finding.id)).toEqual(['v17-material-legacy-button']);
    expect(hop(22)?.removedApis[0]).toMatchObject({
      id: 'v22-material-list-checkbox-position-input',
      package: '@angular/material/list',
      fixedByMigration: 'no',
      confidence: 'heuristic',
    });
    expect(hop(22)?.removedApis[0]?.source).toMatch(/^https:\/\/github\.com\/angular\/components\/blob\//);
  });
});
