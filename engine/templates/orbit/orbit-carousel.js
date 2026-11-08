import { base, P, CARD_RATIO_OPTS } from '../_common.js';
// Four big camera-facing cards on a shallow horizontal ring: one hero in front, neighbours peeking from the frame edges.
export default {
  id: 'orbit-carousel', name: 'Orbit Carousel', category: 'orbit', slots: 4,
  desc: 'Big hero card orbiting with its neighbours half out of frame, continuous carousel',
  tags: ['orbit', 'carousel', 'hero', 'slider'], ref: 'animos',
  params: base({
    spread: P.pct('Spread', 70, 10, 150),
    depthFade: P.pct('Depth fade', 60),
    cardRatio: P.choice('Card ratio', 'frame', ['frame', ...CARD_RATIO_OPTS]),
    cardSize: P.pct('Card size', 45, 10, 90),
    direction: P.choice('Direction', 'right', ['right', 'left']),
    ringCards: P.num('Cards on ring', 4, 3, 12),
    speed: P.speed(1),
  }),
  shadow: true, shadowOpacity: 0.4, rim: 0.9, edgeTop: 0.75, edgeW: 0.003,
  duration: 12,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const K = Math.max(3, Math.round(p.ringCards));
    const dir = p.direction === 'left' ? -1 : 1;
    const f = dir * u * K * p.speed;
        const cr = p.cardRatio;
    const ar = cr === 'frame' ? ctx.aspect : (cr === 'auto' ? ctx.ratioOf(0) : ctx.ratioOf(0));
    const base0 = (p.cardSize / 100);
    // hero card: frame-shaped by default; any other ratio fits the same box (base0*aspect x base0)
    let H = base0, W = H * ar;
    if (W > base0 * ctx.aspect) { W = base0 * ctx.aspect; H = W / ar; }
    const R = (p.spread / 100) * 0.98 * W;
    const out = [];
    for (let k = 0; k < K; k++) {
      // positions follow a 4-slot ellipse regardless of K (front / sides / back)
      const a = M.wrap((k + f) / K) * M.TAU;           // -pi..pi
      const a4 = a * K / 4;                            // map onto 4-slot circle
      const x = R * Math.sin(Math.max(-Math.PI, Math.min(Math.PI, a4)));
      const cz = Math.cos(Math.max(-Math.PI, Math.min(Math.PI, a4)));
      const sz = 0.82 + 0.18 * cz;
      const bright = 1 - (p.depthFade / 100) * 0.55 * (1 - cz);
      const op = M.smooth(-0.85, -0.3, cz);
      out.push({ media: (k % K) % n, x, y: -0.003, z: 0.06 * cz, w: W * sz, h: H * sz, bright, opacity: op });
    }
    return out;
  },
};
