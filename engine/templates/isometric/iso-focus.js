import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
import { beats } from '../../lib.js';
import { isoMat, isoEuler, isoCard, isoCamera } from './_iso.js';
// Isometric line of cards: past cards packed tight on one side, upcoming on the other, the focus card alone in the middle.
export default {
  id: 'iso-focus', name: 'Iso Focus', category: 'isometric', slots: 10,
  desc: 'Isometric card stack that steps one card at a time into a spotlight gap in the centre',
  tags: ['isometric', 'stack', 'focus', 'stepped', 'product'], ref: 'animos',
  params: {
    cornerRadius: P.cornerRadius(),
    cardSize: P.pct('Card size', 42, 10, 100),
    tilt: P.pct('Tilt', 20),
    spacing: P.pct('Spacing', 20, 0, 100),
    focusGap: P.pct('Focus gap', 85, 0, 200),
    centerScale: P.pct('Center scale', 100, 50, 200),
    ease: P.choice('Easing', 'custom', EASINGS),
    cardRatio: P.cardRatio(),
    direction: P.choice('Direction', 'down-left', ['down-left', 'up-right']),
    hold: P.pct('Hold between steps', 62, 0, 90),
  },
  shadow: true, shadowOpacity: 0.3, sheen: 0,
  duration: 12,
  camera: isoCamera,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const pitch = M.rad(p.tilt * 1.2);
    const yaw = -M.rad(24);
    const R = isoMat(pitch, yaw); const e = isoEuler(R);
    // steps through a fixed number of beats (the template's 10 slots) regardless of media count;
    // the move starts ~20% into each beat so the focused card has settled at the beat midpoints (as animos)
    const S = 10, lead = 0.27 / S;
    const f = beats(M.fract(u - lead), S, 1 - p.hold / 100, easeOf(p.ease));   // continuous focus index
    const flip = p.direction === 'up-right' ? -1 : 1;
    const sc = Math.sqrt(Math.min(1, ctx.aspect));
    const W = (p.cardSize / 100) * sc / Math.cos(yaw);
    const H = W / cardAR(ctx, 1.0);
    const sp = (p.spacing / 100) * 1.25 * sc, G = (p.focusGap / 100) * 0.92 * sc;
    const out = [];
    const fi = Math.round(f);
    for (let k = fi - 9; k <= fi + 9; k++) {
      const d = k - f;                                   // >0 upcoming, <0 past
      const off = Math.max(d, -1) * sp + G * M.clamp(d, -1, 1) * (d < 0 ? 0.88 : 0.86);
      const s = 1 + (p.centerScale / 100 - 1) * Math.max(0, 1 - Math.abs(d));
      const media = (((k % S) + S) % S) % n;
      // the past pile sits a little higher than the line through the focus card (animos)
      const past = Math.max(0, -d), lift = M.clamp(past, 0, 1) * 0.095 * sc;
      const cs = isoCard(R, e, [0, 0, -off * flip], W * s, H * s, { media });
      // older cards beyond the first pile card step down-left on screen, a tight rising pile (animos)
      const old = Math.max(0, past - 1) * (p.spacing / 20);
      for (const c of cs) { c.x += -old * 0.055 * sc * flip; c.y += (lift - old * 0.04 * sc) * flip; c.z += old * 0.02; }
      out.push(...cs);
    }
    return out;
  },
};
