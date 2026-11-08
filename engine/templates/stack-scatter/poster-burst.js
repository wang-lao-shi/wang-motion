import { P, CARD_RATIO_OPTS } from '../_common.js';
// Poster Burst (animos replica): one full-frame poster at rest; after a hold the next poster pops up small
// in the centre and bursts outward until it covers the frame, becoming the new resting poster.
const RAT = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 };
const burst = (x) => 1 - Math.pow(1 - x, 2.3); // fast pop, soft landing on full size
export default {
  id: 'poster-burst', name: 'Poster Burst', category: 'stack-scatter', slots: 4,
  desc: 'Full-frame posters: each next poster pops up small in the centre and bursts out to cover the frame',
  tags: ['stack', 'poster', 'burst', 'zoom', 'reveal', 'slideshow', 'step'], ref: 'animos',
  params: {
    cornerRadius: P.cornerRadius(),
    hold: P.pct('Hold time', 30, 0, 90),
    cardRatio: { type: 'choice', label: 'Card ratio', default: 'frame', options: ['frame', ...CARD_RATIO_OPTS] },
    flow: P.choice('Flow', 'oneByOne', ['oneByOne', 'staggered', 'volley']),
    shadow: P.bool('Shadow', true),
    loopCards: P.num('Cards per loop', 4, 2, 24),
    startScale: P.pct('Start scale', 0, 0, 90),
    padding: { ...P.padding(), default: 0 },
  },
  shadow: true, shadowOpacity: 0.22,
  duration: 12,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const bw = I.w, bh = I.h;
    const cr = ctx.spec?.cardRatio || p.cardRatio || 'frame';
    const out = [];
    const size = (media) => {
      const r = cr === 'frame' ? bw / bh : cr === 'auto' ? ctx.ratioOf(media) : (RAT[cr] || bw / bh);
      return r > bw / bh ? [bw, bw / r] : [bh * r, bh];
    };
    const hold = Math.min(0.9, p.hold / 100), s0 = p.startScale / 100;
    const x = u * K, k = Math.floor(x), f = x - k;
    // flow: oneByOne = single burst; staggered = next poster starts early (overlapping bursts);
    // volley = two posters burst in quick succession (the second fires halfway)
    const prog = (lag, dur) => M.clamp((f - hold - lag) / Math.max(0.05, dur), 0, 1);
    const O = 1.03; // resting poster slightly overscaled so its corners sit outside the frame (as in animos)
    const resting = M.mod(M.mod(k - 1, K), n);
    const [rw, rh] = size(resting);
    out.push({ media: resting, x: 0, y: 0, z: 0, w: rw * O, h: rh * O, layer: 0 });
    const mv = 1 - hold;
    // flow: oneByOne = burst after the hold; staggered = burst starts earlier and runs longer;
    // volley = burst is quicker, with a fast pop
    let a;
    if (p.flow === 'staggered') a = prog(-hold * 0.5, mv + hold * 0.5);
    else if (p.flow === 'volley') a = prog(0, mv * 0.6);
    else a = prog(0, mv);
    const media = M.mod(M.mod(k, K), n);
    const [w, h] = size(media);
    if (a > 0) {
      const s = M.lerp(s0, O, burst(a));
      out.push({ media, x: 0, y: 0, z: 0.002, w: w * s, h: h * s, layer: 2, opacity: Math.min(1, a * 12) });
    }
    if (!p.shadow) out.forEach((c) => (c.shadow = 0));
    return out;
  },
};
