import { base, P, reflect } from '../_common.js';
import { E } from '../../lib.js';
// Phone Hero Swing — one hero phone in a true 3/4 view (base yaw −18°) swinging ±swing° around it (sin TAU·u), floating on a 2-cycle bob over a
// glossy floor. Its screen steps through K media per loop with a masked in-screen push (or fade / zoom).
// Backdrop = heavily blurred copy of the current screen media (tints the stage), a soft halo and floor glow.
// Loop: all motion periodic in u; media index mod(mod(j, K), n).
export default {
  id: 'phone-hero-swing', name: 'Phone Hero Swing', category: 'device-mockup', slots: 12,
  desc: 'A single hero phone in 3/4 view sways and floats over a glossy floor while its screen pushes through your media each beat; the stage glows in the colour of the current shot.',
  tags: ['device', 'phone', 'mockup', 'app', 'product', 'reflection', 'hero', 'showcase'],
  ref: 'original',
  params: base({
    deviceColor: P.color('Device colour', '#1d1d20'),
    swing: P.deg('Swing', 22, 0, 45),
    floatAmp: P.num('Float', 2, 0, 6, '%', 0.5),
    K: P.num('Screens per loop', 6, 2, 12),
    screenTransition: P.choice('Screen transition', 'push', ['push', 'fade', 'zoom']),
    reflection: P.pct('Reflection', 50, 0, 80),
  }),
  shadow: true, shadowOpacity: 0.4, depthWrite: false, duration: 12, background: '#0b0b10',
  camera() { return { perspective: 26 }; },
  layout(ctx) {
    const { u, n, M, p, view } = ctx;
    const K = Math.max(2, Math.round(p.K));
    const med = (j) => M.mod(M.mod(j, K), n);
    // beat: hold, then transition over the last 36% of the beat (hold ≥ 60%)
    const x = u * K, k = Math.floor(x), f = x - k;
    const q = E.inOutQuart(M.clamp((f - 0.6) / 0.36, 0, 1));
    const a = med(k), b = med(k + 1);

    // ---- phone geometry (sized by height, capped by frame width)
    const I = ctx.device('phone');
    const portrait = view.w < 0.8;
    const amp = p.floatAmp / 100;
    let H = (portrait ? 0.7 : 0.78) * (1 - amp);          // shrink with the float range so the top margin holds
    let w = H * I.aspect; const wMax = view.w * (portrait ? 0.62 : 0.5);
    if (w > wMax) { w = wMax; H = w / I.aspect; }
    // centre: keep ≥ ~6.5% top margin at the bob peak (perspective/tilt add ~1%)
    const y0 = Math.min(portrait ? 0.03 : 0.05, 0.5 - 0.065 - H / 2 - amp);
    const lift = 0.03;                                   // rest gap above the floor
    const floorY = y0 - H / 2 - lift;
    const bob = amp * Math.sin(2 * M.TAU * u);
    const s1 = Math.sin(M.TAU * u), c1 = Math.cos(M.TAU * u);
    const ry = M.rad(-18 + p.swing * s1);                // true 3/4: side wall always reads
    // tiny settle kick on each screen change (zero at beat edges → periodic)
    const kick = Math.sin(Math.PI * q) * 0.018;
    const phone = {
      device: 'phone', w, x: 0, y: y0 + bob, z: 0,
      ry, rx: -0.07 + 0.03 * c1, rz: -0.025 * s1 + kick,
      deviceColor: p.deviceColor, thickness: w * 0.11, gloss: 0.14, glossAngle: 0.5 + 0.35 * s1, layer: 4,
    };
    const tr = p.screenTransition;
    if (tr === 'fade') {
      Object.assign(phone, { media: a, media2: b, mix: q, mixMode: 'fade', zoom: 1.04, zoom2: 1.04 });
    } else if (tr === 'zoom') {
      phone.screenCards = [
        { media: a, zoom: 1.04 + 0.3 * q, bright: 1 - 0.35 * q },
        { media: b, zoom: 1.3 - 0.26 * q, opacity: E.outCubic(M.clamp(q * 1.25, 0, 1)) },
      ];
    } else {
      phone.screenCards = [
        { media: a, y: q * 0.55, zoom: 1.04, bright: 1 - 0.45 * q },     // outgoing slides up with parallax lag, darkens
        { media: b, y: q - 1, zoom: 1.04 },                              // incoming pushes in from below
      ];
    }

    const out = [];
    // ---- backdrop: blurred current shot fills the stage (colour tint), cross-fades with the screen
    const ff = ctx.fullFrame(-1.2, 1.08);
    // sample a small off-centre patch of the shot, mip-blurred to its average colour (flat tint, no blocky blur shapes)
    const tint = { media: a, media2: b, mix: q, mixMode: 'fade', zoom: 4, zoom2: 4, panX: 0.28, panY: -0.22, panX2: 0.28, panY2: -0.22,
      blur: 6, sat: 1.3, radius: 0, shadow: 0 };
    out.push({ ...ff, ...tint, bright: 0.26, layer: 0 });                                  // base wash
    const gw = portrait ? view.w * 1.9 : Math.min(view.w * 1.05, 1.7);
    out.push({ ...tint, x: 0, y: y0, z: -1.0, w: gw, h: gw * (portrait ? 1.0 : 0.75), bright: 1.15, layer: 1,
      mask: { type: 'circle', cx: 0.5, cy: 0.5, r: 0.12, soft: 0.38 } });              // coloured glow behind the phone
    // vignette over the backdrop (keeps the edges deep, the centre lit)
    const vg = ctx.fullFrame(-1.1, 1.1);
    out.push({ ...vg, light: { type: 'radial', stops: [[0, '#000000', 0], [0.45, '#000000', 0.25], [1, '#000000', 0.85]] }, blend: 'normal', layer: 0 });
    // ---- floor: darken below the horizon so the reflection reads as a glossy surface
    const fw = ff.w;
    out.push({ light: { type: 'linear', angle: -Math.PI / 2, stops: [[0, '#05050a', 0.35], [0.25, '#05050a', 0.72], [1, '#05050a', 0.92]] },
      blend: 'normal', x: 0, y: (floorY - 0.5 - 0.2) / 2, z: -0.02, w: fw, h: (floorY + 0.7), layer: 1 });
    // halo behind the phone (white-ish, screen-blended over the tinted backdrop) — wider on landscape frames
    const haloW = portrait ? view.w * 1.5 : Math.min(view.w * 0.85, 1.35);
    out.push({ light: { type: 'radial', stops: [[0, '#ffffff', 0.2], [0.4, '#ffffff', 0.06], [1, '#ffffff', 0]] }, blend: 'add',
      x: 0.03 * s1, y: y0 + 0.02, z: -0.5, w: haloW, h: haloW * 0.85, layer: 2 });
    // floor horizon glow line
    out.push({ light: { type: 'streak', angle: 0, stops: [[0, '#ffffff', 0.5], [0.5, '#ffffff', 0.12], [1, '#ffffff', 0]] }, blend: 'add',
      x: 0, y: floorY, z: -0.3, w: Math.min(view.w * 0.95, 1.6), h: 0.012, layer: 2 });
    // ---- secondary: two small soft-focus gallery panels deep behind the phone on wide frames (≤60% phone height,
    // dim, blurred). Images: spare media (K..n-1) when there are any, else neighbouring screen media (k±2…), never an
    // image the screen shows at the same time. They swap with a cut under a quick opacity dip at the beat's mid-push
    // (no double-exposed cross-fade). Panel image for beat j shows from mid-push of beat j−1 to mid-push of beat j,
    // so it must avoid med(j−1), med(j), med(j+1).
    const avail = view.w / 2 - w / 2 - 0.03, pool = n - K;
    const pick = (j, sd) => {
      const ban = [med(j - 1), med(j), med(j + 1)];
      const cand = [];
      if (pool > 0) { const jj = M.mod(j, K); for (let t = 0; t < pool; t++) cand.push(K + M.mod(jj + (sd > 0 ? 0 : Math.ceil(pool / 2)) + t, pool)); }
      for (let t = 2; t < K + 2; t++) cand.push(med(j + sd * t));
      return cand.filter((c) => !ban.includes(c));
    };
    if (avail > 0.2) {
      const zb = -1.4, sc = ctx.camDist / (ctx.camDist - zb);
      const ch = Math.min(H * 0.5, (avail * 0.62) / 0.72), cw = ch * 0.72;
      const jb = q < 0.5 ? k : k + 1;                                   // cut at mid-push
      const dip = 1 - Math.sin(Math.PI * M.clamp((q - 0.25) / 0.5, 0, 1)) ** 2;
      const R = pick(jb, 1), L = pick(jb, -1);
      const imgR = R[0], imgL = L.find((c) => c !== imgR);
      [[-1, imgL], [1, imgR]].forEach(([sd, img], i) => {
        if (img === undefined) return;
        const sx = sd * (w / 2 + 0.03 + avail * 0.5) - 0.025 * s1, sy = y0 + (i ? -0.035 : 0.035) + 0.014 * Math.sin(M.TAU * u + i * 2);
        out.push({ media: img, x: sx / sc, y: sy / sc, z: zb, w: cw / sc, h: ch / sc, ry: -sd * 0.38 + 0.06 * s1,
          bright: 0.22, sat: 0.75, blur: 4.5, opacity: dip, shadow: 0.3, layer: 2 });
      });
    }
    // ---- reflection (floor fixed, so the gap breathes with the bob)
    const ro = p.reflection / 100;
    if (ro > 0.001) out.push({ ...reflect(phone, { floorY, opacity: ro, fade: 0.7, bright: 0.85 }), layer: 3 });
    // ---- soft contact shadow on the floor (tighter + darker when the phone is low)
    const hgt = M.clamp((bob / Math.max(p.floatAmp / 100, 1e-4) + 1) / 2, 0, 1);
    out.push({ light: { type: 'radial', stops: [[0, '#000000', 0.8], [0.5, '#000000', 0.35], [1, '#000000', 0]] }, blend: 'normal',
      x: -0.02 * s1, y: floorY + 0.004, z: 0.02, w: w * (1.25 + 0.25 * hgt) * (1 - 0.15 * Math.abs(s1)), h: 0.05 + 0.02 * hgt, opacity: 0.85 - 0.3 * hgt, layer: 3 });
    out.push(phone);
    return out;
  },
};
