#!/usr/bin/env node
// Smoke-test an exported interactive page as a local file (file://): no errors, every control works.
// usage: node tools/test-html.mjs page.html [--shots outdir]
import fs from 'fs'; import path from 'path'; import os from 'os'; import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.resolve(process.argv[2]); const si = process.argv.indexOf('--shots'); const shots = si > 0 ? process.argv[si + 1] : null;
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'node_modules/playwright-core/index.mjs')).href);
function findChrome() { for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache/ms-playwright'), '/workspace/tools/ms-playwright']) { if (!fs.existsSync(base)) continue; for (const d of fs.readdirSync(base)) if (d.startsWith('chromium_headless_shell')) { const p = path.join(base, d, 'chrome-linux/headless_shell'); if (fs.existsSync(p)) return p; } } }
const br = await chromium.launch({ executablePath: process.env.WM_CHROME || findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await br.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
const t0 = Date.now();
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => window.WMP && window.WMP.ready, null, { timeout: 60000 });
const res = { file: path.basename(file), loadMs: Date.now() - t0, checks: [] };
const ok = (name, v) => res.checks.push([name, !!v]);
const shot = async (n) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true });
  const d = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(document.getElementById('wmCv').toDataURL('image/jpeg', 0.9))))));
  fs.writeFileSync(path.join(shots, `${path.basename(file, '.html')}-${n}.jpg`), Buffer.from(d.split(',')[1], 'base64')); };
const clk = async (sel) => { const b = await page.locator(sel).boundingBox(); await page.mouse.move(b.x + b.width / 2 - 3, b.y + b.height / 2); await page.waitForFunction(() => !document.getElementById('wmUi').classList.contains('idle'), null, { timeout: 10000 }); await page.waitForTimeout(400); await page.click(sel, { force: true }); };
const tl = await page.evaluate(() => window.WMP.tl());
ok('timeline has intro', tl.on && tl.preWall > 0);
const autoplay = await page.evaluate(() => !document.getElementById('wmBig').classList.contains('show'));
if (!autoplay) { await page.click('#wmBig'); }
await page.waitForTimeout(400); ok('playing advances T', await page.evaluate(() => window.WMP.T > 0.05));
// pause / play (button + space)
await page.mouse.move(500, 300); await clk('#wmPlay'); const Ta = await page.evaluate(() => window.WMP.T); await page.waitForTimeout(300);
ok('pause stops time', Math.abs((await page.evaluate(() => window.WMP.T)) - Ta) < 1e-6);
await page.keyboard.press(' '); await page.waitForTimeout(250); ok('space resumes', (await page.evaluate(() => window.WMP.T)) > Ta);
// intro frames
for (const [k, T] of [['intro-a', tl.introWall * 0.35], ['intro-b', tl.introWall * 0.75], ['loop', tl.preWall + 1]]) { await page.evaluate((v) => { window.WMP.setPlay(false); window.WMP.T = v; }, T); await page.waitForTimeout(150); await shot(k); }
await page.evaluate(() => window.WMP.setPlay(true));
// intro mode toggle + replay
const m0 = await page.evaluate(() => window.WMP.mode); await clk('#wmIntro'); const m1 = await page.evaluate(() => window.WMP.mode);
ok('intro toggle', m0 !== m1); await page.waitForTimeout(200); await clk('#wmReplay'); ok('replay resets', (await page.evaluate(() => window.WMP.T)) < 0.5);
// speed keys / popover / presets
await page.keyboard.press('='); const s1 = await page.evaluate(() => window.WMP.speed); await page.keyboard.press('0'); const s2 = await page.evaluate(() => window.WMP.speed);
ok('speed = and 0', s1 > 1 && s2 === 1);
await page.keyboard.press('-'); ok('speed -', (await page.evaluate(() => window.WMP.speed)) < 1);
await clk('#wmSpd'); ok('speed popover', await page.evaluate(() => document.getElementById('wmSpdPop').classList.contains('open')));
await clk('#wmSpdChips .chip[data-s="8"]'); ok('preset 8x', (await page.evaluate(() => window.WMP.speed)) === 8);
await clk('#wmSpdChips .chip[data-s="0.1"]'); ok('preset 0.1x', (await page.evaluate(() => window.WMP.speed)) === 0.1);
await page.mouse.click(100, 100); await page.keyboard.press('0');
// seek
const bb = await page.locator('#wmSeek').boundingBox(); await page.mouse.move(bb.x + 5, bb.y + 5); await page.waitForTimeout(60); await page.mouse.click(bb.x + bb.width * 0.8, bb.y + bb.height / 2);
const Tl = await page.evaluate(() => window.WMP.tl()); ok('seek', Math.abs((await page.evaluate(() => window.WMP.T)) - 0.8 * (Tl.preWall + Tl.loopWall)) < 0.6);
// batches
const nb = await page.evaluate(() => JSON.parse(document.getElementById('wm-data').textContent).batches.length);
if (nb > 1) { await clk('#wmNext'); await page.waitForTimeout(500); ok('next batch', (await page.evaluate(() => document.getElementById('wmBatch').textContent)).startsWith('2/')); await clk('#wmPrev'); await page.waitForTimeout(400); }
// fullscreen (headless: request may be refused, but must not throw)
await page.keyboard.press('f'); await page.waitForTimeout(200); await page.keyboard.press('f');
// controls auto-hide
await page.waitForTimeout(2600); ok('controls auto-hide', await page.evaluate(() => document.getElementById('wmUi').classList.contains('idle') || document.body.classList.contains('wmp-noctl')));
await page.mouse.move(300, 200); await page.waitForTimeout(100); ok('controls wake', await page.evaluate(() => !document.getElementById('wmUi').classList.contains('idle') || document.body.classList.contains('wmp-noctl')));
// render-time quality (fluid mode exists and is >= 0.5)
res.quality = await page.evaluate(() => window.WMP.quality);
res.errors = errs; res.pass = errs.length === 0 && res.checks.every((c) => c[1]);
await br.close();
console.log(JSON.stringify(res, null, 1));
process.exit(res.pass ? 0 : 1);
