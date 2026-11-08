import { base, P, EASINGS, easeOf, cardAR } from '../_common.js';
// Focus Rack (original): a row of cards recedes in depth at an angle like a product line-up. A cinematic
// rack-focus walks back through the row one card per beat (blur and soft edges grow with distance from the
// focal plane, the focused card brightens, lifts and turns slightly to camera while the camera drifts after
// it). On the last beat focus racks smoothly all the way back to the front card, so u=1 matches u=0.
// Out-of-focus bokeh discs float behind the row.

// focus position (in card-index units) at loop phase u: hold, then move one card; last beat sweeps back to 0
function focusAt(u, K, move, ease, M) {
  const x = u * K, k = Math.min(K - 1, Math.floor(x)), f = x - k;
  const hold = 1 - move;
  if (k < K - 1) return k + ease(M.clamp((f - hold) / move));
  const mb = Math.min(0.92, move * 1.7); // the return sweep takes longer
  return (K - 1) * (1 - ease(M.clamp((f - (1 - mb)) / mb)));
}

function geometry(ctx) {
  const { p, M, inner: I, isPortrait } = ctx;
  const K = Math.max(3, Math.round(p.cards));
  const ar = cardAR(ctx, 4 / 5);
  const yaw = M.rad(p.cardYaw);
  const h0 = I.h * p.cardSize / 100, w0 = h0 * ar;
  const sx = w0 * p.spacing / 100, sz = w0 * Math.min(90, p.depthStep) / 100;
  const rise = isPortrait ? 0.9 : (ctx.aspect < 1.2 ? 0.32 : 0.1); // portrait rows also climb upward as they recede
  const D = camDistOf(p);
  // raw positions (scale 1), then fit the projected bounding box into the inner frame
  const raw = [];
  for (let i = 0; i < K; i++) raw.push({ x: i * sx * (isPortrait ? 0.7 : 1), y: i * sx * rise, z: -i * sz });
  const bbox = (S, ox, oy) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const r of raw) {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const cx = (r.x + ox) * S + sx * (w0 * S / 2) * Math.cos(yaw), cz = r.z * S - sx * (w0 * S / 2) * Math.sin(yaw);
        const cy = (r.y + oy) * S + sy * h0 * S / 2;
        const k = D / (D - cz);
        x0 = Math.min(x0, cx * k); x1 = Math.max(x1, cx * k); y0 = Math.min(y0, cy * k); y1 = Math.max(y1, cy * k);
      }
    }
    return { x0, x1, y0, y1 };
  };
  let S = 1, ox = -raw[K - 1].x / 2, oy = -raw[K - 1].y / 2;
  for (let it = 0; it < 6; it++) {
    const b = bbox(S, ox, oy);
    const sc = Math.min(I.w * 0.96 / (b.x1 - b.x0), I.h * 0.9 / (b.y1 - b.y0));
    S = Math.min(1, S * sc ** 0.9);
    const b2 = bbox(S, ox, oy);
    ox -= (b2.x0 + b2.x1) / 2 / S * 0.8; oy -= (b2.y0 + b2.y1) / 2 / S * 0.8;
  }
  const pos = raw.map((r) => ({ x: (r.x + ox) * S, y: (r.y + oy) * S, z: r.z * S }));
  return { K, pos, w: w0 * S, h: h0 * S, yaw, D };
}

const camDistOf = (p) => 0.5 / Math.tan(((6 + p.perspective * 1.6) * Math.PI) / 360);
const LIFTZ = 0.38; // focused card comes forward by this share of its height

// camera state shared by camera() and layout(): follows the focus and dollies in so the focused card stays big
function camState(ctx, g, f) {
  const { p, M, view } = ctx;
  const i0 = Math.floor(f), t = f - i0, a = g.pos[i0], b = g.pos[Math.min(g.K - 1, i0 + 1)];
  const mid = g.pos[Math.floor((g.K - 1) / 2)], mid2 = g.pos[Math.ceil((g.K - 1) / 2)];
  const cx = (mid.x + mid2.x) / 2, cy = (mid.y + mid2.y) / 2;
  const fx = M.lerp(a.x, b.x, t), fy = M.lerp(a.y, b.y, t), fz = M.lerp(a.z, b.z, t) + LIFTZ * g.h;
  const D = g.D;
  // target: focused card ≥ ~30% of the frame's long side (16:9 width, 9:16 height-equivalent)
  const want = 0.3 * Math.max(view.w, view.h);
  const need = g.w * D / want;                      // camera-to-card distance that gives that width
  const maxPush = Math.max(0, D - 0.42);            // never fly into the front card
  const push = M.clamp((D - fz) - need, 0, maxPush);
  // the camera tracks the focused card (follow 0 = stays on the row centre, 100 = locks onto the focus)
  const k = 0.95 * p.follow / 100;
  const lx = cx + (fx - cx) * k, ly = cy + (fy - cy) * k;
  return { z: D - push, x: lx * 0.97, y: ly * 0.97, lookX: lx, lookY: ly, lookZ: Math.min(0, fz) * 0.5 };
}

export default {
  id: 'focus-rack', name: 'Focus Rack', category: 'spotlight-focus', slots: 5,
  desc: 'Row of cards receding in depth; a cinematic rack-focus walks back card by card, then racks home to the front',
  tags: ['spotlight', 'focus', 'depth of field', 'blur', 'cinematic', 'product', 'lineup'], ref: 'original',
  params: base({
    cards: P.num('Cards', 5, 3, 8),
    cardSize: P.pct('Card size', 62, 20, 100),
    spacing: P.pct('Spacing', 72, 30, 150),
    depthStep: P.pct('Depth step', 55, 0, 90),
    cardYaw: P.deg('Card yaw', 24, -45, 45),
    maxBlur: P.num('Max blur', 4.5, 0, 6, '', 0.1),
    dim: P.pct('Out-of-focus dim', 42, 0, 90),
    follow: P.pct('Camera follow', 80, 0, 100),
    ease: P.choice('Easing', 'custom', EASINGS),
    move: P.pct('Rack time', 45, 15, 90),
    bokeh: P.bool('Bokeh', true),
    bokehColor: P.color('Bokeh colour', '#ffd6a0'),
    perspective: P.perspective(32),
    cardRatio: P.cardRatio('auto'),
  }),
  shadow: true, shadowOpacity: 0.5,
  duration: 10,
  camera(ctx) {
    const { p, M } = ctx;
    const g = geometry(ctx);
    const f = focusAt(ctx.u, g.K, M.clamp(p.move / 100, 0.1, 0.95), easeOf(p.ease), M);
    return { perspective: p.perspective, ...camState(ctx, g, f) };
  },
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const g = geometry(ctx);
    const ease = easeOf(p.ease);
    const f = focusAt(u, g.K, M.clamp(p.move / 100, 0.1, 0.95), ease, M);
    const out = [];
    for (let i = 0; i < g.K; i++) {
      const d = Math.abs(i - f);
      const dn = M.clamp(d / 2.2);                       // 0 in focus .. 1 far out of focus
      const lift = M.smooth(0, 1, 1 - M.clamp(d));       // 1 exactly in focus
      const pp = g.pos[i];
      out.push({
        media: M.mod(i, n), x: pp.x, y: pp.y + lift * g.h * 0.025, z: pp.z + lift * g.h * LIFTZ,
        layer: d < 0.5 ? 2 : 1,   // focused card always draws on top
        ry: g.yaw * (1 - 0.35 * lift), w: g.w, h: g.h,
        blur: p.maxBlur * Math.pow(dn, 0.75),
        bright: 1.04 - (p.dim / 100) * dn, sat: 1 - 0.3 * dn,
        shadow: 0.5 * (1 - 0.65 * dn),
        edgeX: 0.45 * lift,
      });
    }
    if (p.bokeh) {
      // stratified 4×4 field (one disc per cell, jittered) at a far plane, centred on the camera so it always fills the frame
      const cam = camState(ctx, g, f);
      const zb = -2.4, dz = cam.z - zb, fov = M.rad(6 + p.perspective * 1.6);
      const vh = 2 * dz * Math.tan(fov / 2) * 1.08, vw = vh * ctx.view.w / ctx.view.h;
      const GX = 4, GY = 4;
      for (let b = 0; b < GX * GY; b++) {
        const R = (s) => M.rand(b + 3, s);
        const gx = b % GX, gy = Math.floor(b / GX);
        const ph = M.TAU * u + R(4) * M.TAU;
        const big = R(3) > 0.7;
        const sz = (big ? 0.22 + 0.16 * R(7) : 0.06 + 0.12 * R(7)) * Math.min(vw, vh);
        const bx = ((gx + 0.15 + 0.7 * R(1)) / GX - 0.5) * vw + Math.sin(ph) * 0.02 * vh;
        const by = ((gy + 0.15 + 0.7 * R(2)) / GY - 0.5) * vh + Math.cos(ph) * 0.015 * vh;
        out.push({
          light: { type: 'radial', stops: [[0, p.bokehColor, 0.32], [0.7, p.bokehColor, 0.42], [0.88, p.bokehColor, 1], [1, p.bokehColor, 0]] },
          blend: 'add', x: cam.lookX * 0.6 + bx, y: cam.lookY * 0.6 + by, z: zb - R(5) * 0.3, w: sz, h: sz,
          opacity: (big ? 0.12 : 0.2 + 0.18 * R(6)) * (0.78 + 0.22 * Math.sin(ph)), layer: -1,
        });
      }
    }
    return out;
  },
};
