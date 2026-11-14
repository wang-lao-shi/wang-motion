// ==========================================
// WANG MOTION v10：调速面板 / 逐张入场 / 交互网页导出
// 由 skill 的 tools/build-web.mjs 注入；引擎、入场层、播放器模板都来自 skill（与 wm CLI 同一份代码）
// ==========================================
const WMV = {
  intro: { mode: "none", style: "rise", order: "index", dur: 2.5, hold: 0.3, seed: 1 },
  loops: 1, customDur: 20, gifIntroOnly: false, gifOnce: false, kfIntro: false, kfIntroN: 4, motionBlur: false,
  player: { autoplay: true, controls: true, allBatches: false, imgMax: 1600, mode: "stagger" },
  preview: null,
};
const WMV_SPEEDS = [0.1, 0.25, 0.5, 1, 1.5, 2, 4, 8];
const WMV_STYLE = { rise: "淡入上浮", fly: "由远飞近", pop: "缩放弹出", flip: "翻转" };
const WMV_ORDER = { index: "按序号", center: "从中心向外", ltr: "从左到右", random: "随机" };
try { const v = JSON.parse(localStorage.getItem("wm_v10") || "null"); if (v) { Object.assign(WMV.intro, v.intro || {}); ["loops", "customDur", "gifIntroOnly", "gifOnce", "kfIntro", "kfIntroN", "motionBlur"].forEach(k => { if (v[k] != null) WMV[k] = v[k]; }); Object.assign(WMV.player, v.player || {}); } } catch (e) { }
try { const s = +localStorage.getItem("wm_speed"); if (s >= 0.1 && s <= 8) playSpeed = s; } catch (e) { }
function wmvSave() { try { localStorage.setItem("wm_v10", JSON.stringify({ intro: WMV.intro, loops: WMV.loops, customDur: WMV.customDur, gifIntroOnly: WMV.gifIntroOnly, gifOnce: WMV.gifOnce, kfIntro: WMV.kfIntro, kfIntroN: WMV.kfIntroN, motionBlur: WMV.motionBlur, player: WMV.player })); } catch (e) { } }

// ---------- 时间轴（与 skill engine/intro.js 同一份实现，经 WMX 导出） ----------
function wmvIntroOn() { return WMV.intro.mode !== "none"; }
function wmvIntroSpec(mode) { const i = WMV.intro; return { mode: mode || i.mode, style: i.style, order: i.order, dur: +i.dur, hold: +i.hold, seed: i.seed | 0 }; }
function wmvInfo(mode) {
  const D = wmCurDur();
  if (!window.WMX || !WMX.timelineInfo) return { introWall: 0, preWall: 0, loopWall: D / playSpeed, total: (n) => n * D / playSpeed, on: false };
  return WMX.timelineInfo({ speed: playSpeed, intro: wmvIntroSpec(mode) }, D, selectedId);
}
function wmvFmtSpeed(s) { return (Math.round(s * 100) / 100) + "×"; }
function wmvSec(x) { return x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, "") : x.toFixed(1); }
function wmvStaggerOk(id) {
  const c = window.WMX && WMX.INTRO_COMPAT && WMX.INTRO_COMPAT[id];
  if (c) return c.ok;
  try { const E = WMB.engines.stage; if (E && E.eng && E.eng.tl) return E.eng.introVisible(((WMX.START_PHASE || {})[id] || 0) * wmCurDur()) >= 3; } catch (e) { }
  return true;
}

// 舞台 / 全屏 / 导出共用：返回本次绘制要用的时间轴（null = v9 原路径）
function wmV10TL(role, ex) {
  if (ex) return ex.T != null ? ex.tl : null;
  if (WMV.preview && (role === "stage" || role === "present")) return WMV.preview.tl;
  return null;
}
function wmV10Draw(E, role, ex, tl, dur) {
  const eng = E.eng;
  try {
    if (ex) {
      if (tl.mb) eng._renderTL(ex.T, WMX.timeMap(ex.T, eng.tl), ex.fps || 30);
      else eng.renderTimeSync(ex.T, ex.fps || 30);
      return true;
    }
    const T = (performance.now() - WMV.preview.start) / 1000;
    eng.renderTimeSync(T, 30);
    const info = eng.tl;
    if (T >= info.preWall + 0.05) { // 入场结束：交还给原来的相位循环，从同一姿态继续
      const m = WMX.timeMap(T, info);
      currentTime = (((m.t / dur) % 1) + 1) % 1;
      WMV.preview = null; wmvPreviewBtn();
    }
    return true;
  } catch (err) { console.warn("[wm v10] render", err); WMV.preview = null; return false; }
}
function wmvStartPreview() {
  const mode = wmvIntroOn() ? WMV.intro.mode : "stagger";
  WMV.preview = { start: performance.now(), tl: { speed: playSpeed, intro: wmvIntroSpec(mode) } };
  wmvPreviewBtn();
}
function wmvPreviewBtn() { document.querySelectorAll(".wm-intro-btn").forEach(b => b.classList.toggle("on", !!WMV.preview)); }

// ---------- 调速面板 ----------
const wmvS2R = (s) => Math.round(Math.log(s / 0.1) / Math.log(80) * 1000);
const wmvR2S = (r) => { const s = 0.1 * Math.pow(80, Math.max(0, Math.min(1000, r)) / 1000); return s >= 1 ? Math.round(s * 20) / 20 : Math.round(s * 100) / 100; };
let wmvPop = null, wmvPopFor = null;
function wmvSetSpeed(s) {
  s = Math.max(0.1, Math.min(8, Math.round(s * 100) / 100));
  playSpeed = s;
  try { localStorage.setItem("wm_speed", String(s)); } catch (e) { }
  if (WMV.preview) { WMV.preview = null; wmvPreviewBtn(); }
  wmvSpeedLabels();
  if (document.getElementById("wmExportModal").classList.contains("open") && !wmExporting) wmExportUpdateInfo();
}
function wmvSpeedLabels() {
  const loop = wmCurDur() / playSpeed;
  const html = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 13l4-5"/><path d="M4.5 18a9 9 0 1 1 15 0"/></svg><span class="v">${wmvFmtSpeed(playSpeed)}</span><span class="l">· ${wmvSec(loop)} 秒/圈</span>`;
  ["btnSpeed", "btnPSpeed"].forEach(id => { const b = document.getElementById(id); if (b) { b.innerHTML = html; b.title = "速度：点击打开面板（- 减速，= 加速，0 复位，滚轮微调）"; } });
  if (wmvPop) {
    wmvPop.querySelector(".hd b").textContent = wmvFmtSpeed(playSpeed);
    wmvPop.querySelector(".hd span").textContent = `${wmvSec(loop)} 秒/圈`;
    const r = wmvPop.querySelector("input"); if (document.activeElement !== r) r.value = wmvS2R(playSpeed);
    wmvPop.querySelectorAll(".chips button").forEach(c => c.classList.toggle("on", +c.dataset.s === playSpeed));
  }
}
function wmvBuildPop() {
  wmvPop = document.createElement("div"); wmvPop.className = "wm-spd-pop";
  wmvPop.innerHTML = `<div class="hd"><b>1×</b><span></span></div><input type="range" min="0" max="1000" step="1"><div class="ticks"><span>0.1×</span><span>1×</span><span>8×</span></div>
    <div class="chips">${WMV_SPEEDS.map(s => `<button data-s="${s}">${s}×</button>`).join("")}</div>
    <div class="kb"><kbd>-</kbd> 减速 · <kbd>=</kbd> 加速 · <kbd>0</kbd> 复位 · 在按钮上滚动滚轮微调<br>舞台、全屏演示、导出、交互网页共用这个速度，速度会记住。</div>`;
  document.body.appendChild(wmvPop);
  // 1x 刻度放在对数位置
  wmvPop.querySelector(".ticks").style.cssText = "position:relative;height:14px";
  wmvPop.querySelectorAll(".ticks span").forEach((sp, i) => { const s = [0.1, 1, 8][i]; sp.style.cssText = `position:absolute;left:${wmvS2R(s) / 10}%;transform:translateX(${i === 0 ? 0 : i === 2 ? -100 : -50}%)`; });
  wmvPop.querySelector("input").addEventListener("input", (e) => wmvSetSpeed(wmvR2S(+e.target.value)));
  wmvPop.querySelector(".chips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) wmvSetSpeed(+b.dataset.s); });
  wmvPop.addEventListener("mousedown", (e) => e.stopPropagation());
  document.addEventListener("mousedown", () => wmvPop.classList.remove("open"));
  window.addEventListener("resize", () => wmvPop.classList.remove("open"));
}
function wmvTogglePop(btn) {
  if (!wmvPop) wmvBuildPop();
  if (wmvPop.classList.contains("open") && wmvPopFor === btn) { wmvPop.classList.remove("open"); return; }
  wmvPopFor = btn; wmvSpeedLabels(); wmvPop.classList.add("open");
  const r = btn.getBoundingClientRect(), pw = 300, ph = wmvPop.offsetHeight || 190;
  let x = Math.min(window.innerWidth - pw - 8, Math.max(8, r.left + r.width / 2 - pw / 2)), y = r.top - ph - 10;
  if (y < 8) y = r.bottom + 10;
  wmvPop.style.left = x + "px"; wmvPop.style.top = y + "px";
}
(function wmvInitSpeed() {
  ["btnSpeed", "btnPSpeed"].forEach(id => {
    const old = document.getElementById(id); if (!old) return;
    const b = old.cloneNode(false); b.id = id; b.className = old.className + " wm-spd-btn"; old.replaceWith(b); // 去掉 v9 的四档循环监听
    b.addEventListener("mousedown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => { e.stopImmediatePropagation(); e.preventDefault(); wmvTogglePop(b); }, true); // capture: v9 的四档循环监听即便后绑定也不会触发
    b.addEventListener("wheel", (e) => { e.preventDefault(); wmvSetSpeed(wmvR2S(wmvS2R(playSpeed) + (e.deltaY < 0 ? 20 : -20))); }, { passive: false });
  });
  // 舞台工具栏：预览入场
  const sp = document.getElementById("btnSpeed");
  if (sp) {
    const pb = document.createElement("button"); pb.className = "tool-btn wm-intro-btn"; pb.id = "btnPreviewIntro"; pb.title = "从头预览入场（使用导出面板里的入场设置；未开启时按逐张预览）";
    pb.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="13" width="5" height="7" rx="1.2"/><rect x="9.5" y="9" width="5" height="11" rx="1.2"/><rect x="16" y="4" width="5" height="16" rx="1.2"/></svg>预览入场`;
    pb.addEventListener("click", () => wmvStartPreview());
    sp.after(pb);
  }
  window.addEventListener("keydown", (e) => {
    const tg = e.target; if (tg && (tg.tagName === "INPUT" && tg.type !== "range" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.getElementById("wmExportModal").classList.contains("open")) return;
    if (e.key === "-" || e.key === "_") { wmvSetSpeed(wmvR2S(wmvS2R(playSpeed) - 60)); e.preventDefault(); }
    else if (e.key === "=" || e.key === "+") { wmvSetSpeed(wmvR2S(wmvS2R(playSpeed) + 60)); e.preventDefault(); }
    else if (e.key === "0") { wmvSetSpeed(1); e.preventDefault(); }
  });
  wmvSpeedLabels();
  const _after = wmAfterSelect;
  wmAfterSelect = function (id) { const r = _after.apply(this, arguments); WMV.preview = null; wmvPreviewBtn(); wmvSpeedLabels(); return r; };
})();

// ---------- 导出：时长 / 帧 / 时间轴 ----------
function wmV10ExportTL() {
  const s = wmExportState;
  const intro = wmvIntroOn() && s.fmt !== "html";
  const mb = WMV.motionBlur && playSpeed >= 4;
  if (!intro && !mb) return null;
  return { speed: playSpeed, intro: wmvIntroSpec(intro ? WMV.intro.mode : "none"), mb };
}
const _wmvMakeFrameOpts = wmMakeFrameOpts;
wmMakeFrameOpts = function (W, H, fps) {
  const tl = wmV10ExportTL();
  if (!tl) return _wmvMakeFrameOpts(W, H, fps); // v9 路径：逐像素一致
  const o = wmExOpts(), now0 = performance.now();
  // 不开入场（仅运动模糊）时从舞台当前相位起拍，与 v9 一致；开入场时从入场第 0 秒起
  const T0 = tl.intro.mode === "none" ? currentTime * wmCurDur() / playSpeed : 0;
  return (i) => ({ w: W, h: H, fps, T: T0 + i / fps, tl, time: 0, now: now0 + i * 1000 / fps, bg: true, grid: o.grid, axes: o.axes });
};
const _wmvExportDuration = wmExportDuration;
wmExportDuration = function () {
  const s = wmExportState;
  if (wmvIntroOn() && s.fmt !== "img" && s.fmt !== "html") {
    const info = wmvInfo();
    if (s.fmt === "gif" && WMV.gifIntroOnly) return info.introWall;
    return info.total(WMV.loops);
  }
  if (s.dur === "custom") return Math.max(0.5, +WMV.customDur || 1);
  return _wmvExportDuration();
};
// 关键帧：可选在前面加入场帧
const _wmvRenderKeyframes = wmRenderKeyframes;
wmRenderKeyframes = async function (W, H, n, fmt, p0 = 0, p1 = 1) {
  const s = wmExportState;
  if (!(s.fmt === "img" && wmvIntroOn() && WMV.kfIntro && n === s.kfN)) return _wmvRenderKeyframes(W, H, n, fmt, p0, p1);
  const ni = Math.max(1, WMV.kfIntroN | 0);
  const tl = { speed: playSpeed, intro: wmvIntroSpec(), mb: false };
  await wmPrepareExportEngine(W, H, 30);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const o = wmExOpts(); const info = wmvInfo(); const out = [];
  const pm = p0 + (p1 - p0) * ni / (ni + n);
  for (let k = 0; k < ni; k++) {
    wmCancelled();
    const T = info.introWall * (k + 1) / (ni + 1);
    renderStudio3D(cv, { w: W, h: H, fps: 30, T, tl, time: 0, now: performance.now(), bg: true, grid: o.grid, axes: o.axes });
    out.push({ phase: 0, introT: T, blob: await wmCanvasBlob(cv, fmt === "jpg" ? "image/jpeg" : "image/png", 0.93) });
    wmExportSetBusy(true, p0 + (pm - p0) * (k + 1) / ni, `入场帧 ${k + 1} / ${ni}`); await wmSleep(0);
  }
  const rest = await _wmvRenderKeyframes(W, H, n, fmt, pm, p1);
  return out.concat(rest);
};

// ---------- 导出面板：入场栏 + 交互网页选项 ----------
(function wmvInitExportUi() {
  const modal = document.getElementById("wmExportModal"); if (!modal) return;
  const bgRow = document.getElementById("wmExBgGrid").closest(".wm-ex-row");
  const seg = (k, map, cls = "") => `<div class="wm-seg ${cls}">${Object.entries(map).map(([v, t]) => `<button data-v10="${k}:${v}">${t}</button>`).join("")}</div>`;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
  <div class="wm-ex-row wm-ex-v10" id="wmExIntroRow">
    <label class="t">入场</label>
    ${seg("mode", { none: "无（默认）", stagger: "逐张入场", whole: "整体入场" })}
    <div class="wm-ex-sub" id="wmExIntroOpts">
      <span>方式</span>${seg("style", WMV_STYLE)}
      <span>顺序</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${seg("order", WMV_ORDER)}<label id="wmExSeedWrap" style="font-size:12px;color:var(--wm-text-3)">种子 <input type="number" id="wmExSeed" min="0" max="9999" step="1"></label></div>
      <span>时长</span><div class="rng"><input type="range" id="wmExIDur" min="0.5" max="8" step="0.1"><b id="wmExIDurV"></b></div>
      <span>停顿</span><div class="rng"><input type="range" id="wmExIHold" min="0" max="3" step="0.1"><b id="wmExIHoldV"></b></div>
      <span class="wm-ex-loops">圈数</span><div class="wm-ex-loops">${seg("loops", { 1: "1 圈", 2: "2 圈", 3: "3 圈", 5: "5 圈" })}</div>
    </div>
    <div class="wm-ex-hint" id="wmExIntroHint"></div>
  </div>
  <div class="wm-ex-row wm-ex-v10" data-for="gif" id="wmExGifIntroRow">
    <label class="t">GIF 与入场</label>
    <div class="wm-checks"><label><input type="checkbox" id="wmExGifIntroOnly">只导出入场段</label><label><input type="checkbox" id="wmExGifOnce">只播放一次（不循环）</label></div>
  </div>
  <div class="wm-ex-row wm-ex-v10" data-for="img" id="wmExKfIntroRow">
    <label class="t">入场帧</label>
    <div class="wm-checks"><label><input type="checkbox" id="wmExKfIntro">包含入场帧</label><label>张数 <input type="number" id="wmExKfIntroN" min="1" max="12" step="1" style="margin-left:6px"></label></div>
  </div>
  <div class="wm-ex-row wm-ex-v10" id="wmExMbRow">
    <label class="t">运动模糊</label>
    <div class="wm-checks"><label><input type="checkbox" id="wmExMb">开启运动模糊（速度 ≥ 4× 时推荐，导出会变慢）</label></div>
  </div>
  <div class="wm-ex-row wm-ex-v10" data-for="html"><label class="t">播放</label>${seg("autoplay", { 1: "打开即自动播放", 0: "点击后播放" })}</div>
  <div class="wm-ex-row wm-ex-v10" data-for="html"><label class="t">控件</label>${seg("controls", { 1: "显示（右下角，鼠标不动自动隐藏）", 0: "隐藏" })}</div>
  <div class="wm-ex-row wm-ex-v10" data-for="html" id="wmExBatchRow"><label class="t">图片批次</label>${seg("allBatches", { 0: "只含当前批", 1: "包含全部批次（可在网页里切换）" })}</div>
  <div class="wm-ex-row wm-ex-v10" data-for="html"><label class="t">图片尺寸（长边）</label>${seg("imgMax", { 1024: "1024", 1600: "1600", orig: "原图" })}</div>`;
  [...wrap.children].forEach(el => bgRow.before(el));
  // 时长：慢速时可选自定义秒数
  const durSeg = document.getElementById("wmExLoopLabel").parentElement;
  const cb = document.createElement("button"); cb.dataset.ex = "dur:custom"; cb.id = "wmExDurCustomBtn"; cb.textContent = "自定义";
  durSeg.appendChild(cb);
  const ci = document.createElement("input"); ci.type = "number"; ci.id = "wmExDurCustom"; ci.min = "1"; ci.max = "600"; ci.step = "1"; ci.title = "秒"; durSeg.appendChild(ci);
  cb.addEventListener("click", () => { if (wmExporting) return; wmExportState.dur = "custom"; wmExportUpdateInfo(); });
  ci.addEventListener("input", () => { WMV.customDur = Math.max(1, +ci.value || 1); wmExportState.dur = "custom"; wmvSave(); wmExportUpdateInfo(); });
  const durRow = durSeg.closest(".wm-ex-row"); durRow.id = "wmExDurRow";

  modal.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v10]"); if (!b || wmExporting) return;
    const [k, v] = b.dataset.v10.split(":");
    if (k === "mode") { if (v === "stagger" && b.classList.contains("wm-dis")) { /* 仍可选，提示会说明自动改为整体 */ } WMV.intro.mode = v; }
    else if (k === "style" || k === "order") WMV.intro[k] = v;
    else if (k === "loops") WMV.loops = +v;
    else if (k === "autoplay" || k === "controls" || k === "allBatches") WMV.player[k] = v === "1";
    else if (k === "imgMax") WMV.player.imgMax = v === "orig" ? "orig" : +v;
    wmvSave(); wmExportUpdateInfo();
  });
  const num = (id, f) => document.getElementById(id).addEventListener("input", (e) => { f(e.target); wmvSave(); wmExportUpdateInfo(); });
  num("wmExIDur", (el) => WMV.intro.dur = +el.value);
  num("wmExIHold", (el) => WMV.intro.hold = +el.value);
  num("wmExSeed", (el) => WMV.intro.seed = Math.max(0, +el.value | 0));
  num("wmExKfIntroN", (el) => WMV.kfIntroN = Math.max(1, Math.min(12, +el.value | 0)));
  const chk = (id, f) => document.getElementById(id).addEventListener("change", (e) => { f(e.target.checked); wmvSave(); wmExportUpdateInfo(); });
  chk("wmExGifIntroOnly", (v) => WMV.gifIntroOnly = v);
  chk("wmExGifOnce", (v) => WMV.gifOnce = v);
  chk("wmExKfIntro", (v) => WMV.kfIntro = v);
  chk("wmExMb", (v) => WMV.motionBlur = v);
})();

function wmvHtmlEstimate() {
  const id = selectedId, P = WMV.player;
  let imgs = wmActiveImgs(id);
  if (P.allBatches && wmUserImgs.length) { const bi = wmBatchInfo(id); if (bi.count > 1) imgs = wmUserImgs; }
  let bytes = 0;
  const S = document.getElementById("wmEngineScript"); bytes += S ? S.textContent.length : 440000;
  bytes += 30000;
  for (const im of imgs) {
    const w = im.naturalWidth || im.width || 1200, h = im.naturalHeight || im.height || 900;
    const k = P.imgMax === "orig" ? 1 : Math.min(1, P.imgMax / Math.max(w, h));
    bytes += (P.imgMax === "orig" && im._blob ? im._blob.size : w * h * k * k * 0.17) * 1.37;
  }
  if (wmStageBgImageUrl()) bytes += 220000;
  return { bytes, n: imgs.length };
}

const _wmvUpdateInfo = wmExportUpdateInfo;
wmExportUpdateInfo = function () {
  _wmvUpdateInfo.apply(this, arguments);
  const s = wmExportState, I = WMV.intro, on = wmvIntroOn(), html = s.fmt === "html";
  const $ = (id) => document.getElementById(id);
  const setSeg = (k, v) => document.querySelectorAll(`#wmExportModal [data-v10^="${k}:"]`).forEach(b => b.classList.toggle("active", b.dataset.v10 === `${k}:${v}`));
  setSeg("mode", I.mode); setSeg("style", I.style); setSeg("order", I.order); setSeg("loops", WMV.loops);
  setSeg("autoplay", WMV.player.autoplay ? 1 : 0); setSeg("controls", WMV.player.controls ? 1 : 0); setSeg("allBatches", WMV.player.allBatches ? 1 : 0); setSeg("imgMax", WMV.player.imgMax);
  $("wmExIDur").value = I.dur; $("wmExIDurV").textContent = (+I.dur).toFixed(1) + " 秒";
  $("wmExIHold").value = I.hold; $("wmExIHoldV").textContent = (+I.hold).toFixed(1) + " 秒";
  $("wmExSeed").value = I.seed; $("wmExSeedWrap").style.display = I.order === "random" ? "" : "none";
  $("wmExIntroOpts").classList.toggle("hide", !on);
  document.querySelectorAll("#wmExIntroOpts .wm-ex-loops").forEach(el => el.style.display = (html || s.fmt === "img" || (s.fmt === "gif" && WMV.gifIntroOnly)) ? "none" : "");
  $("wmExGifIntroRow").classList.toggle("hide", s.fmt !== "gif" || !on);
  $("wmExKfIntroRow").classList.toggle("hide", s.fmt !== "img" || !on || !!s.kfAlpha);
  $("wmExGifIntroOnly").checked = WMV.gifIntroOnly; $("wmExGifOnce").checked = WMV.gifOnce; $("wmExKfIntro").checked = WMV.kfIntro; $("wmExKfIntroN").value = WMV.kfIntroN;
  $("wmExMbRow").classList.toggle("hide", playSpeed < 4 || html || s.fmt === "img"); $("wmExMb").checked = WMV.motionBlur;
  // 逐张入场是否适合当前动效
  const ok = wmvStaggerOk(selectedId);
  const sb = document.querySelector('#wmExportModal [data-v10="mode:stagger"]'); sb.classList.toggle("wm-dis", !ok);
  sb.title = ok ? "" : "该动效同屏少于 3 张卡（全屏幻灯类），逐张入场会自动改为整体淡入";
  // 时长行：开入场后由「入场 + N 圈」决定；慢速时提供自定义秒数
  const durRow = $("wmExDurRow");
  if (on && !html && s.fmt !== "img") durRow.classList.add("hide");
  $("wmExDurCustomBtn").style.display = playSpeed < 1 || s.dur === "custom" ? "" : "none";
  $("wmExDurCustom").style.display = s.dur === "custom" ? "" : "none"; $("wmExDurCustom").value = WMV.customDur;
  $("wmExLoopLabel").textContent = `1 圈（${wmvSec(wmCurDur() / playSpeed)} 秒）`;
  const info = wmvInfo(); const d = wmExportDuration();
  const hint = [];
  if (on && !ok && I.mode === "stagger") hint.push("该动效同屏少于 3 张卡，逐张入场会自动改为整体淡入。");
  if (on && s.fmt === "gif" && !WMV.gifIntroOnly && !WMV.gifOnce) hint.push("GIF 每次循环都会重播入场；想要无缝循环，选「只导出入场段」或「只播放一次」，或入场选「无」。");
  if (playSpeed >= 4 && !WMV.motionBlur && !html && s.fmt !== "img") hint.push(`速度 ${wmvFmtSpeed(playSpeed)}，建议开启运动模糊，画面更顺。`);
  if (d > 60 && !html && s.fmt !== "img") hint.push(`实际时长 ${wmvSec(d)} 秒，导出会比较久。`);
  $("wmExIntroHint").textContent = hint.join(" ");
  // 信息行：显示实际时长与构成
  const el = $("wmExInfo");
  if (html) {
    const est = wmvHtmlEstimate(); const bi = wmUserImgs.length ? wmBatchInfo(selectedId) : { count: 1 };
    $("wmExBatchRow").classList.toggle("dim", bi.count <= 1);
    el.textContent = `交互网页 · 单个 .html，双击即可离线播放 · 速度 ${wmvFmtSpeed(playSpeed)} · 默认入场：${on ? (I.mode === "whole" ? "整体" : "逐张") : "无"} · ${est.n} 张图${WMV.player.allBatches && bi.count > 1 ? `（${bi.count} 批）` : ""} · 预估约 ${(est.bytes / 1048576).toFixed(1)} MB`;
  } else if (on && s.fmt !== "img") {
    const parts = s.fmt === "gif" && WMV.gifIntroOnly ? `入场 ${wmvSec(info.introWall)} 秒` : `入场 ${wmvSec(info.introWall)} 秒 + ${WMV.loops} 圈 × ${wmvSec(info.loopWall)} 秒`;
    el.textContent = `实际时长 ${wmvSec(d)} 秒（${parts}，速度 ${wmvFmtSpeed(playSpeed)}）· ` + el.textContent.replace(/[\d.]+ 秒 · /, "");
  } else if (s.fmt === "img" && on && WMV.kfIntro && !s.kfAlpha) {
    el.textContent = `${WMV.kfIntroN} 张入场帧 + ` + el.textContent;
  } else if (s.fmt !== "img") {
    el.textContent = `实际时长 ${wmvSec(d)} 秒（速度 ${wmvFmtSpeed(playSpeed)}）· ` + el.textContent;
  }
  $("wmExGo").textContent = html ? "导出交互网页" : "开始导出";
};

// ---------- 交互网页导出（播放器模板来自 skill：engine/player/player.html） ----------
async function wmvGunzipText(b64) {
  const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}
function wmvBlobToDataUrl(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
async function wmvEncodeImg(src, max) {
  if (max === "orig" || /^data:image\/(svg|gif)/.test(src)) { if (src.startsWith("data:")) return src; const r = await fetch(src); return wmvBlobToDataUrl(await r.blob()); }
  const im = await wmLoadImg(src);
  const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, k = Math.min(1, max / Math.max(w, h));
  const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
  const g = cv.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, cv.width, cv.height);
  const png = /^data:image\/png|\.png(\?|$)/i.test(src) || (im._type || "").includes("png");
  if (png) { // 带透明的 PNG 保留 PNG
    const d = g.getImageData(0, 0, cv.width, cv.height).data; let a = false; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) { a = true; break; }
    if (a) return cv.toDataURL("image/png");
  }
  return cv.toDataURL("image/jpeg", 0.86);
}
async function wmV10ExportHtml() {
  const id = selectedId, t = TEMPLATES.find(x => x.id === id) || TEMPLATES[0], P = WMV.player, tpl = wmTpl(id);
  wmExportSetBusy(true, 0.02, "读取播放器模板…");
  const tplEl = document.getElementById("wmPlayerTpl"), engEl = document.getElementById("wmEngineScript");
  if (!tplEl || !engEl) throw new Error("页面缺少播放器模板或引擎（请用 skill 的 tools/build-web.mjs 重新构建网页）");
  const playerHtml = await wmvGunzipText(tplEl.textContent.trim());
  // 图片批次
  let groups;
  if (!wmUserImgs.length) groups = [wmFaceImgs()];
  else { const bi = wmBatchInfo(id); if (P.allBatches && bi.count > 1) { groups = []; for (let k = 0; k < bi.count; k++) { const st = Math.min(k * bi.cap, bi.N - bi.cap); groups.push(wmUserImgs.slice(st, st + bi.cap)); } } else groups = [wmActiveImgs(id)]; }
  const total = groups.reduce((n, g) => n + g.length, 0); const cache = new Map(); let k = 0;
  const batches = [];
  for (const g of groups) {
    const out = [];
    for (const im of g) {
      wmCancelled();
      const src = im.src; if (!cache.has(src)) cache.set(src, await wmvEncodeImg(src, P.imgMax));
      out.push(cache.get(src)); k++;
      wmExportSetBusy(true, 0.05 + 0.8 * k / total, `嵌入图片 ${k} / ${total}`); await wmSleep(0);
    }
    batches.push(out);
  }
  const bg = Object.assign({}, wmStageBgSpec()); let bgImage = null;
  const bu = wmStageBgImageUrl();
  if (bg.type === "image" && bu) { bgImage = bu.startsWith("data:") ? bu : await wmvBlobToDataUrl(await (await fetch(bu)).blob()); }
  const spec = { duration: (tpl && tpl.duration) || 16, fps: 30, params: wmTplParams(id), fx: {}, background: bg };
  const cnt = wmSpecCount(wmMediaList(id)); if (cnt) spec.count = cnt;
  let focusB = null; if (typeof wmAdSpec === "function") { const ad = wmAdSpec(null); Object.assign(spec, ad); if (ad.cardRatio && wmUserImgs.length) { const fb = groups.map(g => g.map(im => im && im._wmFocus ? [+im._wmFocus[0].toFixed(3), +im._wmFocus[1].toFixed(3)] : null)); if (fb.some(g => g.some(Boolean))) focusB = fb; } } // v10.2
  const mode = wmvIntroOn() ? WMV.intro.mode : "none";
  const bi = wmUserImgs.length ? wmBatchInfo(id) : { idx: 0 };
  const data = { v: 10, template: id, title: `${t.zhName} · ${t.name}`, aspect: (typeof wmAdCanvasR === "function" && wmAdCanvasR()) || 16 / 9, spec, speed: playSpeed, intro: wmvIntroSpec(mode),
    player: { controls: P.controls, autoplay: P.autoplay, imgMax: P.imgMax, allBatches: P.allBatches, defaultIntro: mode }, batches, batch: batches.length > 1 ? bi.idx : 0, focusB, bgImage, audio: typeof wmaForHtml === "function" ? await wmaForHtml() : null };
  wmExportSetBusy(true, 0.9, "生成网页…");
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const loader = "<script>" + engEl.textContent + "<\/script>";
  const html = playerHtml.split("{{TITLE}}").join(esc(data.title + " · WANG MOTION")).replace("{{DATA}}", () => json).replace("<!--WM_ENGINE-->", () => loader);
  const blob = new Blob([html], { type: "text/html" });
  window.wmLastExport = { size: blob.size, type: blob.type, images: total, batches: batches.length, audio: data.audio ? (data.audio.src.startsWith("data:") ? "embedded" : "linked") : null };
  wmDownloadBlob(blob, `wangmotion_${id}.html`);
  return blob;
}
const _wmvStartExport = wmStartExport;
wmStartExport = async function () {
  if (wmExportState.fmt !== "html") return _wmvStartExport.apply(this, arguments);
  if (wmExporting) return;
  wmExporting = true; wmExportState.cancel = false;
  try { const b = await wmV10ExportHtml(); wmExportSetBusy(false, 1, `完成：${(b.size / 1048576).toFixed(1)} MB · 交互网页（双击打开即可播放）`); }
  catch (e) { if (e && e.cancelled) wmExportSetBusy(false, 0, "已取消"); else { console.error(e); wmExportSetBusy(false, 0, `导出失败：${(e && e.message) || e}`); } }
  finally { wmExporting = false; }
};

// ---------- 复制给 Agent：加入速度 / 入场参数与 wm html 命令 ----------
function wmvCliFlags() {
  let f = "";
  if (playSpeed !== 1) f += ` --speed ${playSpeed}`;
  if (wmvIntroOn()) { const I = WMV.intro; f += ` --intro ${I.mode} --intro-style ${I.style} --intro-order ${I.order} --intro-dur ${I.dur} --intro-hold ${I.hold}`; if (I.order === "random") f += ` --intro-seed ${I.seed}`; }
  return f;
}
const _wmvAgCmd = wmAgCmd;
wmAgCmd = function (id) { let c = _wmvAgCmd(id); const f = wmvCliFlags(); if (f) c = c.replace(` --out ${id}.mp4`, `${f}${wmvIntroOn() && WMV.loops !== 1 ? ` --loops ${WMV.loops}` : ""} --out ${id}.mp4`); return c; };
function wmvAgHtmlCmd(id) { const P = WMV.player; return `wm html ${id} --media-dir ./media${wmAgPrm(id)}${wmvCliFlags()}${wmvIntroOn() ? "" : " --intro stagger"}${P.controls ? "" : " --controls false"}${P.autoplay ? "" : " --autoplay false"}${P.allBatches ? " --all-batches" : ""} --img-max ${P.imgMax === "orig" ? "orig" : P.imgMax} --out ${id}.html`; }
const _wmvAgBlock = wmAgBlock;
wmAgBlock = function (id, i, n, full) { const L = _wmvAgBlock.apply(this, arguments); const k = L.findIndex(x => x.startsWith("- 命令：")); L.splice(k + 1, 0, `- 交互网页（单文件、离线播放，可切换逐张 / 整体入场）：\`${wmvAgHtmlCmd(id)}\``); return L; };
const _wmvAgSpec = wmAgSpec;
wmAgSpec = function (id) { const s = _wmvAgSpec(id); if (playSpeed !== 1) s.speed = playSpeed; if (wmvIntroOn()) { s.intro = wmvIntroSpec(); s.loops = WMV.loops; } return s; };

// ZIP 的 spec.json：记录速度、入场与交互网页设置（wm render --spec spec.json 原样复现）
function wmvPatchZipSpec(spec, dur) {
  const on = wmvIntroOn();
  if (!on && playSpeed === 1 && wmExportState.dur !== "custom") return; // 与 v9 完全相同
  const tpl = wmTpl(spec.template);
  spec.duration = (tpl && tpl.duration) || 16;           // 1× 下一圈的秒数（v9 含义）
  if (playSpeed !== 1) spec.speed = playSpeed;
  if (on) { spec.intro = wmvIntroSpec(); spec.loops = WMV.loops; }
  else if (wmExportState.dur === "loop") spec.loops = 1;
  else spec.length = +dur.toFixed(3);                     // 固定秒数（墙钟）
  spec.player = { controls: WMV.player.controls, autoplay: WMV.player.autoplay, imgMax: WMV.player.imgMax, allBatches: WMV.player.allBatches };
}
