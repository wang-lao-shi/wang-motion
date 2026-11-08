#!/usr/bin/env node
// wang-motion CLI — list / info / still / sheet / render / doctor
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync, spawn, execSync } from 'child_process';
import crypto from 'crypto';
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
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache/ms-playwright');
  for (const base of [pw, '/workspace/tools/ms-playwright']) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base)) {
      if (d.startsWith('chromium_headless_shell')) cands.push(path.join(base, d, 'chrome-linux/headless_shell'), path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell'));
      if (d.startsWith('chromium-')) cands.push(path.join(base, d, 'chrome-linux/chrome'), path.join(base, d, 'chrome-linux64/chrome'));
    }
  }
  cands.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  return cands.find((c) => fs.existsSync(c));
}
async function getPW() {
  const tries = [path.join(ROOT, 'node_modules/playwright-core/index.mjs'), 'playwright-core', 'playwright'];
  for (const t of tries) { try { return await import(t.startsWith('/') ? pathToFileURL(t).href : t); } catch { } }
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
    let p = decodeURIComponent(u.pathname);
    const file = p.startsWith('/@fs/') ? p.slice(4) : path.join(ENGINE, p);
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
const fsUrl = (p) => 'http://wm.local/@fs' + encodeURI(path.resolve(p));

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
function hasCmd(c) { return spawnSync('sh', ['-c', `command -v ${c}`]).status === 0; }

// ---------------- spec ----------------
function buildSpec(a, tpl, def = {}) {
  let spec = {};
  if (a.spec) spec = JSON.parse(fs.readFileSync(a.spec, 'utf8'));
  const ratio = a.ratio || spec.ratio || def.ratio || tpl.defaultRatio || '16:9';
  const [rw, rh] = RATIOS[ratio] || ratio.split(':').map(Number);
  const res = Number(a.res || spec.res || def.res || 1080);
  let W, H; if (a.width && a.height) { W = +a.width; H = +a.height; } else if (rw >= rh) { H = res; W = Math.round((res * rw) / rh); } else { W = res; H = Math.round((res * rh) / rw); }
  W -= W % 2; H -= H % 2;
  spec.width = W; spec.height = H; spec.ratio = ratio;
  spec.duration = Number(a.duration || spec.duration || tpl.duration || 16);
  spec.fps = Number(a.fps || spec.fps || 30);
  spec.params = normParams({ ...(spec.params || {}), ...a.param }, tpl.params || {});
  if (a.count) spec.count = +a.count;
  if (a['card-ratio']) spec.cardRatio = a['card-ratio'];
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
  const { layout, setup, camera, ...r } = t; console.log(JSON.stringify(r, null, 1));
}
async function cmdStill(a) {
  const tpl = await findTemplate(a._[1] || (a.spec && JSON.parse(fs.readFileSync(a.spec, 'utf8')).template));
  const spec = buildSpec(a, tpl, { res: 720 }); const media = collectMedia(a, spec);
  const br = await launch(); const page = await openPage(br, spec.width, spec.height);
  await initPage(page, spec, tpl, media);
  const ts = String(a.at ?? '0.3').split(',').map(Number);
  const out = a.out || `${tpl.id}.png`;
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
  const frames = Number(a.frames || 1);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-sheet-'));
  const br = await launch();
  const specFile = a.spec ? JSON.parse(fs.readFileSync(a.spec, 'utf8')) : {};
  const res = Number(a.res || specFile.res || 360);
  let page; const files = [];
  for (const tpl of tpls) {
    const spec = buildSpec(a, tpl, { res, ratio: '1:1' }); const media = collectMedia(a, spec);
    page = await openPage(br, spec.width, spec.height);
    await initPage(page, spec, tpl, media);
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
async function cmdRender(a) {
  const tpl = await findTemplate(a._[1] || JSON.parse(fs.readFileSync(a.spec, 'utf8')).template);
  const ff = findFfmpeg(); // fail before spending time on frames
  const spec = buildSpec(a, tpl); const media = collectMedia(a, spec);
  const fps = spec.fps; const from = Number(a.from || 0); const N = Math.round((a.length ? Number(a.length) : spec.duration) * fps);
  const out = path.resolve(a.out || `${tpl.id}.mp4`);
  const fmt = (a.format || path.extname(out).slice(1) || 'mp4').toLowerCase();
  const workers = Math.max(1, Number(a.workers || Math.min(4, os.cpus().length)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-render-'));
  const t0 = Date.now();
  console.error(`render ${tpl.id} ${spec.width}x${spec.height} ${spec.duration}s @${fps}fps = ${N} frames, ${workers} workers`);
  const br = await launch();
  let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage(br, spec.width, spec.height); await initPage(page, spec, tpl, media);
    for (let i = w; i < N; i += workers) {
      const d = await page.evaluate(([t, f]) => window.WM.frame(t, f, 'jpeg', 0.95), [from + i / fps, fps]);
      fs.writeFileSync(path.join(tmp, `f${String(i).padStart(6, '0')}.jpg`), b64(d));
      done++; if (done % 15 === 0) process.stderr.write(`\r${done}/${N}`);
    }
    await page.close();
  }));
  await br.close();
  process.stderr.write(`\rframes done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  const inp = ['-y', '-framerate', String(fps), '-i', path.join(tmp, 'f%06d.jpg')];
  const audio = a.audio ? ['-i', a.audio, '-shortest', '-c:a', 'aac', '-b:a', '192k'] : [];
  let args;
  if (fmt === 'webm') args = [...inp, ...audio.slice(0, 2), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', '-row-mt', '1', ...(a.audio ? ['-shortest', '-c:a', 'libopus'] : []), out];
  else if (fmt === 'gif') args = [...inp, '-vf', `fps=${Math.min(fps, 20)},scale=${Math.min(spec.width, 720)}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`, out];
  else args = [...inp, ...audio, '-c:v', 'libx264', '-preset', a.preset || 'medium', '-crf', String(a.crf || 16), '-vf', 'scale=out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-movflags', '+faststart', out];
  const r = spawnSync(ff, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) { console.error(r.stderr.toString().slice(-2000)); process.exit(1); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(out);
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
            [--motionblur 6] [--grain 0.3] [--vignette 0.4] [--card-ratio 4:3] [--count 24]
  wm doctor                             environment check`;
const a = parseArgs(process.argv.slice(2));
const cmd = a._[0];
const T = { list: cmdList, info: cmdInfo, still: cmdStill, sheet: cmdSheet, render: cmdRender, doctor: cmdDoctor };
if (!T[cmd]) { console.log(HELP); process.exit(cmd ? 1 : 0); }
await T[cmd](a);
