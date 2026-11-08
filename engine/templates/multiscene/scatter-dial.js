import { base, P, cardAR, easeOf, EASINGS } from '../_common.js';
import { E } from '../../lib.js';
import { play, unit, kf } from './_scenes.js';
// Loose scatter of cards at different sizes shuffling around -> gathers into a dial (ring) -> camera zooms onto the turning dial -> zooms back out -> scatter.
export default {
  id: 'scatter-dial', name: 'Scatter Dial', category: 'multiscene', radiusMode: 'card', slots: 8,
  desc: 'Shuffling scatter of cards gathers into a dial that turns while the camera zooms in and out',
  tags: ['multiscene', 'scatter', 'ring', 'dial', 'zoom', 'story'], ref: 'animos',
  params: base({
    scatterCardSize: P.pct('Scatter card size', 30, 5, 60),
    ringCardSize: P.pct('Ring card size', 30, 5, 60),
    ringSize: P.pct('Ring size', 36, 10, 80),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.12, rim: 0.3,
  duration: 18,
  layout(ctx) {
    const { p, n, M } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1.75), ez = easeOf(p.ease);
    const K = Math.min(8, Math.max(3, n));
    const C = (i, o) => ({ media: i, h: o.w / ar, ...o });
    const ss = p.scatterCardSize / 30, AW = ctx.view.w > 1 ? Math.min(1.5, ctx.view.w) : 1, AH = ctx.view.w < 1 ? Math.min(1.4, 1 / ctx.view.w) * 0.85 : 1;
    // scatter key layouts [x, y, w] (frame units, 1:1 reference)
    const SA = [[-0.25, 0.05, 0.38], [0.33, 0.15, 0.25], [-0.12, -0.38, 0.32], [-0.05, 0.37, 0.32], [0.25, -0.25, 0.16], [0.5, 0.45, 0.12], [-0.5, -0.1, 0.12], [0.55, -0.5, 0.12]];
    const SB = [[0.23, -0.3, 0.45], [-0.25, -0.22, 0.38], [-0.13, 0.3, 0.38], [0.22, 0.04, 0.13], [0.25, 0.29, 0.25], [-0.55, 0.5, 0.12], [0.55, 0.0, 0.12], [-0.5, -0.55, 0.12]];
    const scatter = (_, f) => {
      const m = E.inOutSine(M.pingpong(f)); // B -> A -> B
      return Array.from({ length: K }, (_, i) => {
        const a = SB[i], b = SA[i];
        return C(i, { x: (a[0] + (b[0] - a[0]) * m) * AW * U, y: (a[1] + (b[1] - a[1]) * m) * AH, z: (a[2] + (b[2] - a[2]) * m) * 0.2, w: (a[2] + (b[2] - a[2]) * m) * ss * U, opacity: i < 5 ? 1 : 0 });
      });
    };
    const R0 = (p.ringSize / 36) * 0.26 * U, W0 = (p.ringCardSize / 30) * 0.18 * U;
    const dial = (_, f) => {
      const u = 0.19 + f * 0.62;
      const zk = kf(u, [[0.25, 0], [0.37, 1], [0.625, 1], [0.74, 0]], ez);
      const s = kf(u, [[0.19, 4.2], [0.25, 5], [0.375, 10.5], [0.5, 14], [0.625, 16], [0.75, 17.5], [0.81, 18]], E.linear);
      const R = R0 * (1 + 0.4 * zk), w = W0 * (1 + 0.46 * zk);
      // portrait: zoomed ring's top edge sits at ~35% height instead of dropping toward the bottom
      const cy = ctx.view.w < 1 ? (-0.08 * (1 - zk)) + zk * (0.15 - R - w / ar / 2) : -0.08 - 0.37 * zk;
      return Array.from({ length: K }, (_, i) => {
        const a = M.PI / 2 + (i - s) * (M.TAU / K);
        return C(i, { x: R * Math.cos(a), y: cy + R * Math.sin(a), z: 0, w });
      });
    };
    return play(ctx, [
      { hold: 0.25, move: 0.065, pose: scatter, ease: ez, stagger: 0.35 },
      { hold: 0.62, move: 0.065, pose: dial, ease: ez, stagger: 0.35 },
    ], { offset: 0.125 });
  },
};
