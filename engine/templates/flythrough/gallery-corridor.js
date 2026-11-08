import { base, P, reflect } from '../_common.js';
// Gallery Corridor (original, T04): the camera strolls down an endless gallery hall. Framed media hang on both
// walls (frame + mat + picture), each under a small warm spotlight (bulb glow, wall wash cone, floor pool), the
// polished floor mirrors the frames, depth fog swallows the far end. The hall is a repeating segment: the camera
// advances exactly `speed` segments per loop and media are assigned by slot index mod `speed`, so u=1 == u=0.
const PI = Math.PI;
export default {
  id: 'gallery-corridor', name: 'Gallery Corridor', category: 'flythrough', slots: 12,
  desc: 'Walk down an endless warm-lit gallery hall: framed media on both walls under spotlights, glossy floor reflections, depth fog',
  tags: ['flythrough', 'gallery', 'museum', 'corridor', 'exhibition', 'walk', 'reflection', '3d', 'premium'],
  ref: 'original',
  params: base({
    frameSpacing: P.num('Frame spacing', 1.5, 1, 2.6, '', 0.05),
    wallDistance: P.num('Wall distance', 1, 0.7, 1.5, '', 0.05),
    speed: P.num('Segments per loop', 6, 4, 12, '', 1),
    frameColor: P.color('Frame colour', '#b8925a'),
    fog: P.pct('Fog', 55, 0, 100),
  }),
  shadow: false, depthWrite: false, defaultRatio: '16:9', duration: 18, background: '#140f0b',
  _geo(ctx) {
    const { p, aspect } = ctx;
    const port = Math.max(0, Math.min(1, (1.2 - aspect) / 0.65)); // 0 = landscape … 1 = 9:16
    const W = p.wallDistance * (0.98 - 0.36 * port);              // corridor half width
    const fov = 52 + 22 * port;
    const sp = p.frameSpacing * (1 + 0.12 * port);
    const fh = 0.62 + 0.22 * port;                                 // frame (picture) height
    const speed = Math.max(1, Math.round(p.speed));
    // fog far: never let the repeat (speed segments ahead) emerge from the fog -> no image visible twice
    const far = Math.min(4 + (1 - p.fog / 100) * 9, (speed - 0.75) * sp);
    return { port, W, fov, sp, fh, speed, far, near: 0.6 + far * 0.08, floorY: -0.62 + 0.04 * port, ceilY: 0.95 + 0.3 * port };
  },
  _travel(ctx, g) { // segments travelled, gentle "stroll" pacing (periodic per segment so the loop stays exact)
    const q = g.speed * ctx.u; return q - 0.08 * Math.sin(2 * PI * q) / (2 * PI);
  },
  camera(ctx) {
    const g = this._geo(ctx); const q = g.speed * ctx.u;
    const bob = 0.012 * Math.sin(4 * PI * q), sway = 0.035 * Math.sin(2 * PI * q + 0.6);
    const eye = 0.04;
    return { fov: g.fov, x: sway, y: eye + bob, z: 0, lookX: sway * 0.4, lookY: eye - 0.08 + bob * 0.5, lookZ: -6,
      roll: 0.006 * Math.sin(2 * PI * q + 1.2), rollAxis: 'view',
      fog: g.p0 ? null : { color: '#140f0b', near: g.near, far: g.far } };
  },
  layout(ctx) {
    const { M, n, p } = ctx; const g = this._geo(ctx); const tr = this._travel(ctx, g);
    const { W, sp, fh, floorY, ceilY, far, speed, port } = g; const out = [];
    const L = far + 3, zc = -L / 2 + 1.5; const H = ceilY - floorY;
    const fc = p.frameColor || '#b8925a';
    // ---- architecture (flat colour planes; fog gives the depth ramp) ----
    for (const s of [-1, 1]) {
      out.push({ useMedia: false, color: '#5a4a3c', x: s * W, y: (floorY + ceilY) / 2, z: zc, ry: -s * PI / 2, w: L, h: H, radius: 0, layer: 0, mirrorBack: true });
      // baseboard + picture rail (continuous strips)
      out.push({ useMedia: false, color: '#2a211a', x: s * (W - 0.003), y: floorY + 0.035, z: zc, ry: -s * PI / 2, w: L, h: 0.07, radius: 0, layer: 1 });
      out.push({ useMedia: false, color: '#3a2e24', x: s * (W - 0.003), y: ceilY - 0.12, z: zc, ry: -s * PI / 2, w: L, h: 0.018, radius: 0, layer: 1 });
    }
    out.push({ useMedia: false, color: '#1d1611', x: 0, y: floorY, z: zc, rx: -PI / 2, w: 2 * W + 0.02, h: L, radius: 0, layer: 0 });
    out.push({ useMedia: false, color: '#2b231c', x: 0, y: ceilY, z: zc, rx: PI / 2, w: 2 * W + 0.02, h: L, radius: 0, layer: 0 });
    // ceiling light slot + its sheen on the floor
    out.push({ light: { type: 'linear', angle: 0, stops: [[0, '#ffd9a0', 0], [0.5, '#ffe4b8', 0.9], [1, '#ffd9a0', 0]] }, x: 0, y: ceilY - 0.002, z: zc, rx: PI / 2, w: 0.09, h: L, opacity: 0.55, layer: 2 });
    out.push({ light: { type: 'linear', angle: 0, stops: [[0, '#ffcf90', 0], [0.5, '#ffcf90', 0.5], [1, '#ffcf90', 0]] }, x: 0, y: floorY + 0.002, z: zc, rx: -PI / 2, w: 0.5, h: L, opacity: 0.22, layer: 2 });
    // distant warm glow at the vanishing point (focal pull)
    out.push({ light: { type: 'radial', stops: [[0, '#ffdcaa', 0.55], [0.5, '#c88a50', 0.18], [1, '#c88a50', 0]] }, x: 0, y: (floorY + ceilY) / 2 - 0.05, z: -far * 0.7, w: 2 * W * 1.8, h: H * 1.2, opacity: 1, bright: 1.6, layer: 2 });
    // ceiling cross beams, one per segment (they carry the sense of travel overhead)
    for (let j = Math.floor(tr) - 1; j <= Math.ceil(tr + far / sp) + 1; j++) {
      const z = -((j + 0.25) - tr) * sp; if (z > 1 || -z > far + 0.5) continue;
      out.push({ useMedia: false, color: '#171210', x: 0, y: ceilY - 0.004, z, rx: PI / 2, w: 2 * W, h: 0.16, radius: 0, layer: 1 });
      out.push({ useMedia: false, color: '#3d3127', x: 0, y: ceilY - 0.006, z: z + 0.085, rx: PI / 2, w: 2 * W, h: 0.012, radius: 0, layer: 1 });
    }
    // ---- frames ----
    const j0 = Math.floor(tr) - 1, j1 = Math.ceil(tr + far / sp) + 1;
    for (let j = j0; j <= j1; j++) {
      for (const s of [-1, 1]) {
        const off = s > 0 ? 0.5 : 0;                  // right wall staggered half a segment
        const z = -((j + off) - tr) * sp;
        if (z > 0.8 || -z > far + 0.2) continue;
        const media = M.mod(M.mod(j, speed) * 2 + (s > 0 ? 1 : 0), n);
        const r = ctx.ratioOf(media); let h = fh, w = h * r; const wMax = sp * (0.72 + 0.1 * port);
        if (w > wMax) { w = wMax; h = w / r; }
        const yc = floorY + H * 0.47 + (fh - h) * 0.1;
        const ry = -s * PI / 2, xw = s * W;
        const mat = Math.min(w, h) * 0.07, fr = Math.min(w, h) * 0.045;
        const frame = { useMedia: false, color: fc, x: xw - s * 0.006, y: yc, z, ry, w: w + 2 * (mat + fr), h: h + 2 * (mat + fr), layer: 4, radius: 0.012, sheen: 0.35, edgeX: 0.25, edgeTop: 0.35 };
        const matC = { useMedia: false, color: '#ece4d6', x: xw - s * 0.009, y: yc, z, ry, w: w + 2 * mat, h: h + 2 * mat, layer: 5, radius: 0.01 };
        const pic = { media, x: xw - s * 0.011, y: yc, z, ry, w, h, layer: 6, radius: 0.006, mirrorBack: false, sheen: 0.12 };
        // soft contact shadow on the wall under/right of the frame
        out.push({ light: { type: 'radial', stops: [[0, '#000000', 0.55], [0.6, '#000000', 0.25], [1, '#000000', 0]] }, blend: 'multiply', x: xw - s * 0.004, y: yc - 0.03, z: z + s * 0.0, ry, w: frame.w * 1.25, h: frame.h * 1.25, layer: 3, opacity: 0.5 });
        out.push(frame, matC, pic);
        // spotlight: wash cone on the wall, bulb glow, fixture, floor pool
        const top = yc + frame.h / 2;
        out.push({ light: { type: 'beam', color: '#ffc884', spread: 0.22, fade: 0.7 }, x: xw - s * 0.002, y: (top + 0.22 + yc - frame.h * 0.15) / 2, z, ry, w: frame.w * 1.5, h: top + 0.22 - (yc - frame.h * 0.15), opacity: 0.75, layer: 3 });
        out.push({ light: { type: 'radial', stops: [[0, '#fff3dc', 1], [0.25, '#ffc070', 0.5], [1, '#ff9040', 0]] }, x: xw - s * 0.02, y: top + 0.2, z, ry, w: 0.22, h: 0.22, opacity: 0.9, layer: 7 });
        out.push({ useMedia: false, color: '#1b1510', x: xw - s * 0.012, y: top + 0.225, z, ry, w: 0.07, h: 0.03, layer: 7, radius: 0.3 });
        out.push({ light: { type: 'radial', stops: [[0, '#ffbe78', 0.5], [1, '#ffbe78', 0]] }, x: xw - s * 0.35, y: floorY + 0.003, z, rx: -PI / 2, w: 0.9, h: 1.0, opacity: 0.32, layer: 2 });
        // glossy floor reflection of the frame + picture
        const rf = { floorY, opacity: 0.42, fade: 0.95, bright: 0.85 };
        const R1 = reflect(frame, rf), R2 = reflect(pic, rf);
        R1.layer = 2; R2.layer = 3; R1.sheen = 0; R2.mirrorBack = true;
        out.push(R1, R2);
      }
    }
    return out;
  },
};
