import { base, P, backFade, easeOf, EASINGS, mRx, mRy, mRz, mMul, mApply, eulerYXZ } from '../_common.js';
// Large ring of cards around the viewer's focus; steps one card per beat, front card centred, far side seen mirrored.
export default {
  id: 'cover-ring', name: 'Cover Ring', category: '3d-perspective', slots: 8,
  desc: 'Big horizontal ring of covers rotating one card per beat',
  tags: ['ring', 'carousel', 'cover', '3d', 'step'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 37, 5, 100),
    ringSize: P.pct('Ring size', 131, 30, 300),
    tilt: P.deg('Tilt', 0, -60, 60),
    perspective: P.perspective(55),
    backFade: P.pct('Back fade', 55),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
    direction: P.choice('Direction', 'clockwise', ['clockwise', 'counterClockwise']),
    motion: P.choice('Motion', 'stepPerCard', ['stepPerCard', 'continuous']),
    ringCount: P.num('Cards in ring', 8, 3, 24),
  }),
  shadow: false, sheen: 0.2, rim: 0.85, edgeTop: 0.75, edgeW: 0.004,
  duration: 14,
  camera(ctx) { return { fov: 6 + ctx.p.perspective * 0.42 }; },
  layout(ctx) { return ring(ctx, false); },
};

export function ring(ctx, vertical) {
  const { p, n, u, M } = ctx;
  const V = ctx.view;
  const K = Math.max(3, Math.round(p.ringCount));
  const fit = Math.min(1, V.w / 0.95);                 // shrink on portrait frames
  const w0 = (p.cardSize / 100) * 1.24 * (vertical ? Math.min(1, V.h) : fit) * (vertical ? Math.min(1, V.w / 0.62) : 1);
  const ar = (ctx.spec?.cardRatio || p.cardRatio || 'auto') === 'auto' ? 1.04 : ctx.ratioOf(0);
  const w = w0, h = w0 / ar;
  const R = (p.ringSize / 100) * 0.565 * (vertical ? h / 0.459 * 0.98 : w / 0.459);
  const rev = (vertical ? p.direction === 'topToBottom' : p.direction === 'counterClockwise') ? -1 : 1;
  // step phase: at u=k/K the front card is already ~0.14 step past rest (as in animos)
  const s = (p.motion === 'continuous' ? u * K : (() => { const x = u * K + 0.216; const k = Math.floor(x); return k + easeOf(p.ease)(Math.min(1, (x - k) / 0.6)); })()) * rev;
  const dth = M.TAU / K;
  const tilt = M.rad(p.tilt), roll = M.rad(p.rotate || 0);
  const G = vertical ? mMul(mRz(roll), mRy(tilt)) : mRx(tilt);
  const out = [];
  const j0 = Math.floor(-s);
  for (let j = j0 - Math.floor(K / 2) + 1; j <= j0 + Math.ceil(K / 2); j++) {
    const th = (j + s) * dth;
    let pos, L;
    if (vertical) { pos = [0, R * Math.sin(th), R * Math.cos(th) - R]; L = mRx(-th); }
    else { pos = [R * Math.sin(th), 0, R * Math.cos(th) - R]; L = mRy(th); }
    pos = mApply(G, [pos[0], pos[1], pos[2] + R]); pos[2] -= R;
    const e = eulerYXZ(mMul(G, L));
    const facing = Math.cos(th);
    out.push({ media: M.mod(M.mod(j, K), n), x: pos[0], y: pos[1], z: pos[2], ...e, w, h, bright: 1 - Math.min(0.95, (p.backFade / 100) * 1.4) * M.clamp((0.45 - facing) / 0.6, 0, 1) });
  }
  return out;
}
