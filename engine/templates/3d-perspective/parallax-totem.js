import { base, P, cardAR, latticeMedia, curvePoint } from '../_common.js';
// Loose columns of cards of varied size drifting vertically on a gently concave cylinder; bigger cards are nearer and move faster.
export default {
  id: 'parallax-totem', name: 'Parallax Totem', category: '3d-perspective', slots: 8,
  desc: 'Scattered cards of mixed sizes drifting up a concave totem with parallax depth',
  tags: ['totem', 'parallax', 'scatter', 'vertical', '3d'], ref: 'animos',
  params: base({
    zoom: P.pct('Zoom', 50, 0, 100),
    scatter: P.pct('Scatter', 70),
    sizeVariation: P.pct('Size variation', 30),
    parallaxDepth: P.pct('Parallax depth', 50),
    padding: P.padding(13),
    cornerRadius: P.cornerRadius(0.5),
    curvature: P.num('Curvature (concave ⟷ convex)', -100, -100, 100, '%'),
    gap: P.num('Gap', 6.75, 0, 20, '%', 0.25),
    edgeFade: P.pct('Edge fade', 0),
    cardRatio: P.cardRatio(),
    direction: P.choice('Direction', 'up', ['up', 'down']),
    period: P.num('Cards per column', 6, 3, 16),
    columns: P.num('Columns', 3, 1, 8),
    speed: P.speed(1),
  }),
  shadow: false, sheen: 0.15, edgeX: 0.85, edgeW: 0.003,
  duration: 20,
  camera() { return { perspective: 6 }; },
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const V = ctx.view;
    const zs = 0.5 + p.zoom / 100;                 // 50% -> 1
    const cw = 0.385 * zs * Math.min(1, V.w ** 0.8), ar = cardAR(ctx, 1.75), ch = cw / ar;
    const pitchY = (ch * 0.85 + (p.gap / 100) * zs) * 1.15;
    const per = Math.max(1, Math.round(p.period));
    const cols = Math.max(1, Math.round(p.columns * 1.34 * V.w ** 0.8));
    const colPitch = V.w * 1.25 / cols;   // ~3.5 visible columns at 1:1, outer ones half off-frame
    const dir = p.direction === 'down' ? -1 : 1;
    const c = p.curvature / 100, k = 0.7 * Math.abs(c), sgn = c < 0 ? 1 : -1;
    const out = [];
    for (let ci = 0; ci < cols; ci++) for (let j = 0; j < per; j++) {
      const id = ci * 37 + j;
      // size: biggest = 1, smallest ≈ 0.6 at the default 30% variation (far cards small, slightly dim, slow)
      const sv = Math.min(0.85, (p.sizeVariation / 100) * 2.1);   // 30% -> smallest ≈ 0.37 of largest
      const sr = M.rand(id, 3);
      const sf = 1 - sv * sr;
      const f = 1 + (sv > 1e-3 ? (p.parallaxDepth / 50) * 0.231 * (sf - (1 - sv / 2)) / (sv / 2) : 0);   // near ≈ 1.6× far speed at 50%
      const H = per * pitchY * f;                                    // this card's own wrap period
      const y0 = (j + (ci * 0.37) % 1 + (p.scatter / 100) * (M.rand(id, 5) - 0.5) * 0.5) * pitchY * f;
      const yy = M.mod(y0 + dir * u * H * p.speed, H) - H / 2;
      const X = (ci - (cols - 1) / 2) * colPitch + (p.scatter / 100) * (M.rand(id, 7) - 0.5) * colPitch * 0.95;
      const w = cw * sf, h = ch * sf;
      if (Math.abs(yy) > V.h / 2 + h) continue;
      const q = curvePoint(X, yy, k, 0, sgn);
      const ed = Math.abs(X) / (V.w * 0.5);
      out.push({ media: latticeMedia(j, ci, n, per, 3), x: q.x, y: q.y, z: q.z * 0.2 + (sf - 1) * 0.08, bright: 1 - 0.6 * (1 - sf), ry: q.ry, w, h, bend: q.bend * 3,
        opacity: 1 - (p.edgeFade / 100) * M.smooth(0.4, 1.0, ed) });
    }
    return out;
  },
};
