import { base, P, EASINGS, easeOf } from '../_common.js';
import { cells, shape } from './_grid.js';
// Grid whose cells flip over one after another, revealing the next image on the back.
export default {
  id: 'flip-grid', name: 'Flip Grid', category: 'grid', slots: 8,
  desc: 'Grid cells flip in sequence to reveal new images',
  tags: ['grid', 'flip', '3d', 'sequence', 'swap'], ref: 'animos',
  params: base({
    gap: P.pct('Gap', 3, 0, 20),
    ease: P.choice('Easing', 'custom', EASINGS),
    flipAxis: P.choice('Flip axis', 'horizontal', ['horizontal', 'vertical']),
    shadow: P.bool('Shadow', true),
    cells: P.num('Cells', 4, 1, 16),
    flipPortion: P.pct('Flip portion', 70, 10, 100),
    perspective: P.perspective(30),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.06,
  duration: 8,
  camera(ctx) { return { perspective: ctx.p.perspective }; },
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const k = Math.max(1, Math.round(p.cells));
    const [cols, rows] = shape(ctx, k);
    const list = cells(ctx, cols, rows, p.gap).slice(0, k);
    const steps = 2 * k;                          // each cell flips twice per loop: image i -> i+k -> i
    const x = u * steps; const s = Math.floor(x); const f = x - s;
    const ease = easeOf(p.ease);
    const pf = Math.max(0.1, p.flipPortion / 100);
    const out = [];
    for (const c of list) {
      // number of completed flips of this cell before step s, and current progress
      const done = Math.floor((s - c.i) / k) + 1;          // flips completed up to and including step s (if at end)
      const active = M.mod(s, k) === c.i;
      const prog = active ? ease(M.clamp((f - (1 - pf) / 2) / pf)) : 0;
      const completed = active ? done - 1 : Math.floor((s - c.i) / k) + 1;
      const page = M.mod(completed, 2);                      // 0: image i, 1: image i+k
      const next = 1 - page;
      const a = prog * Math.PI;
      const showNext = a > Math.PI / 2;
      const img = (showNext ? next : page) === 0 ? c.i : c.i + k;
      const ang = showNext ? a - Math.PI : a;
      const moving = active && prog > 0 && prog < 1;     // only an in-flight card is lifted/layered (keeps the loop wrap seamless)
      const lift = moving ? Math.sin(a) * 0.03 : 0;
      const card = { media: M.mod(img, n), x: c.x, y: c.y, z: lift, w: c.w, h: c.h, layer: moving ? 1 : 0, bright: moving ? 1 - 0.3 * Math.sin(a) : 1 };
      if (p.flipAxis === 'vertical') card.rx = -ang; else card.ry = ang;
      out.push(card);
    }
    return out;
  },
};
