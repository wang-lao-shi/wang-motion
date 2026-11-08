import { base, P, cardAR } from '../_common.js';
// Endless marquee of a mosaic: big cards alternate with 2-row blocks of small cards, scrolling sideways.
// Pattern cells: [col, row, span] in small-card units on a 2-row band (span 2 = big card).
const LAYOUTS = {
  layout1: [[0, 0, 2], [2, 0, 1], [2, 1, 1], [3, 0, 2], [5, 0, 1], [6, 0, 1], [6, 1, 1], [7, 1, 1], [8, 0, 2], [10, 0, 1]],
  layout2: [[0, 0, 2], [2, 0, 1], [3, 1, 1], [4, 0, 2], [6, 1, 1], [7, 0, 1], [7, 1, 1], [8, 0, 2], [10, 1, 1], [11, 0, 1]],
  layout3: [[0, 0, 1], [0, 1, 1], [1, 0, 2], [3, 0, 1], [3, 1, 1], [4, 0, 1], [5, 0, 2], [7, 1, 1], [8, 0, 1], [8, 1, 1]],
};
const WIDTH = { layout1: 11, layout2: 12, layout3: 9 };
export default {
  id: 'mosaic-marquee', name: 'Mosaic Marquee', category: 'carousel-flow', slots: 10,
  desc: 'Sideways marquee of a mosaic band: big cards and 2-row blocks of small cards',
  tags: ['marquee', 'mosaic', 'ticker', 'loop', 'gallery'], ref: 'animos',
  params: base({
    cardHeight: P.pct('Card height', 55, 10, 100),
    gap: P.pct('Gap', 3, 0, 20),
    cardRatio: P.cardRatio(),
    layout: P.choice('Layout', 'layout1', ['layout1', 'layout2', 'layout3']),
    direction: P.choice('Direction', 'left', ['left', 'right']),
    shadow: P.bool('Shadow', true),
    loops: P.num('Pattern passes per loop', 1, 1, 4),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.06,
  duration: 12,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const V = ctx.view;
    const cells = LAYOUTS[p.layout] || LAYOUTS.layout1;
    const cw = WIDTH[p.layout] || 11;
    const gap = p.gap / 100;
    const ar = cardAR(ctx, 1.03);
    const H = (p.cardHeight / 100) * Math.min(1, V.w / 0.75);   // big card height
    const sh = (H - gap) / 2;                                    // small card height
    const unitW = (H * ar - gap) / 2;                            // small card width (two small cols = one big)
    const ux = unitW + gap;
    const W = cw * ux;                                           // pattern period
    const dir = p.direction === 'right' ? -1 : 1;
    const shift = -dir * u * W * Math.max(1, Math.round(p.loops));
    const x0 = -V.w / 2 + 0.05 - 0.002;                          // pattern origin at u=0
    const out = [];
    const reps = Math.ceil(V.w / W) + 2;
    for (let r = -1; r <= reps; r++) {
      cells.forEach(([c, row, span], i) => {
        const w = span === 2 ? H * ar : unitW, h = span === 2 ? H : sh;
        const left = x0 + shift + r * W + c * ux;
        const x = left + w / 2;
        if (x + w / 2 < -V.w / 2 - 0.05 || x - w / 2 > V.w / 2 + 0.05) return;
        const y = span === 2 ? 0 : (row === 0 ? (sh + gap) / 2 : -(sh + gap) / 2);
        out.push({ media: M.mod(i, n), x, y, w, h });
      });
    }
    return out;
  },
};
