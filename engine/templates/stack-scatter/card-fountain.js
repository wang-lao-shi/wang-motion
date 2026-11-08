import { base, P, cardAR } from '../_common.js';
// Card Fountain (original): a ballistic fountain of cards that springs from one glowing point at the bottom centre.
// Every card j has a fixed emission phase e_j; its age is mod(u - e_j, 1), so emission is periodic and the loop is
// seamless by construction. Emission is bunched into `pulses` bursts, and the light pool at the source swells with
// each burst. Cards tumble mainly around their face normal (rz); rx/ry only wobble (face-to-camera cosine kept ≥ 0.6, perspective included), so no card goes edge-on
// and back faces never turn toward the camera. Cards fly at different depths (perspective size, far cards dim/blur)
// and fall back out below the frame.
export default {
  id: 'card-fountain', name: 'Card Fountain', category: 'stack-scatter', slots: 12,
  desc: 'Cards burst in rhythmic pulses from a glowing source at the bottom centre, arcing high across the frame at different depths and tumbling back down',
  tags: ['stack', 'scatter', 'fountain', 'spray', 'burst', 'particles', 'ballistic', 'tumble', 'glow', 'playful', 'celebration'], ref: 'original',
  params: base({
    rate: P.num('Cards per loop', 32, 8, 120),
    pulses: P.num('Bursts per loop', 3, 0, 6),
    height: P.pct('Fountain height', 110, 50, 140),
    spread: P.pct('Spread', 90, 0, 100),
    cardSize: P.pct('Card size', 19, 6, 36),
    spin: P.num('Spin', 1, 0, 3, 'x', 0.05),
  }),
  shadow: true, shadowOpacity: 0.32,
  duration: 10,
  camera() { return { perspective: 30 }; },
  layout(ctx) {
    const { p, n, u, M, view, inner: I } = ctx;
    const N = Math.max(4, Math.round(p.rate * M.clamp(Math.sqrt(view.w), 1, 1.35)));   // wide frames get a denser stream
    const PU = Math.max(0, Math.round(p.pulses));
    const ar = cardAR(ctx, 3 / 4);
    const unit = Math.sqrt(I.w * I.h);                 // size by frame area: all ratios look alike
    const life = 0.5;                                   // loop fraction a card stays airborne
    const D = ctx.camDist || 1.5;
    const depth = 0.6;
    const out = [];
    const wide = M.clamp(view.w / view.h, 1, 1.5);     // landing reach grows with aspect so 16:9 flanks fill
    // burst envelope (periodic in u): 1 at each burst centre, low between bursts
    const burst = PU > 0 ? Math.pow(0.5 + 0.5 * Math.cos(M.TAU * (u * PU - 0.5)), 3) : 0.55 + 0.1 * Math.sin(M.TAU * u * 3);
    // --- light pool at the source (additive, behind the cards) + a faint upward beam + hot core in front
    const gw = Math.max(0.34 * view.w, 0.3);
    out.push({ light: { type: 'radial', stops: [[0, '#ffe2b0', 0.9], [0.3, '#ff9a5a', 0.45], [0.65, '#c0407a', 0.14], [1, '#401040', 0]] },
      blend: 'add', x: 0, y: -0.5, z: -0.2, w: gw * 1.6, h: gw * 0.9, opacity: 0.55 + 0.45 * burst, layer: 0 });
    out.push({ light: { type: 'beam', angle: Math.PI / 2, spread: 0.18, fade: 0.9, stops: [[0, '#ffc890', 0.5], [1, '#ff70a0', 0]] },
      blend: 'add', x: 0, y: -0.05, z: -0.3, w: gw * 1.1, h: 1.0, opacity: 0.12 + 0.18 * burst, layer: 0 });
    out.push({ light: { type: 'radial', stops: [[0, '#fff4e0', 1], [0.4, '#ffb070', 0.5], [1, '#ff6040', 0]] },
      blend: 'add', x: 0, y: -0.5, z: 0.1, w: gw * 0.55, h: gw * 0.3, opacity: 0.35 + 0.5 * burst, layer: 2 });
    for (let j = 0; j < N; j++) {
      const R = (s) => M.rand(j + 1, s);
      // emission phase (fixed per card, periodic): even spacing + jitter, optionally bunched into pulses
      let e = (j + 0.5 * R(1)) / N;
      if (PU > 0) { const b = Math.floor(e * PU), f = e * PU - b; e = (b + 0.5 + Math.sign(f - 0.5) * Math.pow(Math.abs(2 * f - 1), 1.6) * 0.42) / PU; }   // dense core, soft tails
      const L = life * (0.88 + 0.24 * R(2));
      const a = M.mod(u - e, 1) / L;                   // normalised age 0..1 while airborne
      if (a >= 1) continue;
      const z = -(R(3) ** 1.1) * 1.9 * depth + 0.02;   // flight depth (constant per card)
      const kz = (D - z) / D;                          // world units per screen unit at that depth
      const w = (p.cardSize / 100) * unit * (0.85 + 0.3 * R(4)), h = w / ar;
      const bottom = (-view.h / 2 - h * 0.7) * kz;      // start/finish just under the frame edge
      const H = (p.height / 100) * 1.02 * view.h * (0.6 + 0.55 * R(5)) * kz;   // apex above the start
      const x0 = (R(7) - 0.5) * 0.16 * view.w * kz;     // launch point: bottom centre ±8% of width
      const sx = (j % 2 ? 1 : -1) * (M.rand(j >> 1, 61) < 0.5 ? 1 : -1) * (0.08 + 0.92 * R(6));   // paired opposite sides: balanced left/right
      const X = Math.sign(sx) * Math.pow(Math.abs(sx), 0.6) * (p.spread / 100) * 0.5 * view.w * wide * kz;   // landing offset
      const x = x0 + X * a;
      const y = bottom + 4 * H * a * (1 - a);           // ballistic parabola in normalised time
      const sp = p.spin * (0.6 + 0.8 * R(8));
      const dir = R(9) < 0.5 ? -1 : 1;
      const far = M.clamp((0.02 - z) / 1.9);
      // tumble: rz carries the spin, rx/ry wobble sinusoidally (|rx| ≤ 0.85, |ry| ≤ 0.7 rad)
      const wob = Math.min(1, 0.35 + 0.65 * p.spin);
      const rz = (R(13) - 0.5) * 0.9 + dir * sp * a * M.TAU * 0.55;
      let rx = 0.7 * wob * Math.sin(M.TAU * ((0.6 + 0.8 * R(10)) * a * Math.max(0.4, p.spin) + R(11)));
      let ry = 0.55 * wob * Math.sin(M.TAU * ((0.5 + 0.7 * R(12)) * a * Math.max(0.4, p.spin) + R(14)));
      // foreshortening cap incl. perspective: face normal (order YXZ) = (cos rx·sin ry, −sin rx, cos rx·cos ry);
      // keep its cosine to the camera ray ≥ 0.6 by shrinking the wobble (continuous bisection → no popping)
      const vl = Math.hypot(x, y, D - z), vx0 = -x / vl, vy0 = -y / vl, vz0 = (D - z) / vl;
      const facing = (k) => Math.cos(k * rx) * Math.sin(k * ry) * vx0 - Math.sin(k * rx) * vy0 + Math.cos(k * rx) * Math.cos(k * ry) * vz0;
      if (facing(1) < 0.6) { let lo = 0, hi = 1; for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (facing(m) >= 0.6) lo = m; else hi = m; } rx *= lo; ry *= lo; }
      // light streak on fast-moving cards (just after launch, just before exit), along the velocity in card space
      const vx = X, vy = 4 * H * (1 - 2 * a);
      const fast = M.clamp((Math.abs(1 - 2 * a) - 0.55) / 0.45);
      const card = {
        media: M.mod(j, n), x, y, z, w, h, rx, ry, rz, mirrorBack: false,
        bright: 1 - 0.45 * far, sat: 1 - 0.25 * far,
        blur: far > 0.7 ? 4.5 : 0,                     // per-card constant (depth fixed): no popping
        shadow: 0.32 * (1 - 0.7 * far), layer: 1,
      };
      // streak scaled by depth; large near cards get none (8-tap steps would read as ghost copies)
      const projW = w / kz / view.w;
      const bamt = 0.1 * fast * (0.2 + 0.8 * far) * M.clamp((0.12 - projW) / 0.04);
      if (bamt > 0.004) card.dirBlur = { amt: bamt, angle: Math.atan2(vy, vx) - rz };
      out.push(card);
    }
    return out;
  },
};
