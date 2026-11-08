import { base, P } from '../_common.js';
import { cells, shape } from './_grid.js';
// Grid whose cells pop out (shrink away) and pop back in with a springy overshoot, at staggered random times.
const OFF6 = [0.2, 0.355, 0.95, 0.14, 0.63, 0.29];   // pop-out start per cell (default 3x2), fitted to the animos frames
const backOut = (t, c1) => 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;   // stronger overshoot than E.outBack (peak ~1.13)
export default {
  id: 'pop-grid', name: 'Pop Grid', category: 'grid', slots: 6,
  desc: 'Grid cells pop out and spring back in at staggered times',
  tags: ['grid', 'pop', 'bounce', 'playful', 'loop'], ref: 'animos',
  params: base({
    gap: P.pct('Gap', 3, 0, 20),
    visibleShare: P.pct('Visible share', 62, 10, 100),
    cells: P.num('Cells', 6, 1, 24),
    shadow: P.bool('Shadow', true),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.06,
  duration: 8,
  layout(ctx) {
    const { p, n, u, M, E } = ctx;
    const k = Math.max(1, Math.round(p.cells));
    const [cols, rows] = shape(ctx, k);
    const list = cells(ctx, cols, rows, p.gap).slice(0, k);
    const hid = 1 - p.visibleShare / 100;            // share of the loop each cell spends away
    return list.map((c) => {
      const off = k === 6 ? OFF6[c.i] : M.fract(M.rand(c.i, 5) * 0.3 + (((c.i * 5) % k) / k));
      const t = M.mod(u - off, 1);                    // 0 = start of pop-out
      let s = 1, o = 1;
      // fitted to the reference: linear shrink to 0.1 over ~0.47*hid, then a springy regrow over ~0.58*hid
      // that stays faded until the overshoot peak (~1.13 at q~0.56)
      const tOut = hid * 0.47, tIn = hid * 0.58;
      if (t < tOut) { const q = t / tOut; s = 1 - 0.9 * q; o = 1 - 0.7 * q ** 3; }   // ref stays opaque while shrinking, fades only near the minimum
      else if (t < tOut + tIn) { const q = (t - tOut) / tIn; s = 0.1 + 0.9 * backOut(q, 2); o = 0.3 + 0.7 * M.smooth(0.3, 0.56, q); }
      return { media: M.mod(c.i, n), x: c.x, y: c.y, w: c.w * s, h: c.h * s, opacity: o, layer: s };
    });
  },
};
