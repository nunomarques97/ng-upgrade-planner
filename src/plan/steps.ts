// Official update steps per hop, from the vendored Angular update guide snapshot.
import type { UpdateGuideData, UpdateGuideStep } from '../data/types.js';
import type { PlanStep, StepAudience, StepCoverage, StepLevel } from './types.js';

const LEVELS: Record<UpdateGuideStep['level'], StepLevel> = { 1: 'basic', 2: 'medium', 3: 'advanced' };

export interface StepFeatures {
  material: boolean;
  ngUpgrade: boolean;
}

export interface HopSteps {
  steps: PlanStep[];
  coverage: StepCoverage;
  note: string | null;
  commands: string[];
  commandNote: string | null;
}

/** Guide versions are major * 100 + minor * 10, so 1520 is "15.2". */
function versionName(encoded: number): string {
  const major = Math.floor(encoded / 100);
  return `${major}.${Math.floor((encoded % 100) / 10)}`;
}

/** Lowest encoded version already reached before a hop starts (exclusive bound). */
export function encodedVersion(major: number, minor: number): number {
  return major * 100 + Math.min(minor, 9) * 10;
}

function audience(step: UpdateGuideStep): StepAudience {
  if (step.material === true) return 'material';
  if (step.ngUpgrade === true) return 'ngUpgrade';
  if (step.windows === true) return 'windows';
  if (step.windows === false) return 'not-windows';
  return 'all';
}

function applies(step: UpdateGuideStep, features: StepFeatures): boolean {
  if (step.material === true && !features.material) return false;
  if (step.material === false && features.material) return false;
  if (step.ngUpgrade === true && !features.ngUpgrade) return false;
  if (step.ngUpgrade === false && features.ngUpgrade) return false;
  // Both Windows variants are kept and tagged: the plan does not depend on the machine it runs on.
  return true;
}

export function hopCommands(major: number, features: StepFeatures): { commands: string[]; note: string | null } {
  if (major < 7) {
    return {
      commands: [],
      note: `There is no single ng update command for Angular ${major}; follow the official steps for this hop.`,
    };
  }
  const commands = [`ng update @angular/core@${major} @angular/cli@${major}`];
  if (features.material) commands.push(`ng update @angular/material@${major}`);
  return { commands, note: null };
}

/**
 * Steps whose necessaryAsOf falls inside the hop: above `after` (the version already reached)
 * and up to the last minor of `major`. Material and ngUpgrade steps follow the project's use of
 * those packages, as the update guide options do.
 */
export function hopSteps(guide: UpdateGuideData, after: number, major: number, features: StepFeatures): HopSteps {
  const { commands, note: commandNote } = hopCommands(major, features);
  const upTo = major * 100 + 99;
  const steps = guide.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.necessaryAsOf > after && step.necessaryAsOf <= upTo && applies(step, features))
    .sort((a, b) => a.step.necessaryAsOf - b.step.necessaryAsOf || a.index - b.index)
    .map(
      ({ step }): PlanStep => ({
        title: step.step,
        action: step.action,
        level: LEVELS[step.level],
        necessaryAsOf: versionName(step.necessaryAsOf),
        possibleIn: versionName(step.possibleIn),
        appliesTo: audience(step),
      }),
    );

  const { source } = guide;
  if (major > source.coversThroughMajor) {
    return {
      steps,
      coverage: 'not-covered',
      note:
        `The bundled update guide snapshot (${source.commitDate}) covers Angular up to ${source.coversThroughMajor}, ` +
        `so no steps for Angular ${major} are included. Check https://angular.dev/update-guide.`,
      commands,
      commandNote,
    };
  }
  if (steps.length === 0) {
    return {
      steps,
      coverage: 'none-recorded',
      note: `The official update guide records no steps for this hop to Angular ${major}.`,
      commands,
      commandNote,
    };
  }
  return { steps, coverage: 'recorded', note: null, commands, commandNote };
}
