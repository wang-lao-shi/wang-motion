import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
import { play, unit, kf } from './_scenes.js';
// Fisheye "lens" strip scrolling through cards -> zoom into a staggered grid -> grid scatters into a drifting field -> strip reforms.
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export default {
  id: 'lens-orbit', name: 'Lens Orbit', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Magnifying-lens strip scrolls through cards, dives into a grid that scatters into a drifting field, then reforms',
  tags: ['multiscene', 'lens', 'fisheye', 'strip', 'grid', 'scatter', 'story'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 100, 30, 200),
    lensStrength: P.pct('Lens strength', 50, 0, 100),
    focusSize: P.pct('Focus size', 115, 50, 200),
    cardGap: P.num('Card gap', -20, -60, 60, '%'),
    flipDirection: P.choice('Flip direction', 'left', ['left', 'right']),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.12, rim: 0.35,
  duration: 17,
  layout(ctx) {
    const { p, n } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1), cs = p.cardSize / 100;
    const S = Math.min(12, n), NG = 25, NT = Math.max(NG, S);
    const dir = p.flipDirection === 'right' ? -1 : 1;
    const C = (i, o) => ({ media: i % n, h: o.w / ar, ...o });
    // --- lens strip
    const wb = 0.2 * cs * U, A = (p.lensStrength / 50) * 0.75 * (p.focusSize / 115), sig = 0.9, g = 1 + p.cardGap / 100;
    const sx = (d) => g * wb * (d + A * Math.sqrt(Math.PI * sig) / 2 * erf(d / Math.sqrt(sig)));
    const strip = (c) => Array.from({ length: NT }, (_, i) => {
      if (i >= S) return C(i, { x: 0, y: 0, z: -0.4, w: wb, opacity: 0 });
      const d = (((i - c) / S + 0.5) % 1 + 1) % 1 * S - S / 2;
      const w = wb * (1 + A * Math.exp(-d * d / sig));
      const x = dir * sx(d);
      const hidden = Math.abs(x) > ctx.view.w * 0.5 + w;
      return C(i, { x, y: 0, z: 0.03 - Math.abs(d) * 0.01, w, opacity: hidden ? 0 : 1 });
    });
    // --- grid / scatter: 5x5 cells, card order spirals out from the centre starting at card 8
    const cells = [];
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) cells.push([c, r]);
    cells.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    const cellOf = (i) => cells[((i - 7) % NG + NG) % NG];
    const gw = 0.32 * cs * U, pitch = gw * 1.1;
    const grid = (_, f) => Array.from({ length: NT }, (_, i) => {
      const [c, r] = cellOf(i); const st = (c % 2 ? 1 : 0) * 0.25 * pitch * f;
      return C(i, { x: c * pitch * (1 + 0.12 * f) - f * 0.05, y: -r * pitch * (1 + 0.12 * f) + st + f * 0.08, z: 0, w: gw * (1 - 0.06 * f) });
    });
    const scat = (_, f) => Array.from({ length: NT }, (_, i) => {
      const [c, r] = cellOf(i); const k = 1.3 + 0.1 * f;
      const jx = (ctx.M.rand(i, 3) - 0.5) * 0.18, jy = (ctx.M.rand(i, 7) - 0.5) * 0.18;
      return C(i, { x: (c * pitch + jx) * k - 0.08 + f * 0.12, y: (-r * pitch + jy + 0.25 * pitch * (c % 2 ? 1 : 0)) * k + 0.1 - f * 0.18, z: 0, w: gw * 0.97 });
    });
    return play(ctx, [
      { hold: 0.30, move: 0.07, pose: (_, f) => strip(kf(f, [[0, 0], [0.45, 0], [0.85, 7], [1, 7]], E.inOutCubic)), ease: E.inOutQuart },
      { hold: 0.18, move: 0.07, pose: grid, ease: E.inOutCubic },
      { hold: 0.18, move: 0.07, pose: scat, ease: E.inOutQuart, stagger: 0.25 },
      { hold: 0.13, move: 0.0001, pose: (_, f) => strip(kf(f, [[0, 7], [0.35, 7], [1, 12]], E.inOutCubic)) },
    ]);
  },
};
