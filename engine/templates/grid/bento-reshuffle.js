import { base, P, EASINGS, easeOf } from '../_common.js';
// Bento Reshuffle (original): Apple-style bento grid of six cells with mixed spans on a 4x3 unit grid.
// Every beat the cells re-flow into the next bento configuration (the sequence plays twice per loop).
// Every moving edge is a shared divider; the side giving space leads, the side taking space trails by a short
// lag (never more than one gap, never ahead) -> zero overlap, the gap at most doubles for an instant.
// Growing cells draw above shrinking ones. Moving cells are picked up (+<half a gap per side, <=4 deg tilt toward travel, deeper
// shadow) and settled; while lifted, two cells per beat (0.1 beat apart) wipe to a new image along their travel
// direction -> all 12 images per loop with 12 media. Settled cells are state-independent (layer 1, base shadow),
// so the loop seam is exact. Rects: [col, row, colSpan, rowSpan] (transposed 3 x 4 for portrait).
// Found by exhaustive search over all 6-cell bento tilings of the 4x3 grid: every transition used (0>1>2>3>0,
// plus 2>0 for 3 layouts and 1>0 for 2) stays an exact tiling under a common interpolation, i.e. every moving
// edge is a divider shared by the cells on both sides -> no overlap and no holes by construction.
const CONFIGS = [
  [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 2, 1], [0, 1, 1, 2], [1, 1, 1, 2], [2, 1, 2, 2]],
  [[0, 0, 1, 2], [1, 0, 1, 2], [2, 0, 2, 2], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 2, 1]],
  [[0, 0, 1, 1], [1, 0, 2, 1], [3, 0, 1, 1], [0, 1, 1, 2], [1, 1, 2, 2], [3, 1, 1, 2]],
  [[0, 0, 1, 2], [1, 0, 2, 2], [3, 0, 1, 2], [0, 2, 1, 1], [1, 2, 2, 1], [3, 2, 1, 1]],
];
const SPRINGS = { spring: (t) => 1 - Math.cos(t * Math.PI * 2.5) * Math.exp(-t * 5.5), soft: (t) => 1 - Math.cos(t * Math.PI * 1.5) * Math.exp(-t * 4.2) };
const BASE_SHADOW = 0.22;

export default {
  id: 'bento-reshuffle', name: 'Bento Reshuffle', category: 'grid', slots: 12,
  desc: 'Apple-style bento grid whose mixed-size cells lift, wipe to new images and re-flow gap-free into a new layout every beat',
  tags: ['bento', 'grid', 'apple', 'layout', 'reflow', 'wipe', 'step', 'product'], ref: 'original',
  params: base({
    configs: P.num('Layouts', 4, 2, 4),
    gap: P.pct('Gap', 2.2, 0, 8),
    spring: P.choice('Easing', 'soft', ['spring', 'soft', ...EASINGS]),
    tempo: P.pct('Tempo', 50, 0, 100),
    lift: P.pct('Lift', 80, 0, 100),
    kenBurns: P.pct('Ken Burns', 40, 0, 100),
  }),
  shadow: true, shadowOpacity: 0.45, sheen: 0.08,
  duration: 14,
  layout(ctx) {
    const { p, u, n, M, inner: I } = ctx;
    const portrait = I.w < I.h * 0.92;
    const COLS = portrait ? 3 : 4, ROWS = portrait ? 4 : 3;
    const g = (p.gap / 100) * Math.min(I.w, I.h) * 0.9;
    const uw = (I.w - g * (COLS - 1)) / COLS, uh = (I.h - g * (ROWS - 1)) / ROWS;
    const ease = SPRINGS[p.spring] || easeOf(p.spring);
    const K = Math.round(M.clamp(p.configs, 2, 4));
    const NB = 2 * K;                                    // beats per loop (layout sequence plays twice)
    const edges = (cfg, i) => {
      let [c, r, cs, rs] = CONFIGS[cfg][i];
      if (portrait) [c, r, cs, rs] = [r, c, rs, cs];
      const l = -I.w / 2 + c * (uw + g), t = I.h / 2 - r * (uh + g);
      return { l, r: l + cs * uw + (cs - 1) * g, t, b: t - rs * uh - (rs - 1) * g, area: cs * rs };
    };
    const x = M.mod(u, 1) * NB, k = Math.floor(x), f = x - k;
    const from = M.mod(k, K), to = M.mod(k + 1, K);
    // Tempo: one knob for move length + lift stagger (higher = snappier moves, longer holds)
    const tp = M.clamp(p.tempo / 100, 0, 1);
    const mv = 0.8 - 0.4 * tp;                          // share of the beat a reflow takes (0.8 .. 0.4)
    const st = 0.012 * mv;                              // per-cell lift delay
    const lag = 0.1;                                    // taking edges trail giving edges by 10% of a move
    const mh = mv / (1 + lag);                          // one edge move
    const span = mv + 5 * st;                           // a cell's whole pick-up (incl. stagger)
    // image swaps: 2 events per beat; event e (beat floor(e/2)) swaps cell mod(mod(e,NB),6). Events e and e+NB
    // hit the same cell, so each cell swaps an even number of times per loop -> exact seam.
    const evCell = (e) => M.mod(M.mod(e, NB), 6);
    const parityBefore = (i) => { let s = 0; for (let e = 0; e < 2 * k; e++) if (evCell(e) === i) s++; return s % 2; };
    const A = [], B = [];
    for (let i = 0; i < 6; i++) { A.push(edges(from, i)); B.push(edges(to, i)); }
    // lift order: cells giving the most area are picked up first, growers follow
    const rank = [0, 1, 2, 3, 4, 5].sort((a, b) => (B[a].area - A[a].area) - (B[b].area - A[b].area) || a - b);
    const kb = p.kenBurns / 100;
    // every moving edge is a shared divider: the side giving space leads (ei), the side taking space trails by
    // `lag` but never by more than one gap width and never gets ahead (also through easing overshoot)
    const ei = ease(M.clamp(f / mh)), eLag = ease(M.clamp((f - lag * mh) / mh));
    const gpad = g;
    const ed = (va, vb, outward) => {
      if (!outward || va === vb) return M.lerp(va, vb, ei);
      const tr = Math.abs(vb - va);
      return M.lerp(va, vb, Math.min(ei, Math.max(eLag, ei - gpad / tr)));
    };
    const out = [];
    for (let i = 0; i < 6; i++) {
      const a = A[i], b = B[i];
      const d0 = rank.indexOf(i) * st;
      const L = ed(a.l, b.l, b.l < a.l), R = ed(a.r, b.r, b.r > a.r), T = ed(a.t, b.t, b.t > a.t), Bo = ed(a.b, b.b, b.b < a.b);
      const moves = a.l !== b.l || a.r !== b.r || a.t !== b.t || a.b !== b.b;
      const j = evCell(2 * k) === i ? 0 : evCell(2 * k + 1) === i ? 1 : -1;     // swap slot this beat
      const sw = j >= 0;
      const lt = M.clamp((f - d0) / span);
      const settled = lt <= 0 || lt >= 1;
      const arch = Math.sin(Math.PI * lt);
      const grow = b.area > a.area ? 0.8 : b.area === a.area ? 0.9 : 1;
      const act = settled ? 0 : arch * (moves || sw ? 1 : 0) * Math.max(grow, sw ? 0.8 : 0);   // 0..1 pick-up
      const lift = (p.lift / 100) * act;
      const dx = (b.l + b.r - a.l - a.r) / 2, dy = (b.t + b.b - a.t - a.b) / 2, dl = Math.hypot(dx, dy);
      const tilt = M.rad(4) * lift;
      const growPx = 0.7 * g * lift;                  // pick-up growth: < half a gap per side, never covers a neighbour
      const w = Math.max(0.01, R - L) + growPx, h = Math.max(0.01, T - Bo) + growPx;
      const par = parityBefore(i);
      const m0 = M.mod(i + 6 * par, n), m1 = M.mod(i + 6 * (1 - par), n);
      // growers on top, shrinkers below; settled cells are all layer 1 (state-independent -> exact seam)
      const layer = settled ? 1 : b.area > a.area ? 7 : b.area === a.area ? 5 : 3;
      const card = {
        x: (L + R) / 2, y: (T + Bo) / 2, z: 0.012 * lift, w, h,
        ry: dl ? (dx / dl) * tilt : 0, rx: dl ? -(dy / dl) * tilt : 0,
        zoom: 1.06 + 0.05 * kb * (0.5 + 0.5 * Math.sin(M.TAU * u + i * 1.7)) + 0.03 * lift,
        panX: 0.04 * kb * Math.sin(M.TAU * u + i), panY: 0.03 * kb * Math.cos(M.TAU * u + i * 2.3),
        shadow: settled ? BASE_SHADOW : BASE_SHADOW + 0.38 * act * Math.min(1, p.lift / 40),
        sheen: 0.08 + 0.18 * lift, bright: 1 + 0.04 * lift,
      };
      // one-edge wipe at the top of the lift, along the travel direction; slot 1 runs 0.1 beat after slot 0
      const w0 = 2.5 * st + 0.4 * span + (j - 0.5) * 0.1, wl = 0.2 * span;
      const wp = sw && m0 !== m1 ? M.clamp((f - w0) / wl) : 0;
      if (wp < 1) out.push({ ...card, media: m0, layer });
      if (wp > 0) {
        const soft = 0.015, q = E3(wp);
        const ang = dl ? Math.atan2(dy, dx) : 0;
        out.push({ ...card, media: m1, layer: settled ? 1 : layer + 1, ...(q < 1 ? { mask: { type: 'line', angle: ang, p: -soft + q * (1 + 2 * soft), soft }, shadow: 0 } : {}) });
      }
    }
    return out;
  },
};
function E3(t) { return t * t * (3 - 2 * t); }
