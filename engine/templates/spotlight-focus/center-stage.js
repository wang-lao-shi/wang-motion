import { base, P, EASINGS, easeOf } from '../_common.js';
import { frameRadiusMul } from '../reveal-wipe/_frame.js';
// One big card on stage: each beat it glides in from the right, holds centre stage, then slides out to the left
// (optional ghost trail of lagging, fading copies while it moves).
export default {
  id: 'center-stage', name: 'Center Stage', category: 'spotlight-focus', slots: 3,
  desc: 'Single hero card glides in from the right, holds centre, exits left with a ghost trail',
  tags: ['spotlight', 'hero', 'slide', 'step', 'ghost'], ref: 'animos',
  params: base({
    travelDistance: P.pct('Travel distance', 60, 0, 150),
    ghostTrail: P.bool('Ghost trail', true),
    cardSize: P.pct('Card size', 86, 20, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    shadow: P.bool('Shadow', true),
    loopCards: P.num('Cards per loop', 3, 1, 24),
  }),
  shadow: true, shadowOpacity: 0.25,
  duration: 7,
  layout(ctx) {
    const { p, n, u, M, inner: I, view } = ctx;
    const K = Math.max(1, Math.round(p.loopCards));
    const ease = easeOf(p.ease);
    const cs = p.cardSize / 100;
    const w = I.w * cs, h = I.h * cs;
    const D = view.w * p.travelDistance / 100;
    // pose of the card inside its step at local time f (0..1): x offset + opacity
    const pose = (f) => {
      if (f < 0.27) { const q = ease(M.clamp((f - 0.02) / 0.25)); return { x: D * (1 - q), o: M.clamp(q * 1.25) }; }
      if (f < 0.75) return { x: 0, o: 1 };
      const q = ease(M.clamp((f - 0.75) / 0.25)); return { x: -D * q, o: 1 - q * q };
    };
    const x = u * K, j = Math.floor(x), f = x - j;
    const media = M.mod(M.mod(j, K), n);
    const out = [];
    const a = pose(f);
    if (p.ghostTrail) {
      for (let g = 4; g >= 1; g--) {
        const b = pose(Math.max(0, f - g * 0.022));
        const mv = Math.abs(b.x - a.x);
        if (mv < 0.012) continue;
        out.push({ media, x: b.x, y: 0, z: -0.002 * g, w, h, opacity: b.o * 0.32 * (1 - g / 5) * Math.min(1, mv / 0.03), shadow: 0 });
      }
    }
    out.push({ media, x: a.x, y: 0, z: 0, w, h, opacity: a.o });
    const rm = frameRadiusMul(ctx, w, h); out.forEach((c) => (c.radiusMul = rm));
    return out;
  },
};
