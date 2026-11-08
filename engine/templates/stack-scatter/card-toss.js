import { base, P, cardAR } from '../_common.js';
// Card Toss (animos replica): cards are tossed up from below the frame one after another, each flying a
// ballistic arc to a random spot (random size, tilt, spin) and falling back out of the bottom.
const RAT = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 };
// per-card landing spot (fraction of spread) and size offset (fraction of size variation) for the first 8 throws
const XT = [-0.19, -0.86, 0.76, -1.06, 0.72, 0.63, -0.7, 0.76];
const ST = [0.2, 0, 0, -0.4, 0.5, 0.7, 1.3, -0.85];
// apex height offset (fraction of inner height) and sideways drift (fraction of inner width per beat), matched to the reference
const YT = [-0.122, 0.009, -0.035, -0.114, -0.101, -0.057, -0.122, -0.013];
const DT = [-0.118, 0, 0.061, 0.092, 0.035, 0.048, -0.074, -0.122];
// resting tilt sign per throw (|tilt| is 1/3..2/3 of Spin, i.e. 4-8 deg at the default 12 deg)
const TT = [1, 1, -1, 1, -1, 1, 1, -1];
export default {
  id: 'card-toss', name: 'Card Toss', category: 'stack-scatter', slots: 8,
  desc: 'Cards are tossed up from below one after another, arc through the frame with a little spin and fall away',
  tags: ['stack', 'scatter', 'toss', 'throw', 'arc', 'playful'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 26, 5, 80),
    sizeVar: P.pct('Size variation', 20, 0, 80),
    throwHeight: P.pct('Throw height', 75, 0, 100),
    spread: P.pct('Horizontal spread', 70, 0, 100),
    spin: P.num('Spin', 12, 0, 90, '°', 1),
    cardRatio: P.cardRatio('auto'),
    flow: P.choice('Flow', 'oneByOne', ['oneByOne', 'staggered']),
    shadow: P.bool('Shadow', true),
    loopCards: P.num('Cards per loop', 8, 2, 24),
    tossSpeed: P.num('Toss speed', 1, 0.5, 2, 'x', 0.05),
  }),
  shadow: true, shadowOpacity: 0.4,
  duration: 12,
  layout(ctx) {
    const { p, n, u, M, inner: I, view } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const cr = ctx.spec?.cardRatio || p.cardRatio || 'auto';
    const x = u * K;
    const rise = 0.8 / Math.max(0.3, p.tossSpeed);                 // beats from bottom to apex (fast throw)
    const sp = Math.max(0.3, p.tossSpeed), g = 0.11 * sp ** 2, g3 = 0.03 * sp ** 3; // fall: floaty first beat, then accelerates out
    const out = [];
    for (let j = Math.floor(x) - 4; j <= Math.floor(x) + 2; j++) {
      const m = M.mod(j, K), media = M.mod(m, n);
      const R = (s) => M.rand(m, s) * 2 - 1;
      const ta = j + 0.9 + (p.flow === 'staggered' ? R(7) * 0.35 : 0); // apex time (beats)
      const tau = x - ta;
      const sc = (p.cardSize / 100) * (1 + (m < 8 ? ST[m] : R(2)) * p.sizeVar / 100);
      const r = cardAR(ctx, 3 / 4);
      const w = Math.min(I.w * 0.6, 1.12 * sc * Math.sqrt(I.w * I.h)), h = w / r; // size by frame area so portrait/landscape look alike
      const bottom = -view.h / 2 - h * 0.6 - 0.03;
      const apex = (M.lerp(-0.4, 0.13, p.throwHeight / 100) + (m < 8 ? YT[m] : R(3) * 0.06)) * I.h;
      if (tau < -rise) continue;
      const y = tau < 0 ? apex - (apex - bottom) * (tau / rise) ** 2 : apex - g * tau * tau - g3 * tau * tau * tau;
      if (y < bottom) continue;
      const ph = M.clamp((tau + rise) / (rise + 1.7), 0, 1);
      const cx = (m < 8 ? XT[m] : R(1)) * (p.spread / 100) * (I.w - w) / 2;
      const xx = cx + (m < 8 ? DT[m] : R(4) * 0.08) * I.w * (tau - 0.1) * Math.max(0.3, p.tossSpeed);
      const spin = M.rad(p.spin);
      const ts = m < 8 ? TT[m] : (R(5) < 0 ? -1 : 1);
      const rz = ts * spin * (1 / 3 + Math.abs(R(5)) / 3) + R(6) * spin * 0.3 * (ph - 0.4);
      out.push({ media, x: xx, y, z: 0.003 * M.mod(m * 5, 7), rz, w, h, layer: m < 8 ? m : M.mod(m * 5, 7),
        shadow: p.shadow ? undefined : 0 });
    }
    return out;
  },
};
