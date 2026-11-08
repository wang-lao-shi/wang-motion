import { easeOf, cardAR } from '../_common.js';
// shared: a strip of cards wrapped on a cylinder (convex "out" / concave "in"), scrolling through the centre.
export function strip(ctx, vertical) {
  const { p, n, u, M } = ctx;
  const V = ctx.view;
  const K = Math.max(2, Math.round(p.loopCards));
  const ar = cardAR(ctx, vertical ? 1.0 : 1.08);
  const fitS = vertical ? Math.min(1, V.w / 0.62) : Math.min(1, V.h);
  const along = (p.cardSize / 100) * (vertical ? 1 : 1) * fitS;           // size along the strip direction... width for film strip
  let w, h;
  if (vertical) { w = along; h = w / ar; } else { w = along; h = w / ar; }
  const pitch = (vertical ? h : w) + (p.gap / 100) * (vertical ? 1.2 : 0.6);
  const s = p.motion === 'stopAtCenter'
    ? (() => { const x = u * K; const k = Math.floor(x); return k + easeOf(p.ease)(Math.min(1, (x - k) / 0.55)); })()
    : u * K;
  const c = (p.curve / 100);
  const kc = Math.abs(c) * (vertical ? 1.0 / Math.max(1, V.h / V.w * 0.5625 * 0 + 1) : 1.35 / Math.max(1, V.w));                 // curvature 1/R
  const sg = c >= 0 ? -1 : 1;                    // -1 convex (out), +1 concave (in)
  const span = (vertical ? V.h : V.w) / 2 + pitch;
  const out = [];
  const j0 = Math.floor(s);
  for (let j = j0 - 12; j <= j0 + 12; j++) {
    const X = (j - s) * pitch;                    // arc length from centre
    if (kc > 1e-4 && Math.abs(X * kc) > Math.PI * 0.62) continue;
    if (kc <= 1e-4 && Math.abs(X) > span) continue;
    const q = vertical ? curvePointV(-X, kc, sg) : curve1(X, kc, sg);
    const facing = Math.cos(X * kc);
    out.push({ media: M.mod(M.mod(j + 3, K), n), x: q.x, y: q.y, z: q.z, rx: q.rx, ry: q.ry, w, h,
      bend: vertical ? 0 : q.bend, bendX: vertical ? q.bend : 0, bright: 0.55 + 0.45 * Math.max(0, facing) ** 1.5 });
  }
  return out;
}
function curve1(X, k, s) {
  if (k < 1e-4) return { x: X, y: 0, z: 0, rx: 0, ry: 0, bend: 0 };
  const a = X * k; return { x: Math.sin(a) / k, y: 0, z: s * (1 - Math.cos(a)) / k, ry: -s * a, rx: 0, bend: -s * k };
}
function curvePointV(Y, k, s) {
  if (k < 1e-4) return { x: 0, y: Y, z: 0, rx: 0, ry: 0, bend: 0 };
  const a = Y * k; return { x: 0, y: Math.sin(a) / k, z: s * (1 - Math.cos(a)) / k, rx: s * a, ry: 0, bend: -s * k };
}
