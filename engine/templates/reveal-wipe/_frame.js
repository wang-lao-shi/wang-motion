// shared helper for reveal-wipe: card size for 'Card ratio' (frame = fills the padded frame)
const RAT = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 0.8, '16:9': 16 / 9, '9:16': 9 / 16 };
export function frameCard(ctx) {
  const { p, inner } = ctx;
  const ar = p.cardRatio === 'frame' ? inner.w / inner.h : p.cardRatio === 'auto' ? ctx.ratioOf(0) : RAT[p.cardRatio] || 1;
  let w = inner.w, h = w / ar;
  if (h > inner.h) { h = inner.h; w = h * ar; }
  return { w, h, ar };
}
// frame-relative corner radius (animos): at Corner radius 3% the radius is ~1.7% of the frame's short side,
// scaling linearly with the param. core.js computes radius = cornerRadius × min(card w,h) × 3.2 × radiusMul,
// so return the radiusMul that makes it frame-relative for a card of size w×h (pre-scale `s`).
export function frameRadiusMul(ctx, w, h) {
  const fmin = Math.min(ctx.view.w, ctx.view.h);
  return 0.8 * fmin / (3.2 * Math.max(1e-6, Math.min(w, h)));
}
