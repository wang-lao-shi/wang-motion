import { base, P, mRx, mRz, mMul, mApply } from '../_common.js';
// A DNA-style double helix: two strands of flat cards (A at θ, B at θ+π) joined by glowing rungs.
// Helix axis = local Y. Pair a sits at height P(a/K − u) and angle 2πa/K + 2πu, so the stream climbs
// (content slides down one pitch per loop) while the helix also spins one turn — the two add (the
// screw visibly turns) instead of cancelling into a static sliding pattern. Pair a−K at u=1 is pair a
// at u=0 with the same media (index depends on a mod K), so the loop is exact.
// Cards stay flat and upright on screen (ry = 0.65·sin θ): front and back both face the camera,
// never edge-on, never mirrored. Back strand is dimmed by fog.
function geo(ctx) {
  const { p, M } = ctx;
  const V = ctx.view;
  const K = Math.max(4, Math.min(10, Math.round(p.pairs)));
  const n = Math.max(1, ctx.n || 1);
  const w = V.w;
  const sq = M.clamp((w - 0.5625) / 0.4375, 0, 1);   // 9:16 → 0, 1:1 → 1
  const wide = M.clamp((w - 1) / 0.778, 0, 1);       // 1:1 → 0, 16:9 → 1
  // small ratio tilt only (9:16 0°, 1:1 6°, 16:9 5°): wide frames fill the width with radius, not tilt
  const alpha = M.rad(w <= 1 ? 6 * sq : 6 - 1 * wide);
  const lean = M.rad(6);   // lean drops back cards / lifts front ones: keep it modest or vertical neighbours collide
  const ca = Math.max(1e-3, Math.abs(Math.cos(alpha))), sa = Math.max(1e-3, Math.abs(Math.sin(alpha)));
  const along = Math.min(1 / ca, w / sa);
  const perp = Math.min(w / ca, 1 / sa);
  let rmax = 0.3;
  for (let i = 0; i < n; i++) rmax = Math.max(rmax, ctx.ratioOf(i));
  const fp = 0.8 - 0.1 * sq;                          // axial footprint: 0.8·d at 9:16, 0.7·d at 1:1 / 16:9
  const foot = ca + 0.6 * rmax * sa;
  // card-height floor (1:1 ≥ 14%, 16:9 ≥ 20% of frame height): fewer pairs on screen rather than a wire diagram
  const hmin = w < 1 ? 0.14 * Math.max(0, (w - 0.8) / 0.2) : 0.14 + 0.06 * wide;
  const Rraw = (p.radius / 100) * perp / 2;
  const sl = 0.6 * Math.sin(lean);                    // lean squeezes a back card onto the front card below it
  const dmin = (hmin * foot + sl * Math.min(Rraw, 0.46 * w)) / fp * Math.sqrt(p.pitch / 110);
  const d = Math.max((p.pitch / 100) * along * (1 - 0.12 * wide) / K, dmin);
  const Pp = d * K;
  let hd = fp * d / foot;
  const cw = (R) => Math.min(0.8 * R, Math.min(hd, 0.42) * rmax);
  const edge = 0.46 * w;                              // strand centre + half card stays inside 46% of width
  // clamp lets cards shrink to ~60% before R stops: the slider keeps widening the strands to the end of its range
  let R = Rraw;
  for (let it = 0; it < 6; it++) R = Math.min(Rraw, (edge - 0.3 * cw(R)) * ca);
  const cwMax = 2 * (edge - R / ca);
  hd = (fp * d - sl * R) / foot;
  // mild perspective, flatter on wide frames: the big radius there would spread front/back cards apart vertically
  // (front lifted, back dropped) and stack a back card onto the front card of the pair below
  const persp = 12 - 8 * wide;
  const fov = (6 + persp * 1.6) * Math.PI / 180;
  const D = 0.5 / Math.tan(fov / 2);
  return { persp, K, alpha, lean, along, Pp, R, d, D, hd, foot, cwMax, G: mMul(mRz(alpha), mRx(-lean)) };
}
export default {
  id: 'double-helix', name: 'Double Helix', category: '3d-perspective', slots: 12,
  desc: 'Two strands of cards wound into a spinning, climbing double helix, paired by glowing light rungs',
  tags: ['helix', 'dna', 'double', 'spiral', 'rungs', 'glow', 'climb', '3d'], ref: 'original',
  params: base({
    pairs: P.num('Pairs per turn', 6, 4, 10),
    pitch: P.pct('Pitch', 110, 70, 200),
    radius: P.pct('Radius', 60, 30, 90),
    rungColor: P.color('Rung colour', '#7fe0ff'),
    glow: P.pct('Glow', 60, 0, 100),
  }),
  shadow: false, sheen: 0.15, rim: 0.2, depthWrite: true,
  duration: 18,
  camera(ctx) {
    const g = geo(ctx);
    return { perspective: g.persp, fog: { near: g.D - 0.3 * g.R, far: g.D + 2.2 * g.R } };
  },
  layout(ctx) {
    const { p, u, M } = ctx;
    const n = Math.max(1, ctx.n || 1);
    const g = geo(ctx);
    const { K, alpha, Pp, R, d, D, G, hd, foot, cwMax } = g;
    // card size: footprint along the axis ≤ 0.8 of the pair spacing; width ≤ 0.8R (no pair/neighbour collisions)
    const ca = Math.abs(Math.cos(alpha)), sa = Math.abs(Math.sin(alpha));
    const sizeOf = (mi) => {
      const r = ctx.ratioOf(mi);
      const h0 = hd * foot / (ca + 0.6 * r * sa);
      // width ≤ 0.8R, but a narrow radius keeps cards at ≥70% of their slot size (up to 1.6R) instead of chips
      const h = Math.min(h0, Math.max(0.8 * R, Math.min(1.6 * R, 0.7 * h0 * r)) / r, 0.42, cwMax / r);
      return { w: h * r, h };
    };
    const cam = D;
    const ext = 0.75 * g.along + R + 0.3;
    const a0 = Math.ceil(K * (u - ext / Pp)), a1 = Math.floor(K * (u + ext / Pp));
    const rc = p.rungColor || '#7fe0ff';
    const glow = p.glow / 100;
    const out = [];
    for (let a = a0; a <= a1; a++) {
      const yl = Pp * (a / K - u);
      const th = M.TAU * (a + 0.5) / K + M.TAU * u;   // half-step phase: u=0 is never an edge-on crossing
      const pts = [];
      for (let side = 0; side < 2; side++) {
        const t = th + side * Math.PI;
        const pos = mApply(G, [R * Math.sin(t), yl, R * Math.cos(t)]);
        const mi = M.mod(M.mod(a, K) * 2 + side, n);
        const sz0 = sizeOf(mi);
        // partial counter-perspective: front cards would swell into their vertical neighbours, back ones shrink to chips
        const cs = Math.pow((cam - pos[2]) / cam, 0.6);
        const sz = { w: sz0.w * cs, h: sz0.h * cs };
        const depth = (pos[2] / R + 1) / 2;
        const c = { media: mi, x: pos[0], y: pos[1], z: pos[2] + 0.006 * side, ry: 0.65 * Math.sin(t), rx: 0, rz: 0,
          w: sz.w, h: sz.h, mirrorBack: 'unmirror', bright: 0.78 + 0.22 * depth };
        out.push(c);
        pts.push({ pos, w: sz.w, h: sz.h, c });
      }
      // edge-on crossing: the back card sinks straight down (no sideways dart, so it never reverses behind its
      // partner) by ~0.75 of the card height, so ≥ ~55% of it stays visible, and eases slightly smaller/dimmer.
      // Continuous in u: everything scales with q, which is 0 away from the crossing.
      {
        const fi = pts[0].pos[2] >= pts[1].pos[2] ? 0 : 1, F = pts[fi], Bk = pts[1 - fi];
        const sF = cam / Math.max(0.05, cam - F.pos[2]), sB = cam / Math.max(0.05, cam - Bk.pos[2]);
        const sx = Bk.pos[0] * sB - F.pos[0] * sF, sy = Bk.pos[1] * sB - F.pos[1] * sF;
        const Wsum = (F.w * sF + Bk.w * sB) / 2, Hsum = (F.h * sF + Bk.h * sB) / 2;
        const q = M.smooth(0, 1, 1 - Math.abs(sx) / Wsum);
        if (q > 0) {
          const ny = sy + q * Math.min(0, -0.75 * Hsum - sy);
          const dyw = (ny - sy) * (cam - Bk.pos[2]) / cam;
          Bk.pos = [Bk.pos[0], Bk.pos[1] + dyw, Bk.pos[2]];
          Bk.c.y += dyw;
          const sc = 1 - 0.05 * q;
          Bk.c.w *= sc; Bk.c.h *= sc; Bk.w *= sc; Bk.h *= sc;
          Bk.c.bright *= 1 - 0.15 * q;
        }
      }
      // rung: projected line between the pair, drawn in a camera-facing plane at mid depth
      const A = pts[0].pos, B = pts[1].pos;
      const zm = (A[2] + B[2]) / 2;
      const prj = (q) => { const f = (cam - zm) / Math.max(0.05, cam - q[2]); return [q[0] * f, q[1] * f]; };
      const pa = prj(A), pb = prj(B);
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1];
      const L = Math.hypot(dx, dy);
      const fa = (cam - zm) / Math.max(0.05, cam - A[2]), fb = (cam - zm) / Math.max(0.05, cam - B[2]);
      const trimA = 0.45 * pts[0].w * fa, trimB = 0.45 * pts[1].w * fb;
      const len = L - trimA - trimB;
      if (len <= 0.004 || L < 1e-6) continue;
      const ux = dx / L, uy = dy / L;
      const sx = pa[0] + ux * trimA, sy = pa[1] + uy * trimA;
      const mx = sx + ux * len / 2, my = sy + uy * len / 2;
      const rz = Math.atan2(uy, ux);
      // steep rungs (edge-on pairs seen through lean/perspective) read as sticks and knot: fade past 35° from horizontal
      const ang = Math.atan2(Math.abs(uy), Math.abs(ux));
      const vis = M.smooth(0.004, 0.04, len) * (1 - 0.72 * M.smooth(M.rad(30), M.rad(40), ang));
      out.push({ useMedia: false, color: rc, x: mx, y: my, z: zm, rz, w: len, h: 0.008, radius: 0,
        shadow: 0, sheen: 0, rim: 0, opacity: vis, bright: 1.1 });
      if (glow > 0) {
        out.push({ light: { type: 'radial', stops: [[0, '#ffffff', 0.9], [0.25, rc, 0.7], [1, rc, 0]] },
          blend: 'add', x: mx, y: my, z: zm + 0.002, rz, w: len * 1.15 + 0.03, h: 0.05 + 0.04 * glow,
          opacity: vis * Math.min(1, glow * 1.4), bright: 0.6 + glow });
      }
    }
    // strand backbones: faint rung-tinted lines tracing each helix between consecutive cards (camera-facing segments)
    const SUB = 4;
    const hp = (af, side) => {
      const t = M.TAU * (af + 0.5) / K + M.TAU * u + side * Math.PI;
      return mApply(G, [R * Math.sin(t), Pp * (af / K - u), R * Math.cos(t)]);
    };
    for (let side = 0; side < 2; side++) {
      let prev = hp(a0 - 1, side);
      for (let s = 1; s <= (a1 - a0 + 2) * SUB; s++) {
        const cur = hp(a0 - 1 + s / SUB, side);
        const zm = (prev[2] + cur[2]) / 2;
        const f1 = (cam - zm) / Math.max(0.05, cam - prev[2]), f2 = (cam - zm) / Math.max(0.05, cam - cur[2]);
        const x1 = prev[0] * f1, y1 = prev[1] * f1, x2 = cur[0] * f2, y2 = cur[1] * f2;
        const L = Math.hypot(x2 - x1, y2 - y1);
        if (L > 1e-5) {
          const dep = (zm / R + 1) / 2;
          out.push({ useMedia: false, color: rc, x: (x1 + x2) / 2, y: (y1 + y2) / 2, z: zm - 0.01, rz: Math.atan2(y2 - y1, x2 - x1),
            w: L + 0.002, h: 0.005, radius: 0, shadow: 0, sheen: 0, rim: 0, opacity: 0.24 + 0.12 * dep, bright: 1.1,
            layer: -1, depthWrite: false });   // always beneath the cards: never streaks across a photo
        }
        prev = cur;
      }
    }
    // soft backdrop glow behind the axis so the stage isn't a flat void
    if (glow > 0) {
      out.push({ light: { type: 'radial', stops: [[0, rc, 0.5], [0.5, rc, 0.18], [1, rc, 0]] }, blend: 'add',
        x: 0, y: 0, z: -0.5 * R, w: 1.5 * ctx.view.w, h: 1.3, layer: -1, opacity: 0.18 * (0.5 + 0.5 * glow), bright: 1 });
    }
    return out;
  },
};
