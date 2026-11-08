import { base, P, cardAR, mRy, mRz, mRx, mMul, mApply, eulerYXZ, backFade } from '../_common.js';
import { orbitPhase } from './orbit-showcase.js';
// Cards stand radially on a tilted ring like fanned pages: edge-on at front/back, opening up into two blooms at the sides.
export default {
  id: 'orbit-bloom', name: 'Orbit Bloom', category: 'orbit', slots: 12,
  desc: 'Radial cards on a tilted ring, fanning open like pages as they orbit',
  tags: ['orbit', 'ring', 'fan', 'pages', '3d'], ref: 'animos',
  params: base({
    pulseStrength: P.pct('Pulse strength', 60),
    leanToCentre: P.pct('Lean to centre', 0, -100, 100),
    ringWidth: P.pct('Ring width', 50, 10, 150),
    ringDepth: P.pct('Ring depth', 25, 0, 100),
    ringTilt: P.deg('Ring tilt', -29, -90, 90),
    cardSize: P.pct('Card size', 24, 5, 60),
    perspective: P.perspective(55),
    backFade: P.pct('Back fade', 45),
    curve: P.num('Curve (out / in)', 0, -100, 100, '%'),
    direction: P.choice('Direction', 'clockwise', ['clockwise', 'counterClockwise']),
    motion: P.choice('Motion', 'linear', ['linear', 'fastSlowFast']),
    cardRatio: P.cardRatio(),
    speed: P.speed(1),
  }),
  shadow: false, rim: 0.9, sheen: 0.1,
  duration: 12,
  camera(ctx) { return { perspective: ctx.p.perspective * 0.45 }; },
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const dir = p.direction === 'counterClockwise' ? -1 : 1;
    const ph = orbitPhase(u * p.speed, n, p.motion);
    const sc = Math.min(1, ctx.aspect);
    const w = (p.cardSize / 100) * 0.85 * sc, h = w / cardAR(ctx, 0.85);
    const Rx = (p.ringWidth / 100) * 0.5 * 0.85 * sc;                 // ring radius to card centre
    const Rz = Rx;
    const open = Math.asin(M.clamp((p.ringDepth / Math.max(1, p.ringWidth)), 0, 1));
    const T = mMul(mRz(-M.rad(p.ringTilt)), mRx(open));
    const lean = M.rad(p.leanToCentre * 0.6);
    const out = [];
    for (let i = 0; i < n; i++) {
      const th = (M.TAU * i) / n + dir * M.TAU * ph;
      const s = Math.sin(th), c = Math.cos(th);
      const pos = mApply(T, [Rx * s, 0, Rz * c]);
      // radial direction of the ellipse at th
      const ang = Math.atan2(Rz * c, Rx * s);
      const R = mMul(T, mMul(mRy(-ang), mRz(lean)));
      const e = eulerYXZ(R);
      const nrm = mApply(R, [0, 0, 1]);
      const front = Math.pow(Math.max(0, Math.abs(s)), 6);
      const k = 1 + (p.pulseStrength / 100) * 0.1 * front;
      // exactly edge-on cards collapse to a faint dashed sliver: fade them out
      const D = ctx.camDist || 2, vx = -pos[0], vy = -pos[1], vz = D - pos[2];
      const vd = Math.abs(nrm[0] * vx + nrm[1] * vy + nrm[2] * vz) / Math.hypot(vx, vy, vz);
      const op = M.smooth(0.012, 0.04, vd);
      out.push({ media: i, x: pos[0], y: pos[1] + 0.01, z: pos[2], ...e, w: w * k, h: h * k, opacity: op,
        bend: p.curve ? (p.curve / 100) * 2.5 : 0, bright: 1 - (p.backFade / 100) * (1 - c) * 0.5 * 0.9 });
    }
    return out;
  },
};
