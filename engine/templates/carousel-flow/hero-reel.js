import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
// A row of thumbnails over a dimmed full-frame hero: each beat the next thumbnail lifts and the hero
// changes with a blocky wipe (squares of the next image grow in row by row, left to right within each row).
export default {
  id: 'hero-reel', name: 'Hero Reel', category: 'carousel-flow', slots: 7,
  desc: 'Thumbnail row over a dimmed hero; active thumb lifts, hero swaps with a block wipe',
  tags: ['reel', 'hero', 'thumbnails', 'step', 'wipe', 'background'], ref: 'animos',
  params: base({
    activeLift: P.num('Active lift', 1.8, 0, 6, '', 0.1),
    activeScale: P.pct('Active scale', 108, 50, 200),
    cardSpacing: P.num('Card spacing', 2.0, 0, 6, '', 0.1),
    heroOpacity: P.pct('Hero opacity', 55),
    kenBurns: P.pct('Ken Burns', 60),
    hold: P.pct('Hold', 55, 0, 95),
    ease: P.choice('Easing', 'custom', EASINGS),
    backgroundWipe: P.bool('Background wipe', true),
    shadow: P.bool('Shadow', true),
    thumbSize: P.pct('Thumb size', 10.5, 3, 30),
    wipeCells: P.num('Wipe cells', 4, 2, 16),
    loopCards: P.num('Cards per loop', 7, 2, 16),
  }),
  shadow: true, shadowOpacity: 0.45, sheen: 0.06,
  duration: 10,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const V = ctx.view;
    const K = Math.max(2, Math.round(p.loopCards));
    const x = u * K; const k = Math.floor(x); const fr = x - k;
    const hold = Math.min(0.95, p.hold / 100);
    const tr = Math.max(0, (fr - hold) / (1 - hold));      // 0..1 transition into k+1
    const e = easeOf(p.ease)(tr);
    const dim = p.heroOpacity / 100 * 0.7;    // matches animos background level at the default 55%
    const flat = { sat: 0.88, radius: 0, shadow: 0, sheen: 0, rim: 0, edgeX: 0, edgeTop: 0, edgeBottom: 0 };
    const kb = p.kenBurns / 100;
    const out = [];
    const heroOf = (j, age) => ({ media: M.mod(M.mod(j, K), n), x: 0, y: 0, w: V.w, h: V.h, ...flat, bright: dim, zoom: 1.05 + 0.12 * kb * M.clamp(age), layer: -10 });
    // hero: current (k), with next growing in as blocks
    const ageCur = (x - (k - 1 + hold)) / (2 - hold), ageNext = (x - (k + hold)) / (2 - hold);
    out.push(heroOf(k, ageCur));
    if (tr > 0) {
      if (!p.backgroundWipe) out.push({ ...heroOf(k + 1, ageNext), opacity: e, layer: -9 });
      else {
        const C = Math.max(2, Math.round(p.wipeCells));
        const cs = Math.max(V.w, V.h) / C;
        const cols = Math.ceil(V.w / cs), rows = Math.ceil(V.h / cs);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const st = (r / rows) * 0.6 + c * 0.06;    // rows top->bottom, columns left->right
          const g = easeOf('smooth')(M.clamp((tr - st) / 0.35));
          if (g <= 0.001) continue;
          const x0 = -V.w / 2 + c * cs, y0 = 0.5 - (r + 1) * cs;
          const sz = cs * g;
          const s = sz + 0.004 * g;
          const cx = x0 + cs / 2, cy = y0 + cs / 2;
          const ux0 = (cx - s / 2 + V.w / 2) / V.w, ux1 = (cx + s / 2 + V.w / 2) / V.w;
          const vy0 = (cy - s / 2 + 0.5), vy1 = (cy + s / 2 + 0.5);
          out.push({ media: M.mod(M.mod(k + 1, K), n), x: cx, y: cy, w: s, h: s, uv: [ux0, vy0, ux1, vy1], fullAspect: V.w,
            ...flat, bright: dim, zoom: 1.05 + 0.12 * kb * M.clamp(ageNext), layer: -9 });
        }
      }
    }
    // thumbnails
    const ar = cardAR(ctx, 1.0);
    const tw0 = (p.thumbSize / 100) * 1.05;
    const sp0 = tw0 * (1 + p.cardSpacing * 0.11);
    const fitS = Math.min(1, (I.w) / (sp0 * K));
    const tw = tw0 * fitS, sp = sp0 * fitS, th = tw / ar;
    const lift = p.activeLift * 0.011 * fitS;
    for (let j = 0; j < K; j++) {
      const a = j === k % K ? 1 - e : (j === (k + 1) % K ? e : 0);
      const sc = 1 + (p.activeScale / 100 - 1) * a;
      out.push({ media: M.mod(j, n), x: (j - (K - 1) / 2) * sp, y: lift * a, z: 0.001 * a, w: tw * sc, h: th * sc, layer: 1 + a });
    }
    return out;
  },
};
