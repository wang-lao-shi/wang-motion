import { base, P, mRx, mRy, mMul, mApply, eulerYXZ } from '../_common.js';
// Original: an isometric field of solid blocks (X9 thickness) whose top faces carry the media. Block heights
// pulse like an audio equalizer: a kick-shaped ripple radiating from the centre block (fast attack, soft decay,
// `tempo` pulses per loop) plus a slow diagonal swell across the field. Taller blocks catch more light (brighter
// tops, saturated sides), low blocks fall into shade. The field always bleeds past every frame edge (no empty
// corners at any ratio). Both waves have whole-number periods per loop, so u=0 ≡ u=1.

const BG = '#0a0a0e';
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

export default {
  id: 'iso-equalizer', name: 'Iso Equalizer', category: 'isometric', slots: 12,
  desc: 'Isometric field of solid blocks with media on their tops; heights pulse like an audio equalizer — a kick ripple from the centre plus a slow diagonal swell',
  tags: ['isometric', 'equalizer', 'audio', 'music', 'blocks', 'grid', 'pulse', 'wave', '3d', 'beat'], ref: 'original',
  params: base({
    grid: P.num('Grid density', 5, 3, 9),
    heightAmp: P.pct('Height amplitude', 60, 0, 100),
    tempo: P.num('Pulses per loop', 6, 1, 12),
    sideColor: P.color('Side colour', '#6b4dff'),
  }),
  shadow: false, sheen: 0, depthWrite: true, background: BG,
  duration: 8,
  // fov 4 (camera ≈14 units away) instead of a near-orthographic 1.2 (≈48 units): keeps the iso read (±5% size
  // drift across the frame) while giving the depth buffer ~10× more precision on the block tops/walls.
  camera: () => ({ fov: 4 }),
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const TAU = Math.PI * 2;
    const a = ctx.aspect;
    const G = Math.max(3, Math.round(p.grid));
    const Nk = Math.max(1, Math.round(p.tempo));
    const pitch = M.rad(56), yaw = M.rad(38);
    const R = mMul(mRx(pitch), mRy(yaw));
    // flat card lying on the ground, image top pointing away from the viewer
    const m = [1, 0, 0, 0, 0, 1, 0, -1, 0];
    const e = eulerYXZ(mMul(R, m));
    const rot = { rx: e.rx, ry: e.ry, rz: e.rz, order: e.order };
    const hw = a / 2, hh = 0.5;
    const Hk = (p.heightAmp / 100) * 5.8;          // peak extra height in cells (≈ 3.5 at the default 60%)
    const h0k = 0.06;
    const MAXC = 290;                              // card budget (1 card per block, AUTHORING cap ≈300)
    // blocks whose projected footprint (top at max height down to the floor) touches the frame (+ margin)
    const visible = (c) => {
      const H = Hk * c, oy = -H * Math.cos(pitch) * 0.3, mg = c * 0.6;
      const span = Math.ceil((Math.max(a, 1) * 1.6) / c) + 3, cells = [];
      for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
        const q0 = mApply(R, [i * c, 0, j * c]);
        if (q0[0] < -hw - mg || q0[0] > hw + mg) continue;
        if (q0[1] + oy > hh + mg || q0[1] + oy + (H + h0k * c + c * 0.3) * Math.cos(pitch) < -hh - mg) continue;
        cells.push([i, j]);
      }
      return cells;
    };
    // cell pitch; when the count would exceed the budget (wide ratios / dense grids) the cells grow until it fits
    let c = Math.sqrt(a) / G * 1.12, cells = visible(c);
    for (let k = 0; k < 8 && cells.length > MAXC; k++) { c *= Math.sqrt(cells.length / MAXC) * 1.01; cells = visible(c); }
    const wB = c * 0.9;                            // block top size (gap = 10%)
    const H = Hk * c;
    const h0 = c * h0k;
    const deep = c * 2.5 + H;                      // walls run far below the floor line (gaps read as deep slots)
    const side = p.sideColor || '#6b4dff';
    const sideDark = mix(side, '#000000', 0.72);
    const lam = 3.6;                               // ripple wavelength (cells)
    const dTh = M.rad(-25), lam2 = 7;              // swell direction / wavelength
    // a kick envelope: 0 at ph=0/1, fast attack, long soft decay
    const kick = (ph) => { const s = Math.sin(Math.PI * Math.pow(ph, 0.55)); return s * s; };
    // wall shading (X9 sideLight/sideShade): the engine light gives the two visible walls ≈.49 / .42 (linear);
    // sideLight 1.66 stretches that to lit ≈100% / shadow ≈23% linear (≈52% in sRGB) once sideShade renormalises.
    // (X9 has no vertical wall gradient, and a second stacked slab z-fights, so walls are one flat tone per face;
    // depth comes from the height-driven wall colour instead.)
    const SL = 1.66, SS = 1 / (1 + SL * (0.485 - 1));
    // screen offset: the field centre sits a touch below frame centre (tall blocks rise upward)
    const oy = -H * Math.cos(pitch) * 0.3;
    const out = [];
    const rf = Math.max(G * 0.75, 2.2);            // focal radius (cells) — tiles beyond it dim
    const hAt = (i, j) => {
      const r = Math.hypot(i, j);
      const w1 = kick(M.fract(u * Nk - r / lam));
      const d2 = (i * Math.cos(dTh) + j * Math.sin(dTh)) / lam2;
      const w2 = 0.5 + 0.5 * Math.sin(TAU * (u + d2));
      // per-column wobble: each column bounces at its own whole-number rate (2..5 per loop) and phase,
      // sharpened so only a handful of columns peak at any moment -> a jagged EQ skyline
      const kq = 2 + Math.floor(M.rand(i * 7.13 + j * 3.71, 11) * 4);
      const phq = M.rand(i * 5.37 - j * 9.11, 23);
      const w3 = Math.pow(0.5 + 0.5 * Math.sin(TAU * (kq * u + phq)), 3);
      const env = 1 - 0.15 * M.clamp(r / (G * 1.1), 0, 1);
      return M.clamp((0.42 * w1 + 0.45 * w2 + 0.6 * w3 - 0.22) * env, 0, 1);
    };
    for (const [i, j] of cells) {
      const x = i * c, z = j * c;
      const r = Math.hypot(i, j);
      const hn = hAt(i, j), y = h0 + H * hn;
      const pos = mApply(R, [x, y, z]);
      // media lattice: neighbours (incl. diagonals) never share an image; nearest repeat >= 3 cells away
      const media = M.mod(M.mod(i + 3 * j, 12), n);
      const lit = Math.pow(hn, 1.1);
      const foc = 1 - 0.35 * M.smooth(rf, rf * 1.7, r);   // focal falloff
      const wall = mix('#000000', mix(sideDark, side, lit), foc);
      out.push({
        media, x: pos[0], y: pos[1] + oy, z: pos[2], ...rot, w: wB, h: wB,
        thickness: y + deep, sideColor: wall, sideLight: SL, sideShade: SS, sideSpec: 0.25, back: 'side',
        bright: (0.5 + 0.56 * hn) * foc, sat: (0.72 + 0.3 * hn) * (0.65 + 0.35 * foc), edgeTop: (0.06 + 0.3 * hn * hn) * foc, edgeW: wB * 0.01,
      });
    }
    return {
      cards: out,
      post: {
        bloom: { amount: 0.35, threshold: 0.82, radius: 0.02 },
        leak: [{ amount: 0.16, color: mix(side, '#ffffff', 0.35), x: 0.08, y: 0.95, r: 0.75 }],
      },
    };
  },
};
