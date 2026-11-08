import { base, P, CARD_RATIO_OPTS } from '../_common.js';
// Cascade Drop (animos replica): cards drop in from above one after another, each landing slightly low and
// tilted in front of the pile; when the next card lands the previous one rises into the pile. After the last
// card the deck settles, holds, then falls out of frame for a seamless restart.
const RAT = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 };
const TILT = [2.7, -1.2, 1.4, -2.2, 1.9, -0.8, 2.3, -1.7]; // degrees, per drop order
const JX = [-0.006, 0.004, -0.012, 0.006, 0.01, -0.004, 0.003, -0.008];
export default {
  id: 'cascade-drop', name: 'Cascade Drop', category: 'stack-scatter', slots: 4,
  desc: 'Cards drop in from above one by one and pile up into a slightly tilted deck',
  tags: ['stack', 'deck', 'drop', 'pile', 'cascade', 'step'], ref: 'animos',
  params: base({
    rotation: P.pct('Rotation', 100, 0, 300),
    cardSize: P.pct('Card size', 78, 20, 100),
    cardRatio: { type: 'choice', label: 'Card ratio', default: 'frame', options: ['frame', ...CARD_RATIO_OPTS] },
    shadow: P.bool('Shadow', true),
    cards: P.num('Cards', 4, 2, 8),
    landOffset: P.pct('Landing offset', 15, 0, 40),
  }),
  shadow: true, shadowOpacity: 0.25,
  duration: 7,
  layout(ctx) {
    const { p, n, u, M, E, inner: I, view } = ctx;
    const K = Math.max(2, Math.round(p.cards));
    const sc = p.cardSize / 100;
    const bw = I.w * sc, bh = I.h * sc;
    const cr = ctx.spec?.cardRatio || p.cardRatio || 'frame';
    const r = cr === 'frame' ? bw / bh : cr === 'auto' ? ctx.ratioOf(0) : (RAT[cr] || bw / bh);
    let w = bw, h = bh; if (r > bw / bh) h = bw / r; else w = bh * r;
    // timeline: drops occupy [0, 0.5], settle, hold, exit [0.88, 1]
    const step = 0.5 / K, dropDur = Math.min(0.16, step * 1.25);
    const low = -(p.landOffset / 100) * (1 - sc * 0.2);
    const topY = view.h / 2 + h / 2 + 0.08;
    const rot = p.rotation / 100;
    const out = [];
    for (let k = 0; k < K; k++) {
      const s0 = k * step + 0.005;
      const a = M.clamp((u - s0) / dropDur, 0, 1);
      if (a <= 0) continue;
      const fall = E.outBack ? E.outBack(a) : a;
      // rise into pile when next card drops (or after the last card)
      const r0 = k < K - 1 ? (k + 1) * step + 0.005 : K * step + 0.02;
      const b = E.inOutCubic(M.clamp((u - r0) / dropDur, 0, 1));
      const restY = M.lerp(low, 0, b);
      let y = M.lerp(topY, restY, fall);
      const tilt = TILT[k % TILT.length] * (b > 0 ? 0.75 + 0.25 * (1 - b) : 1);
      let rz = M.rad(tilt * rot) * (1 + 0.6 * (1 - a));
      // exit: staggered fall downward
      const e = E.inCubic(M.clamp((u - 0.88 - (K - 1 - k) * 0.012) / 0.09, 0, 1));
      y -= e * (view.h + h);
      rz += M.rad(4 * rot) * e * (k % 2 ? 1 : -1);
      out.push({ media: M.mod(M.mod(k, K), n), x: JX[k % JX.length] * rot, y, z: k * 0.004, rz, w, h, layer: k,
        shadow: p.shadow ? undefined : 0 });
    }
    return out;
  },
};
