// X6 page-curl engine test (hidden, not listed). Shows four cards with different curl settings at phase u.
import { base, P } from '../_common.js';
export default {
  id: '_curltest', name: 'Curl Test', category: 'reveal-wipe', slots: 6, ref: 'original', desc: 'X6 test', tags: [],
  params: base({ mode: P.choice('Mode', 'grid', ['grid', 'page']) }),
  duration: 8, shadow: true,
  camera(ctx) { return { perspective: 30 }; },
  layout(ctx) {
    const { u, view } = ctx; const cards = [];
    if (ctx.p.mode === 'page') { // full page turn: page 0 turns over to reveal media 1 underneath, back shows media 2
      const w = Math.min(view.w * 0.8, 0.8 * 1.4), h = w / 1.4;
      cards.push({ media: 1, w, h, x: 0, y: 0, z: -0.001, layer: 0 });
      cards.push({ media: 0, w, h, x: 0, y: 0, z: 0, layer: 1, curl: { p: u, angle: Math.PI + 0.25, radius: 0.07, back: 'media2', media: 2 } });
      return cards;
    }
    const H = 0.36, W = H * 1.5; const xs = [-view.w * 0.23, view.w * 0.23], ys = [0.22, -0.22];
    const set = [
      { p: u, angle: Math.PI, back: 'paper' },
      { p: u, angle: Math.PI * 1.25, back: 'mirror', radius: 0.05 },
      { p: u, angle: -Math.PI / 2, back: 'media2', media: 3, radius: 0.08 },
      { p: u, angle: Math.PI * 0.75, back: '#ff5a3c', backTint: ['#000000', 0.1], radius: 0.035 },
    ];
    set.forEach((cu, k) => {
      const x = xs[k % 2], y = ys[k >> 1];
      const rx = -0.45, ry = (k % 2 ? -0.25 : 0.25);
      cards.push({ media: k + 6, w: W, h: H, x, y, z: -0.002, rx, ry, layer: 0, shadow: 0 });
      cards.push({ media: k, w: W, h: H, x, y, z: 0, rx, ry, layer: 1, curl: cu });
    });
    return cards;
  },
};
