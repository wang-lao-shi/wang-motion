import { base, P } from '../_common.js';
import { E } from '../../lib.js';
// Glow Sweep Grid (original, T10 #20): a calm grid of glass-like cards. Every 2 beats a diagonal specular band
// glides across the whole grid: each card carries its own light card whose gradient is offset by the card's world
// position, so the band reads as ONE continuous sheet of light across the gaps (a faint backdrop copy fills the gaps).
// Cards lean ~6° toward the band and lift as it passes (3D wave), and each card wipes to its next media exactly under
// the band's hot core (line mask along the band), so the swap is hidden by the highlight. Subtle bloom rides the band.
// Media stream: the card at sweep rank r shows stream index s*d + r in sweep s, d = smallest step >= cards with
// K*d ≡ 0 (mod n) → seamless loop, and every visible window of stream indices spans ≤ n → no image twice at once
// (except tiny slivers when the band crosses many cards; see report).
const TAU = Math.PI * 2;
const hex2 = (h) => { const s = String(h || '#ffffff').replace('#', ''); const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.padEnd(6, 'f'); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255); };
const mixHex = (a, b, t) => '#' + hex2(a).map((v, i) => Math.round(Math.max(0, Math.min(1, v + (hex2(b)[i] - v) * t)) * 255).toString(16).padStart(2, '0')).join('');

export default {
  id: 'glow-sweep-grid', name: 'Glow Sweep Grid', category: 'light-fx', slots: 12,
  desc: 'Glass card grid: a diagonal specular glow band sweeps across all cards every 2 beats, cards lean into the light and swap media under the highlight',
  tags: ['grid', 'light', 'sheen', 'glow', 'sweep', 'specular', 'apple', 'keynote', 'premium', 'tilt', '3d'],
  ref: 'original',
  params: base({
    sweepAngle: P.deg('Sweep direction', 28, -80, 80),
    bandWidth: P.pct('Band width', 12, 4, 40),
    tilt: P.deg('Tilt toward band', 6, 0, 20),
    K: P.choice('Sweeps per loop', '4', ['4', '6', '8']),
    glowColor: P.color('Glow colour', '#cfe0ff'),
  }),
  shadow: true, shadowOpacity: 0.5, depthWrite: false, duration: 12, background: '#08090d',
  camera(ctx) { return { perspective: 34 }; },
  layout(ctx) {
    const { p, u, n, M, inner: I, aspect } = ctx;
    const K = Math.max(2, parseInt(p.K, 10) || 4);
    const [cols, rows] = aspect >= 0.8 ? [3, 3] : [2, 4];
    const N = cols * rows;
    const gap = 0.024 * Math.min(aspect, 1);
    const cw = (I.w - gap * (cols - 1)) / cols, ch = (I.h - gap * (rows - 1)) / rows;
    // sweep geometry (world): band travels along dir, band line perpendicular
    const th = M.rad(p.sweepAngle); const dx = Math.cos(th), dy = Math.sin(th);
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -I.w / 2 + cw / 2 + c * (cw + gap), y = I.h / 2 - ch / 2 - r * (ch + gap);
      cells.push({ x, y, pc: x * dx + y * dy });
    }
    const ext = Math.abs(dx) * cw / 2 + Math.abs(dy) * ch / 2;           // card half-extent along dir
    const pcs = cells.map((c) => c.pc);
    const bw = (p.bandWidth / 100) * Math.min(aspect, 1) * 0.5 + 0.004; // core half-width (world)
    const halo = bw * 2.6;
    const p0 = Math.min(...pcs) - ext - halo * 1.1, p1 = Math.max(...pcs) + ext + halo * 1.1;
    [...cells].sort((a, b) => a.pc - b.pc).forEach((c, k) => { c.rank = k; });
    // stream step d (seamless + no repeats in any visible window when N < n)
    let d = 0; for (let s = N; s < n; s++) if ((K * s) % n === 0) { d = s; break; }
    if (!d) { for (let s = Math.min(N, n - 1); s >= 1; s--) if ((K * s) % n === 0) { d = s; break; } }
    if (!d) d = n;
    // band timing: travel occupies 56% of each sweep, then the grid rests
    const x = u * K - 0.22; const sw = Math.floor(x); const f = x - sw;   // band centred on the half-sweep; loop point = rest
    const TR = 0.56; const q = M.clamp(f / TR);
    const qe = 0.35 * q + 0.65 * E.inOutCubic(q);
    const active = f < TR;
    const b = active ? M.lerp(p0, p1, qe) : p1 + 10;                    // band centre along dir
    const env = active ? M.smooth(0, 0.14, q) * M.smooth(1, 0.86, q) : 0; // effects fade to exactly 0 at band start/end (seam)
    const vis = active ? Math.sin(Math.PI * q) * env : 0;               // band presence (bloom / backdrop)
    const g = M.clamp(p.cornerRadius / 100);
    const glow = p.glowColor || '#cfe0ff'; const hot = mixHex(glow, '#ffffff', 0.75);
    const sig = Math.max(cw, ch) * 0.75;
    const out = [];
    // faint backdrop band so the light continues through the gaps
    if (active) {
      const FW = aspect * 1.08, FH = 1.08;
      const alpha = Math.atan2(FH * dy, FW * dx); const Gm = Math.hypot(FW * dx, FH * dy); const span = Gm * (Math.abs(Math.cos(alpha)) + Math.abs(Math.sin(alpha)));
      const tc = b / span + 0.5, wt = (halo * 1.6) / span;
      out.push({ light: { type: 'linear', angle: alpha, stops: [[tc - wt, glow, 0], [tc, glow, 0.1 * env], [tc + wt, glow, 0]] }, blend: 'add', x: 0, y: 0, z: -0.02, w: FW, h: FH, layer: -5 });
    }
    const minwh = Math.min(cw, ch);
    const Rm = Math.min(g * minwh * 3.2, g * 0.8 * Math.min(aspect, 1));
    for (const c of cells) {
      const dist = c.pc - b;                                              // >0: band not there yet
      const z0 = dist / sig;
      const shape = active ? env * z0 * Math.exp(0.5 - 0.5 * z0 * z0) : 0;      // derivative-of-gaussian, peak ±1 at ±sig
      const near = active ? env * Math.exp(-z0 * z0 * 0.9) : 0;
      const ang = -M.rad(p.tilt) * shape;                                 // normal leans toward the band
      const rx = ang * -dy, ry = ang * dx;
      const zc = 0.018 * near;
      // per-card uv mapping of the world projection
      const alpha = Math.atan2(ch * dy, cw * dx); const Gm = Math.hypot(cw * dx, ch * dy);
      const span = Gm * (Math.abs(Math.cos(alpha)) + Math.abs(Math.sin(alpha))) * 0.5 * 2; // world proj range mapped to t 0..1
      const tb = (b - c.pc) / span + 0.5;                                 // band centre in card t
      const oldI = sw * d + c.rank, newI = (sw + 1) * d + c.rank;
      const mOld = M.mod(M.mod(oldI, K * d), n), mNew = M.mod(M.mod(newI, K * d), n);
      const base = { x: c.x, y: c.y, z: zc, rx, ry, w: cw, h: ch, bright: 1 + 0.07 * near, edgeX: 0.55 * near, edgeTop: 0.7 * near, edgeW: 0.0035 };
      const passed = !active || tb >= 1.0005; const before = active && tb <= -0.0005;
      if (before) out.push({ ...base, media: mOld, layer: 0 });
      else if (passed) out.push({ ...base, media: active ? mNew : M.mod(M.mod((sw + 1) * d + c.rank, K * d), n), layer: 0 });
      else {
        out.push({ ...base, media: mOld, layer: 0 });
        out.push({ ...base, media: mNew, layer: 1, shadow: 0, mask: { type: 'line', angle: alpha, p: tb, soft: Math.max(0.004, (bw / span) * 0.55) } });
      }
      // specular band on this card (halo + hot core), continuous across the grid
      if (active && tb > -(halo / span) - 0.02 && tb < 1 + halo / span + 0.02) {
        const wh = halo / span, wc = bw / span;
        const L = { blend: 'add', x: c.x, y: c.y, z: zc, rx, ry, w: cw, h: ch, radius: Rm / (minwh * 3.2), layer: 2 };
        out.push({ ...L, light: { type: 'linear', angle: alpha, stops: [[tb - wh, glow, 0], [tb, glow, 0.2 * env], [tb + wh, glow, 0]] } });
        out.push({ ...L, layer: 3, light: { type: 'linear', angle: alpha, stops: [[tb - wc, glow, 0], [tb - wc * 0.2, hot, 0.8 * env], [tb + wc * 0.2, hot, 0.8 * env], [tb + wc, glow, 0]] } });
      }
    }
    return { cards: out, post: vis > 0.001 ? { bloom: { amount: 0.75 * vis, threshold: 0.82, radius: 0.028 } } : null };
  },
};
