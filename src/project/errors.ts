export type ProjectErrorCode =
  | 'NO_PACKAGE_JSON'
  | 'INVALID_PACKAGE_JSON'
  | 'NO_ANGULAR_CORE'
  | 'ANGULAR_VERSION_UNKNOWN'
  | 'MALFORMED_LOCKFILE'
  | 'UNSUPPORTED_LOCKFILE'
  | 'READ_FAILED';

/**
 * An expected problem with the project being analysed. The message is a complete, one-line
 * explanation meant for the user; callers print it without a stack trace.
 */
export class ProjectError extends Error {
  readonly code: ProjectErrorCode;
  readonly path: string | undefined;

  constructor(code: ProjectErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'ProjectError';
    this.code = code;
    this.path = path;
  }
}

export function isProjectError(value: unknown): value is ProjectError {
  return value instanceof ProjectError;
}

/**
 * Turns a caught error into a short single-line detail for a ProjectError message. Parser
 * messages can quote file content, so control characters are replaced and the text is capped.
 */
export function describeCause(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-control-regex
  const flat = raw.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}...` : flat || 'unknown error';
}

/** The `code` of a Node.js system error such as ENOENT, if present. */
export function systemErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
