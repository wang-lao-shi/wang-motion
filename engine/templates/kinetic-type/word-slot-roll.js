// word-slot-roll — original. Kinetic type: a static line "MAKE IT ▢" whose last word is a slot-machine reel.
// Once per beat the reel spins through a motion-blurred column of words and locks on the next word with an overshoot.
// Words sit on a drum (y = R·sinθ, card tilted rx = −θ so it squashes and darkens toward the window edges). Motion blur
// = dense Hann-weighted ghost copies along the drum, spaced ≤ ~0.003 frame heights so no steps show (the engine
// dirBlur only blurs a card's media colour, not a glyph card's SDF alpha, so it cannot smear text). The word window is clipped top/bottom by
// background-coloured occluder cards with soft fade edges (glyph cards have no rect mask in world space), so rolling
// words slide cleanly in and out. Beside it (16:9: side by side; 1:1 / 9:16: text stacked over media) a media card
// swaps with a vertical push driven by the SAME reel curve: the card is cut into two uv slices (outgoing / incoming)
// that each keep their own rounded corners, and the reel's overshoot carries the whole card into a small dip.
import { base, P } from '../_common.js';
import { E } from '../../lib.js';

const outBackS = (t, s) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
// outBack constant whose overshoot is `o` (fraction of travel): max overshoot = 4 s^3 / (27 (s+1)^2)
const _sCache = new Map();
function backFor(o) {
  const key = o.toFixed(5); if (_sCache.has(key)) return _sCache.get(key);
  let lo = 0, hi = 6; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; (4 * m ** 3) / (27 * (m + 1) ** 2) < o ? (lo = m) : (hi = m); }
  _sCache.set(key, lo); return lo;
}
const WORD_RE = /[,|]/;
const S = 6;              // words passed per roll (slot spin length)
const RD = 0.4;           // roll length (share of the beat) → hold 60% (elastic: 0.55 → hold 45%)
const GSTEP = 0.002;      // max ghost spacing (frame heights): 0.6 px at 300 px, 1.2 px at 600 px
const GMAX = 64;          // max ghost copies per word
const SPMAX = 0.13;       // max blur spread (frame heights)

export default {
  id: 'word-slot-roll', name: 'Word Slot Roll', category: 'kinetic-type',
  slots: 12,
  desc: 'Static line "MAKE IT ▢" whose last word rolls like a slot-machine reel each beat (motion-blurred column, overshoot lock); a media card swaps beside it with a vertical push synced to the roll.',
  tags: ['kinetic type', 'typography', 'slot machine', 'word roll', 'text', 'reel', 'promo', 'social', 'push'],
  ref: 'original',
  params: base({
    prefix: P.text('Static text', 'MAKE IT'),
    words: P.text('Rolling words (comma separated)', 'BOLD,LOUD,MOVE,YOURS,REAL,SHINE'),
    K: P.num('Beats per loop', 12, 2, 24),
    rollEase: P.choice('Lock easing', 'overshoot', ['overshoot', 'elastic', 'snappy', 'smooth']),
    mediaSide: P.choice('Media position', 'auto', ['auto', 'right', 'left', 'below', 'above']),
    accent: P.color('Word colour', '#ffcf3a'),
  }),
  usesTitle: true,
  shadow: true, shadowOpacity: 0.5,
  background: '#0c0c10',
  duration: 16,
  camera: () => ({ fov: 2 }),   // near-orthographic: the drum tilt reads as a clean cos θ squash, no keystone
  layout(ctx) {
    const { p, u, n, inner, M } = ctx;
    const K = Math.max(2, Math.round(p.K));
    const prefix = String(ctx.title || p.prefix || '').trim();
    let words = Array.isArray(p.words) ? p.words : String(p.words ?? '').split(WORD_RE);
    words = words.map((w) => String(w).trim()).filter((w) => w.length);
    if (!words.length) words = ['BOLD'];
    const nw = words.length;
    const accent = p.accent || '#ffcf3a';
    const bg = ctx.spec?.background?.color || ctx.spec?.background?.colors?.[0] || '#0c0c10';
    const WW = 900, PW = 800, RP = 0.56;           // word / prefix weights, prefix cap = RP × word cap

    // ---------- timing: u=0 sits in the hold (never mid-roll) ----------
    const x = u * K + 0.75; const j = Math.floor(x); const f = x - j;
    const ease = p.rollEase || 'overshoot';
    const rd = ease === 'elastic' ? 0.55 : RD;
    const q = M.clamp(f / rd, 0, 1);
    const warp = (t) => Math.pow(t, 1.45);       // pull-in: reel accelerates instead of jumping to full speed
    const g = (t) => {
      t = M.clamp(t, 0, 1); const w = warp(t);
      if (ease === 'snappy') return E.outExpo(w);
      if (ease === 'smooth') return E.inOutQuart(t);
      if (ease === 'elastic') {                  // spin to the overshoot at w1, then a damped spring: 2 visible bounces
        const A = 0.22 / S, w1 = 0.42;   // 0.22-word overshoot (≤ clip budget 0.27), then −0.10, +0.045
        if (w < w1) { const s1 = w / w1; return (1 + A) * (1 - Math.pow(1 - s1, 3)); }
        const tau = w - w1, om = 15.7, d = 4.0;
        return 1 + A * Math.exp(-d * tau) * (Math.cos(om * tau) + (d / om) * Math.sin(om * tau)) * (1 - M.smooth(0.82, 1, w));
      }
      return outBackS(w, backFor(0.2 / S));      // 0.2-word overshoot on the lock (keeps the next word clear of the clip)
    };
    const gq = g(q);
    const vel = (g(Math.min(1, q + 0.004)) - g(Math.max(0, q - 0.004))) / ((Math.min(1, q + 0.004) - Math.max(0, q - 0.004)) || 1); // d g / d q
    const sReel = (j - 1) * S + S * gq;                  // reel position in word slots
    const widx = (b) => M.mod(M.mod(b, K), nw);    // locked word for beat b
    const wordAt = (m) => {
      const b = Math.floor(m / S), r = m - b * S;
      if (r === 0) return words[widx(b)];
      if (nw < 3) return words[M.mod(widx(b) + r, nw)];
      const a = words[widx(b)], c2 = words[widx(b + 1)];
      let c = Math.floor(M.rand(M.mod(b, K) * S + r, 3.1) * nw);
      for (let t = 0; t < 3 && (words[c] === a || words[c] === c2); t++) c = (c + 1) % nw;
      return words[c];
    };

    // ---------- layout ----------
    let side = p.mediaSide || 'auto';
    if (side === 'auto') side = (ctx.view.w / ctx.view.h) >= 1.25 ? 'right' : 'below';
    const stacked = side === 'below' || side === 'above';
    // prefix metrics per word: one card per space-separated run (a single word card is capped at the 2048-px atlas
    // width, ≈ 16 caps; a long mixed CJK + Latin prefix as ONE card lost its last glyphs)
    const PG = prefix ? ctx.glyphs(prefix, { h: 1, weight: PW }) : null;
    const Lp = PG ? PG.width : 0;
    const wW = words.map((w) => ctx.glyphs(w, { h: 1, weight: WW }).width);
    const srt = [...wW].sort((a, b) => a - b);
    const Lmed = srt[Math.floor((srt.length - 1) / 2)] * 0.5 + srt[Math.floor(srt.length / 2)] * 0.5;
    const Lw = Math.max(...wW);
    // h sizes to the MEDIAN word (never so big that the longest word must shrink below 62%); a long prefix may shrink to
    // 55% of its nominal size before it limits the word size
    const unitW = Math.max(RP * Lp * 0.55, Lmed, Lw * 0.62);
    // text block metrics in units of word cap h (relative to window centre yW)
    const M_ = 0.07, SOFT = 0.22, PITCH = 1.75;    // window margin, soft fade, reel pitch (× h, arc length on the drum)
    const RD_ = 1.6;                               // drum radius (× h)
    const barGap = 0.32, barT = 0.075;
    const topU = prefix ? 0.5 + 0.55 + RP : 0.5 + M_ + SOFT;       // prefix cap top above yW
    const botU = 0.5 + barGap + barT;                               // underline bottom below yW
    let h, yW, txtCx, align, Wm, Hm, mx, my, colMax;
    if (!stacked) {
      Hm = inner.h * 0.94; Wm = Hm * 0.8;
      if (Wm > inner.w * 0.42) { Wm = inner.w * 0.42; Hm = Wm / 0.8; }
      const gapC = inner.w * 0.07;
      const colW = inner.w - Wm - gapC;
      h = Math.min(colW / unitW, inner.h / (topU + botU) * 0.9, 0.3);
      colMax = colW;
      const sgn = side === 'right' ? 1 : -1;
      mx = sgn * (inner.w / 2 - Wm / 2); my = 0;
      txtCx = -sgn * (inner.w / 2 - colW / 2);
      yW = -(topU - botU) / 2 * h;
      align = 'left';
    } else {
      const gapT = inner.h * 0.06;
      h = Math.min(inner.w * (ctx.view.w / ctx.view.h > 0.8 ? 0.74 : 0.92) / unitW, inner.h * 0.2);
      h = Math.max(h, Math.min(0.055, inner.h * 0.2));             // reel window never below ~5.5% of the frame
      colMax = ctx.view.w / ctx.view.h > 0.8 ? inner.w : Math.max(inner.w, ctx.view.w * 0.94);   // portrait: words may use 94% of the width
      const T = (topU + botU) * h;
      const avail = inner.h - T - gapT;
      const ar = M.clamp(inner.w / avail, 0.78, 1.6);
      Wm = Math.min(inner.w, avail * ar); Hm = Wm / ar;
      const tot = T + gapT + Hm;
      const top = tot / 2;
      mx = 0; txtCx = 0;
      if (side === 'below') { yW = top - topU * h; my = -top + Hm / 2; }
      else { my = top - Hm / 2; yW = -top + botU * h; }
      align = 'center';
    }
    const ph = RP * h * Math.min(1, colMax / Math.max(1e-6, RP * Lp * h));   // prefix cap (shrinks only if it would overflow)
    // over-long words: shrink to the column; if that would drop the cap below CAPMIN of the frame (EXTRAORDINARY at 9:16),
    // squeeze horizontally (≥ 0.8) instead: ry = acos(sx) on a near-orthographic camera, with a counter-shear so the drum tilt
    // (rx) does not slant it
    const CAPMIN = 0.055, ct = Math.min(h, CAPMIN);
    const sxW = wW.map((L) => (L * h <= colMax || colMax / L >= ct) ? 1 : Math.max(0.8, colMax / L / ct));
    const ws = wW.map((L, i) => Math.min(1, colMax / (L * h * sxW[i])));
    const wDisp = wW.map((L, i) => L * h * ws[i] * sxW[i]);
    const blockW = Math.max(Lp * ph, ...wDisp);
    const leftX = txtCx - blockW / 2;
    const xOf = (i) => (align === 'left' ? leftX + wDisp[i] / 2 : txtCx);
    const cards = [];

    // ---------- reel on a drum ----------
    const pitch = PITCH * h, R = RD_ * h, dTh = pitch / R;          // slot angle on the drum
    const fps = ctx.spec?.fps || 30, dur = ctx.dur || 16;
    const fpb = fps * dur / K;                                  // frames per beat
    const dsFrame = (q > 0 && q < 1) ? Math.abs(S * vel) / (rd * fpb) : 0; // reel slots per frame
    // blur spread (in slots) ~ 0.6 shutter of the per-frame travel, capped in frame heights; Hann weights → no hard ends
    const spS = Math.min(dsFrame * 0.6 * 1.6, 1.2, SPMAX / pitch);
    const NGk = spS * pitch < 0.004 ? 1 : M.clamp(Math.ceil((spS * pitch) / GSTEP) + 1, 4, GMAX);
    const gw = []; { let sw = 0; for (let k = 0; k < NGk; k++) { const t = (k + 0.5) / NGk; const v = NGk === 1 ? 1 : Math.sin(Math.PI * t) ** 2; gw.push(v); sw += v; } for (let k = 0; k < NGk; k++) gw[k] /= sw; }
    const ga = []; { let tail = 0; for (let k = NGk - 1; k >= 0; k--) { ga[k] = gw[k] / Math.max(1e-6, 1 - tail); tail += gw[k]; } } // composite weights in draw order
    const visTop = (0.5 + M_ + SOFT) * h;
    const m0 = Math.floor(sReel);
    for (let m = m0 - 2; m <= m0 + 3; m++) {
      const wd = wordAt(m); const wi = Math.max(0, words.indexOf(wd));
      const hw = h * ws[wi], gx = xOf(wi), sx = sxW[wi], sphi = Math.sqrt(Math.max(0, 1 - sx * sx));
      for (let k = 0; k < NGk; k++) {
        const off = NGk === 1 ? 0 : (k / (NGk - 1) - 0.5) * spS;
        const th = (m - sReel + off) * dTh;
        if (Math.abs(th) > 1.45) continue;
        const cth = Math.cos(th), y = yW + R * Math.sin(th);
        if (Math.abs(y - yW) - 0.5 * hw * cth > visTop + 0.01) continue;   // fully behind an occluder
        const sq = sx < 0.999 ? { ry: Math.acos(sx), order: 'XYZ', shear: sphi * Math.tan(th) } : null;
        cards.push({ text: wd, weight: WW, h: hw, x: gx, y, z: 0, rx: -th, ...sq, color: accent, bright: 0.5 + 0.5 * cth,
          opacity: ga[k] * M.smooth(0.62, 0.9, cth), layer: 1 + k, depthWrite: false, shadow: 0 });
      }
    }
    // occluders: background-coloured, soft edge toward the window; drawn over the tilted words regardless of depth
    const occW = blockW + h * 1.2, occH = 1.4;
    const wt = yW + (0.5 + M_) * h, wb = yW - (0.5 + M_) * h;
    const occX = align === 'left' ? leftX + blockW / 2 : txtCx;
    const sf = (SOFT * h) / occH;
    cards.push({ color: bg, useMedia: false, x: occX, y: wt + occH / 2, z: 0, w: occW, h: occH, radius: 0, shadow: 0, layer: 60, depthTest: false, depthWrite: false,
      fade: { angle: -Math.PI / 2, from: 1 - sf, to: 1 } });
    cards.push({ color: bg, useMedia: false, x: occX, y: wb - occH / 2, z: 0, w: occW, h: occH, radius: 0, shadow: 0, layer: 60, depthTest: false, depthWrite: false,
      fade: { angle: Math.PI / 2, from: 1 - sf, to: 1 } });

    // underline that resizes to the locked word, synced to the push
    const pm = Math.min(gq, 1);
    const wa = wDisp[widx(j - 1)], wb2 = wDisp[widx(j)] ?? wa;
    const bw = (wa + (wb2 - wa) * E.inOutCubic(M.clamp(pm, 0, 1)));
    const barY = yW - (0.5 + barGap + barT / 2) * h;
    const barX = align === 'left' ? leftX + bw / 2 : txtCx;
    cards.push({ color: accent, useMedia: false, x: barX, y: barY, z: 0, w: bw, h: barT * h, radius: 0.5, shadow: 0, layer: 61 });
    // static prefix: one card per word run
    if (PG) {
      const py = yW + (0.5 + 0.55 + RP / 2) * h;
      const pcx = align === 'left' ? leftX + Lp * ph / 2 : txtCx;
      for (const wd of PG.words) cards.push({ text: wd.text, weight: PW, h: ph, x: pcx + wd.x * ph, y: py, z: 0, color: '#f4f4f6', layer: 62 });
    }

    // ---------- media card: vertical push in two uv slices ----------
    const mediaOf = (b) => M.mod(M.mod(b, K), n);
    const gap = Math.min(Wm, Hm) * 0.045;
    const D = Hm + gap;
    const dip = Math.max(0, gq - 1) * D;  // reel overshoot carries the whole card down
    const cy = my - dip;
    const yt = cy + Hm / 2, yb = cy - Hm / 2;
    const o = M.clamp(gq, 0, 1) * D;
    const zoomOf = (age) => 1.07 - 0.06 * E.outSine(M.clamp(age / 1.6, 0, 1));  // slow settle-in push per card
    const vMed = (q > 0 && q < 1) ? Math.abs(vel) * D / (rd * fpb) : 0;          // world units per frame
    const blurAmt = Math.min(0.22, vMed * 0.5 / Math.max(Wm, Hm));
    const slice = (media, vb, vt, virtB, age, layer, extra = {}) => {
      if (vt - vb < 0.002) return;
      const c = { media, x: mx, y: (vb + vt) / 2, z: 0, w: Wm, h: vt - vb, fullAspect: Wm / Hm,
        uv: [0, (vb - virtB) / Hm, 1, (vt - virtB) / Hm], zoom: zoomOf(age), layer, ...extra };
      if (blurAmt > 0.01) c.dirBlur = { amt: blurAmt, angle: Math.PI / 2 };
      cards.push(c);
    };
    if (o <= 0.0001) slice(mediaOf(j - 1), yb, yt, yb, x - (j - 1), 63);
    else {
      // outgoing (beat j-1) slides down out of the window; incoming (beat j) follows from above
      const ob = yb - o; slice(mediaOf(j - 1), yb, Math.min(yt, ob + Hm), ob, x - (j - 1), 63, { bright: 1 - 0.3 * M.clamp(o / D, 0, 1) });
      const ib = yt + gap - o; slice(mediaOf(j), Math.max(yb, ib), yt, ib, x - j, 64);
    }

    const post = { leak: { amount: 0.06, color: accent, x: 0.5 + mx / ctx.view.w, y: 0.5 + my, r: 0.6 } };
    return { cards, post };
  },
};
