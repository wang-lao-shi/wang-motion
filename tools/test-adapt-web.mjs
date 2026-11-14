#!/usr/bin/env node
// v10.2 素材比例自适应 + 导出按钮可见性，网页验收。
// usage: node tools/test-adapt-web.mjs <web index.html> <media root with r169 r43 r11 r916 folders> [--out dir] [--export mp4,html,zip,gif]
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawnSync } from 'child_process'; import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2); const opt = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? A[i + 1] : d; };
const file = path.resolve(A[0]); const MR = path.resolve(A[1]); const outDir = path.resolve(opt('out', '/tmp/wm-adapt')); fs.mkdirSync(outDir, { recursive: true });
const exps = (opt('export', '') || '').split(',').filter(Boolean);
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'node_modules/playwright-core/index.mjs')).href);
function findChrome() { for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache/ms-playwright'), '/workspace/tools/ms-playwright']) { if (!fs.existsSync(base)) continue; for (const d of fs.readdirSync(base)) if (d.startsWith('chromium_headless_shell')) { const p = path.join(base, d, 'chrome-linux/headless_shell'); if (fs.existsSync(p)) return p; } } }
const br = await chromium.launch({ executablePath: process.env.WM_CHROME || findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const res = { checks: [] }; const ok = (n, v, extra) => res.checks.push([n, !!v, ...(extra != null ? [extra] : [])]);
const errs = [];
const files = (dir) => fs.readdirSync(path.join(MR, dir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort().map((f) => path.join(MR, dir, f));

// ---------- 1. 导出按钮：各种窗口尺寸 / 缩放 ----------
const VPS = [[1920, 1080, 1], [1440, 900, 1], [1366, 768, 1], [1280, 720, 1], [1280, 720, 1.25], [1280, 720, 1.5], [1024, 600, 1], [800, 600, 1], [768, 1024, 1], [390, 844, 3], [1366, 768, 1.75]];
{
  for (const [w, h, z] of VPS) {
    // 浏览器缩放 = CSS 视口变小 + 设备像素比变大
    const ctx = await br.newContext({ viewport: { width: Math.round(w / z), height: Math.round(h / z) }, deviceScaleFactor: z });
    const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(`[${w}x${h}@${z}] ` + e.message));
    await page.goto(pathToFileURL(file).href);
    await page.waitForFunction(() => window.WMX && typeof wmOpenExport === 'function', null, { timeout: 90000 });
    await page.evaluate(() => { document.getElementById('btnViewStudio')?.click(); });
    await page.waitForTimeout(300);
    const r = [];
    for (const fmt of ['mp4', 'img', 'html']) {
      await page.evaluate((f) => { wmOpenExport(); wmExportState.fmt = f; document.querySelectorAll('#wmExFmts button').forEach(b => b.classList.toggle('active', b.dataset.fmt === f)); wmExportUpdateInfo(); document.querySelectorAll('#wmExportModal .wm-ex-row[data-for]').forEach(row => { row.style.display = row.dataset.for.split(' ').includes(f) ? '' : 'none'; }); }, fmt);
      await page.waitForTimeout(150);
      const v = await page.evaluate(() => {
        const b = document.getElementById('wmExGo'); const c = document.getElementById('wmExCancel'); const rc = b.getBoundingClientRect();
        const inView = rc.top >= 0 && rc.left >= 0 && rc.bottom <= innerHeight + 0.5 && rc.right <= innerWidth + 0.5 && rc.width > 20;
        const hit = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
        const box = document.querySelector('#wmExportModal .wm-modal-box'); const bb = box.getBoundingClientRect();
        return { inView, clickable: hit === b || b.contains(hit), cancel: !!(c && c.getBoundingClientRect().bottom <= innerHeight + 0.5), btn: [Math.round(rc.left), Math.round(rc.top), Math.round(rc.width), Math.round(rc.height)], box: [Math.round(bb.top), Math.round(bb.height)], vh: innerHeight, scroll: box.scrollHeight > box.clientHeight };
      });
      r.push([fmt, v]);
    }
    const good = r.every(([, v]) => v.inView && v.clickable && v.cancel);
    ok(`export button visible ${w}x${h} zoom ${Math.round(z * 100)}%`, good, r.map(([f, v]) => `${f}: btn ${v.btn.join(',')} box ${v.box.join(',')} vh ${v.vh}${v.scroll ? ' (scroll)' : ''}${v.inView && v.clickable ? '' : ' HIDDEN'}`).join(' | '));
    if (w === 1280 && z === 1.5) await page.screenshot({ path: path.join(outDir, 'export-1280x720-150.png') });
    if (w === 390) await page.screenshot({ path: path.join(outDir, 'export-phone.png') });
    await ctx.close();
  }
}

// ---------- 2. 素材比例 ----------
const ctx = await br.newContext({ viewport: { width: 1440, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND|407 \(Proxy|ERR_TUNNEL|ERR_PROXY|ERR_NAME/.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => window.WMX && WMX.adapt && typeof wmAdSpec === 'function', null, { timeout: 90000 });
await page.evaluate(() => { localStorage.removeItem('wm_adapt_v102'); });
await page.evaluate(() => { document.getElementById('btnViewStudio')?.click(); });
await page.waitForTimeout(400);
await page.evaluate(() => selectEffect('cover-flow')); await page.waitForTimeout(600);
ok('ratio button in stage + present toolbars', await page.evaluate(() => document.querySelectorAll('.wmad-tool').length === 2));
ok('ratio row in export panel', await page.evaluate(() => !!document.getElementById('wmExAdaptRow')));
ok('no images: template look (no adapt spec)', await page.evaluate(() => !WMB.engines.stage || !WMB.engines.stage.eng.spec.cardRatio));
const snap = async (name) => { await page.waitForTimeout(900); const el = await page.$('#studioCanvas'); const b = await el.boundingBox(); try { await page.screenshot({ path: path.join(outDir, name), clip: b, timeout: 60000 }); } catch (e) { errs.push('snap ' + name + ': ' + e.message.slice(0, 80)); } };
await snap('stage-0-default.png');

const imp = async (list) => { await page.setInputFiles('#wmImportInput', list); await page.waitForFunction((n) => wmUserImgs.length === n && wmUserImgs.every(im => im.naturalWidth), list.length, { timeout: 30000 }); await page.waitForTimeout(1300); };
const waitEng = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 }).then(() => true, () => false);
await imp(files('r169'));
await waitEng(() => { const e = WMB.engines.stage; return e && e.eng.spec && e.eng.spec.cardRatio === 'media' && Math.abs(e.eng._mR - 16 / 9) < 0.01; });
let sp = await page.evaluate(() => { const s = WMB.engines.stage.eng.spec; return { cr: s.cardRatio, fit: s.fit, R: WMB.engines.stage.eng._mR }; });
ok('16:9 images: stage follows media', sp.cr === 'media' && Math.abs(sp.R - 16 / 9) < 0.01, sp);
ok('ratio button shows 16:9', await page.evaluate(() => /16:9/.test(document.querySelector('.wmad-tool').textContent)));
ok('no banner for uniform 16:9', await page.evaluate(() => !document.getElementById('wmAdBanner')));
await snap('stage-1-cover-flow-169.png');
const badges = await page.evaluate(() => { renderStudioList(); return [...document.querySelectorAll('.wmad-badge')].map(b => [b.closest('[data-id]').dataset.id, b.textContent]); });
ok('template badges', badges.length >= 50, `${badges.length} badges, full: ${badges.filter(b => b[1] === '完整').length}`);
res.badges169 = badges.filter(b => b[1] !== '完整');

await imp(files('r916'));
await page.evaluate(() => selectEffect('glitch-cut-slideshow')); await page.waitForTimeout(400);
await waitEng(() => { const e = WMB.engines.stage; return e && e.eng.spec && e.eng.spec.cardRatio === 'media' && Math.abs(e.eng._mR - 9 / 16) < 0.01; });
ok('9:16 images: canvas banner', await page.evaluate(() => /画面改为 9:16/.test(document.getElementById('wmAdBanner')?.textContent || '')));
sp = await page.evaluate(() => ({ fit: WMB.engines.stage.eng.spec.fit, R: WMB.engines.stage.eng._mR }));
ok('full-frame default = blur', sp.fit === 'blur' && Math.abs(sp.R - 9 / 16) < 0.01, sp);
await snap('stage-2-glitch-916-blur.png');
await page.click('#wmAdBanner button[data-a=canvas]'); await page.waitForTimeout(300);
ok('canvas follows media → stage letterbox', await page.evaluate(() => { const b = wmAdBox(1600, 900); return b && Math.abs(b[2] / b[3] - 9 / 16) < 0.02; }));
await snap('stage-3-glitch-916-canvas.png');
await page.evaluate(() => { wmOpenExport(); wmExportState.fmt = 'mp4'; wmExportState.res = 1080; wmExportUpdateInfo(); });
ok('export dims 1080×1920', await page.evaluate(() => wmExDims().join('x') === '1080x1920'), await page.evaluate(() => wmExDims().join('x') + ' | ' + document.getElementById('wmExInfo').textContent));
await page.evaluate(() => { wmExportState.fmt = 'pptx'; wmExportUpdateInfo(); });
ok('pptx stays 16:9', await page.evaluate(() => wmExDims().join('x') === '1920x1080'));
await page.evaluate(() => { wmExportState.fmt = 'gif'; wmExportState.gifW = 640; wmExportUpdateInfo(); });
ok('gif dims 360×640', await page.evaluate(() => wmExDims().join('x') === '360x640'), await page.evaluate(() => wmExDims().join('x')));
await page.evaluate(() => { wmExportState.fmt = 'mp4'; wmCloseExport(); });

// mixed
await imp([...files('r169').slice(0, 4), ...files('r43').slice(0, 2), files('r916')[0]]);
await page.evaluate(() => selectEffect('cover-flow')); await page.waitForTimeout(300);
ok('mixed: banner names the ratios', await page.evaluate(() => /3 种比例/.test(document.getElementById('wmAdBanner')?.textContent || '')), await page.evaluate(() => document.getElementById('wmAdBanner')?.textContent));
await snap('stage-4-mixed-uniform.png');
await page.click('#wmAdBanner button[data-a=focus]'); await page.waitForTimeout(400);
ok('focus editor opens', await page.evaluate(() => document.getElementById('wmAdFocusModal').classList.contains('open') && document.querySelectorAll('.wmad-fit').length === 7));
// set focus of the 9:16 image (#7) to the top
const fb = await page.$$('.wmad-fimg'); const bb = await fb[6].boundingBox();
await page.mouse.click(bb.x + bb.width * 0.5, bb.y + 4);
await page.waitForTimeout(200);
ok('focus saved on image', await page.evaluate(() => wmUserImgs[6]._wmFocus && wmUserImgs[6]._wmFocus[1] < 0.1), await page.evaluate(() => wmUserImgs[6]._wmFocus));
await page.screenshot({ path: path.join(outDir, 'focus-editor.png') });
await page.click('.wmad-fdone'); await page.waitForTimeout(300);
await page.evaluate(() => selectEffect('glitch-cut-slideshow')); // 12 格：第 7 张在同一批
await waitEng(() => { const f = WMB.engines.stage.eng.spec.focus; return Array.isArray(f) && f.some(x => x && x[1] < 0.1); });
ok('focus reaches the engine', await page.evaluate(() => { const f = WMB.engines.stage.eng.spec.focus; return Array.isArray(f) && f.some(x => x && x[1] < 0.1); }));
await page.evaluate(() => { WMAD.card = 'own'; wmAdChanged(); }); await waitEng(() => WMB.engines.stage.eng.spec.cardMix === 'own');
ok('own ratios → cardMix own', await page.evaluate(() => WMB.engines.stage.eng.spec.cardMix === 'own'));
await snap('stage-5-mixed-own.png');
await page.evaluate(() => { WMAD.card = 'template'; wmAdChanged(); }); await waitEng(() => !WMB.engines.stage.eng.spec.cardRatio);
ok('template → no adapt', await page.evaluate(() => !WMB.engines.stage.eng.spec.cardRatio));
await page.evaluate(() => { WMAD.card = 'media'; WMAD.canvas = '16:9'; wmAdChanged(); });
await page.reload(); await page.waitForFunction(() => window.WMX && typeof wmAdSpec === 'function' && wmUserImgs.length === 7 && wmUserImgs.every(im => im.naturalWidth), null, { timeout: 90000 }); await waitEng(() => wmUserImgs[6] && wmUserImgs[6]._wmFocus);
ok('settings + focus survive reload', await page.evaluate(() => WMAD.card === 'media' && wmUserImgs[6]._wmFocus && wmUserImgs[6]._wmFocus[1] < 0.1));

// exports with 9:16 media + canvas follow
for (const fmt of exps) {
  await imp(files('r916'));
  await page.evaluate((fmt) => {
    WMAD.canvas = 'media'; wmAdChanged(); selectEffect('cover-flow'); wmOpenExport(); wmExportState.fmt = fmt; wmExportState.res = 720; wmExportState.fps = 30; wmExportState.dur = 5; wmExportState.gifW = 480;
    if (typeof WMV !== 'undefined') { WMV.intro.mode = 'none'; }
    wmExportUpdateInfo();
  }, fmt);
  const dl = page.waitForEvent('download', { timeout: 900000 });
  await page.evaluate(() => wmStartExport());
  const d = await dl; const p = path.join(outDir, d.suggestedFilename()); await d.saveAs(p);
  const info = { file: path.basename(p), mb: +(fs.statSync(p).size / 1048576).toFixed(2) };
  if (fmt === 'mp4' || fmt === 'gif') {
    const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], { encoding: 'utf8' }); info.dims = r.stdout.trim();
    ok(`${fmt} is portrait 9:16`, fmt === 'mp4' ? info.dims === '720,1280' : info.dims === '270,480', info);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '2', '-i', p, '-frames:v', '1', path.join(outDir, `export-${fmt}-frame.png`)]);
  } else if (fmt === 'html') {
    const h = fs.readFileSync(p, 'utf8'); const m = h.match(/<script type="application\/json" id="wm-data">([\s\S]*?)<\/script>/); const D = JSON.parse(m[1]);
    info.aspect = D.aspect; info.cardRatio = D.spec.cardRatio; info.fit = D.spec.fit;
    ok('html carries adapt + 9:16 aspect', D.spec.cardRatio === 'media' && Math.abs(D.aspect - 9 / 16) < 0.01, info);
    res.htmlFile = p;
  } else if (fmt === 'zip') {
    const sp2 = JSON.parse(spawnSync('unzip', ['-p', p, 'spec.json'], { encoding: 'utf8' }).stdout); info.spec = { cardRatio: sp2.cardRatio, fit: sp2.fit, ratio: sp2.ratio };
    ok('zip spec carries adapt + ratio', sp2.cardRatio === 'media' && sp2.ratio === '9:16', info);
  }
  res.checks.push(['export ' + fmt, true, info]);
  await page.evaluate(() => wmCloseExport());
}
await page.close();
if (res.htmlFile) {
  const pp = await ctx.newPage(); pp.on('pageerror', (e) => errs.push('player: ' + e.message));
  await pp.setViewportSize({ width: 600, height: 900 });
  await pp.goto(pathToFileURL(res.htmlFile).href);
  await pp.waitForFunction(() => window.WMP && window.WMP.ready, null, { timeout: 60000 }); await pp.waitForTimeout(1500);
  await pp.screenshot({ path: path.join(outDir, 'player-916.png') });
  ok('player renders', true);
}
await br.close();
res.errors = errs;
console.log(JSON.stringify(res, null, 1));
