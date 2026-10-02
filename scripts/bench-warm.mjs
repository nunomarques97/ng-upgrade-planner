#!/usr/bin/env node
// Warm-cache benchmark: runs the built CLI (dist/cli.js) on every fixture app, offline, with the
// recorded registry data in test/fixtures/registry as its cache and the removed-API scan on. The
// fixtures hold only package.json and a lockfile, so each run copies them to a temporary project
// and adds a synthetic source tree (components, templates and services written here, some using
// removed APIs) for the scan to read. Prints each duration and the number of files scanned, and
// fails if any run fails, scans fewer files than generated, or takes 30 s or more.
//
// Usage: npm run build && node scripts/bench-warm.mjs
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'dist', 'cli.js');
const appsDir = path.join(root, 'test', 'fixtures', 'apps');
const registryDir = path.join(root, 'test', 'fixtures', 'registry');
const LIMIT_MS = 30_000;
const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
const COMPONENTS = 160;
const SERVICES = 40;
// Every component and its template, every service and angular.json.
const SOURCE_FILES = COMPONENTS * 2 + SERVICES + 1;

if (!existsSync(cli)) {
  console.error('bench-warm: dist/cli.js is missing; run "npm run build" first.');
  process.exit(1);
}

const apps = readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (apps.length === 0) {
  console.error('bench-warm: no fixture apps found.');
  process.exit(1);
}

function write(dir, file, content) {
  const target = path.join(dir, ...file.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/** Synthetic Angular source: components with external templates, services and angular.json. */
function writeSource(dir) {
  write(dir, 'angular.json', `${JSON.stringify({ version: 1, projects: { app: { root: '', sourceRoot: 'src' } } }, null, 2)}\n`);
  for (let i = 0; i < COMPONENTS; i++) {
    const folder = `src/app/feature-${i % 16}`;
    const name = `item-${i}`;
    const legacy = i % 20 === 0;
    const imports = legacy
      ? "import { Component, Input, OnInit, ReflectiveInjector } from '@angular/core';"
      : "import { Component, Input, OnInit } from '@angular/core';";
    const body = Array.from(
      { length: 12 },
      (_, n) => `  method${n}(value: number): string {\n    // Formats value ${n} for the view.\n    return \`\${this.label}-\${value + ${n}}\`;\n  }\n`,
    ).join('\n');
    write(
      dir,
      `${folder}/${name}.component.ts`,
      `${imports}
import { Router } from '@angular/router';

@Component({
  selector: 'app-${name}',
  templateUrl: './${name}.component.html',
})
export class Item${i}Component implements OnInit {
  @Input() label = 'item ${i}';
  ready = false;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.ready = true;${legacy ? '\n    ReflectiveInjector.resolveAndCreate([]);' : ''}
  }

  open(): Promise<boolean> {
    return this.router.navigate(['/items', ${i}]);
  }

${body}}
`,
    );
    const link = i % 32 === 0 ? '<a routerLink="/items" preserveQueryParams>Items</a>' : '<a routerLink="/items">Items</a>';
    write(
      dir,
      `${folder}/${name}.component.html`,
      `<!-- Item ${i} -->\n<section class="item" *ngIf="ready">\n  <h2>{{ label }}</h2>\n  ${link}\n  <button type="button" (click)="open()">Open</button>\n</section>\n`,
    );
  }
  for (let i = 0; i < SERVICES; i++) {
    const legacy = i % 10 === 0;
    const state = i % 10 === 5;
    write(
      dir,
      `src/app/services/data-${i}.service.ts`,
      `import { Injectable } from '@angular/core';
import { HttpClient${legacy ? ', XhrFactory' : ''} } from '@angular/common/http';
${state ? "import { TransferState } from '@angular/platform-browser';\n" : ''}
@Injectable({ providedIn: 'root' })
export class Data${i}Service {
  constructor(private readonly http: HttpClient${state ? ', private readonly state: TransferState' : ''}) {}

  load(id: number) {
    return this.http.get(\`/api/data-${i}/\${id}\`);
  }
}
`,
    );
  }
}

const work = mkdtempSync(path.join(os.tmpdir(), 'ngup-bench-'));
const failures = [];

try {
  for (const app of apps) {
    const project = path.join(work, app, 'project');
    mkdirSync(project, { recursive: true });
    for (const file of ['package.json', ...LOCKFILES]) {
      const source = path.join(appsDir, app, file);
      if (existsSync(source)) copyFileSync(source, path.join(project, file));
    }
    writeSource(project);
    const args = [cli, '--cwd', project, '--offline', '--cache-dir', registryDir, '--out-dir', path.join(work, app, 'reports')];
    const started = performance.now();
    // The CLI gets twice the limit to finish, so a slow run is still measured and reported.
    const run = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: LIMIT_MS * 2, env: { ...process.env, NO_COLOR: '1' } });
    const ms = performance.now() - started;
    const scanLine = /^Source scan: (\d+) files?, (\d+) findings?$/m.exec(run.stdout ?? '');
    const scanned = scanLine ? Number(scanLine[1]) : 0;
    let problem = null;
    if (run.error) problem = run.error.message;
    else if (run.status !== 0) problem = `exit code ${run.status}: ${run.stderr.trim().split('\n')[0] ?? ''}`;
    else if (ms >= LIMIT_MS) problem = `took ${(ms / 1000).toFixed(2)} s (limit ${LIMIT_MS / 1000} s)`;
    else if (scanned < SOURCE_FILES) problem = `scanned ${scanned} files, expected ${SOURCE_FILES}`;
    const summary = /^Total effort: .*$/m.exec(run.stdout ?? '')?.[0] ?? '';
    const scanText = scanLine ? `${scanned} files scanned, ${scanLine[2]} findings in the plan` : 'no scan line';
    console.log(`${problem ? 'FAIL' : 'ok  '} ${app.padEnd(24)} ${(ms / 1000).toFixed(2).padStart(6)} s  ${problem ?? `${scanText}; ${summary}`}`);
    if (problem) failures.push(app);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`bench-warm: ${failures.length} of ${apps.length} runs failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`bench-warm: all ${apps.length} runs scanned ${SOURCE_FILES} files each and finished in under ${LIMIT_MS / 1000} s.`);
