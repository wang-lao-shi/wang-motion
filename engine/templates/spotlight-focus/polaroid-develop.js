import { base, P, mRx, mRy, mRz, mMul, mApply } from '../_common.js';
import { E } from '../../lib.js';
// Polaroid Develop (original): one instant photo per beat on a warm, softly lit table. Each polaroid drops in from
// the top (already entering while the previous one slides away), lands with a thunk + shake and a flash, develops
// from a milky grey blank to full colour, holds, then slides onto a messy pile at the side. The pile keeps the last
// few photos (the oldest disappears underneath). Seamless: beat b shows photo b; media/jitter depend on mod(j, K).
const FRAME_AR = 0.83;          // classic instant film frame w/h
const S = 5;                     // photos kept on the pile
const MESS = 0.6;                // pile messiness
const MILK = '#c9cbc4';          // undeveloped emulsion
// beat timeline (fractions of a beat)
const T_START = -0.17;           // next photo starts falling this early (in the previous beat) -> stage never empty
const T_LAND = 0.115;            // contact with the table (flash + shake)
const T_DEV = 0.14;              // develop starts
const T_SLIDE = 0.80;            // slide onto the pile starts

export default {
  id: 'polaroid-develop', name: 'Polaroid Develop', category: 'spotlight-focus', slots: 6,
  desc: 'Instant photos drop onto a lit table with a flash and a shake, develop from milky grey to full colour, then slide onto a messy pile',
  tags: ['polaroid', 'instant', 'photo', 'develop', 'stack', 'step', 'retro', 'memories', 'wedding', 'travel'], ref: 'original',
  params: base({
    loopCards: P.num('Photos per loop (K)', 6, 2, 24),
    developTime: P.pct('Develop time', 42, 20, 60),
    photoSize: P.pct('Photo size', 96, 60, 100),
    impact: P.pct('Impact (shake + flash)', 60, 0, 100),
    stackSide: P.choice('Pile side', 'left', ['left', 'right']),
    frameColor: P.color('Frame colour', '#f3efe6'),
  }),
  shadow: true, shadowOpacity: 0.5,
  background: '#16110d',
  duration: 15,
  layout(ctx) {
    const { p, n, u, M, view: V, inner: I, dur } = ctx;
    const K = Math.max(2, Math.round(p.loopCards));
    const portrait = V.w < 0.9;
    const square = !portrait && V.w / V.h < 1.25;
    const side = p.stackSide === 'right' ? 1 : -1;
    const sz = M.clamp(p.photoSize / 100, 0.5, 1);
    const imp = M.clamp(p.impact / 100);
    const heroTilt = 0.06;
    const rzMax = (square ? 0.22 : 0.35) * MESS + 0.04;        // max pile rotation
    const offX = (square ? 0.10 : 0.175) * MESS, offY = 0.11 * MESS;   // pile jitter (fraction of pile card size)
    const pk = portrait ? 0.45 : square ? 0.38 : 0.6;          // pile scale vs hero
    const cT = Math.cos(heroTilt), sT = Math.sin(heroTilt), cP = Math.cos(rzMax), sP = Math.sin(rzMax);
    const AR = 1 / FRAME_AR;                                    // Hf / Wf
    // half extents per unit Wf (rotated bounds)
    const hwU = 0.5 * cT + 0.5 * AR * sT, hhU = 0.5 * AR * cT + 0.5 * sT;
    const pwU = pk * (0.5 * cP + 0.5 * AR * sP + offX), phU = pk * (0.5 * AR * cP + 0.5 * sP + offY * AR);
    const gap0 = 0.04 * V.w;                                    // pile keeps >= 4% of frame width clear of the hero
    let Wf, hx, hy, px, py;
    if (!portrait) {
      const wMax = Math.min((0.92 * I.h) / AR, (I.w - gap0) / (2 * hwU + 2 * pwU));
      Wf = wMax * sz;
      const T = Wf * (2 * hwU + 2 * pwU);
      const gap = gap0 + (I.w - gap0 - T) * 0.35;               // spread spare width a little
      const tot = T + gap;
      hx = -side * (tot / 2 - Wf * hwU); hy = 0;
      px = side * (tot / 2 - Wf * pwU); py = square ? -0.01 : -0.02;
    } else {
      const gapV = 0.035;
      const wMax = Math.min(I.w / (2 * hwU), (0.92 * I.h) / AR, (I.h - gapV) / (2 * hhU + 2 * phU));
      Wf = wMax * sz;
      const T = Wf * (2 * hhU + 2 * phU);
      const gap = gapV + (I.h - gapV - T) * 0.4;
      const tot = T + gap;
      hx = 0; hy = tot / 2 - Wf * hhU;
      px = side * Math.max(0, I.w / 2 - Wf * pwU) * 0.8; py = -(tot / 2 - Wf * phU);
    }
    const Hf = Wf * AR;
    const x = u * K, b = Math.floor(x), f = x - b;
    const devSpan = M.clamp(p.developTime / 100, 0.1, T_SLIDE - T_DEV - 0.05);
    // engine-default frame radius (same formula as core), photo corners a bit tighter
    const cr = (p.cornerRadius ?? 3) / 100;
    const frameR = (w, h) => Math.min(cr * Math.min(w, h) * 3.2, cr * 0.8 * Math.min(ctx.aspect, 1));
    const out = [];

    // ---------------- table / atmosphere ----------------
    const FF = ctx.fullFrame(-0.05, 1.12);
    out.push({ useMedia: false, color: '#2b2118', ...FF, shadow: 0, opacity: 0.7, layer: -20,
      dissolve: { p: 0.5, scale: 2.6, edge: 0.7, seed: 3 } });                                   // mottled surface
    out.push({ useMedia: false, color: '#0d0907', ...FF, shadow: 0, opacity: 0.35, layer: -19,
      dissolve: { p: 0.55, scale: 9, edge: 0.5, seed: 11 } });                                   // fine fibres
    out.push({ light: { type: 'radial', stops: [[0, '#ffd7a6', 0.55], [0.45, '#ffb878', 0.22], [1, '#ff9a50', 0]], falloff: 1.2 },
      blend: 'add', x: hx * 0.6 - side * 0.04, y: hy * 0.5 + 0.12, z: -0.04, w: Math.max(V.w, 1) * 1.5, h: 1.45, opacity: 0.42, layer: -18 });  // key light pool
    out.push({ light: { type: 'radial', stops: [[0, '#000000', 0], [0.55, '#000000', 0.08], [1, '#000000', 0.7]] },
      blend: 'multiply', ...ctx.fullFrame(0.3, 1.0), w: ctx.fullFrame(0.3, 1.0).w * 1.08, h: ctx.fullFrame(0.3, 1.0).h * 1.08, opacity: 1, layer: 190 });   // vignette
    {
      const nf = Math.max(1, Math.round(dur * 24));
      const seed = M.mod(Math.floor(u * nf + 1e-6), nf);
      out.push({ light: { type: 'linear', stops: [[0, '#8a8a8a', 1], [1, '#8a8a8a', 1]] }, blend: 'normal', ...ctx.fullFrame(0.31, 1.02),
        opacity: 0.03, layer: 191, dissolve: { p: 0.5, scale: 520, edge: 0.25, seed: seed * 1.37 } });   // film grain ~0.03
    }

    // ---------------- one polaroid ----------------
    // frame card + photo card (+ milky develop overlay) sharing a rigid transform
    const polaroid = (j, pose, develop, layer, opacity = 1) => {
      const { cx, cy, cz = 0, s = 1, rz = 0, rx = 0, ry = 0, shadow = 0.5 } = pose;
      const w = Wf * s, h = Hf * s, m = w * 0.06, iw = w - 2 * m;
      const R = mMul(mRy(ry), mMul(mRx(rx), mRz(rz)));
      const off = mApply(R, [0, h / 2 - m - iw / 2, 0.0015 * s]);
      const off2 = mApply(R, [0, h / 2 - m - iw / 2, 0.003 * s]);
      const rot = { rx, ry, rz };
      const rPhoto = (frameR(w, h) * 0.3) / (iw * 3.2);
      out.push({ useMedia: false, color: p.frameColor, x: cx, y: cy, z: cz, w, h, ...rot, shadow, opacity, layer: layer * 3, sheen: 0.15, bright: 1 });
      const d = M.clamp(develop);
      const ink = E.inOutSine(M.clamp(d * 1.25));             // milky overlay clears first
      const col = E.outCubic(M.clamp((d - 0.08) / 0.92));       // colour blooms in, eases out to full
      const bl = 6 * (1 - ink);
      out.push({ media: M.mod(M.mod(j, K), n), x: cx + off[0], y: cy + off[1], z: cz + off[2], w: iw, h: iw, ...rot, radius: rPhoto, shadow: 0, opacity, layer: layer * 3 + 1,
        sat: col, bright: 1 + 0.5 * (1 - d) * (1 - d), blur: bl >= 4 ? bl : 0, zoom: 1.04 - 0.04 * ink });
      if (ink < 0.999) out.push({ useMedia: false, color: MILK, x: cx + off2[0], y: cy + off2[1], z: cz + off2[2], w: iw, h: iw, ...rot, radius: rPhoto, shadow: 0, opacity: opacity * (1 - ink) * 0.94, layer: layer * 3 + 2 });
    };
    // pile z kept >= 0 so renderOrder (layer*1000 + z*10) stays inside its integer layer band
    const pilePose = (j, depth) => {
      const q = M.mod(j, K);
      const R = (sd) => M.rand(q + 1, sd);
      return { cx: px + (R(1) - 0.5) * 2 * Wf * pk * offX, cy: py + (R(2) - 0.5) * 2 * Hf * pk * offY,
        cz: 0.004 * (S + 1 - depth) + 0.002, s: pk, rz: (R(3) - 0.5) * 2 * (rzMax - 0.04) + side * 0.04, shadow: 0.35 };
    };
    const heroRz = (j) => (M.rand(M.mod(j, K) + 1, 7) - 0.5) * 2 * heroTilt;

    // hero state for photo j at beat-local time g in [T_START, 1)
    const heroAt = (j, g) => {
      const hero = { cx: hx, cy: hy, cz: 0.02, s: 1, rz: heroRz(j), shadow: 0.55 };
      if (g < T_LAND) {                                   // falling: drifts in from the top, accelerates, thunk
        const a = M.clamp((g - T_START) / (T_LAND - T_START));
        const fall = 0.7 * a * (2 - a) + 0.3 * a * a * a;   // quick entry, still moving at contact (thunk)
        const yTop = V.h / 2 + Hf * 0.62;
        return { pose: { ...hero, cy: M.lerp(yTop, hy, fall), cx: hx + (1 - fall) * -side * 0.06, cz: 0.02 + (1 - fall) * 0.22,
          rz: hero.rz + (1 - fall) * 0.45 * side, rx: (1 - fall) * -0.4, shadow: 0.55 * (0.5 + 0.5 * fall) }, develop: 0, layer: 20 };
      }
      if (g < T_SLIDE) {
        const l = (g - T_LAND) / 0.11;                    // landing shake (decays over ~0.11 beat)
        let pose = hero;
        if (l < 1) {
          const sh = imp * Math.sin(l * Math.PI * 4.5) * Math.exp(-l * 3.2) * (1 - l);
          pose = { ...hero, cy: hy + sh * 0.022 - imp * 0.012 * Math.sin(Math.PI * Math.min(1, l * 3)) * (1 - l),
            cx: hx + sh * 0.035, rz: hero.rz + sh * 0.12, s: 1 + 0.025 * imp * Math.sin(Math.PI * Math.min(1, l * 2.5)) };
        } else pose = { ...hero, rz: hero.rz + Math.sin((g - T_LAND) * 5) * 0.003 };
        return { pose, develop: M.clamp((g - T_DEV) / devSpan), layer: 20 };
      }
      const a = E.inOutCubic(M.clamp((g - T_SLIDE) / (1 - T_SLIDE)));   // slide onto the pile
      const tgt = pilePose(j, 0);
      const arc = Math.sin(Math.PI * a);
      return { pose: { cx: M.lerp(hx, tgt.cx, a), cy: M.lerp(hy, tgt.cy, a) + arc * 0.03, cz: M.lerp(0.02, tgt.cz, a) + arc * 0.06,
        s: M.lerp(1, pk, a), rz: M.lerp(hero.rz, tgt.rz, a) - side * arc * 0.12, shadow: M.lerp(0.55, 0.35, a) }, develop: 1, layer: 10 };
    };

    // pile: photos b-1 .. b-S (b-S fades out under the arriving one)
    const fs = M.clamp((f - T_SLIDE) / (1 - T_SLIDE));
    for (let d = S; d >= 1; d--) {
      const j = b - d;
      const op = d === S ? 1 - M.smooth(0.3, 1, fs) : 1;
      if (op <= 0.001) continue;
      polaroid(j, pilePose(j, d - 1 + fs), 1, 10 - d, op);   // depth slides as the new photo lands
    }
    // current hero (layer 10 while sliding = top of pile; becomes 9 next beat, same order)
    { const h = heroAt(b, f); polaroid(b, h.pose, h.develop, h.layer); }
    // next photo already dropping in
    if (f >= 1 + T_START) { const h = heroAt(b + 1, f - 1); polaroid(b + 1, h.pose, h.develop, h.layer); }

    // camera flash at the moment of landing, centred on the photo
    if (imp > 0) {
      const t = f - (T_LAND - 0.008);
      const fl = t <= 0 ? 0 : (1 - Math.exp(-t * 300)) * Math.exp(-t * 22) * (0.25 + 0.75 * imp);
      if (fl > 0.004) {
        out.push({ light: { type: 'radial', stops: [[0, '#ffffff', 1], [0.35, '#fff6e8', 0.55], [1, '#fff0dc', 0]] }, blend: 'add',
          x: hx, y: hy, z: 0.32, w: Math.max(V.w, 1) * 1.6, h: 1.6, opacity: fl * 0.7, layer: 200 });
      }
    }
    return out;
  },
};
