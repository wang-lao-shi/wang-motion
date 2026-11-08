import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
// Prism Converge (original, T18 #36): one hero card per beat. It arrives as three additive R/G/B copies split along a
// direction (per-beat subtle variation), which converge with an outExpo snap; at the moment they lock a thin rainbow
// anamorphic streak (stacked R/G/B lens streaks + white core) flashes through the card and a soft prism glow blooms
// behind it. The card holds clean, then leaves by splitting again (inCubic, fading) while the next one converges.
// Exact colour at rest: the split copies are tinted pure #f00/#0f0/#00f (multiply) and added over a black backing card
// (normal blend, carries the shadow), so R+G+B = the original image; once converged the stack is replaced by ONE plain
// media card (identical pixels), so the hold is the untouched image. Media: beat j shows mod(mod(j,K),n) → seamless.
// No engine extension needed: per-channel copies are emulated with X5 `tint` multiply + X7 `blend:'add'`.
const CH = [['#ff0000', -1], ['#00ff00', 0], ['#0000ff', 1]];
const oExpo = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10)));

export default {
  id: 'prism-converge', name: 'Prism Converge', category: 'light-fx', slots: 12,
  desc: 'Hero card arrives as three additive red/green/blue copies that snap together into the clean image with a rainbow anamorphic streak flash, holds, then splits apart again as the next converges',
  tags: ['rgb', 'split', 'chromatic', 'prism', 'converge', 'streak', 'anamorphic', 'flash', 'light', 'hero', 'slideshow', 'premium'],
  ref: 'original',
  params: base({
    split: P.pct('Split distance', 9, 0, 30),
    streak: P.pct('Streak intensity', 60, 0, 100),
    direction: P.deg('Split direction', 0, -90, 90),
    hold: P.pct('Hold', 55, 40, 75),
    K: P.choice('Beats per loop', '12', ['6', '8', '10', '12']),
  }),
  shadow: true, shadowOpacity: 0.55, depthWrite: false, duration: 15, background: '#07070a',
  camera() { return { perspective: 30 }; },
  layout(ctx) {
    const { p, u, n, M, inner: I, aspect } = ctx;
    const K = Math.max(2, parseInt(p.K, 10) || 12);
    // hero size: shape follows the frame so every ratio is filled (≥ ~50% of the frame area)
    const ar = cardAR(ctx, aspect >= 1.2 ? 1.5 : aspect >= 0.8 ? 1.05 : 0.68);
    let w = I.w * (aspect >= 1.2 ? 0.72 : aspect >= 0.8 ? 0.8 : 0.82), h = w / ar;
    const hm = I.h * (aspect >= 0.8 ? 0.8 : 0.72); if (h > hm) { h = hm; w = h * ar; }
    const H = M.clamp(p.hold / 100, 0.4, 0.8), T = 1 - H, ov = 0.03;   // short overlap: next arrives as the last exit dies
    const eEnd = 0.6 * T, xStart = 1 - 0.4 * T;                       // entry g∈[-ov,eEnd], hold, exit g∈[xStart,1]
    const S = (p.split / 100) * w;
    const st = M.clamp(p.streak / 100, 0, 1);
    const ss = Math.min(aspect, 1);                                     // frame short side (frame height = 1)
    const x = u * K + 0.5;                                              // u=0 sits mid-hold of beat 0 → seam on a clean frame
    const j0 = Math.floor(x);
    const out = []; let flashSum = 0;
    for (const j of [j0, j0 + 1]) {
      const g = x - j;
      if (g < -ov || g >= 1) continue;
      const jj = M.mod(j, K), media = M.mod(jj, n);
      const th = M.rad(p.direction + (M.rand(jj, 31) - 0.5) * 24);     // subtle per-beat variation of the split axis
      const dx = Math.cos(th), dy = Math.sin(th);
      let off = 0, op = 1, s = 1, z = 0, clean = false, flash = 0, boost = 0;
      if (g < eEnd) {                                                   // arrival: converge (outExpo) with a punch at lock
        const q = (g + ov) / (eEnd + ov), a = oExpo(q);
        const bump = Math.exp(-Math.pow((q - 0.3) / 0.1, 2));          // lock overshoot, peaks at q≈0.3, ≈0 by q≈0.6
        off = S * (1 - a); op = M.smooth(0, 0.25, q); s = 1 - 0.05 * (1 - a) + 0.026 * bump; z = -0.04 * (1 - a);
        boost = 0.09 * bump;                                            // brief brightness overshoot (additive media copy)
        flash = Math.exp(-Math.pow((q - 0.3) / 0.09, 2)) + (q > 0.3 ? Math.exp(-(q - 0.3) * 6) * 0.35 : 0);
        flash = Math.min(1, flash) * M.smooth(1, 0.9, q);
      } else if (g < xStart) clean = true;                              // hold: the untouched image
      else {                                                            // exit: split again (1.0× split) and fade
        const q = (g - xStart) / (1 - xStart), e = E.inCubic(q);
        off = -S * e; op = 1 - E.inQuad(M.clamp(q / 0.88)); s = 1 + 0.03 * E.inQuad(q); z = 0.03 * e;   // fully gone just before the next beat overlaps
        flash = 0.2 * Math.sin(Math.PI * M.clamp(q * 1.6)) * (1 - q);
        if (q <= 0) clean = true;
      }
      flashSum = Math.max(flashSum, flash);
      const card = { media, x: 0, y: 0, z, w: w * s, h: h * s };
      const B = j === j0 ? 0 : 3;                                       // own layer band per beat: incoming (3–5) fully above outgoing (0–2)
      if (clean) { out.push({ ...card, layer: B + 1 }); }
      else {
        out.push({ ...card, useMedia: false, color: '#000000', opacity: op, layer: B });   // black backing + shadow (occludes the beat below)
        for (const [col, k] of CH) {
          out.push({ ...card, x: dx * off * k, y: dy * off * k, tint: col, blend: 'add', opacity: op, shadow: 0, layer: B + 1 });
        }
        if (boost > 0.003) out.push({ ...card, blend: 'add', opacity: boost * op, shadow: 0, layer: B + 2 });
      }
      // anamorphic flare at convergence: horizontal (±2.5° per beat), soft elliptical core + halo, R/G/B fringe lines
      if (flash * st > 0.002) {
        const f = flash * st, rz = M.rad((M.rand(jj, 37) - 0.5) * 5), ca = Math.cos(rz), sa = Math.sin(rz);
        const nx = -sa, ny = ca, FW = aspect, d = 0.015 * ss;
        const SB = { blend: 'add', rz, z: z + 0.002 };
        out.push({ ...SB, light: { type: 'radial', stops: [[0, '#c8d4ff', 0.32], [0.35, '#a99cff', 0.1], [1, '#a99cff', 0]] }, w: FW * 0.7, h: 0.15 * ss, opacity: 0.6 * f, layer: 10 });
        [['#ff3a24', 1], ['#34ff6a', 0], ['#3a68ff', -1]].forEach(([c, k], i) => {
          out.push({ ...SB, light: { type: 'radial', stops: [[0, c, 0.85], [0.25, c, 0.4], [0.6, c, 0.08], [1, c, 0]] }, x: nx * d * k, y: ny * d * k, w: FW * 0.7, h: 0.045 * ss, opacity: 0.7 * f, layer: 11 + i });
        });
        out.push({ ...SB, light: { type: 'radial', falloff: 1.6, stops: [[0, '#eef2ff', 0.6], [0.5, '#eef2ff', 0.14], [1, '#eef2ff', 0]] }, w: FW * 0.72, h: 0.022 * ss, opacity: 0.6 * f, layer: 14 });
        out.push({ ...SB, light: { type: 'radial', stops: [[0, '#ffffff', 1], [0.3, '#fff6ea', 0.7], [0.65, '#fff6ea', 0.15], [1, '#ffffff', 0]] }, w: FW * 0.55, h: 0.04 * ss, opacity: 0.85 * f, layer: 15 });
        out.push({ light: { type: 'radial', stops: [[0, '#ffffff', 0.5], [0.4, '#d8e4ff', 0.12], [1, '#d8e4ff', 0]] }, blend: 'add', x: 0, y: 0, z: z + 0.003, w: Math.min(w, h) * 0.45, h: Math.min(w, h) * 0.45, opacity: 0.55 * f, layer: 16 });
      }
    }
    // soft prism backdrop glow (behind everything), swells with the flash
    const gw = w * 1.7, gh = h * 1.7;
    out.push({ light: { type: 'radial', stops: [[0, '#9fb2ff', 0.2], [0.5, '#6f5cff', 0.07], [1, '#ff5ca8', 0]] }, blend: 'add', x: 0, y: 0, z: -0.08, w: gw, h: gh, opacity: 0.55 + 0.45 * flashSum * st, layer: -5 });
    out.push({ light: { type: 'radial', stops: [[0, '#ffd2a8', 0.1], [1, '#ffd2a8', 0]] }, blend: 'add', x: 0, y: -h * 0.1, z: -0.07, w: gw * 1.25, h: gh * 0.9, opacity: 0.6, layer: -4 });
    return { cards: out, post: flashSum * st > 0.02 ? { bloom: { amount: 0.5 * flashSum * st, threshold: 0.85, radius: 0.02 } } : null };
  },
};
