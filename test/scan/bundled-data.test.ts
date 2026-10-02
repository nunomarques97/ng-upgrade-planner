// One scan of the synthetic project with the real bundled dataset.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REMOVED_APIS } from '../../src/data/removed-apis.js';
import { scan, type ScanResult } from '../../src/scan/index.js';
import { copySyntheticProject, removeFolder } from './helpers.js';

let root: string;
let result: ScanResult;

beforeAll(async () => {
  root = copySyntheticProject();
  result = await scan(root, REMOVED_APIS);
});

afterAll(() => removeFolder(root));

describe('scan with the bundled removed-API data', () => {
  it('finds the planted usages of real dataset entries', () => {
    const ids = new Set(result.findings.map((finding) => finding.entryId));
    for (const id of [
      'v9-core-renderer',
      'v9-forms-ngform-element',
      'v10-core-module-with-providers-generic',
      'v11-core-view-encapsulation-native',
      'v11-platform-webworker',
      'v11-router-preserve-query-params-template',
      'v15-compiler-cli-enable-ivy',
      'v15-router-relative-link-resolution',
      'v16-cli-default-collection',
      'v16-cli-default-project',
      'v16-common-http-xhr-factory',
      'v16-core-ng-module-entry-components',
      'v16-core-reflective-injector',
      'v17-router-malformed-uri-error-handler',
      'v18-core-testing-async',
      'v18-platform-browser-make-state-key',
      'v18-platform-browser-transfer-state',
      'v20-core-testing-test-bed-get',
      'v21-core-component-module-id',
      'v22-compiler-cli-full-template-type-check',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('copies each finding from its dataset entry', () => {
    const byId = new Map(REMOVED_APIS.entries.map((entry) => [entry.id, entry]));
    for (const finding of result.findings) {
      const entry = byId.get(finding.entryId);
      expect(entry, finding.entryId).toBeDefined();
      if (!entry) continue;
      expect(finding).toMatchObject({
        package: entry.package,
        api: entry.label,
        change: entry.change,
        major: entry.major,
        replacement: entry.replacement,
        migration: entry.migration,
        confidence: entry.kind === 'template' ? 'heuristic' : 'confirmed',
      });
    }
  });

  it('reports nothing in the files that must stay clean', () => {
    const clean = ['src/app/other-package.ts', 'src/app/comments-strings.ts', 'src/app/orphan.html', 'src/app/plain.ts'];
    expect(result.findings.filter((finding) => clean.includes(finding.file))).toEqual([]);
  });
});
