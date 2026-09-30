"""The psychograph diagram, desktop and phone, with its choreographed build and idle motion.

Run `python3 tools/psychograph.py` to rewrite both diagrams in public/index.html (between the
`<!-- psychograph -->` markers) from the canvas copy in design/Main.dc.html.

At rest (and with reduced motion) both versions draw exactly the canvas's composition: the same
elements, coordinates and colours. Only the motion differs from the canvas:

  build, once, when the diagram scrolls into view (about 4.5s):
    labels fade in, the sources slide in, their connectors draw themselves into the spine,
    the grid rows unroll, a band of light sweeps across the weeks and develops each column's
    cells as it passes, then every dimension's dot glides from the norm tick to its value
  idle, afterwards, calm and never resetting:
    a small comet of data travels from a source into its row every 1.6s and lights the newest
    cell it lands in; the ingest point and the desire marker ripple softly

Timings are written into each element as animation-delay so the CSS stays shared.
"""

MONO = "'IBM Plex Mono', monospace"
ORANGE, VIOLET = '#E0785A', '#9B7ED8'
HEAD = {ORANGE: '#FFC6B4', VIOLET: '#DDD2FF'}
WEEKS = ['0', '2', '4', '6', '8', '12', '16', '20', '26', '52']
DIMS = ['AFFECT', 'ANXIETY', 'ATTACHMENT', 'DESIRE', 'MEANING', 'REGULATION']
SOURCES = [
    ('VALIDATED ASSESSMENTS', 'PHQ-9 · GAD-7 · UCLA-3 · MLQ', ORANGE),
    ('AUTOMATED RE-TESTS', 'WEEK 6 · WEEK 12 · ONWARD', ORANGE),
    ('PRACTITIONER SESSIONS', 'CONSENTED TRANSCRIPTION', ORANGE),
    ('JOURNALING &amp; GOALS', 'IN-APP BEHAVIOUR', VIOLET),
    ('INTERVENTION OUTCOMES', 'MARKETPLACE &amp; AFFILIATE', VIOLET),
]
# Which row each source's comet lands in (journaling feeds the behavioural regulation row).
COMET_ROW = [0, 1, 2, 5, 4]
# Norm markers: x on the desktop 1004-1100 scale, and colour.
NORM = [(1030, ORANGE), (1068, ORANGE), (1044, ORANGE), (1082, ORANGE), (1022, ORANGE), (1060, VIOLET)]
DESIRE = 3


def d(t):
    return f'animation-delay: {t:.2f}s'


class Timeline:
    """The build's beats, in seconds after the diagram is revealed."""

    def __init__(self, sweep):
        self.head = 0.0          # headers and legend
        self.src = 0.08          # sources slide in, 0.08s apart
        self.dot = 0.30          # source dots pop
        self.curve = 0.45        # connectors draw
        self.spine = 0.85
        self.ingest = 1.00
        self.tick = 1.05
        self.rows = 0.95         # rows unroll, 0.05s apart
        self.labels = 1.10
        self.sweep = 1.35        # the band of light starts
        self.sweep_dur = sweep
        self.norm_lines = 1.35 + sweep * 0.78
        self.norm_dots = self.norm_lines + 0.30
        self.axis_note = self.norm_lines + 0.20
        self.arrow = self.norm_lines + 0.25
        self.idle = self.norm_dots + 1.25

    def column(self, c, cols, grid_w, band_w, pitch, cw):
        """When the band's leading edge reaches the middle of column c."""
        return self.sweep + self.sweep_dur * (c * pitch + cw / 2) / (grid_w + band_w)


def _defs(p, gx, gy, gw, gh, band_w):
    return [
        '<defs>',
        f'  <linearGradient id="{p}-band" x1="0" y1="0" x2="1" y2="0">',
        '    <stop offset="0" stop-color="#FFE9E1" stop-opacity="0"></stop>',
        '    <stop offset="0.72" stop-color="#FFE9E1" stop-opacity="0.07"></stop>',
        '    <stop offset="0.96" stop-color="#FFE9E1" stop-opacity="0.26"></stop>',
        '    <stop offset="1" stop-color="#FFE9E1" stop-opacity="0"></stop>',
        '  </linearGradient>',
        f'  <clipPath id="{p}-grid"><rect x="{gx}" y="{gy - 6}" width="{gw}" height="{gh + 12}"></rect></clipPath>',
    ]


def _mask(p, name, path_d, width, delay, dur_cls=''):
    """A mask that reveals a dashed line by drawing a solid stroke along it."""
    return (
        f'  <mask id="{p}-{name}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="2000" height="2000">'
        f'<path class="pg-draw{dur_cls}" d="{path_d}" pathLength="1" fill="none" stroke="#FFFFFF" '
        f'stroke-width="{width}" style="{d(delay)}"></path></mask>'
    )


def _comet(path_d, colour, start):
    head = HEAD[colour]
    s = d(start)
    return [
        '    <g>',
        f'      <path class="pg-halo" d="{path_d}" pathLength="100" fill="none" stroke="{head}" stroke-opacity="0.18" stroke-width="7" stroke-linecap="round" style="{s}"></path>',
        f'      <path class="pg-tail" d="{path_d}" pathLength="100" fill="none" stroke="{head}" stroke-opacity="0.5" stroke-width="1.6" stroke-linecap="round" style="{s}"></path>',
        f'      <path class="pg-head" d="{path_d}" pathLength="100" fill="none" stroke="{head}" stroke-width="2.6" stroke-linecap="round" style="{s}"></path>',
        '    </g>',
    ]


def desktop(aria):
    """The canvas's 1120x330 diagram, element for element."""
    p = 'pgd'
    gx, gy, pitch, cw, rp, ch = 320, 30, 58, 52, 36, 30
    gw, gh, band_w = 574, 210, 64
    tl = Timeline(sweep=2.2)
    col_t = lambda c: tl.column(c, 10, gw, band_w, pitch, cw)
    curves = [
        ('M258 39 C278 39 282 60 296 60', 39, 60),
        ('M258 83 C278 83 282 100 296 100', 83, 100),
        ('M258 127 C278 127 282 135 296 135', 127, 135),
        ('M258 171 C278 171 282 170 296 170', 171, 170),
        ('M258 215 C278 215 282 190 296 190', 215, 190),
    ]
    o = [f'<svg class="graph-h pg" data-reveal="0.35" width="1120" height="330" viewBox="0 0 1120 330" role="img" aria-label="{aria}">']
    o += _defs(p, gx, gy, gw, gh, band_w)
    for i, (cd, _, _) in enumerate(curves):
        o.append(_mask(p, f'c{i}', f'M250 {curves[i][1]} L{cd[1:]}', 6, tl.curve + 0.06 * i))
    for r in range(6):
        y = 45 + 36 * r
        o.append(_mask(p, f't{r}', f'M300 {y} L318 {y}', 5, tl.tick + 0.05 * r, ' pg-draw--fast'))
    o.append(_mask(p, 'arrow', 'M320 302 L876 302', 5, tl.arrow, ' pg-draw--slow'))
    o.append('</defs>')

    # headers and legend
    o.append(f'<g font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#8B8798">')
    o.append(f'  <text class="pg-fade" x="240" y="16" text-anchor="end" style="{d(tl.head)}">SOURCES</text>')
    o.append(f'  <text class="pg-fade" x="1052" y="16" text-anchor="middle" style="{d(tl.head + 0.1)}">VS NORM</text>')
    o.append('</g>')
    o.append(f'<rect class="pg-fade" x="320" y="8" width="9" height="9" fill="{ORANGE}" fill-opacity="0.75" style="{d(tl.head + 0.04)}"></rect>')
    o.append(f'<rect class="pg-fade" x="556" y="8" width="9" height="9" fill="{VIOLET}" fill-opacity="0.9" style="{d(tl.head + 0.08)}"></rect>')
    o.append(f'<g font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#A9A5B5">')
    o.append(f'  <text class="pg-fade" x="336" y="16" style="{d(tl.head + 0.04)}">PSYCHOMETRIC INSTRUMENT</text>')
    o.append(f'  <text class="pg-fade" x="572" y="16" style="{d(tl.head + 0.08)}">BEHAVIOURAL &amp; SESSION SIGNAL</text>')
    o.append('</g>')

    # sources, each with its label, dot and connector
    o.append(f'<g class="pg-srcs" font-family="{MONO}" text-anchor="end">')
    for i, ((title, sub, colour), (cd, dot_y, _)) in enumerate(zip(SOURCES, curves)):
        o.append('  <g class="pg-src">')
        o.append(f'    <text class="pg-slide" x="240" y="{dot_y + 4}" font-size="9.5" letter-spacing="0.7" fill="#ECEAF2" style="{d(tl.src + 0.08 * i)}">{title}</text>')
        o.append(f'    <text class="pg-slide" x="240" y="{dot_y + 16}" font-size="8" letter-spacing="0.7" fill="#8B8798" style="{d(tl.src + 0.08 * i + 0.04)}">{sub}</text>')
        o.append(f'    <circle class="pg-pop" cx="250" cy="{dot_y}" r="3" fill="{colour}" style="{d(tl.dot + 0.08 * i)}"></circle>')
        o.append(f'    <path d="{cd}" stroke="{colour}" opacity="0.8" fill="none" stroke-width="1.1" stroke-dasharray="3 5" mask="url(#{p}-c{i})"></path>')
        o.append('  </g>')
    o.append('</g>')

    # spine, ingest point, row ticks
    o.append(f'<line class="pg-growy" x1="296" y1="40" x2="296" y2="230" stroke="#3C3947" stroke-width="1" style="{d(tl.spine)}"></line>')
    o.append(f'<circle class="pg-ripple" cx="296" cy="135" r="4" fill="none" stroke="{ORANGE}" stroke-width="1" style="{d(tl.idle - 0.6)}"></circle>')
    o.append(f'<circle class="pg-pop" cx="296" cy="135" r="4" fill="{ORANGE}" style="{d(tl.ingest)}"></circle>')
    o.append('<g stroke="#3C3947" stroke-width="1" stroke-dasharray="3 5">')
    for r in range(6):
        y = 45 + 36 * r
        o.append(f'  <line x1="300" y1="{y}" x2="318" y2="{y}" mask="url(#{p}-t{r})"></line>')
    o.append('</g>')

    # the record: one group per dimension, so hovering a row can isolate it
    cells = _desktop_cells()
    o.append(f'<g class="pg-rows">')
    for r in range(6):
        y = gy + rp * r
        o.append('  <g class="pg-row">')
        o.append(f'    <rect x="{gx}" y="{y - 3}" width="780" height="36" fill="transparent"></rect>')
        o.append(f'    <rect class="pg-unroll" x="{gx}" y="{y}" width="{gw}" height="{ch}" fill="#1E1C26" style="{d(tl.rows + 0.05 * r)}"></rect>')
        for (c, colour, op) in cells[r]:
            o.append(f'    <rect class="pg-cell" x="{gx + pitch * c}" y="{y}" width="{cw}" height="{ch}" fill="{colour}" fill-opacity="{op}" style="{d(col_t(c) + 0.035 * r)}"></rect>')
        if r in COMET_ROW:
            i = COMET_ROW.index(r)
            o.append(f'    <rect class="pg-arrive" x="{gx + pitch * 9}" y="{y}" width="{cw}" height="{ch}" fill="#FFFFFF" fill-opacity="0.2" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1" style="{d(tl.idle + 1.6 * i)}"></rect>')
        o.append(f'    <text class="pg-fade pg-dim" x="906" y="{y + 19}" font-family="{MONO}" font-size="9" letter-spacing="0.9" fill="#A9A5B5" style="{d(tl.labels + 0.05 * r)}">{DIMS[r]}</text>')
        cy = y + 15
        o.append(f'    <line class="pg-normline" x1="1004" y1="{cy}" x2="1100" y2="{cy}" stroke="#35323F" stroke-width="1" style="{d(tl.norm_lines + 0.05 * r)}"></line>')
        o.append(f'    <line class="pg-fade" x1="1052" y1="{cy - 5}" x2="1052" y2="{cy + 5}" stroke="#4B4858" stroke-width="1" style="{d(tl.norm_lines + 0.05 * r)}"></line>')
        nx, colour = NORM[r]
        glide = f'transform: translateX({nx - 1052}px); {d(tl.norm_dots + 0.07 * r)}'
        o.append(f'    <circle class="pg-norm" cx="1052" cy="{cy}" r="3" fill="{colour}" style="{glide}"></circle>')
        if r == DESIRE:
            # the canvas draws this marker twice (its pulse copy); kept so the resting pixels match
            o.append(f'    <circle class="pg-norm" cx="1052" cy="{cy}" r="3" fill="{colour}" style="{glide}"></circle>')
            o.append(f'    <circle class="pg-ripple pg-ripple--slow" cx="{nx}" cy="{cy}" r="3" fill="none" stroke="{colour}" stroke-width="1" style="{d(tl.idle + 0.4)}"></circle>')
        o.append('  </g>')
    o.append('</g>')
    o.append('<g stroke="#292734" stroke-width="1">')
    for k in range(9):
        x = 375 + 58 * k
        o.append(f'  <line class="pg-fade" x1="{x}" y1="30" x2="{x}" y2="240" style="{d(tl.rows + 0.35)}"></line>')
    o.append('</g>')

    # the band of light that develops each week's column
    o.append(f'<g clip-path="url(#{p}-grid)">')
    o.append(f'  <g class="pg-band" style="{d(tl.sweep)}">')
    o.append(f'    <rect x="{gx - band_w}" y="{gy - 6}" width="{band_w}" height="{gh + 12}" fill="url(#{p}-band)"></rect>')
    o.append(f'    <line x1="{gx}" y1="{gy - 6}" x2="{gx}" y2="{gy + gh + 6}" stroke="{ORANGE}" stroke-width="1" stroke-opacity="0.7"></line>')
    o.append('  </g>')
    o.append('</g>')

    # data arriving, after the build
    o.append('<g class="pg-comets">')
    for i, ((_, _, colour), (cd, dot_y, _)) in enumerate(zip(SOURCES, curves)):
        yr = 45 + 36 * COMET_ROW[i]
        path = f'M250 {dot_y} L{cd[1:]} L296 {yr} L318 {yr} L{gx + pitch * 9 + cw / 2:g} {yr}'
        o += _comet(path, colour, tl.idle + 1.6 * i)
    o.append('</g>')

    # time axis
    o.append(f'<line class="pg-unroll" x1="320" y1="252" x2="894" y2="252" stroke="#35323F" stroke-width="1" style="{d(tl.rows + 0.2)}"></line>')
    o.append('<g stroke="#35323F" stroke-width="1">')
    for k in range(10):
        x = 346 + 58 * k
        o.append(f'  <line class="pg-fade" x1="{x}" y1="252" x2="{x}" y2="256" style="{d(col_t(k))}"></line>')
    o.append('</g>')
    o.append(f'<g font-family="{MONO}" font-size="8" letter-spacing="0.6" fill="#8B8798" text-anchor="middle">')
    for k, wk in enumerate(WEEKS):
        o.append(f'  <text class="pg-fade" x="{346 + 58 * k}" y="266" style="{d(col_t(k))}">{wk}</text>')
    o.append('</g>')
    o.append(f'<text class="pg-fade" x="320" y="284" font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#8B8798" style="{d(tl.axis_note)}">WEEKS SINCE FIRST ASSESSMENT</text>')
    o.append(f'<line x1="320" y1="302" x2="876" y2="302" stroke="{ORANGE}" stroke-width="1.2" stroke-dasharray="4 6" opacity="0.8" mask="url(#{p}-arrow)"></line>')
    o.append(f'<path class="pg-fade" d="M884 302 l-9 -4 M884 302 l-9 4" stroke="{ORANGE}" stroke-width="1.2" fill="none" opacity="0.8" style="{d(tl.arrow + 0.7)}"></path>')
    o.append(f'<text class="pg-fade" x="1100" y="322" font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#8B8798" text-anchor="end" style="{d(tl.arrow + 0.8)}">SCHEMATIC</text>')
    o.append('</svg>')
    return '\n'.join(o)


def phone(aria):
    """The same record re-laid for narrow screens: sources on a spine above the grid."""
    p = 'pgp'
    W, gx, pitch, cw = 340, 20, 19, 16
    gy, rp, ch = 252, 24, 20
    gw = pitch * 9 + cw  # 187
    gb = gy + rp * 5 + ch  # 392
    gh = gb - gy
    band_w = 40
    tl = Timeline(sweep=1.8)
    col_t = lambda c: tl.column(c, 10, gw, band_w, pitch, cw)
    sy = [84 + 32 * i for i in range(5)]
    row_cy = [gy + rp * r + ch // 2 for r in range(6)]

    o = [f'<svg class="graph-v pg" data-reveal="0.35" width="{W}" height="472" viewBox="0 0 {W} 472" role="img" aria-label="{aria}">']
    o += _defs(p, gx, gy, gw, gh, band_w)
    o.append(_mask(p, 'spine', f'M4 {sy[0] - 3.5} L4 {gb - 10}', 5, tl.curve, ' pg-draw--slow'))
    for r in range(6):
        o.append(_mask(p, f't{r}', f'M8 {row_cy[r]} L18 {row_cy[r]}', 5, tl.tick + 0.05 * r, ' pg-draw--fast'))
    o.append(_mask(p, 'arrow', f'M{gx} {gb + 54} L{gx + gw - 11} {gb + 54}', 5, tl.arrow, ' pg-draw--slow'))
    o.append('</defs>')

    o.append(f'<rect class="pg-fade" x="0" y="4" width="9" height="9" fill="{ORANGE}" fill-opacity="0.75" style="{d(tl.head)}"></rect>')
    o.append(f'<rect class="pg-fade" x="0" y="22" width="9" height="9" fill="{VIOLET}" fill-opacity="0.9" style="{d(tl.head + 0.06)}"></rect>')
    o.append(f'<g font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#A9A5B5">')
    o.append(f'  <text class="pg-fade" x="16" y="12" style="{d(tl.head)}">PSYCHOMETRIC INSTRUMENT</text>')
    o.append(f'  <text class="pg-fade" x="16" y="30" style="{d(tl.head + 0.06)}">BEHAVIOURAL &amp; SESSION SIGNAL</text>')
    o.append('</g>')
    o.append(f'<text class="pg-fade" x="0" y="60" font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#8B8798" style="{d(tl.head + 0.1)}">SOURCES</text>')
    o.append(f'<text class="pg-fade" x="312" y="{gy - 10}" font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#8B8798" text-anchor="middle" style="{d(tl.labels)}">VS NORM</text>')
    o.append(f'<line x1="4" y1="{sy[0] - 3.5}" x2="4" y2="{gb - 10}" stroke="{ORANGE}" stroke-width="1.1" stroke-dasharray="3 5" opacity="0.8" mask="url(#{p}-spine)"></line>')
    o.append(f'<g class="pg-srcs" font-family="{MONO}" letter-spacing="0.7">')
    for i, (title, sub, colour) in enumerate(SOURCES):
        o.append('  <g class="pg-src">')
        o.append(f'    <text class="pg-slide" x="16" y="{sy[i]}" font-size="9.5" fill="#ECEAF2" style="{d(tl.src + 0.08 * i)}">{title}</text>')
        o.append(f'    <text class="pg-slide" x="16" y="{sy[i] + 12}" font-size="8" fill="#8B8798" style="{d(tl.src + 0.08 * i + 0.04)}">{sub}</text>')
        o.append(f'    <circle class="pg-pop" cx="4" cy="{sy[i] - 3.5}" r="3" fill="{colour}" style="{d(tl.dot + 0.08 * i)}"></circle>')
        o.append('  </g>')
    o.append('</g>')
    o.append(f'<circle class="pg-ripple" cx="4" cy="{gy - 16}" r="4" fill="none" stroke="{ORANGE}" stroke-width="1" style="{d(tl.idle - 0.6)}"></circle>')
    o.append(f'<circle class="pg-pop" cx="4" cy="{gy - 16}" r="4" fill="{ORANGE}" style="{d(tl.ingest)}"></circle>')
    o.append('<g stroke="#3C3947" stroke-width="1" stroke-dasharray="3 5">')
    for r in range(6):
        o.append(f'  <line x1="8" y1="{row_cy[r]}" x2="18" y2="{row_cy[r]}" mask="url(#{p}-t{r})"></line>')
    o.append('</g>')

    cells = _desktop_cells()
    nx = lambda x: 284 + (x - 1004) * 56 / 96
    o.append('<g class="pg-rows">')
    for r in range(6):
        y = gy + rp * r
        cy = row_cy[r]
        o.append('  <g class="pg-row">')
        o.append(f'    <rect x="{gx}" y="{y - 2}" width="{W - gx}" height="{rp}" fill="transparent"></rect>')
        o.append(f'    <rect class="pg-unroll" x="{gx}" y="{y}" width="{gw}" height="{ch}" fill="#1E1C26" style="{d(tl.rows + 0.05 * r)}"></rect>')
        for (c, colour, op) in cells[r]:
            o.append(f'    <rect class="pg-cell" x="{gx + pitch * c}" y="{y}" width="{cw}" height="{ch}" fill="{colour}" fill-opacity="{op}" style="{d(col_t(c) + 0.035 * r)}"></rect>')
        if r in COMET_ROW:
            i = COMET_ROW.index(r)
            o.append(f'    <rect class="pg-arrive" x="{gx + pitch * 9}" y="{y}" width="{cw}" height="{ch}" fill="#FFFFFF" fill-opacity="0.2" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1" style="{d(tl.idle + 1.6 * i)}"></rect>')
        o.append(f'    <text class="pg-fade pg-dim" x="{gx + gw + 7}" y="{y + 13}" font-family="{MONO}" font-size="9" letter-spacing="0.9" fill="#A9A5B5" style="{d(tl.labels + 0.05 * r)}">{DIMS[r]}</text>')
        o.append(f'    <line class="pg-normline" x1="284" y1="{cy}" x2="340" y2="{cy}" stroke="#35323F" stroke-width="1" style="{d(tl.norm_lines + 0.05 * r)}"></line>')
        o.append(f'    <line class="pg-fade" x1="312" y1="{cy - 5}" x2="312" y2="{cy + 5}" stroke="#4B4858" stroke-width="1" style="{d(tl.norm_lines + 0.05 * r)}"></line>')
        x, colour = NORM[r]
        glide = f'transform: translateX({nx(x) - 312:.1f}px); {d(tl.norm_dots + 0.07 * r)}'
        o.append(f'    <circle class="pg-norm" cx="312" cy="{cy}" r="3" fill="{colour}" style="{glide}"></circle>')
        if r == DESIRE:
            o.append(f'    <circle class="pg-ripple pg-ripple--slow" cx="{nx(x):.1f}" cy="{cy}" r="3" fill="none" stroke="{colour}" stroke-width="1" style="{d(tl.idle + 0.4)}"></circle>')
        o.append('  </g>')
    o.append('</g>')
    o.append('<g stroke="#292734" stroke-width="1">')
    for k in range(9):
        x = gx + cw + (pitch - cw) / 2 + k * pitch
        o.append(f'  <line class="pg-fade" x1="{x:g}" y1="{gy}" x2="{x:g}" y2="{gb}" style="{d(tl.rows + 0.35)}"></line>')
    o.append('</g>')

    o.append(f'<g clip-path="url(#{p}-grid)">')
    o.append(f'  <g class="pg-band" style="{d(tl.sweep)}">')
    o.append(f'    <rect x="{gx - band_w}" y="{gy - 6}" width="{band_w}" height="{gh + 12}" fill="url(#{p}-band)"></rect>')
    o.append(f'    <line x1="{gx}" y1="{gy - 6}" x2="{gx}" y2="{gb + 6}" stroke="{ORANGE}" stroke-width="1" stroke-opacity="0.7"></line>')
    o.append('  </g>')
    o.append('</g>')

    o.append('<g class="pg-comets">')
    for i, (_, _, colour) in enumerate(SOURCES):
        yr = row_cy[COMET_ROW[i]]
        path = f'M4 {sy[i] - 3.5} L4 {yr} L18 {yr} L{gx + pitch * 9 + cw / 2:g} {yr}'
        o += _comet(path, colour, tl.idle + 1.6 * i)
    o.append('</g>')

    ay = gb + 6
    o.append(f'<line class="pg-unroll" x1="{gx}" y1="{ay}" x2="{gx + gw}" y2="{ay}" stroke="#35323F" stroke-width="1" style="{d(tl.rows + 0.2)}"></line>')
    o.append('<g stroke="#35323F" stroke-width="1">')
    for k in range(10):
        x = gx + cw / 2 + k * pitch
        o.append(f'  <line class="pg-fade" x1="{x:g}" y1="{ay}" x2="{x:g}" y2="{ay + 4}" style="{d(col_t(k))}"></line>')
    o.append('</g>')
    o.append(f'<g font-family="{MONO}" font-size="8" letter-spacing="0.6" fill="#8B8798" text-anchor="middle">')
    for k, wk in enumerate(WEEKS):
        o.append(f'  <text class="pg-fade" x="{gx + cw / 2 + k * pitch:g}" y="{ay + 14}" style="{d(col_t(k))}">{wk}</text>')
    o.append('</g>')
    o.append(f'<text class="pg-fade" x="{gx}" y="{ay + 32}" font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#8B8798" style="{d(tl.axis_note)}">WEEKS SINCE FIRST ASSESSMENT</text>')
    o.append(f'<line x1="{gx}" y1="{ay + 48}" x2="{gx + gw - 11}" y2="{ay + 48}" stroke="{ORANGE}" stroke-width="1.2" stroke-dasharray="4 6" opacity="0.8" mask="url(#{p}-arrow)"></line>')
    o.append(f'<path class="pg-fade" d="M{gx + gw - 3} {ay + 48} l-9 -4 M{gx + gw - 3} {ay + 48} l-9 4" stroke="{ORANGE}" stroke-width="1.2" fill="none" opacity="0.8" style="{d(tl.arrow + 0.7)}"></path>')
    o.append(f'<text class="pg-fade" x="{W}" y="{ay + 66}" font-family="{MONO}" font-size="8.5" letter-spacing="1.1" fill="#8B8798" text-anchor="end" style="{d(tl.arrow + 0.8)}">SCHEMATIC</text>')
    o.append('</svg>')
    return '\n'.join(o)


# The canvas's 44 filled cells: (column, colour, fill-opacity) per row, from its own markup.
_CANVAS_CELLS = None


def use_canvas_cells(cells):
    """cells: iterable of (colour, column, row, fill_opacity) parsed from the canvas SVG."""
    global _CANVAS_CELLS
    rows = [[] for _ in range(6)]
    for colour, c, r, op in cells:
        rows[r].append((c, colour, op))
    _CANVAS_CELLS = rows


def _desktop_cells():
    assert _CANVAS_CELLS is not None, 'call use_canvas_cells() first'
    return _CANVAS_CELLS


def main():
    import pathlib
    import re

    root = pathlib.Path(__file__).resolve().parent.parent
    canvas = (root / 'design/Main.dc.html').read_text()
    svg = re.findall(r'<svg\b.*?</svg>', re.search(r'</helmet>(.*?)</x-dc>', canvas, re.S).group(1), re.S)[3]
    aria = re.search(r'aria-label="([^"]*)"', svg).group(1)
    use_canvas_cells(
        (fill, (int(x) - 320) // 58, (int(y) - 30) // 36, op)
        for fill, body in re.findall(r'<g fill="(#E0785A|#9B7ED8)">\s*(<rect class="cell".*?)</g>', svg, re.S)
        for x, y, op in re.findall(r'<rect class="cell" x="(\d+)" y="(\d+)" width="52" height="30" fill-opacity="([\d.]+)"', body)
    )
    assert sum(len(r) for r in _CANVAS_CELLS) == svg.count('class="cell"') == 44
    pad = lambda block: '\n'.join('  ' + line if line.strip() else line for line in block.split('\n'))
    page = root / 'public/index.html'
    html = page.read_text()
    start = '<!-- psychograph: generated by tools/psychograph.py, edit that file rather than this markup -->\n'
    end = '  <!-- /psychograph -->'
    a, b = html.index(start) + len(start), html.index(end)
    page.write_text(html[:a] + pad(desktop(aria)) + '\n' + pad(phone(aria)) + '\n' + html[b:])
    print('rewrote the psychograph in', page)


if __name__ == '__main__':
    main()
