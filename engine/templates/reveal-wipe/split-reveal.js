import { base, P, easeOf, EASINGS, CARD_RATIO_OPTS } from '../_common.js';
import { frameCard } from './_frame.js';
// The frame is split into a left and a right panel (Split ratio, Gap), each showing its own image.
// K pairs per loop: in each step the next pair slides in — the left panel's new image pushes in from the left edge,
// the right panel's from the right edge a beat later — covering the (static) previous images.
export default {
  id: 'split-reveal', name: 'Split Reveal', category: 'reveal-wipe', slots: 4,
  desc: 'two side-by-side panels; each step new images slide in from the outer edges (right panel a beat later) over the old pair',
  tags: ['reveal', 'wipe', 'split', 'diptych', 'slideshow', 'transition'], ref: 'animos',
  params: base({
    splitRatio: P.pct('Split ratio', 50, 10, 90),
    gap: P.num('Gap', 2, 0, 15, '%', 0.25),
    ease: P.choice('Easing', 'custom', EASINGS),
    period: P.num('Pairs per loop', 2, 1, 12),
    slide: P.num('Slide time', 30, 5, 60, '%'),
    lag: P.num('Right panel delay', 4, 0, 30, '%'),
    cardRatio: P.choice('Card ratio', 'frame', ['frame', ...CARD_RATIO_OPTS]),
  }),
  shadow: true, shadowOpacity: 0.3, sheen: 0, rim: 0,
  duration: 8,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const K = Math.max(1, Math.round(p.period));
    const ez = easeOf(p.ease);
    const { w: W, h: H } = frameCard(ctx);
    const gap = (p.gap / 100) * W;
    const wl = (W - gap) * (p.splitRatio / 100), wr = W - gap - wl;
    const xl = -W / 2 + wl / 2, xr = W / 2 - wr / 2;
    // media: pair j -> (2j, 2j+1), period-wrapped
    const md = (j) => M.mod(M.mod(j, 2 * K), n);
    const s = u * K, j = Math.floor(s) % K, f = s - Math.floor(s);
    // ref (u=.125 -> f=.25): left ≈ half in, right ≈ 15% in; done by f=.5
    const L = p.slide / 100, d = p.lag / 100, a = 0.25 - L / 2;
    const kl = ez(M.clamp((f - a) / L)), kr = ez(M.clamp((f - a - d) / L));
    const out = [];
    const panel = (x, w, mOld, mNew, k, fromLeft) => {
      out.push({ media: k >= 1 ? mNew : mOld, x, y: 0, z: 0, w, h: H, fullAspect: w / H, layer: 0 });
      if (k <= 0 || k >= 1) return;
      // full-size card at the panel position; content shifted by (1-k) via uv, clipped by a rect mask -> straight leading edge, panel corners stay rounded
      const uv = fromLeft ? [1 - k, 0, 2 - k, 1] : [k - 1, 0, k, 1];
      const rect = fromLeft ? [0, 0, k, 1] : [1 - k, 0, 1, 1];
      out.push({ media: mNew, x, y: 0, z: 0, w, h: H, uv, fullAspect: w / H, layer: 1, shadow: 0, mask: { type: 'rect', rect, soft: 0.001 } });
    };
    panel(xl, wl, md(2 * j - 2), md(2 * j), kl, true);
    panel(xr, wr, md(2 * j - 1), md(2 * j + 1), kr, false);
    return out;
  },
};
