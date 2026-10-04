// The real cookie banner and its preferences window on every device profile devices.mjs uses.
// A visitor must be able to read and answer it everywhere: after each window has slid in, every
// button is scrolled into view (as a finger would scroll the sheet) and must then be on screen,
// at least 24px, and clear of the buttons in its own row. Nothing may scroll the page sideways
// or spill out of its box. On screens 375px wide or narrower, "Reject all" is tapped inside the
// preferences window and must save the choice. Exits non-zero on any problem.
//
//   node banner.mjs                                  # local copy of ../public, under the real domain
//   node banner.mjs https://appliedpsychometrics.org # the live site
//
// CookieYes draws its banner only on the domain it is registered for, so a local run serves
// ../public under https://appliedpsychometrics.org, as check.mjs does. OUT=<dir> saves screenshots.
import * as pw from 'playwright';
import { serve } from './serve.mjs';

const SITE = 'https://appliedpsychometrics.org';
const live = process.argv[2]?.replace(/\/$/, '');
const server = live ? null : await serve(0);
const local = server && `http://localhost:${server.address().port}`;
const OUT = process.env.OUT;
const DESKTOPS = [[1024, 640], [1280, 600], [1280, 800], [1366, 768], [1440, 900], [1536, 864], [1680, 1050], [1920, 1080], [2560, 1440], [3440, 1440]];
const profiles = [
  ...Object.entries(pw.devices)
    .filter(([, d]) => d.isMobile || /iPad|Galaxy Tab|Kindle|Nexus 10|Nexus 7/.test(d.userAgent))
    .map(([name, d]) => ({ name, ...d })),
  ...DESKTOPS.map(([width, height]) => ({ name: `Desktop ${width}x${height}`, viewport: { width, height }, deviceScaleFactor: 1, defaultBrowserType: 'chromium' })),
  { name: 'Folded 280', viewport: { width: 280, height: 653 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: 'chromium' },
];
const SHOTS = new Set(['iPhone SE', 'iPhone 15 Pro Max', 'Galaxy S9+', 'Pixel 7 landscape', 'iPad Mini', 'iPad Mini landscape', 'iPad Pro 11 landscape', 'Desktop 1280x800', 'Desktop 1920x1080', 'Desktop 3440x1440', 'Folded 280', 'iPhone SE landscape']);

// Everything a visitor could not use, judged the way a person meets it: after the window has
// settled, each button is scrolled into view (as a finger would scroll the sheet), then it must
// be on the screen, at least 24px (WCAG 2.5.8), and clear of the other buttons in its own row.
// Content scrolling under the pinned footer is by design, so only buttons that share a parent row
// are compared for overlap.
const inspect = (rootSel) => {
  const out = [];
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  if (document.documentElement.scrollWidth > vw + 0.5) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px on ${vw}px)`);
  const root = document.querySelector(rootSel);
  if (!root) return [`${rootSel} missing`];
  const rr = root.getBoundingClientRect();
  if (rr.left < -0.5 || rr.right > vw + 0.5) out.push(`window wider than the screen (${Math.round(rr.left)}..${Math.round(rr.right)} of ${vw})`);
  const btns = [...root.querySelectorAll('button')].filter((b) => b.offsetParent && getComputedStyle(b).visibility !== 'hidden');
  for (const b of btns) {
    b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = b.getBoundingClientRect();
    const t = (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24);
    if (r.width < 23.5 || r.height < 23.5) out.push(`"${t}" is ${r.width.toFixed(1)}x${r.height.toFixed(1)}px`);
    if (r.top < -0.5 || r.bottom > vh + 0.5 || r.left < -0.5 || r.right > vw + 0.5) out.push(`"${t}" cannot be brought onto the screen`);
  }
  const rows = new Map();
  for (const b of btns) { const k = b.parentElement; rows.set(k, [...(rows.get(k) ?? []), b]); }
  for (const row of rows.values()) for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) {
    const a = row[i].getBoundingClientRect(), c = row[j].getBoundingClientRect();
    if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1) out.push(`"${row[i].textContent.trim()}" overlaps "${row[j].textContent.trim()}"`);
  }
  for (const el of root.querySelectorAll('p, button, span, div')) {
    if (!el.offsetParent || el.children.length) continue;
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') out.push(`text spills out of ${el.className || el.tagName}`);
  }
  return [...new Set(out)];
};

// The banner and the preferences window slide in with CSS transitions (~1.2s). On a busy CI
// machine that took longer than a fixed wait, and a few random profiles failed with every button
// "off screen". So wait until no CookieYes transition is still running.
const settle = async (page) => {
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.target?.closest?.('.cky-consent-container, .cky-modal')), null, { timeout: 15000 });
};

const browsers = {};
const failures = [];
let checked = 0;
const queue = [...profiles];
async function worker() {
  for (let d = queue.shift(); d; d = queue.shift()) {
    const type = d.defaultBrowserType;
    browsers[type] ??= pw[type].launch();
    const browser = await browsers[type];
    const { name, defaultBrowserType, ...options } = d;
    const ctx = await browser.newContext(options);
    if (local) await ctx.route(`${SITE}/**`, async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(SITE, local) }) }));
    // CookieYes counts each banner load as a pageview (5,000 a month on our plan) and keeps each
    // choice as a consent record; answered here so the sweep uses neither.
    await ctx.route('https://log.cookieyes.com/**', (r) => r.fulfill({ status: 204 }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 140)));
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 140)));
    const problems = [];
    try {
      await page.goto(SITE + '/', { waitUntil: 'load' });
      await page.locator('.cky-btn-accept').first().waitFor({ state: 'visible', timeout: 20000 });
      await settle(page);
      problems.push(...(await page.evaluate(inspect, '.cky-consent-container')).map((p) => `banner: ${p}`));
      if (OUT && SHOTS.has(name)) await page.screenshot({ path: `${OUT}/b-${name.replace(/\W+/g, '_')}.png` });
      await page.locator('.cky-btn-customize').first().click();
      await page.locator('.cky-modal.cky-modal-open').waitFor({ state: 'visible', timeout: 10000 });
      await settle(page);
      problems.push(...(await page.evaluate(inspect, '.cky-modal.cky-modal-open .cky-preference-center')).map((p) => `preferences: ${p}`));
      if (OUT && SHOTS.has(name)) await page.screenshot({ path: `${OUT}/p-${name.replace(/\W+/g, '_')}.png` });
      if (d.viewport.width <= 375) {
        const reject = page.locator('.cky-modal-open .cky-btn-reject');
        await reject.scrollIntoViewIfNeeded();
        await reject.tap({ timeout: 5000 }).catch(() => reject.click({ timeout: 5000 }));
        await page.waitForTimeout(800);
        const consent = (await ctx.cookies()).find((c) => c.name === 'cookieyes-consent')?.value ?? '';
        if (!/consent:no/.test(consent) || !/action:yes/.test(consent)) problems.push(`preferences: tapping Reject all did not save the choice (${consent.slice(0, 60)})`);
      }
    } catch (e) {
      problems.push(`could not open the banner: ${String(e.message).split('\n')[0].slice(0, 120)}`);
    }
    problems.push(...errors.map((e) => `console: ${e}`));
    checked++;
    if (problems.length) failures.push(`${name} ${d.viewport.width}x${d.viewport.height}: ${problems.slice(0, 6).join('; ')}`);
    await ctx.close();
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
for (const b of Object.values(browsers)) await (await b).close();
server?.close();
for (const f of failures) console.log('FAIL ' + f);
console.log(`\n${profiles.length} devices: ${checked} checked, ${failures.length} with problems`);
process.exit(failures.length ? 1 : 0);
