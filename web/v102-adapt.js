// ==========================================
// WANG MOTION v10.2：素材比例自适应
//   卡片形状跟随素材（默认）/ 各自比例 / 模板原样；整屏模板：模糊底（默认）/ 纯色底 / 铺满裁切；
//   画面比例 16:9 / 跟随素材；裁切焦点；上传比例检测；动效「完整度」角标。
//   没导入图片时一律按模板原样（默认案例图不受影响，与 v10 逐像素一致）。
// ==========================================
const WMAD = { card: "media", fit: "blur", color: "#000000", canvas: "16:9" };
try { Object.assign(WMAD, JSON.parse(localStorage.getItem("wm_adapt_v102") || "{}")); } catch (e) { }
function wmAdSave() {
  try {
    let focus = wmUserImgs.map(im => im && im._wmFocus ? [im.naturalWidth, im.naturalHeight, im._wmFocus[0], im._wmFocus[1]] : null);
    if (!wmUserImgs.length || wmUserImgs.some(im => !im.naturalWidth)) { try { focus = JSON.parse(localStorage.getItem("wm_adapt_v102") || "{}").focus || []; } catch (e) { focus = []; } } // 图库还没载入：保留已存的焦点
    localStorage.setItem("wm_adapt_v102", JSON.stringify({ card: WMAD.card, fit: WMAD.fit, color: WMAD.color, canvas: WMAD.canvas, focus }));
  } catch (e) { }
}
function wmAdRestoreFocus() { // 刷新页面后按顺序 + 尺寸找回焦点
  try {
    const st = JSON.parse(localStorage.getItem("wm_adapt_v102") || "{}"); const F = st.focus || [];
    wmUserImgs.forEach((im, i) => { const f = F[i]; if (im && !im._wmFocus && f && f[0] === im.naturalWidth && f[1] === im.naturalHeight) im._wmFocus = [f[2], f[3]]; });
  } catch (e) { }
}
const WMAD_SNAP = [1, 4 / 3, 3 / 4, 3 / 2, 2 / 3, 16 / 9, 9 / 16, 4 / 5, 5 / 4, 21 / 9, 2];
function wmAdSnap(r) { for (const s of WMAD_SNAP) if (Math.abs(r / s - 1) < 0.03) return s; return r; }
function wmAdRatioLabel(r) {
  const L = [[1, "1:1"], [4 / 3, "4:3"], [3 / 4, "3:4"], [3 / 2, "3:2"], [2 / 3, "2:3"], [16 / 9, "16:9"], [9 / 16, "9:16"], [4 / 5, "4:5"], [5 / 4, "5:4"], [21 / 9, "21:9"], [2, "2:1"]];
  for (const [v, s] of L) if (Math.abs(r / v - 1) < 0.005) return s;
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}
function wmAdImgR(im) { return im && im.naturalWidth > 0 && im.naturalHeight > 0 ? im.naturalWidth / im.naturalHeight : null; }
function wmAdMain(imgs) {
  const a = (imgs || []).map(wmAdImgR).filter(Boolean).sort((x, y) => x - y);
  if (!a.length) return null; const k = a.length >> 1;
  return wmAdSnap(a.length % 2 ? a[k] : Math.sqrt(a[k - 1] * a[k]));
}
function wmAdGroups(imgs) {
  const out = [];
  for (const im of imgs || []) { const r = wmAdImgR(im); if (!r) continue; const g = out.find(o => Math.abs(r / o.r - 1) < 0.03); if (g) g.n++; else out.push({ r: wmAdSnap(r), n: 1 }); }
  return out.sort((x, y) => y.n - x.n);
}
function wmAdActive() { return wmUserImgs.length > 0 && WMAD.card !== "template"; }

// ---------- 给引擎的 spec 字段（舞台 / 演示 / 导出 / ZIP / 交互网页共用） ----------
function wmAdSpec(list) {
  if (!wmAdActive()) return {};
  const o = { cardRatio: "media", fit: WMAD.fit };
  if (WMAD.fit === "color") o.fitColor = WMAD.color;
  if (WMAD.card === "own") o.cardMix = "own";
  if (list && list.length) {
    const bySrc = new Map(wmUserImgs.map(im => [im.src, im]));
    const f = list.map(src => { const im = bySrc.get(src); return im && im._wmFocus ? [+im._wmFocus[0].toFixed(3), +im._wmFocus[1].toFixed(3)] : null; });
    if (f.some(Boolean)) o.focus = f;
  }
  return o;
}
function wmAdSig() {
  if (!wmAdActive()) return "tpl";
  return [WMAD.card, WMAD.fit, WMAD.fit === "color" ? WMAD.color : "", wmUserImgs.map(im => im._wmFocus ? im._wmFocus.join(",") : "").join(";")].join("|");
}

// ---------- 画面比例 ----------
function wmAdCanvasR() {
  if (WMAD.canvas !== "media" || !wmUserImgs.length) return null;
  const r = wmAdMain(wmUserImgs); if (!r || Math.abs(r / (16 / 9) - 1) < 0.01) return null;
  return r;
}
function wmAdCanvasLabel() { const r = wmAdCanvasR(); return r ? wmAdRatioLabel(r) : "16:9"; }
// 舞台 / 演示：在 16:9 的画框里按画面比例留边居中
function wmAdBox(pw, ph) {
  const r = wmAdCanvasR(); if (!r) return null;
  let ew = pw, eh = Math.round(pw / r); if (eh > ph) { eh = ph; ew = Math.round(ph * r); }
  ew = Math.max(2, ew & ~1); eh = Math.max(2, eh & ~1);
  return [Math.round((pw - ew) / 2), Math.round((ph - eh) / 2), ew, eh];
}
// 导出尺寸：短边与 16:9 时相同（1080p → 1080×1920 / 1440×1080 / 1080×1080）；PPTX 幻灯片固定 16:9
{
  const _dims = wmExDims;
  wmExDims = function () {
    const d = _dims.apply(this, arguments); const r = wmAdCanvasR();
    if (!r || wmExportState.fmt === "pptx") return d;
    const S = Math.min(d[0], d[1]); const ev = (x) => Math.max(2, Math.round(x / 2) * 2);
    return r >= 1 ? [ev(S * r), S] : [S, ev(S / r)];
  };
}
// ZIP 里的 spec.json：带上比例设置，CLI 重渲一致
if (typeof wmvPatchZipSpec === "function") {
  const _z = wmvPatchZipSpec;
  wmvPatchZipSpec = function (spec, dur, files) {
    const r = _z.apply(this, arguments);
    Object.assign(spec, wmAdSpec(spec.media && wmUserImgs.length ? wmMediaList(selectedId) : null));
    if (!wmAdActive()) spec.cardRatio = "template";
    const cr = wmAdCanvasR(); if (cr) { spec.ratio = wmAdRatioLabel(cr); }
    return r;
  };
}

// ---------- 动效完整度：当前素材在每个动效里能显示多少（不开浏览器渲染，直接跑排版函数） ----------
const wmAdKeepCache = new Map();
function wmAdKeep(id) {
  if (!wmAdActive() || !window.WMX || !WMX.adapt) return null;
  const R = WMAD.card === "own" ? null : wmAdMain(wmActiveImgs(id)); if (!R) return null;
  const key = id + "|" + R.toFixed(4) + "|" + WMAD.fit;
  if (wmAdKeepCache.has(key)) return wmAdKeepCache.get(key);
  const tpl = wmTpl(id); if (!tpl) return null;
  const A = WMX.adapt; let kept = 0, area = 0;
  try {
    const defs = tpl.params || {}; const bp = {}; for (const [k, d] of Object.entries(defs)) bp[k] = d && d.default;
    Object.assign(bp, wmTplParams(id));
    const asp = wmAdCanvasR() || 16 / 9; const media = Array.from({ length: 12 }, () => ({ w: R * 900, h: 900 }));
    const mode = tpl.adapt || A.ADAPT_MAP[id] || "area";
    for (let s = 0; s < 6; s++) {
      const dur = tpl.duration || 16, p = A.normParams({ ...bp }, defs), pad = (p.padding ?? 6) / 100;
      const ctx = { t: dur * s / 6, u: s / 6, dur, p, n: 12, view: { w: asp, h: 1 }, inner: { w: asp * (1 - 2 * pad), h: 1 - 2 * pad }, aspect: asp, ratioOf: () => R, adaptMode: mode, media, M: A.M, E: A.E,
        spec: { cardRatio: "media" }, pad, isPortrait: asp < 1, title: String(p.text ?? ""), words: String(p.text ?? "").split(/\s+/).filter(Boolean), titleSpec: null,
        glyphs: (str) => ({ w: String(str || "").length * 0.6, h: 1, glyphs: [], items: [], words: [] }), device: (ty, o) => A.deviceInfo(ty, o), camDist: 2,
        fullFrame: (z = 0, mg = 1.04) => ({ x: 0, y: 0, z, w: asp * mg, h: mg }) };
      let lo = tpl.layout(ctx) || []; let cards = Array.isArray(lo) ? lo : (lo.cards || []);
      cards = A.adaptCards(cards, ctx, { R, mode, fit: WMAD.fit, ratioOfMedia: () => R });
      for (const c of cards) {
        if (!c || c.hidden || c.light || c._adaptBg || (c.text != null && c.text !== "") || (c.color && !c.useMedia)) continue;
        if (c.device) { kept += 0.6; area += 1; continue; } // 手机屏幕固定比例：按焦点裁切
        const sc = c.s ?? 1, w = (c.w ?? 0.3) * sc, h = (c.h ?? (c.w ?? 0.3) / R) * sc, uv = c.uv || [0, 0, 1, 1];
        const fA = Math.abs(c.fullAspect ?? (w / h) / ((uv[2] - uv[0]) / (uv[3] - uv[1]))); const a = Math.abs(w * h) * (c.opacity ?? 1);
        if (!(a > 0) || !(fA > 0)) continue; kept += a * Math.min(fA / R, R / fA); area += a;
      }
    }
  } catch (e) { wmAdKeepCache.set(key, null); return null; }
  const v = area ? kept / area : null; wmAdKeepCache.set(key, v); return v;
}
// 「适合我的图」排序把完整度算进去：裁得越多越靠后
{
  const _fs = wmFitScore;
  wmFitScore = function (id, N) { const b = _fs.apply(this, arguments); const k = wmAdKeep(id); return k == null ? b : b + (1 - k) * 3; };
}
function wmAdBadges() {
  const on = wmAdActive();
  document.querySelectorAll("#studioEffectList .studio-item-card[data-id]").forEach(card => {
    const th = card.querySelector(".wm-sg-thumb"); if (!th) return;
    let b = th.querySelector(".wmad-badge");
    const k = on ? wmAdKeep(card.dataset.id) : null;
    if (k == null) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("span"); b.className = "wmad-badge"; th.appendChild(b); }
    const full = k >= 0.97; b.classList.toggle("full", full);
    b.textContent = full ? "完整" : `约 ${Math.round(k * 100)}%`;
    b.title = full ? "你的图在这个动效里能完整显示" : `你的图在这个动效里平均能看到约 ${Math.round(k * 100)}%（其余按焦点裁掉）`;
  });
}
{
  const _r = renderStudioList;
  renderStudioList = function () { const r = _r.apply(this, arguments); try { wmAdBadges(); } catch (e) { } return r; };
}

// ---------- 设置面板（舞台 / 演示工具栏、导出面板共用） ----------
const WMAD_IC = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 6v12M16 6v12" opacity=".55"/></svg>';
const wmAdPanels = [];
function wmAdPanel(host, opt = {}) {
  host.innerHTML = `
    <div class="wmad-row"><span class="k">卡片形状</span><div class="wm-seg sm" data-k="card">
      <button data-v="media">跟随素材</button><button data-v="own">各自比例</button><button data-v="template">模板原样</button></div></div>
    <div class="wmad-row"><span class="k">整屏动效</span><div class="wm-seg sm" data-k="fit">
      <button data-v="blur">完整 · 模糊底</button><button data-v="color">完整 · 纯色底</button><button data-v="cover">铺满裁切</button></div>
      <input type="color" class="wmad-color" value="${WMAD.color}" title="底色"></div>
    <div class="wmad-row"><span class="k">画面比例</span><div class="wm-seg sm" data-k="canvas">
      <button data-v="16:9">16:9</button><button data-v="media">跟随素材 <i class="wmad-cr"></i></button></div></div>
    <div class="wmad-row wmad-foot"><button class="wma-btn wmad-focus">调整裁切焦点…</button><span class="wmad-info"></span></div>
    <div class="wmad-hint"></div>`;
  host.querySelectorAll(".wm-seg[data-k] button").forEach(b => b.addEventListener("click", (e) => {
    e.preventDefault(); const k = b.parentElement.dataset.k; WMAD[k] = b.dataset.v; wmAdChanged();
  }));
  host.querySelector(".wmad-color").addEventListener("input", (e) => { WMAD.color = e.target.value; WMAD.fit = "color"; wmAdChanged(); });
  host.querySelector(".wmad-focus").addEventListener("click", (e) => { e.preventDefault(); wmAdOpenFocus(); });
  const P = { host, opt }; wmAdPanels.push(P); wmAdRefreshPanel(P);
  return P;
}
function wmAdRefreshPanel(P) {
  const h = P.host; const n = wmUserImgs.length;
  h.querySelectorAll(".wm-seg[data-k] button").forEach(b => b.classList.toggle("active", WMAD[b.parentElement.dataset.k] === b.dataset.v));
  h.querySelector(".wmad-color").style.display = WMAD.fit === "color" ? "" : "none";
  const R = wmAdMain(wmUserImgs), G = wmAdGroups(wmUserImgs);
  h.querySelector(".wmad-cr").textContent = R ? wmAdRatioLabel(R) : "";
  h.querySelector(".wmad-focus").disabled = !n;
  h.querySelector(".wmad-info").textContent = n ? `你的 ${n} 张图：${G.slice(0, 3).map(g => `${wmAdRatioLabel(g.r)}×${g.n}`).join("、")}${G.length > 3 ? " …" : ""}` : "";
  const hint = [];
  if (!n) hint.push("还没导入图片：先按模板原样展示，导入后自动跟随你的图。");
  else if (WMAD.card === "media" && G.length > 1) hint.push(`比例不一：统一按 ${wmAdRatioLabel(R)} 展示，其它比例按焦点裁切。`);
  if (n && WMAD.canvas === "media" && P.opt.export && wmExportState.fmt === "pptx") hint.push("PPTX 幻灯片固定 16:9。");
  if (n && WMAD.canvas === "media" && R && Math.abs(R / (16 / 9) - 1) >= 0.01) { const [W, H] = wmExDims(); if (P.opt.export) hint.push(`导出尺寸 ${W}×${H}。`); }
  h.querySelector(".wmad-hint").textContent = hint.join(" ");
  h.classList.toggle("wmad-off", !n);
}
function wmAdChanged() {
  wmAdSave(); wmAdKeepCache.clear();
  wmAdPanels.forEach(wmAdRefreshPanel);
  document.querySelectorAll(".wmad-tool").forEach(b => { b.classList.toggle("on", wmAdActive()); b.querySelector("span").textContent = wmAdActive() ? (WMAD.card === "own" ? "各自比例" : `比例 ${wmAdRatioLabel(wmAdMain(wmUserImgs) || 4 / 3)}`) : "比例"; });
  try { wmAdBadges(); } catch (e) { }
  wmAdBanner();
  if (typeof wmExportUpdateInfo === "function" && document.getElementById("wmExportModal")?.classList.contains("open")) wmExportUpdateInfo();
}
let wmAdPop = null, wmAdPopFor = null;
function wmAdTogglePop(btn) {
  if (!wmAdPop) {
    wmAdPop = document.createElement("div"); wmAdPop.className = "wm-spd-pop wmad-pop";
    wmAdPop.innerHTML = `<div class="hd"><b>素材比例</b><span>预览、演示与导出共用</span></div><div class="wmad-body"></div>`;
    document.body.appendChild(wmAdPop); wmAdPanel(wmAdPop.querySelector(".wmad-body"));
    wmAdPop.addEventListener("mousedown", (e) => e.stopPropagation());
    document.addEventListener("mousedown", () => wmAdPop.classList.remove("open")); window.addEventListener("resize", () => wmAdPop.classList.remove("open"));
  }
  if (wmAdPop.classList.contains("open") && wmAdPopFor === btn) { wmAdPop.classList.remove("open"); return; }
  wmAdPopFor = btn; wmAdPop.classList.add("open"); wmAdPanels.forEach(wmAdRefreshPanel);
  const r = btn.getBoundingClientRect(), pw = Math.min(380, window.innerWidth - 16), ph = wmAdPop.offsetHeight || 240;
  let x = Math.min(window.innerWidth - pw - 8, Math.max(8, r.left + r.width / 2 - pw / 2)), y = r.top - ph - 10;
  if (y < 8) y = Math.min(window.innerHeight - ph - 8, r.bottom + 10);
  wmAdPop.style.left = x + "px"; wmAdPop.style.top = Math.max(8, y) + "px";
}

// ---------- 焦点编辑：点一下 / 拖动，决定裁切时保留哪里 ----------
let wmAdFocusModal = null;
function wmAdOpenFocus() {
  if (!wmUserImgs.length) return;
  if (!wmAdFocusModal) {
    const m = document.createElement("div"); m.className = "wm-modal"; m.id = "wmAdFocusModal";
    m.innerHTML = `<div class="wm-modal-box wmad-fbox" role="dialog" aria-label="裁切焦点">
      <div class="wm-modal-title">裁切焦点</div>
      <div class="wm-modal-sub">比例和卡片不一样的图会被裁一部分。在图上点一下或拖动，告诉我保留哪里；亮框是卡片能看到的范围。</div>
      <div class="wmad-fgrid"></div>
      <div class="wm-ex-btns"><button class="wm-h-act wmad-freset">全部居中</button><button class="wm-h-act primary wmad-fdone">完成</button></div></div>`;
    document.body.appendChild(m); wmAdFocusModal = m;
    m.addEventListener("mousedown", (e) => { if (e.target === m) m.classList.remove("open"); });
    m.querySelector(".wmad-fdone").addEventListener("click", () => m.classList.remove("open"));
    m.querySelector(".wmad-freset").addEventListener("click", () => { wmUserImgs.forEach(im => { delete im._wmFocus; }); wmAdChanged(); wmAdFillFocus(); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape" && m.classList.contains("open")) m.classList.remove("open"); });
  }
  wmAdFillFocus(); wmAdFocusModal.classList.add("open");
}
function wmAdFillFocus() {
  const grid = wmAdFocusModal.querySelector(".wmad-fgrid"); grid.innerHTML = "";
  const R = WMAD.card === "own" ? null : (wmAdMain(wmUserImgs) || 4 / 3);
  wmUserImgs.forEach((im, i) => {
    const r = wmAdImgR(im) || 1; const it = document.createElement("div"); it.className = "wmad-fit";
    it.innerHTML = `<div class="wmad-fimg" style="aspect-ratio:${r}"><img src="${im.src}" draggable="false"><i class="wmad-win"></i><b class="wmad-dot"></b></div><small>${i + 1} · ${wmAdRatioLabel(wmAdSnap(r))}</small>`;
    const box = it.querySelector(".wmad-fimg"), win = it.querySelector(".wmad-win"), dot = it.querySelector(".wmad-dot");
    const draw = () => {
      const f = im._wmFocus || [0.5, 0.5]; dot.style.left = f[0] * 100 + "%"; dot.style.top = f[1] * 100 + "%";
      if (!R || Math.abs(r / R - 1) < 0.01) { win.style.display = "none"; it.classList.add("whole"); return; }
      win.style.display = ""; it.classList.remove("whole");
      const cw = R < r ? R / r : 1, ch = R < r ? 1 : r / R; // 可见窗口（占图片宽 / 高的比例）
      const x = (1 - cw) * f[0], y = (1 - ch) * f[1];
      Object.assign(win.style, { left: x * 100 + "%", top: y * 100 + "%", width: cw * 100 + "%", height: ch * 100 + "%" });
    };
    const set = (e) => { const b = box.getBoundingClientRect(); const pt = e.touches ? e.touches[0] : e; im._wmFocus = [Math.min(1, Math.max(0, (pt.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (pt.clientY - b.top) / b.height))]; draw(); };
    let drag = false;
    box.addEventListener("pointerdown", (e) => { drag = true; box.setPointerCapture && box.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
    box.addEventListener("pointermove", (e) => { if (drag) set(e); });
    const end = () => { if (drag) { drag = false; wmAdChanged(); } };
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    draw(); grid.appendChild(it);
  });
}

// ---------- 上传后的提示条：比例不一 / 画面比例不合 ----------
let wmAdLastSig = "";
function wmAdImgSig() { return wmUserImgs.length + ":" + wmUserImgs.map(im => (im.naturalWidth || 0) + "x" + (im.naturalHeight || 0)).join(","); }
function wmAdBanner() {
  const area = document.querySelector(".studio-canvas-area"); if (!area) return;
  let el = document.getElementById("wmAdBanner");
  const n = wmUserImgs.length; const G = wmAdGroups(wmUserImgs), R = wmAdMain(wmUserImgs);
  const sig = wmAdImgSig() + "|" + WMAD.card + "|" + WMAD.canvas;
  let html = "";
  if (n && sig !== WMAD._dismiss) {
    if (WMAD.card === "media" && G.length > 1) {
      html = `<span>你的图有 ${G.length} 种比例（${G.slice(0, 3).map(g => `${wmAdRatioLabel(g.r)}×${g.n}`).join("、")}）。统一按 <b>${wmAdRatioLabel(R)}</b> 展示，其它的按焦点裁切。</span>
        <button data-a="focus">调整焦点</button><button data-a="own">改为各自比例</button>`;
    } else if (WMAD.canvas !== "media" && R && Math.abs(R / (16 / 9) - 1) >= 0.08 && WMAD.card !== "template") {
      html = `<span>你的图是 <b>${wmAdRatioLabel(R)}</b>，画面是 16:9。整屏动效会加${WMAD.fit === "cover" ? "裁切" : WMAD.fit === "color" ? "纯色底" : "模糊底"}。</span>
        <button data-a="canvas">画面改为 ${wmAdRatioLabel(R)}</button>`;
    }
  }
  if (!html) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "wmAdBanner"; el.className = "wmad-banner"; area.appendChild(el);
    el.addEventListener("click", (e) => { const a = e.target.closest("button"); if (!a) return; const k = a.dataset.a;
      if (k === "focus") wmAdOpenFocus(); else if (k === "own") { WMAD.card = "own"; wmAdChanged(); } else if (k === "canvas") { WMAD.canvas = "media"; wmAdChanged(); }
      else if (k === "x") { WMAD._dismiss = sig; el.remove(); } }); }
  el.innerHTML = html + `<button data-a="x" class="x" title="不再提示">✕</button>`;
}
// 图库变化（导入 / 追加 / 排序 / 清空）：轻量轮询，不改原有导入代码
setInterval(() => {
  const s = wmAdImgSig(); if (s === wmAdLastSig) return;
  if (wmUserImgs.some(im => !im.naturalWidth)) return; // 还在解码
  wmAdLastSig = s; wmAdRestoreFocus(); wmAdChanged();
}, 600);

(function wmAdInit() {
  const mk = (after) => {
    if (!after) return;
    const b = document.createElement("button"); b.className = "tool-btn wmad-tool"; b.innerHTML = WMAD_IC + "<span>比例</span>";
    b.title = "素材比例：卡片跟随你的图、整屏动效的底、画面比例、裁切焦点";
    b.addEventListener("mousedown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => { e.stopImmediatePropagation(); wmAdTogglePop(b); }, true);
    after.after(b);
  };
  const tools = document.querySelectorAll(".wma-tool");
  mk(tools[0] || document.getElementById("btnPreviewIntro") || document.getElementById("btnSpeed"));
  mk(tools[1] || document.getElementById("btnPSpeed"));
  const anchor = document.getElementById("wmExAudioRow") || document.getElementById("wmExIntroRow");
  if (anchor) {
    const row = document.createElement("div"); row.className = "wm-ex-row wm-ex-v10"; row.id = "wmExAdaptRow";
    row.innerHTML = `<label class="t">素材比例</label><div class="wmad-host"></div>`;
    anchor.before(row); wmAdPanel(row.querySelector(".wmad-host"), { export: true });
    const _u = wmExportUpdateInfo;
    wmExportUpdateInfo = function () {
      _u.apply(this, arguments); wmAdPanels.forEach(wmAdRefreshPanel);
      const el = document.getElementById("wmExInfo"); const cr = wmAdCanvasR();
      if (el && cr && wmExportState.fmt !== "pptx" && !/画面 /.test(el.textContent)) el.textContent += ` · 画面 ${wmAdRatioLabel(cr)}`;
    };
  }
  wmAdChanged();
})();
