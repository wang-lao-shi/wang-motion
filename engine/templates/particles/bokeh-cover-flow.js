import { base, P, EASINGS, easeOf, cardAR, reflect } from '../_common.js';
import { drift } from '../../lib.js';
// Bokeh Cover Flow: a portrait cover-flow row (sharp flat hero, tilted defocused neighbours on a glossy floor) that steps one
// card per beat, swaying with its own momentum, inside a field of big soft out-of-focus discs. Bokeh drifts sideways in two
// depth planes (behind the cards slow/small, in front fast/large) and surges with every step; its hue is sampled from the
// current hero image (palette auto) and cross-fades to the next hero during the step. Seamless: integer drift periods,
// step offsets that vanish at every beat boundary, media cycled mod K.
const PAL = {
  warm: ['#ffb36b', '#ff7a59', '#ffd89a', '#ff9db0', '#ffc46b'],
  cool: ['#7fb7ff', '#8ef0ff', '#b49bff', '#6fe3c8', '#a9c8ff'],
};
export default {
  id: 'bokeh-cover-flow', name: 'Bokeh Cover Flow', category: 'particles', slots: 10,
  desc: 'Cover-flow row on a glossy floor stepping one card per beat inside drifting, image-tinted bokeh discs (front and back)',
  tags: ['particles', 'bokeh', 'coverflow', 'carousel', 'depth', 'step', 'cinematic', 'product'], ref: 'original',
  params: base({
    bokehCount: P.num('Bokeh count', 40, 8, 90),
    bokehSize: P.pct('Bokeh size', 100, 40, 220),
    palette: P.choice('Bokeh colour', 'auto', ['auto', 'warm', 'cool']),
    ease: P.choice('Easing', 'custom', EASINGS),
    drift: P.num('Bokeh drift (passes per loop)', 1, 1, 4),
  }),
  shadow: false, sheen: 0.12, depthWrite: false, duration: 12, background: '#06070b', defaultRatio: '16:9',
  camera(ctx) { const { u, M } = ctx; return { perspective: 30, x: Math.sin(u * M.TAU) * 0.015, y: 0.01 * Math.sin(u * 2 * M.TAU) }; },
  layout(ctx) {
    const { p, n, u, M } = ctx; const V = ctx.view, I = ctx.inner; const TAU = M.TAU;
    const K = Math.max(4, Math.min(12, n)); const ease = easeOf(p.ease); const MOVE = 0.48;
    const x = u * K, k0 = Math.floor(x), f = x - k0;
    const q = Math.min(1, f / MOVE), e = ease(q);
    const s = k0 + e; // centre index (cards travel right -> left)
    const vel = q >= 1 ? 0 : (ease(Math.min(1, q + 0.01)) - ease(Math.max(0, q - 0.01))) / (Math.min(1, q + 0.01) - Math.max(0, q - 0.01));
    const tp = (f - (MOVE - 0.02)) / 0.17; const pl = tp >= 0 && tp <= 1 ? Math.sin(Math.PI * tp) : 0; // landing bloom
    const sway = Math.max(-1.6, Math.min(1.6, vel)) / 1.6; // 0 at rest
    // ---- cards ----
    const portrait = I.w < I.h * 0.9;
    const ar = cardAR(ctx, portrait ? 0.68 : 0.78);
    const wide = I.w > I.h * 1.4;
    const w = portrait ? Math.min(I.w * 0.64, I.h * 0.66 * ar) : wide ? Math.min(I.w * 0.32, I.h * 0.78 * ar) : Math.min(I.w * 0.4, I.h * 0.66 * ar), h = w / ar;
    const y0 = h * 0.07 + 0.012;
    const floorY = y0 - h / 2 - 0.006;
    const tilt = M.rad(58);
    const d1 = w * (portrait ? 0.98 : 1.12), d2 = w * 0.3;
    const cards = [];
    const j0 = Math.round(s);
    const lim = Math.min(5, K / 2); // stack reach: never two copies of one media on screen
    for (let j = j0 - 5; j <= j0 + 5; j++) {
      const kk = j - s, a = Math.abs(kk), sg = Math.sign(kk) || 1, m = Math.min(1, a);
      const vis = Math.min(1, Math.max(0, lim - a));
      if (vis <= 0.002) continue;
      const off = a <= 1 ? kk * d1 : sg * (d1 + (a - 1) * d2);
      if (Math.abs(off) - w > V.w * 0.75) continue;
      const mm = m * m * (3 - 2 * m);
      const z = -mm * w * 0.85 - Math.max(0, a - 1) * 0.07 + (1 - m) * 0.04;
      const lift = (1 - m) * 0.012 * Math.abs(sway);
      const media = M.mod(M.mod(j, K), n);
      const c = { media, x: off, y: y0 + lift, z, ry: -sg * mm * tilt, rz: -sway * 0.03 * (1 - 0.5 * m), w, h,
        bright: 1 - 0.3 * mm, sat: 1 - 0.15 * mm };
      // direction-aware focus: incoming card sharpens late but fast, outgoing loses focus early -> always one sharp hero
      const sharp = kk > 0 ? 1 - Math.min(1, Math.max(0, (a - 0.5) / 0.35)) : 1 - Math.min(1, Math.max(0, (a - 0.4) / 0.2));
      // graded defocus: mip blur 1.5-4 reads blocky, so the near neighbour (slot +-1) is a blur-5 card with a faint sharp
      // ghost on top (image still legible, soft); the ghost fades out over a in [1,2] -> plain blur 5 beyond
      const nearW = a <= 1 ? 1 : Math.max(0, 2 - a);
      const so = sharp + (1 - sharp) * 0.35 * nearW; // sharp-layer opacity
      if (sharp < 1) {
        const b = { ...c, blur: 5, opacity: vis, layer: 0 };
        cards.push({ ...reflect(b, { floorY, opacity: 0.22 + 0.16 * sharp, fade: 0.5 }), layer: -1, opacity: (0.22 + 0.16 * sharp) * vis });
        cards.push(b);
      } else cards.push({ ...reflect(c, { floorY, opacity: 0.38, fade: 0.55 }), layer: -1, opacity: 0.38 * vis });
      if (so > 0.002) cards.push({ ...c, blur: 0, opacity: so * vis, layer: 1 });
    }
    // soft back glow behind the hero (tinted in warm/cool, neutral in auto)
    const glowC = PAL[p.palette] ? PAL[p.palette][0] : '#c8d4ff';
    cards.push({ light: { type: 'radial', stops: [[0, glowC, 1], [0.45, glowC, 0.35], [1, glowC, 0]] }, blend: 'add',
      x: 0, y: y0 * 0.6, z: -0.7, w: h * 3.2, h: h * 2.2, opacity: 0.16 * (1 + 0.15 * pl), layer: -3 });
    // ---- bokeh ----
    const cnt = Math.round(p.bokehCount), sz = p.bokehSize / 100, sp = Math.max(1, Math.round(p.drift));
    const D = ctx.camDist || 1.2;
    const hx = w / 2, hy0 = y0 - h / 2, hy1 = y0 + h / 2;
    const surge = s / K - u; // 0 at every beat boundary -> seamless extra push on each step
    const auto = p.palette !== 'warm' && p.palette !== 'cool';
    const pal = PAL[p.palette] || PAL.warm;
    const mA = M.mod(M.mod(k0, K), n), mB = M.mod(M.mod(k0 + 1, K), n);
    const plane = (front, wgt, mediaIdx, seed) => {
      const tall = Math.sqrt(Math.max(1, V.h / V.w)); // taller frames get more discs so the top/bottom bands stay alive
      const N = Math.round(front ? Math.max(3, cnt * 0.35) : cnt * 0.65 * tall);
      const g = { count: N, seed, shape: 'bokeh', blend: 'add', order: front ? undefined : -1,
        fn: (k, rnd) => {
          if (wgt <= 0.002) return null;
          const z = front ? 0.12 + rnd(1) * 0.38 : -1.6 + rnd(1) * 1.15;
          const size = front ? Math.min(0.18 * I.w, (0.13 + rnd(2) * 0.16) * sz) * (1 + 0.3 * pl) : (0.05 + rnd(2) * 0.09) * sz * 1.25 * (1 + 0.15 * pl);
          const half = (V.w / 2) * (D - z) / D + size; const halfY = 0.5 * (D - z) / D;
          const d = drift(k, u + surge * (front ? 0.55 : 0.22), { speed: front ? sp * 2 : sp, seed });
          const xx = (0.5 - d.x) * 2 * half;
          const yy = (d.y - 0.5) * 2 * halfY * 0.92 + Math.sin((u * (front ? 2 : 1) + rnd(3)) * TAU) * 0.02;
          const tw = 0.75 + 0.25 * Math.sin((u * 3 + rnd(4)) * TAU);
          let op = (front ? 0.2 * (1 + 0.6 * pl) : 0.5 * (1 + 0.15 * pl)) * (0.6 + 0.4 * rnd(5)) * tw * wgt;
          if (front) { // keep the hero clean: discs projected over the hero rect fade to <=0.08
            const pr = D / (D - z), sx = xx * pr, sy = yy * pr, r = size * pr * 0.5;
            const dx = Math.max(0, Math.abs(sx) - hx - r), dy = Math.max(0, hy0 - r - sy, sy - hy1 - r);
            const dd = Math.hypot(dx, dy), t = Math.min(1, dd / (0.06 + r));
            op = Math.min(op, 0.08 * wgt + (op - 0.08 * wgt) * t * t);
          }
          return { x: xx, y: yy, z, size, opacity: op, uvX: 0.1 + 0.8 * rnd(6), uvY: 0.1 + 0.8 * rnd(7),
            color: auto ? [1.8, 1.8, 1.8] : pal[(rnd(8) * pal.length) | 0] };
        } };
      if (auto) g.sampleMedia = mediaIdx;
      return g;
    };
    const particles = auto
      ? [plane(false, 1 - e, mA, 11), plane(false, e, mB, 11), plane(true, 1 - e, mA, 23), plane(true, e, mB, 23)]
      : [plane(false, 1, 0, 11), plane(true, 1, 0, 23)];
    return { cards, particles };
  },
};
