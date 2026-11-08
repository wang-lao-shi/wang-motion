import { base, P } from '../_common.js';
import { E } from '../../lib.js';
// Pinterest-style masonry wall: columns of mixed-height cards scroll upward at slightly different
// speeds on a gently tilted plane. Each column scrolls exactly one of its own periods per loop
// (period = sum of its card heights + gaps), so u=0 and u=1 match. Cards rise into view at the
// bottom edge with a fade + scale-up.
const PERSPECTIVE = 24;                                   // camera perspective % (fov = 6 + p*1.6)
const ARS = [0.66, 0.75, 0.8, 1.0, 0.7, 1.25, 0.8, 0.62]; // portrait-leaning pin shapes (w/h), cover-cropped
const SPEED_PATTERN = [0.15, -0.85, 0.7, -0.35, 1.0, -0.6];
const STAGGER = [0, 0.62, 0.1, 0.78, 0.22, 0.95];          // start offsets (× mean card height), neighbours ≥0.5 apart
const OVERSCAN = 1.05;
const SPEED_BIAS = 0.45;                                 // lean toward taller (faster) columns: fewer tiny cards, fewer repeats

// Per-column media sequences: each column cycles ≥3 distinct items (when n allows), never shares an item with
// its left neighbour, and reused items go to the least-used / farthest column so duplicates sit far apart.
function columnMedia(n, C, Ls) {
  const used = new Array(n).fill(0), where = Array.from({ length: n }, () => []);
  const cols = [];
  for (let c = 0; c < C; c++) {
    const seq = [], prev = c > 0 ? cols[c - 1] : [], L = Ls[c];
    for (let k = 0; k < L; k++) {
      let best = -1, bs = Infinity;
      for (let i = 0; i < n; i++) {
        const m = (c + k * C + i) % n;
        if (seq.includes(m)) continue;
        const dist = where[m].length ? Math.min(...where[m].map((cc) => Math.abs(cc - c))) : 9;
        const sc = used[m] * 100 + (prev.includes(m) ? 50 : 0) - dist * 10 + i * 0.001;
        if (sc < bs) { bs = sc; best = m; }
      }
      seq.push(best); used[best]++; where[best].push(c);
    }
    cols.push(seq);
  }
  return cols;
}
export default {
  id: 'masonry-scroll', name: 'Masonry Scroll', category: 'grid', slots: 12,
  desc: 'Dense Pinterest masonry wall of mixed-height cards scrolling up on a tilted plane, every column drifting at its own clearly different speed, new pins fading in at the bottom',
  tags: ['grid', 'masonry', 'pinterest', 'scroll', 'columns', 'feed', 'loop', 'parallax'], ref: 'original',
  params: base({
    padding: P.padding(3),
    columns: P.choice('Columns', 'auto', ['auto', '2', '3', '4', '5', '6']),
    speedVar: P.pct('Column speed contrast', 45, 0, 60),
    gap: P.pct('Gap', 2.2, 0, 8),
    tilt: P.deg('Tilt', 16, 0, 30),
  }),
  shadow: true, shadowOpacity: 0.32, sheen: 0.05,
  duration: 20,
  camera() { return { perspective: PERSPECTIVE }; },
  layout(ctx) {
    const { p, n, u, M, inner: I, view: V } = ctx;
    const a = ctx.aspect;
    const C = p.columns === 'auto' || !p.columns
      ? (a < 0.75 ? 3 : a < 1.4 ? 4 : 5)
      : Math.max(2, Math.min(6, Math.round(+p.columns)));
    const g = (p.gap / 100) * Math.min(1, a) * 1.0;
    const tilt = M.rad(p.tilt);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const D = ctx.camDist || 0.5 / Math.tan(M.rad(6 + PERSPECTIVE * 1.6) / 2);
    // wall-plane extent that projects onto the frame (plane tilted back about x through the origin)
    const Ytop = 0.5 * D / (D * ct - 0.5 * st);
    const Ybot = -0.5 * D / (D * ct + 0.5 * st);
    // fit the wall to the widest needed edge (the far, top edge) plus overscan, so columns bleed off both sides
    const Wall = V.w * (D + Math.max(0, Ytop * st)) / D * OVERSCAN;

    const cw = (Wall - g * (C - 1)) / C;
    const span = Ytop - Ybot;
    const out = [];
    const hMean = cw / 0.8;
    const span0 = Ytop - Ybot;
    // per-column cycle length: at least as many distinct items as the column can show at once (+1)
    const Ls = [];
    for (let c = 0; c < C; c++) {
      const fe = Math.max(0.3, 1 + (p.speedVar / 100) * 0.8 * (SPEED_PATTERN[c % SPEED_PATTERN.length] * (C === 2 ? 0.8 : 1) + SPEED_BIAS));
      const need = Math.ceil(span0 / (hMean * fe + g)) + 1;
      Ls.push(Math.min(n, Math.max(3, Math.ceil(n / C), need)));
    }
    // over budget (more slots than media): trim the safety margin first, so repeats stay rare and far apart
    const Lmin = Math.min(n, Math.max(3, Math.ceil(n / C)));
    for (let t = 0; t < 2 * C && Ls.reduce((s0, v) => s0 + v, 0) > n; t++) {
      const i = Ls.indexOf(Math.max(...Ls));
      if (Ls[i] <= Lmin) break;
      Ls[i]--;
    }
    const colSeqs = columnMedia(n, C, Ls);
    for (let c = 0; c < C; c++) {
      // media: disjoint per-column sets when there are enough items (no image twice on screen)
      const seq = colSeqs[c];
      const S = seq.length;
      // raw heights for one repeat of the set
      const raw = (j) => cw / ARS[Math.floor(M.rand(c * 37 + (j % S) * 5 + 3, 11) * ARS.length)];
      let rep = 1, sum = 0;
      for (;;) { sum = 0; for (let j = 0; j < S * rep; j++) sum += raw(j) + g; if (sum >= span * 1.25 || rep > 8) break; rep++; }
      const Q = S * rep;
      // column period: base period scaled for speed variation (heights absorb the scale, cover-crop keeps media correct)
      const vc = SPEED_PATTERN[c % SPEED_PATTERN.length] * (C === 2 ? 0.8 : 1);
      const Pc = sum * (1 + (p.speedVar / 100) * 0.8 * (vc + SPEED_BIAS));
      const f = (Pc - Q * g) / (sum - Q * g);
      const hs = [], cum = [];
      let acc = 0;
      for (let j = 0; j < Q; j++) { const h = raw(j) * f; hs.push(h); cum.push(acc); acc += h + g; }
      const x = -Wall / 2 + cw / 2 + c * (cw + g);
      const off = (STAGGER[c % STAGGER.length] + 0.12 * M.rand(c, 23)) * hMean;   // masonry stagger between columns
      const shift = u * Pc + off;                        // scroll up one period per loop
      // copies k so that cards cover [Ybot - max, Ytop + max]
      for (let k = -2; k <= Math.ceil(span / Pc) + 2; k++) {
        for (let j = 0; j < Q; j++) {
          const h = hs[j];
          const Y = Ytop - cum[j] - h / 2 - k * Pc + shift - Pc;  // centre on the wall plane
          if (Y - h / 2 > Ytop + 0.02 || Y + h / 2 < Ybot) continue;
          // entering at the bottom edge: progress as its top edge rises 35% of its height into frame
          const eRaw = M.clamp((Y + h / 2 - Ybot) / Math.max(0.05, h * 0.35));
          if (eRaw <= 0.001) continue;
          const e = E.outCubic(eRaw);
          const s = 0.88 + 0.12 * e;
          const lift = (1 - e) * 0.04;
          out.push({
            media: seq[j % S], x,
            y: (Y - (1 - e) * 0.03) * ct, z: -(Y) * st + lift,
            rx: -tilt, w: cw, h, s,
            opacity: e, bright: (0.55 + 0.45 * e) * (1 - 0.14 * M.clamp(Y / Ytop)),
            shadow: 0.32 * e,
            layer: 0,
          });
        }
      }
    }
    return out;
  },
};
