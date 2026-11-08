import { base, P } from '../_common.js';
// HIDDEN test template (underscore = not listed): X1 glyph text cards.
//   wm still _glyphtest --res 400 --at 0.3            (16:9 / --ratio 9:16)
//   --param mode=big   -> one giant 'Ag' + outline 'R' + split 'W' (edge crispness / uv sub-rect check)
// Rows: per-glyph "WANG MOTION" (filled white, staggered rise), outlined line, mediaFill screen-space title, CJK "上海 2026".
export default {
  id: '_glyphtest', name: 'Glyph Test', category: 'kinetic-type', slots: 3,
  desc: 'hidden: X1 glyph text card test', tags: ['test'], ref: 'original',
  params: base({ mode: P.choice('Mode', 'all', ['all', 'big']) }),
  shadow: false, defaultRatio: '16:9', duration: 6, background: '#101014',
  layout(ctx) {
    const { u, M, inner } = ctx; const out = [];
    const rise = (k, n) => { const t = M.clamp(u * 3 - (k / n) * 0.6, 0, 1); return 1 - Math.pow(1 - t, 3); };
    if (ctx.p.mode === 'big') {
      const h = inner.h * 0.42;
      out.push({ text: 'Ag', font: 'Inter', weight: 800, h, x: -inner.w * 0.18, y: 0.05, color: '#ffffff' });
      out.push({ text: 'R', font: 'Inter', weight: 800, h: h * 0.8, x: inner.w * 0.2, y: 0.05, outline: 0.04, color: '#ffcc66', ry: 0.5 });
      // split 'W': bottom half and top half on separate cards, pulled apart
      out.push({ text: 'W', weight: 900, h: h * 0.5, x: inner.w * 0.38, y: -0.02, uv: [0, 0, 1, 0.5], color: '#6cf' });
      out.push({ text: 'W', weight: 900, h: h * 0.5, x: inner.w * 0.38 + 0.03, y: 0.03, uv: [0, 0.5, 1, 1], color: '#6cf' });
      return out;
    }
    // fit: widest row ("WANG MOTION" at h=1) must fit inner.w
    const probe = ctx.glyphs('WANG MOTION', { h: 1, weight: 800, tracking: 0.05 });
    const h = Math.min(inner.h * 0.11, (inner.w * 0.92) / probe.width);
    const rows = [1.9, 0.63, -0.63, -1.9].map((r) => r * h * 1.45 * (ctx.isPortrait ? 1.25 : 1));
    // 1) per-glyph filled white, staggered rise
    const g1 = ctx.glyphs('WANG MOTION', { h, weight: 800, tracking: 0.05 });
    g1.glyphs.forEach((g) => { const e = rise(g.i, g1.glyphs.length);
      out.push({ text: g.ch, weight: 800, h, x: g.x, y: rows[0] + g.y - (1 - e) * h * 0.8, opacity: e, color: '#ffffff', rz: (1 - e) * 0.3 }); });
    // 2) outlined line (word cards)
    const g2 = ctx.glyphs('OUTLINE TYPE', { h: h * 0.8, weight: 700, tracking: 0.08 });
    g2.glyphs.forEach((g) => out.push({ text: g.ch, weight: 700, h: h * 0.8, x: g.x, y: rows[1] + g.y, outline: 0.05, color: '#ffcc66', ry: Math.sin(u * M.TAU + g.i * 0.4) * 0.4 }));
    // 3) mediaFill screen-space: letters are windows onto one continuous image
    const g3 = ctx.glyphs('IMAGE', { h: h * 1.5, weight: 900 });
    g3.glyphs.forEach((g) => out.push({ text: g.ch, weight: 900, h: h * 1.5, x: g.x, y: rows[2] + g.y + Math.sin(u * M.TAU + g.i) * h * 0.1, mediaFill: 1, fillUv: 'screen', zoom: 1.1, panX: (u - 0.5) * 0.05 }));
    // 4) CJK + digits
    const g4 = ctx.glyphs('上海 2026', { h, weight: 700, tracking: 0.04 });
    g4.glyphs.forEach((g) => out.push({ text: g.ch, weight: 700, h, x: g.x, y: rows[3] + g.y, color: g.ch.match(/\d/) ? '#7fd1ff' : '#ffffff', rx: Math.sin(u * M.TAU + g.i * 0.6) * 0.5 }));
    return out;
  },
};
