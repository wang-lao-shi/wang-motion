import { base, P, cardAR, easeOf, EASINGS } from '../_common.js';
import { E } from '../../lib.js';
import { play, unit, kf } from './_scenes.js';
// Brick collage of cards -> zoom into the centre card -> a reel of hero cards swinging up from below one after another -> back into the collage.
export default {
  id: 'collage-reel', name: 'Collage Reel', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Overlapping brick collage dives into a reel of hero cards that swing in from below, then settles back into the collage',
  tags: ['multiscene', 'collage', 'reel', 'hero', 'slideshow', 'story'], ref: 'animos',
  params: base({
    padding: P.padding(2),
    heroSize: P.pct('Hero size', 52, 20, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.45, sheen: 0.12, rim: 0.3,
  duration: 18,
  layout(ctx) {
    const { p, n, inner, u, M } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 16 / 9), ez = easeOf(p.ease);
    const R = 7; // reel length
    const C = (media, o) => ({ media: ((media % n) + n) % n, h: o.w / ar, ...o });
    // collage: dense diagonal lattice (down-right steps) with seeded offsets, overlapping, lower-right cards on top
    const cw = 0.4 * U, A = [0.258 * U, -0.131 * U], B = [-0.192 * U, -0.262 * U];
    const cells = [];
    const span = Math.ceil(Math.max(1, 1 / U) * 3) + 1;
    for (let a = -4; a <= 4; a++) for (let b = -span; b <= span; b++) {
      const k = (a + 11) * 37 + (b + 11);
      const x = a * A[0] + b * B[0] + (M.rand(k, 3) - 0.5) * 0.34 * cw, y = a * A[1] + b * B[1] + (M.rand(k, 5) - 0.5) * 0.3 * cw;
      if (Math.abs(x) - cw * 0.6 > ctx.view.w / 2 || Math.abs(y) - cw * 0.4 > 0.5) continue;
      cells.push({ a, b, k, x: a === 0 && b === 0 ? 0 : x, y: a === 0 && b === 0 ? 0 : y, m: ((((a * 3 + b * 5) % 7) + 7) % 7), d: x * x + y * y });
    }
    cells.sort((P1, P2) => P1.d - P2.d);
    // card i < R must carry media i (they become the reel): take the nearest cell with that media
    for (let m = 1; m < R; m++) { const j = cells.findIndex((ce, jj) => jj >= m && ce.m === m); if (j > m) { const t = cells[j]; cells.splice(j, 1); cells.splice(m, 0, t); } }
    const NT = cells.length;
    const collage = () => cells.map((ce, i) => C(i === 0 ? 0 : ce.m, { x: ce.x - 0.02 * U, y: ce.y + 0.01, z: 0.035 * (0.5 * ce.x - ce.y) + 0.03 * M.rand(ce.k, 9) + (i === 0 ? 0.06 : 0), w: cw * (0.94 + 0.12 * M.rand(ce.k, 7)), rz: 0 }));
    // reel
    const hw = (p.heroSize / 100) * Math.min(inner.w, inner.h * 1.3);
    const ck = [[0, 0], [0.07, 0], [0.135, 1], [0.205, 1], [0.27, 2], [0.29, 2], [0.36, 3], [0.38, 3], [0.44, 4], [0.53, 4], [0.59, 5], [0.68, 5], [0.74, 6], [0.83, 6], [1, 7]];
    const reel = (_, f) => {
      const c = kf(f, ck, ez);
      return cells.map((_, i) => {
        if (i >= R) return C(i, { x: 0, y: -1, w: hw, opacity: 0 });
        const d = M.mod(i - c + R / 2, R) - R / 2;
        const below = d > 0;
        const y = below ? -d * 0.85 : -d * 1.3;
        const x = below ? d * 0.14 * U : -d * 0.12 * U;
        const tilt = [0, 0, 0.02, 0, 0.015, -0.01, -0.075][i] || 0;
        const rz = (below ? d * 1.4 : d * 0.18) + tilt * (1 - Math.min(1, Math.abs(d)));
        return C(i, { x, y: y - (i === 4 || i === 5 ? 0.05 : 0), z: 0.01 * (1 - Math.abs(d)), w: hw, rz, opacity: Math.abs(d) > 1.5 ? 0 : 1 });
      });
    };
    return play(ctx, [
      { hold: 0.035, move: 0.075, pose: collage, ease: E.inOutQuart },
      { hold: 0.82, move: 0.07, pose: reel, ease: E.inOutQuart },
    ]);
  },
};
