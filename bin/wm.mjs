#!/usr/bin/env node
// wang-motion CLI — list / info / still / sheet / render / doctor
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync, spawn, execSync } from 'child_process';
import crypto from 'crypto';
import zlib from 'zlib';
globalThis.__wmZlib = zlib;
import { fileURLToPath, pathToFileURL } from 'url';
import { normParams } from '../engine/lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engine');
const TPL_DIR = path.join(ENGINE, 'templates');
const RATIOS = { '16:9': [16, 9], '4:3': [4, 3], '1:1': [1, 1], '4:5': [4, 5], '3:4': [3, 4], '9:16': [9, 16], '21:9': [21, 9], '2:3': [2, 3], '3:2': [3, 2] };

// ---------------- args ----------------
function parseArgs(argv) {
  const a = { _: [], param: {} };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s.startsWith('--')) {
      const [k, v0] = s.slice(2).split(/=(.*)/s);
      const v = v0 !== undefined ? v0 : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
      if (k === 'param' || k === 'p') { const [pk, pv] = v.split(/=(.*)/s); a.param[pk] = coerce(pv); }
      else a[k] = v;
    } else a._.push(s);
  }
  return a;
}
function coerce(v) { if (v === 'true') return true; if (v === 'false') return false; if (v !== '' && !isNaN(Number(v))) return Number(v); return v; }

// ---------------- templates ----------------
function walk(d) { let out = []; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) out = out.concat(walk(p)); else if (f.name.endsWith('.js') && !f.name.startsWith('_')) out.push(p); } return out; }
export async function loadTemplates() {
  const files = walk(TPL_DIR).sort();
  const list = [];
  for (const f of files) {
    try {
      const m = (await import(pathToFileURL(f).href)).default;
      if (!m || !m.id || !m.layout) continue;
      list.push({ ...m, file: path.relative(TPL_DIR, f).split(path.sep).join('/') });
    } catch (e) { console.error('bad template', f, e.message); }
  }
  return list;
}
async function findHidden(id) {
  const all = (function w(d) { let o = []; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) o = o.concat(w(p)); else if (f.name === id + '.js') o.push(p); } return o; })(TPL_DIR);
  for (const f of all) { const m = (await import(pathToFileURL(f).href)).default; if (m && m.layout) return { ...m, id: m.id || id, file: path.relative(TPL_DIR, f).split(path.sep).join('/') }; }
  return null;
}
async function findTemplate(id) {
  const all = await loadTemplates();
  let t = all.find((x) => x.id === id) || all.find((x) => x.name?.toLowerCase() === String(id).toLowerCase());
  if (!t && String(id).startsWith('_')) t = await findHidden(id); // hidden test templates (_fxtest): not listed, still renderable by id
  if (!t) { console.error(`template not found: ${id}. Try: wm list`); process.exit(2); }
  return t;
}

// ---------------- browser ----------------
function findChrome() {
  if (process.env.WM_CHROME && fs.existsSync(process.env.WM_CHROME)) return process.env.WM_CHROME;
  const cands = [];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : path.join(os.homedir(), '.cache/ms-playwright'));
  for (const base of [pw, '/workspace/tools/ms-playwright']) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base)) {
      if (d.startsWith('chromium_headless_shell')) cands.push(path.join(base, d, 'chrome-linux/headless_shell'), path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell'));
      if (process.platform === 'win32' && d.startsWith('chromium_headless_shell')) cands.push(path.join(base, d, 'chrome-headless-shell-win64/chrome-headless-shell.exe'));
      if (d.startsWith('chromium-')) cands.push(path.join(base, d, 'chrome-linux/chrome'), path.join(base, d, 'chrome-linux64/chrome'));
      if (process.platform === 'win32' && d.startsWith('chromium-')) cands.push(path.join(base, d, 'chrome-win/chrome.exe'), path.join(base, d, 'chrome-win64/chrome.exe'));
    }
  }
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      cands.push(path.join(base, 'Google/Chrome/Application/chrome.exe'), path.join(base, 'Microsoft/Edge/Application/msedge.exe'));
    }
  }
  cands.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  return cands.find((c) => fs.existsSync(c));
}
async function getPW() {
  const tries = [path.join(ROOT, 'node_modules/playwright-core/index.mjs'), 'playwright-core', 'playwright'];
  for (const t of tries) { try { return await import(path.isAbsolute(t) ? pathToFileURL(t).href : t); } catch { } }
  console.error('playwright-core missing. Run: cd ' + ROOT + ' && npm install'); process.exit(3);
}
async function launch() {
  const { chromium } = await getPW();
  const exe = findChrome();
  const px = process.env.HTTPS_PROXY || process.env.https_proxy;
  let proxy; if (px && process.env.WM_USE_PROXY) { const u = new URL(px); proxy = { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username) || undefined, password: decodeURIComponent(u.password) || undefined }; }
  return chromium.launch({ executablePath: exe, proxy, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-web-security', '--autoplay-policy=no-user-gesture-required'] });
}
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.json': 'application/json' };
async function openPage(browser, W, H) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.route('http://wm.local/**', async (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname;
    const file = p.startsWith('/@fs/') ? decodeURIComponent(p.slice(5)) : path.join(ENGINE, decodeURIComponent(p));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'nf' });
    const ext = path.extname(file).toLowerCase(); const body = fs.readFileSync(file);
    const range = route.request().headers()['range'];
    if (range && MIME[ext]?.startsWith('video')) {
      const m = /bytes=(\d+)-(\d*)/.exec(range); const s = +m[1]; const e = m[2] ? +m[2] : body.length - 1;
      return route.fulfill({ status: 206, headers: { 'Content-Type': MIME[ext], 'Content-Range': `bytes ${s}-${e}/${body.length}`, 'Accept-Ranges': 'bytes' }, body: body.subarray(s, e + 1) });
    }
    route.fulfill({ status: 200, headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes' }, body });
  });
  await page.goto('http://wm.local/index.html');
  await page.waitForFunction(() => window.WM_READY === true);
  return page;
}
const fsUrl = (p) => 'http://wm.local/@fs/' + encodeURIComponent(path.resolve(p));

// ---------------- media ----------------
function collectMedia(a, spec) {
  let list = [];
  if (spec.media) list = spec.media;
  if (a.media) list = a.media.split(',');
  if (a['media-dir']) list = fs.readdirSync(a['media-dir']).filter((f) => /\.(png|jpe?g|webp|gif|mp4|webm|mov|m4v|svg)$/i.test(f)).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).map((f) => path.join(a['media-dir'], f));
  if (!list.length) list = demoMedia();
  return list.map((p) => prepVideo(path.resolve(p)));
}
// Headless chromium (playwright build) has no proprietary codecs: H.264/HEVC/ProRes inputs fail to decode
// (page.evaluate: Event). Transcode anything that is not VP8/VP9/AV1-in-WebM to VP9 WebM, cached by path+mtime+size.
const CACHE = path.join(os.tmpdir(), 'wang-motion-cache');
function probe(file) {
  if (!hasCmd('ffprobe')) return null;
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,pix_fmt', '-of', 'json', file]);
  try { return JSON.parse(r.stdout.toString()).streams?.[0] || null; } catch { return null; }
}
function prepVideo(file) {
  const ext = path.extname(file).toLowerCase();
  if (!['.mp4', '.mov', '.m4v', '.webm', '.mkv'].includes(ext) || !fs.existsSync(file)) return file;
  const info = probe(file);
  if (ext === '.webm' && (!info || ['vp8', 'vp9', 'av1'].includes(info.codec_name))) return file;
  if (!hasCmd('ffmpeg')) { console.error(`error: ${path.basename(file)} is ${info?.codec_name || ext.slice(1)} video, which the headless renderer cannot decode. Install ffmpeg (auto-converts to VP9 WebM) or supply a VP9 .webm.`); process.exit(4); }
  const st = fs.statSync(file);
  const key = crypto.createHash('sha1').update(`${file}|${st.mtimeMs}|${st.size}`).digest('hex').slice(0, 12);
  const out = path.join(CACHE, `${path.basename(file, ext)}-${key}.webm`);
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(CACHE, { recursive: true });
  const alpha = /^(yuva|rgba|argb|bgra|abgr|gbrap|ya)/.test(info?.pix_fmt || '');
  const tmp = out + `.${process.pid}.part.webm`;
  process.stderr.write(`converting ${path.basename(file)} (${info?.codec_name || '?'}) -> VP9 WebM (cached) ... `);
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-an', '-vf', "scale='min(1920,iw)':-2", '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'good', '-cpu-used', '5', '-row-mt', '1', '-pix_fmt', alpha ? 'yuva420p' : 'yuv420p', tmp]);
  if (r.status !== 0) { fs.rmSync(tmp, { force: true }); console.error(`\nerror: ffmpeg could not convert ${file}:\n${r.stderr.toString().slice(-1500)}`); process.exit(4); }
  fs.renameSync(tmp, out); process.stderr.write('ok\n');
  return out;
}
const hexCol = (c) => { const s = String(c).trim(); return /^[0-9a-f]{3,4}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(s) ? '#' + s : s; };
function demoMedia(n = 12) {
  const dir = path.join(ROOT, 'examples/demo-media');
  if (fs.existsSync(dir) && fs.readdirSync(dir).length >= n) return fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).map((f) => path.join(dir, f));
  fs.mkdirSync(dir, { recursive: true });
  const cols = ['e63946', 'f4a261', '2a9d8f', '264653', '8338ec', 'ff006e', '3a86ff', 'fb5607', '06d6a0', '118ab2', 'ef476f', 'ffd166'];
  const im = hasCmd('magick') ? 'magick' : 'convert';
  for (let i = 1; i <= n; i++) spawnSync(im, ['-size', '800x600', `gradient:#${cols[(i - 1) % 12]}-#111111`, '-gravity', 'center', '-fill', 'white', '-pointsize', '260', '-annotate', '0', String(i), '-fill', 'none', '-stroke', 'white', '-strokewidth', '12', '-draw', 'rectangle 20,20 780,580', path.join(dir, `demo${String(i).padStart(2, '0')}.png`)]);
  return demoMedia(n);
}
// v10.2：一批素材的主比例（中位数，±3% 吸附到常用比例），与 engine/adapt.js mainRatio 一致
function mediaMainRatio(list) {
  const rs = [], hasProbe = hasCmd('ffprobe'), hasFfmpeg = hasCmd('ffmpeg');
  for (const f of list) {
    let w, h;
    if (hasProbe) { const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' }); [w, h] = (r.stdout || '').trim().split(',').map(Number); }
    if (!(w > 0 && h > 0) && hasFfmpeg) { const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f], { encoding: 'utf8' }); const m = /Video:[^\r\n]*?\b(\d+)x(\d+)\b/.exec(r.stderr || ''); if (m) [w, h] = [+m[1], +m[2]]; }
    if (w > 0 && h > 0) rs.push(w / h);
  }
  if (rs.length < list.length) console.error('warning: could not read some media dimensions; install ffprobe or ffmpeg for --ratio media');
  if (!rs.length) { console.error('warning: using 4:3 because no media dimensions could be read'); return 4 / 3; } rs.sort((x, y) => x - y); const k = rs.length >> 1; const med = rs.length % 2 ? rs[k] : Math.sqrt(rs[k - 1] * rs[k]);
  for (const s of [1, 4 / 3, 3 / 4, 3 / 2, 2 / 3, 16 / 9, 9 / 16, 4 / 5, 5 / 4, 21 / 9, 2]) if (Math.abs(med / s - 1) < 0.03) return s; return med;
}
function hasCmd(c) { return process.platform === 'win32' ? spawnSync('where.exe', [c], { stdio: 'ignore' }).status === 0 : spawnSync('sh', ['-c', `command -v ${c}`]).status === 0; }

// ---------------- spec ----------------
function buildSpec(a, tpl, def = {}) {
  let spec = {};
  if (a.spec) spec = JSON.parse(fs.readFileSync(a.spec, 'utf8'));
  let ratio = a.ratio || spec.ratio || def.ratio || tpl.defaultRatio || '16:9';
  let [rw, rh] = RATIOS[ratio] || String(ratio).split(':').map(Number);
  if (ratio === 'media') { const r = mediaMainRatio(collectMedia(a, spec)); [rw, rh] = r >= 1 ? [r, 1] : [1, 1 / r]; ratio = `${+rw.toFixed(4)}:${+rh.toFixed(4)}`; } // v10.2 画布跟素材
  const res = Number(a.res || spec.res || def.res || 1080);
  let W, H; if (a.width && a.height) { W = +a.width; H = +a.height; } else if (rw >= rh) { H = res; W = Math.round((res * rw) / rh); } else { W = res; H = Math.round((res * rh) / rw); }
  W -= W % 2; H -= H % 2;
  spec.width = W; spec.height = H; spec.ratio = ratio;
  spec.duration = Number(a.duration || spec.duration || tpl.duration || 16);
  spec.fps = Number(a.fps || spec.fps || 30);
  spec.params = normParams({ ...(spec.params || {}), ...a.param }, tpl.params || {});
  if (a.count) spec.count = +a.count;
  // v10.2 卡片比例：命令行默认「跟随素材」；--spec 读进来的旧文件没有这个字段 = 模板原样（老作品重渲不变）
  if (a['card-ratio']) spec.cardRatio = a['card-ratio'];
  else if (!a.spec && !def.keepTemplate) spec.cardRatio = 'media';
  if (spec.cardRatio === 'template') delete spec.cardRatio; // 模板原样 = v9：不写 cardRatio，模板用自己的默认形状
  if (a.fit) { if (!['cover', 'blur', 'color'].includes(a.fit)) { console.error(`error: --fit ${a.fit}: use cover | blur | color`); process.exit(2); } spec.fit = a.fit; }
  if (a['fit-color']) { spec.fitColor = hexCol(a['fit-color']); if (!a.fit) spec.fit = 'color'; }
  if (a['card-mix']) spec.cardMix = a['card-mix'] === 'own' ? 'own' : undefined;
  if (a.focus) { spec.focus = spec.focus || []; for (const it of String(a.focus).split(/[;\s]+/).filter(Boolean)) { const m = it.match(/^(\d+):([\d.]+),([\d.]+)$/); if (!m) { console.error(`error: --focus ${it}: use N:x,y (N from 1; x,y 0..1)`); process.exit(2); } spec.focus[+m[1] - 1] = [+m[2], +m[3]]; } for (let i = 0; i < spec.focus.length; i++) if (spec.focus[i] === undefined) spec.focus[i] = null; }
  if (a.padding) spec.params.padding = +a.padding;
  if (a.radius) spec.params.cornerRadius = +a.radius;
  if (a.shadow) spec.shadow = a.shadow !== 'false';
  if (a.bg) { const c = hexCol(a.bg); if (c.startsWith('#') || /^(rgb|hsl)a?\(|^[a-z]+$/i.test(c)) spec.background = { type: 'color', color: c }; else console.error(`warning: --bg ${a.bg} is not a colour (use e.g. 202020 or #202020); ignored`); }
  if (a.gradient) spec.background = { type: 'gradient', colors: a.gradient.split(',').map(hexCol), angle: Number(a.angle || 90) };
  if (a['bg-image']) spec.background = { type: 'image', image: a['bg-image'], dim: Number(a.dim || 1) };
  if (a.text) spec.text = [{ content: a.text.replace(/\\n/g, '\n'), position: a['text-pos'] || 'bottom', size: Number(a['text-size'] || 6), color: a['text-color'] ? hexCol(a['text-color']) : '#fff', animate: a['text-anim'] || 'rise' }];
  if (a.logo) spec.logo = { ...(spec.logo || {}), src: a.logo, position: a['logo-pos'] || 'top-left' };
  spec.fx = { ...(spec.fx || {}) };
  if (a.motionblur) spec.fx.motionBlur = +a.motionblur; if (a.grain) spec.fx.grain = +a.grain; if (a.vignette) spec.fx.vignette = +a.vignette;
  if (a.keyframes) spec.keyframes = JSON.parse(a.keyframes);
  // v10: speed + intro
  if (a.speed != null && a.speed !== 'true') {
    if (a.duration) { console.error('error: --speed and --duration both set. --duration is the loop length at 1x (v9); --speed scales the whole timeline. Use one.'); process.exit(2); }
    const sp = Number(a.speed); if (!(sp > 0)) { console.error('error: --speed must be > 0 (0.1 .. 8)'); process.exit(2); }
    if (sp < 0.1 || sp > 8) console.error(`warning: --speed ${sp} clamped to 0.1 .. 8`);
    spec.speed = Math.min(8, Math.max(0.1, sp));
  }
  const iKeys = { 'intro-style': 'style', 'intro-order': 'order', 'intro-dur': 'dur', 'intro-hold': 'hold', 'intro-seed': 'seed', 'intro-phase': 'phase', 'intro-ramp': 'ramp' };
  const hasI = a.intro || Object.keys(iKeys).some((k) => a[k] != null) || a['no-ramp'] || def.intro;
  if (hasI) {
    const base = typeof spec.intro === 'string' ? { mode: spec.intro } : { ...(spec.intro || {}) };
    if (a.intro) base.mode = a.intro; else if (!base.mode || base.mode === 'none') base.mode = def.intro || base.mode || 'none';
    for (const [k, f] of Object.entries(iKeys)) if (a[k] != null) base[f] = ['style', 'order'].includes(f) ? a[k] : Number(a[k]);
    if (a['no-ramp']) base.ramp = 0;
    if (!['none', 'stagger', 'whole'].includes(base.mode)) { console.error(`error: --intro ${base.mode}: use none | stagger | whole`); process.exit(2); }
    if (base.style && !['rise', 'fly', 'pop', 'flip'].includes(base.style)) { console.error(`error: --intro-style ${base.style}: use rise | fly | pop | flip`); process.exit(2); }
    if (base.order && !['index', 'center', 'ltr', 'random'].includes(base.order)) { console.error(`error: --intro-order ${base.order}: use index | center | ltr | random`); process.exit(2); }
    spec.intro = base;
  }
  return spec;
}
async function initPage(page, spec, tpl, media) {
  const need = [...media, spec.background?.type === 'image' ? spec.background.image : null, spec.logo?.src].filter(Boolean);
  const miss = need.filter((f) => !/^(https?|data):/.test(f) && !fs.existsSync(f));
  if (miss.length) { console.error(`error: file not found: ${miss.join(', ')} (paths are relative to the current directory: ${process.cwd()})`); process.exit(3); }
  const bgUrl = spec.background?.type === 'image' && spec.background.image ? fsUrl(spec.background.image) : null;
  const logoUrl = spec.logo?.src ? fsUrl(spec.logo.src) : null;
  const r = await page.evaluate(([s, f, m, b, l]) => window.WM.init(s, f, m, b, l), [spec, tpl.file, media.map(fsUrl), bgUrl, logoUrl]);
  return r;
}
const b64 = (d) => Buffer.from(d.split(',')[1], 'base64');
const introOn = (spec) => { const i = spec.intro; return !!i && (typeof i === 'string' ? i !== 'none' : (i.mode && i.mode !== 'none')); };
const usesTimeline = (spec, a) => introOn(spec) || (spec.speed && spec.speed !== 1) || a.loops != null || spec.loops != null;

// ---------------- commands ----------------
async function cmdList(a) {
  const all = await loadTemplates();
  const cat = a.category || a._[1];
  const rows = all.filter((t) => !cat || t.category === cat);
  if (a.json) { console.log(JSON.stringify(rows.map(({ layout, setup, camera, ...r }) => ({ ...r, params: Object.keys(r.params || {}) })), null, 1)); return; }
  const byCat = {}; rows.forEach((t) => (byCat[t.category] ||= []).push(t));
  for (const [c, ts] of Object.entries(byCat)) { console.log(`\n# ${c} (${ts.length})`); ts.forEach((t) => console.log(`  ${t.id.padEnd(28)} ${t.name.padEnd(26)} ${t.desc || ''}`)); }
  console.log(`\n${rows.length} templates`);
}
async function cmdInfo(a) {
  const t = await findTemplate(a._[1]);
  const { layout, setup, camera, ...r } = t;
  const { INTRO_COMPAT, START_PHASE } = await import(pathToFileURL(path.join(ENGINE, 'intro.js')).href);
  const ic = INTRO_COMPAT[t.id];
  r.intro = ic ? { startPhase: START_PHASE[t.id] ?? 0, visibleCards: ic.v, stagger: ic.ok ? 'ok' : 'fallback: whole fade (fewer than 3 cards on screen)' } : { startPhase: START_PHASE[t.id] ?? 0, stagger: 'unknown (run tools/intro-compat.mjs)' };
  console.log(JSON.stringify(r, null, 1));
}
async function cmdStill(a) {
  const tpl = await findTemplate(a._[1] || (a.spec && JSON.parse(fs.readFileSync(a.spec, 'utf8')).template));
  const spec = buildSpec(a, tpl, { res: 720 }); const media = collectMedia(a, spec);
  const br = await launch(); const page = await openPage(br, spec.width, spec.height);
  await initPage(page, spec, tpl, media);
  const out = a.out || `${tpl.id}.png`;
  if (a['at-time'] != null) { // v10: wall-clock seconds on the timeline (intro + hold + loops, speed applied)
    const Ts = String(a['at-time']).split(',').map(Number);
    for (let k = 0; k < Ts.length; k++) {
      const d = await page.evaluate(([T, f]) => window.WM.frameAt(T, f, 'png'), [Ts[k], spec.fps]);
      const o = Ts.length > 1 ? out.replace(/(\.\w+)$/, `-${k}$1`) : out; fs.writeFileSync(o, b64(d)); console.log(o);
    }
    await br.close(); return;
  }
  const ts = String(a.at ?? '0.3').split(',').map(Number);
  for (let k = 0; k < ts.length; k++) {
    const t = ts[k] <= 1 && !a.seconds ? ts[k] * spec.duration : ts[k];
    const d = await page.evaluate(([t, f]) => window.WM.frame(t, f, 'png'), [t, spec.fps]);
    const o = ts.length > 1 ? out.replace(/(\.\w+)$/, `-${k}$1`) : out; fs.writeFileSync(o, b64(d)); console.log(o);
  }
  await br.close();
}
async function cmdSheet(a) {
  // contact sheet of templates (one still each) or of one template over time (--frames)
  const all = await loadTemplates();
  const ids = a._.slice(1);
  const unknown = ids.filter((id) => !all.find((t) => t.id === id));
  if (unknown.length) { console.error(`template not found: ${unknown.join(', ')}. Try: wm list`); process.exit(2); }
  let tpls = ids.length ? ids.map((id) => all.find((t) => t.id === id)) : all;
  if (a.category) tpls = tpls.filter((t) => t.category === a.category);
  if (!tpls.length) { console.error(`no templates match${a.category ? ` category "${a.category}"` : ''}. Try: wm list`); process.exit(2); }
  if (!ids.length) console.error(`note: no ids given — sheet of ${tpls.length} templates${a.category ? ` in "${a.category}"` : ''} (pass ids or --category to narrow)`);
  const iFr = a['intro-frames'] != null ? Number(a['intro-frames']) || 6 : 0; // v10: frames across intro + hold + first beat of the loop
  const frames = iFr || Number(a.frames || 1);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-sheet-'));
  const br = await launch();
  const specFile = a.spec ? JSON.parse(fs.readFileSync(a.spec, 'utf8')) : {};
  const res = Number(a.res || specFile.res || 360);
  let page; const files = [];
  for (const tpl of tpls) {
    const spec = buildSpec(a, tpl, { res, ratio: '1:1', intro: iFr ? 'stagger' : undefined, keepTemplate: true }); const media = collectMedia(a, spec);
    page = await openPage(br, spec.width, spec.height);
    await initPage(page, spec, tpl, media);
    if (iFr) {
      const tl = await page.evaluate(() => window.WM.timeline());
      const span = tl.introWall + Math.min(0.6, tl.loopWall * 0.1) / 1; // last frame = a moment into the loop (join check)
      for (let k = 0; k < iFr; k++) {
        const T = iFr === 1 ? span : (k / (iFr - 1)) * span;
        const d = await page.evaluate(([T, f]) => window.WM.frameAt(T, f, 'jpeg', 0.9), [T, spec.fps]);
        const f = path.join(tmp, `${String(files.length).padStart(4, '0')}.jpg`); fs.writeFileSync(f, b64(d));
        files.push({ f, label: `${tpl.id} ${T.toFixed(2)}s` });
      }
      await page.close(); process.stderr.write('.'); continue;
    }
    for (let k = 0; k < frames; k++) {
      const u = frames === 1 ? Number(a.at ?? 0.3) : k / frames;
      const d = await page.evaluate(([t, f]) => window.WM.frame(t, f, 'jpeg', 0.9), [u * spec.duration, spec.fps]);
      const f = path.join(tmp, `${String(files.length).padStart(4, '0')}.jpg`); fs.writeFileSync(f, b64(d));
      files.push({ f, label: frames === 1 ? `${tpl.id}` : `${tpl.id} u=${u.toFixed(2)}` });
    }
    await page.close();
    process.stderr.write('.');
  }
  await br.close();
  const im = hasCmd('magick') ? 'magick' : 'montage';
  const args = im === 'magick' ? ['montage'] : [];
  files.forEach((x) => args.push('-label', x.label, x.f));
  const cols = Number(a.cols || (frames > 1 ? frames : Math.min(6, files.length)));
  args.push('-tile', `${cols}x`, '-geometry', `${res}x${res}+6+6`, '-background', '#111', '-fill', '#ddd', '-pointsize', '14', a.out || 'sheet.jpg');
  const mr = spawnSync(im, args, { stdio: 'inherit' });
  if (mr.status !== 0) { console.error('\nerror: imagemagick montage failed (is ImageMagick installed?)'); process.exit(1); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + (a.out || 'sheet.jpg'));
}

// v10.1: background music (same rules as the web app and the player): music runs on the wall clock from intro 0 s,
// speed never changes it; video length is set by the animation (music loops if short, cut + fade-out if long) unless fit.
const isUrl = (x) => /^https?:\/\//i.test(String(x || ''));
const AUDIO_MIME = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.mp4': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac', '.webm': 'audio/webm' };
function audioSpec(a, spec) {
  const base = typeof spec.audio === 'string' ? { src: spec.audio } : { ...(spec.audio || {}) };
  if (a.audio && a.audio !== true) base.src = a.audio;
  if (!base.src || a['no-audio']) return null;
  const au = { volume: 1, offset: 0, fadeIn: 0.5, fadeOut: 1, loop: true, fit: false, ...base };
  const num = (k, f) => { if (a[k] != null) { const v = Number(a[k]); if (!isFinite(v)) { console.error(`error: --${k} must be a number`); process.exit(2); } au[f] = v; } };
  num('audio-volume', 'volume'); num('audio-offset', 'offset'); num('audio-fade-in', 'fadeIn'); num('audio-fade-out', 'fadeOut');
  if (a['no-audio-loop']) au.loop = false;
  if (a['audio-fit']) au.fit = a['audio-fit'] !== 'false';
  if (a['audio-link']) au.link = true;
  au.volume = Math.min(1, Math.max(0, +au.volume)); au.offset = Math.max(0, +au.offset); au.fadeIn = Math.max(0, +au.fadeIn); au.fadeOut = Math.max(0, +au.fadeOut);
  if (!isUrl(au.src)) {
    const rel = a.spec && !path.isAbsolute(au.src) ? path.resolve(path.dirname(a.spec), au.src) : null;
    au.src = rel && fs.existsSync(rel) ? rel : path.resolve(au.src);
    if (!fs.existsSync(au.src)) { console.error(`error: audio file not found: ${au.src}`); process.exit(2); }
  }
  au.name = au.name || decodeURIComponent(path.basename(String(au.src).split('?')[0])) || 'music';
  return au;
}
function audioLength(ff, src) {
  const r = spawnSync(ff, ['-hide_banner', '-i', src], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(r.stderr || '');
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}
// ffmpeg pieces: extra input + filter/map/codec, trimmed to exactly D seconds
function audioArgs(au, D, codec) {
  const inp = [...(au.loop ? ['-stream_loop', '-1'] : []), '-i', au.src];
  const f = [`atrim=start=${au.offset.toFixed(3)}`, 'asetpts=PTS-STARTPTS', 'aresample=48000', `volume=${au.volume}`];
  if (au.fadeIn > 0) f.push(`afade=t=in:st=0:d=${Math.min(au.fadeIn, D).toFixed(3)}`);
  if (au.fadeOut > 0) f.push(`afade=t=out:st=${Math.max(0, D - au.fadeOut).toFixed(3)}:d=${Math.min(au.fadeOut, D).toFixed(3)}`);
  f.push('apad');
  const out = ['-filter_complex', `[1:a]${f.join(',')}[wma]`, '-map', '0:v', '-map', '[wma]', '-c:a', codec, '-b:a', codec === 'aac' ? '192k' : '160k', '-t', D.toFixed(3)];
  return { inp, out };
}
async function cmdRender(a) {
  const tpl = await findTemplate(a._[1] || JSON.parse(fs.readFileSync(a.spec, 'utf8')).template);
  const ff = findFfmpeg(); // fail before spending time on frames
  const spec = buildSpec(a, tpl); const media = collectMedia(a, spec);
  const fps = spec.fps; const from = Number(a.from || 0);
  const TL = usesTimeline(spec, a); // v10: intro + hold + N loops on the wall clock; otherwise the v9 path (pixel identical)
  let N = Math.round((a.length ? Number(a.length) : spec.duration) * fps);
  let tlInfo = null;
  if (TL) {
    const sp = spec.speed || 1; const loops = a.loops != null ? Math.max(0, Number(a.loops)) : spec.loops != null ? Math.max(0, Number(spec.loops)) : 1;
    // timeline lengths (mirror of engine/intro.js timelineInfo, so the frame count is known before the page opens)
    const { timelineInfo } = await import(pathToFileURL(path.join(ENGINE, 'intro.js')).href);
    tlInfo = timelineInfo(spec, spec.duration, tpl.id);
    N = Math.round((a.length ? Number(a.length) : spec.length ? Number(spec.length) : tlInfo.total(loops)) * fps);
    if (sp >= 4 && !(spec.fx && spec.fx.motionBlur > 1)) console.error(`tip: speed ${sp}x — consider --motionblur 6 for smooth motion`);
  }
  const au = audioSpec(a, spec);
  if (au && au.fit) { // video length follows the music: whole loops that cover it
    const L = audioLength(ff, au.src) - au.offset;
    if (a.length) console.error('note: --length set, --audio-fit ignored');
    else if (!(L > 0)) console.error('warning: could not read the music length (or offset past its end); --audio-fit ignored');
    else if (TL) { const k = Math.max(1, Math.ceil((L - tlInfo.preWall) / tlInfo.loopWall - 1e-6)); N = Math.round((tlInfo.preWall + k * tlInfo.loopWall) * fps); console.error(`audio-fit: music ${L.toFixed(2)}s -> ${k} loop(s)`); }
    else { const k = Math.max(1, Math.ceil(L / spec.duration - 1e-6)); N = Math.round(k * spec.duration * fps); console.error(`audio-fit: music ${L.toFixed(2)}s -> ${k} loop(s)`); }
  }
  const out = path.resolve(a.out || `${tpl.id}.mp4`);
  const fmt = (a.format || path.extname(out).slice(1) || 'mp4').toLowerCase();
  const workers = Math.max(1, Number(a.workers || Math.min(4, os.cpus().length)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-render-'));
  const t0 = Date.now();
  console.error(TL ? `render ${tpl.id} ${spec.width}x${spec.height} ${(N / fps).toFixed(2)}s (speed ${spec.speed || 1}x, intro ${introOn(spec) ? spec.intro.mode : 'none'} ${tlInfo.introWall.toFixed(2)}s, loop ${tlInfo.loopWall.toFixed(2)}s) @${fps}fps = ${N} frames, ${workers} workers`
    : `render ${tpl.id} ${spec.width}x${spec.height} ${spec.duration}s @${fps}fps = ${N} frames, ${workers} workers`);
  const br = await launch();
  let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage(br, spec.width, spec.height); await initPage(page, spec, tpl, media);
    for (let i = w; i < N; i += workers) {
      const d = TL ? await page.evaluate(([T, f]) => window.WM.frameAt(T, f, 'jpeg', 0.95), [from + i / fps, fps])
        : await page.evaluate(([t, f]) => window.WM.frame(t, f, 'jpeg', 0.95), [from + i / fps, fps]);
      fs.writeFileSync(path.join(tmp, `f${String(i).padStart(6, '0')}.jpg`), b64(d));
      done++; if (done % 15 === 0) process.stderr.write(`\r${done}/${N}`);
    }
    await page.close();
  }));
  await br.close();
  process.stderr.write(`\rframes done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  const inp = ['-y', '-framerate', String(fps), '-i', path.join(tmp, 'f%06d.jpg')];
  const Dv = N / fps;
  const A = au && fmt !== 'gif' ? audioArgs(au, Dv, fmt === 'webm' ? 'libopus' : 'aac') : { inp: [], out: [] };
  if (au && fmt === 'gif') console.error('note: GIF has no sound; music ignored');
  const audio = [...A.inp, ...A.out];
  let args;
  if (fmt === 'webm') args = [...inp, ...audio, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', '-row-mt', '1', out];
  else if (fmt === 'gif') args = [...inp, ...(a['gif-once'] ? ['-loop', '-1'] : []), '-vf', `fps=${Math.min(fps, 20)},scale=${Math.min(spec.width, 720)}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`, out];
  else args = [...inp, ...audio, '-c:v', 'libx264', '-preset', a.preset || 'medium', '-crf', String(a.crf || 16), '-vf', 'scale=out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-movflags', '+faststart', out];
  const r = spawnSync(ff, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) { console.error(r.stderr.toString().slice(-2000)); process.exit(1); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(out);
}
// v10: single-file interactive web page (offline). Player template + engine bundle live in engine/player/.
async function cmdHtml(a) {
  const tpl = await findTemplate(a._[1] || (a.spec && JSON.parse(fs.readFileSync(a.spec, 'utf8')).template));
  const sp = a.spec ? JSON.parse(fs.readFileSync(a.spec, 'utf8')) : {};
  const spec = buildSpec(a, tpl, { res: 1080 });
  const media = collectMedia(a, spec).filter((f) => { if (/\.(mp4|webm|mov|m4v|mkv)$/i.test(f)) { console.error(`note: ${path.basename(f)} skipped (the HTML player embeds images only)`); return false; } return true; });
  const pl = { controls: true, autoplay: true, imgMax: 1600, allBatches: false, ...(sp.player || {}) };
  if (a.controls != null) pl.controls = a.controls !== 'false';
  if (a['no-controls']) pl.controls = false;
  if (a.autoplay != null) pl.autoplay = a.autoplay !== 'false';
  if (a['click-to-play']) pl.autoplay = false;
  if (a['all-batches']) pl.allBatches = a['all-batches'] !== 'false';
  if (a['img-max'] != null) pl.imgMax = a['img-max'] === 'orig' || a['img-max'] === 'original' ? 'orig' : Number(a['img-max']);
  const imode = introOn(spec) ? spec.intro.mode : (a.intro === 'none' || (sp.intro && (sp.intro === 'none' || sp.intro.mode === 'none') && !a.intro) ? 'none' : 'stagger');
  const intro = { ...(typeof spec.intro === 'object' ? spec.intro : {}), mode: imode };
  // batches: --batch-size N splits the media like the web app (last batch back-filled); default one batch = all media
  const bs = Number(a['batch-size'] || sp.batchSize || 0);
  let batches = [media];
  if (bs > 0 && media.length > bs) { batches = []; for (let st = 0; st < media.length; st += bs) { const s0 = Math.min(st, media.length - bs); batches.push(media.slice(s0, s0 + bs)); } }
  const bi = Math.min(Number(a.batch || 0), batches.length - 1);
  const keep = pl.allBatches ? batches : [batches[bi]];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-html-'));
  const im = hasCmd('magick') ? 'magick' : 'convert';
  const cache = new Map();
  const enc = (f) => {
    if (cache.has(f)) return cache.get(f);
    const ext = path.extname(f).toLowerCase(); let buf, mime;
    const alpha = ext === '.png' && /a/.test(spawnSync(hasCmd('magick') ? 'magick' : 'identify', [...(hasCmd('magick') ? ['identify'] : []), '-format', '%[channels]', f]).stdout?.toString() || '');
    if (ext === '.svg' || ext === '.gif' || pl.imgMax === 'orig') { buf = fs.readFileSync(f); mime = { '.svg': 'image/svg+xml', '.gif': 'image/gif', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'image/jpeg'; }
    else {
      const o = path.join(tmp, cache.size + (alpha ? '.png' : '.jpg'));
      const r = spawnSync(im, [f, '-auto-orient', '-resize', `${pl.imgMax}x${pl.imgMax}>`, ...(alpha ? [] : ['-quality', '86', '-strip']), o]);
      if (r.status !== 0) { buf = fs.readFileSync(f); mime = 'image/' + (ext.slice(1).replace('jpg', 'jpeg') || 'png'); } else { buf = fs.readFileSync(o); mime = alpha ? 'image/png' : 'image/jpeg'; }
    }
    const d = `data:${mime};base64,${buf.toString('base64')}`; cache.set(f, d); return d;
  };
  const B = keep.map((b) => b.map(enc));
  let bgImage = null; const bg = spec.background ? { ...spec.background } : undefined;
  if (bg && bg.type === 'image' && bg.image) { bgImage = enc(path.resolve(bg.image)); delete bg.image; }
  const { width, height, media: _m, ratio, res, template, player, intro: _i, speed: _s, audio: _au, ...rest } = spec;
  // v10.1 music: embedded as a data URL (works offline); --audio-link keeps a URL as a link (smaller, needs network)
  const au = audioSpec(a, spec); let audio = null;
  if (au) {
    let src = au.src;
    if (!(isUrl(src) && au.link)) {
      try {
        let buf, mime;
        if (isUrl(src)) { const r = await fetch(src); if (!r.ok) throw new Error('HTTP ' + r.status); buf = Buffer.from(await r.arrayBuffer()); mime = (r.headers.get('content-type') || '').split(';')[0]; }
        else buf = fs.readFileSync(src);
        if (!mime || !mime.startsWith('audio/')) mime = AUDIO_MIME[path.extname(String(src).split('?')[0]).toLowerCase()] || 'audio/mpeg';
        src = `data:${mime};base64,${buf.toString('base64')}`;
      } catch (e) { if (!isUrl(src)) throw e; console.error(`warning: could not download the music (${e.message}); linking the URL instead (needs network)`); }
    }
    audio = { src, name: au.name, volume: au.volume, offset: au.offset, fadeIn: au.fadeIn, fadeOut: au.fadeOut, loop: au.loop };
  }
  let focusB = null; // v10.2 焦点按批次对齐（每批的第 k 张 = 引擎素材 k）
  if (Array.isArray(rest.focus)) { const F = rest.focus; focusB = keep.map((b) => b.map((f) => F[media.indexOf(f)] || null)); if (!focusB.some((g) => g.some(Boolean))) focusB = null; delete rest.focus; }
  const data = { v: 10, template: tpl.id, title: tpl.name, aspect: width / height, spec: { ...rest, background: bg }, speed: spec.speed || 1, intro, player: { ...pl, defaultIntro: imode }, batches: B, batch: pl.allBatches ? bi : 0, focusB, bgImage, audio };
  const bundle = path.join(ENGINE, 'player/wm-engine.min.js');
  if (!fs.existsSync(bundle)) { console.error('error: engine/player/wm-engine.min.js missing — run: node tools/build-bundle.mjs'); process.exit(3); }
  const out = path.resolve(a.out || `${tpl.id}.html`);
  const html = buildPlayerHtml(fs.readFileSync(path.join(ENGINE, 'player/player.html'), 'utf8'), fs.readFileSync(bundle), data);
  fs.writeFileSync(out, html); fs.rmSync(tmp, { recursive: true, force: true });
  console.error(`html ${tpl.id}: ${B.reduce((n, b) => n + b.length, 0)} images in ${B.length} batch(es), intro ${imode}, speed ${data.speed}x${audio ? `, music ${audio.src.startsWith('data:') ? 'embedded' : 'linked'}` : ''}, ${(html.length / 1048576).toFixed(2)} MB`);
  console.log(out);
}
function buildPlayerHtml(tplHtml, bundleBuf, data) {
  const zlib = globalThis.__wmZlib;
  const gz = zlib.gzipSync(bundleBuf, { level: 9 }).toString('base64');
  const loader = `<script>/*! wang-motion engine (skill v10) + three.js | MIT */(async()=>{const S="${gz}";const b=Uint8Array.from(atob(S),c=>c.charCodeAt(0));const t=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();const el=document.createElement("script");el.textContent=t;document.head.appendChild(el);window.dispatchEvent(new Event("wmx-ready"));})();</script>`;
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return tplHtml.split('{{TITLE}}').join(esc(data.title + ' · WANG MOTION')).replace('{{DATA}}', () => json).replace('<!--WM_ENGINE-->', () => loader);
}
// maintenance: probe every template's intro start pose -> engine/intro-compat.js (read by wm info, the web app and the player)
async function cmdIntroCompat(a) {
  const all = await loadTemplates(); const br = await launch(); const out = {};
  const { START_PHASE } = await import(pathToFileURL(path.join(ENGINE, 'intro.js')).href);
  for (const tpl of all) {
    const spec = buildSpec({ ...a, intro: 'stagger' }, tpl, { res: 240, ratio: '16:9', keepTemplate: true }); const media = collectMedia(a, spec);
    const page = await openPage(br, spec.width, spec.height); await initPage(page, spec, tpl, media);
    const v = await page.evaluate((t) => window.WM.visible(t), (START_PHASE[tpl.id] ?? 0) * spec.duration);
    out[tpl.id] = { v, ok: v >= 3 };
    if (v < 3 && a.scan) { const sc = []; for (let k = 0; k < 20; k++) sc.push(await page.evaluate((t) => window.WM.visible(t), (k / 20) * spec.duration)); out[tpl.id].scan = sc; }
    await page.close(); process.stderr.write(v >= 3 ? '.' : 'x');
  }
  await br.close();
  const f = path.join(ENGINE, 'intro-compat.js');
  fs.writeFileSync(f, `// generated by \`wm intro-compat\` — visible cards at the intro start pose per template; ok=false -> stagger falls back to a whole fade\nexport default ${JSON.stringify(out)};\n`);
  const bad = Object.entries(out).filter(([, x]) => !x.ok).map(([k, x]) => `${k}(${x.v}${x.scan ? ' scan ' + x.scan.join(',') : ''})`);
  console.log(`\n${f}\n${all.length - bad.length} ok, ${bad.length} fallback: ${bad.join(', ')}`);
}
function findFfmpeg() { if (hasCmd('ffmpeg')) return 'ffmpeg'; console.error('error: ffmpeg not found on PATH (needed to encode video). Install ffmpeg, or use `wm still` / `wm sheet`.'); process.exit(4); }
async function cmdDoctor() {
  const exe = findChrome(); console.log('chrome:', exe || 'NOT FOUND');
  console.log('ffmpeg:', hasCmd('ffmpeg') ? 'ok' : 'MISSING');
  console.log('imagemagick:', hasCmd('magick') || hasCmd('montage') ? 'ok' : 'missing (sheet needs it)');
  try { await getPW(); console.log('playwright-core: ok'); } catch { }
  if (exe) {
    const ld = spawnSync('ldd', [exe]).stdout?.toString() || ''; const miss = ld.split('\n').filter((l) => l.includes('not found'));
    if (miss.length) { console.log('missing libs:', miss.length, '-> run: sudo -n env PATH=$PATH npx --yes playwright-core@1.56 install-deps chromium'); }
    else { const br = await launch(); const p = await openPage(br, 64, 64); const gl = await p.evaluate(() => !!document.createElement('canvas').getContext('webgl2')); console.log('webgl2:', gl); await br.close(); }
  }
  const all = await loadTemplates(); console.log('templates:', all.length);
}

const HELP = `wang-motion (wm) — card-motion showcase renderer
  wm list [--category c] [--json]       list templates
  wm info <id>                          params + defaults of a template
  wm still <id> [--at 0.3[,0.6]] [--out x.png]       still frame(s) at loop phase
  wm sheet [ids...] [--category c] [--frames 8] [--out sheet.jpg]   contact sheet
  wm render <id> [--media a,b | --media-dir d] [--ratio 16:9] [--res 1080] [--duration 16] [--fps 30]
            [--param key=value ...] [--spec spec.json] [--out out.mp4|.webm|.gif] [--audio a.mp3]
            [--bg #111 | --gradient #a,#b[,#c] --angle 90 | --bg-image p] [--text "Title"] [--logo p]
            [--motionblur 6] [--grain 0.3] [--vignette 0.4] [--card-ratio media|template|4:3] [--count 24]
  v10.2 adapt: --card-ratio media (default: cards take the media's main ratio) | template (v9 shapes) | 4:3 …
       --ratio media (canvas = media ratio)  --fit blur|cover|color [--fit-color #000] (full-frame templates)
       --card-mix own (each card keeps its own image ratio)  --focus 1:0.5,0.3;4:0.2,0.5 (crop focus, image N from 1)
  v10  --speed 0.5 (0.1..8, whole timeline)  --intro none|stagger|whole  --intro-style rise|fly|pop|flip
       --intro-order index|center|ltr|random  --intro-dur 2.5 --intro-hold 0.3 --intro-seed 1 [--intro-phase p] [--no-ramp]
       render --loops N (intro + hold + N loops) [--length s] [--gif-once]   still --at-time 1.2   sheet --intro-frames 6
  wm html <id> [options] [--controls false] [--autoplay false] [--all-batches --batch-size N] [--img-max 1024|1600|orig] --out x.html
  v10.1 music (render + html): --audio a.mp3|https://…  --audio-volume 0..1 (1)  --audio-offset s (0)  --audio-fade-in s (0.5)
       --audio-fade-out s (1, render)  --no-audio-loop  --audio-fit (render: whole loops that cover the music)  --audio-link (html: keep URL, don't embed)
  wm intro-compat                       regenerate engine/intro-compat.js (visible cards at the intro start pose)
  wm doctor                             environment check`;
const a = parseArgs(process.argv.slice(2));
const cmd = a._[0];
const T = { list: cmdList, info: cmdInfo, still: cmdStill, sheet: cmdSheet, render: cmdRender, html: cmdHtml, 'intro-compat': cmdIntroCompat, doctor: cmdDoctor };
if (!T[cmd]) { console.log(HELP); process.exit(cmd ? 1 : 0); }
await T[cmd](a);
