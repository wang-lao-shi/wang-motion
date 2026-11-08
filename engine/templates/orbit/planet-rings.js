import { base, P, cardAR } from '../_common.js';
import { drift } from '../../lib.js';
// Planet Rings (original): a Saturn-like composition. The planet is a photo globe: two media wrapped around a
// sphere as an equirect band, drawn as vertical strips (screen x = R·sin(longitude), uv linear per strip) clipped by
// a circle mask, so the photos really rotate across the disc and wrap round the back (1 turn per loop → seamless;
// texture wrap isn't available, so a plain panX could only sway). A multiply terminator card shades the night side,
// an additive atmosphere halo + lit-side rim give it a soft glow. Around it a tilted, rolled ring belt of small cards
// (two staggered lanes) turns an integer number of times per loop. Ring cards behind the planet sit on a lower layer,
// front cards on a higher one (the switch happens at the ring's sides, outside the planet disc, and agrees with z);
// the planet's shadow (light from upper-left-front) darkens the far part of the belt as a band. A dust belt of
// particles and a faint star field fill the frame. The ring roll/tilt are ratio-aware: near-horizontal in 16:9,
// diagonal in 1:1 and steeply rolled in 9:16 so the belt fills the tall frame instead of being clipped.
export default {
  id: 'planet-rings', name: 'Planet Rings', category: 'orbit', slots: 12,
  desc: 'A photo planet slowly rotating in space, wrapped in a tilted Saturn ring of small cards that orbits it, passing behind and in front with correct depth; the planet casts a shadow band across the far side of the belt.',
  tags: ['orbit', 'planet', 'saturn', 'ring', 'space', 'globe', 'cosmic', 'depth', 'loop'], ref: 'original',
  params: base({
    beltCards: { ...P.num('Belt cards', 40, 16, 64), desc: 'Number of small cards in the ring (two staggered lanes)' },
    tilt: { ...P.deg('Ring tilt', 16, 6, 40), desc: 'Ring tilt toward the camera (steeper automatically in portrait)' },
    speed: { ...P.num('Ring speed (turns/loop)', 1, -3, 3), desc: 'Whole turns of the belt per loop (0 = still)' },
    ringWidth: { ...P.pct('Ring width', 9, 0, 45), desc: 'Radial spread of the two card lanes (% of ring radius)' },
    glow: P.color('Atmosphere', '#7cc4ff'),
  }),
  shadow: true, shadowOpacity: 0.4, rim: 0.4, edgeTop: 0.3, edgeW: 0.0025, sheen: 0.05,
  background: '#04050b',
  duration: 24,
  camera() { return { perspective: 18 }; },
  layout(ctx) {
    const { p, u, n, M, view } = ctx;
    const W = view.w, H = view.h, mn = Math.min(W, H), asp = W / H;
    const band = asp > 1.3 ? 0 : asp < 0.8 ? 2 : 1;            // wide / square / tall
    const camD = ctx.camDist || 1.6;
    const cards = [];
    // ---------- media split: 2 planet media, the rest feed the belt (no planet image ever on the belt)
    const pm = n >= 4 ? [0, 1] : [0, 0];
    const pool = [];
    for (let i = (n >= 4 ? 2 : 1); i < n; i++) pool.push(i);
    if (!pool.length) pool.push(0);
    // ---------- framing per aspect band
    const Rp = [0.27 * H, 0.24 * mn, 0.33 * W][band];         // planet radius (diameter 54% / 48% / 66% of short side)
    const beta = M.rad(M.clamp(p.tilt, 0, 60) + [0, 4, 12][band]);
    const rho = M.rad([-9, -24, -71][band]);                   // ring roll
    const Zs = 0.5;                                            // depth compression keeps perspective tame
    const rw = M.clamp(p.ringWidth, 0, 60) / 100;
    const N = Math.max(4, Math.round(p.beltCards));
    // belt media order: greedy, seeded, max-spaced — each media used evenly, repeats kept >= ~0.6·pool apart (circularly)
    // and the order is re-randomised every pass, so no two arcs of the ring show the same run of images.
    const L = pool.length, gap = Math.max(1, Math.min(L - 1, Math.ceil(L * 0.7)));
    const seq = [], last = new Map(), used = new Map(), first = new Map();
    for (let k = 0; k < N; k++) {
      let best = -1, bs = Infinity;
      for (const m of pool) {
        const d = last.has(m) ? k - last.get(m) : Infinity;
        const dw = first.has(m) ? N - k + first.get(m) : Infinity;   // wrap-around distance to its first use
        const pen = (d < gap ? 1e6 * (gap - d) : 0) + (dw < gap ? 1e5 * (gap - dw) : 0);
        const sc = pen + 100 * (used.get(m) || 0) + M.rand(k * 31 + m, 17);
        if (sc < bs) { bs = sc; best = m; }
      }
      seq.push(best); last.set(best, k); used.set(best, (used.get(best) || 0) + 1); if (!first.has(best)) first.set(best, k);
    }
    const spd = Math.round(p.speed);
    const ar = cardAR(ctx, 4 / 3);
    const ringPos = (r, a) => {                                // a = angle in ring plane; a=π/2 is the front
      const X = r * Math.cos(a), Zr = r * Math.sin(a);
      const y = -Zr * Math.sin(beta), z = Zr * Math.cos(beta) * Zs;
      return [X * Math.cos(rho) - y * Math.sin(rho), X * Math.sin(rho) + y * Math.cos(rho), z];
    };
    // fit the outer lane (projected, plus a card half-size) into the frame
    let Rr = 0.8;
    const cw = (R) => Math.max(0.1 * R, [0.085, 0.08, 0.13][band] * mn);
    for (let it = 0; it < 4; it++) {
      let ex = 0, ey = 0; const c = cw(Rr), ro = Rr * (1 + rw / 2);
      for (let s = 0; s < 72; s++) {
        const [x, y, z] = ringPos(ro, (s / 72) * M.TAU); const k = camD / (camD - z);
        ex = Math.max(ex, Math.abs(x * k) + c * 0.55 * k); ey = Math.max(ey, Math.abs(y * k) + (c / ar) * 0.55 * k);
      }
      const sx = (W / 2) * [0.97, 0.95, 0.95][band] / ex, sy = (H / 2) * [0.95, 0.95, 0.97][band] / ey;
      Rr *= Math.min(sx, sy);
    }
    Rr = Math.max(Rr, Rp * 1.35);
    const cW = cw(Rr), cH = cW / ar;
    // ---------- light & shadow
    const Ld = (() => { const v = [0.5, -0.32, -0.8]; const l = Math.hypot(...v); return v.map((a) => a / l); })(); // light travel dir
    const smooth = (a, b, x) => { const t = M.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const shadeAt = (P_) => {
      const t = P_[0] * Ld[0] + P_[1] * Ld[1] + (P_[2] / Zs) * Ld[2];
      if (t <= 0) return 0;
      const d = Math.hypot(P_[0] - t * Ld[0], P_[1] - t * Ld[1], P_[2] / Zs - t * Ld[2]);
      return smooth(Rp * 1.02, Rp * 0.9, d) * M.clamp(t / (Rp * 0.25), 0, 1);
    };
    // ---------- belt cards
    for (let k = 0; k < N; k++) {
      const lane = k % 2;
      const r = Rr * (1 + (lane ? 0.5 : -0.5) * rw) * (1 + 0.012 * (M.rand(k, 3) - 0.5));
      const a = M.TAU * (k / N + spd * u);                      // even k = inner lane, odd k = outer lane → lanes interleave at half spacing
      const P_ = ringPos(r, a);
      const front = Math.sin(a);                                // -1 back .. 1 front
      const sh = shadeAt(P_);
      const bob = 0.012 * mn * Math.sin(M.TAU * (2 * spd * u + M.rand(k, 7)) ) * (spd ? 1 : 0);
      cards.push({
        media: seq[k], x: P_[0], y: P_[1] + bob, z: P_[2] + (lane ? 0.006 : 0),
        w: cW * (1 + 0.04 * (M.rand(k, 5) - 0.5)), h: cH * (1 + 0.04 * (M.rand(k, 5) - 0.5)),
        rz: rho * 0.55 - 0.05 * Math.cos(a) * Math.sign(rho || 1), ry: 0.15 * Math.cos(a), rx: -0.18,
        bright: (0.6 + 0.4 * (front + 1) / 2) * (1 - 0.92 * sh), sat: 0.8 + 0.2 * (front + 1) / 2 - 0.45 * sh,
        shadow: 0.35 * (1 - sh), layer: P_[2] < 0 ? 0 : 4,
      });
    }
    // ---------- planet: photo globe strips (layer 1)
    // Two media, each spanning π+F of longitude: A on [0, π+F], B on [π, 2π+F]. The base layer is opaque; across
    // each F-wide overlap the incoming media is laid over in thin strips with an opacity ramp → soft crossfade, no seam.
    const phi = M.TAU * u;                                     // one turn per loop
    const fullA = 1.25, F = M.rad(16), span = Math.PI + F;
    const strip = (L0, L1, m, Ls, op, layer) => {
      const l0 = M.mod(L0 - phi + Math.PI, M.TAU) - Math.PI, l1 = l0 + (L1 - L0);
      const c0 = Math.max(l0, -Math.PI / 2), c1 = Math.min(l1, Math.PI / 2);
      if (c1 <= c0) return;
      const x0 = Rp * Math.sin(c0), x1 = Rp * Math.sin(c1);
      if (x1 - x0 < 1e-5) return;
      const fu = (l) => (L0 + (l - l0) - Ls) / span;           // uv within the media
      let ua = fu(c0), ub = fu(c1);
      const ext = op < 1 || ub > 0.999 ? 0 : Math.min(0.0025 * mn, (x1 - x0) * 0.5);  // opaque strips overlap right to hide hairlines
      ub += (ub - ua) * ext / (x1 - x0);
      const sw = x1 - x0 + ext, sx = x0 + sw / 2;
      cards.push({
        media: pm[m], x: sx, y: 0, z: 0, w: sw, h: 2 * Rp, opacity: op,
        uv: [ua, 0, ub, 1], fullAspect: fullA, radius: 0, shadow: 0, sheen: 0, rim: 0, edgeX: 0, edgeTop: 0, edgeBottom: 0,
        mask: { type: 'circle', cx: 0.5 - sx / sw, cy: 0.5, r: 0.5, soft: 0.004 }, layer,
      });
    };
    const base = (A, B, m, Ls) => { const ns = Math.max(1, Math.ceil((B - A) / M.rad(8))); for (let i = 0; i < ns; i++) strip(A + (B - A) * i / ns, A + (B - A) * (i + 1) / ns, m, Ls, 1, 1); };
    base(0, span, 0, 0);                                       // A, opaque
    base(span, M.TAU, 1, Math.PI);                             // B, opaque (rest of the way round)
    // feather: NF nested B strips sharing one far edge (pushed 2° into B's own opaque base, where it is invisible);
    // strip i has alpha 1/(NF−i), so the stacked coverage ramps linearly 0→1 with no abutting strip edges.
    const NF = 12, X = M.rad(2);
    for (let i = 0; i < NF; i++) {
      const op = 1 / (NF - i);
      strip(Math.PI + F * i / NF, span + X, 1, Math.PI, op, 2);              // B fades in over A's tail
      strip(-X, F * (NF - i) / NF, 1, -Math.PI, op, 2);                      // B's tail (lon 2π..2π+F ≡ 0..F) fades out over A's head
    }
    // terminator shading (multiply) — centred toward the light, clipped to the disc
    const sc = 3.4 * Rp, ox = -0.42 * Rp, oy = 0.34 * Rp;
    cards.push({ light: { type: 'radial', stops: [[0, '#ffffff', 0], [0.2, '#ffffff', 0], [0.52, '#1b2340', 0.72], [0.75, '#05060c', 0.97]] },
      blend: 'multiply', x: ox, y: oy, z: 0.001, w: sc, h: sc, layer: 3,
      mask: { type: 'circle', cx: 0.5 - ox / sc, cy: 0.5 - oy / sc, r: Rp / sc, soft: 0.003 } });
    // lit-side inner rim (additive), clipped to the disc
    cards.push({ light: { type: 'ring', r: 0.92, width: 0.12, stops: [[0, '#ffffff', 0.9], [0.4, p.glow, 0.6], [1, p.glow, 0]] },
      blend: 'add', x: 0, y: 0, z: 0.002, w: 2.04 * Rp, h: 2.04 * Rp, layer: 3, opacity: 0.85,
      mask: { type: 'line', angle: -0.68, p: 0.62, soft: 0.3 } });
    // atmosphere halo behind the planet (layer 0, outside the disc)
    const hs = 2.9 * Rp;
    cards.push({ light: { type: 'ring', r: Rp / (hs / 2), width: 0.32, stops: [[0, p.glow, 0.85], [0.35, p.glow, 0.3], [1, p.glow, 0]] },
      blend: 'add', x: -0.05 * Rp, y: 0.04 * Rp, z: -0.001, w: hs, h: hs, layer: 0, opacity: 0.9 });
    cards.push({ light: { type: 'radial', stops: [[0, p.glow, 0.22], [0.5, p.glow, 0.07], [1, p.glow, 0]] },
      blend: 'add', x: 0, y: 0, z: -0.6, w: Math.max(W, H) * 1.6, h: Math.max(W, H) * 1.6, layer: 0, opacity: 0.8 });
    // ---------- particles: dust belt (back / front groups) + stars
    const dust = (wantFront) => (k, rnd) => {
      const d = drift(k, u, { speed: spd || 0, seed: 11 });
      const a = M.TAU * d.x;
      const r = Rr * (1 + (rnd(1) - 0.5) * (rw + 0.22)) ;
      const P_ = ringPos(r, a);
      if ((P_[2] >= 0) !== wantFront) return null;
      const sh = shadeAt(P_), front = Math.sin(a);
      return { x: P_[0], y: P_[1] + (rnd(2) - 0.5) * 0.03 * mn, z: P_[2], size: (0.003 + rnd(3) * 0.005) * mn,
        opacity: (0.35 + 0.45 * rnd(4)) * (0.55 + 0.45 * (front + 1) / 2) * (1 - 0.95 * sh), color: rnd(5) < 0.7 ? '#ffe6c8' : p.glow };
    };
    const stars = (k, rnd) => {
      const tw = 0.55 + 0.45 * Math.sin(M.TAU * (Math.ceil(rnd(4) * 3) * u + rnd(5)));
      return { x: (rnd(1) - 0.5) * W * 1.15, y: (rnd(2) - 0.5) * H * 1.15, z: -0.8, size: (0.002 + rnd(3) ** 3 * 0.006) * mn * 1.5,
        opacity: 0.6 * tw, color: rnd(6) < 0.8 ? '#ffffff' : '#bcd7ff' };
    };
    const particles = [
      { count: 220, seed: 3, shape: 'dot', blend: 'add', order: -2, fn: stars },
      { count: 1100, seed: 11, shape: 'dot', blend: 'add', order: -1, fn: dust(false) },
      { count: 1100, seed: 11, shape: 'dot', blend: 'add', fn: dust(true) },
    ];
    // portrait: nudge the whole composition down/right so the belt clears the left edge and fills the bottom band
    if (band === 2) {
      const dx = 0.02 * W, dy = -0.02 * H;
      for (const c of cards) { c.x += dx; c.y += dy; }
      for (const g of particles.slice(1)) { const f0 = g.fn; g.fn = (k, rnd) => { const q = f0(k, rnd); if (q) { q.x += dx; q.y += dy; } return q; }; }
    }
    return { cards, particles };
  },
};
