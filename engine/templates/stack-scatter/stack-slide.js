import { base, P, EASINGS, easeOf, CARD_RATIO_OPTS } from '../_common.js';
// Stack Slide (animos replica): a deck of full-size cards; each beat the front card slides off to the side
// and the next card rises from depth-scale to full size. One card visible at rest.
const RAT = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 };
export default {
  id: 'stack-slide', name: 'Stack Slide', category: 'stack-scatter', slots: 4,
  desc: 'Deck of full-frame cards: the front card slides away and the next one scales up from behind',
  tags: ['stack', 'deck', 'slide', 'slideshow', 'step'], ref: 'animos',
  params: base({
    cardInset: P.num('Card inset', 4, 0, 30, '%', 0.5),
    depthScale: P.num('Depth scale', 0.95, 0.5, 1, '', 0.01),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: { type: 'choice', label: 'Card ratio', default: 'frame', options: ['frame', ...CARD_RATIO_OPTS] },
    shadow: P.bool('Shadow', true),
    direction: P.choice('Slide direction', 'left', ['left', 'right', 'up', 'down']),
    loopCards: P.num('Cards per loop', 4, 2, 24),
    hold: P.pct('Hold', 60, 0, 90),
    depthCards: P.num('Visible depth cards', 2, 0, 6),
  }),
  shadow: true, shadowOpacity: 0.25,
  duration: 8,
  layout(ctx) {
    const { p, n, u, M, inner: I, view } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const ins = p.cardInset / 100;
    const bw = Math.max(0.05, I.w - 2 * ins), bh = Math.max(0.05, I.h - 2 * ins);
    const cr = ctx.spec?.cardRatio || p.cardRatio || 'frame';
    const r = cr === 'frame' ? bw / bh : cr === 'auto' ? ctx.ratioOf(0) : (RAT[cr] || bw / bh);
    let w = bw, h = bh; if (r > bw / bh) h = bw / r; else w = bh * r;
    const mv = 1 - Math.min(0.9, p.hold / 100);
    const x = u * K, k0 = Math.floor(x);
    const f = easeOf(p.ease)(Math.min(1, (x - k0) / mv));
    const dir = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[p.direction] || [-1, 0];
    const travel = dir[0] ? (view.w + w) / 2 + 0.05 : (view.h + h) / 2 + 0.05;
    const D = Math.max(0, Math.round(p.depthCards));
    const out = [];
    for (let d = D + 1; d >= 0; d--) {
      const j = k0 + d;
      const media = M.mod(M.mod(j, K), n);
      if (d === 0) { // leaving card
        const o = f * travel;
        out.push({ media, x: dir[0] * o, y: dir[1] * o, z: 0.002, w, h, layer: 10 });
      } else { // depth cards move one step forward
        const depth = d - f;
        const s = Math.pow(p.depthScale, depth);
        out.push({ media, x: 0, y: 0, z: -depth * 0.01, w: w * s, h: h * s, layer: -d, bright: 1 - 0.12 * Math.min(1, depth) , shadow: p.shadow ? undefined : 0, opacity: d > D ? Math.min(1, f * 3) : 1 });
      }
    }
    if (!p.shadow) out.forEach((c) => (c.shadow = 0));
    return out;
  },
};
