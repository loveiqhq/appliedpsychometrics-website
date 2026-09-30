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
(WCAG 2.2 AA), the 404 page, and that every local link and asset exists.

`node devices.mjs [url]` loads all four pages on every phone, tablet and foldable profile
Playwright has, in portrait and landscape, plus ten desktop sizes and a 280px folded phone
(211 profiles, 844 page loads). Each runs in its own engine with touch and pixel density
emulated, and the run fails on horizontal scrolling, content escaping the screen, text wider
than its box, overlapping text, or crowded tap targets under 24px.

GitHub runs both on every push to `main` and on every pull request (`.github/workflows/check.yml`).
Every morning it also checks the live site: https, the certificate, the www and http redirects
and the full check in Chromium (`.github/workflows/live.yml`). A failure emails the workflow's owner.

## Domain

The domain is registered at united-domains (Marcus's account), and its DNS is managed there:
an A record for the domain itself points at `216.150.1.1`, and a CNAME from `www` to
`cname.vercel-dns.com`. Both point at Vercel, which issues and renews the certificate. The domain
is not used for email.

## Fonts

IBM Plex Sans and IBM Plex Mono (© IBM Corp.) and Instrument Serif (© The Instrument Serif
Project Authors), all under the SIL Open Font License 1.1. The files are Google Fonts' latin and
latin-ext subsets.
