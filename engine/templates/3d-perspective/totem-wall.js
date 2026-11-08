import { base, P } from '../_common.js';
import { wall } from './sphere-wall.js';
// Columns of small cards on the inside of a cylinder (concave totem), scrolling vertically.
export default {
  id: 'totem-wall', name: 'Totem Wall', category: '3d-perspective', slots: 8,
  desc: 'Cylindrical wall of cards (concave), columns scrolling up or down',
  tags: ['wall', 'grid', 'cylinder', 'totem', '3d', 'immersive', 'vertical'], ref: 'animos',
  params: base({
    zoom: P.pct('Zoom', 33, 0, 100),
    tilt: P.deg('Tilt', 0, -45, 45),
    padding: P.padding(13),
    cornerRadius: P.cornerRadius(0.5),
    curvature: P.num('Curvature (concave ⟷ convex)', -100, -100, 100, '%'),
    gap: P.num('Gap', 4.5, 0, 20, '%', 0.25),
    edgeFade: P.pct('Edge fade', 0),
    cardRatio: P.cardRatio(),
    direction: P.choice('Direction', 'up', ['up', 'down', 'alternate']),
    period: P.num('Cards per loop', 8, 2, 24),
    speed: P.speed(1),
  }),
  shadow: false, sheen: 0.15, rim: 0, edgeX: 0.85, edgeW: 0.0026,
  duration: 20,
  camera() { return { perspective: 3 }; },
  layout(ctx) { ctx.p.motion = 'continuous'; return wall(ctx, 'v', { cw: 0.175, ar: 1.8, k: 2.1, cyl: true, fitMin: true }); },
};
