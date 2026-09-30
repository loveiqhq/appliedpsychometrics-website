// End-to-end check of the site in real browsers. Exits non-zero on any failure.
//
//   cd tools && npm install && npx playwright install chromium webkit firefox
//   node check.mjs                                  # against a local copy of ../public
//   node check.mjs https://appliedpsychometrics.org # against the live site
//   node check.mjs --browsers=chromium              # one engine only
//
// 1. static: the CSP hash in vercel.json matches the inline script; every local link and asset exists
// 2. layout: no horizontal scroll, nothing escaping the viewport, no text overflowing its box and
//    no overlapping text, at 20 widths from 320px to 2560px
// 3. motion: one-shot animations wait until scrolled into view, reduced motion shows every final
//    state, the page still animates without JavaScript, hover states apply
// 4. accessibility: axe-core, WCAG 2.2 AA plus best practices
// 5. consent: the real cookie banner shows and passes axe, nothing loads before a choice, GA4 and
//    PostHog send after "Accept all" and on the next page, and nothing loads after "Reject all"
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import * as pw from 'playwright';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const browsers = (args.find((a) => a.startsWith('--browsers='))?.split('=')[1] ?? 'chromium,webkit,firefox').split(',');
let base = args.find((a) => !a.startsWith('--'));
let server;
if (!base) {
  server = await serve(0); // any free port
  base = `http://localhost:${server.address().port}`;
}
base = base.replace(/\/$/, '');

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};
const PAGES = ['/', '/imprint', '/privacy'];
// CookieYes draws its banner only on the registered domain, and a banner over the page would hide
// what sections 2-4 look at, so they get an empty stand-in. Section 5 uses the real banner.
const noBanner = (target) => target.route('https://cdn-cookieyes.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
const SITE = 'https://appliedpsychometrics.org';
const TRACKERS = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|www\.google\.[a-z.]+\/g\/|posthog\.com/;
const SENDS = /\/g\/collect|posthog\.com\/(i\/v0\/e|e|batch|s)\//;
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const WIDTHS = [320, 360, 375, 390, 412, 430, 600, 768, 820, 834, 900, 1024, 1100, 1180, 1280, 1366, 1440, 1536, 1920, 2560];

// ---------- 1. static ----------
{
  const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const script = index.match(/<script>([\s\S]*?)<\/script>/)[1];
  const hash = `'sha256-${crypto.createHash('sha256').update(script).digest('base64')}'`;
  const csp = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
    .headers.flatMap((r) => r.headers)
    .find((h) => h.key === 'Content-Security-Policy').value;
  check(csp.includes(`script-src ${hash}`), `CSP allows the inline script (${hash})`);
  for (const file of fs.readdirSync(path.join(ROOT, 'public')).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(ROOT, 'public', file), 'utf8');
    for (const [, ref] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      const target = path.join(ROOT, 'public', ref === '/' ? 'index.html' : path.extname(ref) ? ref : `${ref}.html`);
      check(fs.existsSync(target), `${file}: ${ref} exists`);
    }
  }
}

// ---------- 2-4. in each browser ----------
for (const name of browsers) {
  const browser = await pw[name].launch();

  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await noBanner(page);
    const errors = [];
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const issues = await page.evaluate(() => {
      const out = [];
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw) out.push(`page is ${document.documentElement.scrollWidth}px wide`);
      const shown = (el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length;
      const clipped = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true;
        return false;
      };
      const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).trim().replace(/\s+/g, '.')}`;
      for (const el of document.querySelectorAll('body *')) {
        if (!shown(el) || (el.closest('svg') && el.tagName !== 'svg')) continue;
        const b = el.getBoundingClientRect();
        if ((b.right > vw + 0.5 || b.left < -0.5) && !clipped(el)) out.push(`${label(el)} escapes the viewport`);
        const inline = ['svg', 'a', 'span', 'b', 'i', 'em'].includes(el.tagName.toLowerCase());
        if (!inline && getComputedStyle(el).overflowX === 'visible' && el.clientWidth && el.scrollWidth > el.clientWidth + 1)
          out.push(`${label(el)} content is wider than its box`);
      }
      const texts = [...document.querySelectorAll('h1,h2,h3,p,li,span.m,a.btn,address,.chip,.v,text')]
        .filter(shown)
        .map((el) => ({ el, rs: [...el.getClientRects()].filter((r) => r.width > 1 && r.height > 1) }));
      for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++) {
          const A = texts[i];
          const B = texts[j];
          if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
          // Firefox reports the full ascent-to-descent box for SVG text, so allow a little slack there.
          const slack = A.el.tagName === 'text' && B.el.tagName === 'text' ? 3.5 : 2;
          for (const a of A.rs)
            for (const b of B.rs) {
              const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (ox > 2 && oy > slack) out.push(`"${A.el.textContent.trim().slice(0, 20)}" overlaps "${B.el.textContent.trim().slice(0, 20)}"`);
            }
        }
      return [...new Set(out)];
    });
    check(!issues.length && !errors.length, `${name} ${w}px layout${issues.length || errors.length ? ': ' + [...issues, ...errors].slice(0, 6).join('; ') : ''}`);
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await noBanner(page);
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => {
      const bar = document.querySelector('.cards .bar');
      return {
        js: document.documentElement.classList.contains('js'),
        hero: getComputedStyle(document.querySelector('.hero h1')).animationPlayState,
        bar: getComputedStyle(bar).animationPlayState,
        barWidth: bar.getBoundingClientRect().width,
        cell: getComputedStyle(document.querySelector('.graph-h .pg-cell')).animationPlayState,
      };
    });
    check(s.js && s.hero === 'running', `${name} motion: hero animates on load`);
    check(s.bar === 'paused' && s.barWidth < 1 && s.cell === 'paused', `${name} motion: lower sections wait until they are scrolled to`);
    await page.locator('.cards').scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
    const grown = await page.evaluate(() => {
      const bar = document.querySelector('.cards .bar');
      return bar.getBoundingClientRect().width / bar.parentElement.getBoundingClientRect().width;
    });
    check(Math.abs(grown - 0.46) < 0.01, `${name} motion: score bar grows to its value once visible (${(grown * 100).toFixed(1)}%)`);
    await page.locator('.graph-h').scrollIntoViewIfNeeded();
    let band = 0;
    for (let t = 0; t < 40 && band < 0.5; t++) {
      await page.waitForTimeout(100);
      band = Math.max(band, Number(await page.evaluate(() => getComputedStyle(document.querySelector('.graph-h .pg-band')).opacity)));
    }
    await page.waitForTimeout(5000);
    const built = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.graph-h .pg-cell')];
      const dot = document.querySelector('.graph-h .pg-norm').getBoundingClientRect();
      const svg = document.querySelector('.graph-h').getBoundingClientRect();
      return {
        cells: cells.every((c) => getComputedStyle(c).opacity === '1'),
        dotX: ((dot.left + dot.width / 2 - svg.left) * 1120) / svg.width,
        band: getComputedStyle(document.querySelector('.graph-h .pg-band')).opacity,
      };
    });
    check(band > 0.5, `${name} psychograph: the light band sweeps once revealed (peak opacity ${band})`);
    check(built.cells && Math.abs(built.dotX - 1030) < 1 && built.band === '0', `${name} psychograph: build ends on the canvas composition (${JSON.stringify(built)})`);
    const card = page.locator('.card').first();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(400);
    const rest = await card.evaluate((e) => getComputedStyle(e).borderTopColor);
    await card.hover();
    await page.waitForTimeout(500);
    const hover = await card.evaluate((e) => ({ c: getComputedStyle(e).borderTopColor, t: getComputedStyle(e).transform }));
    check(hover.c !== rest && hover.t.includes('-3'), `${name} motion: cards lift and tint on hover`);
    await page.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await noBanner(ctx);
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      running: document.getAnimations().length,
      edge: getComputedStyle(document.querySelector('.eg')).strokeDashoffset,
      scan: getComputedStyle(document.querySelector('.scan')).display,
      comet: getComputedStyle(document.querySelector('.pg-head')).opacity,
      cell: getComputedStyle(document.querySelector('.graph-h .pg-cell')).opacity,
      bar: document.querySelector('.cards .bar').getBoundingClientRect().width / document.querySelector('.cards .track').getBoundingClientRect().width,
    }));
    check(r.running === 0 && ['0', '0px'].includes(r.edge) && r.scan === 'none' && Math.abs(r.bar - 0.46) < 0.01 && r.comet === '0' && r.cell === '1',
      `${name} reduced motion: nothing moves and every final state shows (${JSON.stringify(r)})`);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    const w = await page.evaluate(() => document.querySelector('.cards .bar').getBoundingClientRect().width);
    check(w > 50, `${name} without JavaScript: animations still run (bar ${w.toFixed(0)}px)`);
    await ctx.close();
  }
  for (const p of [...PAGES, '/missing-page']) {
    for (const w of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
      await noBanner(ctx);
      const page = await ctx.newPage();
      const res = await page.goto(base + p, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      if (p === '/missing-page') check(res.status() === 404, `${name} ${p} answers 404`);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      check(!r.violations.length, `${name} ${p} @${w}px accessibility${r.violations.map((v) => ` [${v.impact}] ${v.id}`).join('')}`);
      await ctx.close();
    }
  }

  // ---------- 5. consent ----------
  // The real CookieYes banner, on the real domain: a local check serves ../public under it. GA4
  // and PostHog data requests are aborted, so a check never records a visit. PostHog ignores
  // automated browsers, so the page is told it is not one.
  for (const [choice, width] of [['accept', 1440], ['reject', 390]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, ...(name === 'chromium' && { userAgent: CHROME_UA }) });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      if (navigator.userAgentData) Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Google Chrome', version: '149' }], mobile: false, platform: 'macOS' }) });
    });
    if (base !== SITE) await ctx.route(`${SITE}/**`, async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(SITE, base) }) }));
    const tracked = [];
    await ctx.route(TRACKERS, (route) => {
      tracked.push(route.request().url());
      return SENDS.test(route.request().url()) ? route.abort() : route.fallback();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && !/net::ERR_FAILED/.test(m.text()) && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    const until = async (test) => {
      for (let t = 0; t < 48 && !test(); t++) await page.waitForTimeout(250);
      return test();
    };
    await page.goto(SITE + '/', { waitUntil: 'load' });
    const button = page.locator(choice === 'accept' ? '.cky-btn-accept' : '.cky-btn-reject').first();
    const shown = await button.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
    check(shown, `${name} consent @${width}px: the cookie banner shows`);
    if (!shown) {
      await ctx.close();
      continue;
    }
    const a11y = await new AxeBuilder({ page }).include('.cky-consent-container').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    check(!a11y.violations.length, `${name} consent @${width}px: the banner's accessibility${a11y.violations.map((v) => ` [${v.impact}] ${v.id}`).join('')}`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(wide <= 0, `${name} consent @${width}px: the banner fits the screen (${wide}px over)`);
    const cookies = (await ctx.cookies()).map((c) => c.name);
    check(!tracked.length && cookies.every((c) => c === 'cookieyes-consent'), `${name} consent: nothing loads before a choice (${tracked.length} requests; cookies: ${cookies.join(', ') || 'none'})`);
    await button.click();
    if (choice === 'accept') {
      const both = () => tracked.some((u) => /google-analytics\.com\/g\/collect/.test(u)) && tracked.some((u) => /posthog\.com\/(i\/v0\/e|e|batch)\//.test(u));
      check(await until(both), `${name} consent: GA4 and PostHog send after "Accept all"`);
      // Judged by the new page's own state: the old page's last beacon, sent as it unloads, would
      // otherwise pass this on its own.
      const running = () => page.evaluate(() => !!(window.posthog && window.posthog.__loaded) && typeof window.gtag === 'function').catch(() => false);
      await page.reload({ waitUntil: 'load' });
      let held = false;
      for (let t = 0; t < 48 && !held; t++) held = (await running()) || (await page.waitForTimeout(250), false);
      check(held, `${name} consent: the choice holds on the next page`);
      // Withdrawing: the round button CookieYes leaves on the page reopens the choice, and
      // "Reject all" there reloads the page without analytics.
      await page.locator('.cky-btn-revisit').click();
      const reloaded = page.waitForEvent('load', { timeout: 15000 }).then(() => true, () => false);
      await page.locator('.cky-modal .cky-btn-reject').click();
      await reloaded;
      await page.waitForTimeout(3000);
      check(!(await running()) && !(await page.evaluate(() => 'posthog' in window || 'gtag' in window)), `${name} consent: withdrawing it stops analytics`);
    } else {
      await page.waitForTimeout(4000);
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(3000);
      check(!tracked.length, `${name} consent: nothing loads after "Reject all", on that page or the next (${tracked.length} requests)`);
    }
    check(!errors.length, `${name} consent (${choice}): no console errors${errors.length ? ': ' + [...new Set(errors)].map((e) => e.slice(0, 160)).join('; ') : ''}`);
    await ctx.close();
  }
  await browser.close();
}

server?.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
