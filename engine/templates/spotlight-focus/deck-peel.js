import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
import { frameRadiusMul } from '../reveal-wipe/_frame.js';
// A deck seen from the front: up to 3 cards peek out above the front card (each level raised + slightly smaller).
// Each step the front card lifts up and over the deck, slips behind, and drops into the back slot
// while the rest of the deck advances one level.
export default {
  id: 'deck-peel', name: 'Deck Peel', category: 'spotlight-focus', slots: 4,
  desc: 'Stacked deck with peeking cards; the front card peels up over the top and drops to the back',
  tags: ['spotlight', 'deck', 'stack', 'peel', 'step', 'cards'], ref: 'animos',
  params: base({
    cardSize: P.pct('Card size', 48, 10, 100),
    stackPeek: P.num('Stack peek', 4.0, 0, 15, '%', 0.5),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio('auto'),
    shadow: P.bool('Shadow', true),
    loopCards: P.num('Cards per loop', 4, 2, 24),
    stackDepth: P.num('Cards behind', 3, 1, 6),
    lift: P.pct('Lift height', 100, 0, 200),
  }),
  shadow: true, shadowOpacity: 0.15,
  duration: 9,
  layout(ctx) {
    const { p, n, u, M, view } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const D = Math.max(1, Math.min(K - 1, Math.round(p.stackDepth))); // levels behind the front (mid-step)
    const ease = easeOf(p.ease);
    const ar = cardAR(ctx, 1.04);
    const peek = p.stackPeek / 100 * 1.125; // animos 'Stack peek 4%' spaces the strips ~4.5% of the frame
    // card size relative to the shorter frame side, kept inside the frame incl. the peeking stack
    let w = Math.min(view.w, 1) * p.cardSize / 100, h = w / ar;
    const maxH = 0.9 - (D + 1) * peek; if (h > maxH) { h = maxH; w = h * ar; }
    // vertical placement: square/landscape sits just above centre like the reference; portrait is centred
    const cy = -(D + 0.5) * peek / 2;            // centres front card + stack
    const pw = M.clamp((view.w - 0.5625) / (1 - 0.5625));
    const y0 = M.lerp(cy, 0.015 - D * peek / 6, pw) + 0.01 * pw; // +0.01: ref front card bottom sits ~9px (932) higher
    // level k: top edge raised k*peek above the front card's top, scaled 0.97^k
    const lvl = (k) => { const s = Math.pow(0.97, k); return { y: y0 + k * peek + (h - h * s) / 2, s }; };
    const x = u * K, j = Math.floor(x), f = x - j;
    const q = ease(M.clamp((f - 0.08) / 0.45));
    const med = (i) => M.mod(M.mod(i, K), n);
    const rm = (cw, ch) => frameRadiusMul(ctx, cw, ch);
    const out = [];
    // deck behind: card at level k (1..D+1) moves to level k-1 ; its media = j+k.
    // Level D+1 holds the previously peeled card, so a step starts with D+1 cards peeking and drops to D mid-step.
    for (let k = 1; k <= D + 1; k++) {
      const a = lvl(k), b = lvl(k - 1);
      const kk = M.lerp(k, k - 1, q);
      out.push({ media: med(j + k), x: 0, y: M.lerp(a.y, b.y, q), z: 0.01 - 0.01 * kk, w: w * M.lerp(a.s, b.s, q), h: h * M.lerp(a.s, b.s, q),
        bright: 1 - 0.06 * kk, layer: 10 - Math.round(kk * 2), rk: 1 + 0.8 * M.clamp(kk) });
    }
    // the peeling card (media j): lifts from level 0 up over the deck, goes behind and drops to level D (hidden behind
    // the deck), then rises into the extra back level D+1 where it waits for the next peel
    const t = M.clamp((f - 0.08) / 0.45);
    const e = ease(t);
    const top = lvl(D), front = lvl(0), back = lvl(D + 1);
    const liftH = (h * 0.9 + D * peek) * p.lift / 100;
    const arc = Math.sin(Math.PI * Math.min(1, e)) * liftH;
    const r = ease(M.clamp((f - 0.6) / 0.35));
    const y = M.lerp(front.y, top.y, e) + arc + (back.y - top.y) * r;
    const s = M.lerp(front.s, top.s, e) * (1 - 0.12 * Math.sin(Math.PI * e)) * M.lerp(1, back.s / top.s, r);
    const behind = e > 0.5; // passes over the top, then slips behind the deck
    // while fully hidden behind the top deck card (between the peel and the rise) it takes the media the back slot
    // holds at the next step's start (j+D+2), so the back strip shows the same image across the step boundary
    const pm = f > 0.565 ? med(j + D + 2) : med(j);
    out.push({ media: pm, x: 0, y, z: behind ? 0.01 - 0.01 * (D + r) : 0.01, w: w * s, h: h * s, // z matches the deck level it ends in (seamless step boundary)
      rx: -0.18 * Math.sin(Math.PI * e), bright: 1 - 0.06 * (D + r) * e, layer: behind ? -1 : 20, rk: 1 + 0.8 * e });
    // corners: front card frame-relative; cards behind it read ~1.8x rounder on the ref strips (~27px vs 14.5px at 932),
    // blended by depth (rk) so the advancing/peeling cards change smoothly and the step boundary stays seamless.
    // zoom 1.0: the ref strips show a ~10px colour band above the media's white bar (1.04 cropped it)
    out.forEach((c) => { c.radiusMul = rm(c.w, c.h) * c.rk; delete c.rk; c.zoom = 1.0; });
    if (!p.shadow) out.forEach((c) => (c.shadow = 0));
    return out;
  },
};
