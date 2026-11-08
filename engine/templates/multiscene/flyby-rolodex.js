import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
import { play, reflect, unit, mod } from './_scenes.js';
// Hero card -> 3D flyby through a field of cards -> stacked deck -> scrolling column -> rolodex drum flipping cards toward the viewer.
export default {
  id: 'flyby-rolodex', name: 'Flyby Rolodex', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Hero card, fly-through card field, deck, scrolling column, then a rolodex drum flipping cards toward you',
  tags: ['multiscene', 'rolodex', 'flyby', 'deck', '3d', 'story'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 100, 30, 200),
    spread: P.pct('Spread', 100, 0, 200),
    depth: P.pct('Depth', 100, 0, 200),
    columnSize: P.pct('Column size', 35, 10, 80),
    flipDirection: P.choice('Flip direction', 'toward', ['toward', 'away']),
    spinDirection: P.choice('Spin direction', 'toward', ['toward', 'away']),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.35, sheen: 0.12, rim: 0.35,
  duration: 16,
  layout(ctx) {
    const { p, n } = ctx;
    const U = unit(ctx), ar = cardAR(ctx, 1), cs = p.cardSize / 100, sp = p.spread / 100, dp = p.depth / 100;
    const N = Math.max(n, 10);
    const card = (i, o) => { const w = o.w; return { media: i % n, h: w / ar, ...o }; };
    const flip = p.flipDirection === 'away' ? -1 : 1;
    // 0 hero
    const hero = () => Array.from({ length: N }, (_, i) => card(i, i === 0 ? { x: 0, y: 0, z: 0, w: 0.7 * cs * U } : { x: 0, y: 0, z: -6 - i * 0.3, w: 0.7 * cs * U, opacity: 0 }));
    // 1 flyby field: cards rush toward the camera
    const fly = (f) => Array.from({ length: N }, (_, i) => {
      const a = i * 2.39996 + 2.2, r = (0.22 + 0.2 * ((i * 0.37) % 1)) * sp;
      const z0 = -0.15 - i * 0.34 * dp;
      const z = z0 + f * 1.5 * dp;
      return card(i, { x: Math.cos(a) * r * U * 1.8, y: Math.sin(a) * r * 1.45, z, w: (0.46 + 0.1 * Math.max(0, Math.min(1, (z + 0.3) / 0.6))) * cs * U, opacity: z > 1.2 ? 0 : Math.min(1, Math.max(0, (z + 1.3) / 0.4)), ry: Math.cos(a) * 0.15, rx: -Math.sin(a) * 0.12 });
    });
    // 2 deck: stack going back & up
    const deck = (f) => Array.from({ length: N }, (_, i) => {
      const k = mod(i - 4, N);
      return card(i, { x: 0, y: -0.06 + k * (0.036 + 0.006 * f), z: -k * 0.012 * dp, w: 0.6 * cs * U, opacity: k < 7 ? 1 : 0, rx: -0.05 });
    });
    // 3 column scrolling downward
    const cw = (p.columnSize / 35) * 0.222 * Math.min(1, ctx.view.w * 1.9);
    const col = (f) => Array.from({ length: N }, (_, i) => {
      const k = mod(i - 0 - f * 2.2 + N / 2, N) - N / 2; // index position, scrolling
      const g = cw * 0.92;
      return card(i, { x: 0, y: -0.22 + k * g, z: f * 0.25, w: cw * (1 + f * 0.15), rx: -0.25 * f });
    });
    // 4 rolodex drum: horizontal axis below the frame, cards radial, flipping toward viewer
    const rol = (f) => {
      const out = []; const w = 0.67 * cs * U; const h = w / ar;
      const R = 0, ay = -0.33, az = 0.08;
      const s = N - 7 * (1 - f) + 0.62; // phase: front card falls first, the next one tips after
      const k0 = Math.floor(s), fr = s - k0;
      for (let i = 0; i < N; i++) {
        const ci = mod((i - k0) + N / 2, N) - N / 2;
        const q = ci <= 0 ? E.inOutCubic(Math.min(1, fr / 0.26)) : E.inOutCubic(Math.min(1, Math.max(0, (fr - 0.16) / 0.3)));
        const c = ci - q; // >0 waiting behind, <0 flipped forward
        const th = flip * (c >= 0 ? 0.95 - 0.8 * Math.min(c, 1) - 0.12 * Math.max(0, c - 1) : 0.95 - c * 0.9);
        if (c > 5 || c < -1.4) { out.push(card(i, { opacity: 0, w, x: 0, y: ay, z: az })); continue; }
        const rr = R + h / 2;
        const c0 = card(i, { x: 0, y: ay + rr * Math.cos(th), z: az + rr * Math.sin(th), rx: th, w, h, opacity: Math.min(1, Math.max(0, (c + 1.4) / 0.3), Math.max(0, (5 - c) / 0.6)), bright: 1 - Math.min(0.5, Math.max(0, c) * 0.12), shadow: 0 });
        out.push(c0);
      }
      return out;
    };
    const ay0 = -0.33;
    const rolR = (_, f) => { const a = rol(f); return a.concat(a.map((c) => ({ ...reflect(c, ay0, 0.2), fullAspect: c.w / c.h }))); };
    const heroR = () => hero().concat(hero().map((c) => ({ ...c, opacity: 0 })));
    const flyR = (_, f) => fly(f), deckR = (_, f) => deck(f), colR = (_, f) => col(f);
    return play(ctx, [
      { hold: 0.06, move: 0.06, pose: heroR },
      { hold: 0.10, move: 0.05, pose: flyR, ease: E.inOutQuart },
      { hold: 0.04, move: 0.06, pose: deckR, stagger: 0.3 },
      { hold: 0.17, move: 0.07, pose: colR, ease: E.inOutQuart },
      { hold: 0.34, move: 0.05, pose: rolR },
    ], { offset: 0.03 });
  },
};
