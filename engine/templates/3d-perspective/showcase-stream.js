import { base, P, rotX, rotZ, backFade, cardAR } from '../_common.js';
// Tilted ring of curved cards spinning one full turn per loop; far cards seen from behind (mirrored) and faded.
export default {
  id: 'showcase-stream', name: 'Showcase Stream', category: '3d-perspective', slots: 12,
  desc: 'Tilted ring of curved cards spinning one turn per loop',
  tags: ['ring', 'carousel', '3d', 'hero'], ref: 'animos',
  params: base({
    ringTilt: P.deg('Ring tilt (roll)', -28, -90, 90),
    ringOpening: P.pct('Ring opening (view from above)', 55),
    ringSize: P.pct('Ring size', 80, 20, 150),
    cardSize: P.pct('Card size', 21, 5, 60),
    backFade: P.pct('Back fade', 70),
    perspective: P.perspective(18),
    cardRatio: P.cardRatio(),
    speed: P.speed(1),
  }),
  sheen: 0.22, rim: 0.9, shadow: false,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const R = (p.ringSize / 100) * Math.min(ctx.inner.w, ctx.inner.h * 1.25) * 0.57;
    const pitch = M.rad(p.ringOpening * 0.6);
    const roll = M.rad(p.ringTilt * 0.55);
    const arc = (M.TAU * R) / n;
    const out = [];
    for (let i = 0; i < n; i++) {
      const th = (M.TAU * (3 - i)) / n - M.TAU * u * p.speed;
      const w = arc * 0.93; const h0 = (p.cardSize / 100) * 0.95; const h = w / cardAR(ctx, w / h0);
      let pos = rotZ(rotX([R * Math.sin(th), 0, R * Math.cos(th)], pitch), roll);
      const nz = rotX([Math.sin(th), 0, Math.cos(th)], pitch)[2];
      out.push({ media: i, x: pos[0], y: pos[1] + 0.06, z: pos[2], rz: roll, rx: pitch, ry: th, order: 'ZXY', w, h, bend: 1 / R, bright: backFade(nz, p.backFade / 100) });
    }
    return out;
  },
};
