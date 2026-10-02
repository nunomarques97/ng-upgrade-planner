import { describe, expect, it } from 'vitest';
import { evaluateLibrary, satisfiesPeer, type ReferenceVersions } from '../../src/plan/index.js';
import type { Fact } from '../../src/plan/index.js';
import { record, peers } from './helpers.js';

const confirmedFact = (value: string | null): Fact<string | null> => ({
  value,
  confidence: 'confirmed',
  source: 'lockfile',
  note: null,
});

const refs: ReferenceVersions = {
  get: (_name, major) =>
    major === 16
      ? { value: '16.2.12', confidence: 'confirmed', source: 'registry', note: null }
      : { value: null, confidence: 'unverified', source: 'none', note: `no stable @angular/core ${major}.x release` },
};

function context(versions: Parameters<typeof record>[1]) {
  return {
    name: 'ngx-lib',
    record: record('ngx-lib', versions),
    evidence: { confidence: 'confirmed', source: 'registry', note: null } as const,
    refs,
    projectPackages: new Set<string>(),
  };
}

describe('satisfiesPeer', () => {
  it('follows npm semver semantics for peer ranges', () => {
    expect(satisfiesPeer('16.2.12', '^15.0.0 || ^16.0.0')).toBe(true);
    expect(satisfiesPeer('16.2.12', '^16.0.0-rc.0')).toBe(true);
    expect(satisfiesPeer('16.2.12', '>=16.0.0-next.0 <17.0.0')).toBe(true);
    expect(satisfiesPeer('17.0.0', '>=16.0.0 <17.0.0')).toBe(false);
    expect(satisfiesPeer('16.2.12', '*')).toBe(true);
    expect(satisfiesPeer('16.2.12', '16.x')).toBe(true);
    // Loose parsing, as npm uses for peer checks.
    expect(satisfiesPeer('16.2.12', '>= 16.0')).toBe(true);
    // An invalid range accepts nothing.
    expect(satisfiesPeer('16.2.12', 'latest')).toBe(false);
    expect(satisfiesPeer('16.2.12', 'not a range')).toBe(false);
  });
});

describe('evaluateLibrary', () => {
  it('treats a release with an invalid peer range as not accepting the hop', () => {
    const result = evaluateLibrary(context({ '1.0.0': peers({ '@angular/core': 'latest' }) }), 16, confirmedFact('1.0.0'));
    expect(result).toMatchObject({ status: 'blocker', evidenceVersion: '1.0.0' });
    expect(result.peers[0]).toMatchObject({ range: 'latest', checkedAgainst: '16.2.12', satisfied: false });
  });

  // Regression (jira-clone-angular fixture): @angular-builders/custom-webpack declares @angular
  // peers only from 14.0.0; its 12.x releases, made for Angular 12, declare none.
  it('reports unknown, not a blocker, when older releases without @angular peers may fit an older hop', () => {
    const result = evaluateLibrary(
      context({
        '12.1.3': {},
        '14.0.0': peers({ '@angular/compiler-cli': '^14.0.0' }),
        '15.0.0': peers({ '@angular/compiler-cli': '^15.0.0' }),
      }),
      16,
      confirmedFact('12.1.3'),
    );
    // Every checkable release here needs an older Angular than 16, so it stays a blocker.
    expect(result.status).toBe('blocker');

    const older = evaluateLibrary(
      context({
        '12.1.3': {},
        '13.1.0': {},
        '17.0.0': peers({ '@angular/compiler-cli': '^17.0.0' }),
        '18.0.0': peers({ '@angular/compiler-cli': '^18.0.0' }),
      }),
      16,
      confirmedFact('12.1.3'),
    );
    expect(older).toMatchObject({
      status: 'unknown',
      newestCompatible: { value: null, confidence: 'unverified' },
      evidenceVersion: '17.0.0',
      uncheckedNewer: 0,
      confidence: 'unverified',
    });
    expect(older.reason).toBe(
      'No release with @angular peers accepts Angular 16, but 2 releases older than 17.0.0 declare no @angular peer dependency and may support it; 17.0.0 requires @angular/compiler-cli "^17.0.0".',
    );
  });

  it('keeps a blocker when the only releases without @angular peers predate a release that is too old for the hop', () => {
    const result = evaluateLibrary(
      context({
        '0.1.0': {},
        '6.0.2': peers({ '@angular/core': '>=2.3.1 <13.0.0' }),
      }),
      16,
      confirmedFact('6.0.2'),
    );
    expect(result).toMatchObject({ status: 'blocker', evidenceVersion: '6.0.2' });
  });

  it('keeps an installed prerelease that already accepts the hop', () => {
    const result = evaluateLibrary(
      context({ '1.0.0': peers({ '@angular/core': '^15.0.0' }), '2.0.0-rc.1': peers({ '@angular/core': '^16.0.0' }) }),
      16,
      confirmedFact('2.0.0-rc.1'),
    );
    expect(result).toMatchObject({ status: 'compatible', newestCompatible: { value: '2.0.0-rc.1' }, changeNeeded: false });
  });

  it('never reports unknown results as compatible', () => {
    const cases = [
      context({}),
      context({ '1.0.0': {} }),
      context({ '1.0.0': peers({ '@angular/core': '^17.0.0' }) }),
    ];
    for (const c of cases) {
      const result = evaluateLibrary(c, 17, confirmedFact('1.0.0'));
      expect(result.status).toBe('unknown');
      expect(result.newestCompatible).toMatchObject({ value: null, confidence: 'unverified' });
      expect(result.confidence).toBe('unverified');
    }
    expect(evaluateLibrary(context({}), 16, confirmedFact(null)).reason).toBe('The registry lists no stable release.');
  });

  it('reports unknown for prerelease-only packages that the prereleases cannot decide', () => {
    const noPeer = evaluateLibrary(
      context({ '1.0.0-beta.1': peers({ '@angular/core': '^15.0.0' }), '1.0.0-beta.2': {} }),
      16,
      confirmedFact('1.0.0-beta.1'),
    );
    expect(noPeer).toMatchObject({ status: 'unknown', evidenceVersion: '1.0.0-beta.2', confidence: 'unverified' });
    expect(noPeer.reason).toBe(
      'The registry lists no stable release, and the newest prerelease, 1.0.0-beta.2, declares no @angular peer dependency, so its support for Angular 16 cannot be checked.',
    );

    const undecidable = evaluateLibrary(
      context({ '1.0.0-beta.1': peers({ '@angular/core': '^17.0.0' }) }),
      17,
      confirmedFact('1.0.0-beta.1'),
    );
    expect(undecidable).toMatchObject({ status: 'unknown', newestCompatible: { value: null, confidence: 'unverified' } });
    expect(undecidable.reason).toBe(
      'The registry lists no stable release, and 1.0.0-beta.1 could not be checked against Angular 17: no stable @angular/core 17.x release.',
    );
  });

  it('counts newer releases that could not be checked when an older one is chosen', () => {
    const result = evaluateLibrary(
      context({ '1.0.0': peers({ '@angular/core': '^16.0.0' }), '1.1.0': {}, '1.2.0': {} }),
      16,
      confirmedFact(null),
    );
    expect(result).toMatchObject({
      status: 'compatible',
      newestCompatible: { value: '1.0.0' },
      changeNeeded: null,
      change: 'unknown',
      uncheckedNewer: 2,
    });
    expect(result.reason).toBe('1.0.0 is the newest release that accepts Angular 16. 2 newer releases could not be checked.');
  });

  it('reports the kind of version change', () => {
    const versions = {
      '1.0.0': peers({ '@angular/core': '^15.0.0' }),
      '1.0.5': peers({ '@angular/core': '^15.0.0 || ^16.0.0' }),
    };
    expect(evaluateLibrary(context(versions), 16, confirmedFact('1.0.0')).change).toBe('patch');
    expect(
      evaluateLibrary(context({ ...versions, '1.3.0': peers({ '@angular/core': '^16.0.0' }) }), 16, confirmedFact('1.0.0'))
        .change,
    ).toBe('minor');
  });
});
