import { describe, expect, it } from 'vitest';
import { samplePlan } from './sample.js';

describe('sample plan', () => {
  // The snapshot file is rendered by the report tests and scripts/screenshot-report.mjs.
  it('matches sample-plan.json (update with vitest -u after a planner change)', async () => {
    const plan = await samplePlan();
    await expect(`${JSON.stringify(plan, null, 2)}\n`).toMatchFileSnapshot('./sample-plan.json');
  });

  it('covers the states the reports must show', async () => {
    const plan = await samplePlan();
    const statuses = new Set(plan.hops.flatMap((hop) => hop.libraries.map((library) => library.status)));
    expect([...statuses].sort()).toEqual(['blocker', 'compatible', 'unknown']);
    expect(plan.hops.map((hop) => hop.to)).toEqual([15, 16, 17]);
    expect(plan.unclassified.map((item) => item.name)).toContain('private-ui-kit');
    expect(plan.hops.some((hop) => hop.requirements.some((requirement) => requirement.flagged))).toBe(true);
    expect(plan.libraries.some((library) => library.registry.source === 'stale-cache')).toBe(true);
    expect(plan.unverified.length).toBeGreaterThan(0);
  });
});
