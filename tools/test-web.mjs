#!/usr/bin/env node
// Web app checks (file://): load without errors; v10 UI (speed popover, keys, intro preview, export rows);
// stills for regression (--stills dir --ids a,b --phases 0.1,0.45,0.8); intro stills (--intro-stills dir);
// export downloads (--export html,gif,img,zip,mp4 --out dir).
// usage: node tools/test-web.mjs index.html [--stills dir] [--ids ...] [--export fmts --out dir]
import fs from 'fs'; import path from 'path'; import os from 'os'; import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2); const file = path.resolve(A[0]);
const opt = (k, d) => { const i = A.indexOf('--' + k); return i > 0 ? A[i + 1] : d; };
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'node_modules/playwright-core/index.mjs')).href);
function findChrome() { for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache/ms-playwright'), '/workspace/tools/ms-playwright']) { if (!fs.existsSync(base)) continue; for (const d of fs.readdirSync(base)) if (d.startsWith('chromium_headless_shell')) { const p = path.join(base, d, 'chrome-linux/headless_shell'); if (fs.existsSync(p)) return p; } } }
const br = await chromium.launch({ executablePath: process.env.WM_CHROME || findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND|407 \(Proxy|ERR_TUNNEL|ERR_PROXY|ERR_NAME/.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => window.WMX && typeof selectEffect === 'function', null, { timeout: 90000 });
await page.waitForTimeout(800);
const res = { file: path.basename(file), checks: [] }; const ok = (n, v) => res.checks.push([n, !!v]);
const v10 = await page.evaluate(() => typeof WMV !== 'undefined');
// enter the studio
await page.evaluate(() => { document.getElementById('btnViewStudio')?.click(); });
await page.waitForTimeout(500);

const stillDir = opt('stills');
if (stillDir) {
  fs.mkdirSync(stillDir, { recursive: true });
  const ids = (opt('ids') || '').split(',').filter(Boolean);
  const phases = (opt('phases') || '0.1,0.45,0.8').split(',').map(Number);
  const all = ids.length ? ids : await page.evaluate(() => TEMPLATES.map((t) => t.id));
  for (const id of all) {
    const shots = await page.evaluate(async ([id, phases]) => {
      selectEffect(id); await new Promise((r) => setTimeout(r, 30));
      const W = 432, H = 240; const E = await wmPrepareExportEngine(W, H, 30);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const out = [];
      for (const ph of phases) { renderStudio3D(cv, { w: W, h: H, fps: 30, time: ph, now: 0, bg: true, grid: false, axes: false }); out.push(cv.toDataURL('image/png')); }
      wmDisposeExportEngine(); return out;
    }, [id, phases]);
    shots.forEach((d, k) => fs.writeFileSync(path.join(stillDir, `${id}-${k}.png`), Buffer.from(d.split(',')[1], 'base64')));
    process.stderr.write('.');
  }
  process.stderr.write('\n');
}
const introDir = opt('intro-stills');
if (introDir && v10) {
  fs.mkdirSync(introDir, { recursive: true });
  const ids = (opt('ids') || '').split(',').filter(Boolean);
  const Ts = (opt('times') || '0.6,1.4,2.2,3.0,3.6').split(',').map(Number);
  for (const id of ids) {
    const shots = await page.evaluate(async ([id, Ts]) => {
      selectEffect(id); await new Promise((r) => setTimeout(r, 30));
      const W = 432, H = 240; await wmPrepareExportEngine(W, H, 30);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const out = [];
      const tl = { speed: playSpeed, intro: wmvIntroSpec('stagger'), mb: false };
      for (const T of Ts) { renderStudio3D(cv, { w: W, h: H, fps: 30, T, tl, time: 0, now: 0, bg: true }); out.push(cv.toDataURL('image/png')); }
      wmDisposeExportEngine(); return out;
    }, [id, Ts]);
    shots.forEach((d, k) => fs.writeFileSync(path.join(introDir, `${id}-${k}.png`), Buffer.from(d.split(',')[1], 'base64')));
  }
}

if (v10 && !stillDir && !introDir) {
  await page.evaluate(() => selectEffect('card-globe')); await page.waitForTimeout(300);
  // speed popover + presets + label
  await page.click('#btnSpeed'); ok('button click keeps speed (no v9 cycle)', await page.evaluate(() => playSpeed === 1)); ok('speed popover opens', await page.evaluate(() => document.querySelector('.wm-spd-pop')?.classList.contains('open')));
  await page.click('.wm-spd-pop .chips button[data-s="0.5"]');
  ok('preset 0.5x', await page.evaluate(() => playSpeed === 0.5));
  ok('label shows 秒/圈', /0\.5×.*秒\/圈/.test(await page.evaluate(() => document.getElementById('btnSpeed').textContent)));
  await page.mouse.click(20, 780);
  await page.keyboard.press('='); ok('= speeds up', await page.evaluate(() => playSpeed > 0.5));
  await page.keyboard.press('0'); ok('0 resets', await page.evaluate(() => playSpeed === 1));
  await page.keyboard.press('-'); ok('- slows', await page.evaluate(() => playSpeed < 1));
  await page.hover('#btnSpeed'); await page.mouse.wheel(0, -100); await page.waitForTimeout(100);
  ok('wheel adjusts', await page.evaluate(() => playSpeed !== 1));
  ok('speed remembered', await page.evaluate(() => +localStorage.getItem('wm_speed') === playSpeed));
  await page.keyboard.press('0');
  // stage intro preview
  await page.click('#btnPreviewIntro'); await page.waitForTimeout(300);
  ok('preview running', await page.evaluate(() => !!WMV.preview));
  await page.waitForFunction(() => !WMV.preview, null, { timeout: 30000 }).catch(() => {});
  ok('preview hands back to loop', await page.evaluate(() => !WMV.preview));
  // export modal rows
  await page.evaluate(() => wmOpenExport()); await page.waitForTimeout(200);
  await page.click('[data-v10="mode:stagger"]');
  ok('intro opts visible', await page.evaluate(() => !document.getElementById('wmExIntroOpts').classList.contains('hide')));
  ok('info shows actual duration', /实际时长/.test(await page.evaluate(() => document.getElementById('wmExInfo').textContent)));
  await page.click('#wmExFmts [data-fmt="html"]');
  ok('html info', /交互网页/.test(await page.evaluate(() => document.getElementById('wmExInfo').textContent)));
  await page.evaluate(() => selectEffect('glitch-cut-slideshow'));
  await page.evaluate(() => wmExportUpdateInfo());
  ok('stagger greyed on slideshow', await page.evaluate(() => document.querySelector('[data-v10="mode:stagger"]').classList.contains('wm-dis')));
  await page.evaluate(() => { selectEffect('card-globe'); wmCloseExport(); });
  res.introDur = await page.evaluate(() => wmvInfo().total(1));
}

const exp = opt('export'); const outDir = opt('out', '/tmp');
if (exp && v10) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of exp.split(',')) {
    const [fmt, id] = f.split(':');
    await page.evaluate(([fmt, id]) => {
      selectEffect(id || 'card-globe'); wmOpenExport(); wmExportState.fmt = fmt;
      if (fmt === 'gif') { wmExportState.gifW = 480; wmExportState.gifFps = 12; }
      if (fmt === 'mp4' || fmt === 'zip' || fmt === 'pptx') { wmExportState.res = 720; wmExportState.fps = 30; }
      if (fmt === 'img') { wmExportState.kfN = 4; wmExportState.kfFmt = 'jpg'; WMV.kfIntro = true; WMV.kfIntroN = 3; }
      WMV.intro.mode = 'stagger'; WMV.intro.dur = 2; WMV.intro.hold = 0.2; WMV.loops = 1; WMV.player.imgMax = 1024;
      wmExportUpdateInfo();
    }, [fmt, id]);
    const info = await page.evaluate(() => document.getElementById('wmExInfo').textContent);
    const dl = page.waitForEvent('download', { timeout: 600000 });
    await page.evaluate(() => wmStartExport());
    const d = await dl; const p = path.join(outDir, (id ? id + '_' : '') + d.suggestedFilename()); await d.saveAs(p);
    const st = await page.evaluate(() => document.getElementById('wmExStatus').textContent);
    res.checks.push([`export ${f}: ${path.basename(p)} ${(fs.statSync(p).size / 1048576).toFixed(2)} MB · ${info.slice(0, 80)} · ${st}`, fs.statSync(p).size > 1000]);
    await page.evaluate(() => wmCloseExport());
  }
}
res.errors = errs; res.pass = errs.length === 0 && res.checks.every((c) => c[1]);
await br.close();
console.log(JSON.stringify(res, null, 1));
process.exit(res.pass ? 0 : 1);
