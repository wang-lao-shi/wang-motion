import { base, P, cardAR, easeOf, EASINGS } from '../_common.js';
import { E } from '../../lib.js';
import { play, unit, steps, mixCard } from './_scenes.js';
// Three scenes: hero cards rising one after another -> three drifting columns -> diagonal rows of three swapping in -> back to the hero.
export default {
  id: 'triple-scene', name: 'Triple Scene', category: 'multiscene', radiusMode: 'card', slots: 12,
  desc: 'Hero slideshow, then drifting card columns, then tilted diagonal rows of three, looping back to the hero',
  tags: ['multiscene', 'hero', 'columns', 'diagonal', 'slideshow', 'story'], ref: 'animos',
  params: base({
    padding: P.padding(2),
    heroSize: P.pct('Hero size', 58, 20, 100),
    heroSpacing: P.pct('Hero spacing', 4, 0, 50),
    columns: P.num('Columns', 3, 1, 6),
    cardsPerColumn: P.num('Cards per column', 6, 2, 12),
    cardGap: P.num('Card gap', 1.5, 0, 10, '%', 0.25),
    columnDrift: P.pct('Column drift', 22, 0, 100),
    rowTilt: P.pct('Row tilt', 17, -50, 50),
    rowRise: P.pct('Row rise', 12, -50, 50),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.1, rim: 0.3, edgeX: 0, 
  duration: 12,
  layout(ctx) {
    const { p, n, inner } = ctx;
    const ar = cardAR(ctx, 16 / 9), ez = easeOf(p.ease);
    const NC = Math.max(1, Math.round(p.columns)), NR = Math.max(2, Math.round(p.cardsPerColumn)) + 1;
    const gap = p.cardGap / 100;
    const total = NC * NR;
    // every card is a fixed column cell (c, r) with a fixed media, so no card ever changes image mid-move
    const colMedia = (c, r) => (c === 1 ? 9 + r : c === 0 ? 4 + r : 3 + r);
    const cellC = (i) => i % NC, cellR = (i) => Math.floor(i / NC);
    const key = (c, r) => r * NC + c;
    const C = (i, o) => ({ media: ((colMedia(cellC(i), cellR(i)) % n) + n) % n, h: o.w / ar, ...o });
    const blank = () => new Array(total).fill(null);
    const mc = Math.min(1, NC - 1); // middle column index used by hero / diag cards
    // scene 1: hero cards rise from below one after another (media 0,1,2 = middle-column cells r 3,4,5)
    const hw = (p.heroSize / 100) * Math.min(inner.w, inner.h * 1.2), hp = 0.62 + hw / ar + p.heroSpacing / 100;
    const HK = [key(mc, 3), key(mc, 4), key(mc, 5)].map((k) => k % total);
    const hero = (c) => { const o = blank(); HK.forEach((k, j) => { o[k] = C(k, { x: 0, y: (c - j) * hp, z: 0, w: hw }); }); return o; };
    // scene 2: columns drifting alternately
    const cw = (Math.min(inner.w, inner.h * 1.6) - gap * (NC - 1)) / NC, ch = cw / ar, pitch = ch + gap * 1.8;
    const cols = (f) => Array.from({ length: total }, (_, i) => {
      const c = cellC(i), r = cellR(i); const dr = (c % 2 ? -1 : 1) * (p.columnDrift / 22) * 1.0 * f;
      const y0 = 0.5 - ch / 2 - 0.04 - (r - (c % 2 ? 0.0 : 0.6)) * pitch + dr * pitch * 1.1;
      return C(i, { x: (c - (NC - 1) / 2) * (cw + gap * 1.5), y: y0, z: 0, w: cw });
    });
    // scene 3: diagonal rows of three (row A = middle-column cells r 1,2,4 ; row B = r 5,3 + column 2 r 0)
    const dx = cw + gap * 2, dyy = (p.rowTilt / 17) * 0.11 + (p.rowRise / 12) * 0.07;
    const rowA = [key(mc, 1), key(mc, 2), key(mc, 4)].map((k) => k % total), rowB = [key(mc, 5), key(mc, 3), key(Math.min(2, NC - 1), 0)].map((k) => k % total);
    const diag = (f) => {
      const o = blank(); const q = steps(f, 1, 0.6, E.linear);
      rowA.forEach((i, j) => { const x = (j - 1) * dx, y = -(j - 1) * dyy; const k = Math.min(1, Math.max(0, q * 1.6 - j * 0.3)); if (k < 0.999) o[i] = C(i, { x: x + k * 0.6, y: y + 0.06 + k * 0.8, z: 0, w: cw * (1 - 0.2 * k), opacity: 1 - k ** 4 }); });
      rowB.forEach((i, j) => { if (o[i]) return; const x = (j - 1) * dx, y = -(j - 1) * dyy; const k = ez(Math.min(1, Math.max(0, q * 1.6 - j * 0.3 - 0.1))); if (k > 0.01) o[i] = C(i, { x, y: y + 0.03 * (1 - k), z: 0.01, w: cw * k }); });
      return o;
    };
    // transition: cards present in both layouts move straight; a card only in one layout slides in/out along its column's drift
    const VW = ctx.view.w / 2;
    const onFrame = (c) => c && (c.opacity ?? 1) > 0.01 && Math.abs(c.x) - c.w / 2 < VW && Math.abs(c.y) - (c.h ?? c.w) / 2 < 0.5;
    const off = (c) => ({ ...c, y: c.y + (c.y >= 0 ? 1 : -1) * 1.25 }); // nearest top/bottom edge
    const via = (a, b, e, i) => {
      const va = onFrame(a), vb = onFrame(b);
      if (!va && !vb) return null;
      if (a && b) return mixCard(a, b, e);
      if (b) return mixCard(off(b), b, e);
      return mixCard(a, off(a), e);
    };
    const out = play(ctx, [
      { hold: 0.26, move: 0.09, pose: (_, f) => hero(steps(f, 2, 0.45, ez) * 0.8), ease: ez, stagger: 0.3, via },
      { hold: 0.18, move: 0.08, pose: (_, f) => cols(f), ease: ez, stagger: 0.35, delay: (i) => ((i * 7) % total) / total, via },
      { hold: 0.33, move: 0.06, pose: (_, f) => diag(f), ease: ez, via },
    ]);
    return out.filter(Boolean);
  },
};
