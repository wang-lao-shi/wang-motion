import { base, P } from '../_common.js';
import { E } from '../../lib.js';
// Light Leak Cuts (original, T02 #4): full-frame film slideshow. At every cut a warm film light leak — additive
// orange / magenta / amber blobs racing along the long axis — washes the frame to a cream peak (~88% luma, coloured rim,
// not clipped white) exactly at the cut. Image contrast collapses around the peak and the swap is a hard cut there, so
// it is never seen at any intensity (the white-out has an intensity floor).
// Between cuts: Ken-Burns push/pan (on-screen pan <= 6% of width), two drifting leaks and a thin warm film-edge streak.
// Timing: y = u·K, cuts at y = m + 0.5, so u = 0 is mid-hold of image 0 (clean thumbnail) and the loop seam is a hold.
// Leak envelope exp(-(d/σ)²) with σ = cutWidth: at the default the image is fully clear for ~60% of each beat.
const hex2 = (h) => { const s = String(h || '#ffffff').replace('#', ''); const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.padEnd(6, 'f'); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255); };
const mixHex = (a, b, t) => '#' + hex2(a).map((v, i) => Math.round(Math.max(0, Math.min(1, v + (hex2(b)[i] - v) * t)) * 255).toString(16).padStart(2, '0')).join('');
const DEF_COLORS = ['#ff7a1f', '#ff2f78', '#ffb347'];

export default {
  id: 'light-leak-cuts', name: 'Light Leak Cuts', category: 'light-fx', slots: 12,
  desc: 'Full-frame film slideshow: warm orange/magenta light leaks sweep across and wash the frame to a cream glow with a coloured rim exactly at each cut, hiding it; Ken-Burns holds with drifting leaks and a thin film-edge burn streak',
  tags: ['slideshow', 'light leak', 'film', 'flash', 'bloom', 'warm', 'transition', 'ken burns', 'cinematic', 'vintage', 'full-frame'],
  ref: 'original',
  params: base({
    padding: P.padding(0),
    K: P.choice('Cuts per loop', '12', ['6', '8', '12']),
    leakColors: P.list('Leak colours', DEF_COLORS),
    intensity: P.pct('Leak intensity', 100, 20, 160),
    leakSpeed: P.num('Leak drift (passes per loop)', 2, 0, 6),
    cutWidth: P.pct('Leak length', 11, 6, 20),
  }),
  shadow: false, depthWrite: false, duration: 12, background: '#120a08',
  layout(ctx) {
    const { p, u, n, M, inner: I, view, media } = ctx;
    const K = Math.max(2, parseInt(p.K, 10) || 12);
    const cols = (Array.isArray(p.leakColors) && p.leakColors.length ? p.leakColors : DEF_COLORS).map((c) => (String(c).startsWith('#') ? c : '#' + c));
    const col = (i) => cols[M.mod(i, cols.length)];
    const amt = (p.intensity ?? 100) / 100;
    const sig = Math.max(0.03, (p.cutWidth ?? 11) / 100);
    const spd = Math.round(p.leakSpeed ?? 2);
    const y = u * K; const mc = Math.floor(y); const d = y - (mc + 0.5);        // signed beat distance to the nearest cut
    const e = Math.exp(-(d / sig) * (d / sig));                                  // leak envelope, 1 at the cut
    const ew = Math.min(1, 1.2 * Math.exp(-((d / (1.1 * sig)) ** 2)));             // detail-wash envelope: flat plateau (~±0.05 beat) around the cut
    const mid = (m) => M.mod(M.mod(m, K), n);
    // ---- hero media: full frame (or inset card when padding > 0) with Ken-Burns ----
    const full = !(p.padding > 0.01);
    const W = full ? view.w * 1.002 : I.w, H = full ? view.h * 1.002 : I.h;
    const kb = (m) => {                                                          // Ken Burns of image m, phase continuous over its beat
      const lp = y - (m - 0.5);                                                  // 0..1 across its beat (slightly beyond at the crossfade)
      const s = E.inOutSine(M.clamp((lp + 0.15) / 1.3));
      const dir = M.rand(M.mod(m, K), 11) < 0.5 ? -1 : 1, diry = M.rand(M.mod(m, K), 23) < 0.5 ? -1 : 1;
      const z0 = M.mod(m, 2) ? 1.23 : 1.13, z1 = M.mod(m, 2) ? 1.13 : 1.23;   // alternate push-in / pull-out (base 1.13 crops ~6% edges: film gate)
      const zoom = M.lerp(z0, z1, s); const room = Math.max(0, (1 - 1 / zoom) / 2 - 0.058); // pan stays inside the cropped margin
      // clamp the on-screen pan to <= 6% of frame width (portrait frames crop a landscape image hard, so UV pan is magnified)
      const md = media && media[mid(m) % Math.max(1, media.length)]; const ma = md && md.w && md.h ? md.w / md.h : 1.5;
      const fa = W / H; const covX = ma > fa ? fa / ma : 1;
      const px = M.clamp(dir * (2 * s - 1) * room, -0.06 * covX / zoom, 0.06 * covX / zoom);
      return { zoom, panX: px, panY: diry * (2 * s - 1) * room * 0.5 };
    };
    const card = (m, extra) => ({ media: mid(m), x: 0, y: 0, z: 0, w: W, h: H, ...(full ? { radius: 0 } : {}), ...kb(m), shadow: 0, layer: 0, ...extra });
    const out = [];
    // white-out cover strength has a floor, so even a faint leak setting still hides the swap; colours scale with intensity
    const cov = M.clamp(amt, 1, 1.05);
    const ec = e * cov;
    const mixNew = d < 0 ? 0 : 1;                                                // hard cut exactly at the peak (contrast is collapsed there): never a double exposure
    const boost = 1 + 0.12 * ec;                                                 // image itself brightens into the leak
    const warm = 1 - 0.35 * e;                                                   // and desaturates toward cream
    out.push(card(mixNew ? mc + 1 : mc, { bright: boost, sat: warm }));
    // ---- persistent drifting leaks (light cards): two soft warm ellipses crossing horizontally, integer passes per loop ----
    const A = view.w;
    const drift = [
      { ph: 0.0, yy: 0.18, hw: 0.55, hh: 0.95, c: col(0), a: 0.28 },
      { ph: 0.5, yy: -0.22, hw: 0.45, hh: 0.8, c: col(1), a: 0.24 },
    ];
    const hold = 1 - 0.7 * e;                                                    // hold-time light hands over to the burst
    drift.forEach((b, i) => {
      const dirn = i ? -1 : 1;
      const f = M.fract(b.ph + dirn * spd * u + 1000);
      const span = A + 2 * b.hw;
      const x = -span / 2 + f * span;
      const wob = 0.04 * Math.sin(M.TAU * (u * Math.max(1, spd) + b.ph));
      const a = b.a * Math.min(1.3, amt) * hold;
      out.push({ light: { type: 'radial', stops: [[0, mixHex(b.c, '#fff2d8', 0.3), a], [0.45, b.c, a * 0.55], [1, b.c, 0]] },
        blend: 'add', x: spd === 0 ? (i ? 0.32 : -0.32) * A : x, y: b.yy + wob, z: 0.01, w: b.hw * 2, h: b.hh * 2, layer: 4 + i });
    });
    // ---- film-edge streak: a thin warm vertical burn (sprocket-edge flare) drifting slowly across, one pass per loop ----
    {
      const sw = 0.03 * A;                                                       // ~3% of frame width
      const fs = M.fract(0.62 + u * Math.max(1, Math.round(spd / 2)) + 1000);     // integer passes -> seamless
      const sx = -A / 2 - 3 * sw + fs * (A + 6 * sw);
      const flick = 0.85 + 0.15 * Math.sin(M.TAU * (u * K * 2 + 0.3));           // gentle flicker, integer cycles per loop
      const sa = 0.55 * Math.min(1.3, Math.max(0.4, amt)) * hold * flick;
      const sc = mixHex(col(2), '#ff9a3c', 0.4);
      out.push({ light: { type: 'linear', angle: 0, stops: [[0, sc, 0], [0.42, mixHex(sc, '#fff0d0', 0.45), sa], [0.58, mixHex(sc, '#fff0d0', 0.45), sa], [1, sc, 0]] },
        blend: 'add', x: sx, y: 0, z: 0.02, w: sw, h: 1.06, layer: 6 });
      out.push({ light: { type: 'linear', angle: 0, stops: [[0, col(1), 0], [0.5, col(1), sa * 0.35], [1, col(1), 0]] },   // soft magenta halo around it
        blend: 'add', x: sx + 0.6 * sw, y: 0, z: 0.015, w: sw * 5, h: 1.06, layer: 5 });
    }
    // ---- the cut burst: coloured leaks sweep across and park on the frame edges at the peak, cream core in the middle ----
    const cut = mc;                                                              // index of the nearest cut
    const sd = M.rand(cut, 7) < 0.5 ? -1 : 1;                                     // sweep direction alternates randomly per cut
    const yo = M.rand(cut, 13);
    const tr = M.clamp(d / (3 * sig), -1, 1);                                    // travel -1..1 across the window
    const ca = e * (0.75 + 0.25 * Math.min(1.6, amt));                           // colour stays visible at low intensity (fringe)
    // sweep runs along the frame's long axis; radii (in frame-height units) scale with frame area so 1:1 / 9:16 keep the same coloured rim
    const port = A < 1, rs = Math.min(1, Math.sqrt(A / 1.78)), ka = 1 + 0.6 * (1 - rs);
    const L = (o) => ({ ...o, x: port ? o.cy : o.sx, y: port ? o.sx : o.cy, r: o.r * rs });
    const leak = [
      L({ amount: 1.25 * ka * ca, color: col(cut), sx: 0.5 + sd * (0.47 + 0.75 * tr), cy: 0.35 + 0.3 * yo, r: 0.46 + 0.12 * e }),     // leading blob: crosses centre on the ramp, sits on the far edge at the peak
      L({ amount: 1.15 * ka * ca, color: col(cut + 1), sx: 0.5 + sd * (-0.47 + 0.75 * tr), cy: 0.7 - 0.3 * yo, r: 0.44 + 0.12 * e }), // trailing blob: enters from the near edge
      L({ amount: 0.6 * ka * ca, color: col(cut + 2), sx: 0.5 + sd * 0.9 * tr, cy: M.rand(cut, 17) < 0.5 ? 0.02 : 0.98, r: 0.32 + 0.1 * e }), // amber along the long edge
      L({ amount: 0.7 * ec * e, color: '#ffeedd', sx: 0.5 + sd * 0.15 * tr, cy: 0.5, r: 0.62 }),                                   // cream core
    ];
    const post = e > 0.002 ? {
      leak,
      bloom: { amount: 0.55 * ec, threshold: 0.8, radius: 0.04 },
      flash: { amount: 0.1 * cov * Math.pow(e, 3), color: '#fff0dc' },
      grade: { sat: 1 - 0.5 * ew, contrast: 1 - 0.95 * ew * ew, bright: 1 + 0.38 * ec },   // contrast collapses at the peak: no image detail, no double exposure
    } : null;
    return { cards: out, post };
  },
};
