import { base, P, EASINGS, easeOf } from '../_common.js';
import { cells, shape } from './_grid.js';
// A grid that builds itself card by card (fade + grow), holds, then empties in reverse order.
export default {
  id: 'grid-reveal', name: 'Grid Reveal', category: 'grid', slots: 4,
  desc: 'Grid builds card by card, holds, then clears in reverse',
  tags: ['grid', 'reveal', 'stagger', 'build', 'intro'], ref: 'animos',
  params: base({
    gap: P.pct('Gap', 3, 0, 20),
    ease: P.choice('Easing', 'custom', EASINGS),
    revealOrder: P.choice('Reveal order', 'rows', ['rows', 'columns', 'diagonal']),
    shadow: P.bool('Shadow', true),
    cells: P.num('Cells', 4, 1, 24),
    stagger: P.pct('Stagger', 7.5, 0, 25),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.06,
  duration: 6,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const k = Math.max(1, Math.round(p.cells));
    const [cols, rows] = shape(ctx, k);
    const list = cells(ctx, cols, rows, p.gap).slice(0, k);
    const ord = list.map((c) => p.revealOrder === 'columns' ? c.c * rows + c.r : p.revealOrder === 'diagonal' ? (c.r + c.c) : c.i);
    const maxO = Math.max(...ord);
    const st = p.stagger / 100 * (p.revealOrder === 'diagonal' ? (k - 1) / Math.max(1, maxO) : 1), d = 0.13;
    const ease = easeOf(p.ease);
    return list.map((c, idx) => {
      const a = ord[idx] * st * 0.93;
      const v = Math.min(M.clamp((u - a) / d), M.clamp((1 - a - u) / d));
      const e = ease(v);
      const s = 0.82 + 0.18 * e;
      return { media: M.mod(c.i, n), x: c.x, y: c.y, w: c.w * s, h: c.h * s, opacity: Math.min(1, e * 1.15), bright: 0.35 + 0.65 * e };
    });
  },
};
