import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
const RADIUS_GAIN = 1.2;   // corner radius vs engine default
const ENTER_DROP = 1.0;    // entering post's extra lag below its slot, in row pitches, × (1-entry)
// A social-feed column that flicks upward one post at a time; posts weave across lanes and
// overlap, each new post fading (or sliding) in at the bottom.
export default {
  id: 'feed-scroll', name: 'Feed Scroll', category: 'grid', slots: 12,
  desc: 'Overlapping posts weaving across lanes, flicking up one at a time like a feed',
  tags: ['feed', 'scroll', 'social', 'stack', 'flick', 'vertical'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 52, 10, 100),
    spacing: P.pct('Spacing', 66, 10, 200),
    laneSpread: P.pct('Lane spread', 100, 0, 200),
    flickLength: P.pct('Flick length', 100, 5, 100),
    fadeIn: P.pct('Fade in', 50, 0, 100),
    stagger: P.pct('Stagger', 0, 0, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    motion: P.choice('Motion', 'flicks', ['flicks', 'steady']),
    enterBy: P.choice('Card enters by', 'fade', ['fade', 'slide']),
    cardRatio: P.cardRatio(),
    shadow: P.bool('Shadow', true),
    loopCards: P.num('Cards per loop', 12, 2, 24),
  }),
  shadow: true, shadowOpacity: 0.5, sheen: 0.06,
  duration: 10,
  layout(ctx) {
    const { p, n, u, M, inner: I, view: V } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const ar = cardAR(ctx, 1.75);
    let w = (p.cardSize / 100) * 0.87 * Math.min(1, I.w / 0.88), h = w / ar;
    const py = h * (p.spacing / 100);
    const lane = 0.22 * (p.laneSpread / 100) * Math.min(1, I.w / 0.88);
    const x = u * K; const k = Math.floor(x);
    // 'custom' = a gentle flick spanning the beat: ~60% through at half-beat, settles at the end
    const fe = p.ease === 'custom' ? (t) => 1 - Math.pow(1 - t, 1.35) : easeOf(p.ease);
    const s = p.motion === 'steady' ? x : k + fe(Math.min(1, (x - k) / Math.max(0.05, p.flickLength / 100)));
    const yEnter = -V.h / 2 + 0.22;                       // resting place of the newest post
    const y0 = yEnter + 0.038 + 5 * py;                   // front post rests 5 rows below the anchor
    const out = [];
    const above = Math.ceil((V.h / 2 + h / 2 - y0) / py) + 1;
    const span = Math.ceil(1.4 / py) + 2;
    for (let j = Math.floor(s) - above; j <= Math.floor(s) + span; j++) {
      const m = M.mod(j, K);
      const st = (p.stagger / 100) * 0.4 * Math.sin(j * 1.7);
      const y = y0 - (j - s + st) * py;
      if (y - h / 2 > V.h / 2 + 0.05) continue;
      // entering: the card at the bottom of the feed fades/slides in over its last spacing
      const ent = M.clamp((y - (yEnter - py + 0.05)) / (py * 0.6 * Math.max(0.05, p.fadeIn / 50)));  // hidden at rest, visible by mid-flick
      if (ent <= 0.001) continue;
      // animos corners read ~1.2x the frame-capped default (engine caps at 0.25·min(aspect,1)/minSide)
      const radiusMul = RADIUS_GAIN * Math.min(1, 0.25 * Math.min(V.w, 1) / Math.min(w, h));
      const card = { media: M.mod(m, n), x: lane * Math.sin((j - 3) * Math.PI / 2), y, w, h, layer: j, radiusMul };
      if (p.enterBy === 'slide') { card.y -= (1 - ent) * 0.25; card.opacity = Math.min(1, ent * 3); }
      else {
        // fade: the entering post trails a little lower (wider last gap, like animos) and is fully opaque by mid-entry
        const e2 = M.clamp((y - (yEnter + 0.038 - py)) / py);   // linear progress over the final pitch
        const op = M.clamp(e2 * 2 * 50 / Math.max(5, p.fadeIn));
        card.y -= (1 - e2) * ENTER_DROP * py; card.opacity = op; card.bright = 0.5 + 0.5 * op;
      }
      out.push(card);
    }
    return out;
  },
};
