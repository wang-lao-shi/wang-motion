import { base } from '../_common.js';
import { drift } from '../../lib.js';
// HIDDEN test template (underscore = not listed): X3b particle draw path.
//   wm still _particletest --at 0.3 --res 320          cards + dust (additive dots), bokeh discs, sparks
// Every particle position comes from drift() with integer speed, so the loop is seamless (u=0 == u=1).
export default {
  id: '_particletest', name: 'Particle Test', category: 'flythrough', slots: 5,
  desc: 'hidden: X3b particle groups test', tags: ['test'], ref: 'original',
  params: base({}), shadow: true, defaultRatio: '16:9', duration: 10, background: '#07080d',
  camera() { return { fov: 40, x: 0, y: 0, z: 2.4, lookX: 0, lookY: 0, lookZ: 0 }; },
  layout(ctx) {
    const { u, M } = ctx; const cards = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5 + u) * M.TAU;
      cards.push({ media: k, x: Math.sin(a) * 0.9, y: (k - 2) * 0.04, z: Math.cos(a) * 0.5 - 0.3, ry: Math.sin(a) * 0.5, w: 0.5, radius: 0.04 });
    }
    const particles = [
      { count: 1200, seed: 1, shape: 'dot', blend: 'add', fn: (k, rnd) => { // dust: drifts upward, 1 cycle per loop
        const d = drift(k, u, { speed: 1, seed: 1 }); const tw = 0.5 + 0.5 * Math.sin((u * 3 + rnd(3)) * M.TAU);
        return { x: (d.y - 0.5) * 4, y: (d.x - 0.5) * 2.6, z: (d.z - 0.5) * 3, size: 0.006 + rnd(4) * 0.01, opacity: 0.35 + 0.5 * tw, color: '#cfe0ff' }; } },
      { count: 40, seed: 2, shape: 'bokeh', blend: 'add', fn: (k, rnd) => { // big near bokeh drifting sideways
        const d = drift(k, u, { speed: 1, seed: 2 });
        return { x: (d.x - 0.5) * 4.4, y: (d.y - 0.5) * 2.2, z: 0.6 + d.z * 1.0, size: 0.06 + rnd(5) * 0.08, opacity: 0.18, color: rnd(6) > 0.5 ? '#ffb070' : [0.5, 0.7, 1] }; } },
      { count: 60, seed: 3, shape: 'spark', blend: 'add', fn: (k, rnd) => { // sparks spinning, 2 cycles per loop
        const d = drift(k, u, { speed: 2, seed: 3 }); const life = Math.sin(d.x * Math.PI);
        return { x: (d.y - 0.5) * 3, y: -0.8 + d.x * 1.6, z: (d.z - 0.5) * 1.2, size: 0.05 + rnd(7) * 0.05, opacity: life, angle: u * M.TAU * (rnd(8) > 0.5 ? 1 : -1), color: '#fff2c0' }; } },
    ];
    return { cards, particles };
  },
};
