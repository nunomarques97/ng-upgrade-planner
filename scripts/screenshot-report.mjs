#!/usr/bin/env node
// Renders the HTML report of the sample plan used by the tests (test/report/sample-plan.json)
// and captures it with a locally installed Edge or Chrome in headless mode at 1440 and 390 px
// wide, in light and dark colour schemes. PNGs go to .cache/screenshots/ and their paths are
// printed. It also loads a measuring copy of the report to check that nothing overflows the
// page horizontally (wide tables must scroll inside their container).
// Exits non-zero when no browser is found, a capture fails, a PNG is empty or has the wrong
// width, or the page overflows. Requires `npm run build` first. Set BROWSER_PATH to choose a browser.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.cache', 'screenshots');
const profileDir = path.join(root, '.cache', 'browser-profile');
const WIDTHS = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
];
// Views: the top of the report, a hop's steps, a library table with a blocker, a hop's removed-API
// findings and the confirmed/unverified section.
const VIEWS = [
  { name: 'top', anchor: '' },
  { name: 'hop', anchor: '#hop-16' },
  { name: 'libraries', anchor: '#hop-15-libraries' },
  { name: 'removed-apis', anchor: '#hop-16-removed-apis' },
  { name: 'evidence', anchor: '#evidence' },
];

function fail(message) {
  console.error(`screenshot-report: ${message}`);
  process.exit(1);
}

function findBrowser() {
  const override = process.env.BROWSER_PATH;
  if (override) return existsSync(override) ? override : fail(`BROWSER_PATH does not exist: ${override}`);
  const candidates = [];
  if (process.platform === 'win32') {
    const bases = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
    for (const base of bases) {
      candidates.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      candidates.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
      for (const name of ['microsoft-edge', 'microsoft-edge-stable', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
        candidates.push(path.join(dir, name));
      }
    }
  }
  return candidates.find((candidate) => existsSync(candidate));
}

function runBrowser(browser, args) {
  const result = spawnSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--force-device-scale-factor=1',
      '--hide-scrollbars',
      `--user-data-dir=${profileDir}`,
      ...args,
    ],
    { encoding: 'utf8', timeout: 90_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) fail(`could not run ${browser}: ${result.error.message}`);
  if (result.status !== 0) fail(`${path.basename(browser)} exited with ${result.status}: ${result.stderr.trim().slice(0, 400)}`);
  return result.stdout;
}

/** Width of a PNG from its IHDR chunk, or undefined when the file is not a PNG. */
function pngWidth(file) {
  const bytes = readFileSync(file);
  const signature = '89504e470d0a1a0a';
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== signature) return undefined;
  return bytes.readUInt32BE(16);
}

// Headless browsers keep a minimum window width (about 500 px), so the report is shown in an
// iframe of the exact size at the top left of a frame page, and the capture is cropped to it.
function framePage(src, width, height, extra = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#888}iframe{display:block;border:0;width:${width}px;height:${height}px}</style></head><body><iframe ${src}></iframe>${extra}</body></html>`;
}

const escapeAttribute = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Measures the report in an iframe of the exact width. The measured copy has no Content Security
// Policy (it is loaded as srcdoc so the frame page may read its layout); the result is written
// into the DOM, which --dump-dom prints.
const PROBE = `<script>
addEventListener('load', () => {
  const frame = document.querySelector('iframe');
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  const offenders = [];
  for (const element of doc.body.querySelectorAll('*')) {
    if (element.closest('.table-wrap, pre')) continue;
    const box = element.getBoundingClientRect();
    if (box.right > doc.documentElement.clientWidth + 0.5) offenders.push(element.tagName.toLowerCase() + (element.className ? '.' + element.className : ''));
  }
  const tables = [...doc.querySelectorAll('.table-wrap')];
  document.body.setAttribute('data-probe', JSON.stringify({
    innerWidth: win.innerWidth,
    clientWidth: doc.documentElement.clientWidth,
    scrollWidth: doc.documentElement.scrollWidth,
    offenders: offenders.slice(0, 10),
    tables: tables.length,
    scrollingTables: tables.filter((wrap) => wrap.scrollWidth > wrap.clientWidth).length,
  }));
});
</script>`;

function probe(browser, html, width, height) {
  const withoutCsp = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '');
  if (withoutCsp === html) fail('the report has no Content-Security-Policy meta tag');
  const probeFile = path.join(outDir, `probe-${width}.html`);
  writeFileSync(probeFile, framePage(`srcdoc="${escapeAttribute(withoutCsp)}"`, width, height, PROBE), 'utf8');
  const dom = runBrowser(browser, [
    `--window-size=${Math.max(width, 800)},${height}`,
    '--blink-settings=preferredColorScheme=1',
    '--virtual-time-budget=5000',
    '--dump-dom',
    pathToFileURL(probeFile).href,
  ]);
  rmSync(probeFile, { force: true });
  const match = /data-probe="([^"]*)"/.exec(dom);
  if (!match) fail(`the layout probe at ${width} px produced no result`);
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
}

const reportModule = path.join(root, 'dist', 'report', 'index.js');
if (!existsSync(reportModule)) fail('dist/report/index.js is missing; run "npm run build" first.');
const { renderHtml } = await import(pathToFileURL(reportModule).href);
const plan = JSON.parse(readFileSync(path.join(root, 'test', 'report', 'sample-plan.json'), 'utf8'));
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const html = renderHtml(plan, { toolVersion: version });

const browser = findBrowser();
if (!browser) fail('no Edge or Chrome installation found; set BROWSER_PATH to a Chromium-based browser.');

mkdirSync(outDir, { recursive: true });
const reportFile = path.join(outDir, 'sample-report.html');
writeFileSync(reportFile, html, 'utf8');
const reportUrl = pathToFileURL(reportFile).href;

const problems = [];
const written = [];
for (const { width, height } of WIDTHS) {
  for (const scheme of ['light', 'dark']) {
    for (const view of VIEWS) {
      // Dark mode is captured at the top only; the layout is the same.
      if (scheme === 'dark' && view.name !== 'top') continue;
      const file = path.join(outDir, `report-${width}-${view.name}-${scheme}.png`);
      const frameFile = path.join(outDir, `frame-${width}-${view.name}.html`);
      writeFileSync(frameFile, framePage(`src="${escapeAttribute(`${reportUrl}${view.anchor}`)}"`, width, height), 'utf8');
      rmSync(file, { force: true });
      runBrowser(browser, [
        `--window-size=${width},${height}`,
        `--blink-settings=preferredColorScheme=${scheme === 'dark' ? 0 : 1}`,
        '--virtual-time-budget=5000',
        `--screenshot=${file}`,
        pathToFileURL(frameFile).href,
      ]);
      rmSync(frameFile, { force: true });
      if (!existsSync(file) || statSync(file).size === 0) {
        problems.push(`${file} was not written or is empty`);
        continue;
      }
      const actual = pngWidth(file);
      if (actual !== width) problems.push(`${file} is ${actual === undefined ? 'not a PNG' : `${actual} px wide, expected ${width}`}`);
      written.push(file);
    }
  }
  const layout = probe(browser, html, width, height);
  console.log(
    `${width} px: frame ${layout.innerWidth}, content ${layout.clientWidth}, page width ${layout.scrollWidth}, ${layout.scrollingTables} of ${layout.tables} tables scroll inside their container`,
  );
  if (layout.innerWidth !== width) problems.push(`the report frame was ${layout.innerWidth} px, expected ${width}`);
  if (layout.scrollWidth > layout.clientWidth) {
    problems.push(`page-level horizontal overflow at ${width} px (${layout.offenders.join(', ') || 'unknown element'})`);
  }
}

console.log(`Report: ${reportFile}`);
for (const file of written) console.log(file);
if (problems.length > 0) fail(problems.join('; '));
