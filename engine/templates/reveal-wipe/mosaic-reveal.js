import { base, P, easeOf, EASINGS, CARD_RATIO_OPTS } from '../_common.js';
import { frameCard, frameRadiusMul } from './_frame.js';
// K steps per loop; in each step the next image appears tile by tile over the current one: a rows×cols mosaic of the
// next image pops in (each tile grows from its cell centre) in a staggered order, then the tiles merge seamlessly.
// Tiles are full-frame cards clipped by a rect mask, so the outer rounded corners stay intact and finished tiles leave no seams.
const ORDER = {
  normal: (r, c, R, C) => (r * C + c) / Math.max(1, R * C - 1),
  diagonal: (r, c, R, C) => (r + c) / Math.max(1, R + C - 2),
  radial: (r, c, R, C) => { const dy = r - (R - 1) / 2, dx = c - (C - 1) / 2, m = Math.hypot((R - 1) / 2, (C - 1) / 2) || 1; return Math.hypot(dx, dy) / m; },
};
function spiralRank(R, C) { // clockwise from top-left inward
  const rank = new Array(R * C); let t = 0, top = 0, bot = R - 1, l = 0, rt = C - 1;
  while (top <= bot && l <= rt) {
    for (let c = l; c <= rt; c++) rank[top * C + c] = t++;
    for (let r = top + 1; r <= bot; r++) rank[r * C + rt] = t++;
    if (top < bot) for (let c = rt - 1; c >= l; c--) rank[bot * C + c] = t++;
    if (l < rt) for (let r = bot - 1; r > top; r--) rank[r * C + l] = t++;
    top++; bot--; l++; rt--;
  }
  return rank;
}
export default {
  id: 'mosaic-reveal', name: 'Mosaic Reveal', category: 'reveal-wipe', slots: 4,
  desc: 'slideshow where each next image pops in as a staggered grid of tiles (or blinds) over the current one',
  tags: ['reveal', 'wipe', 'mosaic', 'tiles', 'grid', 'slideshow', 'transition'], ref: 'animos',
  params: base({
    rows: P.num('Rows', 4, 1, 12),
    columns: P.num('Columns', 4, 1, 12),
    stagger: P.pct('Stagger', 60),
    speedVariation: P.pct('Speed Variation', 0),
    ease: P.choice('Easing', 'custom', EASINGS),
    style: P.choice('Style', 'grid', ['grid', 'blinds']),
    pattern: P.choice('Pattern', 'normal', ['normal', 'diagonal', 'radial', 'spiral', 'random']),
    period: P.num('Cards per loop', 4, 2, 24),
    reveal: P.num('Reveal time', 49, 10, 100, '%'),
    cardRatio: P.choice('Card ratio', 'frame', ['frame', ...CARD_RATIO_OPTS]),
  }),
  shadow: true, shadowOpacity: 0.3, sheen: 0, rim: 0,
  duration: 8,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const K = Math.max(2, Math.round(p.period));
    const ez = easeOf(p.ease);
    const { w, h } = frameCard(ctx);
    // step j reveals image j over image j-1 (ref f0 shows the last image)
    const md = (j) => M.mod(M.mod(j, K), n);
    const s = u * K, j = Math.floor(s) % K, f = s - Math.floor(s);
    const blinds = p.style === 'blinds';
    const R = blinds ? 1 : Math.max(1, Math.round(p.rows)), C = Math.max(1, Math.round(p.columns));
    // ref (4 per 8s loop): reveal runs over 0.12 .. 0.12+reveal (49%: at step 1/8 three bottom-row tiles still growing) of each step; at f=.5 only the last bottom-row tiles are still growing
    // Stagger maps ×0.625 (animos 60% ≈ 37.5% effective): at 3/8 loop the ref's last bottom-row tiles are 0.97/0.87/0.71 of a cell (start a=.145 places them)
    const a = 0.145, T = Math.min(p.reveal / 100, 1 - a), S = M.clamp(p.stagger / 100 * 0.625, 0, 0.98), dur = T * (1 - S);
    const rm = frameRadiusMul(ctx, w, h); // frame-relative corners for every ratio (9:16 no longer near-square)
    const out = [{ media: md(j - 1), x: 0, y: 0, z: 0, w, h, layer: 0, radiusMul: rm }];
    if (f >= a + T) { out[0].media = md(j); return out; }
    if (f <= a) return out;
    const NT = R * C, spiral = p.pattern === 'spiral' ? spiralRank(R, C) : null;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const i = r * C + c;
      let o;
      if (spiral) o = spiral[i] / Math.max(1, NT - 1);
      else if (p.pattern === 'random') o = M.rand(i + 1, 7 + j * 13);
      else o = ORDER[p.pattern]?.(r, c, R, C) ?? ORDER.normal(r, c, R, C);
      const dv = 1 + (p.speedVariation / 100) * (M.rand(i, 31) - 0.5); // per-tile speed jitter
      const td = Math.min(dur * dv, T), t0 = a + o * (T - td);
      const raw = M.clamp((f - t0) / td), k = ez(raw);
      if (raw <= 0) continue;
      // cell in card uv (v up: row 0 is the top)
      const u0 = c / C, u1 = (c + 1) / C, v1 = 1 - r / R, v0 = 1 - (r + 1) / R;
      // as a tile completes its rect grows past the cell to overlap neighbours by > the soft mask ramp -> no seams
      // (a wide soft ramp also hides the derivative/LOD glitch next to the shader's discard edge)
      const e = 0.02 * M.clamp((k - 0.9) / 0.1);
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, hu = (u1 - u0) / 2 * k + e, hv = blinds ? 0.5 + e : (v1 - v0) / 2 * k + e;
      const rect = [cu - hu, cv - hv, cu + hu, cv + hv];
      out.push({ media: md(j), x: 0, y: 0, z: 0, w, h, layer: 1, shadow: 0, radiusMul: rm, // tiles fully opaque (ref has no fade)
        mask: { type: 'rect', rect, soft: 0.008 } });
    }
    return out;
  },
};
