import { base, P, cardAR } from '../_common.js';
// Three (or more) columns of cards drifting vertically, neighbouring columns in opposite directions,
// clipped to the padded frame.
export default {
  id: 'column-drift', name: 'Column Drift', category: 'grid', slots: 12,
  desc: 'Columns of cards drifting up and down in alternation, clipped to the frame',
  tags: ['grid', 'columns', 'drift', 'marquee', 'loop', 'masonry'], ref: 'animos',
  params: base({
    gap: P.pct('Gap', 3, 0, 20),
    cardRatio: P.cardRatio(),
    columns: P.num('Columns', 3, 1, 8),
    perColumn: P.num('Cards per column', 4, 2, 12),
    shadow: P.bool('Shadow', false),
  }),
  shadow: false, sheen: 0.06,
  duration: 12,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const C = Math.max(1, Math.round(p.columns)), Q = Math.max(2, Math.round(p.perColumn));
    const g = p.gap / 100;
    const cw = (I.w - g * (C - 1)) / C;
    const ar = cardAR(ctx, 1.0);
    const ch = cw / ar, py = ch + g;
    const top = I.h / 2, bot = -I.h / 2;
    // explicit corner radius: engine frame-cap ×1.3 (≈27px at 932, matching animos), still follows Corner radius
    const rMul = 1.3 * Math.min(1, 0.8 * Math.min(ctx.view.w, 1) / (3.2 * Math.min(cw, ch)));
    const out = [];
    for (let c = 0; c < C; c++) {
      const dir = c % 2 ? 1 : -1;                     // first column drifts down
      const s = u * Q * dir;
      const x = -I.w / 2 + cw / 2 + c * (cw + g);
      const y0 = top - ch / 2;
      for (let j = Math.floor(s) - 1; j <= Math.floor(s) + Math.ceil(I.h / py) + 1; j++) {
        const y = y0 - (j - s) * py;
        const yt = y + ch / 2, yb = y - ch / 2;
        if (yb >= top || yt <= bot) continue;
        const v0 = Math.max(0, (bot - yb) / ch), v1 = Math.min(1, (top - yb) / ch);
        const card = { media: M.mod(c * Q + M.mod(j, Q), n), x, y, w: cw, h: ch, radiusMul: rMul };
        if (v0 > 0 || v1 < 1) card.mask = { type: 'rect', rect: [0, v0, 1, v1], soft: 0.001 };
        out.push(card);
      }
    }
    return out;
  },
};
