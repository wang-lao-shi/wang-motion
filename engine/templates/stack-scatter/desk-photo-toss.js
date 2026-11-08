import { base, P } from '../_common.js';
import { E } from '../../lib.js';
// Desk Photo Toss (original): a top-down wooden desk under a warm lamp. White-bordered prints are tossed in one per
// beat from the viewer's side: each flies in lifted (bigger, shadow cast far away), drops onto the desk, hops once,
// slides with friction while its spin bleeds off and settles with a tiny overshoot. After K photos a hand pushes a
// slanted boxwood ruler across the desk (forearm shadow trailing) and sweeps the pile off one side, each print touching
// the ruler at its own offset; the next round's first print is already tossed in from the opposite side. Rounds alternate sweep side and media; the loop holds floor(n/K) rounds so u=0 equals u=1.
const LEAD = 0.32;     // toss starts this many beats before its beat
const T = 0.56;        // flight + slide duration (beats)
const TA = 0.27;       // airborne share of the flight (contact with the desk)
const TS = 0.84;       // slide stops (share of flight)
const SW0 = 0.08, SWD = 1.1;   // sweep start (beats after the K-th beat starts) and duration
const D0 = -0.3;       // the round's first toss starts early, from the side opposite the leaving pile (never crosses it)
const sweepEase = (t) => E.outCubic(0.6 * t + 0.4 * t * t);   // gentle push-in, long decelerating tail
// desk tones derived from the desk colour (works for light and dark desks)
const rgb = (h) => { const v = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const shade = (h, f) => '#' + rgb(h).map((c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f)).map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
const luma = (h) => { const [r, g, b] = rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
export default {
  id: 'desk-photo-toss', name: 'Desk Photo Toss', category: 'stack-scatter', slots: 12,
  desc: 'Top-down wooden desk: white-bordered prints are tossed in one per beat, slide and spin to a stop on a growing pile, then a sweep clears the desk',
  tags: ['stack', 'scatter', 'photos', 'prints', 'desk', 'toss', 'memories', 'travel', 'wedding', 'top-down'], ref: 'original',
  params: base({
    loopCards: P.num('Photos per round (K)', 6, 3, 10),
    border: P.pct('Print border', 7, 0, 16),
    spin: P.num('Spin', 160, 0, 540, '°', 5),
    photoSize: P.pct('Photo size', 100, 60, 130),
    deskColor: P.color('Desk colour', '#8f6240'),
  }),
  shadow: true, shadowOpacity: 0.42,
  background: '#5a3b26',
  duration: 14,
  camera() { return { perspective: 6 }; },
  layout(ctx) {
    const { p, n, u, M, view: V, inner: I } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const R = M.clamp(Math.floor(Math.min(n, 12) / K), 1, 3);    // rounds per loop (more media per loop)
    const B = R * (K + 1);                                        // beats per loop
    const x = u * B;
    const out = [];
    const FF = ctx.fullFrame(-0.06, 1.1);
    const desk = p.deskColor;
    const lum = luma(desk);

    // ---------------- desk ----------------
    out.push({ useMedia: false, color: desk, ...FF, shadow: 0, layer: -30 });
    const grainC = shade(desk, -0.45), sheenC = shade(desk, 0.2), seamC = shade(desk, -0.6);
    const plankH = 0.2 + 0.02 * Math.min(1, V.w);
    const nP = Math.ceil(FF.h / plankH) + 1;
    const ct = 0.17;                                              // tilt so isotropic noise reads as stretched grain
    for (let k = 0; k < nP; k++) {
      const y = FF.y - FF.h / 2 + (k + 0.5) * plankH;
      const tone = M.rand(k, 3);
      out.push({ useMedia: false, color: shade(desk, (tone - 0.5) * 0.22), x: 0, y, z: -0.055, w: FF.w, h: plankH,
        shadow: 0, opacity: 0.85, layer: -29, radius: 0 });                                              // plank tone
      out.push({ useMedia: false, color: grainC, x: 0, y, z: -0.05, w: FF.w, h: plankH / ct, rx: Math.acos(ct),
        shadow: 0, opacity: 0.32 * (1 - 0.45 * lum), layer: -28, radius: 0, dissolve: { p: 0.56, scale: 13, edge: 0.22, seed: k * 3.7 + 1 } });  // grain
      out.push({ useMedia: false, color: sheenC, x: 0, y, z: -0.049, w: FF.w, h: plankH / ct, rx: Math.acos(ct),
        shadow: 0, opacity: 0.16, layer: -27, radius: 0, dissolve: { p: 0.62, scale: 24, edge: 0.18, seed: k * 5.1 + 9 } });  // fine sheen
      out.push({ useMedia: false, color: seamC, x: 0, y: y - plankH / 2, z: -0.048, w: FF.w, h: 0.0035,
        shadow: 0, opacity: 0.55, layer: -26, radius: 0 });                                              // seam
    }
    out.push({ light: { type: 'radial', stops: [[0, '#ffe2b8', 0.55], [0.5, '#ffc68a', 0.2], [1, '#ffb070', 0]] }, blend: 'add',
      x: -0.12 * V.w, y: 0.14, z: -0.04, w: Math.max(V.w, 1) * 1.5, h: 1.5, opacity: 0.38 * (1 - 0.65 * lum), layer: -20 });   // lamp pool
    const VG = ctx.fullFrame(0.3, 1.0);
    out.push({ light: { type: 'radial', stops: [[0, '#000000', 0], [0.6, '#000000', 0.1], [1, '#000000', 0.62]] }, blend: 'multiply',
      ...VG, w: VG.w * 1.1, h: VG.h * 1.1, layer: 190 });                                                 // vignette

    // ---------------- photos ----------------
    const sz = p.photoSize / 100;
    const L0 = Math.min(0.62 * I.w, 0.46 * I.h, 0.36 * Math.sqrt(V.w)) * sz;   // long side of a print
    const brd = M.clamp(p.border / 100, 0, 0.3);
    const spin = M.rad(p.spin);
    const G = M.grid(K, (I.w / I.h) * 1.15), NC = G.cols * G.rows;
    let stepC = Math.max(1, Math.floor(NC / 2) + 1); const gcd = (a, b) => (b ? gcd(b, a % b) : a); while (gcd(stepC, NC) !== 1) stepC++;
    const rw = 0.05 * Math.min(1, Math.max(0.75, V.w)), rlen = FF.h * 1.25;      // ruler (the pusher)
    const sideOf = (r) => (M.mod(r, R) % 2 === 0 ? -1 : 1);
    for (let c = -1; c <= 1; c++) {
      for (let r = 0; r < R; r++) {
        const O = r * (K + 1) + c * B;
        const sd = sideOf(r);                                      // this round's sweep side
        const psd = sideOf(r - 1);                                 // side the previous round's pile leaves on
        const sw = (x - (O + K + SW0)) / SWD;
        if (sw >= 1) continue;
        // cell offset: the round's first print lands on the half away from the leaving pile (opposite psd)
        let co = r * 2;
        for (let o = 0; o < NC; o++) { const cc0 = M.mod(r * 2 + o, NC) % G.cols; if (G.cols < 2 || -psd * ((cc0 / (G.cols - 1)) * 2 - 1) > 0.01) { co = r * 2 + o; break; } }
        const kk = (r % 2 === 0 ? 1 : -1) * 0.1;                   // ruler slant: front line q = Fq + kk*y
        const F0 = -(V.w / 2 + rw + 0.06 + Math.abs(kk) * V.h / 2);
        const F1 = V.w / 2 + 0.12 + Math.abs(kk) * V.h / 2;
        const Fq = M.lerp(F0, F1, sweepEase(M.clamp(sw)));
        if (sw > 0) {
          const rz = -Math.atan(sd * kk);
          const fade = M.clamp(sw / 0.12) * (1 - M.clamp((sw - 0.8) / 0.2));
          // forearm / hand shadow trailing the ruler (cast from the viewer's side)
          out.push({ light: { type: 'radial', stops: [[0, '#000000', 0.62], [0.5, '#000000', 0.36], [1, '#000000', 0]] }, blend: 'normal',
            x: sd * (Fq - rw - 0.13), y: -0.28 * V.h, z: 0.02, w: 0.5, h: 1.3 * V.h, rz: rz - sd * 0.25, opacity: fade, layer: 68 });
          out.push({ light: { type: 'linear', angle: sd > 0 ? 0 : Math.PI, stops: [[0, '#000000', 0], [1, '#000000', 0.4]] }, blend: 'normal',
            x: sd * (Fq - rw - 0.07), y: 0, z: 0.02, w: 0.14, h: rlen, rz, opacity: fade, layer: 69 });
          // boxwood ruler with tick marks
          const rx0 = sd * (Fq - rw / 2);
          out.push({ useMedia: false, color: '#e6d3a6', x: rx0, y: 0, z: 0.03, w: rw, h: rlen, rz, radius: 0, shadow: 0.5, sheen: 0.2, edgeX: 0.5, layer: 70 });
          const nT = 34;
          for (let t = 0; t < nT; t++) {
            const ly = (t / (nT - 1) - 0.5) * rlen * 0.96, big = t % 5 === 0;
            const tl = rw * (big ? 0.42 : 0.24), lx = -sd * (rw / 2 - tl / 2 - rw * 0.06);   // ticks on the trailing edge
            out.push({ useMedia: false, color: '#4a3520', x: rx0 + lx * Math.cos(rz) - ly * Math.sin(rz), y: lx * Math.sin(rz) + ly * Math.cos(rz),
              z: 0.031, w: tl, h: 0.0028, rz, radius: 0, shadow: 0, opacity: 0.75, layer: 71 });
          }
        }
        for (let j = 0; j < K; j++) {
          const tl = x - (O + j - LEAD + (j === 0 ? D0 : 0));
          if (tl < 0) continue;
          const id = r * K + j;                                    // slot within the loop
          const rnd = (s) => M.rand(id + 1, s);
          const land = rnd(1) < 0.62;                              // landscape or portrait print
          const ar = land ? 1.42 : 1 / 1.24;
          const w = land ? L0 : L0 * ar, h = land ? L0 / ar : L0;
          const rzF = (rnd(2) - 0.5) * 0.7;                        // resting tilt ±0.35 rad
          const hbx = 0.5 * (w * Math.abs(Math.cos(rzF)) + h * Math.abs(Math.sin(rzF)));
          const hby = 0.5 * (w * Math.abs(Math.sin(rzF)) + h * Math.abs(Math.cos(rzF)));
          // stratified landing spots: cells of a grid fitted to the frame, visited in a hopping order
          const cell = M.mod(j * stepC + co, NC), cc = cell % G.cols, cr = Math.floor(cell / G.cols);
          const gx = G.cols > 1 ? (cc / (G.cols - 1)) * 2 - 1 : 0;
          const gy = (G.rows > 1 ? 1 - (cr / (G.rows - 1)) * 2 : 0) + (cc % 2 ? 1 : -1) * 0.22 / G.rows;   // brick stagger breaks the grid look
          const ax = Math.max(0, I.w / 2 - hbx * 0.7), ay = Math.max(0, I.h / 2 - hby * 0.75);
          const tx = M.clamp(gx * 0.9 + (rnd(8) - 0.5) * 0.9 / G.cols, -1, 1) * ax;
          const ty = M.clamp(gy * 0.9 + (rnd(9) - 0.5) * 0.8 / G.rows, -1, 1) * ay;
          // toss from the viewer's side (bottom), angled away from the coming sweep side;
          // the round's first print comes in from the side opposite the leaving pile and lands on that half
          let th = -Math.PI / 2 + (rnd(3) - 0.5) * 1.6 - sd * 0.25;
          if (j === 0) { th = (psd > 0 ? Math.PI + 0.35 : -0.35) + (rnd(3) - 0.5) * 0.4; }
          const cth = Math.cos(th), sth = Math.sin(th), rr = 0.5 * Math.hypot(w, h) * 1.25 + 0.02;   // start just off-frame
          const D = Math.min(Math.abs(cth) > 1e-3 ? (V.w / 2 + rr - Math.sign(cth) * tx) / Math.abs(cth) : 1e9,
            Math.abs(sth) > 1e-3 ? (V.h / 2 + rr - Math.sign(sth) * ty) / Math.abs(sth) : 1e9) / 0.92;
          const a = M.clamp(tl / T);
          const v0 = 1 / (TA + (TS - TA) / 2);
          let Pp;
          if (a < TA) Pp = v0 * a;
          else if (a < TS) { const q = a - TA; Pp = v0 * TA + v0 * q - (v0 / (TS - TA)) * q * q / 2; }
          else Pp = 1;
          Pp += 0.022 * Math.sin(Math.PI * M.clamp((a - TA) / (1 - TA))) * E.outCubic(M.clamp((a - TA) / (TS - TA)));  // overshoot + settle back
          let lift = 0;
          if (a < TA) lift = 1 - (a / TA) ** 2;
          else if (a < TA + 0.14) lift = 0.1 * Math.sin(Math.PI * (a - TA) / 0.14);
          const sdir = rnd(4) < 0.5 ? -1 : 1;
          const rest = Math.max(0, 1 - Pp);
          let rz = rzF + sdir * spin * (0.6 + 0.4 * rnd(5)) * rest * (1 + 0.6 * rest);
          if (a > TS * 0.9) { const g = (a - TS * 0.9) / (1 - TS * 0.9); rz += sdir * 0.035 * Math.sin(g * Math.PI * 2.2) * (1 - g); }
          let px = tx + Math.cos(th) * D * (1 - Pp), py = ty + Math.sin(th) * D * (1 - Pp);
          // sweep: the slanted ruler pushes prints ahead of it; each touches it at its own offset, so they bunch unevenly
          if (sw > 0) {
            const q = sd * px;
            const qc = Fq + kk * py + hbx * (1 + 0.06 * rnd(11)) + w * 0.06 * rnd(10);
            const q2 = Math.max(q, qc), pu = q2 - q;
            px = sd * q2; py += pu * (rnd(6) - 0.5) * 0.3; rz += sd * pu * (rnd(7) - 0.35) * 0.6;
          }
          const s = 1 + 0.2 * lift;
          const layer = 2 * (j + 1) + (a < 1 ? 100 : 0);
          // cast shadow while airborne: a soft rect-masked dark card on the desk, offset/enlarged/softened by the lift
          if (lift > 0.002) {
            const pad = 0.02 + 0.05 * lift, W = w * (1 + 0.1 * lift) + 2 * pad, H = h * (1 + 0.1 * lift) + 2 * pad;
            const ex = pad / W, ey = pad / H;
            out.push({ useMedia: false, color: '#000000', x: px + 0.07 * lift, y: py - 0.1 * lift, z: 0.0005 * j, w: W, h: H, rz,
              radius: 0, shadow: 0, opacity: 0.5 * Math.min(1, lift * 3) * (1 - 0.4 * lift),
              mask: { type: 'rect', rect: [ex, ey, 1 - ex, 1 - ey], soft: 0.85 * Math.min(ex, ey) }, layer: layer - 1 });
          }
          out.push({ media: M.mod(id, n), x: px, y: py, z: 0.0005 * j + 0.0002, w, h, s, rz, border: brd, borderColor: '#f8f5ef',
            shadow: 0.42 * (1 - Math.min(1, lift * 3)), sheen: 0.08, layer });
        }
      }
    }
    return out;
  },
};
