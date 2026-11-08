// math + easing helpers shared by all templates
export const TAU = Math.PI * 2;
export const M = {
  TAU, PI: Math.PI,
  clamp: (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)),
  lerp: (a, b, t) => a + (b - a) * t,
  mix: (a, b, t) => a + (b - a) * t,
  fract: (x) => x - Math.floor(x),
  mod: (x, m) => ((x % m) + m) % m,
  rad: (d) => (d * Math.PI) / 180,
  deg: (r) => (r * 180) / Math.PI,
  smooth: (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); },
  // seeded random (deterministic)
  rand: (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); },
  // progress of window [a,b] within loop phase u (0..1), returns 0..1 clamped
  win: (u, a, b) => Math.min(1, Math.max(0, (u - a) / (b - a))),
  // smooth wrap distance on a circle
  wrap: (x) => x - Math.round(x),
  pingpong: (u) => 1 - Math.abs(1 - 2 * u),
  // grid helper: cols/rows that best fit n items into aspect
  grid: (n, aspect) => { let best = [1, n], bs = 1e9; for (let c = 1; c <= n; c++) { const r = Math.ceil(n / c); const s = Math.abs(c / r - aspect) + (c * r - n) * 0.15; if (s < bs) { bs = s; best = [c, r]; } } return { cols: best[0], rows: best[1] }; },
  // fibonacci sphere point k of n -> [x,y,z] unit
  fib: (k, n) => { const y = 1 - (2 * (k + 0.5)) / n; const r = Math.sqrt(1 - y * y); const th = k * Math.PI * (3 - Math.sqrt(5)); return [Math.cos(th) * r, y, Math.sin(th) * r]; },
};
const c1 = 1.70158, c3 = c1 + 1, c4 = (2 * Math.PI) / 3;
export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t, outQuad: (t) => 1 - (1 - t) * (1 - t), inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t, outCubic: (t) => 1 - Math.pow(1 - t, 3), inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t ** 4, outQuart: (t) => 1 - Math.pow(1 - t, 4), inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5), inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)), outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2, outSine: (t) => Math.sin((t * Math.PI) / 2), inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2), inBack: (t) => c3 * t * t * t - c1 * t * t,
  inOutBack: (t) => { const c2 = c1 * 1.525; return t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2; },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1),
  outBounce: (t) => { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375; },
  // spring-ish overshoot settle
  spring: (t) => 1 - Math.cos(t * Math.PI * 4.5) * Math.exp(-t * 6),
};
// step-hold timeline: for a loop phase u split into n beats, each beat = move (fraction m) then hold.
// returns continuous index value (e.g. 2.37 between item 2 and 3) using ease.
export function beats(u, n, move = 0.35, ease = E.inOutCubic) {
  const x = u * n; const k = Math.floor(x); const f = x - k; return k + ease(Math.min(1, f / move));
}

// X0: normalise user-supplied params against template param defs (CLI/JSON strings -> list/text/color)
// list: 'A|B|C' -> ['A','B','C'] ; text: always a string ; color: '#'-prefixed hex string
export function normParams(params, defs = {}) {
  const out = { ...params };
  for (const [k, d] of Object.entries(defs)) {
    const v = out[k]; if (v == null || !d) continue;
    if (d.type === 'list' && !Array.isArray(v)) out[k] = String(v).split('|').map((s) => s.trim()).filter((s) => s.length);
    else if (d.type === 'text' && typeof v !== 'string') out[k] = String(v);
    else if (d.type === 'color') { let s = String(v).trim(); if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s)) s = '#' + s; out[k] = s; }
  }
  return out;
}

// ---------- X8: camera paths ----------
// points: [[x,y,z], ...] or [{x,y,z}, ...] (z optional). t: 0..1 over the whole path.
// closed (default true): wraps, t is taken mod 1 so t=0 and t=1 are the same point AND tangent (seamless loops).
// tension 0.5 = classic Catmull-Rom (tangent = tension * (p[i+1] - p[i-1])); 0 = straight segments, >0.5 rounder.
const _pt = (p) => (Array.isArray(p) ? [p[0] || 0, p[1] || 0, p[2] || 0] : [p.x || 0, p.y || 0, p.z || 0]);
function _seg(points, t, o) {
  const closed = o.closed ?? true, n = points.length;
  const segs = closed ? n : n - 1;
  let x = closed ? (t - Math.floor(t)) * segs : Math.min(1, Math.max(0, t)) * segs;
  let i = Math.floor(x); if (i >= segs) i = segs - 1; const f = x - i;
  const at = (k) => _pt(points[closed ? ((k % n) + n) % n : Math.min(n - 1, Math.max(0, k))]);
  return { p0: at(i - 1), p1: at(i), p2: at(i + 1), p3: at(i + 2), f, segs, tension: o.tension ?? 0.5 };
}
export function spline(points, t, o = {}) {
  if (points.length < 2) return _pt(points[0] || [0, 0, 0]);
  const { p0, p1, p2, p3, f, tension: k } = _seg(points, t, o);
  const f2 = f * f, f3 = f2 * f, h00 = 2 * f3 - 3 * f2 + 1, h10 = f3 - 2 * f2 + f, h01 = -2 * f3 + 3 * f2, h11 = f3 - f2;
  return [0, 1, 2].map((a) => h00 * p1[a] + h10 * k * (p2[a] - p0[a]) + h01 * p2[a] + h11 * k * (p3[a] - p1[a]));
}
// d/dt of spline (per unit of the whole-path t); normalized unless {raw:true}
export function splineTangent(points, t, o = {}) {
  if (points.length < 2) return [0, 0, -1];
  const { p0, p1, p2, p3, f, segs, tension: k } = _seg(points, t, o);
  const f2 = f * f, d00 = 6 * f2 - 6 * f, d10 = 3 * f2 - 4 * f + 1, d01 = -6 * f2 + 6 * f, d11 = 3 * f2 - 2 * f;
  const v = [0, 1, 2].map((a) => (d00 * p1[a] + d10 * k * (p2[a] - p0[a]) + d01 * p2[a] + d11 * k * (p3[a] - p1[a])) * segs);
  if (o.raw) return v; const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L];
}
// camera riding the path: position at t, looking at the point `ahead` (path fraction) further on.
// bank: roll = atan(bank * lateral curvature) (curvature in 1/world units, averaged over ±ahead so it eases in);
// positive = leans into the turn. maxRoll caps it (rad). Returns a camera() object (rollAxis 'view' = roll about the view axis).
export function lookAlong(points, t, ahead = 0.02, o = {}) {
  const closed = o.closed ?? true; const P = spline(points, t, o);
  let ta = t + ahead; if (!closed && ta > 1) ta = 1;
  let L = spline(points, ta, o);
  if (Math.hypot(L[0] - P[0], L[1] - P[1], L[2] - P[2]) < 1e-6) { const d = splineTangent(points, t, o); L = [P[0] + d[0], P[1] + d[1], P[2] + d[2]]; }
  let roll = 0; const bank = o.bank ?? 0;
  if (bank) {
    const up = o.up || [0, 1, 0]; const N = 5, w = Math.max(1e-3, Math.abs(ahead)); let acc = 0;
    for (let j = 0; j < N; j++) {
      const tj = t + (j / (N - 1) - 0.5) * w, e = 1e-3;
      const va = splineTangent(points, tj - e, { ...o, raw: true }), vb = splineTangent(points, tj + e, { ...o, raw: true });
      const sp = Math.hypot(...splineTangent(points, tj, { ...o, raw: true })) || 1;
      const na = Math.hypot(...va) || 1, nb = Math.hypot(...vb) || 1;
      const dT = [0, 1, 2].map((a) => (vb[a] / nb - va[a] / na) / (2 * e * sp)); // dT/ds
      const T = splineTangent(points, tj, o);
      let R = [T[1] * up[2] - T[2] * up[1], T[2] * up[0] - T[0] * up[2], T[0] * up[1] - T[1] * up[0]]; // right = T x up
      const rl = Math.hypot(...R) || 1; R = R.map((c) => c / rl);
      acc += dT[0] * R[0] + dT[1] * R[1] + dT[2] * R[2];
    }
    const mr = o.maxRoll ?? 0.6; roll = Math.max(-mr, Math.min(mr, Math.atan(bank * acc / N)));
  }
  return { x: P[0], y: P[1], z: P[2], lookX: L[0], lookY: L[1], lookZ: L[2], roll, rollAxis: 'view' };
}

// ---------- X3a: particle helpers (pure, deterministic, loop-periodic) ----------
// hash(k, seed): deterministic pseudo-random in [0,1) for integer-ish k (particle index) and seed.
export function hash(k, seed = 0) {
  let h = (Math.imul((k | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((seed | 0) + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const _fr = (x) => x - Math.floor(x);
// drift(k, u, {speed, seed, dims}): periodic position of particle k at loop phase u, each dim in [0,1).
// x = fract(u*speed + h0) travels (speed must be an integer so u=0 and u=1 match; non-integers are rounded);
// y = h1, z = h2 are fixed per particle. dims (1..3) limits which keys are filled; others are 0.
export function drift(k, u, o = {}) {
  const speed = Math.round(o.speed ?? 1), seed = o.seed ?? 0, dims = o.dims ?? 3;
  const h = (d) => hash(k * 3 + d, seed);
  return { x: _fr(u * speed + h(0)), y: dims > 1 ? h(1) : 0, z: dims > 2 ? h(2) : 0 };
}
// emit(u, k, {rate, life, seed}): periodic emitter. `rate` particles are born evenly per loop (slot k mod rate),
// with a per-particle jitter of birth time from the seed; each lives `life` (fraction of loop, 0..1).
// Returns {age, birth}: age in [0,1) normalized within life, or -1 when not alive; birth in [0,1) = birth phase.
// Wraps across the loop seam, so emit(0,k) === emit(1,k).
export function emit(u, k, o = {}) {
  const rate = Math.max(1, Math.round(o.rate ?? 16)), life = Math.min(1, Math.max(1e-6, o.life ?? 0.5)), seed = o.seed ?? 0;
  const i = ((Math.round(k) % rate) + rate) % rate;
  const birth = _fr((i + hash(i, seed + 7919)) / rate);
  const dt = _fr(u - birth); // time since birth, wrapped (0..1)
  return { age: dt < life ? dt / life : -1, birth };
}

// ---------- X2: device frames (pure geometry tables; the engine expands a `device` card into body + screen + details) ----------
// deviceInfo(type, {orient, hinge}) -> all sizes in units of the OUTER BODY WIDTH (W = 1); y up, relative to the body centre.
//   aspect = body w/h (laptop: lid w/h) ; h = body height ; radius / depth (body thickness) ; screen = {x0,y0,x1,y1} fractions of
//   the body, origin TOP-LEFT (like X1 fillRect) ; scr = {cx, cy, w, h, r} screen rect in W units ; screenAspect.
//   laptop: lid = {cx, cy, cz, lean} (lid centre + lean angle about x), deck = {cy, cz, d, t}, bbox = {w, h, d} of the whole laptop.
const DEV = {
  //        portrait w/h  corner R  bezel [top, right, bottom, left] (units of the short side)  depth
  phone:   { a: 0.485, R: 0.16, bez: [0.036, 0.036, 0.036, 0.036], depth: 0.085, sr: 0.125, island: { w: 0.30, h: 0.088, off: 0.034 } },
  tablet:  { a: 0.72, R: 0.07, bez: [0.05, 0.05, 0.05, 0.05], depth: 0.045, sr: 0.03, cam: 0.016 },
  watch:   { a: 0.84, R: 0.27, bez: [0.085, 0.085, 0.085, 0.085], depth: 0.30, sr: 0.19 },
  crt:     { a: 1.2, R: 0.07, bez: [0.085, 0.095, 0.175, 0.095], depth: 0.42, sr: 0.06, land: true },
  browser: { a: 1.6, R: 0.022, bez: [0.075, 0, 0, 0], depth: 0, sr: 0, land: true },
};
export const DEVICE_TYPES = ['phone', 'tablet', 'laptop', 'watch', 'browser', 'crt'];
export function deviceInfo(type = 'phone', o = {}) {
  if (type === 'laptop') {
    const lidH = 1 / 1.52, R = 0.03, bz = [0.034, 0.024, 0.052, 0.024], lidD = 0.012, deckD = 0.70, deckT = 0.026;
    const hinge = o.hinge ?? 1.88, lean = -(hinge - Math.PI / 2); // lid leans back from vertical by (hinge - 90deg)
    // local frame: deck horizontal, hinge line along x; centre the bounding box of lid + deck on the origin
    const topY = lidH * Math.cos(lean), topZ = lidH * Math.sin(lean) - lidD;
    const y0 = -deckT, y1 = Math.max(topY, 0), z0 = Math.min(topZ, -lidD), z1 = deckD;
    const hy = -(y0 + y1) / 2, hz = -(z0 + z1) / 2;  // hinge point after centring
    const sw = 1 - bz[1] - bz[3], sh = lidH - bz[0] - bz[2];
    return { type, aspect: 1.52, w: 1, h: lidH, radius: R, depth: lidD, hinge, lean,
      screen: { x0: bz[3], y0: bz[0] / lidH, x1: 1 - bz[1], y1: 1 - bz[2] / lidH },
      scr: { cx: (bz[3] - bz[1]) / 2, cy: (bz[2] - bz[0]) / 2, w: sw, h: sh, r: 0.012 }, screenAspect: sw / sh,
      notch: { w: 0.075, h: 0.02 },
      hingeAt: { y: hy, z: hz },
      lid: { cx: 0, cy: hy + (lidH / 2) * Math.cos(lean), cz: hz + (lidH / 2) * Math.sin(lean), lean },
      deck: { w: 1, d: deckD, t: deckT, cy: hy, cz: hz + deckD / 2 },
      bbox: { w: 1, h: y1 - y0, d: z1 - z0 } };
  }
  const D = DEV[type] || DEV.phone; const land = D.land ? o.orient !== 'portrait' : o.orient === 'landscape';
  // native table is portrait (or landscape for crt/browser); unit = short side
  let pw = D.land ? D.a : 1, ph = D.land ? 1 : 1 / D.a; let bez = D.bez.slice();
  if (land !== !!D.land) { [pw, ph] = [ph, pw]; bez = [bez[3], bez[0], bez[1], bez[2]]; } // rotate 90deg: left bezel becomes top
  const W = pw, k = 1 / W; // normalise to outer width = 1
  const bw = 1, bh = ph * k, [bt, br, bb, bl] = bez.map((b) => b * k);
  const sw = bw - bl - br, sh = bh - bt - bb;
  const info = { type, aspect: bw / bh, w: bw, h: bh, radius: D.R * k, depth: D.depth * k, orient: land ? 'landscape' : 'portrait',
    screen: { x0: bl, y0: bt / bh, x1: 1 - br, y1: 1 - bb / bh },
    scr: { cx: (bl - br) / 2, cy: (bb - bt) / 2, w: sw, h: sh, r: D.sr * k }, screenAspect: sw / sh };
  if (D.island) { const I = D.island; // pill near the top short side (portrait) / left short side (landscape)
    info.island = land ? { cx: info.scr.cx - sw / 2 + (I.off + I.h / 2) * k, cy: info.scr.cy, w: I.h * k, h: I.w * k }
      : { cx: info.scr.cx, cy: info.scr.cy + sh / 2 - (I.off + I.h / 2) * k, w: I.w * k, h: I.h * k }; }
  if (D.cam) info.cam = land ? { cx: -bw / 2 + bl / 2, cy: 0, d: D.cam * k } : { cx: 0, cy: bh / 2 - bt / 2, d: D.cam * k };
  if (type === 'watch') { info.strap = { w: 0.74, h: 0.5 * bh }; info.crown = { w: 0.07, h: 0.2 * bh, d: 0.75 * info.depth }; }
  if (type === 'browser') { info.bar = bt; }
  return info;
}
