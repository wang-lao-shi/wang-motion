// glitch-cut-slideshow — original. Full-bleed slideshow with hard cuts. Each cut is wrapped in a
// short, frame-quantised digital glitch burst (post-FX glitch: band + block displacement, RGB split,
// scanline jitter, rare inverted blocks; optional VHS tracking band). Around the cut the two images
// interleave as data blocks for a frame or two (A → A/B blocks → B → B/A remnant → B) so the cut
// "stutters" like a corrupted stream instead of whipping or zooming. Holds stay clean with a slow
// push-in; a few beats get a single faint pre-glitch flicker late in the hold.
// Deterministic: every glitch seed = (cut index mod K, frame-in-burst), no time input. u = 0 sits
// mid-hold, so the loop point is never a cut.
import { base, P } from '../_common.js';
import { E } from '../../lib.js';

export default {
  id: 'glitch-cut-slideshow', name: 'Glitch Cuts', category: 'glitch',
  slots: 12,
  desc: 'Full-bleed slideshow with hard cuts wrapped in a crisp 6-frame digital glitch burst: block displacement, RGB split, scanline jitter, data-block interleave of the two images, optional VHS tracking band; clean holds with a slow push.',
  tags: ['glitch', 'slideshow', 'cut', 'digital', 'rgb split', 'vhs', 'datamosh', 'full-frame', 'edit'],
  ref: 'original',
  params: base({
    padding: P.padding(0),
    K: P.num('Images per loop', 12, 2, 24),
    intensity: P.pct('Glitch intensity', 70, 0, 150),
    burstFrames: P.num('Burst length', 6, 2, 14, ' frames'),
    blockSize: P.pct('Block size', 5, 1, 15),
    vhs: P.bool('VHS tracking', true),
    flicker: P.pct('Pre-cut flickers', 50, 0, 100),
  }),
  shadow: false,
  duration: 24,
  layout(ctx) {
    const { p, u, n, inner, M } = ctx;
    const K = Math.max(2, Math.round(p.K));
    const W = inner.w, H = inner.h;
    const fps = ctx.spec?.fps || 30, dur = ctx.dur || 24;
    const BF = (dur / K) * fps;                         // frames per beat
    const I = (p.intensity ?? 70) / 100;
    const nb = M.clamp(Math.round(p.burstFrames ?? 6), 2, Math.max(2, Math.floor(BF * 0.4)));
    const pre = Math.max(1, Math.round(nb / 3)), aft = nb - pre;   // 6 → 2 before the cut, 4 after
    const blk = M.clamp((p.blockSize ?? 5) / 100, 0.005, 0.2);
    const mediaOf = (j) => M.mod(M.mod(j, K), n);

    const x = u * K + 0.5;                              // mid-hold at u = 0
    const b = Math.floor(x), f = x - b;
    const fs = f * BF + 0.01;                           // frames since this beat's cut
    const ft = (1 - f) * BF - 0.01;                     // frames until the next cut
    let d = null, cut = 0;                              // d = frame offset from the nearest cut (cut frame = 0)
    if (fs < aft) { d = Math.floor(fs); cut = b; }
    else if (ft < pre) { d = -Math.ceil(ft); cut = b + 1; }

    // envelope per burst frame: build-up → peak on the cut → quick decay
    let a = 0, seed = 0;
    if (d !== null) {
      const ci = M.mod(cut, K);
      seed = ci * 37 + (d + pre) * 5 + 1;
      a = d < 0 ? 0.4 + 0.45 * (d + pre + 1) / pre
                : Math.pow(1 - d / aft, 1.4);
      a = Math.min(1, a) * (0.8 + 0.4 * M.rand(ci * 13 + d, 4.1)) * I;
    }

    // rare single-frame pre-glitch flicker inside the hold (about half the beats, last third of the hold)
    const flk = (p.flicker ?? 50) / 100;
    if (d === null && flk > 0) {
      const ci = M.mod(b, K);
      if (M.rand(ci, 7.7) < 0.35 + 0.4 * flk) {
        const at = Math.floor(BF * (0.62 + 0.18 * M.rand(ci, 2.3)));
        const fr = Math.floor(fs);
        if (fr === at || (flk > 0.6 && fr === at + 2)) { a = (0.14 + 0.1 * flk) * I; seed = ci * 37 + 211 + fr; d = 'f'; }
      }
    }

    // clean hold: slow push over the whole beat (the cut hides the reset), tiny alternating drift
    const zoom = 1.08 + 0.055 * (E.inOutSine(0.15 + 0.85 * f) - E.inOutSine(0.15));   // ≥1.08: keeps media edges (and inset frame lines) out of shot
    const dir = (b % 2 ? 1 : -1);
    const ov = (p.padding ?? 0) <= 0.001 ? 1.015 : 1;                                  // overscan: no hairline at the frame edge, glitch shifts never sample past it
    const c = { media: mediaOf(b), x: 0, y: 0, z: 0, w: W * ov, h: H * ov, zoom, panX: dir * 0.006 * (f - 0.5), layer: 1, shadow: 0 };
    if ((p.padding ?? 0) <= 0.001) c.radius = 0;

    // stream stutter around the cut: horizontal slices of the other image punched through, offset in x
    // (d = -1: incoming B slices over A; d = 1: a few A remnants over B). Integer burst frames only.
    const cards = [c];
    if (typeof d === 'number' && I > 0.02 && (d === -1 || d === 1)) {
      const ci = M.mod(cut, K);
      const other = d === -1 ? mediaOf(cut) : mediaOf(cut - 1);
      const ns = d === -1 ? 4 : 2;
      for (let s = 0; s < ns; s++) {
        const r = (k) => M.rand(ci * 29 + s * 7 + (d + 2) * 101, k);
        const sh = blk * (0.6 + 2.2 * r(1.1));             // slice height (frame heights)
        const v0 = M.clamp(r(2.2) * (1 - sh), 0, 1 - sh);   // bottom of slice in uv
        const dx = (r(3.3) - 0.5) * 0.06 * Math.min(1, I) * W;
        cards.push({ media: other, uv: [0, v0, 1, v0 + sh], fullAspect: c.w / c.h, zoom, panX: c.panX,
          x: dx, y: (v0 + sh / 2 - 0.5) * c.h, z: 0, w: c.w, h: sh * c.h, radius: 0, shadow: 0, layer: 2 + s,
          rgbSplit: { amt: 0.008 * Math.min(1, I), angle: 0 } });
      }
    }
    if (d === 0 && I > 0.02) c.rgbSplit = { amt: 0.006 * Math.min(1, I), angle: 0 };

    const post = {};
    if (a > 0.003) {
      const strong = d === 'f' || (typeof d === 'number' && d <= 1);   // block glitch only on the hot frames
      if (strong) post.glitch = { amount: Math.min(0.4, a * 0.36), block: blk, rgb: 0.7, seed };
      else {                                                         // tail: soft slice smear + split on the card, no inverted blocks
        c.smear = { amt: 0.12 * Math.min(1, a / Math.max(I, 0.01)), seed: seed * 0.13, block: blk * 1.4, scale: 0.035 * Math.min(1, I) };
        c.rgbSplit = { amt: 0.006 * a, angle: 0 };
      }
      post.scan = { amount: 0.2 * Math.min(1, a), lines: 180, roll: seed * 0.37 };
      if (typeof d === 'number') {
        post.grade = { sat: 1 - 0.15 * Math.min(1, a), contrast: 1 + 0.1 * Math.min(1, a), bright: 1 + 0.03 * Math.min(1, a) };
        if (p.vhs && d >= 0) {
          const ci = M.mod(cut, K);
          const y0 = 0.25 + 0.5 * M.rand(ci, 9.3);         // band rolls downward through the burst
          post.tracking = { amount: 0.42 * Math.pow(1 - d / aft, 0.8) * Math.min(1, I * 1.2), pos: y0 - d * 0.06, h: 0.045, seed: ci * 11 + d };
        }
        if (d === 0) post.flash = { amount: 0.03 * I, color: '#e8f0ff' };
      }
    }
    return { cards, post };
  },
};
