import { base, P } from '../_common.js';
import { E } from '../../lib.js';
// HIDDEN test template for X9 slab thickness.
//   wm still _thicktest --res 400 --at 0.3
//   cells: 1 auto side colour (edge-sampled media) | 2 flat sideColor + back 'side' | 3 back = media (turns around)
//          4 flat colour block (iso tile) | 5 bent card + thickness | 6 glyph slab
//   --param mode=domino   a row of thick tiles toppling (rx) with shadows ; --param dw=true  z-buffer path
export default {
  id: '_thicktest', name: 'Thickness Test', category: 'grid', slots: 12,
  desc: 'hidden: X9 slab thickness test', tags: ['test'], ref: 'original',
  params: base({ mode: P.choice('Mode', 'all', ['all', 'domino']), dw: P.choice('Depth write', 'false', ['false', 'true']), depth: P.pct('Depth', 4, 0, 30) }),
  shadow: true, shadowOpacity: 0.45, duration: 8, background: '#1a1a20',
  camera() { return { perspective: 30 }; },
  layout(ctx) {
    const { u, n, M, p } = ctx; const dw = p.dw === 'true' ? true : undefined; const T = p.depth / 100;
    if (p.mode === 'domino') {
      const K = 7, w = ctx.inner.w / (K + 1.5), out = [];
      for (let k = 0; k < K; k++) {
        const f = E.inOutCubic(M.clamp(u * 2.2 - k * 0.14, 0, 1)); const a = -f * Math.PI * 0.47;
        // pivot at the bottom-front edge: centre moves with the rotation
        const hh = w * 1.6 / 2; const y = -0.15 + Math.cos(a) * hh, z = Math.sin(-a) * hh;
        out.push({ media: M.mod(k, n), x: (k - (K - 1) / 2) * w * 1.15, y, z, w, h: w * 1.6, rx: a, thickness: w * 0.25, depthWrite: dw, back: 'media', mirrorBack: 'unmirror' });
      }
      return out;
    }
    const cols = 3, rows = 2, cw = ctx.inner.w / cols, ch = ctx.inner.h / rows; const out = [];
    const spin = Math.sin(u * M.TAU);
    for (let i = 0; i < 6; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = -ctx.inner.w / 2 + cw * (col + 0.5), y = ctx.inner.h / 2 - ch * (row + 0.5);
      const w = Math.min(cw, ch * 1.33) * 0.62, th = Math.max(0.002, T * w * 4);
      const c = { media: M.mod(i, n), x, y, w, h: w * 0.75, ry: 0.7 * spin + 0.25, rx: -0.35, rz: 0.08, thickness: th, depthWrite: dw };
      if (i === 1) Object.assign(c, { sideColor: '#ff3d6e', back: 'side', sideSpec: 0.4 });
      if (i === 2) Object.assign(c, { ry: Math.PI * 0.75 + 0.6 * spin, back: 'media', mirrorBack: 'unmirror' });
      if (i === 3) Object.assign(c, { useMedia: false, color: '#4d7cff', w: w * 0.7, h: w * 0.7, rx: -0.6, ry: 0.78 + spin * 0.4, rz: 0, thickness: w * 0.7, radius: 0.02 });
      if (i === 4) Object.assign(c, { bend: 1.6, thickness: th * 1.5 });
      if (i === 5) { out.push({ text: 'W', h: w * 0.6, weight: 900, color: '#ffd166', x, y, ry: 0.6 * spin + 0.3, rx: -0.3, thickness: w * 0.14, sideColor: '#a8742a', depthWrite: dw }); continue; }
      out.push(c);
    }
    return out;
  },
};
