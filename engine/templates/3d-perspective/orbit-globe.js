import { base, P } from '../_common.js';
import { globe } from './card-globe.js';
// Flat, camera-facing cards orbiting on three latitude rings of a tilted, spinning globe; translucent so far cards show through.
export default {
  id: 'orbit-globe', name: 'Orbit Globe', category: '3d-perspective', slots: 12,
  desc: 'Billboard cards orbiting a tilted invisible globe, far cards dim and smaller',
  tags: ['globe', 'orbit', '3d', 'spin'], ref: 'animos',
  params: base({
    cornerRadius: P.cornerRadius(1),
    globeSize: P.pct('Globe size', 50, 20, 150),
    cardSize: P.pct('Card size', 28, 5, 60),
    gap: P.num('Gap', 2.5, 0, 15, '%', 0.25),
    backFade: P.pct('Back fade', 55),
    tilt: P.deg('Tilt', 27, -90, 90),
    cardRatio: P.cardRatio(),
    motion: P.choice('Motion', 'continuous', ['continuous', 'waypoints']),
    direction: P.choice('Direction', 'left', ['left', 'right', 'alternate']),
    perspective: P.perspective(16),
    cardOpacity: P.pct('Card opacity', 94),
    mediaSpread: P.choice('Media spread', 'columns', ['columns', 'unique']),
    speed: P.speed(1),
  }),
  shadow: false, sheen: 0.15, edgeTop: 0.7, edgeBottom: 0.8, edgeW: 0.003,
  duration: 20,
  camera(ctx) { return { perspective: ctx.p.perspective }; },
  layout(ctx) {
    const { p, n } = ctx;
    const lat = 0.72;
    const counts = [6, 8, 6];
    const offs = [11, 9, 5];
    return globe(ctx, {
      flat: true, ar: 1.08, rScale: 0.66, tiltZ: true, pitch: 0.12, rows: 3, lats: [-lat, 0, lat], counts, steps: 8,
      ringOff: (r) => r * 0.3,
      cardW: (p.cardSize / 100) * 0.86 * (1 - p.gap / 100) * Math.min(1, ctx.view.w / 0.9), opacity: p.cardOpacity / 100,
      media: (r, i) => ((i + offs[r]) % n + n) % n,
    });
  },
};
