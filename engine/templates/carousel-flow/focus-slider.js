import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
// One big focus card with small neighbours peeking in at the sides, offset in a zigzag; each beat the next
// small card grows into focus while the old focus shrinks away to the other side.
export default {
  id: 'focus-slider', name: 'Focus Slider', category: 'carousel-flow', slots: 8,
  desc: 'Big focus card with small zigzag neighbours; next card grows into focus each beat',
  tags: ['carousel', 'slider', 'focus', 'step', 'zigzag'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 82, 20, 100),
    centerScale: P.pct('Center scale', 200, 100, 400),
    zigzag: P.pct('Zigzag offset', 55, 0, 100),
    gap: P.pct('Gap', 6, 0, 30),
    slidePortion: P.pct('Slide portion', 80, 10, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'horizontal', ['horizontal', 'vertical']),
    cardRatio: P.cardRatio(),
    zigzagMode: P.choice('Zigzag mode', 'alternate', ['alternate', 'fixed']),
    shadow: P.bool('Shadow', true),
    loopCards: P.num('Cards per loop', 8, 2, 24),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.06,
  duration: 10,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const vert = p.direction === 'vertical';
    const K = Math.max(2, Math.round(p.loopCards));
    const ar = cardAR(ctx, 1.04);
    // big card: cardSize of the inner box's short side, along the slide axis it must leave room
    const A = vert ? I.h : I.w, B = vert ? I.w : I.h;            // along / across
    let Lb = (p.cardSize / 100) * Math.min(A, B) * (vert ? 1 / ar : 1);
    let Lw = vert ? Lb * ar : Lb;  // width
    let Lh = vert ? Lb : Lb / ar;  // height
    const sc = 100 / Math.max(100, p.centerScale);
    const ws = Lw * sc, hs = Lh * sc;
    const gap = p.gap / 100;
    const LA = vert ? Lh : Lw, LS = vert ? hs : ws;            // along-axis sizes
    const CB = vert ? Lw : Lh, CS = vert ? ws : hs;            // across-axis sizes
    const X1 = LA / 2 + gap + LS / 2;
    const Y = (Math.min(100, p.zigzag) / 55) * (CB - CS) / 2;
    const alt = p.zigzagMode !== 'fixed';
    const state = (k, m) => {                                   // k = j - m (integer)
      const a = Math.abs(k);
      if (a === 0) return { o: 0, c: 0, s: 1 };
      const sg = Math.sign(k);
      const par = alt ? ((m % 2 + 2) % 2 ? -1 : 1) : 1;
      return { o: sg * (X1 + (a - 1) * (LS + gap)), c: -sg * Y * par * Math.min(1, Y >= 0 ? 1 : 1), s: sc };
    };
    const x = u * K; const m = Math.floor(x);
    const f = easeOf(p.ease)(Math.min(1, (x - m) / Math.max(0.05, p.slidePortion / 100)));
    const out = [];
    for (let j = m - 3; j <= m + 4; j++) {
      const a = state(j - m, m), b = state(j - m - 1, m + 1);
      const o = a.o + (b.o - a.o) * f, c = a.c + (b.c - a.c) * f, s = a.s + (b.s - a.s) * f;
      out.push({ media: M.mod(M.mod(j, K), n), x: vert ? c : o, y: vert ? -o : c, w: Lw * s, h: Lh * s, layer: s });
    }
    return out;
  },
};
