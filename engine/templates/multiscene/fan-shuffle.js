import { base, P, cardAR, easeOf, EASINGS } from '../_common.js';
import { E } from '../../lib.js';
import { play, unit } from './_scenes.js';
// One card fans out into a deck, the deck deals out into a brick wall of cards that slides and pulls back, then everything gathers into a reversed fan and back to one card.
export default {
  id: 'fan-shuffle', name: 'Fan Shuffle', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Card fans into a deck, deals into a sliding brick wall, then shuffles back into a fanned deck',
  tags: ['multiscene', 'deck', 'fan', 'wall', 'shuffle', 'story'], ref: 'animos',
  params: base({
    deckCards: P.num('Deck cards', 6, 2, 12),
    fanSpread: P.num('Fan spread', 7.8, 0, 30, '%', 0.1),
    fanAngle: P.deg('Fan angle', -47),
    columns: P.num('Columns', 3, 1, 8),
    cardGap: P.num('Card gap', 2.5, 0, 15, '%', 0.25),
    rowShift: P.pct('Row shift', 77, 0, 100),
    wallPullBack: P.pct('Wall pull-back', 80, 0, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.45, sheen: 0.12, rim: 0.3,
  duration: 16,
  layout(ctx) {
    const { p, n, inner, M } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1.65), ez = easeOf(p.ease);
    const D = Math.max(2, Math.round(p.deckCards));
    const C = (i, o) => ({ media: i % n, h: o.w / ar, ...o });
    // wall cells sorted from the centre
    const NCo = Math.max(1, Math.round(p.columns));
    const gap = p.cardGap / 100;
    const ww = (inner.w - gap * (NCo - 1)) / NCo * 1.17, arW = cardAR(ctx, 1.85), wh = ww / arW, pxw = ww + gap * 1.2, pyw = wh + gap * 1.25;
    const nx = Math.ceil(ctx.view.w / pxw / 2) + 2, ny = Math.ceil(0.5 / pyw) + 2;
    const cells = [];
    for (let r = -ny; r <= ny; r++) for (let c = -nx; c <= nx; c++) cells.push([c, r]);
    cells.sort((a, b) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])) || a[1] - b[1] || a[0] - b[0]);
    const NT = cells.length;
    const med = (c, r) => M.mod(c * 3 - r * 4, Math.max(n, 1));
    const wall = (_, f) => {
      const zoom = 1 + (p.wallPullBack / 80) * 0.18 * (1 - E.outCubic(Math.min(1, f * 3)));
      const dim = 0.45 + 0.55 * E.inOutSine(Math.min(1, f / 0.12));
      return cells.map(([c, r], i) => {
        const sh = (M.mod(r, 2) ? 1 : 0) * (p.rowShift / 100) * 0.5 * pxw;
        const slide = (M.mod(r, 2) ? 1 : -1) * f * 0.6 * pxw;
        const x = (c * pxw + sh + slide - 0.1 * U) * zoom, y = (-r * pyw + f * pyw * 1.3 + 0.04) * zoom;
        return { media: i === 0 ? 0 : med(c, r), x, y, z: 0, w: ww * zoom, h: ww * zoom / arW, bright: dim };
      });
    };
    const dw = 0.38 * U;
    const fan = (dirSign, fx, fy) => () => cells.map((_, i) => {
      const a = M.rad(p.fanAngle) * dirSign; const s = p.fanSpread / 100 * 0.5 * 1.8;
      const k = Math.min(i, D - 1);
      const ox = Math.cos(-a + (dirSign < 0 ? Math.PI : 0)) * s * k * (dirSign < 0 ? 0.6 : 1), oy = Math.sin(-a + (dirSign < 0 ? Math.PI : 0)) * s * k * (dirSign < 0 ? 0.6 : 1);
      return C(i, { x: fx + ox, y: fy + oy, z: -k * 0.01 - (i >= D ? 0.02 : 0), w: dw, opacity: i >= D ? 0 : 1 });
    });
    const single = () => cells.map((_, i) => C(i, { x: 0, y: 0, z: -i * 0.005, w: dw, opacity: i === 0 ? 1 : 0 }));
    return play(ctx, [
      { hold: 0.03, move: 0.07, pose: single, ease: ez },
      { hold: 0.07, move: 0.08, pose: fan(1, -0.06 * U, -0.13), ease: ez, stagger: 0.4, delay: (i) => Math.min(1, i / 40) },
      { hold: 0.55, move: 0.06, pose: wall, ease: ez, stagger: 0.35, delay: (i) => Math.min(1, i / 40) },
      { hold: 0.05, move: 0.09, pose: fan(-1, 0.08 * U, 0.1), ease: ez },
    ]);
  },
};
