// A real scan of the synthetic project with the bundled removed-API data, fed into a plan:
// builder option findings must land in the hop to the major that removed them.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { buildPlan, type UpgradePlan } from '../../src/plan/index.js';
import type { PackageRecord, VersionRecord } from '../../src/registry/types.js';
import { scan } from '../../src/scan/index.js';
import { copySyntheticProject, removeFolder } from '../scan/helpers.js';
import { guide, memorySource, project, record } from './helpers.js';

/** @angular/core releases 11 to 20, one per major, with peers and engines that never block. */
function coreRecords(): PackageRecord[] {
  const versions: Record<string, VersionRecord> = {};
  for (let major = 11; major <= 20; major++) {
    versions[`${major}.2.0`] = { peerDependencies: { rxjs: '^6.5.3 || ^7.4.0', 'zone.js': '*' }, engines: { node: '>=10' } };
  }
  return [record('@angular/core', versions, '20.2.0')];
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
