import { base, P, cardAR, latticeMedia, curvePoint } from '../_common.js';
import { E, beats } from '../../lib.js';
// Endless wall of cards wrapped on the inside of a sphere (concave), rows scrolling sideways.
export default {
  id: 'sphere-wall', name: 'Sphere Wall', category: '3d-perspective', slots: 8,
  desc: 'Grid of cards on the inside of a sphere, scrolling sideways one row-loop per cycle',
  tags: ['wall', 'grid', 'sphere', '3d', 'immersive'], ref: 'animos',
  params: base({
    zoom: P.pct('Zoom', 20, 0, 100),
    tilt: P.deg('Tilt', 0, -45, 45),
    padding: P.padding(13),
    cornerRadius: P.cornerRadius(0.5),
    curvature: P.num('Curvature (concave ⟷ convex)', -100, -100, 100, '%'),
    gap: P.num('Gap', 5, 0, 20, '%', 0.25),
    edgeFade: P.pct('Edge fade', 0),
    cardRatio: P.cardRatio(),
    motion: P.choice('Motion', 'continuous', ['continuous', 'waypoints', 'waypointsNoZoom']),
    direction: P.choice('Direction', 'left', ['left', 'right', 'alternate']),
    period: P.num('Cards per loop', 8, 2, 24),
    speed: P.speed(1),
  }),
  shadow: false, sheen: 0.15, rim: 0, edgeX: 0.85, edgeW: 0.0032,
  duration: 20,
  camera() { return { perspective: 30 }; },
  layout(ctx) { return wall(ctx, 'h'); },
};

// shared by sphere-wall (h = horizontal flow) and sphere-cascade (v = vertical flow)
export function wall(ctx, axis, o = {}) {
  const { p, n, u, M } = ctx;
  const ar = cardAR(ctx, o.ar ?? 1.9);
  const zs = 0.6 + p.zoom / 50;                       // zoom 20% -> 1.0
  const fm = o.fitMin ? Math.min(ctx.view.w, ctx.view.h) : 1;   // fitMin: card size follows min(w,h) so density holds on every ratio
  const cw0 = (o.cw ?? 0.198) * zs * fm;
  let cw = cw0, ch = cw0 / ar;
  if (o.fixH) { ch = o.fixH * zs; cw = ch * ar; }
  const g = (p.gap / 100) * 0.92 * zs * fm;
  const px = cw + g, py = ch + g;
  const per = Math.max(1, Math.round(p.period));
  // travel (in cells) at this phase
  let s, zoomK = 1;
  if (p.motion === 'continuous') s = u * per * p.speed;
  else {
    const steps = per * Math.abs(p.speed || 1);
    s = beats(u, steps, 0.5, E.inOutCubic) * Math.sign(p.speed || 1);
    if (p.motion === 'waypoints') { const f = M.fract(u * steps); zoomK = 1 - 0.14 * Math.sin(Math.PI * M.clamp(f / 0.5)); }
  }
  const c = p.curvature / 100;
  const kBase = o.k ?? 0.55;
  const kx = kBase * Math.abs(c);
  const ky = o.cyl ? 0 : kBase * Math.abs(c);
  const sgn = c < 0 ? 1 : -1;
  const tilt = M.rad(p.tilt);
  const V = ctx.view;
  const reach = Math.max(V.w, V.h) * 0.5 / zoomK + Math.max(px, py) * 1.5;
  const C = Math.min(14, Math.ceil(reach / px) + 1), R = Math.min(14, Math.ceil(reach / py) + 1);
  const out = [];
  for (let r = -R; r <= R; r++) for (let k = -C; k <= C; k++) {
    let X, Y, idx;
    if (axis === 'v') {
      // columns scrolling vertically; up = +1
      let dir = p.direction === 'down' ? -1 : 1;
      if (p.direction === 'alternate' && (k & 1)) dir = -dir;
      const off = s * dir, fr = off - Math.floor(off);
      X = k * px; Y = (r + fr) * py;
      if (o.stagger) Y += (k & 1) * py * o.stagger;
      idx = latticeMedia(r - Math.floor(off), -k, n, per, o.colShift ?? 2);
    } else {
      let dir = p.direction === 'right' ? -1 : 1;
      if (p.direction === 'alternate' && (r & 1)) dir = -dir;
      const off = s * dir;
      const fr = off - Math.floor(off);
      X = (k - fr) * px; Y = -r * py;
      idx = latticeMedia(k + Math.floor(off), r, n, per, o.rowShift ?? 2);
    }
    // tilt rotates the lattice in-plane
    const Xr = X * Math.cos(tilt) - Y * Math.sin(tilt), Yr = X * Math.sin(tilt) + Y * Math.cos(tilt);
    const Xz = Xr * zoomK, Yz = Yr * zoomK;
    if (Math.abs(Xz) > V.w * 0.5 + cw * 1.2 && !(c < 0)) continue;
    const q = curvePoint(Xz, Yz, kx, ky, sgn);
    // cull cards wrapped past ~100° on the sphere
    if (Math.abs(Xz * kx) > 1.75 || Math.abs(Yz * ky) > 1.6) continue;
    const ed = Math.hypot(Xz / (V.w * 0.5), Yz / (V.h * 0.5));
    const fade = 1 - (p.edgeFade / 100) * M.smooth(0.35, 1.05, ed);
    out.push({ media: idx, x: q.x, y: q.y, z: q.z, rx: q.rx, ry: q.ry, rz: tilt, order: 'YXZ', w: cw * zoomK, h: ch * zoomK,
      bend: q.bend, bendX: q.bendX, opacity: fade });
  }
  return out;
}
