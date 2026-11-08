// shared: lay a cols x rows grid of cells over the inner frame (cells fill the box, gap between)
export function cells(ctx, cols, rows, gapPct) {
  const I = ctx.inner; const g = gapPct / 100;
  const cw = (I.w - g * (cols - 1)) / cols, ch = (I.h - g * (rows - 1)) / rows;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    out.push({ i: r * cols + c, r, c, x: -I.w / 2 + cw / 2 + c * (cw + g), y: I.h / 2 - ch / 2 - r * (ch + g), w: cw, h: ch });
  return out;
}
// default grid shape for k cells given the frame aspect
export function shape(ctx, k) {
  const a = ctx.aspect;
  if (k === 4) return a > 2.2 ? [4, 1] : a < 0.45 ? [1, 4] : [2, 2];
  if (k === 6) return a >= 1 ? [3, 2] : [2, 3];
  const best = ctx.M.grid(k, a * 1.0); return [best.cols, best.rows];
}
