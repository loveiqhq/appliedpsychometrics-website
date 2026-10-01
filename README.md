# appliedpsychometrics.org

The company website of Applied Psychometrics UG (haftungsbeschränkt). Plain static HTML and CSS
with no build step, hosted on Vercel (team `loveiq`, project `appliedpsychometrics-website`).
Every push to `main` goes live; every other branch gets a preview.

## Where the design comes from

It is built from the Claude Design canvas
[Applied Psychometrics — Mapping the human mind](https://claude.ai/artifact/PbdVXZwcLxnnNkkiyrMVnp).
`design/Main.dc.html` is the artboard it was built from (canvas version `1790682926-d106`,
29 Sep 2026). At 1200px and wider the page matches it pixel for pixel. Narrower screens get an
adapted layout, including phone versions of the loop and psychograph diagrams.

A later change to the canvas does not reach the site by itself: copy it into `public/` by hand
and run the check below.

### Deliberate differences from the canvas

- Copy: "tests win attention", "improve their lives", "behaviour" (the page's British spelling),
  and "every one of our instruments, every claim, every report and every signal … This ensures".
- Screening language, per the strategy's "screening, not diagnosis": the values strip says
  "Mental screening & assessment" and the psychograph text says "screening, intervention and
  outcome".
- The stray orange "I" in "INSTRUMENT LIBRARY" is grey like the other section labels.
- The library cards' descriptions state each test's size, at Marcus's request (2026-10-01): the
  canvas called the 29-item depression test a "nine-item screen". Each now reads "29 items built on
  the PHQ-9 …", and likewise for the other three. The PHQ-9 (9 items), GAD-7 (7), UCLA-3 (3) and
  SDI-2 (14) are the instruments inside the tests; the item counts and minutes are Marcus's.
- A CookieYes consent banner, styled in the site's type and colours (see "Analytics and consent").
- The footer names the company in full, "UG (haftungsbeschränkt)", and links to real Imprint,
  Privacy and Contact pages instead of placeholders.
- Hover effects the canvas declared but its inline styles blocked now work (button borders,
  card tint, chip colour). The footer underline covers the word, not the whole column.
- Animations lower on the page start when they scroll into view instead of at page load.
- The psychograph's motion is new. On the canvas it looped every 9 seconds, with every cell
  blinking off and on and the dashed lines marching. Now it builds once, when scrolled into view:
  the sources, then the connectors, then a band of light sweeping across the weeks, then each
  dimension's marker gliding to its value. After that it stays calm, with an occasional point of
  data travelling from a source into its row. Hovering a row or a source isolates it. The
  resting picture is still the canvas's, pixel for pixel. Both versions of the diagram are
  generated: to change them or their timing, edit `tools/psychograph.py` and run
  `python3 tools/psychograph.py`.
- With "reduce motion" on, the network lines now show (on the canvas they stayed invisible).
- Below 1200px (the canvas has no smaller layouts): headings wrap into balanced lines,
  paragraphs avoid a single word on their last line, and hyphenated words such as "re-test"
  and "sign-off" never split across lines. Tablets (768-1023px) get a horizontal loop diagram
  spaced for their width; phones get a vertical one.
- The hero and the instrument library no longer have fixed heights, so larger text (browser
  settings, accessibility tools) makes them grow instead of being clipped or overlapping.
- Fonts are served from this domain instead of Google Fonts, so no visitor data goes to Google.
- Links to loveiq.org carry `utm_source=appliedpsychometrics.org` so LoveIQ's funnel counts
  these visitors as coming from here rather than as "Direct".

## Editing

- The pages are `public/index.html`, `imprint.html`, `privacy.html` and `404.html`. The header
  and footer are repeated in all four.
- All styles are in `public/site.css`. Everything above the media queries is the canvas's
  1440px values; the media queries at the end hold the narrower layouts.
- The small script in the `<head>` of `index.html` is allowed by its hash in the
  Content-Security-Policy in `vercel.json`. If you change the script, update the hash; the check
  prints the right value. A stale hash does not break the page: the animations just all play at
  load.

## Analytics and consent

Google Analytics 4 (`G-9WSTCKKBYQ`, a property in LoveIQ's GA account) and PostHog (its own
project in LoveIQ's EU organisation) run only after a visitor accepts analytics cookies in the
CookieYes banner (a site in LoveIQ's CookieYes account). Before that the site loads neither and
stores only the `cookieyes-consent` cookie. Microsoft Clarity is planned but not added yet.

- `public/analytics.js` loads on every page and waits for CookieYes's `cookieyes_banner_load` and
  `cookieyes_consent_update` events. It starts both tools once `getCkyConsent()` reports analytics
  as accepted, and reloads the page if that consent is withdrawn. CookieYes's own script blocking
  (`type="text/plain"` with `data-cookieyes`) is not used: it only handles tags added after
  CookieYes has loaded, so on a static page consent given on an earlier visit never switched them
  on.
- PostHog talks to `eu.i.posthog.com` directly. LoveIQ sends it through its own domain, but here
  Vercel's trailing-slash redirect would bounce every capture request, which ends in a slash.
- Their hosts are in the Content-Security-Policy in `vercel.json`. That includes `www.google.com`,
  which GA4 calls even with Google signals and ad storage off.
- The banner's colours and type are overridden at the end of `site.css`. Its wording is edited
  in the CookieYes dashboard.
- The privacy page describes all of this, including the cookie names, so keep it in step.

## Checking

```bash
cd tools
npm install
npx playwright install chromium webkit firefox
node check.mjs                                   # local copy of public/
node check.mjs https://appliedpsychometrics.org  # the live site
```

It checks the layout at 20 widths from 320px to 2560px in Chromium, WebKit (Safari) and
Firefox, the animations (including reduced motion and no JavaScript), accessibility with axe
(WCAG 2.2 AA), the 404 page, and that every local link and asset exists. Those checks, and
`devices.mjs`, replace the cookie banner with an empty script so that it does not cover the page.

The consent checks use the real banner on the real domain; a local run serves `public/` under
`https://appliedpsychometrics.org`. They check the banner with axe and at phone width, that
nothing loads before a choice, and that GA4 and PostHog send after "Accept all" and on the next
page. They also check that withdrawing consent stops both, and that nothing loads after "Reject
all". Data requests are aborted, so a check never records a visit. PostHog ignores automated
browsers, so the check tells the page it is not one.

`node devices.mjs [url]` loads all four pages on every phone, tablet and foldable profile
Playwright has, in portrait and landscape, plus ten desktop sizes and a 280px folded phone
(211 profiles, 844 page loads). Each runs in its own engine with touch and pixel density
emulated, and the run fails on horizontal scrolling, content escaping the screen, text wider
than its box, overlapping text, or crowded tap targets under 24px.

GitHub runs both on every push to `main` and on every pull request (`.github/workflows/check.yml`).
Every morning it also checks the live site: https, the certificate, the www and http redirects
and the full check in Chromium (`.github/workflows/live.yml`). A failure emails the workflow's owner.

Each push to `main` also posts its commits, with their "For Marcus" line, to #commits-prod-staging in
Slack (`.github/workflows/slack-commits.yml`, LoveIQ's file with one addition). GitHub cannot copy
LoveIQ's webhook secret, so this repo posts as LoveIQ's `loveiq_journey` bot instead. The bot's
token is the repository secret `SLACK_BOT_TOKEN`, and it can only post messages. A
`SLACK_COMMITS_WEBHOOK_URL` secret, if one is ever added, takes over from the bot.

## Domain

The domain is registered at united-domains (Marcus's account), and its DNS is managed there:
an A record for the domain itself points at `216.150.1.1`, and a CNAME from `www` to
`cname.vercel-dns.com`. Both point at Vercel, which issues and renews the certificate. The domain
is not used for email, and says so: its TXT record `v=spf1 -all` and a `_dmarc` TXT record
`v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s` tell mail servers to refuse anything sent in
its name. A `google-site-verification` TXT record proves ownership to Google Search Console, which
has the sitemap. On united-domains a TXT record's host goes in the "Subdomain / Hostname" box: a
`_dmarc` record left with that box empty lands on the domain itself, where nothing reads it.

## Fonts

IBM Plex Sans and IBM Plex Mono (© IBM Corp.) and Instrument Serif (© The Instrument Serif
Project Authors), all under the SIL Open Font License 1.1. The files are Google Fonts' latin and
latin-ext subsets.
