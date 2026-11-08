import { base, P } from '../_common.js';
import { cells } from './_grid.js';
// HIDDEN test template (underscore = not listed): X4a template post-FX (layout returns { cards, post }).
//   wm still _posttest --res 320 --at 0.3 --param fx=glitch     fx: none|chroma|glitch|scan|flash|tint|grade|all (X4a)
//   X4b: bloom|leak|barrel|tracking|noise|vhs (barrel+scan+tracking+noise+chroma) — 'all' stays the X4a mix
// Every post value is a function of u / beat index only, so the loop is seamless.
export default {
  id: '_posttest', name: 'Post Test', category: 'grid', slots: 9,
  desc: 'hidden: X4a template post-FX test', tags: ['test'], ref: 'original',
  params: base({ gap: P.pct('Gap', 3, 0, 20), fx: P.choice('Effect', 'glitch', ['none', 'chroma', 'glitch', 'scan', 'flash', 'tint', 'grade', 'all', 'bloom', 'leak', 'barrel', 'tracking', 'noise', 'vhs']),
    amount: P.pct('Amount', 100, 0, 200) }),
  shadow: false, defaultRatio: '16:9', duration: 6,
  layout(ctx) {
    const { p, n, u, M } = ctx; const A = (p.amount ?? 100) / 100; const TAU = M.TAU;
    const list = cells(ctx, 3, 3, p.gap);
    const rot = u * TAU; // gentle periodic drift so motion is visible
    const cards = list.map((c, i) => ({ media: M.mod(i, n), x: c.x + Math.sin(rot + i) * 0.004, y: c.y, w: c.w, h: c.h }));
    const K = 6, b = Math.floor(u * K), q = u * K - b;              // 6 beats per loop
    const burst = Math.max(0, 1 - q * 5);                          // spike at each beat start, gone after 1/5 beat
    const post = {};
    const fx = p.fx;
    if (fx === 'chroma' || fx === 'all') post.chroma = 0.02 * A * (0.6 + 0.4 * Math.cos(rot));
    if (fx === 'glitch' || fx === 'all') post.glitch = { amount: A * (fx === 'all' ? burst : Math.max(burst, 0.35)), block: 0.05, rgb: 0.8, seed: b * 7 + Math.floor(q * 12) };
    if (fx === 'scan' || fx === 'all') post.scan = { amount: 0.7 * A, lines: 120, roll: u * 4 };
    if (fx === 'flash') post.flash = { amount: 0.9 * A * Math.max(0, 1 - q * 3) ** 2, color: '#fff4e0' };
    if (fx === 'all') post.flash = 0.6 * A * burst ** 2;
    if (fx === 'tint' || fx === 'all') post.tint = { color: '#ff9a50', amount: 0.5 * A * (0.5 - 0.5 * Math.cos(rot)) + (fx === 'tint' ? 0.3 : 0) };
    if (fx === 'grade') post.grade = { sat: 1 - 0.9 * A, contrast: 1.35, bright: 1.05 };
    // X4b
    if (fx === 'bloom') post.bloom = { amount: 1.2 * A, threshold: 0.35, radius: 0.03 };
    if (fx === 'leak') post.leak = [                               // two blobs drifting across, one full pass per loop
      { amount: 0.9 * A, color: '#ff7a2e', pos: M.fract(u), angle: 0.25, r: 0.55 },
      { amount: 0.6 * A, color: '#ff3c8c', x: 0.15 + 0.1 * Math.sin(rot), y: 0.8, r: 0.45 }];
    if (fx === 'barrel' || fx === 'vhs') post.barrel = 0.35 * A;
    if (fx === 'tracking' || fx === 'vhs') post.tracking = { amount: A, pos: 1.1 - M.fract(u * 2) * 1.2, h: 0.07, seed: b };
    if (fx === 'noise') post.noise = { amount: 0.35 * A, seed: Math.floor(u * 180) };  // one re-roll per frame at 30 fps
    if (fx === 'vhs') { post.noise = { amount: 0.08 * A, seed: Math.floor(u * 180) }; post.scan = { amount: 0.5 * A, lines: 120, roll: u * 2 }; post.chroma = 0.012 * A; }
    return { cards, post };
  },
};
