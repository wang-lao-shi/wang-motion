import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
import { play, unit } from './_scenes.js';
// Grid overview -> camera dives into a diagonal staircase of big cards and climbs it step by step -> pulls back out to the grid.
export default {
  id: 'stairway', name: 'Stairway', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Grid of cards dives into a diagonal staircase the camera climbs card by card, then pulls back out',
  tags: ['multiscene', 'stairs', 'grid', 'zoom', 'diagonal', 'story'], ref: 'animos',
  params: base({
    tileSize: P.pct('Tile size', 100, 30, 200),
    gridGap: P.num('Grid gap', 14, 0, 50, '%', 0.5),
    stairGap: P.num('Stair gap', 0, -50, 100, '%'),
    cameraZoom: P.pct('Camera zoom', 100, 30, 200),
    flipDirection: P.choice('Flip direction', 'up', ['up', 'down']),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.45, sheen: 0.12, rim: 0.35,
  duration: 16,
  layout(ctx) {
    const { p, n } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1), ts = p.tileSize / 100, zm = p.cameraZoom / 100;
    const vd = p.flipDirection === 'down' ? -1 : 1;
    const arG = cardAR(ctx, 0.86); // grid tiles: narrow portrait
    // grid: wide lattice (cropped at the frame edges); media pattern (c*4 + r) mod 12 -> 12 distinct in any 3x4 window
    const gw = 0.262 * ts * U * zm, px = gw * (1 + p.gridGap / 100) * 1.1, py = (gw / arG) * (1 + p.gridGap / 100) * 1.0;
    const GC = Math.min(4, Math.ceil(ctx.view.w / 2 / px / 0.6) + 1), GR = Math.min(6, Math.ceil(0.5 / py / 0.6) + 1);
    const cells = [];
    for (let c = -GC; c <= GC; c++) for (let r = -GR; r <= GR; r++) cells.push({ c, r, m: (((c * 4 - r + 2 * Math.floor((c + 1) / 3)) % 12) + 12) % 12, d: Math.abs(c) * 1.3 + Math.abs(r) });
    cells.sort((A, B) => A.d - B.d || A.c - B.c || A.r - B.r);
    const seen = new Set(); let nx = 12;
    for (const ce of cells) { if (!seen.has(ce.m)) { seen.add(ce.m); ce.id = ce.m; } else ce.id = nx++; }
    const NC = nx; const byId = []; cells.forEach((ce) => { byId[ce.id] = ce; });
    const C = (i, o) => ({ media: i < 12 ? i % n : byId[i].m % n, h: o.w / ar, ...o });
    const colOff = (c) => [0.0, 0.14, -0.06, 0.1, -0.12, 0.05, 0.12, -0.08, 0.02][c + GC] ?? 0;
    const grid = (rot, stag, dy, zs = 1) => Array.from({ length: NC }, (_, i) => {
      const { c, r } = byId[i]; const x0 = c * px, y0 = r * py + colOff(c) * py * stag + dy;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      return C(i, { x: (x0 * cr - y0 * sr) * zs, y: (x0 * sr + y0 * cr) * zs, z: 0, rz: rot, w: gw * zs, h: gw * zs / arG });
    });
    // staircase: card k up-right & behind card k-1; camera follows focus c
    const sw = 0.68 * ts * U * zm, sg = 1 + p.stairGap / 100;
    const stair = (c, zs = 1) => Array.from({ length: NC }, (_, i) => {
      if (i >= 12) { const { c: gc, r: gr } = byId[i]; return C(i, { x: gc * px * 3.5, y: gr * py * 3.5, z: 0.3, w: sw * zs, opacity: 0 }); }
      const d = i - c;
      return C(i, { x: d * 0.39 * sg * U * zs, y: vd * d * 0.37 * sg * zs, z: -d * 0.2, w: sw * zs, opacity: d > 3.5 || d < -2.5 ? 0 : 1 });
    });
    // uniform climb: one card per step, each step = half hold + half move (5.4 steps over the stair hold)
    const climb = (f) => { const x = f * 5.4, k = Math.floor(x); return 1 + Math.min(k, 5) + (k >= 5 ? 0 : E.inOutCubic(Math.min(1, Math.max(0, (x - k - 0.5) / 0.5)))); };
    const zoomIn = (f) => 0.81 + 0.19 * E.outCubic(Math.min(1, f * 5.4 / 1.0));
    const S = Math.min(12, n);
    return play(ctx, [
      { hold: 0.05, move: 0.075, pose: () => grid(0, 0.3, -0.13 * U), ease: E.inOutQuart },
      { hold: 0.54, move: 0.085, pose: (_, f) => stair(Math.min(climb(f), S - 1), zoomIn(f)), ease: E.inOutQuart },
      { hold: 0.25, move: 0.0001, pose: (_, f) => { const e = E.inOutCubic(Math.min(1, f * 2.2)); return grid(0, 1.6 * (1 - e) + 0.3 * e, -0.13 * U, 0.86 + 0.14 * e); } },
    ]);
  },
};
