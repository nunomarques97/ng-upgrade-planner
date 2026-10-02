// Shape of the vendored Angular update guide snapshot (src/data/update-steps.ts).

/** Application complexity as used by the update guide: 1 basic, 2 medium, 3 advanced. */
export type UpdateGuideLevel = 1 | 2 | 3;

/**
 * One recommendation, with the field names of the upstream data. Versions are encoded as
 * major * 100 + minor * 10, so 1500 is 15.0 and 1020 is 10.2.
 */
export interface UpdateGuideStep {
  step: string;
  /** Markdown text; may contain inline HTML such as <br/>. Untrusted when rendered. */
  action: string;
  possibleIn: number;
  necessaryAsOf: number;
  level: UpdateGuideLevel;
  /** true: only for apps that use Angular Material. */
  material?: boolean;
  /** true: only for apps that combine AngularJS and Angular with ngUpgrade. */
  ngUpgrade?: boolean;
  /** true: only on Windows; false: only on other systems. */
  windows?: boolean;
}

export interface UpdateGuideSource {
  /** Upstream file the steps were taken from. */
  url: string;
  repository: string;
  path: string;
  commit: string;
  /** Date of that commit (YYYY-MM-DD). */
  commitDate: string;
  /** Date the snapshot was taken (YYYY-MM-DD). */
  retrieved: string;
  license: string;
  licenseUrl: string;
  copyright: string;
  /** Newest Angular major the upstream data describes at snapshot time. */
  coversThroughMajor: number;
}

export interface UpdateGuideData {
  source: UpdateGuideSource;
  steps: readonly UpdateGuideStep[];
}
