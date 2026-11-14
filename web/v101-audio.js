// ==========================================
// WANG MOTION v10.1：背景音乐（本地文件或网址）
// 主网页预览 / 演示、MP4 / PPTX / ZIP 导出、交互网页导出共用同一套设置与规则：
//  · 音乐从入场第 0 秒起按墙钟播放，调速不改变音乐；
//  · 视频长度仍由动画决定（音乐短就循环，长就在结尾淡出切掉）；可选「长度跟音乐」自动算圈数；
//  · 声音默认开启（浏览器拦截自动出声时，第一次点击 / 按键即出声）。
// 由 skill 的 tools/build-web.mjs 注入；不加音乐时所有导出与 v10 完全一致。
// ==========================================
const WMA = {
  kind: null, name: "", url: "", blob: null, objUrl: "", len: 0, ok: false, err: "",
  volume: 0.8, offset: 0, fadeIn: 0.5, fadeOut: 1, loop: true, fit: false, muted: false, link: false,
  buf: null, bufKey: "",
};
const wmaPanels = [];
let wmaPop = null, wmaPopFor = null;
const wmaEl = new Audio(); wmaEl.preload = "auto";
let wmaBlocked = false, wmaPending = false, wmaRamp = 0, wmaWasOn = false;
try { const v = JSON.parse(localStorage.getItem("wm_audio") || "null"); if (v) ["volume", "offset", "fadeIn", "fadeOut", "loop", "fit", "muted", "link", "kind", "name", "url"].forEach(k => { if (v[k] != null) WMA[k] = v[k]; }); } catch (e) { }
function wmaSave() { try { localStorage.setItem("wm_audio", JSON.stringify({ volume: WMA.volume, offset: WMA.offset, fadeIn: WMA.fadeIn, fadeOut: WMA.fadeOut, loop: WMA.loop, fit: WMA.fit, muted: WMA.muted, link: WMA.link, kind: WMA.kind, name: WMA.name, url: WMA.url })); } catch (e) { } }
function wmaOn() { return !!(WMA.kind && WMA.ok); }
function wmaSrc() { return WMA.kind === "file" ? WMA.objUrl : WMA.url; }
function wmaFmtLen(x) { if (!(x > 0)) return ""; const m = Math.floor(x / 60), s = Math.round(x % 60); return `${m}:${String(s).padStart(2, "0")}`; }

// ---------- 本地文件存 IndexedDB（刷新后还在） ----------
function wmaDb() { return new Promise((res, rej) => { const r = indexedDB.open("wm-audio", 1); r.onupgradeneeded = () => r.result.createObjectStore("f"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function wmaDbPut(blob) { try { const db = await wmaDb(); await new Promise((res, rej) => { const t = db.transaction("f", "readwrite"); t.objectStore("f").put(blob, "music"); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { console.warn("[wm audio] save", e); } }
async function wmaDbGet() { try { const db = await wmaDb(); return await new Promise((res) => { const q = db.transaction("f").objectStore("f").get("music"); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function wmaDbDel() { try { const db = await wmaDb(); db.transaction("f", "readwrite").objectStore("f").delete("music"); } catch (e) { } }

function wmaLoadEl(src) {
  return new Promise((res) => {
    WMA.ok = false; WMA.len = 0; WMA.err = "";
    const done = (ok, err) => { wmaEl.onloadedmetadata = wmaEl.onerror = null; WMA.ok = ok; WMA.err = err || ""; WMA.len = ok && isFinite(wmaEl.duration) ? wmaEl.duration : 0; wmaRefresh(); res(ok); };
    wmaEl.onloadedmetadata = () => done(true);
    wmaEl.onerror = () => done(false, "无法播放这个音频（格式不支持或链接打不开）");
    wmaEl.src = src; wmaEl.loop = WMA.loop; wmaEl.load();
  });
}
async function wmaSetFile(file) {
  if (!file) return;
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i.test(file.name)) { WMA.err = "请选择音频文件（MP3 / M4A / WAV / OGG / FLAC）"; wmaRefresh(); return; }
  if (WMA.objUrl) URL.revokeObjectURL(WMA.objUrl);
  WMA.kind = "file"; WMA.name = file.name; WMA.blob = file; WMA.objUrl = URL.createObjectURL(file); WMA.url = ""; WMA.buf = null; WMA.bufKey = "";
  wmaSave(); wmaDbPut(file);
  await wmaLoadEl(WMA.objUrl); wmaRestart();
}
async function wmaSetUrl(u) {
  u = String(u || "").trim(); if (!u) return;
  if (!/^https?:\/\//i.test(u)) { WMA.err = "请输入 http(s) 开头的音频网址"; wmaRefresh(); return; }
  if (WMA.objUrl) { URL.revokeObjectURL(WMA.objUrl); WMA.objUrl = ""; }
  WMA.kind = "url"; WMA.url = u; WMA.blob = null; WMA.buf = null; WMA.bufKey = "";
  try { WMA.name = decodeURIComponent(new URL(u).pathname.split("/").pop()) || u; } catch (e) { WMA.name = u; }
  wmaSave(); wmaDbDel();
  await wmaLoadEl(u); wmaRestart();
}
function wmaClear() {
  wmaEl.pause(); wmaEl.removeAttribute("src"); wmaEl.load();
  if (WMA.objUrl) URL.revokeObjectURL(WMA.objUrl);
  Object.assign(WMA, { kind: null, name: "", url: "", blob: null, objUrl: "", len: 0, ok: false, err: "", buf: null, bufKey: "" });
  wmaSave(); wmaDbDel(); wmaRefresh();
}
(async function wmaRestore() {
  if (WMA.kind === "file") { const b = await wmaDbGet(); if (b) { WMA.blob = b; WMA.objUrl = URL.createObjectURL(b); await wmaLoadEl(WMA.objUrl); } else { WMA.kind = null; wmaSave(); } }
  else if (WMA.kind === "url" && WMA.url) await wmaLoadEl(WMA.url);
  wmaRefresh();
})();

// ---------- 主网页播放：舞台 / 演示播放时出声，暂停、切走、导出、看宣传片时停 ----------
function wmaWant() {
  if (!wmaOn() || WMA.muted || document.hidden || wmExporting || !isPlaying) return false;
  const promo = document.getElementById("promoVideoModal");
  if (promo && promo.style.display !== "none") return false;
  const pres = document.getElementById("presentFullscreen");
  return currentView === "studio" || !!(pres && pres.classList.contains("open"));
}
function wmaRestart() { // 从音乐的起点（偏移处）重新开始，带淡入
  if (!wmaOn()) return;
  try { wmaEl.currentTime = WMA.offset < WMA.len ? WMA.offset : 0; } catch (e) { }
  wmaRamp = 0; wmaWasOn = false;
}
function wmaArmUnlock() {
  if (wmaArmUnlock.on) return; wmaArmUnlock.on = true;
  const go = () => { wmaArmUnlock.on = false; wmaBlocked = false; ["pointerdown", "keydown", "touchstart"].forEach(k => removeEventListener(k, go, true)); };
  ["pointerdown", "keydown", "touchstart"].forEach(k => addEventListener(k, go, true));
}
let wmaLast = 0;
function wmaTick(now) {
  requestAnimationFrame(wmaTick);
  const dt = wmaLast ? Math.min(0.1, (now - wmaLast) / 1000) : 0; wmaLast = now;
  const want = wmaWant();
  if (!want) { if (!wmaEl.paused) wmaEl.pause(); wmaWasOn = false; return; }
  if (!wmaWasOn) { wmaRamp = 0; wmaWasOn = true; }
  wmaRamp += dt;
  if (!WMA.loop && wmaEl.ended) return;
  const fi = +WMA.fadeIn || 0;
  wmaEl.volume = Math.max(0, Math.min(1, WMA.volume * (fi > 0 ? Math.min(1, wmaRamp / fi) : 1)));
  if (wmaEl.paused && !wmaBlocked && !wmaPending) {
    wmaPending = true;
    wmaEl.play().then(() => { wmaPending = false; }, () => { wmaPending = false; wmaBlocked = true; wmaArmUnlock(); });
  }
}
requestAnimationFrame(wmaTick);
document.addEventListener("visibilitychange", () => { if (document.hidden) wmaEl.pause(); });
// 停止要立即生效（舞台渲染很重时 rAF 可能很慢）：按钮 / 切换后马上检查一次，另有 250 ms 兜底
function wmaStopNow() { if (!wmaWant() && !wmaEl.paused) { wmaEl.pause(); wmaWasOn = false; } }
setInterval(wmaStopNow, 250);
["btnPlayPause", "btnPPlayPause"].forEach(id => document.getElementById(id)?.addEventListener("click", () => setTimeout(wmaStopNow, 0)));
// 预览入场：音乐跟着从头开始
if (typeof wmvStartPreview === "function") { const _p = wmvStartPreview; wmvStartPreview = function () { const r = _p.apply(this, arguments); wmaRestart(); return r; }; }

// ---------- 面板（舞台工具栏 / 演示工具栏的 🎵 弹层，和导出面板里的一行，共用同一份状态） ----------
const WMA_IC = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
function wmaPanel(root, opts = {}) {
  root.classList.add("wma-panel");
  root.innerHTML = `
    <div class="wma-src">
      <button class="wma-btn wma-up">${WMA_IC}<span>上传本地音乐</span></button>
      <input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac" hidden>
      <div class="wma-url"><input type="url" placeholder="或粘贴音频网址 https://…"><button class="wma-btn wma-go">载入</button></div>
    </div>
    <div class="wma-cur"><span class="wma-name"></span><span class="wma-len"></span><button class="wma-btn wma-mute" title="静音 / 开启声音"></button><button class="wma-btn wma-del" title="移除音乐">移除</button></div>
    <div class="wma-err"></div>
    <div class="wma-grid">
      <span>音量</span><div class="rng"><input type="range" data-k="volume" min="0" max="1" step="0.01"><b></b></div>
      <span>从第几秒</span><div class="rng"><input type="range" data-k="offset" min="0" max="60" step="0.5"><b></b></div>
      <span>淡入</span><div class="rng"><input type="range" data-k="fadeIn" min="0" max="5" step="0.1"><b></b></div>
      ${opts.export ? `<span>结尾淡出</span><div class="rng"><input type="range" data-k="fadeOut" min="0" max="5" step="0.1"><b></b></div>` : ""}
      <span></span><div class="wma-checks"><label><input type="checkbox" data-c="loop">音乐比视频短时循环</label>${opts.export ? `<label class="wma-fit"><input type="checkbox" data-c="fit">视频长度跟音乐（自动算圈数）</label><label class="wma-link"><input type="checkbox" data-c="link">交互网页只引用网址（文件小，需联网才有声）</label>` : ""}</div>
    </div>
    ${opts.export ? `<div class="wma-hint"></div>` : ""}`;
  const q = (s) => root.querySelector(s);
  q(".wma-up").addEventListener("click", () => q('input[type=file]').click());
  q('input[type=file]').addEventListener("change", (e) => { wmaSetFile(e.target.files[0]); e.target.value = ""; });
  q(".wma-go").addEventListener("click", () => wmaSetUrl(q('.wma-url input').value));
  q('.wma-url input').addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") wmaSetUrl(e.target.value); });
  q(".wma-del").addEventListener("click", () => wmaClear());
  q(".wma-mute").addEventListener("click", () => { WMA.muted = !WMA.muted; wmaSave(); wmaRefresh(); wmaStopNow(); });
  root.querySelectorAll("input[data-k]").forEach(el => el.addEventListener("input", () => {
    WMA[el.dataset.k] = +el.value; if (el.dataset.k === "offset") wmaRestart(); wmaSave(); wmaRefresh(true);
  }));
  root.querySelectorAll("input[data-c]").forEach(el => el.addEventListener("change", () => { WMA[el.dataset.c] = el.checked; wmaEl.loop = WMA.loop; wmaSave(); wmaRefresh(); }));
  root.addEventListener("mousedown", (e) => e.stopPropagation());
  root.addEventListener("keydown", (e) => e.stopPropagation());
  wmaPanels.push({ root, opts });
  wmaRefresh();
  return root;
}
function wmaRefresh(fromSlider) {
  for (const { root, opts } of wmaPanels) {
    const q = (s) => root.querySelector(s);
    const on = !!WMA.kind;
    q(".wma-cur").style.display = on ? "" : "none";
    q(".wma-grid").style.display = on ? "" : "none";
    q(".wma-name").textContent = (WMA.kind === "url" ? "🔗 " : "🎵 ") + (WMA.name || "");
    q(".wma-name").title = WMA.kind === "url" ? WMA.url : WMA.name;
    q(".wma-len").textContent = WMA.ok ? wmaFmtLen(WMA.len) : (WMA.kind && !WMA.err ? "读取中…" : "");
    q(".wma-mute").textContent = WMA.muted ? "🔇 已静音" : "🔊 声音开";
    q(".wma-mute").classList.toggle("on", !WMA.muted);
    q(".wma-err").textContent = WMA.err; q(".wma-err").style.display = WMA.err ? "" : "none";
    if (WMA.kind === "url" && document.activeElement !== q('.wma-url input')) q('.wma-url input').value = WMA.url;
    if (WMA.kind !== "url" && document.activeElement !== q('.wma-url input') && !fromSlider) q('.wma-url input').value = "";
    const om = q('input[data-k="offset"]'); if (om) om.max = String(Math.max(1, Math.floor(WMA.len || 60)));
    root.querySelectorAll("input[data-k]").forEach(el => {
      const k = el.dataset.k; if (document.activeElement !== el) el.value = WMA[k];
      el.nextElementSibling.textContent = k === "volume" ? Math.round(WMA[k] * 100) + "%" : (+WMA[k]).toFixed(1) + " 秒";
    });
    root.querySelectorAll("input[data-c]").forEach(el => el.checked = !!WMA[el.dataset.c]);
    const lk = q(".wma-link"); if (lk) lk.style.display = WMA.kind === "url" ? "" : "none";
  }
  document.querySelectorAll(".wma-tool").forEach(b => { b.classList.toggle("on", wmaOn() && !WMA.muted); b.title = wmaOn() ? `背景音乐：${WMA.name}${WMA.muted ? "（已静音）" : ""}` : "背景音乐：上传本地文件或粘贴网址"; });
  if (typeof wmExportUpdateInfo === "function" && document.getElementById("wmExportModal")?.classList.contains("open")) wmExportUpdateInfo();
  if (wmaPop?.classList.contains("open")) wmaPlacePop();
}

// 工具栏按钮 + 弹层
function wmaPlacePop() {
  if (!wmaPop || !wmaPopFor) return;
  const r = wmaPopFor.getBoundingClientRect(), pw = wmaPop.offsetWidth, ph = wmaPop.offsetHeight;
  const x = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left + r.width / 2 - pw / 2));
  let y = r.top - ph - 10;
  if (y < 8) y = r.bottom + 10;
  y = Math.max(8, Math.min(y, window.innerHeight - ph - 8));
  wmaPop.style.left = x + "px"; wmaPop.style.top = y + "px";
}
function wmaTogglePop(btn) {
  if (!wmaPop) { wmaPop = document.createElement("div"); wmaPop.className = "wm-spd-pop wma-pop"; wmaPop.innerHTML = `<div class="hd"><b>背景音乐</b><span>预览、演示与导出共用</span></div><div class="wma-body"></div>`; document.body.appendChild(wmaPop); wmaPanel(wmaPop.querySelector(".wma-body")); wmaPop.addEventListener("mousedown", (e) => e.stopPropagation()); document.addEventListener("mousedown", () => wmaPop.classList.remove("open")); window.addEventListener("resize", () => wmaPop.classList.remove("open")); }
  if (wmaPop.classList.contains("open") && wmaPopFor === btn) { wmaPop.classList.remove("open"); return; }
  wmaPopFor = btn; wmaPop.classList.add("open"); wmaRefresh();
}
(function wmaInitTools() {
  const mk = (after) => {
    if (!after) return;
    const b = document.createElement("button"); b.className = "tool-btn wma-tool"; b.innerHTML = WMA_IC + "<span>音乐</span>";
    b.addEventListener("mousedown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => { e.stopImmediatePropagation(); wmaTogglePop(b); }, true);
    after.after(b);
  };
  mk(document.getElementById("btnPreviewIntro") || document.getElementById("btnSpeed"));
  mk(document.getElementById("btnPSpeed"));
  // 导出面板里的一行（放在入场栏之前）
  const introRow = document.getElementById("wmExIntroRow");
  if (introRow) {
    const row = document.createElement("div"); row.className = "wm-ex-row wm-ex-v10"; row.id = "wmExAudioRow";
    row.innerHTML = `<label class="t">背景音乐</label><div class="wma-host"></div>`;
    introRow.before(row); wmaPanel(row.querySelector(".wma-host"), { export: true });
  }
  window.addEventListener("keydown", (e) => {
    const tg = e.target; if (tg && (tg.tagName === "INPUT" && tg.type !== "range" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === "m" || e.key === "M") && wmaOn() && !document.getElementById("wmExportModal").classList.contains("open")) { WMA.muted = !WMA.muted; wmaSave(); wmaRefresh(); wmaStopNow(); e.preventDefault(); }
  });
  wmaRefresh();
})();

// ---------- 导出：哪些格式带声、时长跟音乐 ----------
function wmaFmtHasSound(fmt) { return fmt === "mp4" || fmt === "pptx" || fmt === "zip" || fmt === "html"; }
function wmaFitLoops() {
  const info = wmvInfo(); const L = WMA.len - WMA.offset;
  if (!(L > 0)) return null;
  const pre = wmvIntroOn() ? info.preWall : 0;
  return { loops: Math.max(1, Math.ceil((L - pre) / info.loopWall - 1e-6)), pre, loopWall: info.loopWall, L };
}
function wmaFitActive() { const f = wmExportState.fmt; return wmaOn() && WMA.fit && (f === "mp4" || f === "pptx" || f === "zip"); }
{
  const _d = wmExportDuration;
  wmExportDuration = function () {
    if (wmaFitActive()) { const r = wmaFitLoops(); if (r) return r.pre + r.loops * r.loopWall; }
    return _d.apply(this, arguments);
  };
  const _u = wmExportUpdateInfo;
  wmExportUpdateInfo = function () {
    _u.apply(this, arguments);
    const row = document.getElementById("wmExAudioRow"); if (!row) return;
    const f = wmExportState.fmt, hint = row.querySelector(".wma-hint");
    row.classList.toggle("dim", !wmaFmtHasSound(f));
    const fit = row.querySelector(".wma-fit"); if (fit) fit.style.display = (f === "mp4" || f === "pptx" || f === "zip") ? "" : "none";
    const h = [];
    if (WMA.kind && !wmaFmtHasSound(f)) h.push(f === "gif" ? "GIF 不支持声音，导出时不含音乐。" : "图片不含声音。");
    if (wmaOn() && f === "html") h.push(WMA.kind === "url" && WMA.link ? "网页里引用音乐网址：打开网页时需要联网才有声音。" : `音乐会打包进网页（约 +${((WMA.blob ? WMA.blob.size : 4e6) * 1.37 / 1048576).toFixed(1)} MB），离线也有声。`);
    if (wmaOn() && (f === "mp4" || f === "pptx" || f === "zip")) {
      if (wmaFitActive()) { const r = wmaFitLoops(); if (r) h.push(`音乐 ${wmvSec(r.L)} 秒 → 自动 ${r.loops} 圈。`); }
      if (WMA.kind === "url") h.push("网址音乐导出时要读取文件；对方网站不允许时会提示你先下载再上传。");
    }
    if (hint) hint.textContent = h.join(" ");
    const el = document.getElementById("wmExInfo");
    if (wmaOn() && wmaFmtHasSound(f) && el && !/含背景音乐/.test(el.textContent)) el.textContent += " · 含背景音乐";
    // 开入场 + 长度跟音乐时，圈数按钮让位给自动圈数
    if (wmaFitActive()) document.querySelectorAll('#wmExportModal [data-v10^="loops:"]').forEach(b => b.classList.remove("active"));
    if (wmaFitActive() && wmvIntroOn() && el) { const r = wmaFitLoops(); if (r) el.textContent = el.textContent.replace(/\+ \d+ 圈/, `+ ${r.loops} 圈`); }
  };
}

// 读出音频数据（本地文件直接读；网址需要对方允许跨域）
async function wmaArrayBuffer() {
  if (WMA.kind === "file" && WMA.blob) return await WMA.blob.arrayBuffer();
  let r;
  try { r = await fetch(WMA.url, { mode: "cors" }); } catch (e) { throw new Error("这个音乐网址不允许网页读取（跨域限制）。请先把音乐下载到本地，再用「上传本地音乐」。"); }
  if (!r.ok) throw new Error(`音乐网址打不开（HTTP ${r.status}）`);
  return await r.arrayBuffer();
}
async function wmaDecoded() {
  const key = WMA.kind + "|" + (WMA.kind === "file" ? WMA.name + WMA.blob?.size : WMA.url);
  if (WMA.buf && WMA.bufKey === key) return WMA.buf;
  const ab = await wmaArrayBuffer();
  const ac = new OfflineAudioContext(2, 48000, 48000);
  WMA.buf = await ac.decodeAudioData(ab); WMA.bufKey = key;
  return WMA.buf;
}
// 按导出时长混出整段音轨：偏移、循环、音量、淡入、结尾淡出（与 CLI 的 ffmpeg 规则一致）
async function wmaRenderMix(dur, sr = 48000) {
  const src = await wmaDecoded();
  const n = Math.max(1, Math.ceil(dur * sr));
  const ac = new OfflineAudioContext(2, n, sr);
  const s = ac.createBufferSource(); s.buffer = src; s.loop = WMA.loop;
  const g = ac.createGain(); const v = WMA.volume, fi = Math.min(WMA.fadeIn, dur), fo = Math.min(WMA.fadeOut, dur);
  g.gain.setValueAtTime(fi > 0 ? 0 : v, 0);
  if (fi > 0) g.gain.linearRampToValueAtTime(v, fi);
  if (fo > 0) { g.gain.setValueAtTime(v, Math.max(fi, dur - fo)); g.gain.linearRampToValueAtTime(0, dur); }
  s.connect(g); g.connect(ac.destination);
  const off = src.duration > 0 ? (WMA.loop ? WMA.offset % src.duration : Math.min(WMA.offset, src.duration)) : 0;
  s.start(0, off);
  return await ac.startRendering();
}
// 给 wmEncodeVideo 用：返回 { mux, encode(muxer), label } 或 null（不加音乐 / 格式不带声 → 与 v10 完全一致）
async function wmaPrepare(dur, prog) {
  if (!wmaOn() || !wmaFmtHasSound(wmExportState.fmt) || wmExportState.fmt === "html") return null;
  if (!("AudioEncoder" in window) || !("AudioData" in window)) { window.wmaLastNote = "此浏览器不支持音频编码，视频不含声音（建议用最新版 Chrome / Edge）"; return null; }
  prog && prog(0, "读取并混合背景音乐…");
  const mix = await wmaRenderMix(dur);
  const sr = mix.sampleRate, ch = 2;
  let codec = null, cfg = null;
  for (const c of [{ codec: "mp4a.40.2", mux: "aac", label: "AAC" }, { codec: "opus", mux: "opus", label: "Opus" }]) {
    const k = { codec: c.codec, sampleRate: sr, numberOfChannels: ch, bitrate: c.mux === "aac" ? 192000 : 160000 };
    try { const r = await AudioEncoder.isConfigSupported(k); if (r.supported) { codec = c; cfg = k; break; } } catch (e) { }
  }
  if (!codec) { window.wmaLastNote = "此浏览器没有可用的音频编码器，视频不含声音"; return null; }
  window.wmaLastNote = codec.mux === "opus" ? "音轨为 Opus（此浏览器不支持 AAC 编码；Chrome / VLC 可正常播放，PowerPoint / QuickTime 可能无声，建议在 Windows / Mac 的 Chrome 或 Edge 导出）" : "";
  return {
    mux: { codec: codec.mux, numberOfChannels: ch, sampleRate: sr }, label: codec.label,
    async encode(muxer) {
      let err = null;
      const enc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { err = e; } });
      enc.configure(cfg);
      const L = mix.getChannelData(0), R = mix.getChannelData(1), N = mix.length, step = 4800;
      for (let i = 0; i < N; i += step) {
        if (err) throw err;
        const n = Math.min(step, N - i), d = new Float32Array(n * 2);
        d.set(L.subarray(i, i + n), 0); d.set(R.subarray(i, i + n), n);
        const ad = new AudioData({ format: "f32-planar", sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / sr), data: d });
        enc.encode(ad); ad.close();
        while (enc.encodeQueueSize > 20) await wmSleep(2);
      }
      await enc.flush(); enc.close(); if (err) throw err;
    },
  };
}
// 导出完成提示里补一句音轨说明
{
  const _b = wmExportSetBusy;
  wmExportSetBusy = function (busy, pct, label) {
    if (!busy && typeof label === "string" && /^完成/.test(label) && wmaOn() && window.wmaUsed) { label += window.wmaUsed === "none" ? ` · ${window.wmaLastNote || "未含声音"}` : ` · 含背景音乐（${window.wmaUsed}）${window.wmaLastNote ? " · " + window.wmaLastNote : ""}`; window.wmaUsed = null; }
    return _b.call(this, busy, pct, label);
  };
}

// ---------- ZIP：附原音乐文件，spec.json 记录音乐设置（wm render --spec 原样复现） ----------
if (typeof wmvPatchZipSpec === "function") {
  const _z = wmvPatchZipSpec;
  wmvPatchZipSpec = function (spec, dur, files) {
    _z.apply(this, arguments);
    if (!wmaOn() || !files) return;
    if (wmaFitActive()) { const r = wmaFitLoops(); if (r) { spec.loops = r.loops; delete spec.length; spec.duration = (wmTpl(spec.template) || {}).duration || spec.duration; } }
    const a = { volume: WMA.volume, offset: WMA.offset, fadeIn: WMA.fadeIn, fadeOut: WMA.fadeOut, loop: WMA.loop };
    if (WMA.kind === "file" && WMA.blob) { const nm = "audio/" + (WMA.name || "music.mp3").replace(/[\\/:*?"<>|]/g, "_"); files.push({ name: nm, data: WMA.blob }); a.src = nm; }
    else a.src = WMA.url;
    spec.audio = a;
  };
}

// ---------- 交互网页：嵌入或引用音乐 ----------
async function wmaForHtml() {
  if (!wmaOn()) return null;
  const a = { name: WMA.name, volume: WMA.volume, offset: WMA.offset, fadeIn: WMA.fadeIn, fadeOut: WMA.fadeOut, loop: WMA.loop };
  if (WMA.kind === "url" && WMA.link) return Object.assign(a, { src: WMA.url });
  wmExportSetBusy(true, 0.86, "嵌入背景音乐…");
  try {
    const blob = WMA.kind === "file" ? WMA.blob : new Blob([await wmaArrayBuffer()], { type: "audio/mpeg" });
    return Object.assign(a, { src: await wmvBlobToDataUrl(blob) });
  } catch (e) {
    if (WMA.kind === "url") { window.wmaLastNote = "音乐网址不允许读取，网页里改为引用网址（需联网才有声）"; return Object.assign(a, { src: WMA.url }); }
    throw e;
  }
}
if (typeof wmvHtmlEstimate === "function") { const _e = wmvHtmlEstimate; wmvHtmlEstimate = function () { const r = _e.apply(this, arguments); if (wmaOn() && !(WMA.kind === "url" && WMA.link)) r.bytes += (WMA.blob ? WMA.blob.size : 4e6) * 1.37; return r; }; }

// ---------- 复制给 Agent：带上音乐参数 ----------
function wmaCliFlags() {
  if (!wmaOn()) return "";
  let f = ` --audio ${WMA.kind === "url" ? WMA.url : "./" + (WMA.name || "music.mp3").replace(/\s/g, "_")}`;
  if (WMA.volume !== 1) f += ` --audio-volume ${WMA.volume}`;
  if (WMA.offset) f += ` --audio-offset ${WMA.offset}`;
  if (WMA.fadeIn !== 0.5) f += ` --audio-fade-in ${WMA.fadeIn}`;
  if (WMA.fadeOut !== 1) f += ` --audio-fade-out ${WMA.fadeOut}`;
  if (!WMA.loop) f += " --no-audio-loop";
  return f;
}
if (typeof wmvCliFlags === "function") { const _c = wmvCliFlags; wmvCliFlags = function () { return _c.apply(this, arguments) + wmaCliFlags(); }; }
if (typeof wmAgSpec === "function") { const _s = wmAgSpec; wmAgSpec = function (id) { const s = _s.apply(this, arguments); if (wmaOn()) s.audio = { src: WMA.kind === "url" ? WMA.url : "./" + (WMA.name || "music.mp3").replace(/\s/g, "_"), volume: WMA.volume, offset: WMA.offset, fadeIn: WMA.fadeIn, fadeOut: WMA.fadeOut, loop: WMA.loop }; return s; }; }
// wmAgCmd 由 v10 addon 用 wmvCliFlags 拼接；无入场 / 1× 时它不改命令，这里补上音乐
if (typeof wmAgCmd === "function") { const _a = wmAgCmd; wmAgCmd = function (id) { let c = _a.apply(this, arguments); const f = wmaCliFlags(); if (f && !c.includes(" --audio ")) c = c.replace(` --out ${id}.mp4`, `${f} --out ${id}.mp4`); return c; }; }
