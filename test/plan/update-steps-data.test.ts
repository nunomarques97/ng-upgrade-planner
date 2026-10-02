import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UPDATE_GUIDE } from '../../src/data/update-steps.js';

describe('vendored Angular update guide snapshot', () => {
  it('records its source, commit and licence', () => {
    expect(UPDATE_GUIDE.source).toMatchObject({
      repository: 'https://github.com/angular/angular',
      path: 'adev/src/app/features/update/recommendations.ts',
      license: 'MIT',
    });
    expect(UPDATE_GUIDE.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(UPDATE_GUIDE.source.url).toContain(UPDATE_GUIDE.source.commit);
    expect(UPDATE_GUIDE.source.commitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('contains well-formed steps', () => {
    expect(UPDATE_GUIDE.steps.length).toBeGreaterThan(100);
    for (const step of UPDATE_GUIDE.steps) {
      expect(step.step.trim()).not.toBe('');
      expect(step.action.trim()).not.toBe('');
      expect([1, 2, 3]).toContain(step.level);
      expect(Number.isInteger(step.necessaryAsOf)).toBe(true);
      expect(step.possibleIn).toBeLessThanOrEqual(step.necessaryAsOf);
    }
    const majors = new Set(UPDATE_GUIDE.steps.map((step) => Math.floor(step.necessaryAsOf / 100)));
    expect(majors.has(UPDATE_GUIDE.source.coversThroughMajor)).toBe(true);
  });

  it('is stored as plain ASCII, so the source tree has no em-dashes', () => {
    const text = readFileSync(new URL('../../src/data/update-steps.ts', import.meta.url), 'utf8');
    expect([...text].filter((char) => char.charCodeAt(0) > 0x7f)).toEqual([]);
  });
});
