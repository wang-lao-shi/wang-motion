import { base, P } from '../_common.js';
import { E } from '../../lib.js';
// Product Launch (original, multiscene). One continuous launch-film loop in four matched scenes:
//   A  phone rises from below and lands straight-on; the shrinking logo drops into its screen as the splash      (u .85 → .01)
//   B  hero beat: 3/4 swing + a light sweep across the glass; the splash gives way to an app screen of 4 tiles   (u .01 → .25)
//   C  the 4 tiles pop OUT of the screen (world cards start exactly on the screen tile rects) into a feature grid
//      (16:9 4×1, 1:1 and 9:16 2×2) while the phone drops away                                                    (u .25 → .58)
//   D  the grid collapses into the app-icon tile; wordmark letters + tagline rise in → logo end card               (u .58 → .85)
//   … and the logo shrinks back into the screen of the rising phone (loop).
// Timeline runs on v = mod(u − .85, 1) so the seam (u = 0 ≡ 1) sits mid-rise and every value is continuous across it.
// Logo = a wordmark (glyph text) + an app-icon tile in the accent colour with its first letter. Tagline = --text (title) or param.
const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (v, a, b) => cl((v - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

export default {
  id: 'product-launch', name: 'Product Launch', category: 'multiscene', slots: 4,
  desc: 'A launch-film loop: a phone rises into a light sweep, its app screen pops out into a feature grid of four shots, the grid collapses into your logo end card, and the logo drops back into the phone.',
  tags: ['multiscene', 'product', 'launch', 'phone', 'device', 'app', 'logo', 'end card', 'promo', 'reveal'],
  ref: 'original',
  params: base({
    logo: P.text('Logo wordmark', 'WANG'),
    tagline: P.text('Tagline', 'Motion, made simple.'),
    accent: P.color('Brand colour', '#6c5cff'),
    deviceColor: P.color('Device colour', '#1d1d20'),
  }),
  usesTitle: true,
  shadow: true, shadowOpacity: 0.45, depthWrite: false, duration: 12, background: '#07070c',
  camera() { return { perspective: 24 }; },
  layout(ctx) {
    const { u, n, M, p, view, inner } = ctx;
    const A = view.w, portrait = A < 0.8, wide = A > 1.3;
    const v = M.mod(u - 0.85, 1);
    const med = (i) => M.mod(i, n);
    const logo = String(p.logo || 'WANG').trim() || 'WANG';
    const tag = String((ctx.titleSpec && ctx.titleSpec.content) || p.tagline || '').trim();
    const accent = p.accent || '#6c5cff';
    const out = [];
    // device colour: light bodies also tint the bezel band (3.6% of the width) so the colour reads straight-on
    const devCol = p.deviceColor || '#1d1d20';
    const hx = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c); const n2 = m ? parseInt(m[1], 16) : 0x1d1d20; return [(n2 >> 16) & 255, (n2 >> 8) & 255, n2 & 255]; };
    const dc = hx(devCol), lum = (0.2126 * dc[0] + 0.7152 * dc[1] + 0.0722 * dc[2]) / 255, bt = cl((lum - 0.2) / 0.4) * 0.92;
    const bezCol = '#' + [7, 7, 8].map((b, k) => Math.round(lerp(b, dc[k], bt)).toString(16).padStart(2, '0')).join('');

    // ---------------- phone geometry
    const I = ctx.device('phone');
    let Hp = wide ? 0.84 : portrait ? 0.7 : 0.74; let w = Hp * I.aspect;
    if (w > A * 0.6) { w = A * 0.6; Hp = w / I.aspect; }
    const sw = I.scr.w * w, sh = I.scr.h * w, y0 = 0;
    const zf = 0.0035 * w;                                  // screen plane in front of the body front

    // ---------------- logo end card geometry (world)
    const WM = ctx.glyphs(logo, { h: 1, weight: 800 }); const wpu = Math.max(0.3, WM.width);
    const S = Math.min(0.24, inner.w * 0.42);               // icon tile
    const Hw = Math.min(0.085, (inner.w * 0.82) / wpu);      // wordmark cap height
    const Ht = Math.min(0.032, inner.w * 0.06);              // tagline cap height
    const TL = tag ? ctx.glyphs(tag, { h: Ht, weight: 500, maxW: inner.w * 0.86, lineH: 1.7 }) : null;
    const tagH = TL ? TL.height : 0;
    const gap1 = S * 0.26, gap2 = Hw * 0.95;
    const blockH = S + gap1 + Hw + (TL ? gap2 + tagH : 0);
    const iconY = blockH / 2 - S / 2 + 0.01;
    const wordY = iconY - S / 2 - gap1 - Hw / 2;
    const tagY = wordY - Hw / 2 - gap2 - tagH / 2;
    // splash inside the screen (screen fractions) and its world equivalents
    const sIconF = 0.36, sIconYF = 0.07;                    // icon width / centre (fractions of sw / sh)
    const sS = sIconF * sw;
    const sHw = Math.min(0.03 * sh, (0.78 * sw) / wpu);
    const sWordYF = sIconYF - (sS / 2 + sS * 0.26 + sHw / 2) / sh;
    const ICON_R = 0.225;                                   // app-icon squircle corner (fraction of the icon side) — a design constant
    // app screen tiles (screen fractions)
    const TF = [[-0.235, 0.12], [0.235, 0.12], [-0.235, -0.2], [0.235, -0.2]]; const tW = 0.44, tH = 0.3;

    // ---------------- feature grid targets
    const g = 0.032; let cw, ch; const cells = [];
    if (wide) {
      cw = Math.min((inner.w - 3 * g) / 4, inner.h * 0.68 * 0.76); ch = cw / 0.76;
      for (let i = 0; i < 4; i++) cells.push([(i - 1.5) * (cw + g), 0]);
    } else {
      ch = portrait ? Math.min(0.41, (inner.h - g) / 2) : (inner.h - g) / 2 * 0.94;
      cw = Math.min((inner.w - g) / 2, portrait ? ch * 0.62 : ch * 0.96); if (portrait) ch = Math.min(ch, cw / 0.56);
      for (let i = 0; i < 4; i++) cells.push([((i % 2) - 0.5) * (cw + g), (0.5 - Math.floor(i / 2)) * (ch + g)]);
    }

    // ---------------- backdrop: accent glow + vignette (persistent), sweep band
    const ff = ctx.fullFrame(-1.2, 1.1);
    const gw = Math.max(A, 1) * 1.5;
    const glowK = 0.75 + 0.25 * Math.cos(M.TAU * u);
    out.push({ light: { type: 'radial', stops: [[0, accent, 0.5], [0.45, accent, 0.16], [1, accent, 0]] }, blend: 'add', x: 0, y: 0.02, z: -1.0, w: gw, h: gw * 0.8, opacity: 0.55 * glowK, layer: 0 });
    out.push({ ...ff, light: { type: 'radial', stops: [[0, '#000000', 0], [0.55, '#000000', 0.25], [1, '#000000', 0.8]] }, blend: 'normal', layer: 0 });

    // ---------------- scene A/B: the phone
    const rq = win(v, 0, 0.16), rise = E.outCubic(rq);
    const hs = win(v, 0.16, 0.4);                                 // hero beat phase
    const sweepQ = win(v, 0.17, 0.33);
    const dq = win(v, 0.4, 0.52), drop = E.inCubic(dq);           // phone drops away as the tiles pop out
    const phoneOn = v < 0.53;
    let py = y0, prx = 0, pry = 0, prz = 0, pz = 0;
    if (v < 0.16) { py = y0 - (1.0 + Hp * 0.15) * (1 - rise); prx = -0.32 * (1 - rise) * (1 - rise); prz = 0.05 * (1 - rise); }
    else if (v < 0.4) { const sn = Math.sin(Math.PI * hs); pry = -0.46 * sn * sn; prx = -0.05 * sn * sn; py = y0 + 0.012 * sn * sn; }
    else { py = y0 - 1.1 * drop; pz = -0.35 * drop; }
    if (phoneOn) {
      const sc = [];
      // splash (icon + wordmark) — on screen from the moment the free logo lands (v=.16) until the app screen takes over
      const splashOut = E.inCubic(win(v, 0.17, 0.215));
      if (v >= 0.16 && v < 0.215) {
        const k = 1 + 0.12 * splashOut, o = 1 - splashOut;
        sc.push({ useMedia: false, color: accent, x: 0, y: sIconYF, w: sIconF * k, h: (sS * k) / sh, radiusW: sS * k * ICON_R, sheen: 0.25, opacity: o });
        sc.push({ text: logo[0], weight: 800, color: '#ffffff', x: 0, y: sIconYF, h: (sS * 0.44 * k) / sh, opacity: o });
        sc.push({ text: logo, weight: 800, color: '#ffffff', x: 0, y: sWordYF, h: (sHw * k) / sh, opacity: o });
      }
      // app screen: header wordmark + 4 tiles + CTA pill
      if (v >= 0.19) {
        const hq = E.outCubic(win(v, 0.19, 0.25));
        sc.push({ text: logo, weight: 800, color: '#ffffff', x: -0.47 + (wpu * 0.022 * sh) / sw / 2, y: 0.4, h: 0.022, opacity: hq });
        sc.push({ useMedia: false, color: accent, x: 0, y: -0.41, w: 0.5 * (0.7 + 0.3 * hq), h: 0.05, radius: 0.5, opacity: hq });
        if (v < 0.4) TF.forEach(([fx, fy], i) => {
          const q = win(v, 0.19 + i * 0.012, 0.235 + i * 0.012), e = E.outBack(q), o = E.outCubic(q);
          sc.push({ media: med(i), x: fx, y: fy, w: tW * (0.55 + 0.45 * e), h: tH * (0.55 + 0.45 * e), opacity: o, zoom: 1.04 });
        });
      }
      const gloss = 0.1 + 0.32 * Math.sin(Math.PI * sweepQ) ** 2;
      out.push({ device: 'phone', w, x: 0, y: py, z: pz, rx: prx, ry: pry, rz: prz, deviceColor: devCol, bezelColor: bezCol, screenColor: '#0c0d13',
        screenCards: sc, gloss, glossAngle: -0.85 + 0.5 * (sweepQ - 0.5), layer: 3 });
      // soft contact glow under the phone during the hero beat
      const hb = Math.min(rise, 1 - drop);
      out.push({ light: { type: 'radial', stops: [[0, '#ffffff', 0.22], [0.5, '#ffffff', 0.06], [1, '#ffffff', 0]] }, blend: 'add',
        x: 0, y: py - Hp / 2 - 0.01, z: -0.2, w: w * 2.6, h: 0.07, opacity: hb, layer: 1 });
    }
    // light sweep: diagonal streak across the glass + a broad band behind
    if (sweepQ > 0 && sweepQ < 1) {
      const sx = lerp(-w * 1.6, w * 1.6, E.inOutSine(sweepQ)), si = Math.sin(Math.PI * sweepQ);
      out.push({ light: { type: 'streak', angle: 0, stops: [[0, '#ffffff', 0.85], [0.35, '#e9e4ff', 0.25], [1, '#ffffff', 0]] }, blend: 'add',
        x: sx, y: py, z: 0.05, w: Hp * 0.95, h: w * 0.42, rz: 1.15, opacity: 0.4 * si, layer: 4 });
      out.push({ light: { type: 'linear', angle: 0, stops: [[0, accent, 0], [0.5, '#ffffff', 0.22], [1, accent, 0]] }, blend: 'add',
        x: sx * 1.6, y: 0, z: -0.6, w: w * 1.6, h: ff.h, rz: 0.35, opacity: si, layer: 1 });
    }

    // ---------------- scene C/D: feature cards
    const cardsOn = v >= 0.4 && v < 0.83;
    if (cardsOn) {
      for (let i = 0; i < 4; i++) {
        const [fx, fy] = TF[i];
        // ride the live screen until this tile launches, then start from where the screen was at launch (not the falling phone)
        const lq = E.inCubic(win(Math.min(v, 0.4 + i * 0.02), 0.4, 0.52)), lpy = y0 - 1.1 * lq, lpz = -0.35 * lq;
        const r0 = { x: fx * sw, y: lpy + fy * sh, z: lpz + zf, w: tW * sw, h: tH * sh, rx: 0, ry: 0, rz: 0 };   // screen tile rect (phone straight-on at v=.40)
        const [gx, gy] = cells[i];
        const nx = gx / Math.max(0.2, A / 2), ny = gy / 0.5;
        const g1 = { x: gx, y: gy, z: 0.02 * i, w: cw, h: ch, rx: 0.1 * ny, ry: -0.2 * nx, rz: 0 };
        // fly-out
        const fq = win(v, 0.4 + i * 0.02, 0.52 + i * 0.02), fe = E.inOutCubic(fq), se = cl(E.outBack(fq));
        // hold float (zero at both ends of the hold) + slow ken burns
        const hq = win(v, 0.52, 0.73), fl = Math.sin(Math.PI * hq);
        // collapse into the icon
        const cq = win(v, 0.73 + (3 - i) * 0.008, 0.79 + (3 - i) * 0.008), ce = E.inOutCubic(cq);
        let c = {
          x: lerp(r0.x, g1.x, fe), y: lerp(r0.y, g1.y, fe) + (gy < 0 ? 0.06 * Math.sin(Math.PI * fe) : 0) + 0.012 * fl * Math.sin(i * 1.7 + 1), z: lerp(r0.z, g1.z, fe) + 0.08 * Math.sin(Math.PI * fe),
          w: lerp(r0.w, g1.w, se), h: lerp(r0.h, g1.h, se), rx: lerp(0, g1.rx, fe), ry: lerp(0, g1.ry, fe) + 0.03 * fl * (i % 2 ? 1 : -1), rz: 0.06 * Math.sin(Math.PI * fe) * (i % 2 ? 1 : -1),
        };
        if (cq > 0) {
          const tz = 0.06 + (3 - i) * 0.03, trz = (i - 1.5) * 0.05, cS = S * 0.74;   // cards end smaller than the icon's smallest pop size (0.82·S) so no rim shows
          c = { x: lerp(c.x, 0, ce), y: lerp(c.y, iconY, ce), z: lerp(c.z, tz, ce) + 0.12 * Math.sin(Math.PI * ce), w: lerp(c.w, cS, ce), h: lerp(c.h, cS, ce),
            rx: lerp(c.rx, 0, ce), ry: lerp(c.ry, 0, ce), rz: lerp(c.rz, trz, ce) };
        }
        const op = 1 - E.inCubic(win(cq, 0.55, 0.9));
        out.push({ media: med(i), ...c, zoom: 1.04 + 0.08 * hq + 0.1 * ce, opacity: op, shadow: 0.55 * (1 - ce), bright: 1 - 0.25 * ce, layer: 5 + (3 - i) });   // fixed per-card paint order (later arrivals on top) → no z flip during the collapse
      }
    }

    // ---------------- logo: icon tile + wordmark + tagline (free, in world space)
    const formQ = win(v, 0.8, 0.87);                          // icon pops in on the collapsed stack
    const logoOn = v >= 0.8 || v < 0.16;
    if (logoOn) {
      // shrink-into-screen during the rise: targets track the phone's splash rect
      const kq = v < 0.16 ? E.inOutCubic(rq) : 0;
      const tIconY = py + sIconYF * sh, tWordY = py + sWordYF * sh;
      const pop = v >= 0.8 ? E.outBack(formQ) : 1, pOp = v >= 0.8 ? E.outCubic(win(formQ, 0, 0.4)) : 1;
      const Si = lerp(S, sS, kq) * (0.82 + 0.18 * pop), iy = lerp(iconY, tIconY, kq), izf = lerp(0.18, zf, kq);
      out.push({ useMedia: false, color: accent, x: 0, y: iy, z: izf, w: Si, h: Si, radiusW: Si * ICON_R, sheen: 0.25, shadow: 0.5 * (1 - kq), opacity: pOp, layer: 9 });
      out.push({ text: logo[0], weight: 800, color: '#ffffff', x: 0, y: iy, z: izf + 0.001, h: Si * 0.44, opacity: pOp, layer: 10 });
      // merge flash
      const fz = Math.sin(Math.PI * win(v, 0.8, 0.89));
      if (fz > 0) out.push({ light: { type: 'radial', stops: [[0, '#ffffff', 0.7], [0.3, accent, 0.35], [1, accent, 0]] }, blend: 'add', x: 0, y: iconY, z: 0.1, w: S * 4, h: S * 4, opacity: fz * 0.8, layer: 11 });
      // wordmark letters (rise in staggered), then shrink into the splash wordmark
      const k = lerp(1, sHw / Hw, kq), wy = lerp(wordY, tWordY, kq);
      const Lw = ctx.glyphs(logo, { h: Hw, weight: 800 });
      const dL = Math.min(0.012, 0.045 / Math.max(1, Lw.glyphs.length - 1));   // stagger normalised: last glyph lands by v≈.92 (u≈.77)
      Lw.glyphs.forEach((gl, j) => {
        const q = v >= 0.8 ? win(v, 0.82 + j * dL, 0.875 + j * dL) : 1, e = E.outCubic(q);
        out.push({ text: gl.ch, weight: 800, color: '#ffffff', x: gl.x * k, y: wy + gl.y * k - (1 - e) * Hw * 0.7, z: izf, h: Hw * k, opacity: e, layer: 10 });
      });
      // tagline words
      if (TL) {
        const tout = v < 0.16 ? E.inCubic(win(v, 0, 0.07)) : 0;
        const dT = Math.min(0.01, 0.04 / Math.max(1, TL.words.length - 1));   // last word lands by v≈.92
        TL.words.forEach((wd, j) => {
          const q = v >= 0.8 ? win(v, 0.83 + j * dT, 0.88 + j * dT) : 1, e = E.outCubic(q);
          out.push({ text: wd.text, weight: 500, color: '#cfd0dc', x: wd.x, y: tagY + wd.y - (1 - e) * Ht * 0.8 - tout * Ht * 1.2, z: 0.1, h: Ht, opacity: e * (1 - tout), layer: 10 });
        });
      }
    }
    return out;
  },
};
