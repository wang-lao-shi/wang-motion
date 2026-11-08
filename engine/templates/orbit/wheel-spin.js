import { P, cardAR, EASINGS, easeOf } from '../_common.js';
import { beats } from '../../lib.js';
// Pinwheel of radial cards (turbine-tilted so each overlaps the next) turning around the frame centre.
export function wheel(ctx, o) {
  const { p, n, u, M } = ctx;
  const K = Math.max(3, Math.round(p.cardsOnWheel ?? 8));
  const dir = p.direction === 'counterClockwise' ? -1 : 1;
  const rot = Math.round(p.rotationsPerLoop);
  const ez = easeOf(p.ease ?? 'custom');
  // continuous = linear (or eased whole-loop for the bottom variant); stepped = one card per tick
  let ph;
  if (p.movement === 'stepped') ph = beats(u, K * Math.max(1, Math.abs(rot)), 0.35, ez) / K * Math.sign(rot || 1);
  else ph = (o.easeLoop ? ez(u) : u) * rot;
  const sc = Math.min(1, ctx.aspect);
  const w = (p.cardSize / 100) * 1.04 * sc * (o.cardMul ?? 1), h = w / cardAR(ctx, 1.0);
  const R = (p.wheelSize / 100) * 0.25 * sc * (o.rMul ?? 1);
  const cy = o.bottom ? -R + (o.topY ?? 0) : 0;
  const tilt = M.rad(o.tilt ?? 22);
  // media period: largest divisor of K that fits n (keeps the media pattern seamless around the wheel)
  let per = Math.min(n, K); while (K % per) per--;
  const out = [];
  for (let i = 0; i < K; i++) {
    const th = M.TAU * (i / K + dir * ph);
    let rz = -th, ry = tilt, rx = 0;
    if (p.spinStyle === 'selfRotate') rz += dir * M.TAU * u * 2;
    if (p.spinStyle === 'flip3d') rx = M.TAU * u * 2 + i * 0;
    out.push({ media: i % per, x: R * Math.sin(th), y: R * Math.cos(th) + cy, z: 0, rz, ry, rx, order: 'ZYX', w, h, edgeX: 0.9, edgeTop: 0.5 });
  }
  return out;
}
export const wheelParams = (cardSize, wheelSize, extra = {}, cards = 8) => ({
  padding: P.padding(6),
  cornerRadius: P.cornerRadius(5),
  cardSize: P.pct('Card size', cardSize, 5, 60),
  wheelSize: P.pct('Wheel size', wheelSize, 10, 200),
  rotationsPerLoop: P.num('Rotations / loop', 1, -4, 4),
  ...extra,
  direction: P.choice('Direction', 'clockwise', ['clockwise', 'counterClockwise']),
  cardRatio: P.cardRatio(),
  movement: P.choice('Movement', 'continuous', ['continuous', 'stepped']),
  spinStyle: P.choice('Spin style', 'none', ['none', 'selfRotate', 'flip3d']),
  cardsOnWheel: P.num('Cards on wheel', cards, 3, 32),
});
export default {
  id: 'wheel-spin', name: 'Wheel Spin', category: 'orbit', slots: 8,
  desc: 'Pinwheel of overlapping radial cards rotating around the centre',
  tags: ['orbit', 'wheel', 'pinwheel', 'spin', 'radial'], ref: 'animos',
  params: wheelParams(26, 92),
  shadow: false, rim: 0.85, edgeW: 0.0022, depthWrite: true,
  duration: 14,
  camera() { return { perspective: 10 }; },
  layout(ctx) { return wheel(ctx, {}); },
};
