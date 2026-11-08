import { base, P, cardAR } from '../_common.js';
import { E } from '../../lib.js';
// Atom Orbits (original): an atom-logo composition. A big hero "nucleus" card sits in the middle; three
// flattened elliptical orbits, their major axes 60° apart, each carry `perOrbit` small "electron" cards.
// Electrons are real 3D points (circle tilted toward the camera, then rolled about Z), so the ones crossing the
// front of the hero sit at z≈+R and draw over it, the ones crossing the back sit at z≈-R and are hidden by it
// (painter sort by camera distance; front/back z differ by ~2R, never close while overlapping the hero).
// Orbit phase has a Kepler-like ease (slow at the far tips, fast through the nucleus), periodic in θ, and each
// orbit turns a whole number of times per loop → u=1 == u=0. Faint dotted orbit paths are additive radial
// dots (anti-aliased by construction). The whole atom is stretched to the frame's long axis so 16:9 / 1:1 /
// 9:16 are all filled. The hero swaps media K times per loop with a burning dissolve + scale punch + a soft
// shock ring; ≥70% of each beat it holds full colour. r2: media ring — hero = beat mod n (all media pass through the
// nucleus); electrons hold the next E images, and just before each beat the electron holding the incoming image
// dissolves to the next unseen one, so no image is ever on two cards. One loop = K beats with K ≡ 0 (mod n) and
// K ≡ 0 (mod 3): the ring then shifts slots by r = K mod E (a multiple of 3), which the orbits absorb by turning an
// extra −r/3/per of a turn per loop (electron k ends where k−r/3 started) → seamless. Per-orbit phases are tuned
// so the tilted orbits don't bring electrons through the shared crossings together. r3: phases + electron size are
// tuned per aspect band (wide / square / tall; the frame stretch changes where the orbits cross), measured on the
// projected layout with boxes inflated 12%: ≤16% overlap at every sheet phase (1:1:1). r4: phases + electron size come from a per-tilt
// table (tilt 16–40°, 2° steps); orbit paths are never cut: near any visible electron the segments are pushed just under
// that card, so each ellipse reads as one continuous line.
// r4: per-tilt layout table (tilt quantised to 2°, 16..40), per aspect band: [electron scale, PH1°, PH2°], solved on the
// projected layout (boxes inflated 6%) for worst pair overlap ≤16% over a full orbit period, then fewest 3-card chains.
const TILT_TAB = [
  [[.92,73,73],[1,75,76],[1,79,84],[1,80,89],[.96,81,93],[.92,80,98],[.88,79,100],[.8,76,101],[.84,66,47],[.76,65,46],[.72,65,44],[.68,68,41],[.76,1,38]],
  [[.8,73,73],[.88,78,78],[.96,81,81],[1,84,86],[1,83,90],[1,82,92],[1,80,94],[.92,80,97],[.96,58,47],[.92,64,49],[.84,66,48],[.8,66,47],[.76,4,38]],
  [[.8,71,71],[.88,76,76],[.96,83,83],[1,86,89],[1,84,91],[1,81,89],[.96,81,97],[.96,78,96],[.92,77,100],[.96,62,48],[.88,63,48],[.84,64,48],[.76,63,45]],
];
const SPEEDS = { '1:2:3': [1, 2, 3], '1:-2:2': [1, -2, 2], '1:1:1': [1, 1, 1], '1:-1:1': [1, -1, 1], '2:-3:2': [2, -3, 2], '2:3:4': [2, 3, 4] };

export default {
  id: 'atom-orbits', name: 'Atom Orbits', category: 'orbit', slots: 12,
  desc: 'Atom-logo composition: three tilted elliptical orbits of cards circling a hero card that swaps on beats. The beat count follows the media count (n beats per loop, 3n when n is not a multiple of 3), so every image passes through the nucleus once.',
  tags: ['orbit', 'atom', 'ellipse', 'hero', 'nucleus', 'depth', 'science', 'tech', 'loop'], ref: 'original',
  params: base({
    perOrbit: { ...P.num('Cards per orbit', 3, 2, 3), desc: 'Electrons per orbit (needs 3×this+2 media, else 2). Hero beats are not a param: they follow the media count (n, or 3n when n is not a multiple of 3).' },
    tilt: { ...P.deg('Orbit tilt', 24, 16, 40), desc: 'Orbit tilt toward the camera (snapped to 2° steps; electron size and phases are tuned per step)' },
    speeds: P.choice('Orbit speeds (turns/loop)', '1:1:1', Object.keys(SPEEDS)),
    heroSize: { ...P.pct('Hero size', 56, 35, 80), desc: 'Nucleus card size; the beat swaps follow the media count' },
    glow: P.color('Glow colour', '#6fc8ff'),
  }),
  shadow: true, shadowOpacity: 0.5, rim: 0.6, edgeTop: 0.35, edgeW: 0.003, sheen: 0.06,
  background: '#0a0c14',
  duration: 18,
  camera(ctx) { return { perspective: 26 }; },
  layout(ctx) {
    const { p, u, n, M, view } = ctx;
    const W = view.w, H = view.h, mn = Math.min(W, H);
    let per = Math.round(M.clamp(p.perOrbit, 2, 3));
    if (3 * per + 2 > n && per > 2) per = 2;                   // ring needs E+2 distinct media
    const E_ = 3 * per;
    const ring = E_ + 2 <= n;
    const K = n % 3 === 0 ? n : 3 * n;                          // beats per loop: hero shows every media; K ≡ 0 mod 3
    const tShift = ring ? M.mod(K, E_) / 3 : 0;                 // ring slot shift per loop, in electron positions
    const sp = SPEEDS[p.speeds] || SPEEDS['1:1:1'];
    const tq = Math.round(M.clamp(p.tilt, 16, 40) / 2) * 2;      // tilt snapped to the solved table
    const beta = M.rad(tq);
    const portrait = W < H * 0.95;
    const g0 = portrait ? Math.PI / 2 : 0;                     // major axis of orbit 0 along the frame's long side
    const out = [];

    // ---- hero (nucleus)
    const har = cardAR(ctx, 0.8);
    const hs = p.heroSize / 100;
    let hh = hs * Math.min(H, ((portrait ? 0.75 : 0.62) * W) / har);
    const hFloor = 0.26 * W * hs / 0.56;                       // focal floor scales with the param (26% of width at default)
    if (hh * har < hFloor) hh = hFloor / har;
    const hw = hh * har;
    const x = u * K, j = Math.floor(x), f = x - j;
    const T = 0.28;                                             // transition share of a beat (hold ≥ 72%)
    const q = M.clamp(f / T, 0, 1);
    const mA = M.mod(j - 1, n), mB = M.mod(j, n);
    const inT = q < 1;
    const punch = inT ? Math.sin(Math.PI * q) : 0;
    const settle = f < 0.5 ? Math.sin(Math.PI * M.clamp((f - T) / 0.22, 0, 1)) * (f > T ? 1 : 0) : 0;
    const sway = M.TAU * u;
    const hero = {
      media: inT ? mA : mB, x: 0, y: 0, z: 0, w: hw * (1 - 0.05 * punch + 0.012 * settle), h: hh * (1 - 0.05 * punch + 0.012 * settle),
      ry: 0.07 * Math.sin(sway), rx: 0.05 * Math.sin(2 * sway + 0.7), shadow: 0.65, sheen: 0.08,
      radius: (0.035 * mn) / (3.2 * Math.min(hw, hh)),            // ≈2.4% of the frame short side in pixels (shader AA eats ~⅓)
    };
    if (inT) Object.assign(hero, { media2: mB, mix: E.inOutCubic(q), mixMode: 'dissolve', mixOpts: { edge: 0.035, scale: 6, seed: j * 7.31, edgeColor: p.glow, glow: 0.7 } });
    out.push(hero);
    // soft halo behind the nucleus + shock ring on each swap
    out.push({ light: { type: 'radial', stops: [[0, p.glow, 0.55], [0.45, p.glow, 0.16], [1, p.glow, 0]] }, blend: 'add',
      x: 0, y: 0, z: -0.02, w: hw * 2.6, h: hh * 2.0, opacity: 0.55 + 0.35 * punch, shadow: 0 });
    const ringAge = f / 0.6;
    if (ringAge < 1) {
      const rs = 1.05 + 1.6 * E.outCubic(ringAge);
      out.push({ light: { type: 'ring', r: 0.82, width: 0.12, stops: [[0, p.glow, 0.9], [1, p.glow, 0]] }, blend: 'add',
        x: 0, y: 0, z: -0.015, w: hw * rs * 1.25, h: hh * rs, opacity: 0.55 * (1 - ringAge) * Math.min(1, ringAge * 8) });
    }

    // ---- orbits
    const asp = W / H, band = asp > 1.3 ? 0 : asp < 0.8 ? 2 : 1;   // wide / square / tall
    const TT = TILT_TAB[band][(tq - 16) / 2];
    const ew0 = [0.125, 0.105, 0.105][band] * TT[0] * mn * (portrait ? 1.35 : 1); // electron card width at z=0
    const ear = 0.8;
    const R = 0.5 * mn;                                         // circle radius before the frame stretch
    // extents of the rolled ellipses (semi-axes R, R·sinβ): orbit 0 reaches R on the long axis, the ±60° orbits
    // reach R·e on the short axis → stretch each axis so the atom fills the frame
    const e = Math.sqrt(0.75 + 0.25 * Math.sin(beta) ** 2);
    const mX = ew0 * 0.72, mY = (ew0 / ear) * 0.68;
    const Ax = (portrait ? (W / 2 - mX) / (R * e) : (W / 2 - mX) / R) * 0.9;
    const Ay = (portrait ? (H / 2 - mY) / R : (H / 2 - mY) / (R * e)) * 0.9;
    const Zs = 0.42;                                            // depth radius = R·cosβ·Zs (keeps perspective tame)
    const pos = (i, th) => {
      const g = g0 + i * Math.PI / 3 * (i === 2 ? -1 : 1);      // rolls 0, +60, -60
      const cx = R * Math.cos(th), s = R * Math.sin(th);
      const ly = s * Math.sin(beta), lz = s * Math.cos(beta);   // circle tilted toward the camera
      const X = cx * Math.cos(g) - ly * Math.sin(g), Y = cx * Math.sin(g) + ly * Math.cos(g);
      return [X * Ax, Y * Ay, lz * Zs];
    };
    const zMax = R * Math.cos(beta) * Zs;
    const PH3 = [0, TT[1] / 360, TT[2] / 360];
    const PH = per === 3 ? PH3 : [0, 0.125, 0.375];             // tuned phases (turns): crossings staggered
    // electron ring: "prepared-for" beat jc runs P ahead of the hero beat, so the donor electron swaps (dissolve)
    // in the last P of the previous beat while the hero still holds the old image
    const Pd = 0.2;
    const c = u * K + Pd, jc = Math.floor(c), fc = c - jc;
    const dq = M.clamp(fc / Pd, 0, 1);
    const eAng = [];                                            // eased angles per orbit (for trails)
    const elecs = [];                                           // electron boxes (path segments under a card are dropped)
    const KE = (t0) => t0 - 0.16 * Math.sin(2 * t0);           // Kepler-ish: slow at tips (θ=0,π), fast through the nucleus
    for (let i = 0; i < 3; i++) {
      const eff = sp[i] > 0 ? sp[i] - tShift / per : sp[i] + (per - tShift) / per;
      eAng[i] = [];
      for (let k = 0; k < per; k++) {
        const th = KE(M.TAU * (k / per + eff * u + PH[i]));
        eAng[i].push(th);
        const [ex, ey, ez] = pos(i, th);
        const front = ez / zMax;                                // -1 back .. 1 front
        const ew = ew0 * (1 + 0.12 * front);
        const dir = Math.sign(eff) || 1;
        const el = {
          x: ex, y: ey, z: ez,
          w: ew, h: ew / ear, ry: -0.28 * Math.sin(th) * dir * 0.6, rz: 0.06 * Math.cos(th) * dir,
          bright: 0.7 + 0.3 * (front + 1) / 2, sat: 0.85 + 0.15 * (front + 1) / 2, shadow: 0.45,
        };
        if (ring) {
          const s_ = i + 3 * k;                                 // ring slot
          const m = jc + 1 + M.mod(s_ - jc - 1, E_);             // unique m in (jc, jc+E] with m ≡ s (mod E)
          el.media = M.mod(m, n);
          if (m === jc + E_ && dq < 0.999) Object.assign(el, { media: M.mod(jc, n), media2: el.media, mix: E.inOutCubic(dq), mixMode: 'dissolve',
            mixOpts: { edge: 0.05, scale: 5, seed: jc * 3.7 + s_, edgeColor: p.glow, glow: 0.7 } });
        } else el.media = M.mod(1 + i * per + k, n);
        out.push(el); elecs.push(el);
      }
    }
    // continuous orbit paths: overlapping additive streak segments along the tangent, brighter in front, plus a
    // soft trail (~0.15 turn) behind each electron
    const camD = ctx.camDist || 1.134;
    const D = 170, TR = 0.15 * M.TAU;
    const eP = elecs.map((el, ix) => { const k_ = camD / (camD - el.z); const sw = el.w * k_, sh = (el.w / ear) * k_;
      const sx = el.x * k_, sy = el.y * k_;
      const hidden = el.z < 0 && Math.abs(sx) + sw / 2 < hw / 2 && Math.abs(sy) + sh / 2 < hh / 2;
      return { sx, sy, sw, sh, z: el.z, hidden, orb: Math.floor(ix / per) }; });
    const vis = eP.filter((e) => !e.hidden);
    for (let i = 0; i < 3; i++) {
      const dir = Math.sign(sp[i] > 0 ? 1 : -1);
      for (let d = 0; d < D; d++) {
        const th = M.TAU * d / D;
        const [px, py, pz] = pos(i, th);
        // tangent measured on screen (perspective): near the tips the path dives in depth, so the world-xy tangent
        // would tilt the segments into hatching
        const pj = (t) => { const [a, b_, z_] = pos(i, t); const k_ = camD / (camD - z_); return [a * k_, b_ * k_]; };
        const kp = camD / (camD - pz);
        const [qx, qy] = pj(th + M.TAU / D).map((v) => v / kp);
        const [rx_, ry_] = pj(th - M.TAU / D).map((v) => v / kp);
        const front = pz / zMax;
        const over = Math.abs(px) < hw * 0.52 && Math.abs(py) < hh * 0.52;
        if (over && pz < 0) continue;                           // hidden behind the hero
        const seg = Math.hypot(qx - rx_, qy - ry_) / 2;
        const sx = px * kp, sy = py * kp;
        // r4: no cuts. Within ~1.2 card boxes (on screen) of any visible electron the segment is pushed just under that
        // card (screen position kept), so cards always sit over the faint paths (logo-style, never sliced by a line) and
        // each path reads as one unbroken line passing behind. Cards hidden behind the hero never affect the path.
        let zs = pz - 0.001;
        for (const el of vis) {
          if (Math.max(Math.abs(el.sx - sx) / el.sw, Math.abs(el.sy - sy) / el.sh) < 1.2) zs = Math.min(zs, el.z - 0.025);
        }
        if (over) zs = Math.max(zs, Math.min(pz - 0.001, 0.025)); // never pushed behind the (swaying) hero face
        const kz = camD / (camD - zs);                        // keep the screen position when pushed under a card
        let tr = 0;
        for (let k = 0; k < eAng[i].length; k++) {
          const ea = eAng[i][k];
          const behind = M.mod((ea - th) * dir, M.TAU);         // angular distance behind the electron
          if (behind >= TR) continue;
          const el = eP[i * per + k];
          const dd = Math.max(Math.abs(el.sx - sx) / el.sw, Math.abs(el.sy - sy) / el.sh);
          const fade = M.clamp((dd - 0.5) / 0.6, 0, 1);          // trail brightening fades out over 0.6 card width
          tr = Math.max(tr, (1 - behind / TR) ** 1.6 * fade * fade * (3 - 2 * fade));
        }
        const th_ = 0.0055 * mn * (1 + 0.2 * front) * (1 + 0.6 * tr);
        let op = front >= 0 ? 0.6 + 0.2 * front : 0.25 + 0.35 * (1 + front);
        if (over) op = 0.32;
        op = Math.min(1, op + 0.75 * tr);
        out.push({ light: { type: 'streak', stops: [[0, '#ffffff', 1], [0.3, p.glow, 0.85], [1, p.glow, 0]] }, blend: 'add',
          x: px * kp / kz, y: py * kp / kz, z: zs, w: (seg * 3.2 + th_) * kp / kz, h: th_ * kp / kz, rz: Math.atan2(qy - ry_, qx - rx_), opacity: op, shadow: 0, rim: 0, sheen: 0, edgeX: 0, edgeTop: 0, edgeBottom: 0 });
      }
    }
    return out;
  },
};
