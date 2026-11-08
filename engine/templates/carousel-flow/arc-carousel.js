import { base, P, EASINGS, easeOf, cardAR, reflect } from '../_common.js';
// Arc Carousel (original): cards ride a rainbow arch that rises from the bottom-left corner, crests near the top
// and lands in the bottom-right corner. Each beat every card slides one slot along the arch; the arriving crest
// card springs up out of the arch (scale overshoot + z lift + deep contact shadow) and stands on a glossy floor
// (soft light pool + reflection) that fills the inside of the arch.
// Arch: circle through crest and both bottom corners when that circle is shallow (landscape / square); in portrait
// (where that circle would bulge out of the frame as a horseshoe) an ellipse through the same three points with a
// gentler crest, so the legs still land in the corners. Cards are spaced by arc length (lookup table).
// Seamless: slot position s runs 0..K over the loop, media = mod(mod(j, K), n), K = max(n, visible slots).

function archOf(V, yc, cIn) {
  const c = cIn ?? V.w / 2, d = yc + 0.5;
  const Rfit = (c * c + d * d) / (2 * d);
  // top radius of curvature: circle (Rfit) when its centre lies at/below the bottom edge, else blend toward half-ellipse;
  // with an inset half-width (portrait) a plain half-ellipse, so no point of the arch is wider than c
  const Rtop = c >= d ? Rfit : cIn != null ? c * c / d : (c * c / d) + 0.45 * (Rfit - c * c / d);
  const B = (d * d) / (2 * d - (c * c) / Rtop), A = Math.sqrt(Rtop * B);
  const cy = yc - B;
  const N = 480, tab = new Float64Array(N + 1);            // arc length from the crest for phi in [0, PI]
  let px = 0, py = B;
  for (let i = 1; i <= N; i++) {
    const ph = (Math.PI * i) / N, x = A * Math.sin(ph), y = B * Math.cos(ph);
    tab[i] = tab[i - 1] + Math.hypot(x - px, y - py); px = x; py = y;
  }
  const phiAt = (L) => {                                    // signed arc length -> signed phi
    const s = Math.sign(L), a = Math.min(Math.abs(L), tab[N]);
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] < a) lo = m; else hi = m; }
    const f = (a - tab[lo]) / Math.max(1e-9, tab[hi] - tab[lo]);
    return s * (Math.PI * (lo + f)) / N;
  };
  const at = (L) => {
    const ph = phiAt(L);
    return { x: A * Math.sin(ph), y: cy + B * Math.cos(ph), rz: Math.atan2(-B * Math.sin(ph), A * Math.cos(ph)), ph };
  };
  return { A, B, cy, at, total: tab[N] };
}

// overshoot pulse 0 -> 1 -> slight undershoot -> 0 over g in [0,1]
const bump = (g) => (g <= 0 || g >= 1 ? 0 : Math.sin(1.25 * Math.PI * g) * (1 - g) * 1.6);

export default {
  id: 'arc-carousel', name: 'Arc Carousel', category: 'carousel-flow', slots: 12,
  desc: 'Cards step along a rainbow arch from corner to corner; each arriving crest card springs up onto a glossy floor with a reflection',
  tags: ['carousel', 'arc', 'rainbow', 'arch', 'step', 'spring', 'showcase', 'product', 'gallery'], ref: 'original',
  params: base({
    crest: P.pct('Arch height', 60, 0, 100),
    cardSize: P.pct('Card size', 26, 12, 40),
    centreScale: P.num('Crest scale', 1.3, 1, 1.8, 'x', 0.05),
    reflection: P.pct('Floor reflection', 45, 0, 60),
    ease: P.choice('Easing', 'custom', EASINGS),
    direction: P.choice('Direction', 'rightToLeft', ['rightToLeft', 'leftToRight']),
  }),
  shadow: true, shadowOpacity: 0.45, sheen: 0.05, rim: 0,
  duration: 12,
  camera() { return { perspective: 20 }; },
  layout(ctx) {
    const { p, n, u, M, view: V, inner: I } = ctx;
    const ar = cardAR(ctx, 3 / 4);
    const portrait = V.w < 0.9;
    const cs = p.centreScale, popAmt = 0.08 * (cs / 1.3);
    // crest card (scaled, popped, lifted toward the camera) never wider than 86% of the frame / taller than 62%
    const wMax = Math.min(0.86 * V.w, 0.62 * ar) / ((cs + popAmt) * 1.12);
    const w = Math.min(wMax, (p.cardSize / 100) * Math.min(I.h, I.w * 1.42)), h = w / ar;
    const liftW = w * 0.03;
    // crest card top margin: 26% .. 4% of frame height (param), never closer than 4%
    const topM = Math.max(0.04, 0.04 + (1 - p.crest / 100) * 0.22);  // default 60 -> 12.8%
    // (the crest card sits at z = 0.15, so solve its projected top edge, not its world one)
    const D = ctx.camDist || 1.45, zc = 0.15;
    const yc = (0.5 - topM) * (D - zc) / D - (h * (cs + popAmt * 0.5)) / 2 - liftW;   // crest centre on the arch
    // square / portrait: pull the legs in so leg-card centres sit >= 0.5 w inside the frame (no edge slivers)
    const narrow = V.w < 1.3;                               // square + portrait
    const arch = archOf(V, yc, narrow ? V.w / 2 - 0.5 * w : undefined);
    const gap = 0.012 + 0.02 * Math.min(1, V.w);
    const sp = w + gap;                                    // slot spacing (arc length)
    const room = (cs - 1) * w * 0.55;                      // extra space neighbours leave the crest card
    // visible arc length: until the card centre is a card beyond the frame
    let Lv = 0;
    for (let L = 0; L < arch.total; L += 0.01) {
      const q = arch.at(L);
      if (q.y < -0.5 - h * 0.6 || Math.abs(q.x) > V.w / 2 + w * 0.6) break;
      Lv = L;
    }
    const nVis = Math.ceil((2 * Math.max(0, Lv - room)) / sp) + 2;
    const K = n >= nVis ? n : n * Math.ceil(nVis / n);
    const rev = p.direction === 'leftToRight' ? -1 : 1;
    const mv = 0.45;
    const x = u * K, k0 = Math.floor(x), f = x - k0;
    const s = (k0 + easeOf(p.ease)(Math.min(1, f / mv))) * rev;
    const vel = Math.sin(Math.PI * Math.min(1, f / mv)) * rev;
    const pop = bump((f - mv * 0.8) / 0.17);               // spring overshoot as the card settles at the crest
    const out = [];
    // floor line = the settled crest card's actual bottom edge (lift included)
    const floorY = yc + liftW - (h * cs) / 2;
    const fh = floorY + 0.5;
    // soft floor gradient: a lit horizon at the crest card's feet fading down to the bottom edge
    out.push({ light: { type: 'radial', stops: [[0, '#e6dcee', 0.3], [0.55, '#b8b8d8', 0.12], [1, '#9aa0c0', 0]] },
      blend: 'add', x: 0, y: floorY - fh * 0.6, z: -0.14, w: Math.min(V.w * 1.05, arch.A * 2.1), h: fh * 1.5,
      opacity: 0.6, layer: -62 });
    // wide warm light pool (~0.6 of the arch width) under the crest card
    const ph = Math.max(h * cs * 1.1, fh * 0.9);
    out.push({ light: { type: 'radial', stops: [[0, '#fff3e2', 0.75], [0.45, '#ffdcb8', 0.26], [1, '#ffdcb8', 0]] },
      blend: 'add', x: 0, y: floorY - ph * 0.3, z: -0.12, w: Math.min(V.w * 0.95, Math.max(arch.A * 1.2, w * cs * 2.2)), h: ph,
      opacity: 0.5, layer: -60 });
    const jr = Math.round(s), span = Math.ceil(Lv / sp) + 3;
    for (let j = jr - span; j <= jr + span; j++) {
      const k = j - s, a = Math.abs(k), sg = Math.sign(k) || 0;
      const fc = M.smooth(0, 1, 1 - Math.min(1, a));      // 1 at the crest, 0 one slot away
      const L = k * sp + sg * room * Math.min(1, a);
      if (Math.abs(L) > Lv + sp) continue;
      const q = arch.at(L);
      const lift = liftW * fc;
      const nx = -Math.sin(q.rz), ny = Math.cos(q.rz);    // outward normal of the arch
      // portrait: leg cards shrink toward 0.8x as they descend the arch
      const legK = portrait ? 1 - 0.2 * M.smooth(0.15, 1, Math.abs(q.ph) / (Math.PI / 2)) : 1;
      const sc = (1 + (cs - 1) * fc + popAmt * pop * fc) * legK;
      const tiltK = portrait ? 0.35 : narrow ? 0.8 : 1;
      const card = {
        media: M.mod(M.mod(j, K), n),
        x: q.x + nx * lift, y: q.y + ny * lift + h * 0.02 * pop * fc,
        z: 0.15 * fc + 0.03 * pop * fc - 0.01 * Math.min(3, a),
        w: w * sc, h: h * sc,
        rz: q.rz * tiltK * (1 - fc) - vel * 0.045 * (1 - 0.5 * fc),
        ry: -Math.sin(q.ph) * 0.22 * (1 - fc),
        bright: 1 - 0.3 * (1 - fc) - 0.05 * Math.max(0, a - 1),
        sat: 1 - 0.15 * (1 - fc),
        shadow: 0.3 - 0.22 * fc,                          // light at the crest: a drop shadow would darken the reflection seam
        layer: 100 - Math.round(Math.min(a, 9) * 10),
      };
      if (fc > 0.02 && p.reflection > 0) {
        // mirror around this card's own bottom edge (lift + pop included) so the reflection touches it
        out.push({ ...reflect(card, { floorY: card.y - card.h / 2 - 0.0005, opacity: (p.reflection / 100) * fc * fc, fade: 0.5, bright: 1.1 }), layer: -40 + Math.round(fc * 5) });
      }
      out.push(card);
    }
    return out;
  },
};
