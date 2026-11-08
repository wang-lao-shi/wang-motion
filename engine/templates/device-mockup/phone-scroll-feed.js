import { base, P } from '../_common.js';
import { E } from '../../lib.js';
// Phone Feed Scroll (original, phase 4 T17 #34)
// Front-on phone; its screen is a dark-mode social feed (post header, media card, action icons, caption)
// that snaps one post per beat with a ~4% overshoot. Behind the phone the current post fills the frame,
// blurred and dimmed, crossfading with each snap so the backdrop colour follows the content.
// Loop: scroll offset advances exactly K posts per loop; post j shows media mod(mod(j,K), n).

const OVER = 0.04;                          // overshoot as a fraction of one post pitch
const SNAPS = {
  // fast push past the target, gentle settle back
  overshoot: (t) => (t < 0.62 ? (1 + OVER) * E.inOutCubic(t / 0.62) : 1 + OVER - OVER * E.inOutSine((t - 0.62) / 0.38)),
  spring: (t) => 1 - Math.cos(t * Math.PI * 3) * Math.exp(-t * 9) * (1 - t),
  smooth: E.inOutQuart,
  snappy: E.outExpo,
};
const AVA = ['#ff8a5c', '#7c6cff', '#3ec7a8', '#ffcf4a', '#ff5c8a', '#4aa8ff', '#b06cff', '#6ce07a', '#ff9f43', '#5ce1e6', '#f368e0', '#c8d6e5'];
const BG = '#0c0c0f', INK = '#f2f2f5', DIM = '#5b5b66', MUTE = '#34343c', LIKE = '#ff3b5c';

export default {
  id: 'phone-scroll-feed', name: 'Phone Feed Scroll', category: 'device-mockup', slots: 12,
  desc: 'Front-on phone scrolling a social feed that snaps one post per beat with a soft overshoot; the current post fills the frame behind it, blurred and dimmed, crossfading each snap so the backdrop colour follows the content.',
  tags: ['phone', 'device', 'mockup', 'social', 'feed', 'scroll', 'app', 'blur backdrop', 'instagram'],
  ref: 'original',
  params: base({
    K: P.num('Posts per loop', 10, 3, 16),
    snapEase: P.choice('Snap ease', 'overshoot', ['overshoot', 'spring', 'smooth', 'snappy']),
    bgBlur: P.num('Backdrop blur', 5, 0, 6, '', 0.5),
    bgDim: P.num('Backdrop brightness', 0.35, 0.05, 1, '', 0.05),
    phoneScale: P.num('Phone scale', 1, 0.6, 1.15, '', 0.05),
  }),
  shadow: true, shadowOpacity: 0.55, duration: 12, background: '#0a0a0c',
  camera() { return { perspective: 22 }; },
  layout(ctx) {
    const { u, n, M, p } = ctx;
    const K = Math.max(1, Math.round(p.K)); const ease = SNAPS[p.snapEase] || SNAPS.overshoot;
    const med = (j) => M.mod(M.mod(j, K), n);
    // ---- scroll clock: one snap per beat, ~40% move / 60% hold
    const MOVE = 0.4; const b = u * K; const k = Math.floor(b + 1e-9); const f = b - k; const q = M.clamp(f / MOVE, 0, 1);
    const s = k + ease(q);                                   // scroll position in posts
    const fade = E.inOutSine(M.clamp((f - 0.08) / 0.5, 0, 1)); // backdrop crossfade, a touch behind the scroll

    // ---- phone size / pose (front-on, tiny breathing sway)
    const I = ctx.device('phone'); const A = I.screenAspect;
    const H = p.phoneScale * Math.min(0.92 * ctx.inner.h, (0.68 * ctx.view.w) / I.aspect);
    const W = H * I.aspect; const sw = Math.sin(u * M.TAU), cw = Math.cos(u * M.TAU);
    const kick = Math.sin(Math.PI * M.clamp(f / (MOVE * 0.7), 0, 1)) * (f < MOVE ? 1 : 0);   // small push on each flick

    // ---- screen content (screen fractions: x,y in -.5..5 (y up); w of screen width, h of screen height)
    const sc = [];
    const wOf = (hFrac) => hFrac / A;                         // width fraction for a square of given height fraction
    const flat = (o) => ({ useMedia: false, ...o });
    const circ = (x, y, d, color, extra = {}) => flat({ x, y, w: wOf(d), h: d, color, radius: 0.5, ...extra });
    const bar = (x0, y, wf, hf, color) => flat({ x: x0 + wf / 2, y, w: wf, h: hf, color, radius: 0.5 });
    const icon = (x, y, d, shape, on, pop = 1) => flat({ x, y, w: wOf(d * pop), h: d * pop, color: on ? LIKE : BG, radius: 0,
      shapeMask: { shape, p: shape === 'heart' ? 0.4 : shape === 'diamond' ? 0.5 : 0.62, soft: 0.02, outline: on ? 0 : 0.09, outlineColor: INK } });
    const mw = 0.94, mh = (mw * A) / 0.8;                     // 4:5 media card
    const HDR = 0.058, ACT = 0.05, CAP = 0.052, GAP = 0.024; const PITCH = HDR + mh + ACT + CAP + GAP;
    const TOP = 0.405, L = -0.5 + (1 - mw) / 2;              // current post's top edge; left margin
    const rad = Math.max(0.02, (p.cornerRadius / 100) * 1.1);
    const tLike = MOVE + 0.12;                                // heart pops on the settled post
    for (let j = k - 1; j <= k + 2; j++) {
      const top = TOP + (s - j) * PITCH; if (top - PITCH > 0.5 || top < -0.5) continue;
      const pal = AVA[M.mod(j, K) % AVA.length];
      const hy = top - HDR / 2; const ad = 0.034;
      // header: story-ring avatar, name + subline, menu dots
      sc.push(circ(L + wOf(ad) / 2 + 0.01, hy, ad, '#ff6a3d'));
      sc.push(circ(L + wOf(ad) / 2 + 0.01, hy, ad * 0.84, BG));
      sc.push(circ(L + wOf(ad) / 2 + 0.01, hy, ad * 0.68, pal));
      const nx = L + wOf(ad) + 0.04; const nw = 0.2 + 0.14 * M.rand(M.mod(j, K), 3);
      sc.push(bar(nx, hy + 0.0065, nw, 0.0095, INK));
      sc.push(bar(nx, hy - 0.0085, nw * 0.62, 0.007, DIM));
      for (let d = 0; d < 3; d++) sc.push(circ(0.5 - (1 - mw) / 2 - 0.02 - d * 0.03, hy, 0.0055, INK));
      // media card
      const my = top - HDR - mh / 2;
      sc.push({ media: med(j), x: 0, y: my, w: mw, h: mh, radius: rad, zoom: 1.04 });
      // action row
      const ay = top - HDR - mh - ACT / 2; const id = 0.022;
      const cur = k + 1;                                      // post that settles during this beat
      const liked = j < cur || (j === cur && f >= tLike);
      const lp = j === cur ? M.clamp((f - tLike) / 0.12, 0, 1) : 0; const pop = 1 + 0.38 * Math.sin(Math.PI * lp);
      sc.push(icon(L + wOf(id) / 2 + 0.005, ay, id, 'heart', liked, pop));
      sc.push(icon(L + wOf(id) * 1.5 + 0.06, ay, id * 0.95, 'circle', false));
      sc.push(icon(L + wOf(id) * 2.5 + 0.115, ay, id, 'diamond', false));
      sc.push(flat({ x: 0.5 - (1 - mw) / 2 - wOf(id) * 0.3, y: ay, w: wOf(id) * 0.62, h: id, color: BG, radius: 0,
        shapeMask: { shape: 'square', p: 0.62, outline: 0.11, outlineColor: INK, soft: 0.02 } }));
      // caption bars
      const cy = top - HDR - mh - ACT;
      sc.push(bar(L + 0.005, cy - 0.012, 0.3, 0.0085, INK));
      sc.push(bar(L + 0.005, cy - 0.03, 0.55 + 0.3 * M.rand(M.mod(j, K), 7), 0.0075, MUTE));
      sc.push(bar(L + 0.005, cy - 0.045, 0.35 + 0.2 * M.rand(M.mod(j, K), 9), 0.0075, MUTE));
    }
    // fixed chrome: app header (over the feed), tab bar, status bar
    sc.push(flat({ x: 0, y: 0.5 - 0.047, w: 1, h: 0.094, color: BG, radius: 0 }));
    sc.push({ text: 'Feed', h: 0.019, weight: 800, color: INK, x: -0.33, y: 0.428 });
    sc.push(icon(0.27, 0.428, 0.02, 'heart', false));
    sc.push(icon(0.38, 0.428, 0.02, 'diamond', false));
    sc.push(bar(-0.42, 0.477, 0.1, 0.008, INK));                       // clock
    sc.push(bar(0.3, 0.477, 0.11, 0.008, INK));                        // signal + battery
    sc.push(flat({ x: 0, y: -0.5 + 0.04, w: 1, h: 0.08, color: '#101014', radius: 0 }));
    sc.push(flat({ x: 0, y: -0.5 + 0.0805, w: 1, h: 0.0012, color: '#24242b', radius: 0 }));
    const tabs = ['square', 'circle', 'plus', 'heart', 'circle'];
    tabs.forEach((sh, i) => sc.push(i === 4 ? circ(-0.4 + i * 0.2, -0.5 + 0.047, 0.02, '#c9c9d2')
      : icon(-0.4 + i * 0.2, -0.5 + 0.047, 0.02, sh, false)));
    sc.push(bar(-0.17, -0.5 + 0.012, 0.34, 0.005, INK));               // home indicator

    // ---- backdrop: current post fills the frame, blurred + dimmed, crossfading with the snap
    const ff = ctx.fullFrame(-0.6, 1.1); const bz = 1.08 + 0.02 * cw;
    const out = [];
    out.push({ ...ff, media: med(k), media2: med(k + 1), mix: fade, mixMode: 'fade', blur: p.bgBlur, bright: p.bgDim, sat: 1.15,
      zoom: bz, radius: 0, shadow: 0, layer: 0 });
    // soft vignette + a pool of darkness behind the phone so it lifts off the backdrop
    out.push({ light: { type: 'radial', stops: [[0, '#000000', 0], [0.55, '#000000', 0.08], [1, '#000000', 0.42]] }, blend: 'normal',
      ...ctx.fullFrame(-0.5, 1.15), layer: 1 });
    out.push({ light: { type: 'radial', stops: [[0, '#000000', 0.45], [1, '#000000', 0]] }, blend: 'normal',
      x: 0, y: -0.02, z: -0.3, w: W * 2.6, h: H * 1.5, layer: 2 });
    out.push({ device: 'phone', w: W, x: 0, y: 0.008 * sw - 0.004 * kick, z: 0.006 * kick, rx: -0.025 * cw, ry: 0.05 * sw, rz: 0,
      screenColor: BG, screenCards: sc, gloss: 0.08, layer: 3, shadow: 0.6 });
    return out;
  },
};
