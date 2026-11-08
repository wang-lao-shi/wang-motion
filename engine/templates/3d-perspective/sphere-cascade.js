import { base, P } from '../_common.js';
import { wall } from './sphere-wall.js';
// Columns of small cards on the inside of a sphere (concave), cascading vertically.
export default {
  id: 'sphere-cascade', name: 'Sphere Cascade', category: '3d-perspective', slots: 8,
  desc: 'Dense grid of small cards inside a sphere, columns cascading up or down',
  tags: ['wall', 'grid', 'sphere', '3d', 'immersive', 'vertical'], ref: 'animos',
  params: base({
    zoom: P.pct('Zoom', 20, 0, 100),
    tilt: P.deg('Tilt', 0, -45, 45),
    padding: P.padding(13),
    cornerRadius: P.cornerRadius(0.5),
    curvature: P.num('Curvature (concave ⟷ convex)', -100, -100, 100, '%'),
    gap: P.num('Gap', 5, 0, 20, '%', 0.25),
    edgeFade: P.pct('Edge fade', 0),
    cardRatio: P.cardRatio(),
    motion: P.choice('Motion', 'continuous', ['continuous', 'waypoints', 'waypointsNoZoom']),
    direction: P.choice('Direction', 'up', ['up', 'down', 'alternate']),
    period: P.num('Cards per loop', 8, 2, 24),
    speed: P.speed(1),
  }),
  shadow: false, sheen: 0.15, rim: 0, edgeX: 0.85, edgeW: 0.0026,
  duration: 20,
  camera() { return { perspective: 30 }; },
  layout(ctx) { return wall(ctx, 'v', { cw: 0.113, ar: 1.65, k: 0.6, fitMin: true }); },
};
