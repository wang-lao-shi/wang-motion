import { base, P, eulerYXZ, mRx, mRz, mMul, mApply } from '../_common.js';
// Cards tiled along a Möbius band (k half twists). The whole band — twist included — turns one full
// lap per loop with the cards riding on it, so the rolling, flattening section sweeps through
// front-centre (at u=0.5 a flat section sits dead centre).
// Each card's twist phase is constant (continuous through the seam), so the loop is exact and the
// band shows no seam (an odd number of half twists only negates W after one lap).
// Images are never mirrored: back faces are re-parametrised; where an image would read upside-down
// the card coin-flips 180° about its length axis, passing edge-on (dimmed while turning; fully transparent only near edge-on).
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const neg = (a) => [-a[0], -a[1], -a[2]];
const fitCache = new Map();
export default {
  id: 'moebius-ribbon', name: 'Möbius Ribbon', category: '3d-perspective', slots: 12,
  desc: 'Cards tiled along a twisting Möbius band; the whole band turns one lap per loop, carrying its twist through the front',
  tags: ['moebius', 'ribbon', 'twist', 'band', 'loop', '3d'], ref: 'original',
  params: base({
    cards: P.num('Cards', 12, 6, 24),
    twist: P.choice('Half twists', '3', ['1', '3', '5']),
    tilt: P.deg('Tilt', 22, 0, 50),
    width: P.pct('Band width', 50, 25, 80),
    gap: P.pct('Card gap', 10, 0, 40),
  }),
  shadow: false, sheen: 0.15, rim: 0.25, depthWrite: true,
  duration: 20,
  camera() { return { perspective: 20 }; },
  layout(ctx) {
    const { p, u, M } = ctx;
    const V = ctx.view;
    const portrait = V.w < 0.8;
    const k = parseInt(p.twist, 10) || 1;
    const sq = portrait ? 0 : M.clamp((1.78 - V.w) / 0.78, 0, 1);   // 0 at 16:9 .. 1 at 1:1
    // band width / radius; capped for many twists so rolled neighbours don't tangle
    const wcap = k >= 5 ? 0.5 : k >= 3 ? 0.62 : 1;
    const beta = Math.min(p.width / 100, wcap) * (portrait ? 0.75 : 1 + 0.5 * sq);
    // clamp the card count by circumference: each card at least ~0.62 band widths long
    const nMax = Math.max(6, Math.floor(M.TAU / (0.62 * beta) * (k >= 5 ? 0.8 : 1)));
    const N = Math.max(3, Math.min(Math.round(p.cards), nMax));
    const tiltR = M.rad(p.tilt);
    const dist = ctx.camDist || 2;
    const ph0 = Math.PI / 2 - k * Math.PI / 4;       // flat section at front-centre at u=0.5
    const ruling = (a, ph) => {
      const th = -Math.PI / 2 + a;
      const Rh = [Math.sin(th), 0, Math.cos(th)];
      return { Rh, T: [Math.cos(th), 0, -Math.sin(th)], W: [Math.sin(ph) * Rh[0], Math.cos(ph), Math.sin(ph) * Rh[2]] };
    };
    // fit: radius + centre offset from the projected band outline over a lap and over the whole
    // travel of the twist pattern, so every ratio and param extreme fills without clipping
    const key = [V.w, beta, tiltR, k, dist].join('|');
    let fit = fitCache.get(key);
    if (!fit) {
      const Gf = mMul(mRz(portrait ? Math.PI / 2 : 0), mRx(tiltR));
      const box = (R, ox, oy) => {
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (let q0 = 0; q0 < 6; q0++) for (let j = 0; j < 96; j++) {
          const a = M.TAU * j / 96, { Rh, W } = ruling(a, -k * a / 2 + Math.PI * q0 / 6);
          for (const w of [-0.5, 0.5]) {
            const q = mApply(Gf, [R * Rh[0] + w * beta * R * W[0], w * beta * R * W[1], R * Rh[2] + w * beta * R * W[2]]);
            const f = dist / Math.max(0.05, dist - q[2]);
            const sx = (q[0] + ox) * f, sy = (q[1] + oy) * f;
            x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
          }
        }
        return { x0, x1, y0, y1 };
      };
      const tw = V.w * (0.94 + 0.08 * sq), th = 0.92;
      let lo = 0.05, hi = 1.2, ox = 0, oy = 0;
      for (let it = 0; it < 22; it++) {
        const mid = (lo + hi) / 2, b = box(mid, 0, 0);
        if (b.x1 - b.x0 <= tw && b.y1 - b.y0 <= th) lo = mid; else hi = mid;
      }
      for (let it = 0; it < 3; it++) { const b = box(lo, ox, oy); ox -= (b.x0 + b.x1) / 2; oy -= (b.y0 + b.y1) / 2; }
      fit = { R: lo, ox, oy };
      fitCache.set(key, fit);
    }
    const R = fit.R;
    const arc = (M.TAU * R / N) * (1 - p.gap / 100);
    const bw = beta * R;
    // gentle periodic sway
    const swX = M.rad(4) * Math.sin(M.TAU * u);
    const swZ = M.rad(3) * Math.sin(M.TAU * u + 1.3);
    const G = mMul(mRz((portrait ? Math.PI / 2 : 0) + swZ), mRx(tiltR + swX));
    // the whole band (cards + twist) turns one lap per loop with a slight breathing in speed; each
    // card rides the band rigidly, so its twist phase is constant: -k(a - 2πs)/2 = -kπi/N (mod π)
    const s = u + 0.1 * Math.sin(M.TAU * u) / M.TAU;
    const cam = [0, 0, dist];
    // screen direction (normalised) of a world vector v at point q
    const sdir = (q, v) => {
      const Dz = dist - q[2];
      const dx = v[0] * Dz + q[0] * v[2], dy = v[1] * Dz + q[1] * v[2];
      const l = Math.hypot(dx, dy) || 1e-9;
      return [dx / l, dy / l];
    };
    const rot = (v, n, c, sn) => [[c * v[0] + sn * n[0], c * v[1] + sn * n[1], c * v[2] + sn * n[2]],
      [c * n[0] - sn * v[0], c * n[1] - sn * v[1], c * n[2] - sn * v[2]]];
    const out = [];
    for (let i = 0; i < N; i++) {
      const a = M.TAU * M.fract(i / N + s);
      const { Rh, T, W } = ruling(a, -k * Math.PI * i / N + ph0);
      let pos = mApply(G, [R * Rh[0], 0, R * Rh[2]]);
      pos = [pos[0] + fit.ox, pos[1] + fit.oy, pos[2]];
      const Tw = mApply(G, T), Rw = mApply(G, Rh);
      let Ww = mApply(G, W);
      const toCam = [cam[0] - pos[0], cam[1] - pos[1], cam[2] - pos[2]];
      const dl = Math.hypot(...toCam);
      // face the camera by choosing the sign of W (frame is independent of W's sign → seamless)
      let sg = 1;
      if (dot(portrait ? cross(Ww, Tw) : cross(Tw, Ww), toCam) < 0) { Ww = neg(Ww); sg = -1; }
      // readability roll: cards near the front roll part of the way about their length axis T toward
      // the camera, so the card crossing front-centre is never seen at a grazing angle (the twist
      // still reads at the sides and back). Pure function of position → loop stays exact.
      {
        const tw = cross(Tw, Ww), n0 = portrait ? neg(tw) : tw;  // band normal, camera side
        const tl = dot(toCam, Tw), nt = [toCam[0] - tl * Tw[0], toCam[1] - tl * Tw[1], toCam[2] - tl * Tw[2]];
        const al = Math.atan2(dot(cross(n0, nt), Tw), dot(n0, nt));
        const front = M.smooth(0.42, 0.88, (pos[2] / R + 1) / 2);
        const be = al * 0.62 * front;
        if (Math.abs(be) > 1e-5) { const cb = Math.cos(be), sb = Math.sin(be);
          Ww = [cb * Ww[0] + sb * tw[0], cb * Ww[1] + sb * tw[1], cb * Ww[2] + sb * tw[2]]; }   // rotate W about T by be
      }
      let x = portrait ? Ww : Tw, y = portrait ? Tw : Ww;
      let n = cross(x, y);
      // upright: image-up on screen; where it points down the card coin-flips about its length
      // axis T. The flip direction follows the face sign so the motion is continuous across edge-on.
      const sd = sdir(pos, y);
      const up = sd[1];
      const phi = Math.PI * M.smooth(0.08, -0.08, up);
      const flipDim = 1 - 0.35 * Math.sin(phi);
      if (phi > 1e-4) {
        const c0 = Math.cos(phi), s0 = Math.sin(phi) * sg;
        if (portrait) { const r = rot(x, n, c0, s0); x = r[0]; n = r[1]; } else { const r = rot(y, n, c0, s0); y = r[0]; n = r[1]; }
        if (dot(n, toCam) < 0) { if (portrait) y = neg(y); else x = neg(x); n = neg(n); }
      }
      const facing = dot(n, toCam) / dl;
      const m = [x[0], y[0], n[0], x[1], y[1], n[1], x[2], y[2], n[2]];
      const e = eulerYXZ(m);
      const curv = dot(Rw, n) / R;
      const depth = (pos[2] / R + 1) / 2;          // 0 back .. 1 front
      const c = { media: i, x: pos[0], y: pos[1], z: pos[2], ...e,
        w: portrait ? bw : arc, h: portrait ? arc : bw,
        bright: (0.5 + 0.5 * depth) * (0.5 + 0.5 * M.smooth(0.1, 0.45, facing)) * flipDim,
        // fully opaque down to facing 0.12 (no half-alpha card ghosting through the z-buffer); dimmed instead
        opacity: M.smooth(0.10, 0.12, facing) };
      if (portrait) c.bendX = curv; else c.bend = curv;
      out.push(c);
    }
    return out;
  },
};
