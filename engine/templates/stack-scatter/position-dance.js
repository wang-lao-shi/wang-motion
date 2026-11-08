import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
// Position Dance (animos replica): six cards of different sizes hop between three scattered
// compositions (A -> B -> C -> A). Every card changes both position and size on each move.
// Layout data measured from the reference (square frame, frame height = 1, origin centre, y up):
// [cx, cy, w] per card, media 0..5.
const PX = 644; // reference tile size used for measurement
const raw = {
  A: [[280, 402, 200], [117, 523, 118], [523, 522, 196], [390, 123, 249], [515, 322, 177], [99, 228, 132]],
  B: [[85, 331, 140], [189, 522, 178], [359, 310, 257], [516, 123, 98], [516, 532, 124], [158, 105, 199]],
  C: [[118, 526, 240], [306, 320, 178], [117, 152, 158], [516, 372, 248], [325, 532, 125], [447, 129, 200]],
};
const norm = (a) => a.map(([x, y, w]) => [(x - PX / 2) / PX, (PX / 2 - y) / PX, w / PX]);
const LAYOUTS = [norm(raw.A), norm(raw.B), norm(raw.C)];
const REF_INNER = 0.88;          // reference padding 6% each side
const REF_SIZE = 0.28;           // reference Card size default
const Z = [1, 2, 4, 3, 5, 6];    // paint order observed (6 on top, then 5, 3, 4, 2, 1)
// timeline (loop phase): start of each move A->B, B->C, C->A ; holds fill the rest
const STARTS = [0.084, 0.428, 0.756];

export default {
  id: 'position-dance', name: 'Position Dance', category: 'stack-scatter', slots: 6,
  desc: 'Six cards of mixed sizes swap places and sizes between three scattered compositions',
  tags: ['scatter', 'shuffle', 'rearrange', 'collage', 'step'], ref: 'animos',
  params: base({
    padding: P.padding(6),
    cornerRadius: P.cornerRadius(4),
    cardSize: P.pct('Card size', 28, 5, 100),
    spacing: P.pct('Spacing', 0, -50, 100),
    ease: P.choice('Easing', 'smooth', EASINGS),
    cardRatio: P.cardRatio('auto'),
    shadow: P.bool('Shadow', true),
    moveLength: P.pct('Move length', 26, 5, 33),
  }),
  shadow: true, shadowOpacity: 0.4,
  duration: 4,
  layout(ctx) {
    const { p, u, M, inner: I } = ctx;
    const ease = easeOf(p.ease);
    const L = Math.max(0.02, Math.min(0.33, p.moveLength / 100));
    // which segment are we in: find last move start <= u (cyclic)
    let from = 2, f = 0, uu = u;
    for (let k = 0; k < 3; k++) {
      const s = STARTS[k];
      let d = M.mod(uu - s, 1);
      if (d < L) { from = k; f = ease(d / L); break; }
      // holding after move k
      const next = STARTS[(k + 1) % 3];
      if (M.mod(uu - s, 1) < M.mod(next - s, 1)) { from = k; f = 1; break; }
    }
    const a = LAYOUTS[from], b = LAYOUTS[(from + 1) % 3];
    const sx = I.w / REF_INNER, sy = I.h / REF_INNER;
    const unit = Math.min(I.w, I.h) / REF_INNER * (p.cardSize / 100 / REF_SIZE);
    const spread = 1 + p.spacing / 100;
    const r = cardAR(ctx, 1.04);
    const out = [];
    for (let i = 0; i < 6; i++) {
      const x = M.lerp(a[i][0], b[i][0], f) * sx * spread;
      const y = M.lerp(a[i][1], b[i][1], f) * sy * spread;
      const w = M.lerp(a[i][2], b[i][2], f) * unit;
      out.push({ media: i, x, y, z: Z[i] * 0.001, w, h: w / r, layer: Z[i], shadow: p.shadow ? undefined : 0 });
    }
    return out;
  },
};
