import { base, P, reflect, mRx, mRy, mRz, mMul, mApply, eulerYXZ } from '../_common.js';
import { E } from '../../lib.js';
// Phone Trio Fan (original, phase 4 T09 #18)
// Three phones fanned like a hand of cards (rz +a / 0 / −a), the centre one 8% larger and in front, outer ones yawed
// inward. Each screen is an endless vertical feed that snaps one post (media + header/caption chrome) per beat; the
// outer phones run half a beat out of phase, so something is always moving. The whole group yaws ±8° once per loop
// over a dark glossy floor (mirrored reflections + soft contact shadows) under a glow tinted by the centre screen.
// Loop: feed offset advances exactly K posts per loop; post j of phone ph shows media mod(mod(j,K) + ph·D, n).

const OVER = 0.05;
const SNAPS = {
  overshoot: (t) => (t < 0.62 ? (1 + OVER) * E.inOutCubic(t / 0.62) : 1 + OVER - OVER * E.inOutSine((t - 0.62) / 0.38)),
  spring: (t) => 1 - Math.cos(t * Math.PI * 3) * Math.exp(-t * 8) * (1 - t),
  smooth: E.inOutQuart,
  snappy: E.outExpo,
};
const SCR = '#0d0d11', INK = '#ececf1', DIM = '#4a4a55', MUTE = '#2c2c34';
const AVA = ['#ff8a5c', '#7c6cff', '#3ec7a8', '#ffcf4a', '#ff5c8a', '#4aa8ff', '#b06cff', '#6ce07a', '#ff9f43', '#5ce1e6', '#f368e0', '#c8d6e5'];

export default {
  id: 'phone-trio-fan', name: 'Phone Trio Fan', category: 'device-mockup', slots: 12,
  desc: 'Three phones fanned like a hand of cards, the centre one larger and in front; every screen snaps through an endless feed (outer phones half a beat apart) while the trio slowly yaws over a glossy floor.',
  tags: ['phone', 'device', 'mockup', 'trio', 'fan', 'feed', 'scroll', 'app', 'product', 'reflection', 'showcase'],
  ref: 'original',
  params: base({
    fanAngle: P.deg('Fan angle', 12, 0, 30),
    spread: P.num('Spread', 0.8, 0.5, 1.3, '× phone', 0.05),
    feedSpeed: P.num('Feed steps per loop', 8, 4, 16),
    snapEase: P.choice('Snap ease', 'overshoot', ['overshoot', 'spring', 'smooth', 'snappy']),
    deviceColor: P.color('Device colour', '#1d1d20'),
  }),
  shadow: false, depthWrite: false, duration: 12, background: '#09090d',
  camera() { return { perspective: 24 }; },
  layout(ctx) {
    const { u, n, M, p, view } = ctx;
    const K = Math.max(4, Math.round(p.feedSpeed));
    const ease = SNAPS[p.snapEase] || SNAPS.overshoot;
    const D = Math.max(1, Math.round(n / 3));
    const med = (ph, j) => M.mod(M.mod(j, K) + ph * D, n);
    const portrait = view.w < 0.8, wide = view.w > 1.3;
    // device colour: light bodies tint the front bezel band too (straight-on the side band is ~1 px), so the colour reads
    const dc = (() => { const m = /^#?([0-9a-f]{6})$/i.exec(p.deviceColor || ''); const v = m ? parseInt(m[1], 16) : 0x1d1d20; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; })();
    const lum = (0.2126 * dc[0] + 0.7152 * dc[1] + 0.0722 * dc[2]) / 255;
    const bt = M.clamp((lum - 0.12) / 0.4, 0, 1) * 0.9 + 0.12;     // dark bodies: faint tint; light: ~90% toward the body colour
    const hex = (c) => '#' + c.map((v) => Math.round(M.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
    const bezCol = hex([7, 7, 8].map((b, k) => b + (dc[k] - b) * Math.min(1, bt)));
    const frmCol = hex(dc.map((v) => v + (lum > 0.5 ? -38 : 46)));   // metal side band: darker rim on light bodies, lighter on dark

    // ---- geometry: size the trio so its fanned bounds fit the frame (portrait: tighter overlap, slight bleed)
    const I = ctx.device('phone'); const HB = I.h;          // body height in units of body width
    const a = M.rad(p.fanAngle); const sp = p.spread * (portrait ? 0.58 : wide ? 1.35 : 1);
    const CS = 1.08;                                         // centre phone scale
    const drop = CS * HB / 2 - (HB / 2 * Math.cos(a) + 0.5 * Math.sin(a));   // outer phones' lowest corner on the centre phone's baseline (all three stand on the floor), in W units
    const hwU = sp + 0.5 * Math.cos(a) + 0.5 * HB * Math.sin(a);   // group half-width / W
    const topU = Math.max(CS * HB / 2, HB / 2 * Math.cos(a) + 0.5 * Math.sin(a) - drop);
    const botU = Math.max(CS * HB / 2, HB / 2 * Math.cos(a) + 0.5 * Math.sin(a) + drop);
    const fitW = portrait ? 1.12 - 0.1 * M.clamp(a / M.rad(30), 0, 1) : wide ? 0.66 : 0.9;
    const hMax = portrait ? 0.7 : wide ? 0.76 : 0.7;                      // leaves a floor band for the reflection
    const W = Math.min((fitW * view.w / 2) / hwU, hMax / (topU + botU));
    const y0 = (portrait ? 0.1 : wide ? 0.06 : 0.085) + (botU - topU) * W / 2;   // centre phone y (keeps the group optically centred)
    const floorY = y0 - botU * W - 0.008;

    // ---- group motion: yaw breathes ±8° once per loop, constant slight look-down
    const s1 = Math.sin(M.TAU * u), c1 = Math.cos(M.TAU * u);
    const G = mMul(mRy(M.rad(-6 + 8 * s1)), mRx(-0.09));

    // ---- feed for one screen (screen fractions, y up)
    const A = I.screenAspect; const wOf = (hf) => hf / A;
    const flat = (o) => ({ useMedia: false, radius: 0.5, ...o });
    const MW = 0.9, MH = 0.54, HDR = 0.06, CAP = 0.07, PITCH = HDR + MH + CAP + 0.015;
    const L = -MW / 2; const rad = 0.035 + (p.cornerRadius / 100) * 0.6;
    const feed = (ph, off) => {
      const b = u * K + off; const k = Math.floor(b + 1e-9); const f = b - k;
      const s = k + ease(M.clamp(f / 0.42, 0, 1));          // 42% move, 58% hold
      const sc = [];
      for (let j = k - 2; j <= k + 3; j++) {
        const my = 0.03 + (s - j) * PITCH;                   // media centre
        if (my - MH / 2 - CAP > 0.55 || my + MH / 2 + HDR < -0.55) continue;
        const jj = M.mod(j, K); const col = AVA[(jj + ph * 5) % AVA.length];
        const hy = my + MH / 2 + HDR / 2; const ad = 0.036;
        sc.push(flat({ x: L + wOf(ad) / 2, y: hy, w: wOf(ad), h: ad, color: col }));
        sc.push(flat({ x: L + wOf(ad) + 0.04 + 0.11, y: hy + 0.006, w: 0.22 + 0.1 * M.rand(jj + ph * 17, 3), h: 0.011, color: INK }));
        sc.push(flat({ x: L + wOf(ad) + 0.04 + 0.07, y: hy - 0.011, w: 0.14, h: 0.008, color: DIM }));
        sc.push({ media: med(ph, j), x: 0, y: my, w: MW, h: MH, radius: rad, zoom: 1.03 });
        const cy = my - MH / 2;
        sc.push(flat({ x: L + 0.17, y: cy - 0.02, w: 0.34, h: 0.011, color: INK }));
        sc.push(flat({ x: L + 0.3 + 0.1 * M.rand(jj + ph * 7, 5), y: cy - 0.038, w: 0.6 + 0.2 * M.rand(jj + ph * 7, 5), h: 0.009, color: MUTE }));
      }
      // fixed chrome: status bar + home indicator
      sc.push(flat({ x: 0, y: 0.5 - 0.03, w: 1, h: 0.06, color: SCR, radius: 0 }));
      sc.push(flat({ x: -0.36, y: 0.473, w: 0.11, h: 0.008, color: INK }));
      sc.push(flat({ x: 0.33, y: 0.473, w: 0.12, h: 0.008, color: INK }));
      sc.push(flat({ x: 0, y: -0.5 + 0.014, w: 0.34, h: 0.005, color: INK }));
      return { sc, k, f };
    };

    // ---- three phones: [ph, side]; centre = ph 0 (hero), in front
    const out = [];
    const phones = [];
    [[1, -1], [2, 1], [0, 0]].forEach(([ph, sd], i) => {
      const sc = sd === 0 ? CS : 1;
      const bob = 0.006 * Math.sin(2 * M.TAU * u + i * 2.1);
      const local = [sd * sp * W, (sd === 0 ? 0 : -drop * W) + bob, sd === 0 ? 0.04 : -0.16 * W];
      const pos = mApply(G, local);
      const R = mMul(G, mMul(mRy(-sd * 0.3), mRz(-sd * a)));
      const e = eulerYXZ(R);
      const F = feed(ph, sd === 0 ? 0 : 0.5);
      const phone = {
        device: 'phone', w: W * sc, x: pos[0], y: y0 + pos[1], z: pos[2], ...e,
        deviceColor: p.deviceColor, bezelColor: bezCol, frameColor: frmCol, thickness: W * sc * 0.1, gloss: 0.13, glossAngle: 0.55 + 0.3 * s1 - sd * 0.25,
        screenColor: SCR, screenCards: F.sc, layer: sd === 0 ? 6 : 4,
      };
      phones.push({ phone, sd, sc, F, ph, pos });
    });

    // ---- stage: base wash + glow tinted by the centre screen's settled post, vignette, floor
    const hero = phones[2]; const kH = hero.F.k; const qH = E.inOutSine(M.clamp(hero.F.f / 0.45, 0, 1));
    const tint = { media: med(0, kH), media2: med(0, kH + 1), mix: qH, mixMode: 'fade', zoom: 4, zoom2: 4,
      panX: 0.28, panY: -0.22, panX2: 0.28, panY2: -0.22, blur: 6, sat: 1.35, radius: 0, shadow: 0 };
    const ff = ctx.fullFrame(-1.2, 1.1);
    out.push({ ...ff, ...tint, bright: 0.24, layer: 0 });
    const gw = Math.max(view.w * 1.15, 1.2);
    out.push({ ...tint, x: 0, y: y0 + 0.02, z: -1.0, w: gw, h: gw * (portrait ? 1.3 : 0.8), bright: 1.25, layer: 1,
      mask: { type: 'circle', cx: 0.5, cy: 0.5, r: 0.14, soft: 0.36 } });
    out.push({ ...ctx.fullFrame(-1.1, 1.1), light: { type: 'radial', stops: [[0, '#000000', 0], [0.55, '#000000', 0.2], [1, '#000000', 0.75]] }, blend: 'normal', layer: 1 });
    // floor: deepen below the horizon, thin horizon sheen
    const fw = ff.w;
    out.push({ light: { type: 'linear', angle: -Math.PI / 2, stops: [[0, '#040407', 0.3], [0.3, '#040407', 0.7], [1, '#040407', 0.9]] },
      blend: 'normal', x: 0, y: (floorY - 0.75) / 2, z: -0.05, w: fw, h: floorY + 0.75, layer: 2 });
    out.push({ light: { type: 'streak', angle: 0, stops: [[0, '#ffffff', 0.35], [0.5, '#ffffff', 0.08], [1, '#ffffff', 0]] }, blend: 'add',
      x: 0, y: floorY, z: -0.3, w: Math.min(view.w * 0.95, 1.5), h: 0.01, layer: 2 });

    // ---- reflections (outer first), contact shadows, phones
    phones.forEach(({ phone, sd }) => {
      out.push({ ...reflect(phone, { floorY, opacity: 0.3, fade: 0.55, bright: 0.8 }), layer: sd === 0 ? 3 : 2 });
    });
    phones.forEach(({ phone, sd, sc }) => {
      out.push({ light: { type: 'radial', stops: [[0, '#000000', 0.75], [0.5, '#000000', 0.3], [1, '#000000', 0]] }, blend: 'normal',
        x: phone.x, y: floorY + 0.004, z: phone.z + 0.02, w: W * sc * 1.5, h: 0.05, opacity: 0.8, layer: 3 });
    });
    phones.forEach(({ phone }) => out.push(phone));
    return out;
  },
};
