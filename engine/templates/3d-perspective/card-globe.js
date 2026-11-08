import { base, P, cardAR, backFade, mRx, mRy, mMul, eulerYXZ } from '../_common.js';
import { E, beats } from '../../lib.js';
// A globe built from latitude rings of curved cards; spins one turn per loop, far side seen mirrored through the gaps.
export default {
  id: 'card-globe', name: 'Card Globe', category: '3d-perspective', slots: 12,
  desc: 'Spinning globe tiled with curved cards in latitude rings',
  tags: ['globe', 'sphere', '3d', 'spin', 'hero'], ref: 'animos',
  params: base({
    cornerRadius: P.cornerRadius(1),
    globeSize: P.pct('Globe size', 70, 20, 150),
    cardSize: P.pct('Card size', 20, 5, 50),
    gap: P.num('Gap', 2.5, 0, 15, '%', 0.25),
    backFade: P.pct('Back fade', 55),
    tilt: P.deg('Tilt', 0, -60, 60),
    cardRatio: P.cardRatio(),
    motion: P.choice('Motion', 'continuous', ['continuous', 'waypoints', 'waypointsNoZoom']),
    direction: P.choice('Direction', 'left', ['left', 'right', 'alternate']),
    perspective: P.perspective(34),
    speed: P.speed(1),
  }),
  shadow: false, sheen: 0.2, rim: 0.3, edgeX: 0.15, edgeW: 0.0025, depthWrite: true,
  duration: 20,
  camera(ctx) { return { perspective: ctx.p.perspective }; },
  layout(ctx) { return globe(ctx, { rimDark: 0.35 }); },
};

// sphere of latitude rings. o.flat => billboard cards (orbit globe)
export function globe(ctx, o) {
  const { p, n, u, M } = ctx;
  const V = ctx.view;
  const R = (p.globeSize / 100) * Math.min(V.w, V.h) * (o.rScale ?? 0.57);
  const ar = cardAR(ctx, o.ar ?? 1.75);
  // angular card height from card size
  const chA = (p.cardSize / 100) * (o.hScale ?? 0.86);      // radians on the sphere
  const gA = (p.gap / 100) * (o.gScale ?? 1.5);
  const rows = o.rows ?? Math.max(3, Math.round(Math.PI / (chA + gA)));
  const eqCount = o.eqCount ?? Math.max(4, Math.round((M.TAU) / (chA * ar * 0.84 + gA)));
  let spin, zoomK = 1;
  const steps = o.steps ?? 8;
  if (p.motion === 'continuous') spin = u * M.TAU * p.speed;
  else {
    const b = beats(u, steps, 0.5, E.inOutCubic) / steps;
    spin = b * M.TAU * p.speed;
    if (p.motion === 'waypoints') zoomK = 1 - 0.12 * Math.sin(Math.PI * M.clamp(M.fract(u * steps) / 0.5));
  }
  const dir = p.direction === 'right' ? -1 : 1;
  const tilt = M.rad(p.tilt);
  const out = [];
  const camZ = ctx.camDist;
  for (let r = 0; r < rows; r++) {
    const lat = (o.lats ? o.lats[r] : (-Math.PI / 2 + (r + 0.5) * Math.PI / rows));
    const cl = Math.cos(lat);
    const K = o.counts ? o.counts[r] : Math.max(o.minCount ?? 3, Math.round(eqCount * cl));
    if (K <= 0) continue;
    let rd = dir; if (p.direction === 'alternate' && (r & 1)) rd = -rd;
    const ringOff = o.ringOff ? o.ringOff(r) : (r & 1 ? 0.5 : 0) * M.TAU / K;
    for (let i = 0; i < K; i++) {
      const lon = (i + 0.5) / K * M.TAU + ringOff + rd * spin;
      // position: lon=0 faces camera (+z). front moves right for dir=+1
      let x = R * cl * Math.sin(lon), y = R * Math.sin(lat), z = R * cl * Math.cos(lon);
      // tilt about X (axis toward camera)
      if (o.tiltZ) { // orbit: tilt the spin axis sideways (roll) + a fixed view pitch
        const pt = o.pitch ?? 0;
        const y1 = y * Math.cos(pt) - z * Math.sin(pt), z1 = y * Math.sin(pt) + z * Math.cos(pt); y = y1; z = z1;
        const x2 = x * Math.cos(tilt) - y * Math.sin(tilt), y2 = x * Math.sin(tilt) + y * Math.cos(tilt); x = x2; y = y2;
      } else {
        const yy = y * Math.cos(tilt) - z * Math.sin(tilt), zz = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = yy; z = zz;
      }
      const media = o.media ? o.media(r, i, K) : ((Math.floor((i + 0.5) / K * eqCount) + (o.mediaOff ?? -2)) % n + n) % n;
      // facing (normal . toCamera) approx
      const nx = x / R, ny = y / R, nz = z / R;
      const tc = [-x, -y, camZ - z]; const tl = Math.hypot(...tc);
      const facing = (nx * tc[0] + ny * tc[1] + nz * tc[2]) / tl;
      if (o.flat) {
        const s = o.cardW * zoomK;
        out.push({ media, x: x * zoomK, y: y * zoomK, z: z * zoomK, w: s, h: s / ar, bright: backFade(facing, p.backFade / 100) * (o.brightMul ?? 1),
          opacity: o.opacity ?? 1 });
      } else {
        const cw = (M.TAU * R * cl / K) - gA * R;
        const chh = chA * R;
        if (cw <= 0.002) continue;
        const e = tilt ? eulerYXZ(mMul(mRx(tilt), mMul(mRy(lon), mRx(-lat)))) : { rx: -lat, ry: lon, rz: 0, order: 'YXZ' };
        out.push({ media, x: x * zoomK, y: y * zoomK, z: z * zoomK, ...e, w: cw * zoomK, h: chh * zoomK,
          bend: 1 / (R * cl * zoomK), bendX: 1 / (R * zoomK), bright: backFade(facing, p.backFade / 100) * (1 - (o.rimDark ?? 0) * M.smooth(0.65, 0.12, facing) * M.smooth(-0.3, 0, facing)) });
      }
    }
  }
  return out;
}
