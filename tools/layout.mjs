// Layout problems a person would call a bug, measured in the page: horizontal scrolling, content
// escaping the screen, text wider than its box, overlapping text, and tap targets under 24px.
export async function layoutIssues(page) {
  return page.evaluate(() => {
    const out = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw) out.push(`page is ${document.documentElement.scrollWidth}px wide on a ${vw}px screen`);
    const shown = (el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length;
    const clipped = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true;
      return false;
    };
    const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).trim().replace(/\s+/g, '.')}`;
    for (const el of document.querySelectorAll('body *')) {
      if (!shown(el) || (el.closest('svg') && el.tagName !== 'svg')) continue;
      const b = el.getBoundingClientRect();
      if ((b.right > vw + 0.5 || b.left < -0.5) && !clipped(el)) out.push(`${label(el)} escapes the screen`);
      const inline = ['svg', 'a', 'span', 'b', 'i', 'em'].includes(el.tagName.toLowerCase());
      if (!inline && getComputedStyle(el).overflowX === 'visible' && el.clientWidth && el.scrollWidth > el.clientWidth + 1)
        out.push(`${label(el)} content is wider than its box`);
    }
    // WCAG 2.5.8: a target under 24x24px passes only if a 24px circle on its centre touches no other
    // target (and no other small target's circle). Links inside a sentence are exempt.
    const targets = [...document.querySelectorAll('a[href], button')]
      .filter((a) => shown(a) && !a.closest('p, address, span.m:not(.chip)'))
      .map((a) => ({ a, b: a.getBoundingClientRect() }));
    const small = (t) => t.b.width < 24 || t.b.height < 24;
    const centre = (t) => [t.b.left + t.b.width / 2, t.b.top + t.b.height / 2];
    const gap = ([x, y], b) => Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
    for (const t of targets.filter(small)) {
      const c = centre(t);
      const crowded = targets.some((o) => o !== t && (gap(c, o.b) < 12 || (small(o) && Math.hypot(c[0] - centre(o)[0], c[1] - centre(o)[1]) < 24)));
      if (crowded) out.push(`tap target "${t.a.textContent.trim().slice(0, 20)}" is ${t.b.width.toFixed(0)}x${t.b.height.toFixed(0)}px and crowded`);
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
}

// Scroll through the page so every scroll-triggered block has been revealed once.
export async function revealAll(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.6)) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    scrollTo(0, 0);
  });
}
