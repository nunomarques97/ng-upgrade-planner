// Deterministic effort estimate: points from the work a hop contains, mapped to a size label.
import type { Effort, EffortCounts, EffortLabel, Hop, StepLevel } from './types.js';

/** Fixed cost of every hop: running ng update, building and testing. */
export const BASE_POINTS = 2;
/** Basic steps apply to every app; medium and advanced ones only to apps using those features. */
export const STEP_POINTS: Readonly<Record<StepLevel, number>> = { basic: 2, medium: 1, advanced: 1 };
export const MAJOR_BUMP_POINTS = 3;
export const REQUIREMENT_POINTS = 2;
export const BLOCKER_POINTS = 8;
/**
 * Points per distinct removed or changed API found in a hop's source, not per occurrence, so a
 * large codebase does not swamp the estimate. An API the official ng update migration fixes needs
 * only a review; one it does not fix, or may not fix, needs hand work. Heuristic findings count
 * too: checking them is work even when they turn out to be false positives.
 */
export const REMOVED_API_POINTS: Readonly<{ migrated: number; manual: number }> = { migrated: 1, manual: 3 };

/** Upper bounds (exclusive) for S, M and L; anything above is XL. */
export const HOP_THRESHOLDS = [20, 40, 70] as const;
export const TOTAL_THRESHOLDS = [40, 120, 250] as const;

function label(points: number, thresholds: readonly [number, number, number]): EffortLabel {
  if (points < thresholds[0]) return 'S';
  if (points < thresholds[1]) return 'M';
  if (points < thresholds[2]) return 'L';
  return 'XL';
}

function score(counts: EffortCounts, hops: number, thresholds: readonly [number, number, number]): Effort {
  const breakdown = {
    base: BASE_POINTS * hops,
    steps:
      counts.steps.basic * STEP_POINTS.basic +
      counts.steps.medium * STEP_POINTS.medium +
      counts.steps.advanced * STEP_POINTS.advanced,
    majorBumps: counts.majorBumps * MAJOR_BUMP_POINTS,
    requirements: counts.unmetRequirements * REQUIREMENT_POINTS,
    blockers: counts.blockers * BLOCKER_POINTS,
    removedApis:
      counts.removedApis.migrated * REMOVED_API_POINTS.migrated + counts.removedApis.manual * REMOVED_API_POINTS.manual,
  };
  const points =
    breakdown.base +
    breakdown.steps +
    breakdown.majorBumps +
    breakdown.requirements +
    breakdown.blockers +
    breakdown.removedApis;
  return { points, label: label(points, thresholds), counts, breakdown };
}

/** Distinct APIs among the findings, split by whether the ng update migration fixes them. */
function removedApiCounts(findings: Hop['removedApis']): EffortCounts['removedApis'] {
  const migration = new Map<string, string>();
  for (const finding of findings) migration.set(finding.entryId, finding.migration);
  let migrated = 0;
  for (const value of migration.values()) if (value === 'yes') migrated++;
  return { migrated, manual: migration.size - migrated };
}

export function hopEffort(hop: Pick<Hop, 'steps' | 'libraries' | 'requirements' | 'removedApis'>): Effort {
  const steps: Record<StepLevel, number> = { basic: 0, medium: 0, advanced: 0 };
  for (const step of hop.steps) steps[step.level]++;
  return score(
    {
      steps,
      majorBumps: hop.libraries.filter((lib) => lib.status === 'compatible' && lib.change === 'major').length,
      unmetRequirements: hop.requirements.filter((requirement) => requirement.flagged).length,
      blockers: hop.libraries.filter((lib) => lib.status === 'blocker').length,
      removedApis: removedApiCounts(hop.removedApis),
    },
    1,
    HOP_THRESHOLDS,
  );
}

export function totalEffort(hops: readonly Pick<Hop, 'effort'>[]): Effort {
  const counts: EffortCounts = {
    steps: { basic: 0, medium: 0, advanced: 0 },
    majorBumps: 0,
    unmetRequirements: 0,
    blockers: 0,
    removedApis: { migrated: 0, manual: 0 },
  };
  for (const { effort } of hops) {
    counts.steps.basic += effort.counts.steps.basic;
    counts.steps.medium += effort.counts.steps.medium;
    counts.steps.advanced += effort.counts.steps.advanced;
    counts.majorBumps += effort.counts.majorBumps;
    counts.unmetRequirements += effort.counts.unmetRequirements;
    counts.blockers += effort.counts.blockers;
    counts.removedApis.migrated += effort.counts.removedApis.migrated;
    counts.removedApis.manual += effort.counts.removedApis.manual;
  }
  return score(counts, hops.length, TOTAL_THRESHOLDS);
}
