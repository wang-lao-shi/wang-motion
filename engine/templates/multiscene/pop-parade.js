import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
import { unit } from './_scenes.js';
// Cards pop in one by one at the centre, growing; they snap into a hopping parade that marches off-screen, then little clusters pop in, drift and pop out.
export default {
  id: 'pop-parade', name: 'Pop Parade', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Cards pop in one after another, march off in a hopping parade, then pop up in drifting clusters',
  tags: ['multiscene', 'pop', 'parade', 'playful', 'social', 'story'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 100, 30, 200),
    cameraZoom: P.pct('Camera zoom', 100, 30, 200),
    flipDirection: P.choice('Flip direction', 'left', ['left', 'right']),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.12, rim: 0.35,
  duration: 16,
  layout(ctx) {
    const { p, n, M } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1.03), cs = p.cardSize / 100 * p.cameraZoom / 100, Z = p.cameraZoom / 100;
    const sx = p.flipDirection === 'right' ? -1 : 1;
    const v = M.fract(ctx.u + 0.03);
    const cl = (x) => M.clamp(x, 0, 1);
    const pop = (t0, t1) => { const a = E.outBack(cl((v - t0) / 0.03)); const b = t1 ? 1 - E.inBack(cl((v - t1 + 0.03) / 0.03)) : 1; return Math.max(0, a * b); };
    const out = [];
    const C = (i, o) => out.push({ media: i % n, h: o.w / ar, ...o, x: o.x * sx });
    // 1) popping stack + 2) parade
    const sp = 0.33 * cs * U, rw = 0.3 * cs * U;
    const toRow = E.inOutCubic(cl((v - 0.33) / 0.055));
    const off = (0.09 - 4.5 * E.inCubic(cl((v - 0.36) / 0.2))) * U * Z;
    for (let i = 0; i < 8; i++) {
      const slot = i === 6 ? -1 : i === 7 ? 7 : i;
      const rx = (slot) * sp + off, hop = Math.abs(Math.sin((v * 16 + i * 0.5) * Math.PI)) * 0.035 * toRow;
      const ry = -0.0 + hop - (i === 7 ? 0.05 : 0);
      if (i < 7) {
        const sw = (0.31 + i * 0.04) * cs * U; const s = pop(i * 0.045, 0);
        if (rx < -ctx.view.w / 2 - rw && toRow >= 1) continue;
        C(i, { x: rx * toRow, y: (i === 6 ? 0.02 : 0) * (1 - toRow) + ry * toRow, z: (i * 0.01) * (1 - toRow), w: (sw + (rw - sw) * toRow), s });
      } else {
        if (rx > ctx.view.w / 2 + rw || rx < -ctx.view.w / 2 - rw || v < 0.33) continue;
        C(i, { x: rx, y: ry, z: 0, w: rw * 1.08, s: 1 });
      }
    }
    // 3) clusters
    const cl3 = [
      [8, 0.3, 0.12, 0.35, 0.585, 0.76, -0.4, 0.655], [9, -0.05, -0.18, 0.37, 0.605, 0.745, -0.3, 0.655], [10, -0.17, 0.16, 0.31, 0.565, 0.72, -0.3, 0.655],
      [11, 0.17, -0.05, 0.36, 0.71, 0.86, -0.5, 0.78], [12, -0.3, -0.2, 0.32, 0.69, 0.84, -0.5, 0.78], [13, -0.45, 0.25, 0.28, 0.67, 0.82, -0.5, 0.78],
      [14, 0.45, 0.13, 0.3, 0.72, 0.85, -0.4, 0.78], [15, 0.13, -0.13, 0.37, 0.85, 0.975, 0.3, 0.905], [16, 0.5, 0.2, 0.34, 0.835, 0.965, 0.45, 0.905],
    ];
    for (const [i, x, y, w, t0, t1, vx, vr] of cl3) {
      const s = pop(t0, t1); if (s <= 0.001) continue;
      C(i, { x: (x + vx * (v - vr)) * U * Z, y: y * Z, z: 0, w: w * cs * U, s });
    }
    return out;
  },
};
