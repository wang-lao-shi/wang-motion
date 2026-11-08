import { base, P } from '../_common.js';
// Parallax Rows (original): horizontal carousels stacked at different depths on a tilted shelf. Rows advance
// different whole numbers of cards per loop (near row ~2.5x the far row's count) and far cards are smaller, so
// screen speeds separate clearly (true parallax: far slow, near fast). Far rows are smaller, dimmer, softer;
// the near (hero) row is big, crisp and lifted, shown whole: its lower edge is anchored >=3% inside the frame
// at every x (tilt included) and a soft glossy-floor reflection fills the strip beneath it. The far row
// absorbs all overscan off the top. Media are split into two disjoint pools (hero row / back rows) so rows
// moving at different speeds never show the same image twice at once.
const arOf = (I) => (I.w / I.h > 1.2 ? 1.6 : 1.33);

export default {
  id: 'parallax-rows', name: 'Parallax Rows', category: 'carousel-flow', slots: 12,
  desc: 'Stacked carousels at different depths drifting at parallax speeds, far rows small and defocused, hero row with floor reflection',
  tags: ['parallax', 'carousel', 'marquee', 'rows', 'depth', 'dof', 'loop', 'continuous'], ref: 'original',
  params: base({
    padding: P.padding(0),
    cornerRadius: P.cornerRadius(3),
    rows: P.num('Rows (0 = auto)', 0, 0, 6),
    speed: P.num('Speed (multiplier)', 1, 1, 3),
    depth: P.pct('Depth scale', 30, 0, 70),
    dof: P.pct('Depth of field', 35, 0, 100),
    tilt: P.deg('Tilt', -5, -20, 20),
  }),
  shadow: true, shadowOpacity: 0.4, sheen: 0.05,
  duration: 36,
  layout(ctx) {
    const { p, u, n, M, inner: I } = ctx;
    const R = Math.round(p.rows) >= 2 ? Math.round(M.clamp(p.rows, 2, 6)) : (I.h > I.w * 1.3 ? 4 : 3);
    const tz = M.rad(p.tilt), ct = Math.cos(tz), sn = Math.sin(tz), as = Math.abs(sn), at = as / ct;
    const dk = (r) => r / (R - 1);                          // 0 far .. 1 near
    const scaleOf = (r) => 1 - (p.depth / 100) * (1 - dk(r));
    const sumS = Array.from({ length: R }, (_, r) => scaleOf(r)).reduce((a, b) => a + b, 0);
    const gapY = 0.014, sp = Math.max(1, Math.round(p.speed));
    // perpendicular (row-frame) span: near row's lower edge sits 3.5% above the frame bottom at its lowest
    // point; the stack must reach past the frame top at its highest point; half the tilt overscan is
    // added on top so the far row runs off the top edge rather than shrinking every row.
    const vb = ct * (-I.h / 2 + 0.035 * I.h + (I.w / 2) * at);
    const vTop = ct * (I.h / 2 + (I.w / 2) * at) + 0.004;
    const reach = Math.hypot(I.w, I.h) * 0.5 + 0.25;

    // geometry per row (far at top), stacked upward from the anchored hero bottom edge. Card aspect starts at
    // the frame's natural shape and widens until the hero pool and back pool both hold their
    // rows' visible windows, which is what keeps every on-screen image distinct.
    const geom = (AR, extra) => {
      const h0 = (vTop - vb + extra - gapY * (R - 1)) / sumS;
      const rows = []; let yBot = vb;
      for (let r = R - 1; r >= 0; r--) {
        const s = scaleOf(r), h = h0 * s, w = h * AR, gx = 0.006 + 0.012 * s, px = w + gx;
        const yc = yBot + h / 2; yBot += h + gapY;
        const xc = (yc * sn) / ct;                           // row coordinate under the frame centre
        const L = I.w / ct + h * at;                         // row length that can show inside the frame
        rows[r] = { s, h, w, px, yc, xc, ell: (L + w) / px }; // ell = index-space width of the visible window
      }
      const backEll = rows.slice(0, R - 1).reduce((t, q) => t + q.ell, 0);
      const a = Math.max(Math.floor(rows[R - 1].ell) + 1, Math.floor(n - backEll));   // hero pool: > its window
      return { rows, a, backEll, fits: n - a >= backEll };
    };
    const AR0 = arOf(I);
    // if needed, first widen the cards (to +20%), then let the far row run further off the top (bigger cards)
    let G = geom(AR0, 0);
    for (let k = 1; k <= 16 && !G.fits; k++) G = geom(AR0 * (1 + 0.02 * Math.min(k, 12)), 0.015 * Math.max(0, k - 12));
    const { rows } = G, near = rows[R - 1];
    // media pools: hero row gets its own pool, back rows share the rest (they advance the same count per loop,
    // so their windows, laid end-to-end with even slack, never overlap). If n is too small for that, fall back
    // to one shared ring (repeats then possible).
    const split = n - G.a >= G.backEll - 0.6 && G.a >= 2;
    const a = split ? G.a : n, b = split ? n - a : n;
    // cards per loop: hero ~24 (≈1 card / 1.5 s at 36 s); back rows the multiple of their pool that puts the
    // far row at ~1/2.75 of the hero row's screen speed
    const Kn = a * Math.max(1, Math.round(24 / a)) * sp;
    const Kb = b * Math.max(1, Math.round((Kn / sp) * near.px / (2.75 * rows[0].px) / b)) * sp;
    const slack = Math.max(0, (b - G.backEll) / Math.max(1, R - 1));
    let T = split ? slack / 2 : 0;
    for (let r = 0; r < R - 1; r++) {
      const q = rows[r];
      q.mo = Math.round(T - q.xc / q.px + q.ell / 2);
      q.hoff = q.mo + q.xc / q.px - q.ell / 2 - T;          // fractional stagger puts the window start at T
      T += q.ell + slack;
    }
    near.mo = split ? 0 : Math.round(T - near.xc / near.px + near.ell / 2); near.hoff = 0;
    const mediaOf = (r, j) => (split ? (r === R - 1 ? M.mod(j + near.mo, a) : a + M.mod(j + rows[r].mo, b)) : M.mod(j + rows[r].mo, n));

    // depth of field: the engine's mip blur looks blocky between ~1.5 and ~4.5, so the far row gets a soft,
    // still-readable 0..1.5 up to dof 60 (1.5 from dof 35) and jumps to a heavy bokeh 5..7 above that; middle
    // rows scale down from the far value and never exceed 1.5
    const farBlur = p.dof <= 60 ? 1.5 * Math.min(p.dof, 35) / 35 : 5 + 2 * (p.dof - 60) / 40;
    const blurOf = (r) => (r === 0 ? farBlur : r === R - 1 ? 0 : Math.min(1.5, farBlur * (1 - dk(r))));

    const out = [];
    rows.forEach((q, r) => {
      const d = 1 - dk(r), isNear = r === R - 1;
      const K = isNear ? Kn : Kb;
      const off = u * K, b0 = Math.floor(off);
      const C = Math.ceil(reach / q.px) + 3;
      for (let c = -C; c <= C; c++) {
        const j = c + b0;
        const X = (j - off + q.hoff) * q.px;
        const x = X * ct - q.yc * sn, y = X * sn + q.yc * ct;
        const media = mediaOf(r, j);
        out.push({
          media, x, y, z: isNear ? 0.004 : -0.002 * d, rz: tz, w: q.w, h: q.h,
          blur: blurOf(r), bright: isNear ? 1.06 : 1 - 0.32 * d, sat: isNear ? 1.05 : 1 - 0.35 * d,
          shadow: isNear ? 0.6 : 0.15 + 0.3 * (1 - d), layer: r + 1,
        });
        if (isNear) {                                          // glossy floor reflection under the hero row
          const ry = q.yc - q.h - 0.004;
          out.push({
            media, x: X * ct - ry * sn, y: X * sn + ry * ct, z: 0, rz: tz, w: q.w, h: q.h,
            uv: [0, 1, 1, 0], opacity: 0.55, bright: 0.85, sat: 0.9, blur: 1.5, shadow: 0, sheen: 0,
            mask: { type: 'line', angle: -Math.PI / 2, p: 0.6, soft: 0.4 }, layer: 0,
          });
        }
      }
    });
    return out;
  },
};
