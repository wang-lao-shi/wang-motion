import { base, P } from '../_common.js';
import { drift } from '../../lib.js';
// HIDDEN test template (underscore = not listed): X3c instanced shapes + sampleMedia + fog.
//   wm still _particletest2 --at 0.3 --res 320          image-coloured dot grid (sampleMedia 0), petals, streaks, confetti quads
//   --param fog=false                                     fog off
// All motion from drift()/integer cycles of u, so the loop is seamless.
export default {
  id: '_particletest2', name: 'Particle Test 2', category: 'flythrough', slots: 2,
  desc: 'hidden: X3c particle shapes test', tags: ['test'], ref: 'original',
  params: base({ fog: P.bool('Fog', true) }), shadow: false, defaultRatio: '16:9', duration: 10, background: '#07080d',
  camera(ctx) { const c = { fov: 40, x: 0, y: 0, z: 2.4, lookX: 0, lookY: 0, lookZ: 0 };
    if (ctx.p.fog) c.fog = { near: 2.2, far: 6 }; return c; },
  layout(ctx) {
    const { u, M } = ctx; const TAU = M.TAU;
    const GX = 64, GY = 40; // image grid: right half of frame
    const particles = [
      { count: GX * GY, seed: 1, shape: 'dot', blend: 'normal', sampleMedia: 0, fn: (k, rnd) => {
        const i = k % GX, j = (k / GX) | 0; const ux = (i + 0.5) / GX, uy = (j + 0.5) / GY;
        const w = Math.sin((ux * 2 + uy - u) * TAU) * 0.04; // ripple, 1 cycle per loop
        return { x: 0.15 + ux * 1.3, y: (uy - 0.5) * 0.82, z: w, size: 1.25 / GX, opacity: 1, uvX: ux, uvY: uy }; } },
      { count: 160, seed: 2, shape: 'streak', blend: 'add', fn: (k, rnd) => { // warp streaks radiating from left centre
        const d = drift(k, u, { speed: 1, seed: 2 }); const a = d.y * TAU; const r = 0.1 + d.x * 1.4;
        return { x: -0.75 + Math.cos(a) * r, y: Math.sin(a) * r * 0.7, z: (d.z - 0.5) * 0.4, angle: Math.atan2(Math.sin(a) * 0.7, Math.cos(a)),
          size: 0.012, len: 3 + d.x * 10, opacity: Math.sin(d.x * Math.PI), color: rnd(3) > 0.5 ? '#9fd0ff' : '#ffffff' }; } },
      { count: 70, seed: 3, shape: 'petal', blend: 'normal', fn: (k, rnd) => { // petals falling + tumbling, depth-fogged
        const d = drift(k, u, { speed: 1, seed: 3 });
        return { x: (d.y - 0.5) * 3.4 + Math.sin((u + rnd(4)) * TAU) * 0.1, y: 1.1 - d.x * 2.2, z: -3 + d.z * 4.2, size: 0.07 + rnd(5) * 0.05,
          angle: (u * (rnd(6) > 0.5 ? 1 : -1) + rnd(7)) * TAU, spin: (u * 2 + rnd(8)) * TAU, opacity: 0.95, color: rnd(9) > 0.4 ? '#ffb7c9' : '#fff0f4' }; } },
      { count: 50, seed: 4, shape: 'quad', blend: 'normal', fn: (k, rnd) => { // confetti quads, bottom-left
        const d = drift(k, u, { speed: 1, seed: 4 });
        return { x: -1.4 + d.y * 1.3, y: -0.85 + d.x * 0.5, z: (d.z - 0.5) * 0.5, size: 0.035, angle: (u + rnd(5)) * TAU, spin: (u * 3 + rnd(6)) * TAU,
          opacity: Math.sin(d.x * Math.PI), color: ['#ffd23f', '#3bceac', '#ee4266', '#5e60ce'][(rnd(7) * 4) | 0] }; } },
    ];
    return { cards: [], particles };
  },
};
