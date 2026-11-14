// shared param definitions + helpers for templates
import { deviceInfo } from '../lib.js';
export const P = {
  padding: (d = 6) => ({ type: 'number', min: 0, max: 30, step: 0.5, unit: '%', default: d, label: 'Padding' }),
  cornerRadius: (d = 3) => ({ type: 'number', min: 0, max: 25, step: 0.5, unit: '%', default: d, label: 'Corner radius' }),
  perspective: (d = 18) => ({ type: 'number', min: 0, max: 60, step: 1, unit: '%', default: d, label: 'Perspective' }),
  num: (label, d, min, max, unit = '', step = 1) => ({ type: 'number', label, default: d, min, max, unit, step }),
  pct: (label, d, min = 0, max = 100) => ({ type: 'number', label, default: d, min, max, unit: '%', step: 1 }),
  deg: (label, d, min = -180, max = 180) => ({ type: 'number', label, default: d, min, max, unit: '°', step: 1 }),
  bool: (label, d = true) => ({ type: 'boolean', label, default: d }),
  choice: (label, d, options) => ({ type: 'choice', label, default: d, options }),
  // X0: colour / text / list params (CLI: --param tint=#ffcc66 --param text="HELLO" --param words="A|B|C")
  color: (label, d = '#ffffff') => ({ type: 'color', label, default: d }),
  text: (label, d = '') => ({ type: 'text', label, default: d }),
  list: (label, d = []) => ({ type: 'list', label, default: d }),
  speed: (d = 1) => ({ type: 'number', label: 'Speed (loops/turns per cycle)', default: d, min: -4, max: 4, step: 1 }),
};
export const base = (extra = {}) => ({ padding: P.padding(), cornerRadius: P.cornerRadius(), ...extra });
// rotate point about X (pitch) then Y (yaw)
export function rotX([x, y, z], a) { const c = Math.cos(a), s = Math.sin(a); return [x, y * c - z * s, y * s + z * c]; }
export function rotY([x, y, z], a) { const c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, y, -x * s + z * c]; }
export function rotZ([x, y, z], a) { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c, z]; }
// fit size: card width & height for media i given target height h
export function sizeH(ctx, i, h) { const r = ctx.ratioOf(i); return { w: h * r, h }; }
export function sizeW(ctx, i, w) { const r = ctx.ratioOf(i); return { w, h: w / r }; }
// box-fit: card fits inside box (bw,bh)
export function fit(ctx, i, bw, bh) { const r = ctx.ratioOf(i); return r > bw / bh ? { w: bw, h: bw / r } : { w: bh * r, h: bh }; }
// back-face dimming: facing = dot(normal, toCamera) in [-1,1]
export function backFade(facing, amount) { return 1 - amount * Math.min(1, Math.max(0, (0.25 - facing) / 0.75)); }

// ---- helpers added for 3d-perspective replicas (backward compatible) ----
import { E as _E } from '../lib.js';
// animos easing menu -> easing fn
export const EASINGS = ['custom', 'smooth', 'natural', 'slowDown', 'snappy', 'accelerate', 'elastic', 'bounce', 'overshoot', 'impulse', 'swing', 'linear'];
export function easeOf(name) {
  return ({ custom: _E.inOutQuart, smooth: _E.inOutCubic, natural: _E.inOutSine, slowDown: _E.outCubic, snappy: _E.outExpo, accelerate: _E.inCubic,
    elastic: _E.outElastic, bounce: _E.outBounce, overshoot: _E.outBack, impulse: _E.outQuint, swing: _E.inOutBack, linear: _E.linear })[name] || _E.inOutCubic;
}
export const CARD_RATIO_OPTS = ['auto', 'media', '1:1', '4:3', '3:4', '4:5', '16:9', '9:16'];
P.cardRatio = (d = 'auto') => ({ type: 'choice', label: 'Card ratio', default: d, options: CARD_RATIO_OPTS });
// card aspect: explicit Card ratio if chosen, else the template's own default shape (animos 'auto' uses a per-template shape)
export function cardAR(ctx, def) {
  const k = ctx.spec?.cardRatio || ctx.p.cardRatio || 'auto';
  if (k === 'media') return ctx.adaptMode === 'ratio' ? ctx.ratioOf(0) : def;
  return k === 'auto' ? def : ctx.ratioOf(0); // v10.2 'media'：模板先按原形状排，引擎再换形（engine/adapt.js）
}
// seamless media pattern for a lattice that scrolls `period` cells per loop: periodic in `k` with `period`,
// extra media (n > period) are spread over rows so every image appears.
export function latticeMedia(k, row, n, period = 8, rowShift = 2) {
  const m = (a, b) => ((a % b) + b) % b;
  const sh = n > period && Math.abs(rowShift) === 2 ? Math.sign(rowShift) * 3 : rowShift; // avoid repeats among neighbours
  return m(m(k - sh * row, period) + period * row, n);
}
// map a flat lattice point (X,Y) onto a curved surface. kx/ky = curvature (1/R) around Y / X axes (0 = flat).
// s = +1 concave (edges come toward the camera, viewer inside), -1 convex (globe-like).
export function curvePoint(X, Y, kx, ky, s) {
  const ax = X * kx, ay = Y * ky;
  const sx = Math.abs(kx) > 1e-6 ? Math.sin(ax) / kx : X;
  const sy = Math.abs(ky) > 1e-6 ? Math.sin(ay) / ky : Y;
  const zx = Math.abs(kx) > 1e-6 ? (1 - Math.cos(ax)) / kx : 0;
  const zy = Math.abs(ky) > 1e-6 ? (1 - Math.cos(ay)) / ky : 0;
  const cy = Math.cos(ay);
  return { x: sx * cy, y: sy, z: s * (zx * cy + zy), ry: -s * ax, rx: s * ay, bend: -s * kx, bendX: -s * ky };
}
// 3x3 rotation matrices (row-major arrays) + decomposition into the engine's default 'YXZ' Euler order
export const mRx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const mRy = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const mRz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
export function mMul(a, b) { const r = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return r; }
export function mApply(m, [x, y, z]) { return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z]; }
export function eulerYXZ(m) {
  const m23 = Math.max(-1, Math.min(1, m[5]));
  const rx = Math.asin(-m23);
  if (Math.abs(m23) < 0.99999) return { rx, ry: Math.atan2(m[2], m[8]), rz: Math.atan2(m[3], m[4]), order: 'YXZ' };
  return { rx, ry: Math.atan2(-m[6], m[0]), rz: 0, order: 'YXZ' };
}

// ---- X10: floor reflection ----
// reflect(card, opts) -> a mirrored copy of `card` reflected across the horizontal floor plane y = floorY
// (default: just under the card's bottom edge, minus `gap`), faded with an X10 fade mask so it dissolves away from the card.
// opts: floorY, gap (0.004), opacity (0.35), fade (0..1: share of the reflection that is visible, default 0.6),
//       from (fade start, default 0), bright (0.9), blur (mip bias, default 0). Push it BEFORE (or below) the card.
// Exact for any ry; rx/rz are mirrored (rx' = -rx, rz' = -rz), so tilted cards reflect correctly too.
export function reflect(card, opts = {}) {
  // X2: device cards have no h; use the body height (laptop: whole bounding box)
  const di = card.device ? deviceInfo(card.device, card) : null;
  const h = card.h ?? (di ? (card.w ?? 0.3) * (di.bbox ? di.bbox.h : di.h) : card.w), s = card.s ?? 1;
  const floorY = opts.floorY ?? ((card.y || 0) - (h * s) / 2 - (opts.gap ?? 0.004) / 2);
  return { ...card,
    y: 2 * floorY - (card.y || 0), rx: -(card.rx || 0), rz: -(card.rz || 0), mirrorY: !card.mirrorY,
    opacity: (card.opacity ?? 1) * (opts.opacity ?? 0.35), bright: (card.bright ?? 1) * (opts.bright ?? 0.9),
    fade: { angle: Math.PI / 2, from: opts.from ?? 0, to: opts.fade ?? 0.6 }, blur: opts.blur ?? card.blur,
    shadow: 0, layer: (card.layer ?? 0) - 1, edgeX: 0, edgeTop: 0, edgeBottom: 0, sheen: 0, rim: 0 };
}
