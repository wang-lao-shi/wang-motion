import { base, P, cardAR, easeOf, EASINGS } from '../_common.js';
import { E } from '../../lib.js';
import { play, unit, kf } from './_scenes.js';
// Hero card -> collapses into a deep deck -> deck deals into a row that sweeps across -> small deck -> ring of cards that sweeps (flips) a full turn -> hero.
export default {
  id: 'sweep-ring', name: 'Sweep Ring', category: 'multiscene', radiusMode: 'card', slots: 8,
  desc: 'Hero collapses into a deck, sweeps by as a row, regroups and opens into a ring that sweeps around',
  tags: ['multiscene', 'deck', 'row', 'ring', 'sweep', 'story'], ref: 'animos',
  params: base({
    rowCardSize: P.pct('Row card size', 60, 10, 100),
    cardGap: P.num('Card gap', 4, 0, 30, '%', 0.5),
    deckDepth: P.pct('Deck depth', 5, 0, 30),
    ringCardSize: P.pct('Ring card size', 30, 5, 60),
    ringSize: P.pct('Ring size', 36, 10, 80),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.12, rim: 0.3,
  duration: 17,
  layout(ctx) {
    const { p, n, inner, M } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1.75), ez = easeOf(p.ease);
    const K = Math.min(8, Math.max(3, n));
    const C = (i, o) => ({ media: i, h: o.w / ar, ...o });
    const base0 = Math.min(inner.w, inner.h * 1.6);
    const hero = () => Array.from({ length: K }, (_, i) => C(i, { x: 0, y: 0, z: -i * 0.01, w: base0, opacity: i === 0 ? 1 : 0 }));
    const dd = p.deckDepth / 5;
    const deck = (x0, w, dx, dz) => () => Array.from({ length: K }, (_, i) => C(i, { x: x0 + i * dx * dd, y: 0, z: -i * dz * dd - i * 0.004, w }));
    const rw = (p.rowCardSize / 100) * base0 * 0.92, pitch = rw + (p.cardGap / 100) * 1.0;
    const row = (_, f) => { const c = kf(f, [[0, 0.1], [0.25, 1.5], [0.7, K - 1.5], [0.92, K - 1.4], [1, K - 0.9]], E.inOutSine); return Array.from({ length: K }, (_, i) => C(i, { x: (i - c) * pitch, y: 0, z: 0, w: rw })); };
    const R = (p.ringSize / 100) * 0.92 * U, cw = (p.ringCardSize / 100) * 0.9 * U;
    const ring = (_, f) => {
      const rot = kf(f, [[0.04, 0], [0.43, M.rad(100)], [0.82, M.rad(372)], [1, M.TAU + M.rad(12)]], E.inOutSine);
      return Array.from({ length: K }, (_, i) => {
        const a = M.rad(-12) + (i / K) * M.TAU + rot;
        return C(i, { x: R * Math.cos(a) * 1.08, y: R * Math.sin(a), z: 0, w: cw });
      });
    };
    return play(ctx, [
      { hold: 0.04, move: 0.07, pose: hero, ease: ez },
      { hold: 0.03, move: 0.06, pose: deck(-0.1 * U, rw, 0.068 * U, 0.05), ease: ez },
      { hold: 0.22, move: 0.06, pose: row, ease: ez },
      { hold: 0.07, move: 0.05, pose: deck(-0.33 * U, cw * 1.07, 0.046 * U, 0.04), ease: ez, stagger: 0.3 },
      { hold: 0.35, move: 0.05, pose: ring, ease: ez },
    ]);
  },
};
