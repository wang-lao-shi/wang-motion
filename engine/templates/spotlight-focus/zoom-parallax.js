import { base, P, EASINGS, easeOf } from '../_common.js';
import { frameRadiusMul } from '../reveal-wipe/_frame.js';
// Full-frame card: each image slowly zooms and pans (alternating direction), cross-dissolving into the next.
export default {
  id: 'zoom-parallax', name: 'Zoom Parallax', category: 'spotlight-focus', slots: 3,
  desc: 'Full-frame Ken-Burns zoom + pan per image with soft cross-dissolves',
  tags: ['spotlight', 'ken burns', 'zoom', 'slideshow'], ref: 'animos',
  params: base({
    zoomAmount: P.pct('Zoom amount', 12, 0, 60),
    ease: P.choice('Easing', 'custom', EASINGS),
    panDirection: P.choice('Pan direction', 'alternate', ['alternate', 'left', 'right']),
    fade: P.pct('Cross-fade length', 25, 2, 60),
    loopCards: P.num('Cards per loop', 3, 1, 24),
  }),
  shadow: false,
  duration: 9,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const K = Math.max(1, Math.round(p.loopCards));
    const ease = easeOf(p.ease);
    const F = p.fade / 100;           // cross-fade fraction of a step
    const off = 0.78;                 // fade into image j is centred at (j + off - 1)/K ... ref: dissolve ~0.12 step before the beat
    const Z = p.zoomAmount / 100;
    const card = (j, life, o) => {
      // life 0..1 over the image's visible span (incl. both fades)
      const dir = p.panDirection === 'left' ? -1 : p.panDirection === 'right' ? 1 : (M.mod(M.mod(j, K), 2) ? -1 : 1);
      const e = M.lerp(life, ease(life), 0.35);
      const zoom = 1 + Z * e;
      const pan = -dir * (e - 0.5) * Z * 1.0;   // panX>0 moves the view the other way: 'right' / alternate-first pans the image to the right like animos
      return { media: M.mod(M.mod(j, K), n), x: 0, y: 0, w: I.w, h: I.h, zoom, panX: pan, opacity: o, shadow: 0 };
    };
    const x = u * K + (1 - off); // beat j starts (fully visible after fade) here
    const j = Math.floor(x), f = x - j;
    const span = 1 + F;
    const out = [];
    if (f < F) { // dissolving from j-1 to j
      const q = ease(f / F);
      out.push(card(j - 1, (1 + f) / span, 1));
      out.push({ ...card(j, f / span, q), z: 0.001 });
    } else out.push(card(j, f / span, 1));
    const rm = frameRadiusMul(ctx, I.w, I.h); out.forEach((c) => (c.radiusMul = rm));
    return out;
  },
};
