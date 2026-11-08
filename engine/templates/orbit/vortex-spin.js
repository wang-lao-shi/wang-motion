import { P, cardAR, backFade } from '../_common.js';
// Concentric rings of radial cards receding into a tunnel; each ring spins (alternate rings counter-rotate), cards curved to the ring.
export default {
  id: 'vortex-spin', name: 'Vortex Spin', category: 'orbit', slots: 8,
  desc: 'Concentric spinning rings of curved radial cards sinking into a tunnel',
  tags: ['orbit', 'rings', 'tunnel', 'vortex', 'hypnotic', '3d'], ref: 'animos',
  params: {
    padding: P.padding(6),
    cornerRadius: P.cornerRadius(1),
    rings: P.num('Rings', 3, 1, 6),
    ringSize: P.pct('Ring size', 34, 10, 60),
    cardSize: P.pct('Card size', 15, 4, 40),
    depth: P.pct('Depth', 50),
    backFade: P.pct('Back fade', 35),
    cardRatio: P.cardRatio(),
    cardStyle: P.choice('Card style', 'curved', ['curved', 'flat']),
    direction: P.choice('Direction', 'clockwise', ['clockwise', 'counterClockwise', 'alternate']),
    cardsPerRing: P.num('Cards per ring', 8, 3, 24),
    speed: P.speed(1),
  },
  shadow: false, rim: 0.8, edgeTop: 0.9, edgeW: 0.0025, sheen: 0.1,
  duration: 20,
  camera() { return { perspective: 22 }; },        // fov ~41deg
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const d = ctx.camDist ?? (0.5 / Math.tan(M.rad(6 + 22 * 1.6) / 2));
    const sc = Math.pow(Math.min(1, ctx.aspect), 0.75);   // portrait: shrink less than the width ratio
    const Rw = (p.ringSize / 100) * 0.98 * sc;
    const D = (p.depth / 100) * 0.3 * d;
    const w = (p.cardSize / 100) * 1.0 * sc, h = w / cardAR(ctx, 1.2);
    const K = Math.max(3, Math.round(p.cardsPerRing));
    const tilt = M.rad(40);
    const OFF = [-6, -0.5, -3, -1.5, -4.5, -2];
    const out = [];
    const NR = Math.max(1, Math.round(p.rings));
    for (let r = 0; r < NR; r++) {
      // as observed in the reference, the middle ring counter-rotates under the default ('clockwise'); 'alternate' flips every other ring
      let sgn;
      if (p.direction === 'clockwise') sgn = r % 2 ? -1 : 1;
      else if (p.direction === 'counterClockwise') sgn = r % 2 ? 1 : -1;
      if (p.direction === 'alternate') sgn = (r % 2 ? -1 : 1) * (r % 4 >= 2 ? -1 : 1);
      const z = -r * D;
      const pz = d / (d - z);                       // perspective shrink of this ring
      const rs = Rw * (r === 0 ? 1 : 0.73 * Math.pow(0.79, r - 1));   // on-screen ring radii 1, .73, .58 (animos)
      const rr = rs / pz;
        // animos: every ring holds the same card count, cards scaled with the ring radius (gaps stay proportional)
      const Kr = K;
      const ws = (rs / Rw) / pz;
      for (let i = 0; i < Kr; i++) {
        const th = M.TAU * ((i + OFF[r % 6] * Kr / K) / Kr + sgn * u * p.speed);
        out.push({
          media: i % n, x: rr * Math.sin(th), y: rr * Math.cos(th), z,
          rz: -th, rx: tilt, order: 'ZXY', w: w * ws, h: h * ws,
          bend: p.cardStyle === 'curved' ? 1 / rr : 0,
          bright: 1 - (p.backFade / 100) * Math.min(1, r / 2) * 0.8,
        });
      }
    }
    return out;
  },
};
