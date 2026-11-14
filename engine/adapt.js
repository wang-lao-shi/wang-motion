// v10.2 · 素材比例自适应（只在 spec.cardRatio === 'media' 时生效；其余情况一律不碰，保证与 v9 逐像素一致）
//
// 思路：模板照原样排版（位置 / 旋转 / 动画都不变），引擎在排版结果上只改每张卡片的宽高，
//   让卡片形状 = 素材比例，图片就不会被裁。
//   - area：等面积换形（视觉分量不变），宽高各自最多放大 GROW 倍，防止长条卡片撞到邻居
//   - fit ：缩进原卡片框（网格 / 瀑布流等挤得很紧的布局，换形后绝不重叠）
//   - none：不换形（手机样机屏幕、拼图切片等），只用焦点控制裁切位置
//   - 整屏卡片（卡片盖满画面）不换形：按 fit 方式处理 —— cover 铺满裁切 / blur 完整显示 + 模糊底 / color 完整显示 + 纯色底

export const ADAPT_MODES = ['area', 'fit', 'ratio', 'none']; // ratio = 模板自己按素材比例排（cardAR 返回主比例），引擎不再换形
export const FIT_MODES = ['cover', 'blur', 'color'];
const GROW = 1.3;

// 标准比例：主比例离它 3% 以内就吸附过去（避免 1.7778 vs 1.7700 这种肉眼看不出的差别）
const SNAP = [1, 4 / 3, 3 / 4, 3 / 2, 2 / 3, 16 / 9, 9 / 16, 4 / 5, 5 / 4, 21 / 9, 2];
export function snapRatio(r) { for (const s of SNAP) if (Math.abs(r / s - 1) < 0.03) return s; return r; }

// 一批素材的主比例：中位数（多数图同尺寸时就是那个尺寸；个别异类不影响）
export function mainRatio(media) {
  const a = (media || []).filter((m) => m && m.w > 0 && m.h > 0 && !m.placeholder).map((m) => m.w / m.h).sort((x, y) => x - y);
  if (!a.length) return 4 / 3;
  const k = a.length >> 1; const med = a.length % 2 ? a[k] : Math.sqrt(a[k - 1] * a[k]);
  return snapRatio(med);
}
// 比例分组（±3% 算同一种），给网页上传检测用
export function ratioGroups(list) {
  const out = [];
  for (const r of list) { const g = out.find((o) => Math.abs(r / o.r - 1) < 0.03); if (g) g.n++; else out.push({ r: snapRatio(r), n: 1 }); }
  return out.sort((x, y) => y.n - x.n);
}

function isMediaCard(c) {
  if (!c || c.hidden || c.light || c.device || c.noAdapt) return false;
  if (c.text != null && c.text !== '') return false; // 文字卡
  if (c.color && !c.useMedia) return false; // 纯色卡
  if (c.fullAspect != null) return false; // 拼图切片（一张图切成多块）
  if (c.uv) { const u = c.uv; if (!(Math.abs(Math.abs(u[2] - u[0]) - 1) < 1e-6 && Math.abs(Math.abs(u[3] - u[1]) - 1) < 1e-6)) return false; } // 只放行整图翻转（倒影）
  return true;
}

// 卡片是否盖满画面（整屏类模板：幻灯、转场、缩放冲击……）
function frameBox(c, ctx) {
  let fw = ctx.view.w, fh = ctx.view.h;
  if (ctx.fullFrame && (c.z || 0) !== 0) { try { const F0 = ctx.fullFrame(0, 1), F = ctx.fullFrame(c.z || 0, 1); if (F0 && F && F0.h > 0) { const k = F.h / F0.h; fw *= k; fh *= k; } } catch (e) { /* view */ } }
  return [fw, fh];
}
function isFrameCard(c, w, h, ctx) {
  if (Math.abs(c.rx || 0) > 0.05 || Math.abs(c.ry || 0) > 0.05) return false;
  const [fw, fh] = frameBox(c, ctx); const ins = ctx.inner ? ctx.inner.h / ctx.view.h : 1; // 留白后的画面也算整屏
  const s = c.s ?? 1;
  return w * s >= fw * ins * 0.97 && h * s >= fh * ins * 0.97 && Math.abs(c.x || 0) < fw * 0.08 && Math.abs(c.y || 0) < fh * 0.08;
}

// cards: 模板排版结果（会被原地改写宽高）；返回新数组（整屏卡可能多出一张底图）
export function adaptCards(cards, ctx, o) {
  const mode = o.mode || 'area';
  const out = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (!isMediaCard(c)) { out.push(c); continue; }
    const mi = c.media ?? i;
    const R = o.mixed ? o.ratioOfMedia(mi) : o.R;
    const w = c.w ?? 0.3, h = c.h ?? (w / ctx.ratioOf(mi));
    const a = w / h;
    if (isFrameCard(c, w, h, ctx)) {
      const fit = o.fit || 'blur';
      if (fit === 'cover' || Math.abs(a / R - 1) < 0.01) { out.push(c); continue; }
      // 可见区域 = 卡片与画面的交集（有些模板把整屏卡做大一圈防露边）
      const [fw, fh] = frameBox(c, ctx); const s = c.s ?? 1; const bw = Math.min(w, fw / s), bh = Math.min(h, fh / s);
      const w2 = R > bw / bh ? bw : bh * R, h2 = w2 / R;
      const bg = { ...c, media: mi, w, h, layer: (c.layer ?? 0) - 0.01, shadow: 0, _adaptBg: 1 };
      if (fit === 'color') { bg.color = o.fitColor || '#000000'; bg.useMedia = false; bg.media2 = undefined; bg.mix = 0; }
      else { bg.blur = Math.max(c.blur ?? 0, 6); bg.bright = (c.bright ?? 1) * 0.62; bg.sat = (c.sat ?? 1) * 0.9; bg.zoom = (c.zoom ?? 1) * 1.08; }
      out.push(bg, { ...c, media: mi, w: w2, h: h2, shadow: 0 });
      continue;
    }
    if (mode === 'none' || mode === 'ratio' || Math.abs(a / R - 1) < 0.01) { out.push(c); continue; }
    let w2, h2;
    if (mode === 'fit') { if (R > a) { w2 = w; h2 = w / R; } else { h2 = h; w2 = h * R; } }
    else {
      const A = w * h; w2 = Math.sqrt(A * R); h2 = Math.sqrt(A / R);
      const k = Math.min(1, (w * GROW) / w2, (h * GROW) / h2); w2 *= k; h2 *= k;
    }
    c.w = w2; c.h = h2; if (c.media == null) c.media = mi;
    out.push(c);
  }
  return out;
}
