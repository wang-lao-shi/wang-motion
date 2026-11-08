import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
import { play, unit, kf, ring } from './_scenes.js';
// Hero card -> flat "bloom" circle of 8 cards -> hero -> spinning 3D belt (ring) that rolls and flattens into a diagonal line.
export default {
  id: 'bloom-belt', name: 'Bloom Belt', category: 'multiscene', radiusMode: 'card', slots: 8,
  desc: 'Hero card blooms into a circle, zooms into another hero, then a spinning 3D belt of cards rolls across the frame',
  tags: ['multiscene', 'ring', 'belt', 'bloom', '3d', 'story'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 100, 30, 200),
    spread: P.pct('Spread', 100, 0, 200),
    focusSize: P.pct('Focus size', 100, 0, 200),
    ringSize: P.pct('Ring size', 100, 30, 200),
    flipDirection: P.choice('Flip direction', 'normal', ['normal', 'reverse']),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.12, rim: 0.35,
  duration: 16,
  layout(ctx) {
    const { p, n } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1), cs = p.cardSize / 100, sp = p.spread / 100, fs = p.focusSize / 100, rs = p.ringSize / 100;
    const K = Math.min(8, Math.max(3, n)); const dir = p.flipDirection === 'reverse' ? -1 : 1;
    const C = (i, o) => ({ media: i, h: o.w / ar, ...o });
    const heroW = 0.73 * cs * U;
    const hero = (j) => () => Array.from({ length: K }, (_, i) => i === j ? C(i, { x: 0, y: 0, z: 0.02, w: heroW })
      : C(i, { x: 0, y: 0, z: -0.3, w: heroW * 0.5, opacity: 0 }));
    const bloom = (_, f) => Array.from({ length: K }, (_, i) => {
      const a = -Math.PI / 2 + dir * (i / K) * Math.PI * 2 + f * 0.08;
      const r = 0.2 * rs * U * (0.95 + 0.05 * f);
      return C(i, { x: r * Math.cos(a), y: r * Math.sin(a) - 0.01, z: i === 0 ? 0.01 : -i * 0.002, w: 0.23 * cs * U });
    });
    const belt = (_, f) => {
      const m = kf(f, [[0, 0], [0.22, 1]], E.inOutCubic); // ring -> line
      const roll = kf(f, [[0, 0], [0.12, -0.25], [0.3, -0.48], [0.55, -0.85], [0.8, -0.12], [1, 0]]);
      const spin = dir * kf(f, [[0, 0], [0.3, 3], [0.55, 1], [0.82, 0], [1, 0]], E.inOutCubic);
      const rg = ring(K, -spin, 0.3 * rs * U, -0.8, 0);
      const gap = 0.19 * sp * U;
      return rg.map((q, i) => {
        const d = (((i - spin) / K + 0.5) % 1 + 1) % 1 * K - K / 2;
        const lx = -d * gap * Math.cos(roll), ly = -d * gap * Math.sin(roll), lz = -Math.abs(d) * 0.07;
        const foc = Math.max(0, 1 - Math.abs(d));
        const wl = (0.29 + 0.07 * foc * fs) * cs * U;
        const wr = (0.23 + 0.17 * Math.pow(Math.max(0, q.front), 8) * fs) * cs * U;
        return C(i, { x: -q.x * (1 - m) + lx * m, y: (q.y + 0.02) * (1 - m) + ly * m, z: q.z * 0.45 * (1 - m) + lz * m, w: wr + (wl - wr) * m, bright: 1 - 0.06 * Math.abs(d) * m });
      });
    };
    return play(ctx, [
      { hold: 0.03, move: 0.07, pose: hero(0), ease: E.inOutQuart },
      { hold: 0.2, move: 0.06, pose: bloom, ease: E.inOutQuart },
      { hold: 0.04, move: 0.07, pose: hero(Math.min(6, K - 1)), ease: E.inOutQuart },
      { hold: 0.48, move: 0.05, pose: belt, ease: E.inOutQuart },
    ]);
  },
};
