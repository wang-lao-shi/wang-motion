import { base, P, EASINGS, easeOf, CARD_RATIO_OPTS } from '../_common.js';
// Cascade Deck (animos replica): a deck collapsed in the centre fans out into a diagonal cascade
// (top-left → bottom-right), then the cards re-flow one by one into the opposite diagonal
// (bottom-left → top-right), then into the mirrored diagonal (back card top-left, front card bottom-right),
// and finally slide one by one back into the centre stack. Front card always stays on top.
const RAT = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 };
// diagonal direction per state, in units of (k - mid): [sx, sy] (y up). O = collapsed.
const STATES = { O: [0, 0], A: [1, -1], B: [1, 1], C: [-1, 1] };
export default {
  id: 'cascade-deck', name: 'Cascade Deck', category: 'stack-scatter', slots: 8,
  desc: 'A deck fans into a diagonal cascade, re-flows card by card into the opposite diagonals, then restacks',
  tags: ['stack', 'deck', 'cascade', 'diagonal', 'fan', 'step'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 80, 20, 100),
    overlap: P.pct('Overlap', 70, 0, 95),
    ease: P.choice('Easing', 'custom', EASINGS),
    motion: P.choice('Motion', 'oneByOne', ['oneByOne', 'allTogether']),
    cardRatio: { type: 'choice', label: 'Card ratio', default: '1:1', options: CARD_RATIO_OPTS },
    shadow: P.bool('Shadow', true),
    cards: P.num('Cards', 8, 2, 16),
  }),
  shadow: true, shadowOpacity: 0.3,
  duration: 8,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const K = Math.max(2, Math.round(p.cards));
    const ease = easeOf(p.ease);
    const cr = ctx.spec?.cardRatio || p.cardRatio || '1:1';
    const r = cr === 'auto' ? ctx.ratioOf(0) : (RAT[cr] || 1);
    const o = 1 - p.overlap / 100;                 // step as fraction of card size
    const span = 1 + (K - 1) * o;                  // deck extent in card sizes
    const sc = p.cardSize / 100;
    let w = (I.w * sc) / span, h = w / r;
    if (h * span > I.h * sc) { h = (I.h * sc) / span; w = h * r; }
    const mid = (K - 1) / 2;
    const pos = (S, k) => [STATES[S][0] * (k - mid) * o * w, STATES[S][1] * (k - mid) * o * h];
    // transitions: [from, to, start u, order(+1 front-first / -1 back-first), sequential?]
    const one = p.motion !== 'allTogether';
    const W = 0.164;                               // re-flow window (8 s loop → ~1.3 s)
    const T = [
      ['O', 'A', 0.0, 1, false, 0.11],
      ['A', 'B', 0.2256, 1, one, W],
      ['B', 'C', 0.478, -1, one, W],
      ['C', 'O', 0.79, 1, one, W],
    ];
    const out = [];
    for (let k = 0; k < K; k++) {
      let S = 'O', x = 0, y = 0;
      [x, y] = pos('O', k);
      for (const [from, to, st, ord, seq, win] of T) {
        const d = seq ? win / K : win;
        const idx = ord > 0 ? k : K - 1 - k;
        const s0 = st + (seq ? idx * d : 0);
        if (u < s0) break;
        const f = ease(M.clamp((u - s0) / d, 0, 1));
        const a = pos(from, k), b = pos(to, k);
        x = M.lerp(a[0], b[0], f); y = M.lerp(a[1], b[1], f);
        S = to;
      }
      out.push({ media: M.mod(M.mod(k, K), n), x, y, z: (K - k) * 0.002, w, h, layer: K - k,
        shadow: p.shadow ? undefined : 0 });
    }
    return out;
  },
};
