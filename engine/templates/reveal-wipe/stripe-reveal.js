import { base, P, easeOf, EASINGS, CARD_RATIO_OPTS } from '../_common.js';
import { E } from '../../lib.js';
import { frameCard, frameRadiusMul } from './_frame.js';
// K steps per loop; in each step the next image arrives as vertical strips sliding in, odd strips from the top, even from the bottom, staggered left to right.
export default {
  id: 'stripe-reveal', name: 'Stripe Reveal', category: 'reveal-wipe', slots: 3,
  desc: 'next image slides in as vertical strips, alternating from top and bottom, staggered left to right',
  tags: ['reveal', 'wipe', 'slideshow', 'transition', 'stripes', 'blinds'], ref: 'animos',
  params: base({
    strips: P.num('Strips', 7, 2, 20),
    ease: P.choice('Easing', 'custom', EASINGS),
    period: P.num('Cards per loop', 3, 2, 24),
    stagger: P.pct('Stagger', 86),
    cardRatio: P.choice('Card ratio', 'frame', ['frame', ...CARD_RATIO_OPTS]),
  }),
  shadow: true, shadowOpacity: 0.3, sheen: 0, rim: 0,
  duration: 8,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const K = Math.max(2, Math.round(p.period)), S = Math.max(2, Math.round(p.strips));
    const ez = p.ease === 'custom' ? E.outQuart : easeOf(p.ease); // per-strip ease (ref: strips land fast, settle softly)
    const { w, h } = frameCard(ctx);
    const md = (j) => M.mod(M.mod(j, K), n);
    const s = u * K, j = Math.floor(s) % K, f = s - Math.floor(s);
    const A = 0.06, B = 0.48;                      // transition window inside each step (fitted to ref f1/f3)
    const tw = M.clamp((f - A) / (B - A));
    // step j reveals image j over image j-1 (ref f0 shows the last image, f1 is mid-reveal of image 1)
    const out = [{ media: md(j - 1), x: 0, y: 0, z: 0, w, h, layer: 0 }];
    if (tw >= 1 || tw <= 0) { if (tw >= 1) out[0].media = md(j); out[0].radiusMul = frameRadiusMul(ctx, w, h); return out; }
    // Every strip is the whole image card (same cover-fit, rounded frame corners) clipped by a rect mask to its column.
    // Strips that have landed merge into ONE card so no internal edge is left between them (an edge between two
    // identical-content cards still shows a 1px mip seam in the engine), only the strips still moving are separate.
    const st = M.clamp(p.stagger / 100, 0, 0.95), d = 1 - st; // each strip moves for d of the window
    const ks = [];
    for (let i = 0; i < S; i++) ks.push(ez(M.clamp((tw - (st * i) / (S - 1)) / d)));
    let m = 0; while (m < S && ks[m] >= 1) m++;
    const ov = 0.003 / w;                         // prefix tucks under the next (moving) strip
    if (m > 0) out.push({ media: md(j), x: 0, y: 0, z: 0, w, h, layer: 1, shadow: 0,
      ...(m < S ? { mask: { type: 'rect', rect: [-0.01, -0.01, m / S + ov, 1.01], soft: 0.0005 } } : {}) });
    for (let i = m; i < S; i++) {
      const k = ks[i];
      if (k <= 0) continue;
      const dirY = i % 2 === 0 ? 1 : -1;          // 1st, 3rd, .. strips come from the top
      const y = dirY * h * (1 - k);
      const vy0 = M.clamp((-h / 2 - (y - h / 2)) / h), vy1 = M.clamp((h / 2 - (y - h / 2)) / h); // clip to the frame
      out.push({ media: md(j), x: 0, y, z: 0, w, h, layer: 2 + i, shadow: 0,
        mask: { type: 'rect', rect: [i === 0 ? -0.01 : i / S, vy0, i === S - 1 ? 1.01 : (i + 1) / S, vy1], soft: 0.0005 } });
    }
    const rm = frameRadiusMul(ctx, w, h); out.forEach((c) => (c.radiusMul = rm));
    return out;
  },
};
