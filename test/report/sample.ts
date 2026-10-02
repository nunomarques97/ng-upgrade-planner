// A realistic sample plan built by the real planner from in-memory registry data: updates, a
// blocker, an unclassified private package, an undecidable library, stale cache data, a version
// guessed from a range, unmet framework requirements, a long library name and removed-API scan
// findings (confirmed, repeated, heuristic, outside the plan and an unscanned file). The JSON snapshot
// of this plan (sample-plan.json) is what the report tests and scripts/screenshot-report.mjs render.
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { buildPlan, type UpgradePlan } from '../../src/plan/index.js';
import type { PackageRecord, VersionRecord } from '../../src/registry/types.js';
import type { ScanFinding, ScanResult } from '../../src/scan/index.js';
import { TEMPLATE_REASON } from '../../src/scan/template.js';
import { angularRecords, dependency, memorySource, project, record } from '../plan/helpers.js';

const core = (range: string): VersionRecord => ({ peerDependencies: { '@angular/core': range } });

function libraries(): PackageRecord[] {
  const cdk = record('@angular/cdk', {
    '14.2.7': { peerDependencies: { '@angular/common': '^14.0.0 || ^15.0.0', '@angular/core': '^14.0.0 || ^15.0.0' } },
    '15.2.9': { peerDependencies: { '@angular/common': '^15.0.0 || ^16.0.0', '@angular/core': '^15.0.0 || ^16.0.0' } },
    '16.2.14': { peerDependencies: { '@angular/common': '^16.0.0 || ^17.0.0', '@angular/core': '^16.0.0 || ^17.0.0' } },
    '17.3.10': { peerDependencies: { '@angular/common': '^17.0.0 || ^18.0.0', '@angular/core': '^17.0.0 || ^18.0.0' } },
  });
  const material = record('@angular/material', {
    '14.2.7': { peerDependencies: { '@angular/cdk': '14.2.7', '@angular/core': '^14.0.0 || ^15.0.0' } },
    '15.2.9': { peerDependencies: { '@angular/cdk': '15.2.9', '@angular/core': '^15.0.0 || ^16.0.0' } },
    '16.2.14': { peerDependencies: { '@angular/cdk': '16.2.14', '@angular/core': '^16.0.0 || ^17.0.0' } },
    '17.3.10': { peerDependencies: { '@angular/cdk': '17.3.10', '@angular/core': '^17.0.0 || ^18.0.0' } },
  });
  const ngrx = record('@ngrx/store', {
    '14.3.3': core('^14.0.0'),
    '15.4.0': core('^15.0.0'),
    '16.3.0': core('^16.0.0'),
    '17.2.0': core('^17.0.0'),
  });
  const translate = record('@ngx-translate/core', {
    '14.0.0': core('>=13.0.0'),
    '15.0.0': core('>=16.0.0'),
  });
  const datepicker = record('ngx-legacy-datepicker', {
    '2.0.0': { ...core('>=12.0.0 <15.0.0'), deprecated: 'No longer maintained. Use the Angular Material datepicker instead.' },
  });
  const longName = record('@enterprise-platform-shared/angular-extremely-long-component-library-name', {
    '3.1.0': core('>=14.0.0 <18.0.0'),
  });
  const toastr = record('ngx-toastr', {
    '15.2.2': core('>=14.0.0-0'),
    '16.2.0': core('>=15.0.0-0'),
    '17.0.2': core('>=16.0.0-0'),
    '18.0.0': core('>=17.0.0-0'),
  });
  // Its @angular/flex-layout peer has no registry data, so it cannot be decided.
  const flexGrid = record('ngx-flex-grid', {
    '2.0.0': { peerDependencies: { '@angular/core': '>=14.0.0', '@angular/flex-layout': '>=14.0.0-beta.40' } },
  });
  return [cdk, material, ngrx, translate, datepicker, longName, toastr, flexGrid];
}

/** A finding for a bundled data entry, as the scan reports it. */
function found(entryId: string, file: string, line: number, column: number): ScanFinding {
  const entry = REMOVED_APIS.entries.find((item) => item.id === entryId);
  if (!entry) throw new Error(`no removed-API entry ${entryId}`);
  return {
    file,
    line,
    column,
    entryId,
    package: entry.package,
    api: entry.label,
    change: entry.change,
    major: entry.major,
    replacement: entry.replacement,
    migration: entry.migration,
    confidence: 'confirmed',
  };
}

function scanResult(): ScanResult {
  // A template match is always heuristic. The bundled data has no template entry for 15 to 17, so
  // this one is written for the sample.
  const template: ScanFinding = {
    file: 'src/app/checkout/checkout.component.html',
    line: 44,
    column: 9,
    entryId: 'sample-template-binding',
    package: '@angular/forms',
    api: 'sampleLegacy template binding',
    change: 'removed',
    major: 16,
    replacement: 'the sampleInput binding',
    migration: 'unknown',
    confidence: 'heuristic',
    reason: TEMPLATE_REASON,
  };
  return {
    filesScanned: 312,
    findings: [
      found('v14-core-testing-aot-summaries', 'src/app/app.component.spec.ts', 18, 7),
      found('v15-router-relative-link-resolution', 'src/app/app-routing.module.ts', 12, 51),
      found('v15-compiler-cli-enable-ivy', 'tsconfig.json', 24, 5),
      found('v16-cli-default-project', 'angular.json', 5, 3),
      found('v16-core-ng-module-entry-components', 'src/app/admin/admin.module.ts', 22, 3),
      found('v16-core-ng-module-entry-components', 'src/app/shared/shared.module.ts', 31, 3),
      found(
        'v16-core-reflective-injector',
        'src/app/features/enterprise-reporting/legacy-dashboard-widgets/reflective-injector-factory.service.ts',
        7,
        10,
      ),
      template,
      found('v17-router-malformed-uri-error-handler', 'src/app/app-routing.module.ts', 13, 5),
      found('v18-platform-browser-transfer-state', 'src/app/state/transfer.service.ts', 2, 10),
    ],
    unscanned: [{ file: 'src/app/generated/api-client.ts', reason: 'larger than 1024 kB, not read' }],
  };
}

export async function samplePlan(): Promise<UpgradePlan> {
  const records = [...angularRecords(), ...libraries()];
  const toastr = records.find((r) => r.name === 'ngx-toastr')!;
  const source = memorySource(records, {
    'ngx-toastr': {
      status: 'ok',
      name: 'ngx-toastr',
      record: { ...toastr, fetchedAt: '2026-06-14T08:30:00.000Z' },
      source: 'cache',
      stale: true,
      fallbackReason: 'network error: getaddrinfo ENOTFOUND registry.npmjs.org',
    },
  });
  const app = project(
    '14.2.12',
    [
      dependency('@angular/cdk', '14.2.7'),
      dependency('@angular/material', '14.2.7'),
      dependency('@ngrx/store', '14.3.3'),
      dependency('@ngx-translate/core', '14.0.0', { source: 'range-minimum', range: '^14.0.0' }),
      dependency('ngx-legacy-datepicker', '2.0.0'),
      dependency('@enterprise-platform-shared/angular-extremely-long-component-library-name', '3.1.0'),
      dependency('ngx-toastr', '15.2.2'),
      dependency('ngx-flex-grid', '2.0.0'),
      dependency('private-ui-kit', '1.4.0'),
    ],
    { typescript: '4.7.4', 'zone.js': '0.11.8' },
  );
  app.name = 'demo-shop';
  app.warnings = [
    { code: 'not-in-lockfile', message: '@ngx-translate/core has no usable entry in package-lock.json; falling back to the package.json range.' },
  ];
  return buildPlan(app, source, {
    targetMajor: 17,
    nodeVersion: '16.20.2',
    scan: { result: scanResult(), coverage: REMOVED_APIS },
  });
}
