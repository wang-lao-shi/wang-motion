import { base, P, reflect } from '../_common.js';
import { cells } from './_grid.js';
// HIDDEN test template (underscore = not listed): 4x4 grid, one X5/X10 card effect per cell, animated over the loop.
//   wm still _fxtest --res 360 --at 0.25,0.6
//   --param mode=shapes  -> every shapeMask shape at p=1 (must cover the card fully) / p=0.5 / outline+invert
//   --param mode=mirror  -> floor reflections via reflect()
const NAMES = ['mix dissolve', 'mix swirl', 'dissolve', 'displace wave', 'displace swirl', 'pixelate', 'rgbSplit', 'dirBlur',
  'radialBlur', 'foil', 'smear', 'CRT scan+barrel', 'shape star', 'shape heart', 'shape hex', 'fade + mirrorY'];
const SHAPES = ['circle', 'diamond', 'hexagon', 'star', 'heart', 'plus', 'square'];
export default {
  id: '_fxtest', name: 'FX Test', category: 'grid', slots: 12,
  desc: 'hidden: X5 / X10 card-effect test grid', tags: ['test'], ref: 'original',
  params: base({ gap: P.pct('Gap', 3, 0, 20), mode: P.choice('Mode', 'all', ['all', 'more', 'shapes', 'sweep', 'mirror']) }),
  shadow: false, defaultRatio: '1:1', duration: 8, radiusMode: 'card',
  names: NAMES,
  layout(ctx) {
    const { p, n, u, M } = ctx;
    const tri = 0.5 - 0.5 * Math.cos(u * M.TAU);         // 0 -> 1 -> 0 over the loop (u=.25 -> .5, u=.6 -> .9)
    if (p.mode === 'mirror') {
      const I = ctx.inner, w = I.w / 3.6, out = [];
      for (let k = 0; k < 3; k++) {
        const c = { media: k, x: (k - 1) * w * 1.2, y: 0.12, w, h: w * 0.75, ry: (k - 1) * 0.5, rx: k === 2 ? -0.25 : 0 };
        out.push(c, reflect(c, { opacity: 0.45, fade: k === 1 ? 0.5 : 0.8 }));
      }
      return out;
    }
    if (p.mode === 'more') {    // every mixMode at mix = tri, the other displace types, duotone, tint, fade via mask:{type:'fade'}
      const list = cells(ctx, 4, 4, p.gap);
      const MM = ['fade', 'dissolve', 'luma', 'displace', 'blocks', 'ripple', 'swirl'];
      return list.map((c, i) => {
        const k = { media: M.mod(i, n), x: c.x, y: c.y, w: c.w, h: c.h };
        if (i < 7) return { ...k, media2: M.mod(i + 5, n), mix: tri, mixMode: MM[i] };
        if (i < 11) return { ...k, displace: { type: ['ripple', 'noise', 'heat', 'wave'][i - 7], amp: [0.03, 0.05, 0.04, 0.03][i - 7], phase: u * 3 } };
        if (i === 11) return { ...k, duotone: ['#1a0a40', '#ffd27a', tri] };
        if (i === 12) return { ...k, tint: { color: '#40a0ff', amt: tri } };
        if (i === 13) return { ...k, mask: { type: 'fade', angle: 0, from: 0.3, to: 0.7 } };
        if (i === 14) return { ...k, dissolve: { p: tri * 0.7, scale: 12, edge: 0.05 } };
        return { ...k, media2: M.mod(i + 5, n), mix: tri, mixMode: 'dissolve', mixOpts: { scale: 2, edgeColor: '#ffffff', glow: 0.8 }, pixelate: 24 };
      });
    }
    if (p.mode === 'sweep') {   // rows: star, heart, plus, hexagon ; columns p = .25 .5 .75 1 (col 4 must be a full card)
      const list = cells(ctx, 4, 4, p.gap); const out = []; const SW = ['star', 'heart', 'plus', 'hexagon'];
      list.forEach((c, i) => {
        out.push({ color: '#ff0040', useMedia: false, x: c.x, y: c.y, w: c.w, h: c.h, layer: 0, radius: 0 });
        out.push({ media: M.mod(i, n), x: c.x, y: c.y, z: 0.001, w: c.w, h: c.h, layer: 1, radius: 0, shapeMask: { shape: SW[Math.floor(i / 4)], p: (i % 4 + 1) / 4 } });
      });
      return out;
    }
    if (p.mode === 'shapes') {
      const list = cells(ctx, 4, 4, p.gap); const out = [];
      list.forEach((c, i) => {
        const row = Math.floor(i / 4), col = i % 4;
        // rows 0-1: 7 shapes at p=1 (should be full cards) + 1 at p=0 inverted (full card);  rows 2-3: p=0.5 / outline + invert
        let sh;
        if (i < 7) sh = { shape: SHAPES[i], p: 1 };
        else if (i === 7) sh = { shape: 'star', p: 0, invert: true };
        else if (i < 15) sh = { shape: SHAPES[i - 8], p: 0.5, outline: 0.04, outlineColor: '#ffcc33', rot: i === 11 ? u * M.TAU / 5 : 0 };
        else sh = { shape: 'heart', p: 0.5, invert: true, outline: 0.03 };
        out.push({ color: '#ff0040', useMedia: false, x: c.x, y: c.y, w: c.w, h: c.h, layer: 0, radius: 0 });   // red backing: any hole shows red
        out.push({ media: M.mod(i, n), x: c.x, y: c.y, z: 0.001, w: c.w, h: c.h, layer: 1, shapeMask: sh });
        void row; void col;
      });
      return out;
    }
    const list = cells(ctx, 4, 4, p.gap);
    return list.map((c, i) => {
      const k = { media: M.mod(i, n), x: c.x, y: c.y, w: c.w, h: c.h };
      switch (i) {
        case 0: return { ...k, media2: M.mod(i + 1, n), mix: tri, mixMode: 'dissolve', mixOpts: { edgeColor: '#ffb040' } };
        case 1: return { ...k, media2: M.mod(i + 1, n), mix: tri, mixMode: 'swirl' };
        case 2: return { ...k, dissolve: { p: tri * 0.9, edgeColor: '#40e0ff', scale: 6 } };
        case 3: return { ...k, displace: { type: 'wave', amp: 0.06, phase: u * 2 } };
        case 4: return { ...k, displace: { type: 'swirl', amp: 3 * tri } };
        case 5: return { ...k, pixelate: 4 + 40 * (1 - tri) };
        case 6: return { ...k, rgbSplit: { amt: 0.04 * tri, angle: u * M.TAU } };
        case 7: return { ...k, dirBlur: { amt: 0.25 * tri, angle: 0 } };
        case 8: return { ...k, radialBlur: { amt: 0.35 * tri } };
        case 9: return { ...k, foil: 0.9, ry: Math.sin(u * M.TAU) * 0.6, rx: 0.2 };
        case 10: return { ...k, smear: { amt: 0.5 * tri, seed: Math.floor(u * 24), block: 0.08, scale: 0.2 }, rgbSplit: { amt: 0.015 * tri } };
        case 11: return { ...k, scan: { amt: 0.7, lines: 60, roll: u * 4 }, barrel: 0.35, tint: ['#a0ffb0', 0.4] };
        case 12: return { ...k, shapeMask: { shape: 'star', p: tri, rot: u * M.TAU / 5, outline: 0.03 } };
        case 13: return { ...k, shapeMask: { shape: 'heart', p: tri, outline: 0.03, outlineColor: '#ff4080' } };
        case 14: return { ...k, shapeMask: { shape: 'hexagon', p: tri, invert: true } };
        default: return { ...k, mirrorY: true, fade: { angle: u * M.TAU, from: 0.2, to: 0.9 } };
      }
    });
  },
};
