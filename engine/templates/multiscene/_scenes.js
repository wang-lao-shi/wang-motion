// Multiscene helper: a looped timeline of "scenes" (each a pose function returning card states)
// with eased, optionally staggered interpolation between consecutive scenes. Card identity = array index
// (or card.key). Files starting with _ are not listed as templates.
import { E } from '../../lib.js';

const NUM = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'w', 'h', 's', 'opacity', 'bright', 'bend', 'bendX', 'zoom', 'panX', 'panY', 'sat', 'shadow', 'radius'];
const DEF = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, opacity: 1, bright: 1, bend: 0, bendX: 0, zoom: 1, panX: 0, panY: 0, sat: 1 };
const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// interpolate two card states (a or b may be null -> the other one faded out)
export function mixCard(a, b, q) {
  if (!a && !b) return null;
  if (!a) a = { ...b, opacity: 0 };
  if (!b) b = { ...a, opacity: 0 };
  if (q <= 0) return a; if (q >= 1) return b;
  const o = { ...(q < 0.5 ? a : b) };
  for (const k of NUM) {
    const va = a[k] ?? DEF[k], vb = b[k] ?? DEF[k];
    if (va === undefined || vb === undefined) continue;
    o[k] = va + (vb - va) * q;
  }
  if ((a.opacity ?? 1) <= 0.001 && (b.opacity ?? 1) > 0.001) Object.assign(o, { ...b, ...pick(o) });
  return o;
}
function pick(o) { const r = {}; for (const k of NUM) if (o[k] !== undefined) r[k] = o[k]; return r; }

// mix two card sets. opts.stagger: 0..1 fraction of the move spent staggering; opts.delay(i, a, b, N) -> 0..1 order
export function mixSets(A, B, q, ease = E.inOutCubic, opts = {}) {
  const N = Math.max(A.length, B.length); const out = [];
  const st = opts.stagger || 0;
  for (let i = 0; i < N; i++) {
    const a = A[i], b = B[i];
    const d = st ? (opts.delay ? opts.delay(i, a, b, N) : (N > 1 ? i / (N - 1) : 0)) : 0;
    const qi = st ? cl((q - d * st) / (1 - st)) : q;
    const e = (opts.easeOf ? opts.easeOf(i) : ease)(qi);
    const c = opts.via ? opts.via(a, b, e, i, qi) : mixCard(a, b, e);
    if (c) out.push(c);
  }
  return out;
}

// scenes: [{ hold, move, pose(ctx, f) -> cards, ease?, stagger?, delay?, via? }]
// hold/move are relative durations (normalised to the loop). The move of scene i blends pose_i(1) -> pose_{i+1}(0).
// The last scene blends into the first, so the loop is seamless.
export function play(ctx, scenes, opt = {}) {
  const tot = scenes.reduce((s, sc) => s + (sc.hold || 0) + (sc.move || 0), 0);
  let x = (((ctx.u + (opt.offset || 0)) % 1 + 1) % 1) * tot;
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    if (x < (sc.hold || 0)) return sc.pose(ctx, x / sc.hold, i);
    x -= sc.hold || 0;
    if (x < (sc.move || 0) || i === scenes.length - 1) {
      const nx = scenes[(i + 1) % scenes.length];
      const q = cl(x / (sc.move || 1));
      if (sc.blend) return sc.blend(ctx, q);
      return mixSets(sc.pose(ctx, 1, i), nx.pose(ctx, 0, (i + 1) % scenes.length), q, sc.ease || opt.ease || E.inOutCubic, sc);
    }
    x -= sc.move || 0;
  }
  return [];
}

// current scene index + local progress (for camera functions)
export function where(ctx, scenes, opt = {}) {
  const tot = scenes.reduce((s, sc) => s + (sc.hold || 0) + (sc.move || 0), 0);
  let x = (((ctx.u + (opt.offset || 0)) % 1 + 1) % 1) * tot;
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    if (x < (sc.hold || 0)) return { i, phase: 'hold', f: x / sc.hold };
    x -= sc.hold || 0;
    if (x < (sc.move || 0) || i === scenes.length - 1) return { i, phase: 'move', f: cl(x / (sc.move || 1)) };
    x -= sc.move || 0;
  }
  return { i: 0, phase: 'hold', f: 0 };
}

// mirror image of a card below a floor at y = fy (for glossy floor reflections)
export function reflect(c, fy, alpha = 0.25) {
  return { ...c, y: 2 * fy - c.y, rx: -(c.rx || 0), rz: -(c.rz || 0), opacity: (c.opacity ?? 1) * alpha, uv: [0, 1, 1, 0], shadow: 0, layer: -1 };
}

// scale so a layout designed for a 1:1 frame fits other ratios
export const unit = (ctx) => Math.min(1, ctx.view.w);
export const mod = (a, b) => ((a % b) + b) % b;
// eased hold-step counter: n steps over [0,1], each move takes fraction m of its step
export function steps(f, n, m = 0.4, ease = E.inOutCubic) { const x = f * n; const k = Math.floor(x); return k + ease(cl((x - k) / m)); }
// keyframe track: keys [[f, value], ...] sorted by f, eased between keys (default inOutSine), clamped at ends
export function kf(f, keys, ease = E.inOutSine) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, va] = keys[i], [b, vb] = keys[i + 1];
    if (f <= b) return va + (vb - va) * ease((f - a) / (b - a || 1));
  }
  return keys[keys.length - 1][1];
}
// billboard ring of k cards (x-z circle) pitched about X then rolled about Z; spin = front index (continuous)
export function ring(k, spin, R, pitch = 0, roll = 0) {
  const out = [];
  for (let i = 0; i < k; i++) {
    const th = ((i - spin) / k) * Math.PI * 2;
    let x = R * Math.sin(th), y = 0, z = R * Math.cos(th);
    const cp = Math.cos(pitch), sp = Math.sin(pitch); [y, z] = [y * cp - z * sp, y * sp + z * cp];
    const cr = Math.cos(roll), sr = Math.sin(roll); [x, y] = [x * cr - y * sr, x * sr + y * cr];
    out.push({ x, y, z, th, front: Math.cos(th) });
  }
  return out;
}
