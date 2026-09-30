// Every phone, tablet and foldable profile Playwright knows (portrait and landscape), plus common
// desktop sizes, on every page, each in its own engine (WebKit for Apple devices, Chromium for
// Android) with touch and pixel density emulated. Exits non-zero on any layout problem.
//
//   node devices.mjs                                  # local copy of ../public
//   node devices.mjs https://appliedpsychometrics.org
import * as pw from 'playwright';
import { layoutIssues } from './layout.mjs';
import { serve } from './serve.mjs';

let base = process.argv[2];
let server;
if (!base) {
  server = await serve(0); // any free port
  base = `http://localhost:${server.address().port}`;
}
base = base.replace(/\/$/, '');

const PAGES = ['/', '/imprint', '/privacy', '/missing-page'];
const DESKTOPS = [[1024, 640], [1280, 600], [1280, 800], [1366, 768], [1440, 900], [1536, 864], [1680, 1050], [1920, 1080], [2560, 1440], [3440, 1440]];
const profiles = [
  ...Object.entries(pw.devices)
    .filter(([, d]) => d.isMobile || /iPad|Galaxy Tab|Kindle|Nexus 10|Nexus 7/.test(d.userAgent))
    .map(([name, d]) => ({ name, ...d })),
  ...DESKTOPS.map(([width, height]) => ({ name: `Desktop ${width}x${height}`, viewport: { width, height }, deviceScaleFactor: 1, defaultBrowserType: 'chromium' })),
  { name: 'Folded, 280px', viewport: { width: 280, height: 653 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: 'chromium' },
];

const browsers = {};
const failures = [];
let checked = 0;
const queue = profiles.flatMap((d) => PAGES.map((p) => [d, p]));
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const [d, p] = job;
    const type = d.defaultBrowserType;
    browsers[type] ??= pw[type].launch();
    const browser = await browsers[type];
    const { name, defaultBrowserType, ...options } = d;
    if (type === 'firefox') delete options.isMobile;
    const ctx = await browser.newContext({ ...options, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && !/404 \(Not Found\)/.test(m.text()) && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + p, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const issues = [...(await layoutIssues(page)), ...errors];
    checked++;
    if (issues.length) {
      failures.push(`${name} ${d.viewport.width}x${d.viewport.height} ${p}: ${issues.slice(0, 5).join('; ')}`);
      console.log(`FAIL ${name} (${d.viewport.width}x${d.viewport.height}) ${p}\n     ${issues.slice(0, 5).join('\n     ')}`);
    }
    await ctx.close();
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
for (const b of Object.values(browsers)) await (await b).close();
server?.close();
console.log(`\n${profiles.length} devices × ${PAGES.length} pages = ${checked} checks, ${failures.length} with problems`);
process.exit(failures.length ? 1 : 0);
