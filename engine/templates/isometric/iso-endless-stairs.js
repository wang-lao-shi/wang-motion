import { base, P, cardAR, mRx, mMul, eulerYXZ } from '../_common.js';
import { E, beats } from '../../lib.js';
import { isoCamera } from './_iso.js';
// Original: an isometric staircase of solid steps (risers down to a common floor) whose treads are the media
// cards. Every beat the whole flight slides one step down-left, the front step hovers as the hero, the lowest
// step sinks into the floor and a new step pops up at the top with a small overshoot. A faint ghost flight
// behind and fog at both ends make the climb read as endless (seamless loop).

const BG = '#0d0d11', TOP = '#2a2e39';
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
// side / riser colour as a function of normalised world height (0 = floor, 1 = top tread)
const SIDE_LO = '#101219', SIDE_HI = '#1f2430';
const RIS_LO = '#14171f', RIS_HI = '#3a4050';
const backOut = (t, c = 1.4) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);   // ~7% overshoot

export default {
  id: 'iso-endless-stairs', name: 'Iso Endless Stairs', category: 'isometric', slots: 12,
  desc: 'Isometric endless staircase: media cards are the treads of solid steps that slide down-left one step per beat while new steps pop up at the top',
  tags: ['isometric', 'stairs', 'penrose', 'endless', 'diagonal', 'stepped', 'product', '3d'], ref: 'original',
  params: base({
    steps: P.num('Visible steps', 5, 3, 8),
    K: P.num('Cards per loop (min steps+3)', 12, 8, 24),
    stepHeight: P.pct('Step height', 55, 15, 120),
    hold: P.pct('Hold between steps', 60, 20, 85),
  }),
  shadow: false, sheen: 0,
  duration: 12,
  camera: isoCamera,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const S = Math.max(3, Math.round(p.steps));
    const Keff = Math.max(Math.round(p.K), S + 3);          // never two copies of one image on screen
    const mv = 1 - p.hold / 100;
    const prog = beats(u, Keff, mv, E.inOutCubic);           // 0..Keff, slots slide down by one per beat
    const pitch = M.rad(42);
    const Rp = mRx(pitch);
    // Two tread layouts, picked per frame ratio: A = wide treads (image across the flight, steep climb, for
    // square/portrait), B = long treads (image along the flight, shallow climb, for landscape).
    const ar = cardAR(ctx, 1.6);
    const proj = (v) => [v[0], v[1] * Math.cos(pitch) - v[2] * Math.sin(pitch)];
    // tall steps would make the solid flight very tall; the rise is softened above 55% so treads stay big
    const sh = p.stepHeight / 100, shEff = sh <= 0.55 ? sh : 0.55 + (sh - 0.55) * 0.25;
    const geo = (th, mode) => {
      const s = Math.sin(th), C = Math.cos(th);
      const c = [C, 0, -s], w = [s, 0, C];
      const Wt = mode === 'A' ? ar : 1.25, Dp = mode === 'A' ? 1 : ar;
      return { c, w, Wt, Dp, run: Dp, rise: Math.min(Wt, Dp) * shEff, mode };
    };
    const bbox = (g) => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const k of [0, S - 1]) {   // whole flight; the riser bottoms may bleed off (solid stairs continue to the floor)
        for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) for (const hh of [k * g.rise, -g.rise * 0.45]) {
          const v = [0, 1, 2].map((i) => g.c[i] * (k * g.run + a * g.Dp) + g.w[i] * b * g.Wt + (i === 1 ? hh : 0));
          const q = proj(v); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
        }
      }
      const hr = (y1 - y0) * 0.06;   // headroom for the pop-up overshoot of the top step (fit only; centring ignores it)
      return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 + hr };
    };
    const iw = ctx.inner.w, ih = ctx.inner.h, target = iw / ih;
    let best = null;
    for (const [mode, d0, d1, pref] of [['A', 34, 66, 52], ['B', 14, 40, 24]]) {
      for (let d = d0; d <= d1; d += 1) {
        const g = geo(M.rad(d), mode); const b = bbox(g);
        const fill = Math.min(iw / b.w, ih / b.h) ** 2 * b.w * b.h / (iw * ih);
        const err = Math.abs(Math.log((b.w / b.h) / target)) + Math.abs(d - pref) * 0.004 - fill * 0.2;
        if (!best || err < best.err) best = { err, g, b };
      }
    }
    const { g, b } = best;
    const { Wt, Dp, run, rise } = g;
    const Sc = Math.min(iw / b.w, ih / b.h) * (target > 1.3 ? 1.08 : 1.0);   // landscape: treads a touch larger, the floor bleeds
    const ox = -(b.x0 + b.x1) / 2 * Sc, oy = -(b.y0 + b.y1) / 2 * Sc;
    const { c, w } = g, up = [0, 1, 0];
    const neg = (v) => v.map((x) => -x);
    const orient = (X, Y, N) => {
      const m = [X[0], Y[0], N[0], X[1], Y[1], N[1], X[2], Y[2], N[2]];
      const e = eulerYXZ(mMul(Rp, m)); return { rx: e.rx, ry: e.ry, rz: e.rz, order: e.order };
    };
    const A = g.mode === 'A';
    const oTread = A ? orient(w, c, up) : orient(c, neg(w), up), oRiser = orient(w, up, neg(c)), oSide = orient(c, up, w);
    const place = (v) => { const r = [v[0], v[1] * Math.cos(pitch) - v[2] * Math.sin(pitch), v[1] * Math.sin(pitch) + v[2] * Math.cos(pitch)];
      return { x: r[0] * Sc + ox, y: r[1] * Sc + oy, z: r[2] * Sc }; };
    const atW = (cc, ww, yy) => place([0, 1, 2].map((i) => c[i] * cc + w[i] * ww + (i === 1 ? yy : 0)));
    const at = (sl, dc, dw, dy) => atW(sl * run + dc, dw, sl * rise + dy);
    const yF = -rise, yTop = (S - 1) * rise;
    const hN = (y) => M.clamp((y - yF) / (yTop - yF), 0, 1);
    // a solid face as a vertical gradient card whose colour follows world height (adjacent faces match)
    const face = (pos, o, wd, y0, y1, lo, hi, fog, extra = {}) => ({
      ...pos, ...o, w: wd * Sc, h: Math.max(1e-4, (y1 - y0) * Sc), blend: 'normal', opacity: 1,
      light: { type: 'linear', angle: Math.PI / 2, stops: [[0, mix(mix(lo, hi, hN(y0)), BG, fog), 1], [1, mix(mix(lo, hi, hN(y1)), BG, fog), 1]] }, ...extra });
    // Entry / exit are timed in seconds from the beat start (not from the slot), so they read at any speed:
    // the leaving front step sinks + fades over >=0.35 s from the start of the move; the new top step sits at
    // its final slot and rises from -2.4 rise with a ~6% overshoot over >=0.3 s, ending early in the hold.
    const Tb = (ctx.dur || 12) / Keff, xb = u * Keff, kB = Math.floor(xb), tau = (xb - kB) * Tb;
    const mvT = mv * Tb, hdT = Tb - mvT;
    const Ts = Math.min(Math.max(0.36, mvT), Tb * 0.95);                       // exit duration
    // rise starts once the old top step has slid ~85% clear (so the new one never pokes through it)
    const tS = Math.min(0.62 * mvT, Tb * 0.6);
    const tE = Math.min(Math.max(tS + 0.3, mvT + 0.25 * hdT), Tb * 0.97);
    const exitK = M.clamp(tau / Ts, 0, 1);
    const riseK = M.clamp((tau - tS) / Math.max(1e-6, tE - tS), 0, 1);
    const stepState = (j) => {
      if (j === kB) return { op: 1 - E.inOutSine(exitK), sink: E.inQuad(exitK), exit: true };
      if (j === kB + S) return tau < tS ? { op: 0, dy: 0 }
        : { op: E.outSine(M.clamp(riseK / 0.35, 0, 1)), dy: -(1 - backOut(riseK)) * rise * 2.4 };
      return j > kB && j < kB + S ? { op: 1, dy: 0 } : { op: 0, dy: 0 };
    };
    const out = [];
    const LF = -4000;   // floor + ghost flight layers (behind everything)
    // floor: soft cool glow and a contact shadow under the flight
    const midC = (S - 1) / 2 * run;
    const floorO = oTread;
    const fw = (A ? Wt : (S + 3) * run) * Sc, fd = (A ? (S + 3) * run : Wt) * Sc;
    out.push({ ...atW(midC, -Wt * 0.6, yF - 0.002), ...floorO, w: fw * 3.2, h: fd * 1.5, opacity: 0.32,
      light: { type: 'radial', stops: [[0, '#3a4562', 1], [0.55, '#1e2434', 0.6], [1, '#000000', 0]] }, blend: 'add', layer: LF });
    out.push({ ...atW(midC + Dp * 0.05, Wt * 0.12, yF), ...floorO, w: (A ? Wt * 1.5 : (S + 1.2) * run) * Sc, h: (A ? (S + 1.2) * run : Wt * 1.5) * Sc,
      opacity: 0.85, light: { type: 'radial', stops: [[0, '#000000', 0.8], [0.6, '#000000', 0.45], [1, '#000000', 0]] }, blend: 'normal', layer: LF + 1 });
    // ghost flight: a faint second staircase behind, offset half a step, fading into fog at both ends
    const gOff = -Wt * 1.45, gShift = 1.5;
    const pf = prog - Math.floor(prog);
    for (let k = -3; k <= S + 3; k++) {
      const s = k - pf + gShift;                         // ghost slot, slides with the flight
      const mid = (S - 1) / 2 + 1.2, dist = Math.abs(s - mid) / (S / 2 + 2.2);
      const fog = M.clamp(0.6 + 0.4 * E.inQuad(M.clamp(dist, 0, 1)), 0, 1);   // ≈0.4 visible at the middle
      if (fog >= 0.995) continue;
      const yT = s * rise, gl = LF + 10 + (S + 6 - k) * 4;
      const cc = s * run;
      out.push(face(atW(cc - Dp / 2, gOff, (yT + yF) / 2), oRiser, Wt, yF, yT, RIS_LO, RIS_HI, fog, { layer: gl }));
      out.push(face(atW(cc, gOff + Wt / 2, (yT + yF) / 2), oSide, Dp, yF, yT, SIDE_LO, SIDE_HI, fog, { layer: gl }));
      out.push({ ...atW(cc, gOff, yT), ...oTread, w: (A ? Wt : Dp) * Sc, h: (A ? Dp : Wt) * Sc, color: mix('#3a4050', BG, fog), useMedia: false, layer: gl + 1 });
    }
    const j0 = Math.floor(prog) - 1, j1 = Math.floor(prog) + S + 1;
    for (let j = j0; j <= j1; j++) {
      const s = j - prog;                                   // continuous slot (0 = front / hero)
      const st = stepState(j), op = st.op; if (op <= 0.002) continue;
      const media = M.mod(M.mod(j, Keff), n);
      // the incoming step sits at its final slot (behind the old top step, which slides away) and rises
      const sp = j === kB + S ? S - 1 : s;
      // the leaving step slides down to floor level and sinks into it while fading (never below the floor)
      const dy = st.exit ? -Math.max(0, sp * rise - yF) * 0.6 * st.sink : st.dy;
      const yT = st.exit ? yF + Math.max(0, sp * rise - yF) * (1 - 0.6 * st.sink) : sp * rise + dy;
      if (yT - yF <= 1e-4) continue;
      const hero = E.inOutSine(M.clamp(1 - Math.abs(s) / 0.9, 0, 1));
      const lift = hero * rise * 0.3 + 0.002 * Dp;
      const hs = 1 + 0.1 * hero;
      const rank = -j, L = (part) => 2 * (rank * 8 + part);
      const tw = (A ? Wt : Dp) * Sc, td = (A ? Dp : Wt) * Sc;
      const fog = 1 - op;
      // solid step: riser (front) + side, both down to the common floor
      out.push(face(atW(sp * run - Dp / 2, 0, (yT + yF) / 2), oRiser, Wt, yF, yT, RIS_LO, RIS_HI, 0, { opacity: op, layer: L(0) }));
      // white lip on the riser top edge (key light from top-left)
      out.push({ ...atW(sp * run - Dp / 2, 0, yT - rise * 0.04), ...oRiser, w: Wt * Sc, h: rise * 0.08 * Sc, opacity: op * 0.5,
        light: { type: 'linear', angle: Math.PI / 2, stops: [[0, '#8090b0', 0], [1, '#a8b4d0', 0.6]] }, blend: 'add', layer: L(0) + 1 });
      out.push(face(atW(sp * run, Wt / 2, (yT + yF) / 2), oSide, Dp, yF, yT, SIDE_LO, SIDE_HI, 0, { opacity: op, layer: L(0) }));
      // thin light rim along the top edge of the side face
      out.push({ ...atW(sp * run, Wt / 2, yT - 0.0017 / Sc), ...oSide, w: Dp * Sc, h: 0.0035, opacity: op * 0.55,
        light: { type: 'linear', angle: 0, stops: [[0, '#6c7a9c', 0.5], [1, '#c4cff0', 1]] }, blend: 'add', layer: L(0) + 1 });
      // tread base (visible when the card hovers)
      out.push({ ...at(sp, 0, 0, dy), ...oTread, w: tw, h: td, color: TOP, useMedia: false, opacity: op, layer: L(1) });
      if (hero > 0.01) out.push({ ...at(sp, -Dp * 0.06, Wt * 0.03, dy + 0.001 * Dp), ...oTread, w: tw * 0.98, h: td * 0.96, opacity: op * hero * 0.75,
        light: { type: 'radial', stops: [[0, '#000000', 0.85], [0.7, '#000000', 0.55], [1, '#000000', 0]] }, blend: 'normal', layer: L(2) });
      // the media card itself (tread)
      out.push({ ...at(sp, 0, 0, dy + lift), ...oTread, w: tw * hs, h: td * hs, media, opacity: op,
        bright: 0.9 + 0.13 * hero, sat: 0.92 + 0.08 * hero, edgeBottom: 0.5 + 0.4 * hero, edgeW: 0.003, layer: L(3) });
      // contact shadow cast by the step above onto the back of this tread
      const opUp = stepState(j + 1).op;
      const aoA = opUp * op * (1 - hero * 0.7) * (fog < 1 ? 1 : 0);
      if (aoA > 0.01) out.push({ ...at(sp, Dp / 2 - Dp * 0.2, 0, dy + lift + 0.001 * Dp), ...oTread, w: A ? tw * 0.94 : tw * 0.4, h: A ? td * 0.4 : td * 0.94, opacity: aoA,
        light: { type: 'linear', angle: A ? Math.PI / 2 : 0, stops: [[0, '#000000', 0], [0.6, '#000000', 0.22], [1, '#000000', 0.5]] }, blend: 'normal', layer: L(4) });
    }
    // soft key light from the top-left
    return { cards: out, post: { leak: [{ amount: 0.14, color: '#b4c2ff', x: 0.05, y: 0.98, r: 0.7 }] } };
  },
};
