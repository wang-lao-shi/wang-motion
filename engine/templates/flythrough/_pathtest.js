import { base, P } from '../_common.js';
import { lookAlong, spline, splineTangent } from '../../lib.js';
// HIDDEN test template (underscore = not listed): X8 camera path + fog, and bold CJK glyphs.
//   wm still _pathtest --at 0.2,0.6 --res 400                 closed Catmull-Rom loop through a card field, fog, banking
//   wm still _pathtest --param mode=glyph --res 400           "上海 WANG MOTION 2026" at weight 800 vs 300 (vendored Noto Sans SC)
const PATH = [[0, 0, 3], [2.6, 0.25, 1.6], [2.2, -0.2, -1.8], [0, 0.3, -3.2], [-2.8, -0.1, -1.2], [-1.6, 0.2, 1.9]];
const N = 90;
export default {
  id: '_pathtest', name: 'Path Test', category: 'flythrough', slots: 6,
  desc: 'hidden: X8 camera path + fog test', tags: ['test'], ref: 'original',
  params: base({ mode: P.choice('Mode', 'path', ['path', 'glyph']), bank: P.num('Bank', 0.7, 0, 4, '', 0.1), fog: P.bool('Fog', true) }),
  shadow: false, depthWrite: true, defaultRatio: '16:9', duration: 12, background: '#0b0e16',
  camera(ctx) {
    if (ctx.p.mode === 'glyph') return {};
    const cam = lookAlong(PATH, ctx.u, 0.06, { bank: ctx.p.bank, tension: 0.5 });
    cam.fov = 58;
    if (ctx.p.fog) cam.fog = { near: 0.8, far: 4.5 };
    return cam;
  },
  layout(ctx) {
    const { M, inner } = ctx; const out = [];
    if (ctx.p.mode === 'glyph') {
      const rows = [['上海 WANG MOTION 2026', 800, '#ffffff'], ['上海 WANG MOTION 2026', 300, '#9fb4ff']];
      rows.forEach(([str, wt, color], r) => {
        const probe = ctx.glyphs(str, { h: 1, weight: wt, tracking: 0.03 });
        const h = Math.min(inner.h * 0.14, (inner.w * 0.94) / probe.width);
        const g = ctx.glyphs(str, { h, weight: wt, tracking: 0.03 });
        g.glyphs.forEach((q) => out.push({ text: q.ch, font: 'Inter', weight: wt, h, x: q.x, y: (r ? -1 : 1) * inner.h * 0.18 + q.y, color }));
      });
      return out;
    }
    // card field around the loop: each card sits off the path at a seeded lateral/vertical offset, facing back along the path
    for (let k = 0; k < N; k++) {
      const tk = (k + M.rand(k, 3) * 0.6) / N; const pp = spline(PATH, tk);
      const a = M.rand(k, 7) * M.TAU, rr = 0.35 + M.rand(k, 11) * 0.55;
      const x = pp[0] + Math.cos(a) * rr, y = pp[1] + Math.sin(a) * rr * 0.6, z = pp[2] + Math.sin(a * 1.7) * 0.35;
      const T = splineTangent(PATH, tk); const ry = Math.atan2(-T[0], -T[2]) + (M.rand(k, 13) - 0.5) * 0.6; // face the oncoming camera
      out.push({ media: k, x, y, z, ry, w: 0.34 + M.rand(k, 5) * 0.12, radius: 0.04, bright: 1 });
    }
    return out;
  },
};
