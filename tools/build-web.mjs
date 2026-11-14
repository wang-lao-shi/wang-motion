#!/usr/bin/env node
// Build the WANG MOTION web app (single index.html) from a base page + this skill.
// Single source of truth: the engine bundle (engine/player/wm-engine.min.js), the player template (engine/player/player.html)
// and the v10 add-on (web/v10-addon.js + .css) all come from the skill, so the web page, `wm html` and the CLI share one engine.
// usage: node tools/build-web.mjs <base index.html> <out index.html>
import fs from 'fs'; import path from 'path'; import zlib from 'zlib'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [base, out] = process.argv.slice(2);
if (!base || !out) { console.error('usage: node tools/build-web.mjs <base index.html> <out index.html>'); process.exit(2); }
let s = fs.readFileSync(base, 'utf8');
const gz64 = (buf) => zlib.gzipSync(buf, { level: 9 }).toString('base64');
const must = (a, b, label) => { const n = s.split(a).length - 1; if (n !== 1) { console.error(`patch "${label}": expected 1 match, found ${n}`); process.exit(1); } s = s.replace(a, () => b); };

// 1. engine bundle (rebuilt from the skill sources)
const bundle = fs.readFileSync(path.join(ROOT, 'engine/player/wm-engine.min.js'));
const re = /<script( id="wmEngineScript")?>\/\*! wang-motion engine[^\n]*\n?\(async\(\)=>\{const S="([A-Za-z0-9+\/=]+)"/;
const m = re.exec(s); if (!m) { console.error('engine bundle script not found in base page'); process.exit(1); }
const oldScript = m[0]; const newHead = oldScript.replace(/^<script( id="wmEngineScript")?>/, '<script id="wmEngineScript">').replace(m[2], gz64(bundle)).replace(/\/\*! wang-motion engine \(skill\)/, '/*! wang-motion engine (skill v10)');
s = s.replace(oldScript, () => newHead);

// 2. bridge patches (engine sync / draw / GIF repeat / ZIP spec)
if (!s.includes('wmV10TL(')) {
  must('const tplKey = o.id + "|" + wmParamSig(o.id);', 'const tplKey = o.id + "|" + wmParamSig(o.id) + (o.tl ? "|" + JSON.stringify(o.tl) : "");', 'tplKey');
  must('    const cnt = wmSpecCount(list);\n    if (cnt) spec.count = cnt;\n    try { eng.configure(spec, tpl);',
    '    const cnt = wmSpecCount(list);\n    if (cnt) spec.count = cnt;\n    if (o.tl) { spec.speed = o.tl.speed; spec.intro = o.tl.intro; if (o.tl.mb) spec.fx = { motionBlur: 6, shutter: 0.5 }; } // v10\n    try { eng.configure(spec, tpl);', 'spec tl');
  must('  const ok = wmSyncEngine(E, { id: selectedId, media: wmMediaList(selectedId), w: pw & ~1, h: ph & ~1, useStageBg: true, fps: ex ? ex.fps : 30 });',
    '  const tl = typeof wmV10TL === "function" ? wmV10TL(role, ex) : null; // v10 timeline (intro preview / export)\n  const ok = wmSyncEngine(E, { id: selectedId, media: wmMediaList(selectedId), w: pw & ~1, h: ph & ~1, useStageBg: true, fps: ex ? ex.fps : 30, tl });', 'sync tl');
  must('  wmEngineDraw(E, selectedId, phase * dur);', '  if (tl) wmV10Draw(E, role, ex, tl, dur); else wmEngineDraw(E, selectedId, phase * dur);', 'draw');
  must('gif.writeFrame(index, W, H, { palette, delay, repeat: 0 });', 'gif.writeFrame(index, W, H, { palette, delay, repeat: (typeof WMV !== "undefined" && WMV.gifOnce && wmvIntroOn()) ? -1 : 0 });', 'gif repeat');
  must('      files.push({ name: "spec.json", data: JSON.stringify(spec, null, 2) });', '      if (typeof wmvPatchZipSpec === "function") wmvPatchZipSpec(spec, dur, files);\n      files.push({ name: "spec.json", data: JSON.stringify(spec, null, 2) });', 'zip spec');
  must('_key${String(i + 1).padStart(2, "0")}_${Math.round(f.phase * 100)}pct.', '_key${String(i + 1).padStart(2, "0")}_${f.introT != null ? "intro" + f.introT.toFixed(2) + "s" : Math.round(f.phase * 100) + "pct"}.', 'kf intro name');
  // v10.1 music track in wmEncodeVideo (no music -> identical to v10)
  must('    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: enc.muxCodec, width: W, height: H, frameRate: fps }, fastStart: "in-memory" });',
    '    const wmA = typeof wmaPrepare === "function" ? await wmaPrepare(dur, prog) : null; // v10.1 背景音乐\n    window.wmaUsed = wmA ? wmA.label : (typeof wmaOn === "function" && wmaOn() && wmaFmtHasSound(wmExportState.fmt) ? "none" : null);\n    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: enc.muxCodec, width: W, height: H, frameRate: fps }, ...(wmA ? { audio: wmA.mux } : {}), fastStart: "in-memory" });', 'mux audio');
  must('      prog(1, "正在封装 MP4…");\n      await encoder.flush();', '      prog(1, "正在封装 MP4…");\n      await encoder.flush();\n      if (wmA) { prog(1, "正在编码音轨…"); await wmA.encode(muxer); }', 'enc audio');
  must('  const rec = new MediaRecorder(cv.captureStream(fps),', '  if (typeof wmaOn === "function" && wmaOn() && wmaFmtHasSound(wmExportState.fmt)) { window.wmaUsed = "none"; window.wmaLastNote = "此浏览器只能实时录制，视频不含声音"; }\n  const rec = new MediaRecorder(cv.captureStream(fps),', 'rec audio');
  // 3. markup: interactive-page format
  must('<button data-fmt="zip"><b>ZIP</b><small>素材打包</small></button>', '<button data-fmt="zip"><b>ZIP</b><small>素材打包</small></button>\n      <button data-fmt="html"><b>交互网页</b><small>单文件 · 离线播放</small></button>', 'html fmt');
}
// 3b. v10.2 素材比例：spec 字段 + 舞台 / 演示按画面比例留边（未导入图片或 16:9 时与 v10 完全相同）
if (!s.includes('wmAdSig')) {
  must('const tplKey = o.id + "|" + wmParamSig(o.id) + (o.tl ? "|" + JSON.stringify(o.tl) : "");',
    'const tplKey = o.id + "|" + wmParamSig(o.id) + (o.tl ? "|" + JSON.stringify(o.tl) : "") + (o.useStageBg && typeof wmAdSig === "function" ? "|ad:" + wmAdSig() : "");', 'tplKey adapt');
  must('    if (o.tl) { spec.speed = o.tl.speed; spec.intro = o.tl.intro; if (o.tl.mb) spec.fx = { motionBlur: 6, shutter: 0.5 }; } // v10\n',
    '    if (o.tl) { spec.speed = o.tl.speed; spec.intro = o.tl.intro; if (o.tl.mb) spec.fx = { motionBlur: 6, shutter: 0.5 }; } // v10\n    if (o.useStageBg && typeof wmAdSpec === "function") Object.assign(spec, wmAdSpec(list)); // v10.2\n', 'spec adapt');
  must('  const ok = wmSyncEngine(E, { id: selectedId, media: wmMediaList(selectedId), w: pw & ~1, h: ph & ~1, useStageBg: true, fps: ex ? ex.fps : 30, tl });',
    '  const AB = (!ex && typeof wmAdBox === "function") ? wmAdBox(pw, ph) : null; // v10.2 画面比例跟随素材时留边\n  const ok = wmSyncEngine(E, { id: selectedId, media: wmMediaList(selectedId), w: (AB ? AB[2] : pw) & ~1, h: (AB ? AB[3] : ph) & ~1, useStageBg: true, fps: ex ? ex.fps : 30, tl });', 'sync box');
  must('  ctx.drawImage(E.canvas, 0, 0, pw, ph);\n  const gridOn',
    '  if (AB) { ctx.fillStyle = "#020705"; ctx.fillRect(0, 0, pw, ph); ctx.drawImage(E.canvas, AB[0], AB[1], AB[2], AB[3]); ctx.strokeStyle = "rgba(116, 235, 193, .22)"; ctx.lineWidth = 1; ctx.strokeRect(AB[0] + 0.5, AB[1] + 0.5, AB[2] - 1, AB[3] - 1); }\n  else ctx.drawImage(E.canvas, 0, 0, pw, ph);\n  const gridOn', 'draw box');
}
// 4. css + player template + add-on (replaced on rebuild)
s = s.replace(/<style id="wmV10Css">[\s\S]*?<\/style>\n?/, '').replace(/<script type="text\/plain" id="wmPlayerTpl">[\s\S]*?<\/script>\n?/, '').replace(/<script id="wmV10Addon">[\s\S]*?<\/script>\n?/, '');
const css = fs.readFileSync(path.join(ROOT, 'web/v10-addon.css'), 'utf8') + fs.readFileSync(path.join(ROOT, 'web/v101-audio.css'), 'utf8') + fs.readFileSync(path.join(ROOT, 'web/v102-adapt.css'), 'utf8');
s = s.replace('</head>', () => `<style id="wmV10Css">\n${css}</style>\n</head>`);
const addon = (fs.readFileSync(path.join(ROOT, 'web/v10-addon.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'web/v101-audio.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'web/v102-adapt.js'), 'utf8')).replace(/<\/script/gi, '<\\/script');
const player = gz64(fs.readFileSync(path.join(ROOT, 'engine/player/player.html')));
const endEngine = s.indexOf('</script>', s.indexOf('<script id="wmEngineScript">')) + '</script>'.length;
s = s.slice(0, endEngine) + `\n<script type="text/plain" id="wmPlayerTpl">${player}</script>\n<script id="wmV10Addon">\n${addon}\n</script>` + s.slice(endEngine);
fs.writeFileSync(out, s);
console.log(out, (s.length / 1048576).toFixed(2) + ' MB');
