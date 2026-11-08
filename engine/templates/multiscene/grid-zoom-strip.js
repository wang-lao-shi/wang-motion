import { base, P, easeOf, EASINGS, CARD_RATIO_OPTS } from '../_common.js';
import { E } from '../../lib.js';
import { steps } from './_scenes.js';
// 3x3 grid unfolds into a single strip while the camera zooms onto card 1, scrolls along the strip to the last card, then zooms back out into the grid.
export default {
  id: 'grid-zoom-strip', name: 'Grid Zoom Strip', category: 'multiscene', radiusMode: 'card', slots: 9,
  desc: '3x3 grid unfolds into one strip, camera zooms in and travels card to card, then folds back into the grid',
  tags: ['multiscene', 'grid', 'strip', 'zoom', 'slideshow'], ref: 'animos',
  params: base({
    zoom: P.num('Zoom', 2, 1, 4, '', 0.1),
    gap: P.num('Gap', 2, 0, 15, '%', 0.25),
    fade: P.bool('Fade', false),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'horizontal', ['horizontal', 'vertical']),
    zoomTarget: P.choice('Zoom target', 'start', ['start', 'center']),
    movement: P.choice('Movement', 'smooth', ['smooth', 'stepped']),
    cardRatio: P.choice('Card ratio', 'frame', ['frame', ...CARD_RATIO_OPTS]),
  }),
  shadow: true, shadowOpacity: 0.35, sheen: 0.1, rim: 0.3,
  duration: 6,
  layout(ctx) {
    const { p, n, inner, u, M } = ctx;
    const ez = easeOf(p.ease);
    const G = 3, NN = 9, gap = p.gap / 100;
    const RAT = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 0.8, '16:9': 16 / 9, '9:16': 9 / 16 };
    const ar = p.cardRatio === 'frame' ? inner.w / inner.h : p.cardRatio === 'auto' ? ctx.ratioOf(0) : RAT[p.cardRatio];
    // fit 3x3 grid of cards inside the inner frame
    let cw = (inner.w - 2 * gap) / G, ch = cw / ar;
    if (ch * G + 2 * gap > inner.h) { ch = (inner.h - 2 * gap) / G; cw = ch * ar; }
    const px = cw + gap, py = ch + gap;
    const vert = p.direction === 'vertical';
    const s0 = p.zoomTarget === 'center' ? 4 : 0;
    // monotone cubic through reference camera-travel keys (zero slope at ends)
    const TK = [[0, 0], [0.25, 0.066], [0.5, 0.445], [0.75, 0.91], [1, 1]];
    const mono = (t) => {
      const N = TK.length, d = [], m = [0];
      for (let i = 0; i < N - 1; i++) d.push((TK[i + 1][1] - TK[i][1]) / (TK[i + 1][0] - TK[i][0]));
      for (let i = 1; i < N - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]));
      m.push(0);
      let i = 0; while (i < N - 2 && t > TK[i + 1][0]) i++;
      const h = TK[i + 1][0] - TK[i][0], q = M.clamp((t - TK[i][0]) / h, 0, 1), q2 = q * q, q3 = q2 * q;
      return (2 * q3 - 3 * q2 + 1) * TK[i][1] + (q3 - 2 * q2 + q) * h * m[i] + (-2 * q3 + 3 * q2) * TK[i + 1][1] + (q3 - q2) * h * m[i + 1];
    };
    // phases
    const a = ez(M.win(u, 0, 0.25)), b = M.win(u, 0.25, 0.75), c2 = ez(M.win(u, 0.75, 1));
    const travel = p.movement === 'stepped' ? steps(b, NN - 1 - s0, 0.6, ez) / (NN - 1 - s0) : mono(b);
    const ci = s0 + (NN - 1 - s0) * travel; // strip index under the camera
    const k = u < 0.75 ? a * a : 1 - c2 ** 4; // grid(0) -> strip(1): unfolds late, folds late
    const Z = 1 + (p.zoom - 1) * (u < 0.75 ? a ** 2.6 : (1 - c2) ** 0.75);
    const strip = (i) => vert ? [-px, py * (1 - i)] : [px * i - px, py];
    const gridP = (i) => [((i % G) - 1) * px, (1 - Math.floor(i / G)) * py];
    const camS = strip(u < 0.75 ? (u < 0.25 ? s0 : ci) : NN - 1);
    const cam = [camS[0] * k, camS[1] * k];
    const out = [];
    for (let i = 0; i < NN; i++) {
      const g = gridP(i), s = strip(i);
      const r = Math.floor(i / G);
      const kx = M.clamp(k * 1.25 - (vert ? 0.25 : 0), 0, 1), ky = M.clamp(k * 1.25 - (vert ? 0 : 0.25), 0, 1); // slide along first, then join
      const kk = [vert ? E.inOutSine(kx) : E.inOutSine(kx), E.inOutSine(ky)];
      const wx = g[0] + (s[0] - g[0]) * kk[0], wy = g[1] + (s[1] - g[1]) * kk[1];
      const x = (wx - cam[0]) * Z, y = (wy - cam[1]) * Z;
      const w = cw * Z;
      if (Math.abs(x) > ctx.view.w / 2 + w || Math.abs(y) > 0.5 + w) continue;
      const dist = Math.abs(i - ci);
      out.push({ media: i % n, x, y, z: 0, w, h: w / ar, opacity: p.fade ? 1 - 0.65 * k * Math.min(1, dist) : 1, layer: r });
    }
    return out;
  },
};
