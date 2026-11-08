import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
// Overlapping deck laid on a diagonal: the stack glides along the diagonal, the centre card always on top.
export default {
  id: 'diagonal-carousel', name: 'Diagonal Carousel', category: 'carousel-flow', slots: 6,
  desc: 'Overlapping cards on a diagonal gliding through the centre, centre card on top',
  tags: ['carousel', 'diagonal', 'deck', 'stack', 'flow'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 40, 10, 100),
    overlap: P.pct('Overlap', 55, 0, 95),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'downRight', ['downRight', 'downLeft', 'upRight', 'upLeft']),
    movement: P.choice('Movement', 'continuous', ['continuous', 'stepped']),
    cardRatio: P.cardRatio(),
    shadow: P.bool('Shadow', true),
    loopCards: P.num('Cards per loop', 6, 2, 24),
  }),
  shadow: true, shadowOpacity: 0.5, sheen: 0.06,
  duration: 12,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const ar = cardAR(ctx, 1.0);
    let w = (p.cardSize / 100) * Math.min(I.w, I.h), h = w / ar;
    const step = (1 - p.overlap / 100);
    const dx = w * step, dy = h * step;
    const sx = { downRight: 1, downLeft: -1, upRight: 1, upLeft: -1 }[p.direction] ?? 1;
    const sy = { downRight: -1, downLeft: -1, upRight: 1, upLeft: 1 }[p.direction] ?? -1;
    const x = u * K; const k0 = Math.floor(x);
    const s = p.movement === 'stepped' ? k0 + easeOf(p.ease)(Math.min(1, (x - k0) / 0.5)) : x;
    const span = Math.ceil(Math.max(ctx.view.w / dx, 1 / dy) / 2) + 2;
    const out = [];
    for (let j = Math.floor(s) - span; j <= Math.floor(s) + span; j++) {
      const k = j - s;
      out.push({ media: M.mod(M.mod(j, K), n), x: sx * k * dx, y: sy * k * dy, z: 0, w, h, layer: -Math.abs(k) });
    }
    return out;
  },
};
