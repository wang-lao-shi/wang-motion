import { base, P, EASINGS, easeOf } from '../_common.js';
import { cells, shape } from './_grid.js';
// Grid where each card in turn zooms up to fill the frame (others dimmed behind it), then settles back.
export default {
  id: 'spotlight-zoom', name: 'Spotlight Zoom', category: 'grid', slots: 4,
  desc: 'Each grid card in turn zooms to full frame, then returns to the grid',
  tags: ['grid', 'zoom', 'spotlight', 'focus', 'step'], ref: 'animos',
  params: base({
    gap: P.pct('Gap', 3, 0, 20),
    dim: P.pct('Background dim', 45),
    ease: P.choice('Easing', 'custom', EASINGS),
    shadow: P.bool('Shadow', true),
    cells: P.num('Cells', 4, 1, 16),
  }),
  shadow: true, shadowOpacity: 0.45, sheen: 0,
  duration: 12,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const I = ctx.inner;
    const k = Math.max(1, Math.round(p.cells));
    const [cols, rows] = shape(ctx, k);
    const list = cells(ctx, cols, rows, p.gap).slice(0, k);
    const ease = easeOf(p.ease);
    // per card: zoom amount z(t) peaks at u = i/k
    const zOf = (i) => {
      const d = M.mod(u - (i + 0.5) / k + 0.5, 1) - 0.5;       // distance (loop units) from this card's spotlight
      const seg = 1 / k;                               // spotlight spacing
      const x = Math.abs(d) / seg;                     // 0 at peak, 0.5 at grid moment
      return ease(M.clamp((0.42 - x) / 0.27));          // hold full |x|<.15, hold grid |x|>.42
    };
    const zs = list.map((c) => zOf(c.i));
    const zmax = Math.max(...zs);
    return list.map((c, idx) => {
      const z = zs[idx];
      // zoomed card sits slightly inside the padded frame (animos: ~0.8% of frame width per side)
      const ins = 0.008 * ctx.view.w * 2;
      const W = I.w - ins, H = I.h - ins;
      // corner radius (core: r = param × min side × 3.2 × radiusMul): measured on the 932px reference at Corner radius 3%
      // grid cards ≈24px, zoomed card ≈30px -> radiusMul eases 0.76 (grid) -> 0.42 (full zoom)
      // grid behind shrinks by the same inset so its outer edges never peek around the zoomed card
      const g = 1 - (ins / Math.min(I.w, I.h)) * zmax * 1.5;
      const cx = c.x * g, cy = c.y * g, cw = c.w * g, ch = c.h * g;
      return { media: M.mod(c.i, n), x: cx * (1 - z), y: cy * (1 - z), z: z * 0.02, w: cw + (W - cw) * z, h: ch + (H - ch) * z,
        radiusMul: 0.76 - 0.34 * z, layer: z, bright: 1 - (p.dim / 100) * Math.max(0, zmax - z) };
    });
  },
};
