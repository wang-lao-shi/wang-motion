// zoom-punch — original. Full-frame slideshow cut with zoom punches: on each cut the current image
// rushes into its centre (inQuart zoom + radial blur ramp + light streaks bursting from the centre),
// the cut lands on a held white flash, and the next image arrives zoomed in and blurred, snaps back
// with a small outBack overshoot and holds crisp under a slow push-in.
import { base, P } from '../_common.js';
import { E } from '../../lib.js';

// outBack with a custom overshoot constant (s≈1.2 → ~5% of the travel, i.e. ~2% zoom here)
const outBackS = (t, s) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

export default {
  id: 'zoom-punch', name: 'Zoom Punch', category: 'transitions',
  slots: 12,
  desc: 'Full-frame slideshow cut with zoom punches: radial-blur rush into the centre with light streaks, held flash, next image snaps back from 1.4× with a small overshoot.',
  tags: ['transition', 'slideshow', 'zoom', 'punch', 'radial blur', 'light streak', 'cinematic', 'full-frame'],
  ref: 'original',
  params: base({
    padding: P.padding(0),
    K: P.num('Images per loop', 12, 2, 24),
    zoomMax: P.num('Punch zoom', 1.8, 1.2, 3, '×', 0.05),
    radialBlur: P.pct('Radial blur', 65, 0, 100),
    punchDur: P.pct('Punch length (% of beat)', 14, 6, 30),
    flash: P.pct('Flash', 50, 0, 100),
  }),
  shadow: false,
  duration: 18,
  layout(ctx) {
    const { p, u, n, inner, M } = ctx;
    const K = Math.max(2, Math.round(p.K));
    const W = inner.w, H = inner.h, L = Math.max(W, H);
    const bleed = (p.padding ?? 0) <= 0.001;
    const x = u * K + 0.5; // u=0 sits mid-hold, so the loop point is never a cut
    const k = Math.floor(x) % K; const f = x - Math.floor(x);
    const pd = M.clamp(p.punchDur / 100, 0.04, 0.35);
    const sd = Math.min(0.5, pd * 2.6);              // settle window after the cut
    const zMax = Math.max(1.05, p.zoomMax);
    const R = 1.025;                                  // rest zoom: leaves room for the overshoot (never < 1)
    const zIn = R + (zMax - 1) * 0.5;                 // incoming starts here (~1.4× at default)
    const rb = (p.radialBlur / 100) * 0.28;           // capped: 4 interleaved copies × 8 taps = 32 taps
    const creep = 0.045;                              // slow push during the hold
    const flash = p.flash / 100;
    const hold1 = 1 / (ctx.spec?.fps || 30) / ((ctx.dur || 18) / K); // one frame, in beat units
    const mediaOf = (j) => M.mod(M.mod(j, K), n);
    let zoom, blur, fl, burst;
    const qo = M.clamp((f - (1 - pd)) / pd, 0, 1);   // punch-out progress (end of beat)
    const qi = M.clamp(f / sd, 0, 1);                 // settle progress (start of beat)
    if (qo > 0) {
      const e = E.inQuart(qo);
      zoom = (R + creep) + (zMax - R - creep) * e;
      blur = rb * Math.pow(qo, 1.4);
      fl = Math.pow(qo, 3);
      burst = E.inCubic(qo);
    } else if (qi < 1) {
      zoom = Math.max(1.002, zIn + (R - zIn) * outBackS(qi, 1.2)); // ~2% overshoot at default, never below cover
      blur = rb * 0.85 * (1 - E.outQuart(Math.min(1, qi * 1.6)));
      const qf = Math.max(0, (f - hold1) / sd);       // flash peak held for ~1 frame after the cut
      fl = 1 - E.outCubic(Math.min(1, qf * 2.2));
      burst = 1 - E.outCubic(Math.min(1, qf * 3));
    } else { zoom = R; blur = 0; fl = 0; burst = 0; }
    if (qo <= 0) { const hs = sd * 0.6, he = 1 - pd; zoom += creep * E.inOutSine(M.clamp((f - hs) / (he - hs), 0, 1)); }
    const c = { media: mediaOf(k), x: 0, y: 0, z: 0, w: W, h: H, zoom, layer: 1, shadow: 0,
      bright: 1 + 0.3 * fl * flash };
    if (bleed) c.radius = 0; // full-bleed frame: corners are the frame's own
    const cards = [c];
    if (blur > 0.004) {
      c.radialBlur = { amt: blur, cx: 0.5, cy: 0.5 };
      c.rgbSplit = { amt: 0.006 * blur / 0.28, angle: 0 };
      // Interleave the 8 shader taps: a copy at zoom·a with amt·a samples at scales 1 − amt(k+o)/7,
      // i.e. exactly between the base taps. Offsets ½, ¼, ¾ with opacities ½, ⅓, ¼ = equal weights.
      [[0.5, 1 / 2], [0.25, 1 / 3], [0.75, 1 / 4]].forEach(([o, op], i) => {
        const a = 1 / (1 - blur * o / 7);
        cards.push({ ...c, zoom: zoom * a, radialBlur: { amt: blur * a, cx: 0.5, cy: 0.5 }, opacity: op, layer: 2 + i });
      });
    }
    // vignette pulse: darkens the edges as the punch builds, releases on the landing
    const vg = 0.38 * Math.max(qo > 0 ? E.inOutSine(qo) : 0, qo > 0 ? 0 : burst * 0.8);
    // radial light cards are oversized ×1.5 so their inscribed ellipse passes the frame corners (no visible oval)
    const big = (z) => { const r = ctx.fullFrame(z); return { ...r, w: r.w * 1.5, h: r.h * 1.5 }; };
    if (vg > 0.01) {
      cards.push({ light: { type: 'radial', stops: [[0, '#000000', 0], [0.3, '#000000', 0], [0.75, '#000000', 0.8], [1, '#000000', 1]] },
        blend: 'normal', ...big(0.005), opacity: vg, layer: 6 });
    }
    // light streaks radiating from the centre (starburst), additive
    if (burst > 0.01) {
      const NS = 5, rot = mediaOf(k) * 0.7 + (qo > 0 ? 0 : 0.1);
      for (let s = 0; s < NS; s++) {
        const ang = rot + (s / NS) * Math.PI + (s % 2 ? 0.21 : 0);
        const len = L * (0.8 + 0.6 * burst) * (s % 2 ? 0.8 : 1.1);
        cards.push({ light: { type: 'streak', stops: [[0, '#fff8ee', 1], [0.45, '#ffd9b0', 0.45], [1, '#ffb070', 0]] },
          blend: 'add', x: 0, y: 0, z: 0.012, w: len, h: L * (0.035 + 0.035 * burst), rz: ang,
          opacity: 0.34 * burst * (s % 2 ? 0.75 : 1), layer: 7 });
      }
    }
    const fa = fl * flash;
    if (fa > 0.01) {
      cards.push({ light: { type: 'radial', stops: [[0, '#ffffff', 1], [0.45, '#fff4e6', 0.8], [0.7, '#ffe8d0', 0.55], [1, '#ffe8d0', 0.5]] },
        blend: 'add', ...big(0.02), opacity: fa * 0.9, layer: 8 });
    }
    return cards;
  },
};
