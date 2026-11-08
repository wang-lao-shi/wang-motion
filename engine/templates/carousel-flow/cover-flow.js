import { base, P, EASINGS, easeOf, cardAR, mRx, mRy, mRz, mMul, mApply, eulerYXZ } from '../_common.js';
// Classic cover flow: flat centre card, neighbours turned and stacked to the sides; steps (or glides) one card per beat.
export function coverFlow(ctx, vertical) {
  const { p, n, u, M } = ctx;
  const V = ctx.view, I = ctx.inner;
  const K = Math.max(2, Math.round(p.loopCards));
  const ar = cardAR(ctx, 1.05);
  let w = (p.cardSize / 100) * (vertical ? Math.min(1, I.h / 0.88) : Math.min(1, I.w / 0.88));
  if (vertical && w / ar > (p.cardSize / 100) * 0.95) w = (p.cardSize / 100) * 0.95 * ar;
  const h = w / ar;
  const L = vertical ? h : w;
  const rev = (p.direction === 'leftToRight' || p.direction === 'topToBottom') ? -1 : 1;
  const x = u * K; const k0 = Math.floor(x);
  const s = (p.motion === 'continuous' ? x : k0 + easeOf(p.ease)(Math.min(1, (x - k0) / 0.5))) * rev;
  const tilt = Math.min(1.5, M.rad(p.sideTilt) * 1.8);
  const gap = p.gap / 100;
  const d1 = L * (vertical ? 1.42 : 1.3) + gap * 1.5, d2 = L * 0.5 * Math.cos(tilt) * 0.5 + gap;
  const G = mRz(M.rad(p.flowAngle || 0));
  const out = [];
  const j0 = Math.round(s);
  for (let j = j0 - 7; j <= j0 + 7; j++) {
    const k = j - s; const a = Math.abs(k); const sg = Math.sign(k) || 1; const m = Math.min(1, a);
    const off = a <= 1 ? k * d1 : sg * (d1 + (a - 1) * d2);
    const z = -m * L * 0.55 - Math.max(0, a - 1) * 0.02;
    let pos = vertical ? [0, -off, z] : [off, 0, z];
    pos = mApply(G, pos);
    const R = vertical ? mRx(-sg * m * tilt) : mRy(-sg * m * tilt);
    const e = eulerYXZ(mMul(G, R));
    const lim = (vertical ? V.h : V.w) * 0.5 + L;
    if (Math.abs(off) > lim * 1.6) continue;
    out.push({ media: M.mod(M.mod(j, K), n), x: pos[0], y: pos[1], z: pos[2], ...e, w, h, layer: -a, bright: 1 - 0.35 * m });
  }
  return out;
}
export default {
  id: 'cover-flow', name: 'Cover Flow', category: 'carousel-flow', slots: 5,
  desc: 'Apple-style cover flow: flat centre cover, tilted neighbours, one card per beat',
  tags: ['carousel', 'coverflow', 'apple', 'step', 'product'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 46, 10, 100),
    gap: P.pct('Gap', 4, 0, 30),
    sideTilt: P.deg('Side tilt', 40, 0, 89),
    flowAngle: P.deg('Flow angle', 0, -90, 90),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
    direction: P.choice('Direction', 'rightToLeft', ['rightToLeft', 'leftToRight']),
    motion: P.choice('Motion', 'stopAtCenter', ['stopAtCenter', 'continuous']),
    loopCards: P.num('Cards per loop', 5, 2, 24),
    perspective: P.perspective(30),
  }),
  shadow: false, sheen: 0.1,
  duration: 12,
  camera(ctx) { return { perspective: ctx.p.perspective }; },
  layout(ctx) { return coverFlow(ctx, false); },
};
