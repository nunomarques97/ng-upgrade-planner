export type PlanErrorCode =
  | 'INVALID_TARGET'
  | 'INVALID_CURRENT'
  | 'TARGET_UNKNOWN'
  | 'TARGET_BELOW_CURRENT'
  | 'TARGET_NOT_RELEASED';

/** An expected planning problem with a one-line message for the user. */
export class PlanError extends Error {
  readonly code: PlanErrorCode;

  constructor(code: PlanErrorCode, message: string) {
    super(message);
    this.name = 'PlanError';
    this.code = code;
  }
}

export function isPlanError(error: unknown): error is PlanError {
  return error instanceof PlanError;
}
