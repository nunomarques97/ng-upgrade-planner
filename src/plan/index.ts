export { buildPlan } from './build-plan.js';
export { PlanError, isPlanError, type PlanErrorCode } from './errors.js';
export { evaluateLibrary, satisfiesPeer, angularPeers, type ReferenceVersions } from './compat.js';
export { CLI_PACKAGES, LOCKSTEP_PACKAGES, REMOVED_PACKAGES, isFrameworkPackage } from './framework.js';
export {
  BASE_POINTS,
  BLOCKER_POINTS,
  HOP_THRESHOLDS,
  MAJOR_BUMP_POINTS,
  REMOVED_API_POINTS,
  REQUIREMENT_POINTS,
  STEP_POINTS,
  TOTAL_THRESHOLDS,
} from './effort.js';
export type * from './types.js';
export { PLAN_SCHEMA } from './types.js';
