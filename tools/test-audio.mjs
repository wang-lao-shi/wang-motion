#!/usr/bin/env node
// v10.1 background-music acceptance test (web app + exported files + interactive player).
// usage: node tools/test-audio.mjs <web index.html> <music file> [--out dir] [--export mp4,html,zip] [--policy block]
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawnSync } from 'child_process'; import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2); const opt = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? A[i + 1] : d; };
const file = path.resolve(A[0]); const music = path.resolve(A[1]); const outDir = path.resolve(opt('out', '/tmp/wm-audio')); fs.mkdirSync(outDir, { recursive: true });
const exps = (opt('export', '') || '').split(',').filter(Boolean);
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'node_modules/playwright-core/index.mjs')).href);
function findChrome() { for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache/ms-playwright'), '/workspace/tools/ms-playwright']) { if (!fs.existsSync(base)) continue; for (const d of fs.readdirSync(base)) if (d.startsWith('chromium_headless_shell')) { const p = path.join(base, d, 'chrome-linux/headless_shell'); if (fs.existsSync(p)) return p; } } }
const block = opt('policy') === 'block';
const br = await chromium.launch({ executablePath: process.env.WM_CHROME || findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', block ? '--autoplay-policy=user-gesture-required' : '--autoplay-policy=no-user-gesture-required'] });
const ctx = await br.newContext({ viewport: { width: 1440, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND|407 \(Proxy|ERR_TUNNEL|ERR_PROXY|ERR_NAME/.test(m.text())) errs.push('console: ' + m.text()); });
const res = { checks: [] }; const ok = (n, v, extra) => res.checks.push([n, !!v, ...(extra != null ? [extra] : [])]);
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => window.WMX && typeof selectEffect === 'function' && typeof WMA !== 'undefined', null, { timeout: 90000 });
await page.waitForTimeout(600);
await page.evaluate(() => { document.getElementById('btnViewStudio')?.click(); });
await page.waitForTimeout(400);
await page.evaluate(() => selectEffect('grid-zoom-strip')); await page.waitForTimeout(300);
ok('music button in stage + present toolbars', await page.evaluate(() => document.querySelectorAll('.wma-tool').length === 2));
ok('music row in export panel', await page.evaluate(() => !!document.getElementById('wmExAudioRow')));
// upload through the stage popover
await page.click('.wma-tool');
ok('popover opens', await page.evaluate(() => document.querySelector('.wma-pop').classList.contains('open')));
await page.setInputFiles('.wma-pop input[type=file]', music);
await page.waitForFunction(() => WMA.ok, null, { timeout: 20000 });
ok('music loaded', await page.evaluate(() => WMA.ok && WMA.len > 1), await page.evaluate(() => WMA.len));
await page.mouse.click(1300, 120); // close popover (also a user gesture)
await page.evaluate(() => { if (!isPlaying) document.getElementById('btnPlayPause').click(); });
await page.waitForTimeout(1200);
const st1 = await page.evaluate(() => ({ paused: wmaEl.paused, t: wmaEl.currentTime, blocked: wmaBlocked }));
ok('plays with the stage (sound on by default)', !st1.paused && st1.t > 0.2, st1);
await page.evaluate(() => document.getElementById('btnPlayPause').click()); await page.waitForTimeout(900);
ok('pauses with the stage', await page.evaluate(() => wmaEl.paused));
await page.evaluate(() => document.getElementById('btnPlayPause').click()); await page.waitForTimeout(600);
await page.keyboard.press('m'); await page.waitForTimeout(900);
ok('M mutes', await page.evaluate(() => WMA.muted && wmaEl.paused));
await page.keyboard.press('m'); await page.waitForTimeout(600);
ok('M unmutes', await page.evaluate(() => !WMA.muted && !wmaEl.paused));
await page.evaluate(() => wmvStartPreview()); await page.waitForTimeout(150);
ok('intro preview restarts the music', await page.evaluate(() => wmaEl.currentTime < 0.6 + WMA.offset));
await page.evaluate(() => { WMA.volume = 0.7; WMA.offset = 1; WMA.fadeIn = 0.3; WMA.fadeOut = 0.8; wmaSave(); });
ok('settings persisted', await page.evaluate(() => JSON.parse(localStorage.getItem('wm_audio')).volume === 0.7));
// gif row hint
await page.evaluate(() => { wmOpenExport(); wmExportState.fmt = 'gif'; wmExportUpdateInfo(); });
ok('GIF: no-sound hint', /GIF 不支持声音/.test(await page.evaluate(() => document.querySelector('#wmExAudioRow .wma-hint').textContent)));
await page.evaluate(() => { wmExportState.fmt = 'mp4'; wmExportUpdateInfo(); });
ok('MP4: info says music', /含背景音乐/.test(await page.evaluate(() => document.getElementById('wmExInfo').textContent)));
await page.evaluate(() => { WMA.fit = true; wmExportUpdateInfo(); });
const fitHint = await page.evaluate(() => document.querySelector('#wmExAudioRow .wma-hint').textContent);
ok('fit: loops computed', /自动 \d+ 圈/.test(fitHint), fitHint);
await page.evaluate(() => { WMA.fit = false; wmaSave(); wmCloseExport(); });
res.encoders = await page.evaluate(async () => { const o = {}; for (const c of ['mp4a.40.2', 'opus']) { try { o[c] = (await AudioEncoder.isConfigSupported({ codec: c, sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 })).supported; } catch (e) { o[c] = 'err ' + e.message; } } return o; });

for (const fmt of exps) {
  await page.evaluate((fmt) => {
    selectEffect('grid-zoom-strip'); wmOpenExport(); wmExportState.fmt = fmt;
    wmExportState.res = 720; wmExportState.fps = 24;
    WMV.intro.mode = 'stagger'; WMV.intro.dur = 1.5; WMV.intro.hold = 0.2; WMV.loops = 1;
    wmExportUpdateInfo();
  }, fmt);
  const dl = page.waitForEvent('download', { timeout: 900000 });
  await page.evaluate(() => wmStartExport());
  const d = await dl; const p = path.join(outDir, d.suggestedFilename()); await d.saveAs(p);
  const st = await page.evaluate(() => document.getElementById('wmExStatus').textContent);
  const durE = await page.evaluate(() => wmExportDuration());
  const info = { file: path.basename(p), mb: +(fs.statSync(p).size / 1048576).toFixed(2), status: st, expected: +durE.toFixed(3) };
  if (fmt === 'mp4') {
    const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'json', p], { encoding: 'utf8' });
    info.streams = JSON.parse(r.stdout).streams;
    const a = info.streams.find((s) => s.codec_type === 'audio'), v = info.streams.find((s) => s.codec_type === 'video');
    ok('mp4 has an audio track', !!a, info);
    ok('audio length = video length', a && Math.abs(+a.duration - +v.duration) < 0.12, [a && a.duration, v && v.duration]);
  } else if (fmt === 'html') {
    const h = fs.readFileSync(p, 'utf8'); const m = h.match(/<script type="application\/json" id="wm-data">([\s\S]*?)<\/script>/);
    const D = JSON.parse(m[1]); info.audio = D.audio && { src: D.audio.src.slice(0, 30), volume: D.audio.volume, offset: D.audio.offset };
    ok('html embeds music', D.audio && D.audio.src.startsWith('data:audio'), info);
    res.htmlFile = p;
  } else if (fmt === 'zip') {
    const r = spawnSync('unzip', ['-l', p], { encoding: 'utf8' }); info.list = r.stdout.split('\n').filter((l) => /audio\/|spec\.json|\.mp4/.test(l)).map((l) => l.trim().split(/\s+/).pop());
    const sp = JSON.parse(spawnSync('unzip', ['-p', p, 'spec.json'], { encoding: 'utf8' }).stdout); info.specAudio = sp.audio;
    ok('zip has music file + spec.audio', info.list.some((x) => x.startsWith('audio/')) && sp.audio && sp.audio.src.startsWith('audio/'), info);
  }
  res.checks.push(['export ' + fmt, true, info]);
  await page.evaluate(() => wmCloseExport());
}
await page.close();

// interactive player
if (res.htmlFile) {
  const pp = await ctx.newPage(); pp.on('pageerror', (e) => errs.push('player: ' + e.message));
  await pp.goto(pathToFileURL(res.htmlFile).href);
  await pp.waitForFunction(() => window.WMP && window.WMP.ready, null, { timeout: 60000 });
  await pp.waitForTimeout(1500);
  let a = await pp.evaluate(() => window.WMP.audio);
  if (block) {
    ok('player: autoplay with sound blocked -> waits for a gesture', a.blocked && a.paused, a);
    await pp.mouse.click(300, 200); await pp.waitForTimeout(800); a = await pp.evaluate(() => window.WMP.audio);
    ok('player: first click turns sound on', !a.paused && !a.blocked, a);
  } else ok('player: sound on by default', !a.paused && !a.muted, a);
  // drift between the music and its clock
  a = await pp.evaluate(() => window.WMP.audio);
  const want = (x) => (x.aT + 1) % x.duration; // offset 1 s set above
  ok('player: music follows its clock', Math.abs(a.currentTime - want(a)) < 0.35, [a.currentTime, want(a)]);
  // seek to the middle of the bar
  await pp.mouse.move(400, 300); await pp.waitForTimeout(300);
  const bb = await pp.locator('#wmSeek').boundingBox(); await pp.mouse.click(bb.x + bb.width * 0.6, bb.y + bb.height / 2); await pp.waitForTimeout(500);
  a = await pp.evaluate(() => ({ ...window.WMP.audio, T: window.WMP.T }));
  ok('player: seek moves the music', Math.abs(a.aT - a.T) < 0.6 && Math.abs(a.currentTime - want(a)) < 0.35, a);
  // speed does not change the music
  const before = await pp.evaluate(() => window.WMP.audio.currentTime);
  const w0 = Date.now(); await pp.evaluate(() => window.WMP.setSpeed(4)); await pp.waitForTimeout(1000);
  const after = await pp.evaluate(() => ({ ...window.WMP.audio, rate: 1 }));
  const wall = (Date.now() - w0) / 1000;
  ok('player: 4x speed keeps music at 1x', Math.abs((after.currentTime - before) - wall) < 0.4, [before, after.currentTime, wall]);
  await pp.keyboard.press('m'); await pp.waitForTimeout(200);
  ok('player: M mutes', await pp.evaluate(() => window.WMP.audio.muted && window.WMP.audio.paused));
  await pp.screenshot({ path: path.join(outDir, 'player-audio.png') });
  await pp.close();
}
await br.close();
res.errors = errs; res.pass = errs.length === 0 && res.checks.every((c) => c[1]);
console.log(JSON.stringify(res, null, 1));
process.exit(res.pass ? 0 : 1);
