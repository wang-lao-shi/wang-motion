import { base, P, EASINGS, easeOf } from '../_common.js';
import { frameRadiusMul } from '../reveal-wipe/_frame.js';
// Big focus card + a rail of three thumbnails. Each step the top rail card morphs up into the big slot,
// the rail shifts up one slot and the previous big card shrinks into the last rail slot.
// Landscape/square: rail on the right; portrait: rail along the bottom.
export default {
  id: 'focus-shift', name: 'Focus Shift', category: 'spotlight-focus', slots: 4,
  desc: 'Big focus card with a 3-card rail; the next rail card morphs into focus while the old one drops to the rail',
  tags: ['spotlight', 'focus', 'rail', 'morph', 'step', 'gallery'], ref: 'animos',
  params: base({
    railSize: P.pct('Rail size', 26, 10, 50),
    gap: P.num('Gap', 2.5, 0, 10, '%', 0.5),
    ease: P.choice('Easing', 'custom', EASINGS),
    shadow: P.bool('Shadow', true),
    loopCards: P.num('Cards per loop', 4, 2, 24),
    railCount: P.num('Rail cards', 3, 1, 6),
  }),
  shadow: true, shadowOpacity: 0.2,
  duration: 10,
  layout(ctx) {
    const { p, n, u, M, inner: I } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const R = Math.max(1, Math.round(p.railCount));
    const ease = easeOf(p.ease);
    const g = p.gap / 100;
    const portrait = I.w < I.h * 0.95;
    const x0 = -I.w / 2, y1 = I.h / 2; // left / top of the inner box
    let big, slot;
    if (!portrait) {
      const gw = g * I.w, rw = I.w * p.railSize / 100, bw = I.w - rw - gw;
      const rh = (I.h - gw * (R - 1)) / R;
      big = { x: x0 + bw / 2, y: 0, w: bw, h: I.h };
      slot = (k) => ({ x: x0 + bw + gw + rw / 2, y: y1 - rh / 2 - k * (rh + gw), w: rw, h: rh });
    } else {
      const gh = g * I.h, rh = I.h * p.railSize / 100, bh = I.h - rh - gh;
      const rw = (I.w - gh * (R - 1)) / R;
      big = { x: 0, y: y1 - bh / 2, w: I.w, h: bh };
      slot = (k) => ({ x: x0 + rw / 2 + k * (rw + gh), y: y1 - bh - gh - rh / 2, w: rw, h: rh });
    }
    const lerpR = (a, b, q) => ({ x: M.lerp(a.x, b.x, q), y: M.lerp(a.y, b.y, q), w: M.lerp(a.w, b.w, q), h: M.lerp(a.h, b.h, q) });
    const x = u * K, j = Math.floor(x), f = x - j;
    const q = ease(M.clamp((f - 0.08) / 0.40));
    const med = (i) => M.mod(M.mod(i, K), n);
    const out = [];
    // before: big = j-1, rail k = j+k ; after: big = j, rail k = j+1+k, last slot = j-1
    out.push({ media: med(j - 1), ...lerpR(big, slot(R - 1), q), z: 0.001 * Math.sin(Math.PI * q), layer: 1 });
    for (let k = 1; k < R; k++) out.push({ media: med(j + k), ...lerpR(slot(k), slot(k - 1), q), z: 0, layer: 0 });
    // incoming card drawn on top
    out.push({ media: med(j), ...lerpR(slot(0), big, q), z: 0.002 * Math.sin(Math.PI * q), layer: 2 });
    out.forEach((c) => (c.radiusMul = frameRadiusMul(ctx, c.w, c.h)));
    if (!p.shadow) out.forEach((c) => (c.shadow = 0));
    return out;
  },
};
