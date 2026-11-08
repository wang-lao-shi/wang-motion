import { base, P, reflect } from '../_common.js';
import { E } from '../../lib.js';
// HIDDEN test template for X2 device frames (+ X9 slabs they are built from).
//   wm still _devicetest --res 400 --at 0.3            (mode=all: phone, tablet, laptop / watch, browser, crt)
//   --param mode=phone   big phone, screenCards push transition, floor reflection
//   --param mode=laptop  laptop tilted to show the keyboard deck
//   --param mode=back    all six turned around (back caps, side walls, hidden screens)
//   --param dw=true      per-card depthWrite on (z-buffer path)
const TYPES = ['phone', 'tablet', 'laptop', 'watch', 'browser', 'crt'];
export default {
  id: '_devicetest', name: 'Device Test', category: 'device-mockup', slots: 12,
  desc: 'hidden: X2 device frame test', tags: ['test'], ref: 'original',
  params: base({ mode: P.choice('Mode', 'all', ['all', 'phone', 'laptop', 'back', 'single']), type: P.choice('Type', 'crt', TYPES), ry: { type: 'number', min: -4, max: 4, step: 0.01, default: 0.6, label: 'ry' }, dw: P.choice('Depth write', 'false', ['false', 'true', 'nofx']) }),
  shadow: true, shadowOpacity: 0.5, duration: 8, background: '#16161b',
  camera() { return { perspective: 30 }; },
  layout(ctx) {
    const { u, n, M, p } = ctx; const dw = p.dw === 'true' ? true : undefined; const sw = Math.sin(u * M.TAU);
    // push transition inside a screen: outgoing slides up, incoming from below (clipped by the screen rect)
    const push = (k0, q) => [{ media: M.mod(k0, n), y: q, zoom: 1.05 }, { media: M.mod(k0 + 1, n), y: q - 1, zoom: 1.05 }];
    const q = E.inOutCubic(M.clamp((M.fract(u * 2) - 0.3) / 0.4, 0, 1)); const beat = Math.floor(u * 2);
    if (p.mode === 'phone') {
      const I = ctx.device('phone'); const h = 0.74, w = h * I.aspect;
      const c = { device: 'phone', w, x: 0, y: 0.04, z: 0, ry: 0.45 * sw, rx: -0.08, depthWrite: dw, screenCards: push(beat, q) };
      const feed = [0, 1, 2, 3, 4].map((k) => ({ media: M.mod(k + 3, n), x: 0, y: 0.38 - k * 0.3 + M.fract(u) * 0.3, w: 0.86, h: 0.26, radius: 0.04 }));
      const c2 = { device: 'phone', w: w * 0.8, x: -0.62, y: -0.02, z: -0.3, ry: 0.7, deviceColor: '#e8e3d8', screenColor: '#f2f2f4', screenCards: feed, depthWrite: dw };
      const c3 = { device: 'phone', orient: 'landscape', w: w * 1.5, x: 0.6, y: 0.0, z: -0.2, ry: -0.5, rz: 0.05, media: 5, deviceColor: '#3b4a6b', depthWrite: dw };
      return [c2, c3, reflect(c, { floorY: -0.37, opacity: 0.3, fade: 0.5 }), c];
    }
    if (p.mode === 'single') {   // one device, big: --param mode=single type=crt ry=0.6
      const I = ctx.device(p.type); const bh = p.type === 'laptop' ? I.bbox.h : I.h; const w = Math.min(ctx.view.w * 0.6, 0.72 / bh);
      return [{ device: p.type, w, ry: p.ry, rx: p.type === 'laptop' ? 0.35 : -0.12, media: 3, depthWrite: dw, screenFx: p.dw === 'nofx' ? { barrel: 0, scan: 0 } : undefined }];
    }
    if (p.mode === 'laptop') {
      const w = Math.min(ctx.view.w * 0.62, 0.95);
      return [{ device: 'laptop', w, x: 0, y: -0.02, rx: 0.42, ry: 0.35 * sw, media: 2, depthWrite: dw },
        { device: 'laptop', w: w * 0.45, x: ctx.view.w * 0.36, y: 0.3, z: -0.4, rx: 0.15, ry: -0.6, deviceColor: '#3a3b40', hinge: 1.65, media: 4, depthWrite: dw }];
    }
    const out = []; const cols = 3, rows = 2; const cw = ctx.inner.w / cols, ch = ctx.inner.h / rows;
    TYPES.forEach((t, i) => {
      const I = ctx.device(t); const col = i % cols, row = Math.floor(i / cols);
      const bh = t === 'laptop' ? I.bbox.h : t === 'watch' ? I.h + 2 * I.strap.h * 0.85 : I.h; // body height per unit width
      let w = Math.min(cw * 0.72, ch * 0.78 / bh); if (t === 'laptop') w = Math.min(cw * 0.8, ch * 0.9 / bh);
      const back = p.mode === 'back';
      const c = { device: t, w, x: -ctx.inner.w / 2 + cw * (col + 0.5), y: ctx.inner.h / 2 - ch * (row + 0.5), z: 0,
        ry: (back ? Math.PI * 0.82 : 0) + 0.5 * Math.sin(u * M.TAU + i), rx: t === 'laptop' ? 0.35 : -0.1, media: M.mod(i, n), depthWrite: dw };
      if (t === 'phone') c.screenCards = push(i + beat, q);
      if (t === 'browser') c.screenCards = [0, 1, 2, 3].map((k) => ({ media: M.mod(k + 6, n), x: (k % 2 - 0.5) * 0.48, y: 0.25 - Math.floor(k / 2) * 0.62 + M.fract(u) * 0.62, w: 0.44, h: 0.52, radius: 0.03 }));
      if (t === 'browser') c.screenColor = '#f4f4f6';
      out.push(c);
    });
    return out;
  },
};
