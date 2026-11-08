import { base, P, EASINGS, easeOf, cardAR, mRx, mRy, mRz, mMul, mApply, eulerYXZ } from '../_common.js';
// Viewer inside a ring (wheel) of big cards: the wheel snaps one card per beat with anticipation + overshoot,
// neighbours wrap toward the camera at the frame edges; the wheel rolls slightly as it swings.
export function wheelPos(u, K, p) {
  const x = u * K; const k = Math.floor(x); const f = x - k;
  const hold = Math.min(0.9, Math.max(0, p.hold / 100));
  const mv = 1 - hold;                                    // active part of the beat
  const A = (p.anticipation / 100) * 0.22, O = (p.overshoot / 100) * 0.8;
  const t = Math.min(1, f / mv);
  const ta = 0.25, tm = 0.6;
  let g;
  if (t < ta) g = -A * Math.sin((Math.PI / 2) * (t / ta));
  else if (t < tm) g = -A + (1 + O + A) * easeOf(p.ease)((t - ta) / (tm - ta));
  else { const q = (t - tm) / (1 - tm); g = 1 + O * (1 - (-(Math.cos(Math.PI * q) - 1) / 2)); }
  return k + g;
}
export default {
  id: 'wheel-carousel', name: 'Wheel Carousel', category: 'carousel-flow', slots: 6,
  desc: 'Big cards on a wheel around the viewer, snapping one per beat with anticipation and overshoot',
  tags: ['carousel', 'wheel', 'ring', 'step', 'hero'], ref: 'animos',
  params: base({
    cornerRadius: P.cornerRadius(5),
    cardSize: P.pct('Card size', 70, 20, 100),
    wheelSize: P.pct('Wheel size', 105, 50, 200),
    anticipation: P.pct('Anticipation', 20),
    overshoot: P.pct('Overshoot', 10),
    hold: P.pct('Hold', 33, 0, 90),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'clockwise', ['clockwise', 'counterClockwise']),
    cardRatio: P.cardRatio(),
    shadow: P.bool('Shadow', true),
    wheelCards: P.num('Cards on wheel', 6, 4, 16),
    loopCards: P.num('Cards per loop', 6, 2, 24),
    swingRoll: P.pct('Swing roll', 100, 0, 200),
    perspective: P.perspective(8),
    eyeTilt: P.deg('Eye tilt', 19, -45, 45),
  }),
  shadow: true, shadowOpacity: 0.35, sheen: 0.04,
  duration: 9,
  camera(ctx) { return { perspective: ctx.p.perspective }; },
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const V = ctx.view;
    const K = Math.max(3, Math.round(p.wheelCards));
    const ar = cardAR(ctx, 1.00);
    const w = (p.cardSize / 100) * Math.min(1, V.w / 1.0), h = w / ar;
    const dth = M.TAU / K;
    // animos: the wheel is a ring of cards around the viewer whose axis leans back by the eye tilt (we look
    // slightly down into it): neighbours swing toward the camera, drop and roll outward, their outer half
    // clipped by the frame. Fitted on the 932px reference: ring radius ≈ 0.775·card width, tilt ≈ 19°.
    const R = 0.85 * (p.wheelSize / 100) * (w * 0.97) / (2 * Math.tan(dth / 2));
    const rev = p.direction === 'counterClockwise' ? -1 : 1;
    const L = Math.max(1, Math.round(p.loopCards));
    const s = wheelPos(u, L, p);
    const off = s - Math.round(s);
    const roll = -off * (p.swingRoll / 100) * 0.9 * rev;
    const tau = M.rad(p.eyeTilt);
    const T = mRx(tau), Ti = mRx(-tau);
    const G = mRz(roll);
    const C = mApply(T, [0, 0, R]);                  // ring centre: in front of the centre card, along the tilted normal
    // explicit corner radius (bypasses the engine cap): ≈2.3% of frame short side at the default 5%
    const rMul = 0.92 * Math.min(V.w, V.h) / (3.2 * Math.min(w, h));
    const out = [];
    const j0 = Math.round(s);
    for (let j = j0 - 2; j <= j0 + 2; j++) {
      const th = (s - j) * dth * rev;
      if (Math.abs(th) > M.rad(105)) continue;
      const Rw = mMul(G, mMul(T, mMul(mRy(-th), Ti)));   // rotation about the tilted wheel axis, then swing roll
      const q = mApply(Rw, [-C[0], -C[1], -C[2]]);
      const pos = [C[0] + q[0], C[1] + q[1], C[2] + q[2]];
      const e = eulerYXZ(Rw);
      const d = Math.abs(j - s);
      out.push({ media: M.mod(M.mod(j, L), n), x: pos[0], y: pos[1], z: pos[2], ...e, w, h,
        bright: 1 - 0.12 * M.clamp(d, 0, 1),
        d, depthTest: false, radiusMul: rMul });
    }
    // painter order by wheel distance (integer layers so the engine's distance sort can't reorder them):
    // the card nearest the centre slot always draws last, fully in front (no plane-intersection look)
    out.sort((a, b) => b.d - a.d).forEach((c, k) => { c.layer = k; c.y += 0.003; delete c.d; });
    return out;
  },
};
