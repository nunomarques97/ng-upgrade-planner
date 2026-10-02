import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
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
  it('has schema version 1 and the tool version', () => {
    const document = planJson(sample(), META);
    expect(PLAN_JSON_SCHEMA_VERSION).toBe(1);
    expect(document.schemaVersion).toBe(1);
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
