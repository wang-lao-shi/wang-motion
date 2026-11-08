// title-stagger-rise — original. Kinetic type over a hero card.
// Each beat: the next media card cuts in at 0.82 scale ON TOP of the previous one (which dims behind it) and grows to
// full size with an expo settle + a slight 3D tilt-in; a hairline draws in left→right and the title's glyphs rise from
// below it one by one (per-glyph stagger in ms, outBack overshoot, vertical ghost copies = motion blur). Hold. Then the
// glyphs drop back below the hairline staggered left→right (slight anticipation), the hairline retracts, and the next
// card cuts in. Loop = K beats (media mod n, title mod titles), u=0 sits in a hold.
// Mask: glyph cards have no world-space clip, so every glyph is clipped with its own uv sub-rect: the glyph box geometry
// (padding R+2, ceil'd ascent/descent at 128 px cap height) is re-measured here with the same font stack as the engine,
// so the part of the glyph below the mask line is cut exactly — over the media, without an occluder card.
import { base, P } from '../_common.js';
import { E } from '../../lib.js';

const CAP = 128, PADPX = 16 + 2, ATLAS = 2048;   // engine X1 constants (GLYPH_CAP, GLYPH_R + 2, GLYPH_ATLAS)
const _m = new Map();
let _cv = null;
function stackOf(font) {
  const tail = ['WM Inter', 'WM Noto Sans SC', 'Noto Sans CJK SC', 'Noto Sans SC', 'WenQuanYi Zen Hei', 'Liberation Sans', 'DejaVu Sans'];
  const fam = font === 'Noto Sans SC' ? 'WM Noto Sans SC' : font === 'Inter' ? 'WM Inter' : font;
  return [fam, ...tail.filter((n) => n !== fam)].map((n) => '"' + n + '"').join(', ') + ', sans-serif';
}
// glyph box metrics in px at CAP px cap height: { asc, desc } (ceil'd, as the engine rasterises them)
function boxOf(ch, font, weight) {
  const key = font + '|' + weight + '|' + ch; const hit = _m.get(key); if (hit) return hit;
  let r = { asc: CAP * (/[\u3000-\u9fff]/.test(ch) ? 1.12 : 1), desc: /[gjpqyQ,;()\u3000-\u9fff]/.test(ch) ? CAP * 0.28 : 0 };
  if (typeof document !== 'undefined') {
    _cv ||= document.createElement('canvas').getContext('2d');
    const st = stackOf(font); _cv.font = `${weight} 200px ${st}`;
    const cap200 = _cv.measureText('H').actualBoundingBoxAscent || 145;
    _cv.font = `${weight} ${((CAP * 200) / cap200).toFixed(3)}px ${st}`; _cv.fontKerning = 'normal';
    const mt = _cv.measureText(ch);
    r = { asc: Math.ceil(Math.max(mt.actualBoundingBoxAscent, 1)), desc: Math.ceil(Math.max(mt.actualBoundingBoxDescent, 0)) };
  }
  _m.set(key, r); return r;
}

export default {
  id: 'title-stagger-rise', name: 'Title Stagger Rise', category: 'kinetic-type',
  slots: 12,
  desc: 'Title glyphs rise one by one from below a hairline mask (10–120 ms stagger, overshoot, motion blur) over a hero card that cuts in at 82% and grows to full size; hold; the hairline dims, the card drifts and a sheen passes; glyphs drop out left→right and the next card cuts in on top.',
  tags: ['kinetic type', 'typography', 'title', 'stagger', 'mask', 'reveal', 'promo', 'trailer', 'hero', 'text'],
  ref: 'original',
  params: base({
    text: P.text('Title (| separates per-beat titles)', 'WANG MOTION'),
    weight: P.choice('Weight', '800', ['500', '600', '700', '800', '900']),
    font: P.choice('Font', 'Inter', ['Inter', 'Noto Sans SC']),
    stagger: P.num('Stagger', 35, 10, 120, 'ms'),
    K: P.num('Beats per loop', 10, 2, 24),
    cardSize: P.pct('Card size', 86, 50, 100),
  }),
  usesTitle: true,
  shadow: true, shadowOpacity: 0.5,
  background: '#0b0b0f',
  perspective: 22,
  duration: 20,
  layout(ctx) {
    const { p, u, n, inner, M } = ctx;
    const K = Math.max(2, Math.round(p.K));
    const weight = Number(p.weight) || 800, font = p.font || 'Inter';
    const titles = String(ctx.title || p.text || 'WANG MOTION').split('|').map((s) => s.trim()).filter(Boolean);
    if (!titles.length) titles.push('WANG MOTION');
    const beatDur = (ctx.dur || 20) / K;

    // ---------- timing: f = phase inside the beat; u = 0 is mid-hold ----------
    const x = u * K + 0.55; const j = Math.floor(x); const f = x - j;
    const mediaOf = (b) => M.mod(M.mod(b, K), n);
    const title = titles[M.mod(M.mod(j, K), titles.length)];

    // ---------- hero card ----------
    const cs = M.clamp(p.cardSize / 100, 0.3, 1);
    const CW = inner.w * cs, CH = inner.h * cs;
    const cards = [];
    // hold polish: slow ~1.5° card drift across the beat (pure function of the phase; the card keeps its end pose while it
    // dims behind the next one)
    const drift = (t) => E.inOutSine(M.clamp((t - 0.08) / 0.92, 0, 1)) - 0.5;
    const eIn = E.outExpo(M.clamp(f / 0.5, 0, 1));                  // cut-in growth 0.82 → 1
    const sc = 0.82 + 0.18 * eIn;
    const tilt = (1 - E.outCubic(M.clamp(f / 0.45, 0, 1)));
    const kb = (age) => 1.1 - 0.08 * E.outSine(M.clamp(age / 1.4, 0, 1));
    // soft glow behind the stage
    cards.push({ light: { type: 'radial', stops: [[0, '#8fa8ff', 0.16], [0.5, '#5a4cff', 0.05], [1, '#000000', 0]] }, blend: 'add',
      x: 0, y: 0, z: -0.05, w: ctx.view.w * 1.3, h: 1.3, layer: 0 });
    if (eIn < 0.999) {   // previous card stays behind (full size), dimming as the new one grows over it
      cards.push({ media: mediaOf(j - 1), x: 0, y: 0, z: 0, w: CW, h: CH, zoom: kb(x - (j - 1)), bright: 1 - 0.55 * M.clamp(f / 0.25, 0, 1), ry: 0.026 * drift(1), rx: -0.006 * drift(1), layer: 1 });
    }
    const card = { media: mediaOf(j), x: 0, y: 0, z: 0.002, w: CW * sc, h: CH * sc, rx: 0.16 * tilt - 0.006 * drift(f), ry: 0.026 * drift(f), zoom: kb(f), layer: 2 };
    cards.push(card);
    // legibility: bottom-up dark gradient over the card (same rect → same rounded corners)
    cards.push({ color: '#000000', useMedia: false, x: 0, y: 0, z: 0.003, w: card.w, h: card.h, rx: card.rx, ry: card.ry, shadow: 0, layer: 3,
      opacity: 0.62, fade: { angle: Math.PI / 2, from: 0, to: 0.62 } });
    // hold polish: one soft diagonal sheen sweeps the card during the hold (band = line mask ∩ reversed fade)
    const sq = M.clamp((f - 0.46) / 0.32, 0, 1);
    if (sq > 0 && sq < 1) {
      const sp = -0.25 + 1.5 * E.inOutSine(sq), A = 0.42, bw = 0.07;
      cards.push({ color: '#ffffff', useMedia: false, blend: 'add', x: 0, y: 0, z: 0.0035, w: card.w, h: card.h, rx: card.rx, ry: card.ry, shadow: 0, layer: 4,
        opacity: 0.11 * Math.sin(Math.PI * sq), mask: { type: 'line', angle: A, p: sp + bw, soft: bw * 0.8 }, fade: { angle: A, from: sp, to: sp - bw * 1.6 } });
    }

    // ---------- title metrics (fit inside the card, wrap to 2 lines when it helps) ----------
    const maxW = CW * 0.86;
    const tr = -0.015, lineH = 1.5;
    const one = ctx.glyphs(title, { h: 1, weight, font, tracking: tr });
    let h = Math.min(CH * 0.2, maxW / Math.max(1e-6, one.width));
    let txt = title, wrapW = Infinity;
    const chars = Array.from(title), hasSp = /\s/.test(title);
    const maxLines = inner.w / inner.h < 0.8 ? 3 : 2;               // portrait: allow a 3rd line so long titles stay legible
    if (h < CH * 0.13 && (hasSp || chars.length >= 4)) {
      for (let nL = 2; nL <= maxLines; nL++) {
        if (nL === 3 && h >= CH * 0.06) break;                      // 3 lines only when 2 lines are still too small
        if (!hasSp && chars.length < nL * 2) break;
        let bestN = null;
        const tries = hasSp ? [1.0, 1.08, 1.18, 1.3] : [Infinity];
        for (const fac of tries) {
          let tN, mw;
          if (hasSp) { tN = title; mw = (one.width / nL) * fac; }
          else { const per = Math.ceil(chars.length / nL), parts = []; for (let q = 0; q < chars.length; q += per) parts.push(chars.slice(q, q + per).join('')); tN = parts.join('\n'); mw = Infinity; }
          const wN = ctx.glyphs(tN, { h: 1, weight, font, tracking: tr, maxW: mw, lineH });
          if (wN.lines !== nL) continue;
          const hN = Math.min(CH * 0.17, maxW / wN.width, (CH * 0.56) / (lineH * (nL - 1) + 1));
          if (!bestN || hN > bestN.h) bestN = { h: hN, txt: tN, wrapW: mw === Infinity ? Infinity : wN.width };
        }
        if (bestN && bestN.h > h * 1.15) { h = bestN.h; txt = bestN.txt; wrapW = bestN.wrapW; }
      }
    }
    const L = ctx.glyphs(txt, { h, weight, font, tracking: tr, maxW: wrapW === Infinity ? Infinity : wrapW * h * 1.001 + 1e-6, lineH });
    const k = h / CAP;
    // mask line per text line: just below the deepest descender of that line (tight under caps, lower for g/y/p/CJK)
    const maskOf = []; for (const g of L.glyphs) maskOf[g.line] = Math.max(maskOf[g.line] ?? 0.06 * h, boxOf(g.ch, font, weight).desc * k + 0.05 * h);
    const lastMask = maskOf[L.lines - 1] ?? 0.06 * h;
    const blockBot = -card.h / 2 + Math.max(0.1 * card.h, 0.04) + lastMask;   // last baseline
    const lastLineY = L.glyphs.length ? Math.min(...L.glyphs.map((g) => g.y)) : 0;
    const oy = blockBot + h / 2 - lastLineY;                 // L anchor y (cap middle) → world
    const N = L.glyphs.length;
    // stagger: linear in ms while the whole rise fits; past the knee the total spread eases toward SMAX (never a hard
    // clamp, so 10…120 ms always differ) and the last glyph still lands with ≥40% of the beat left as a full-title hold
    const RISE = 0.14, T0 = 0.05;                            // rise length (beat), rise start
    const OUT0 = 0.84, OUTL = 0.09;                          // drop-out start, drop length
    const KNEE = 0.13, SMAX = 0.25;
    const span0 = ((p.stagger / 1000) / beatDur) * Math.max(0, N - 1);
    const span = span0 <= KNEE ? span0 : KNEE + (SMAX - KNEE) * (1 - Math.exp(-(span0 - KNEE) / (SMAX - KNEE)));
    const st = span / Math.max(1, N - 1);
    const LAND = T0 + span + RISE;                           // last glyph at rest (≤ 0.44)
    const stOut = Math.min(st, (0.97 - OUT0 - OUTL) / Math.max(1, N - 1) + 1e-9);
    const back = (t) => { const s = 1.4; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
    const inBack = (t) => { const s = 1.2; return t * t * ((s + 1) * t - s); };
    const glyphE = (ff, i) => {                              // 0 = hidden below the mask, 1 = rest
      const tIn = M.clamp((ff - T0 - i * st) / RISE, 0, 1), tOut = M.clamp((ff - OUT0 - i * stOut) / OUTL, 0, 1);
      return back(tIn) - inBack(tOut);
    };
    // per-line hairline (mask edge): draws in L→R before the rise, retracts L→R after the drop
    const lines = [];
    for (const g of L.glyphs) { const ln = lines[g.line] ||= { x0: Infinity, x1: -Infinity, y: g.y, md: maskOf[g.line] }; ln.x0 = Math.min(ln.x0, g.x - g.w / 2); ln.x1 = Math.max(ln.x1, g.x + g.w / 2); }
    const hIn = E.inOutCubic(M.clamp((f - 0.005) / 0.12, 0, 1)), hOut = E.inOutCubic(M.clamp((f - OUT0 - 0.01) / 0.12, 0, 1));
    // the hairline is the reveal device, not an underline: it fades to 0.2 once the rise lands and returns before the drop
    const hOp = 0.7 - 0.5 * E.inOutSine(M.clamp((f - LAND - 0.01) / 0.08, 0, 1)) * (1 - E.inOutSine(M.clamp((f - OUT0 + 0.08) / 0.07, 0, 1)));
    for (const ln of lines) {
      if (!ln) continue;
      const a = ln.x0 + (ln.x1 - ln.x0) * hOut, b = ln.x0 + (ln.x1 - ln.x0) * hIn;
      if (b - a < 0.002) continue;
      const yM = oy + ln.y - h / 2 - ln.md;
      cards.push({ color: '#ffffff', useMedia: false, x: (a + b) / 2, y: yM - 0.0015, z: 0.004, w: b - a, h: Math.max(0.0022, h * 0.022), radius: 0.5, shadow: 0, opacity: hOp, layer: 5 });
    }

    // glyphs: uv-clipped below their line's mask, with vertical ghost copies while moving
    const NG = 5;
    const gw = [], ga = []; { let s = 0; for (let q = 0; q < NG; q++) { const v = Math.sin(Math.PI * (q + 0.5) / NG) ** 2; gw.push(v); s += v; } gw.forEach((v, q) => (gw[q] = v / s));
      let tail = 0; for (let q = NG - 1; q >= 0; q--) { ga[q] = gw[q] / Math.max(1e-6, 1 - tail); tail += gw[q]; } }
    const dt = 1 / ((ctx.spec?.fps || 30) * beatDur);        // one frame in beat units
    for (const g of L.glyphs) {
      const bx = boxOf(g.ch, font, weight);
      const chh = Math.min(ATLAS, bx.asc + bx.desc + PADPX * 2);
      const maskD = maskOf[g.line];
      const travel = (bx.asc + PADPX) * k + maskD + 0.04 * h;   // fully below the mask at e = 0
      const ax = g.x, ayRest = oy + g.y;
      const yM = ayRest - h / 2 - maskD;
      const e0 = glyphE(f, g.i);
      if (e0 <= 0.0005) continue;
      // motion-blur spread ≈ 0.9 frame of travel, capped
      const spread = Math.min(Math.abs(glyphE(f + dt * 0.5, g.i) - glyphE(f - dt * 0.5, g.i)) * travel * 0.9, h * 0.28);
      const ng = spread > h * 0.015 ? NG : 1;
      for (let q = 0; q < ng; q++) {
        const off = ng === 1 ? 0 : (q / (ng - 1) - 0.5) * spread;
        const ay = ayRest - (1 - e0) * travel + off;
        // mask line in this glyph's pen px (baseline = 0, y up); box bottom = -(PAD + desc)
        const mPen = (yM - (ay - h / 2)) / k;
        const v0 = (mPen + PADPX + bx.desc) / chh;
        if (v0 >= 0.999) continue;
        // ghost copies that only peek a sliver above the mask read as grey dashes: fade them by how much ink is exposed
        const vis = ng === 1 ? 1 : M.clamp((bx.asc - mPen) / (CAP * 0.45), 0, 1) ** 1.5;
        if (ng > 1 && vis < 0.02) continue;
        cards.push({ text: g.ch, font, weight, h, x: ax, y: ay, z: 0.005, color: '#ffffff', uv: v0 > 0 ? [0, v0, 1, 1] : undefined,
          opacity: ng === 1 ? 1 : ga[q] * vis, layer: 6 + q, shadow: 0 });
      }
    }
    return { cards, post: { leak: { amount: 0.05, color: '#9fb4ff', x: 0.5, y: 0.85, r: 0.7 } } };
  },
};
