import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEPRECATED_APIS } from '../../src/data/deprecated-apis.js';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { RXJS_APIS } from '../../src/data/rxjs-apis.js';
import type { UpgradePlan } from '../../src/plan/types.js';
import { PLAN_JSON_SCHEMA_VERSION, planJson, renderJson, type PlanJson } from '../../src/report/index.js';

const META = { toolVersion: '0.1.0' };

function sample(): UpgradePlan {
  return JSON.parse(readFileSync(new URL('./sample-plan.json', import.meta.url), 'utf8')) as UpgradePlan;
}

function hop(document: PlanJson, to: number): PlanJson['hops'][number] {
  const found = document.hops.find((item) => item.to === to);
  if (!found) throw new Error(`no hop to ${to}`);
  return found;
}

describe('JSON plan', () => {
  it('has schema version 2 and the tool version', () => {
    const document = planJson(sample(), META);
    expect(PLAN_JSON_SCHEMA_VERSION).toBe(2);
    expect(document.schemaVersion).toBe(2);
    expect(document.tool).toEqual({ name: 'ng-upgrade-planner', version: '0.1.0' });
    expect(document.current).toEqual({ angular: '14.2.12', major: 14, confirmed: true });
    expect(document.target).toEqual({ major: 17, angular: '17.3.12', confirmed: true, source: 'option' });
    expect(document.hops.map((item) => [item.from, item.to])).toEqual([[14, 15], [15, 16], [16, 17]]);
  });

  it('is a dedicated contract, not a dump of the plan model', () => {
    const text = renderJson(sample(), META);
    const document = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(document)).not.toContain('schema');
    for (const internal of ['"peers"', '"fromPeers"', '"evidenceVersion"', '"necessaryAsOf"', '"entryId"', '"counts"', '"updateGuide"']) {
      expect(text).not.toContain(internal);
    }
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('gives each hop its commands, steps and library target versions', () => {
    const first = hop(planJson(sample(), META), 15);
    expect(first.commands).toEqual(['ng update @angular/core@15 @angular/cli@15', 'ng update @angular/material@15']);
    expect(first.steps.coverage).toBe('recorded');
    expect(first.steps.items.length).toBeGreaterThan(0);
    expect(first.steps.items[0]).toEqual({
      title: expect.any(String) as unknown,
      action: expect.any(String) as unknown,
      level: 'basic',
      appliesTo: 'all',
    });
    const library = (name: string) => first.libraries.find((item) => item.name === name);
    // An update: the newest compatible release.
    expect(library('@ngrx/store')).toMatchObject({ status: 'compatible', from: '14.3.3', to: '15.4.0', change: 'major', confirmed: true });
    // No change needed: the version stays.
    expect(library('@ngx-translate/core')).toMatchObject({ status: 'compatible', from: '14.0.0', to: '14.0.0', change: null });
    // A blocker and an undecided library have no target.
    expect(library('ngx-legacy-datepicker')).toMatchObject({ status: 'blocker', to: null, change: null });
    expect(library('ngx-flex-grid')).toMatchObject({ status: 'unknown', to: null, confirmed: false });
    expect(first.blockers).toEqual([{ name: 'ngx-legacy-datepicker', reason: expect.stringContaining('No release') as unknown }]);
  });

  it('lists requirement warnings, removed-API findings and effort per hop', () => {
    const plan = sample();
    const document = planJson(plan, META);
    const flagged = plan.hops.flatMap((item) => item.requirements.filter((requirement) => requirement.flagged));
    expect(document.hops.flatMap((item) => item.requirementWarnings)).toHaveLength(flagged.length);
    expect(flagged.length).toBeGreaterThan(0);

    const second = hop(document, 16);
    expect(second.removedApis.map((finding) => finding.confidence)).toEqual(['confirmed', 'confirmed', 'confirmed', 'confirmed', 'heuristic']);
    const injector = second.removedApis.find((finding) => finding.id === 'v16-core-reflective-injector')!;
    const entry = REMOVED_APIS.entries.find((item) => item.id === 'v16-core-reflective-injector')!;
    expect(injector).toMatchObject({
      package: '@angular/core',
      change: entry.change,
      replacement: entry.replacement,
      fixedByMigration: entry.migration,
      reason: null,
      source: entry.source.url,
    });
    expect(injector.line).toBeGreaterThan(0);
    // The sample's template finding has no bundled data entry, so no source.
    const heuristic = second.removedApis.find((finding) => finding.confidence === 'heuristic')!;
    expect(heuristic.source).toBeNull();
    expect(heuristic.reason).toEqual(expect.any(String));

    for (const [index, item] of document.hops.entries()) {
      expect(item.effort).toEqual({ points: plan.hops[index]!.effort.points, label: plan.hops[index]!.effort.label, breakdown: plan.hops[index]!.effort.breakdown });
    }
    expect(document.effort).toEqual({ points: plan.effort.points, label: plan.effort.label });
  });

  it('lists deprecation warnings per hop apart from removed APIs, with the scan counts', () => {
    const plan = sample();
    const document = planJson(plan, META);
    expect(document.hops.map((item) => [item.to, item.deprecations.length])).toEqual([[15, 0], [16, 2], [17, 0]]);
    const [token, attribute] = hop(document, 16).deprecations;
    expect(token).toEqual({
      file: 'src/app/core/legacy-token.provider.ts',
      line: 3,
      column: 10,
      id: 'sample-deprecated-token',
      package: '@angular/common',
      api: 'SAMPLE_LEGACY_TOKEN',
      deprecatedIn: 15,
      removalMajor: 17,
      replacement: 'the SAMPLE_TOKEN injection token',
      confidence: 'confirmed',
      reason: null,
      // Written for the sample, so not in the bundled data.
      source: null,
    });
    expect(attribute).toMatchObject({ confidence: 'heuristic', reason: expect.stringContaining('Matched by text') as unknown });
    expect(hop(document, 16).removedApis.some((finding) => finding.id.startsWith('sample-deprecated'))).toBe(false);
    expect(document.scan.deprecations).toEqual({
      data: { removalMajors: [17, 23, 24], retrieved: DEPRECATED_APIS.retrieved },
      findings: 3,
      attached: 2,
      notAttached: { atOrBelowCurrent: 0, aboveTarget: 1, noHop: 0 },
    });
    // Warnings add no effort: the JSON effort is the plan's, which ignores them.
    expect(hop(document, 16).effort.breakdown).toEqual(plan.hops[1]!.effort.breakdown);
  });

  it('lists the RxJS advisory at plan level with official sources, and no RxJS work in any hop', () => {
    const plan = sample();
    const document = planJson(plan, META);
    expect(document.hops.map((item) => item.rxjs)).toEqual([[], [], []]);
    const { rxjs } = document.scan;
    expect({ ...rxjs, advisory: rxjs.advisory.map((item) => item.id) }).toEqual({
      data: { rxjsMajor: 7, retrieved: RXJS_APIS.retrieved },
      installed: '6.6.7',
      status: 'advisory',
      forcedBy: null,
      uncheckedHops: [],
      reason: plan.scan.rxjs.reason,
      findings: 3,
      advisory: ['rx7-default-if-empty-no-value', 'rx7-iif-missing-result', 'rx7-rx-import'],
    });
    const entry = RXJS_APIS.entries.find((item) => item.id === 'rx7-rx-import')!;
    expect(rxjs.advisory[2]).toEqual({
      file: 'src/app/legacy/rx-helpers.ts',
      line: 1,
      column: 21,
      id: entry.id,
      package: 'rxjs/Rx',
      api: entry.label,
      change: 'removed',
      replacement: entry.replacement,
      source: entry.source.url,
    });
    expect(entry.source.url).toMatch(/^https:\/\/github\.com\/ReactiveX\/rxjs\/blob\/[0-9a-f]{40}\//);
  });

  it('lists required RxJS changes in the hop that forces RxJS 7', () => {
    const plan = sample();
    plan.hops[1]!.rxjs = plan.scan.rxjs.advisory;
    plan.scan.rxjs = { ...plan.scan.rxjs, status: 'required', forcedBy: 16, advisory: [] };
    const document = planJson(plan, META);
    expect(document.hops.map((item) => [item.to, item.rxjs.length])).toEqual([
      [15, 0],
      [16, 3],
      [17, 0],
    ]);
    expect(hop(document, 16).rxjs[0]).toMatchObject({ id: 'rx7-default-if-empty-no-value', package: 'rxjs/operators' });
    expect(hop(document, 16).rxjs[0]!.source).toContain('/CHANGELOG.md');
    expect(document.scan.rxjs).toMatchObject({ status: 'required', forcedBy: 16, advisory: [] });
  });

  it('gives a bundled deprecation entry its official source', () => {
    const plan = sample();
    const entry = DEPRECATED_APIS.entries.find((item) => item.id === 'd23-platform-browser-provide-animations')!;
    plan.hops[2]!.deprecations = [
      {
        file: 'src/main.ts',
        line: 8,
        column: 5,
        entryId: entry.id,
        package: entry.package,
        api: entry.label,
        deprecatedIn: entry.deprecatedIn,
        removalMajor: entry.removalMajor,
        replacement: entry.replacement,
        confidence: 'confirmed',
        reason: null,
      },
    ];
    expect(hop(planJson(plan, META), 17).deprecations[0]!.source).toBe(entry.source.url);
  });

  it('splits confirmed and unverified results per hop and for the whole plan', () => {
    const plan = sample();
    const document = planJson(plan, META);
    for (const item of document.hops) {
      expect(item.confirmed).toHaveLength(1);
      expect(item.confirmed[0]).toMatch(new RegExp(`^Angular ${item.from} to ${item.to}: `));
      expect(item.unverified).toEqual(plan.unverified.filter((entry) => entry.hop === item.to).map(({ subject, reason }) => ({ subject, reason })));
    }
    // Heuristic findings are unverified items of their hop.
    expect(hop(document, 16).unverified.some((entry) => entry.subject.includes('checkout.component.html'))).toBe(true);
    expect(document.unverified).toEqual(plan.unverified.filter((entry) => entry.hop === null).map(({ subject, reason }) => ({ subject, reason })));
    expect(document.unverified.length).toBeGreaterThan(0);
    expect(document.confirmed.some((line) => line.startsWith('Angular '))).toBe(false);
    expect(document.confirmed[0]).toBe('Installed Angular 14.2.12, read from the lockfile.');
    // Nothing is lost: every unverified item of the plan is in the document once.
    const total = document.unverified.length + document.hops.reduce((sum, item) => sum + item.unverified.length, 0);
    expect(total).toBe(plan.unverified.length);
  });

  it('keeps unverified items of a hop outside the plan at plan level', () => {
    const plan = sample();
    plan.unverified.push({ hop: 99, subject: 'odd', reason: 'not in the plan' });
    expect(planJson(plan, META).unverified).toContainEqual({ subject: 'odd', reason: 'not in the plan' });
  });

  it('describes a plan with nothing to do and a scan that was turned off', () => {
    const plan: UpgradePlan = { ...sample(), hops: [], message: 'Already on Angular 17.' };
    plan.scan = { ...plan.scan, status: 'off', coverage: null };
    const document = planJson(plan, META);
    expect(document.hops).toEqual([]);
    expect(document.message).toBe('Already on Angular 17.');
    expect(document.scan.status).toBe('off');
    expect(document.scan.data).toBeNull();
  });

  it('keeps untrusted text as JSON data, with control characters escaped', () => {
    const plan = sample();
    const hostile = 'x\u001b[31mred\u0007 "quoted" </script> ';
    plan.project.name = hostile;
    plan.hops[0]!.libraries[0]!.reason = hostile;
    const text = renderJson(plan, META);
    for (const char of ['\u001b', '\u0007']) expect(text).not.toContain(char);
    expect(text).toContain('\\u001b[31mred\\u0007');
    const document = JSON.parse(text) as PlanJson;
    expect(document.project.name).toBe(hostile);
    expect(document.hops[0]!.libraries[0]!.reason).toBe(hostile);
  });
});
