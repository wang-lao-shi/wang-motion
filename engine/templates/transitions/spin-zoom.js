// spin-zoom — original. Full-frame slideshow cut with spin zooms: at the end of each beat the
// current image accelerates into a rotation (inCubic) while it zooms in, smeared by an angular
// motion blur (rotated copies spread over the actual per-frame rotation, 180° shutter) plus a
// zoom blur; the next image enters already spinning at the matched angular speed from −spin°,
// zoomed in, and brakes to rest on an outExpo curve. The frame is always covered: each card's
// scale is the exact rotated-rectangle cover for its current angle × the zoom. A one-frame
// overlap crossfade, a short exposure flash and radial chroma hide the hand-off.
import { base, P } from '../_common.js';
import { E } from '../../lib.js';

const D2R = Math.PI / 180;
const EX = 1 - Math.pow(2, -10);
const outExpoN = (q) => (1 - Math.pow(2, -10 * q)) / EX;      // exact 0→1
const OUTEXPO_D0 = 10 * Math.LN2 / EX;                         // slope at q = 0
const OV = 0.022;                                              // overlap half-width (beat)
const CREEP = 0.035;                                           // slow push-in during the hold

// rotated-rect cover: scale so a W×H card rotated by th still covers the W×H frame
function coverScale(W, H, th) {
  const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
  return Math.max((W * c + H * s) / W, (W * s + H * c) / H);
}

export default {
  id: 'spin-zoom', name: 'Spin Zoom', category: 'transitions',
  slots: 12,
  desc: 'Full-frame slideshow cut with spin zooms: the image whips into a blurred rotation as it zooms in, the next one spins in from −90° and brakes to rest on an expo curve. Always edge-to-edge.',
  tags: ['transition', 'slideshow', 'spin', 'rotate', 'zoom', 'motion blur', 'cinematic', 'full-frame'],
  ref: 'original',
  params: base({
    padding: P.padding(0),
    K: P.num('Images per loop', 12, 2, 24),
    spin: P.num('Spin angle', 90, 20, 180, '°', 5),
    zoom: P.num('Zoom at the cut', 1.5, 1, 3, '×', 0.05),
    blur: P.pct('Motion blur', 70, 0, 100),
    hold: P.pct('Hold (% of beat at rest)', 55, 40, 80),
  }),
  shadow: false,
  duration: 18,
  layout(ctx) {
    const { p, u, n, inner, M } = ctx;
    const K = Math.max(2, Math.round(p.K));
    const W = inner.w, H = inner.h;
    const bleed = (p.padding ?? 0) <= 0.001;
    const spin = M.clamp(p.spin, 0, 360) * D2R;
    const zMax = Math.max(1, p.zoom);
    const hold = M.clamp(p.hold / 100, 0.3, 0.85);
    const tin = (1 - hold) * 0.7, tout = (1 - hold) * 0.3;     // settle / wind-up windows (beat)
    const blurAmt = M.clamp(p.blur / 100, 0, 1);
    const fps = ctx.spec?.fps || 30, dur = ctx.dur || ctx.spec?.duration || 18;
    const frameB = K / (dur * fps);                             // one frame in beat units
    const mediaOf = (j) => M.mod(M.mod(j, K), n);
    // u = 0 sits in the middle of a hold → the loop point is never a cut
    const x = u * K + tin + (1 - tout - tin) * 0.5;
    const k = Math.floor(x);

    // pose of an image at local beat position g (0 = its cut-in, 1 = its cut-out)
    const pose = (g) => {
      let th = 0, z = 1;
      const rs = tin, re = 1 - tout;
      if (g < 0) {                       // before its cut-in (overlap frame): linear extension
        const e = -g / tin * OUTEXPO_D0;
        th = -spin * (1 + e); z = zMax * (1 + (zMax - 1) / zMax * e * 0.5);
      } else if (g < rs) {
        const e = 1 - outExpoN(g / tin);
        th = -spin * e; z = 1 + (zMax - 1) * e;
      } else if (g >= re) {
        const q = (g - re) / tout;
        const e = q <= 1 ? q * q * q : 1 + 3 * (q - 1);         // inCubic, linear past the cut
        th = spin * e; z = (1 + CREEP) * (1 + (zMax - 1) * e);
      }
      if (g >= rs) z *= 1 + CREEP * E.inOutSine(M.clamp((g - rs) / (re - rs), 0, 1));
      return { th, z };
    };

    const cards = [];
    let cutEnv = 0;
    for (let j = k - 1; j <= k + 1; j++) {
      const g = x - j;
      if (g < -OV || g > 1 + OV) continue;
      const a = g < OV ? E.inOutSine(M.clamp((g + OV) / (2 * OV), 0, 1)) : 1;
      if (a <= 0.001) continue;
      const { th, z } = pose(g);
      // angular / zoom speed per frame (central difference)
      const p0 = pose(g - frameB * 0.5), p1 = pose(g + frameB * 0.5);
      const dth = p1.th - p0.th;                                // rad per frame
      const dz = Math.abs(Math.log(p1.z / p0.z));               // log-zoom per frame
      const span = Math.min(28 * D2R, Math.abs(dth) * 0.5 * blurAmt); // 180° shutter
      const rb = Math.min(0.22, dz * 0.5 * blurAmt * 3 + Math.abs(dth) * 0.12 * blurAmt);
      const env = M.clamp(Math.abs(dth) / (40 * D2R), 0, 1);
      cutEnv = Math.max(cutEnv, env * a);
      const layerBase = (j - k + 1) * 10 + 1;                   // later image draws on top
      const N = span > 0.4 * D2R ? M.clamp(Math.ceil(span / (1.6 * D2R)), 3, 8) : 1;
      for (let i = 0; i < N; i++) {
        const o = N === 1 ? 0 : (i / (N - 1) - 0.5) * span;     // copies spread around the pose
        const thi = th + o;
        const c = {
          media: mediaOf(j), x: 0, y: 0, z: 0, w: W, h: H, rz: thi,
          s: coverScale(W, H, thi) * z * (1 + 0.002 * env), // tiny margin vs AA at the edges
          layer: layerBase + i, shadow: 0, opacity: a / (i + 1),
          bright: 1 + 0.12 * env,
        };
        if (bleed) c.radius = 0;
        if (rb > 0.004) c.radialBlur = { amt: rb, cx: 0.5, cy: 0.5 };
        if (span > 9 * D2R) c.blur = 4 + 1.5 * M.clamp((span / D2R - 9) / 15, 0, 1);
        cards.push(c);
      }
    }
    // cut accents: short exposure flash + radial chroma, peaked on the hand-off
    const fc = x - Math.round(x), sg = 0.03;
    const pulse = Math.exp(-0.5 * (fc * fc) / (sg * sg));
    const post = {};
    if (pulse > 0.01) {
      post.flash = { amount: 0.16 * pulse * (0.4 + 0.6 * blurAmt), color: '#fff6ec' };
      post.chroma = 0.022 * pulse * (0.3 + 0.7 * blurAmt);
      post.grade = { sat: 1 + 0.12 * pulse, contrast: 1 + 0.06 * pulse, bright: 1 };
    }
    return pulse > 0.01 ? { cards, post } : cards;
  },
};
