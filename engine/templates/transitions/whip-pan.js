// whip-pan — original. Full-frame slideshow; each beat ends in a fast horizontal camera whip:
// outgoing and incoming images travel as one contiguous strip on a soft power curve (no frame
// jumps more than ~30% of the width at 30 fps), streak-blurred by the *actual* per-frame travel
// (180° shutter) with dense taps, while the camera rolls ~1.25° into the move, drifts slightly
// and the exposure lifts around the cut. Overshoot + settle; the punch-in always covers the
// overshoot and the roll so no edge ever shows. Direction alternates or is fixed.
import { base, P } from '../_common.js';
import { E } from '../../lib.js';

const PW = 3.5; // travel curve exponent (between inOutCubic and inOutQuart)
const ease = (a) => a < 0.5 ? 0.5 * Math.pow(2 * a, PW) : 1 - 0.5 * Math.pow(2 - 2 * a, PW);
const easeD = (a) => PW * Math.pow(a < 0.5 ? 2 * a : 2 - 2 * a, PW - 1); // derivative
const QT = 0.78;            // travel share of the whip window (rest = settle)
const ROLL = 1.25 * Math.PI / 180, DRIFT = 0.005, LIFT = 0.13;
const TAPPX = 6 / 1920;     // max tap spacing (long-side units) — 6 px at 1080p
const MAXTW = 8;            // max blur twins (8 taps each)

function whipState(ctx) {
  const { p, u } = ctx;
  const K = Math.max(2, Math.round(p.K));
  const x = u * K; const k = Math.floor(x) % K; const f = x - Math.floor(x);
  const wd = Math.min(0.6, Math.max(0.08, p.whipDur / 100));
  const os = Math.min(0.12, Math.max(0, p.overshoot / 100));
  const dir = p.direction === 'left' ? 1 : p.direction === 'right' ? -1 : (k % 2 === 0 ? 1 : -1);
  const q = Math.min(1, Math.max(0, (f - (1 - wd)) / wd));
  let P0, vel; // strip position (0 old centred, 1 new centred), |dP/dq|
  if (q <= 0) { P0 = 0; vel = 0; }
  else if (q < QT) { const a = q / QT; P0 = (1 + os) * ease(a); vel = (1 + os) * easeD(a) / QT; }
  else {
    const b = (q - QT) / (1 - QT); P0 = 1 + os * (1 - E.inOutCubic(b));
    vel = os * (b < 0.5 ? 12 * b * b : 12 * (1 - b) * (1 - b)) / (1 - QT);
  }
  const velMax = (1 + os) * PW / QT;
  const env = Math.pow(Math.min(1, vel / velMax), 1.6);          // "at peak speed" envelope
  // per-frame travel in strip widths: dP/dq · dq/du · du/frame
  const fps = ctx.spec?.fps || 30, dur = ctx.dur || ctx.spec?.duration || 18;
  const perFrame = vel * (K / wd) / (dur * fps);
  // exposure lift: Gaussian on the cut (P0 = 0.5 ⇔ q = QT/2), σ = 0.04 beat
  const fc = 1 - wd + wd * QT * 0.5, dfc = f - fc, sg = 0.04;
  const lift = LIFT * Math.exp(-0.5 * (dfc * dfc) / (sg * sg));
  return { K, k, f, wd, os, dir, q, P0, vel, env, perFrame, lift, roll: -dir * ROLL * env };
}

export default {
  id: 'whip-pan', name: 'Whip Pan', category: 'transitions',
  slots: 12,
  desc: 'Full-frame slideshow cut together with fast horizontal camera whips: velocity-matched streak blur, camera roll, exposure lift, overshoot and settle.',
  tags: ['transition', 'slideshow', 'whip', 'pan', 'motion blur', 'cinematic', 'full-frame', 'camera'],
  ref: 'original',
  params: base({
    padding: P.padding(0),
    K: P.num('Images per loop', 12, 2, 24),
    whipDur: P.pct('Whip length (% of beat)', 36, 16, 50),
    blur: P.pct('Streak blur', 70, 0, 100),
    overshoot: P.pct('Overshoot', 3, 0, 8),
    direction: P.choice('Direction', 'alternate', ['alternate', 'left', 'right']),
  }),
  shadow: false,
  duration: 18,
  camera(ctx) {
    return { roll: whipState(ctx).roll };
  },
  layout(ctx) {
    const { p, n, inner, M } = ctx;
    const W = inner.w, H = inner.h, L = Math.max(W, H);
    const bleed = (p.padding ?? 0) <= 0.001;
    const gap = bleed ? 0 : ctx.pad * 0.6;
    const st = whipState(ctx);
    const { K, k, f, wd, os, dir, q, P0, env, perFrame, lift, roll } = st;
    const mediaOf = (j) => M.mod(M.mod(j, K), n);
    // punch-in: covers overshoot during the whip …
    const sPeak = 1 + Math.max(0.05, os * 2.4);
    const sAmt = q <= 0 ? 0 : q < QT ? E.outCubic(Math.min(1, q / (QT * 0.5))) : 1 - E.inOutCubic((q - QT) / (1 - QT));
    const sPunch = 1 + (sPeak - 1) * sAmt;
    // … and always covers the camera roll + vertical drift (rotated-rect cover)
    const dy = dir * DRIFT * H * env;
    const ar = Math.max(W / H, H / W), ar2 = Math.min(W / H, H / W);
    const sRoll = Math.cos(roll) + ar * Math.abs(Math.sin(roll)) + 2 * Math.abs(dy) / Math.min(W, H) + 0.002 * env;
    const s = Math.max(sPunch, sRoll + (ar2 > 0 ? 0 : 0));
    // streak: 180° shutter over the actual per-frame travel, dense taps (≤6 px @1080)
    const travelLS = perFrame * (W + gap) * s / L;                 // long-side units per frame
    // trapezoid kernel: N (6 or 8) copies of an 8-tap box (length a) spread over 0.75a; taps
    // interleave to ≤6 px @1080 and the weights taper (no hard-ended "double image")
    const blurAmt = Math.min(MAXTW * 7 * TAPPX, (p.blur / 100) * 0.5 * travelLS);
    let twins = blurAmt > 0.003 ? M.clamp(Math.ceil(blurAmt / (7 * TAPPX)), 6, MAXTW) : 0;
    if (twins === 7) twins = 8;
    const split = env > 0.7 && p.blur > 0 ? 0.003 * (env - 0.7) / 0.3 * (p.blur / 100) : 0;
    const bright = 1 + lift;
    const step = (W + gap) * s;
    const cards = [];
    for (let j = -1; j <= 2; j++) {
      const cx = dir * (j - P0) * step;
      if (Math.abs(cx) > (W * s + step) * 0.5 + 0.01) continue;
      const life = j === 0 ? Math.min(1, f / (1 - wd)) : j < 0 ? 1 : 0;
      const c = {
        media: mediaOf(k + j), x: cx, y: dy, z: 0, w: W, h: H, s,
        zoom: 1.0 + 0.05 * life, layer: 1, shadow: 0, bright,
      };
      if (bleed) c.radius = 0; // full-bleed frame: corners are the frame's own
      if (split > 0.0005) c.rgbSplit = { amt: split, angle: 0 };
      if (twins > 0) {
        // N offset copies of an 8-tap blur → 8N taps; copy i drawn at 1/(i+1) opacity = equal weights
        c.dirBlur = { amt: blurAmt, angle: 0 };
        const span = 0.75 * blurAmt * L; // copies spread over ¾ of the box → fine trapezoid steps
        for (let i = 0; i < twins; i++) {
          const off = (i / twins - (twins - 1) / (2 * twins)) * span;
          cards.push({ ...c, x: cx + off, opacity: 1 / (i + 1), layer: 1 + i });
        }
      } else cards.push(c);
    }
    return cards;
  },
};
