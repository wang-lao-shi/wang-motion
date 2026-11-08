import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
import { beats } from '../../lib.js';
import { orbitPhase } from './orbit-showcase.js';
// Flat photos on a circle in the frame plane, turning clockwise while their sizes pulse in a travelling wave.
export default {
  id: 'photo-orbit', name: 'Photo Orbit', category: 'orbit', slots: 8,
  desc: 'Photos arranged on a circle, rotating while their sizes pulse like a heartbeat wave',
  tags: ['orbit', 'circle', 'wreath', 'pulse', 'flat'], ref: 'animos',
  params: base({
    pulseStrength: P.pct('Pulse strength', 60),
    ringWidth: P.pct('Ring width', 56, 10, 120),
    ringHeight: P.pct('Ring height', 56, 10, 120),
    cardSize: P.pct('Card size', 26, 5, 60),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'clockwise', ['clockwise', 'counterClockwise']),
    motion: P.choice('Motion', 'linear', ['linear', 'fastSlowFast', 'stepPerCard']),
    cardRatio: P.cardRatio(),
    ringCards: P.num('Cards on ring', 8, 3, 24),
    speed: P.speed(1),
  }),
  shadow: true, shadowOpacity: 0.5, rim: 0.9, edgeTop: 0.6, edgeW: 0.003,
  duration: 18,
  camera() { return { perspective: 4 }; },
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const K = Math.max(3, Math.round(p.ringCards));
    const dir = p.direction === 'counterClockwise' ? -1 : 1;
    let ph;
    if (p.motion === 'stepPerCard') ph = beats(u * p.speed, K, 0.5, easeOf(p.ease)) / K;
    else ph = orbitPhase(u * p.speed, K, p.motion === 'fastSlowFast' ? 'fastSlowFast' : 'linear');
    const sc = Math.min(1, ctx.aspect) * 0.9;
    const Rx = (p.ringWidth / 100) * 0.5 * 0.86 * sc, Ry = (p.ringHeight / 100) * 0.5 * 0.86 * sc;
    const ar = cardAR(ctx, 1.08);
    const out = [];
    for (let i = 0; i < K; i++) {
      const a = M.TAU * (i / K + dir * ph);
      // alternate cards are big/small; the contrast breathes twice per loop
      const wave = (i % 2 === 0 ? 1 : -1) * (0.8 + 0.2 * Math.cos(M.TAU * 2 * u + i));
      const cy = Math.cos(a);   // +1 top of ring, -1 bottom
      // the ring is slightly tilted toward the viewer: the bottom is nearest (drawn on top, a touch larger)
      const sz = (1 + (p.pulseStrength / 100) * 0.14 * wave) * (1 - 0.04 * cy);
      const w = (p.cardSize / 100) * 0.98 * sc * sz;
      out.push({ media: i % n, x: Rx * Math.sin(a), y: Ry * Math.cos(a), z: 0.006 * wave - 0.06 * cy, w, h: w / ar });
    }
    return out;
  },
};
