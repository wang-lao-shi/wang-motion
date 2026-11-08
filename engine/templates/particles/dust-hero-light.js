import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
// Dust Hero (original, T03 #5): one premium hero card (soft shadow, engine radius, warm top-edge rim) holds centre stage
// with a slow 3% Ken-Burns. A volumetric light beam slants in from above (beamAngle) and washes across the card; golden dust
// motes drift through it in three depth planes: far dust behind the card (slow), fine midground dust in front, and a few
// large soft bokeh discs right in front of the lens (fast) -> parallax with a gentle camera sway. Motes glow only where
// they cross the beam (scattering) and twinkle as they tumble. Every particle position is fract(u·k + seed) with integer
// k and integer-cycle wobble, so the field is periodic. Media cross-dissolves every slide (= 2 beats); K slides per loop,
// image j cycles mod(mod(j,K),n), Ken-Burns continues through each dissolve.
const hex2 = (h) => { const s = String(h || '#ffc874').replace('#', ''); const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.padEnd(6, 'f'); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255); };
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const fr = (x) => x - Math.floor(x);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default {
  id: 'dust-hero-light', name: 'Dust Hero', category: 'particles', slots: 12,
  desc: 'Single hero card with a slow Ken-Burns in a slanted volumetric light beam; golden dust motes (far, fine midground, big soft foreground bokeh) drift with parallax and sparkle in the beam; images cross-dissolve every two beats',
  tags: ['particles', 'dust', 'light beam', 'god rays', 'volumetric', 'bokeh', 'hero', 'ken burns', 'cinematic', 'golden', 'warm', 'slideshow'],
  ref: 'original',
  params: base({
    density: P.pct('Dust density', 100, 20, 250),
    dustColor: P.color('Dust colour', '#ffc874'),
    bokehSize: P.pct('Bokeh size', 100, 40, 200),
    beamAngle: P.deg('Beam angle', 24, -45, 45),
    K: P.choice('Images per loop', '12', ['4', '6', '8', '10', '12']),
  }),
  shadow: true, shadowOpacity: 0.6, sheen: 0.06, depthWrite: false, duration: 24, background: '#0a0706',
  camera(ctx) {
    const { u, M } = ctx;
    return { perspective: 22, x: Math.sin(u * M.TAU) * 0.035, y: Math.sin(u * 2 * M.TAU) * 0.008 };
  },
  layout(ctx) {
    const { p, n, u, M } = ctx; const V = ctx.view, I = ctx.inner; const TAU = M.TAU;
    const K = Math.max(2, parseInt(p.K, 10) || 12);
    const dust = hex2(p.dustColor);
    const hot = toHex(dust.map((v) => v * 0.35 + 0.65)); // near-white core of the same hue
    const beamC = toHex(dust.map((v) => v * 0.8 + 0.2));
    const ang = M.rad(p.beamAngle);
    // ---- slide timing: K slides, each = 2 beats; dissolve over the last DIS of a slide ----
    const x = u * K, s = Math.floor(x), f = x - s;
    const DIS = 0.24;
    const mix = E.inOutSine(M.clamp((f - (1 - DIS)) / DIS, 0, 1));
    // Ken-Burns of image j at slide-local time t (t in [-DIS, 1]): 3% push + small pan, direction alternates per image
    const kb = (j, t) => {
      const q = E.inOutSine(M.clamp((t + DIS) / (1 + DIS), 0, 1));
      const d = M.mod(j, 2) ? -1 : 1, d2 = M.mod(Math.floor(j / 2), 2) ? -1 : 1;
      return { zoom: 1.03 + 0.03 * q, panX: d * (q - 0.5) * 0.022, panY: d2 * (q - 0.5) * 0.012 };
    };
    // ---- hero card ----
    const ar = cardAR(ctx, ctx.aspect > 1.3 ? 1.5 : ctx.aspect > 0.8 ? 0.84 : 0.7);
    let w = Math.min(I.w * (ctx.aspect > 1.3 ? 0.6 : 0.8), I.h * 0.76 * ar); let h = w / ar;
    const y0 = 0.012 * Math.sin(u * TAU + 0.6) - (ctx.aspect < 0.8 ? 0.015 : 0);
    const m0 = M.mod(M.mod(s, K), n), m1 = M.mod(M.mod(s + 1, K), n);
    const k0 = kb(s, f), k1 = kb(s + 1, f - 1);
    const pulse = 0.5 + 0.5 * Math.cos(f * TAU); // beam breathes once per slide, brightest at each dissolve
    const card = {
      media: m0, x: 0, y: y0, z: 0, w, h,
      rx: 0.035 * Math.sin(u * TAU + 1.2), ry: -0.05 * Math.sin(u * TAU), rz: 0,
      zoom: k0.zoom, panX: k0.panX, panY: k0.panY,
      bright: 1.0 + 0.04 * pulse, edgeTop: 0.25, layer: 1,
    };
    if (mix > 0.0005) Object.assign(card, { media2: m1, mix, mixMode: 'fade', zoom2: k1.zoom, panX2: k1.panX, panY2: k1.panY });
    const cards = [];
    // ---- light: beam axis through a point slightly above-left of the card centre ----
    const D = ctx.camDist || 1.2;
    const sa = Math.abs(Math.sin(ang));
    const L = 2.6 + 1.1 * sa, Wb = Math.max(V.w, 0.9) * 0.95 * (1 + 0.3 * sa), spread = 0.18; // longer/wider when slanted: no quad edge in frame
    const dir = [Math.sin(ang), -Math.cos(ang)];               // beam travel direction (down, tilted)
    const per = [-dir[1], dir[0]];                              // across the beam
    const cx0 = -dir[0] * 0.08, cy0 = 0.06;                     // beam centre (world, z=0 plane)
    const src = [cx0 - dir[0] * L / 2, cy0 - dir[1] * L / 2];
    const breathe = 0.85 + 0.15 * Math.sin(u * TAU * 2 + 0.4);
    const beamPulse = breathe * (0.9 + 0.12 * pulse);
    // lateral profile fades to 0 at 85% of the half-width; fade=1 -> 0 at the far end (no hard end cut)
    const XS = [[0, hot, 1], [0.3, beamC, 0.55], [0.85, beamC, 0]];
    // a beam quad that starts at the shared source and runs `len` of L down the axis (stacking short + long = steep falloff)
    const beam = (op, wMul, len, z, layer, sp = spread, stops = XS, rot = 0, off = 0) => {
      const a2 = ang + rot, d2 = [Math.sin(a2), -Math.cos(a2)], Ll = L * len;
      return { light: { type: 'beam', stops, spread: sp, fade: 1 }, blend: 'add',
        x: src[0] + per[0] * off + d2[0] * Ll / 2, y: src[1] + per[1] * off + d2[1] * Ll / 2, z,
        w: Wb * wMul, h: Ll, rz: a2, opacity: op * beamPulse, layer };
    };
    // haze + core: long (linear to 0) + short (0 by 55%) -> ~1.0 at the source, ~0.12 of it by 70% length
    cards.push(beam(0.14, 1.0, 1.0, -0.6, -3));
    cards.push(beam(0.2, 1.0, 0.55, -0.6, -3));
    cards.push(beam(0.16, 0.42, 1.0, -0.3, -2));
    cards.push(beam(0.26, 0.42, 0.5, -0.3, -2));
    cards.push(beam(0.22, 0.16, 0.6, -0.25, -2));
    // ray streaks: thin additive shafts from the source, each drifting sideways + breathing at its own integer frequency
    const NR = 7;
    const rayC = [[0, hot, 1], [0.45, beamC, 0.45], [1, beamC, 0]];
    for (let i = 0; i < NR; i++) {
      const h1 = fr(Math.sin(i * 12.9898 + 4.1) * 43758.5453), h2 = fr(Math.sin(i * 78.233 + 1.7) * 43758.5453);
      const fq = 1 + (i % 3), fq2 = 1 + ((i + 1) % 2);
      const off = ((i + 0.5) / NR - 0.5) * 0.6 * Wb * 0.6 + 0.035 * Math.sin((u * fq + h1) * TAU);
      const rot = (h2 - 0.5) * 0.06 + 0.012 * Math.sin((u * fq2 + h2) * TAU);
      const wv = (0.02 + 0.04 * h1) * V.w / (Wb * 0.42);           // 0.02-0.06 of the view width
      const op = (0.06 + 0.06 * h2) * (0.55 + 0.45 * Math.sin((u * (fq + 1) + h1 + h2) * TAU));
      cards.push(beam(op, 0.42 * wv, 0.75 + 0.25 * h2, -0.28, -2, 0.45, rayC, rot, off));
    }
    // source glow (top, off-frame-ish) + floor warmth behind the card
    cards.push({ light: { type: 'radial', stops: [[0, hot, 1], [0.4, beamC, 0.35], [1, beamC, 0]] }, blend: 'add',
      x: src[0] * 0.45 + cx0 * 0.55, y: Math.min(0.62, src[1] * 0.45 + cy0 * 0.55), z: -0.5, w: 1.1, h: 0.8, opacity: 0.3 * breathe, layer: -2 });
    cards.push({ light: { type: 'radial', stops: [[0, beamC, 1], [0.5, beamC, 0.3], [1, beamC, 0]] }, blend: 'add',
      x: 0, y: y0, z: -0.4, w: w * 2.0, h: h * 1.6, opacity: 0.08, layer: -2 });
    cards.push(card);
    cards.push(beam(0.1, 0.5, 0.6, 0.06, 3));        // light wash over the card (volumetric in front)
    // ---- dust ----
    const dens = p.density / 100, bs = p.bokehSize / 100;
    const hw = w / 2, hy0 = y0 - h / 2, hy1 = y0 + h / 2;
    const inBeam = (px, py, z) => { // projected to z=0 plane; matches the stacked beam profile (steep axial falloff)
      const pr = D / (D - z), sx = px * pr, sy = py * pr;
      const rx = sx - src[0], ry = sy - src[1];
      const al = (rx * dir[0] + ry * dir[1]) / L, pe = Math.abs(rx * dir[1] - ry * dir[0]);
      const a = M.clamp(al, 0, 1);
      const half = (spread + (1 - spread) * a) * Wb * 0.42 * 0.5 * 1.6;
      const ax = 0.25 + 0.75 * Math.max(0, 1 - a / 0.75);
      return sstep(0.95, 0.2, pe / Math.max(1e-3, half)) * ax * sstep(-0.05, 0.1, al);
    };
    const overCard = (px, py, z, r) => { // 1 inside the projected card rect, 0 well outside
      const pr = D / (D - z), sx = px * pr, sy = py * pr, rr = r * pr;
      const dx = Math.max(0, Math.abs(sx) - hw - rr), dy = Math.max(0, hy0 - rr - sy, sy - hy1 - rr);
      return 1 - Math.min(1, Math.hypot(dx, dy) / (0.04 + rr));
    };
    // field: x/y wrap through a box sized to the frustum at depth z; drift up-and-across (fract(u·k+seed)), plus wobble
    const group = (o) => ({
      count: Math.round(o.count), seed: o.seed, shape: o.shape, blend: 'add', order: o.order,
      fn: (k, rnd) => {
        const z = o.z0 + rnd(1) * (o.z1 - o.z0);
        const sc = (D - z) / D, size = o.size(rnd(2));
        const bx = (V.w / 2) * sc + size, by = 0.5 * sc + size;
        const kx = o.kx * (rnd(9) < 0.5 ? 1 : -1), ky = o.ky;
        const fx = fr(u * kx + rnd(3)), fy = fr(u * ky + rnd(4));
        const wob = o.wob * Math.sin((u * (1 + Math.floor(rnd(5) * 3)) + rnd(6)) * TAU);
        const px = (fx - 0.5) * 2 * bx + wob, py = (fy - 0.5) * 2 * by + 0.6 * wob * Math.cos((u * 2 + rnd(7)) * TAU);
        const lit = inBeam(px, py, z);
        const tw = 0.55 + 0.45 * Math.sin((u * (2 + Math.floor(rnd(8) * 4)) + rnd(10)) * TAU); // glint as motes tumble
        let op = (o.amb + (o.lit - o.amb) * lit) * (0.5 + 0.5 * tw) * (0.55 + 0.45 * rnd(11));
        if (o.cardDim) op *= 1 - o.cardDim * overCard(px, py, z, size * 0.5); // keep the media clean
        if (op <= 0.003) return null;
        const c = lit > 0.35 ? hot : p.dustColor;
        return { x: px, y: py, z, size: size * (o.grow ? 1 + 0.25 * lit : 1), opacity: op, color: c };
      },
    });
    // foreground bokeh: 6 lens discs, two of them riding down the beam axis (hot), the rest dim warm discs at the sides
    const bokC = toHex([dust[0] * 0.7 + 0.3, dust[1] * 0.7 + 0.24, dust[2] * 0.6 + 0.26]); // light warm peach, not brown
    const NB = Math.max(5, Math.min(7, Math.round(6 * Math.sqrt(dens))));
    const bokeh = {
      count: NB, seed: 23, shape: 'bokeh', blend: 'add',
      fn: (k, rnd) => {
        const z = 0.45 + rnd(1) * 0.28, pr = D / (D - z);
        const size = (0.075 + rnd(2) * 0.08) * bs;
        let px, py, op, c = bokC;
        if (k < 2) { // hot: travel along the beam axis once per loop, offset half a loop apart
          const t = fr(u + k * 0.5 + 0.15), al = 0.08 + 0.9 * t;
          const ox = per[0] * (k ? 0.12 : -0.1), oy = per[1] * (k ? 0.12 : -0.1);
          px = (src[0] + dir[0] * L * al + ox) / pr; py = (src[1] + dir[1] * L * al + oy) / pr;
          px += 0.02 * Math.sin((u * 2 + k * 0.3) * TAU);
          const lit = inBeam(px, py, z);
          op = 0.035 + 0.1 * lit; c = lit > 0.4 ? hot : bokC;
        } else {
          const sc = (D - z) / D, bx = (V.w / 2) * sc + size, by = 0.5 * sc + size;
          const kx = rnd(9) < 0.5 ? 1 : -1;
          px = (fr(u * kx + rnd(3)) - 0.5) * 2 * bx; py = (fr(u + rnd(4)) - 0.5) * 2 * by + 0.03 * Math.sin((u + rnd(6)) * TAU);
          const lit = inBeam(px, py, z);
          op = (0.02 + 0.06 * rnd(11)) * (0.75 + 0.25 * Math.sin((u * 2 + rnd(10)) * TAU)) + 0.05 * lit;
        }
        // over the card: dim, but never to zero, so bokehSize stays visible
        op *= 1 - 0.55 * overCard(px, py, z, size * 0.5);
        if (op <= 0.003) return null;
        return { x: px, y: py, z, size, opacity: op, color: c };
      },
    };
    const tall = Math.sqrt(Math.max(1, V.h / V.w)), wide = Math.sqrt(Math.max(1, V.w));
    const particles = [
      // far dust behind the card (drawn before cards)
      group({ count: 700 * dens * wide * tall, seed: 3, shape: 'dot', order: -1, z0: -1.4, z1: -0.15, kx: 1, ky: 1, wob: 0.02,
        size: (r) => 0.004 + r * 0.006, amb: 0.015, lit: 1.0 }),
      // fine midground dust in front of the card
      group({ count: 520 * dens * wide * tall, seed: 7, shape: 'dot', z0: 0.03, z1: 0.42, kx: 1, ky: 2, wob: 0.025,
        size: (r) => 0.0028 + r * r * 0.007, amb: 0.025, lit: 1.0, grow: true, cardDim: 0.4 }),
      // a few glinting sparks in the beam
      group({ count: 40 * dens * wide, seed: 13, shape: 'spark', z0: -0.2, z1: 0.3, kx: 1, ky: 1, wob: 0.03,
        size: (r) => 0.012 + r * 0.012, amb: 0.0, lit: 0.65 }),
      bokeh,
    ];
    const post = { bloom: { amount: 0.55, threshold: 0.85, radius: 0.018 }, grade: { sat: 1.04, contrast: 1.04, bright: 1 } };
    return { cards, particles, post };
  },
};
