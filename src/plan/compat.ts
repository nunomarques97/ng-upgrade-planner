// Library compatibility per hop, decided only by @angular/* peer ranges checked against the newest
// stable release of the hop's major (npm semver semantics, loose parsing as npm does).
import semver from 'semver';
import type { PackageRecord, VersionRecord } from '../registry/types.js';
import { combine, fact, stableVersions, unverified, type Evidence } from './evidence.js';
import { isAngularPackage } from './framework.js';
import type { Fact, LibraryHopResult, PeerCheck, PeerRange, VersionChange } from './types.js';

/** Reference versions: the newest stable release of a package in a major. */
export interface ReferenceVersions {
  get(name: string, major: number): Fact<string | null>;
}

type Verdict = 'accepts' | 'rejects' | 'undecidable' | 'no-angular-peer';

interface Judgement {
  version: string;
  verdict: Verdict;
  peers: PeerCheck[];
  evidence: Evidence[];
}

const ranges = new Map<string, semver.Range | null>();

function parseRange(text: string): semver.Range | null {
  let range = ranges.get(text);
  if (range === undefined) {
    try {
      range = new semver.Range(text, { loose: true });
    } catch {
      range = null;
    }
    ranges.set(text, range);
  }
  return range;
}

/** npm's peer check: an invalid range accepts nothing. */
export function satisfiesPeer(version: string, rangeText: string): boolean {
  const range = parseRange(rangeText);
  return range !== null && range.test(version);
}

/** @angular/* peer ranges of a version, sorted by name. */
export function angularPeers(version: VersionRecord | undefined): PeerRange[] {
  const peers = version?.peerDependencies;
  if (!peers) return [];
  return Object.keys(peers)
    .filter(isAngularPackage)
    .sort()
    .map((name) => ({ name, range: peers[name]! }));
}

export interface LibraryContext {
  name: string;
  record: PackageRecord;
  evidence: Evidence;
  refs: ReferenceVersions;
  /** Registry names of the project's direct dependencies; optional peers outside it are not checked. */
  projectPackages: ReadonlySet<string>;
}

function judge(context: LibraryContext, version: string, major: number): Judgement {
  const record = context.record.versions[version];
  const meta = record?.peerDependenciesMeta;
  const peers: PeerCheck[] = [];
  const evidence: Evidence[] = [];
  let checked = 0;
  let rejected = false;
  let undecided = false;

  for (const peer of angularPeers(record)) {
    const optional = meta?.[peer.name]?.optional === true;
    if (optional && !context.projectPackages.has(peer.name)) {
      peers.push({ ...peer, checkedAgainst: null, satisfied: null, optional });
      continue;
    }
    checked++;
    const reference = context.refs.get(peer.name, major);
    evidence.push(reference);
    if (reference.value === null) {
      undecided = true;
      peers.push({ ...peer, checkedAgainst: null, satisfied: null, optional });
      continue;
    }
    const satisfied = satisfiesPeer(reference.value, peer.range);
    if (!satisfied) rejected = true;
    peers.push({ ...peer, checkedAgainst: reference.value, satisfied, optional });
  }

  const verdict: Verdict =
    checked === 0 ? 'no-angular-peer' : rejected ? 'rejects' : undecided ? 'undecidable' : 'accepts';
  return { version, verdict, peers, evidence };
}

/** Why the @angular peers of an undecidable release could not be checked. */
function missingReferences(context: LibraryContext, judgement: Judgement, major: number): string {
  return judgement.peers
    .filter((peer) => peer.satisfied === null && !peer.optional)
    .map((peer) => context.refs.get(peer.name, major).note ?? peer.name)
    .join('; ');
}

/** Prerelease versions judged against the hop, newest first. */
function prereleaseJudgements(context: LibraryContext, major: number): Judgement[] {
  return Object.keys(context.record.versions)
    .filter((version) => semver.valid(version) !== null && semver.prerelease(version) !== null)
    .sort(semver.rcompare)
    .map((version) => judge(context, version, major));
}

/** true when a failing peer range accepts only Angular versions newer than the one it was checked against. */
function requiresNewer(judgement: Judgement): boolean {
  return judgement.peers.some((peer) => {
    if (peer.satisfied !== false || peer.checkedAgainst === null) return false;
    const range = parseRange(peer.range);
    return range !== null && semver.ltr(peer.checkedAgainst, range, { loose: true });
  });
}

function describePeers(peers: readonly PeerCheck[], which: (peer: PeerCheck) => boolean): string {
  return peers
    .filter(which)
    .map((peer) => `${peer.name} "${peer.range}"`)
    .join(', ');
}

function changeBetween(from: string | null, to: string): VersionChange {
  if (from === null || semver.valid(from) === null) return 'unknown';
  if (semver.eq(from, to)) return 'none';
  if (semver.lt(to, from)) return 'downgrade';
  const diff = semver.diff(from, to);
  if (diff === 'major' || diff === 'premajor') return 'major';
  if (diff === 'minor' || diff === 'preminor') return 'minor';
  return 'patch';
}

function reasonNotes(deprecated: string | null, uncheckedNewer: number): string {
  let notes = '';
  if (deprecated !== null) notes += ' Every release that accepts this version is deprecated.';
  if (uncheckedNewer > 0) {
    notes += ` ${uncheckedNewer} newer release${uncheckedNewer === 1 ? '' : 's'} could not be checked.`;
  }
  return notes;
}

/**
 * Decides one library for the hop to `major`:
 * - compatible: the newest stable release whose checked @angular peers all accept the hop,
 *   preferring releases that are not deprecated;
 * - blocker: every checkable release rejects the hop and no newer release was left unchecked;
 *   for a package with only prereleases, the prereleases decide (one that accepts is noted, never offered);
 * - unknown: anything that cannot be decided from the data. Unknown is never compatible.
 */
export function evaluateLibrary(context: LibraryContext, major: number, from: Fact<string | null>): LibraryHopResult {
  const { name, record } = context;
  const stable = stableVersions(record);
  const judged: Judgement[] = [];
  let pick: Judgement | undefined;
  let deprecatedPick: Judgement | undefined;

  for (const version of stable) {
    const judgement = judge(context, version, major);
    judged.push(judgement);
    if (judgement.verdict !== 'accepts') continue;
    if (record.versions[version]?.deprecated === undefined) {
      pick = judgement;
      break;
    }
    deprecatedPick ??= judgement;
  }
  pick ??= deprecatedPick;

  const base = {
    name,
    from,
    changeNeeded: null as boolean | null,
    change: null as VersionChange | null,
    fromPeers: [] as PeerCheck[],
    deprecated: null as string | null,
    uncheckedNewer: 0,
  };

  // Does the version going into this hop already accept it?
  let fromJudgement: Judgement | undefined;
  if (from.value !== null && record.versions[from.value] !== undefined) {
    fromJudgement = judged.find((j) => j.version === from.value) ?? judge(context, from.value, major);
  }
  if (fromJudgement?.verdict === 'accepts') base.changeNeeded = false;
  else if (fromJudgement?.verdict === 'rejects') base.changeNeeded = true;
  // A prerelease already in use that accepts the hop beats "no stable release accepts it".
  if (!pick && fromJudgement?.verdict === 'accepts') pick = fromJudgement;

  const unchecked = judged.filter((j) => j.verdict === 'undecidable' || j.verdict === 'no-angular-peer');

  if (pick) {
    const evidence = combine([context.evidence, ...pick.evidence], context.evidence);
    const deprecated = record.versions[pick.version]?.deprecated ?? null;
    const uncheckedNewer = unchecked.filter((j) => semver.gt(j.version, pick.version)).length;
    let reason: string;
    if (base.changeNeeded === false) {
      base.fromPeers = fromJudgement!.peers;
      reason = `${from.value} already accepts Angular ${major}; no change needed.`;
    } else {
      base.change = changeBetween(from.value, pick.version);
      reason = `${pick.version} is the newest release that accepts Angular ${major}.`;
    }
    reason += reasonNotes(deprecated, uncheckedNewer);
    return {
      ...base,
      status: 'compatible',
      newestCompatible: fact(pick.version, evidence),
      evidenceVersion: pick.version,
      peers: pick.peers,
      deprecated,
      uncheckedNewer,
      reason,
      confidence: evidence.confidence,
    };
  }

  // Prereleases are never offered, but they still show whether any release accepts the hop.
  const prereleases = prereleaseJudgements(context, major);
  const acceptingPrerelease = prereleases.find((j) => j.verdict === 'accepts');
  const blocker = (decisive: Judgement, reason: string): LibraryHopResult => {
    const evidence = combine([context.evidence, ...decisive.evidence], context.evidence);
    return {
      ...base,
      status: 'blocker',
      newestCompatible: fact(null, evidence),
      evidenceVersion: decisive.version,
      peers: decisive.peers,
      reason,
      confidence: evidence.confidence,
    };
  };
  const prereleaseNote = acceptingPrerelease
    ? ` Only the prerelease ${acceptingPrerelease.version} accepts it, and prereleases are not offered.`
    : '';

  const newestRejecting = judged.find((j) => j.verdict === 'rejects');
  const undecidable = unchecked.find((j) => j.verdict === 'undecidable');
  const uncheckedNewer = newestRejecting
    ? unchecked.filter((j) => semver.gt(j.version, newestRejecting.version))
    : unchecked;
  // Releases without @angular peers that are older than a release needing a newer Angular may be
  // the ones made for this hop (many libraries added peers later), so they rule out a blocker.
  const oldestTooNew = [...judged].reverse().find((j) => j.verdict === 'rejects' && requiresNewer(j));
  const uncheckedOlder = oldestTooNew ? unchecked.filter((j) => semver.lt(j.version, oldestTooNew.version)) : [];

  if (newestRejecting && !undecidable && uncheckedNewer.length === 0 && uncheckedOlder.length === 0) {
    const failing = describePeers(newestRejecting.peers, (peer) => peer.satisfied === false);
    return blocker(
      newestRejecting,
      `No release accepts Angular ${major}; the newest, ${newestRejecting.version}, requires ${failing}.${prereleaseNote}`,
    );
  }

  // Without stable releases, the prereleases decide: every one that declares @angular peers must
  // be checkable, and the newest one must declare them.
  const newestPrerelease = prereleases[0];
  const prereleaseUndecidable = prereleases.find((j) => j.verdict === 'undecidable');
  if (stable.length === 0 && newestPrerelease && !prereleaseUndecidable) {
    if (newestPrerelease.verdict === 'accepts' || newestPrerelease.verdict === 'rejects') {
      if (acceptingPrerelease) {
        return blocker(acceptingPrerelease, `No stable release accepts Angular ${major}.${prereleaseNote}`);
      }
      const failing = describePeers(newestPrerelease.peers, (peer) => peer.satisfied === false);
      return blocker(
        newestPrerelease,
        `No release accepts Angular ${major}; the registry lists only prereleases and the newest, ${newestPrerelease.version}, requires ${failing}.`,
      );
    }
  }

  let reason: string;
  let shown: Judgement | undefined;
  if (stable.length === 0 && prereleaseUndecidable) {
    shown = prereleaseUndecidable;
    reason = `The registry lists no stable release, and ${prereleaseUndecidable.version} could not be checked against Angular ${major}: ${missingReferences(context, prereleaseUndecidable, major)}.`;
  } else if (stable.length === 0 && newestPrerelease) {
    shown = newestPrerelease;
    reason = `The registry lists no stable release, and the newest prerelease, ${newestPrerelease.version}, declares no @angular peer dependency, so its support for Angular ${major} cannot be checked.`;
  } else if (stable.length === 0) {
    reason = 'The registry lists no stable release.';
  } else if (undecidable) {
    shown = undecidable;
    reason = `Could not check ${undecidable.version} against Angular ${major}: ${missingReferences(context, undecidable, major)}.`;
  } else if (oldestTooNew && uncheckedNewer.length === 0) {
    shown = oldestTooNew;
    const count = uncheckedOlder.length;
    const failing = describePeers(oldestTooNew.peers, (peer) => peer.satisfied === false);
    reason =
      `No release with @angular peers accepts Angular ${major}, but ${count} release${count === 1 ? '' : 's'} older than ` +
      `${oldestTooNew.version} declare${count === 1 ? 's' : ''} no @angular peer dependency and may support it; ` +
      `${oldestTooNew.version} requires ${failing}.`;
  } else if (newestRejecting) {
    shown = uncheckedNewer[0];
    reason = `The newest release${shown ? `, ${shown.version},` : ''} declares no @angular peer dependency, so its support for Angular ${major} cannot be checked.`;
  } else {
    reason = 'No release declares an @angular peer dependency that can be checked.';
  }
  return {
    ...base,
    status: 'unknown',
    newestCompatible: unverified(null, reason),
    evidenceVersion: shown?.version ?? null,
    peers: shown?.peers ?? [],
    uncheckedNewer: uncheckedNewer.length,
    reason,
    confidence: 'unverified',
  };
}

/** The version going into the next hop: the one chosen here when a change is needed. */
export function nextFrom(result: LibraryHopResult): Fact<string | null> {
  if (result.status === 'compatible' && result.changeNeeded !== false) return result.newestCompatible;
  return result.from;
}

/**
 * Keeps the versions chosen for one hop consistent with each other. A library whose version
 * already accepts the hop is kept, but the release chosen for another library can still require
 * a newer version of it: @angular/material 17.3.10 needs @angular/cdk 17.3.10 exactly, while
 * @angular/cdk 16.2.9 accepts Angular 17. Such a library moves to its newest compatible release.
 * `registryNames` maps each library name to its registry name, which peer ranges refer to.
 */
export function alignRequiredVersions(
  results: readonly LibraryHopResult[],
  registryNames: ReadonlyMap<string, string>,
  major: number,
): LibraryHopResult[] {
  const out = [...results];
  const index = new Map(out.map((result, i) => [registryNames.get(result.name) ?? result.name, i]));
  // Every change turns a kept library into an updated one and never back, so this ends.
  for (let changed = true; changed; ) {
    changed = false;
    for (const requirer of out) {
      if (requirer.status !== 'compatible') continue;
      const checks = requirer.changeNeeded === false ? requirer.fromPeers : requirer.peers;
      for (const peer of checks) {
        const i = index.get(peer.name);
        const kept = i === undefined ? undefined : out[i];
        if (kept === undefined || kept === requirer || kept.status !== 'compatible' || kept.changeNeeded !== false) continue;
        const from = kept.from.value;
        const to = kept.newestCompatible.value;
        if (from === null || to === null || satisfiesPeer(from, peer.range)) continue;
        out[i!] = {
          ...kept,
          changeNeeded: true,
          change: changeBetween(from, to),
          fromPeers: [],
          reason:
            `${requirer.name} ${nextFrom(requirer).value ?? ''} requires ${peer.name} "${peer.range}", which ${from} does not satisfy; ` +
            `${to} is the newest release that accepts Angular ${major}.${reasonNotes(kept.deprecated, kept.uncheckedNewer)}`,
        };
        changed = true;
      }
    }
  }
  return out;
}
