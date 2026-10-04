#!/usr/bin/env node
// Renders the HTML report of the sample plan used by the tests (test/report/sample-plan.json)
// and captures it with a locally installed Edge or Chrome in headless mode at 1440 and 390 px
// wide, in light and dark colour schemes. PNGs go to .cache/screenshots/ and their paths are
// printed. It also measures the report at each width to check that nothing overflows the page
// horizontally (wide tables must scroll inside their container).
// One browser process is started and driven over the DevTools protocol on a pipe, because
// starting a browser per capture takes minutes on a busy machine.
// Exits non-zero when no browser is found, a capture fails, a view's anchor is missing, a PNG is
// empty or has the wrong width, or the page overflows. Requires `npm run build` first. Set
// BROWSER_PATH to choose a browser.
import { spawn } from 'node:child_process';
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
// findings, its deprecation warnings, a hop's toolchain with Node.js and TypeScript blockers, the RxJS 7
// advisory and the confirmed/unverified section.
const VIEWS = [
  { name: 'top', anchor: '' },
  { name: 'hop', anchor: '#hop-16' },
  { name: 'libraries', anchor: '#hop-15-libraries' },
  { name: 'removed-apis', anchor: '#hop-16-removed-apis' },
  { name: 'deprecations', anchor: '#hop-16-deprecations' },
  { name: 'toolchain', anchor: '#hop-17-toolchain' },
  { name: 'rxjs-advisory', anchor: '#rxjs-advisory' },
  { name: 'evidence', anchor: '#evidence' },
];
const DARK_VIEWS = new Set(['top', 'deprecations', 'toolchain', 'rxjs-advisory']);
// Starting the browser is the slow part on a busy machine; single protocol commands are fast.
const START_TIMEOUT_MS = 180_000;
const COMMAND_TIMEOUT_MS = 60_000;

let browserProcess;

function fail(message) {
  console.error(`screenshot-report: ${message}`);
  browserProcess?.kill();
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

/**
 * Starts the browser with the DevTools protocol on file descriptors 3 (commands in) and 4 (replies
 * and events out). Messages are JSON separated by a NUL byte.
 */
function startBrowser(browser) {
  const child = spawn(
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
      '--remote-debugging-pipe',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true },
  );
  browserProcess = child;
  let stderr = '';
  child.stdio[2].on('data', (chunk) => {
    stderr = (stderr + chunk.toString('utf8')).slice(-2000);
  });
  child.on('error', (error) => fail(`could not run ${browser}: ${error.message}`));
  let closing = false;
  child.on('exit', (code) => {
    if (!closing) fail(`${path.basename(browser)} exited with ${code}: ${stderr.trim().slice(-400)}`);
  });

  let nextId = 1;
  const pending = new Map();
  const waiters = new Set();
  let buffered = Buffer.alloc(0);
  child.stdio[4].on('data', (chunk) => {
    buffered = Buffer.concat([buffered, chunk]);
    let end;
    while ((end = buffered.indexOf(0)) !== -1) {
      const message = JSON.parse(buffered.subarray(0, end).toString('utf8'));
      buffered = buffered.subarray(end + 1);
      if (message.id !== undefined) {
        const request = pending.get(message.id);
        if (!request) continue;
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
        else request.resolve(message.result);
      } else {
        for (const waiter of [...waiters]) {
          if (waiter.method === message.method && waiter.sessionId === message.sessionId) {
            waiters.delete(waiter);
            clearTimeout(waiter.timer);
            waiter.resolve(message.params);
          }
        }
      }
    }
  });

  return {
    send(method, params = {}, sessionId, timeout = COMMAND_TIMEOUT_MS) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${method} got no reply within ${timeout / 1000} s`));
        }, timeout);
        pending.set(id, { method, resolve, reject, timer });
        child.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
      });
    },
    /** Resolves with the next event of this name in this session. */
    waitFor(method, sessionId, timeout = COMMAND_TIMEOUT_MS) {
      return new Promise((resolve, reject) => {
        const waiter = { method, sessionId, resolve };
        waiter.timer = setTimeout(() => {
          waiters.delete(waiter);
          reject(new Error(`no ${method} event within ${timeout / 1000} s`));
        }, timeout);
        waiters.add(waiter);
      });
    },
    async close() {
      closing = true;
      const exited = new Promise((resolve) => child.once('exit', resolve));
      await this.send('Browser.close', {}, undefined, 10_000).catch(() => undefined);
      const timer = setTimeout(() => child.kill(), 10_000);
      await exited;
      clearTimeout(timer);
    },
  };
}

/** Width of a PNG from its IHDR chunk, or undefined when the file is not a PNG. */
function pngWidth(file) {
  const bytes = readFileSync(file);
  const signature = '89504e470d0a1a0a';
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== signature) return undefined;
  return bytes.readUInt32BE(16);
}

// Measures the loaded report. Code run through the protocol is not subject to the report's Content
// Security Policy, so the report is measured as written.
const PROBE = `(() => {
  const offenders = [];
  for (const element of document.body.querySelectorAll('*')) {
    if (element.closest('.table-wrap, pre')) continue;
    const box = element.getBoundingClientRect();
    if (box.right > document.documentElement.clientWidth + 0.5) offenders.push(element.tagName.toLowerCase() + (element.className ? '.' + element.className : ''));
  }
  const tables = [...document.querySelectorAll('.table-wrap')];
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: offenders.slice(0, 10),
    tables: tables.length,
    scrollingTables: tables.filter((wrap) => wrap.scrollWidth > wrap.clientWidth).length,
  };
})()`;

// Waits for two animation frames so the scroll position and layout are painted before a capture.
const SETTLE = 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))';

async function evaluate(cdp, sessionId, expression) {
  const { result, exceptionDetails } = await cdp.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (exceptionDetails) throw new Error(`evaluation failed: ${exceptionDetails.text}`);
  return result.value;
}

/** Loads a URL as a new document, so a change of anchor scrolls as on a first visit. */
async function load(cdp, sessionId, url) {
  for (const target of ['about:blank', url]) {
    const loaded = cdp.waitFor('Page.loadEventFired', sessionId);
    const { errorText } = await cdp.send('Page.navigate', { url: target }, sessionId);
    if (errorText) throw new Error(`could not load ${target}: ${errorText}`);
    await loaded;
  }
  await evaluate(cdp, sessionId, SETTLE);
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
try {
  const cdp = startBrowser(browser);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }, undefined, START_TIMEOUT_MS);
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);

  for (const { width, height } of WIDTHS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    for (const scheme of ['light', 'dark']) {
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, sessionId);
      for (const view of VIEWS) {
        // Dark mode is captured at the top, for the deprecation warnings, the toolchain and the RxJS advisory,
        // whose warning badges and callouts use the colour tokens that change; the layout is the same.
        if (scheme === 'dark' && !DARK_VIEWS.has(view.name)) continue;
        const file = path.join(outDir, `report-${width}-${view.name}-${scheme}.png`);
        rmSync(file, { force: true });
        await load(cdp, sessionId, `${reportUrl}${view.anchor}`);
        if (view.anchor && !(await evaluate(cdp, sessionId, `document.getElementById(${JSON.stringify(view.anchor.slice(1))}) !== null`))) {
          problems.push(`the report has no element ${view.anchor} for the ${view.name} view`);
          continue;
        }
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        writeFileSync(file, Buffer.from(data, 'base64'));
        if (statSync(file).size === 0) {
          problems.push(`${file} is empty`);
          continue;
        }
        const actual = pngWidth(file);
        if (actual !== width) problems.push(`${file} is ${actual === undefined ? 'not a PNG' : `${actual} px wide, expected ${width}`}`);
        written.push(file);
      }
    }
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }, sessionId);
    await load(cdp, sessionId, reportUrl);
    const layout = await evaluate(cdp, sessionId, PROBE);
    console.log(
      `${width} px: frame ${layout.innerWidth}, content ${layout.clientWidth}, page width ${layout.scrollWidth}, ${layout.scrollingTables} of ${layout.tables} tables scroll inside their container`,
    );
    if (layout.innerWidth !== width) problems.push(`the report viewport was ${layout.innerWidth} px, expected ${width}`);
    if (layout.scrollWidth > layout.clientWidth) {
      problems.push(`page-level horizontal overflow at ${width} px (${layout.offenders.join(', ') || 'unknown element'})`);
    }
  }
  await cdp.close();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

console.log(`Report: ${reportFile}`);
for (const file of written) console.log(file);
if (problems.length > 0) fail(problems.join('; '));
