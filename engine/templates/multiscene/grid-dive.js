import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
import { unit } from './_scenes.js';
// Brick grid overview -> camera dives in and hops from tile to tile (zooming out a little on each hop) while the grid loosens -> back to overview.
export default {
  id: 'grid-dive', name: 'Grid Dive', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Camera dives into a brick grid and hops between tiles, the grid loosening as it goes, then pulls back out',
  tags: ['multiscene', 'grid', 'zoom', 'dive', 'camera', 'story'], ref: 'animos',
  params: base({
    tileSize: P.pct('Tile size', 100, 30, 200),
    gap: P.num('Gap', 8.5, 0, 50, '%', 0.5),
    cameraZoom: P.pct('Camera zoom', 100, 30, 200),
    flipDirection: P.choice('Flip direction', 'right', ['right', 'left']),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.45, sheen: 0.12, rim: 0.35,
  duration: 15,
  layout(ctx) {
    const { p, n, u } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1.03), ts = p.tileSize / 100, zm = p.cameraZoom / 100;
    const sx = p.flipDirection === 'left' ? -1 : 1;
    const gw = 0.31 * ts * U, pitch = gw * (1 + p.gap / 100), ph = pitch / ar * 1.0;
    const ROWS = [-1, 0, 1, 2], COLS = 6;
    const cellPos = (r, c) => [sx * (c - 1.8 + (r % 2 ? 0.6 : 0)) * pitch, (0.07 - r * 1.04 * ph / pitch * pitch)];
    // camera path: [u, row, col, zoom, gapMul]; row/col null = overview
    const keys = [[0, null, null, 1, 1], [0.125, 0, 2, 2.15, 1], [0.25, -1, 1, 2.8, 1.05], [0.375, 0, 4, 2.06, 1.1], [0.5, -1, 5, 2.9, 1.2],
      [0.625, -1, 0, 2.2, 1.8], [0.75, 1, 2, 2.15, 1.9], [0.875, 1, 1, 2.2, 1.9], [1, null, null, 1, 1]];
    const st = (k) => { const [, r, c, z, g] = k; if (r === null) return { fx: 0, fy: 0, z: 1, g }; const [x, y] = cellPos(r, c); return { fx: x * g, fy: (y - 0.07) * g + 0.07, z: z * zm, g }; };
    let a = keys[0], b = keys[1];
    for (let i = 0; i < keys.length - 1; i++) if (u >= keys[i][0] && u <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; }
    const span = b[0] - a[0], hold = 0.022;
    const q = Math.min(1, Math.max(0, (u - a[0] - hold) / (span - 2 * hold)));
    const e = E.inOutCubic(q);
    const A = st(a), B = st(b);
    const dip = 1 - 0.3 * Math.sin(Math.PI * q) * (a[1] !== null && b[1] !== null ? 1 : 0);
    // zoom interpolated in log space for constant perceived speed
    const Z = Math.exp(Math.log(A.z) + (Math.log(B.z) - Math.log(A.z)) * e) * dip;
    const g = A.g + (B.g - A.g) * e;
    const fx = A.fx + (B.fx - A.fx) * e, fy = A.fy + (B.fy - A.fy) * e;
    const out = [];
    for (const r of ROWS) for (let c = 0; c < COLS; c++) {
      const i = (r + 1) * COLS + c;
      const media = (((r === -1 ? 6 : r === 0 ? 0 : r === 1 ? 12 : 18) + c) % n + n) % n;
      const [x0, y0] = cellPos(r, c);
      const x = (x0 * g - fx) * Z, y = ((y0 - 0.07) * g + 0.07 - fy) * Z;
      const w = gw * Z;
      if (Math.abs(x) > ctx.view.w / 2 + w || Math.abs(y) > 0.5 + w) continue;
      out.push({ media, x, y, z: 0, w, h: w / ar });
    }
    return out;
  },
};
