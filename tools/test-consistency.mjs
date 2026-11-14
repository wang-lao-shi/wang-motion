#!/usr/bin/env node
// Same spec -> CLI still (ES-module engine, wm still --at-time) vs browser bundle (wm html player, file://) at the same wall times.
// usage: node tools/test-consistency.mjs --ids card-globe,cover-flow --times 0.8,1.6,2.6,4 --out dir [--intro stagger]
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawnSync } from 'child_process'; import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2); const opt = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? A[i + 1] : d; };
const ids = opt('ids', 'card-globe').split(','); const times = opt('times', '0.8,1.6,2.6,4').split(',').map(Number);
const out = path.resolve(opt('out', '/tmp/wm-consistency')); fs.mkdirSync(out, { recursive: true });
const intro = opt('intro', 'stagger'); const W = 480, H = 270;
const wm = (args) => { const r = spawnSync('node', [path.join(ROOT, 'bin/wm.mjs'), ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'node_modules/playwright-core/index.mjs')).href);
function findChrome() { for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache/ms-playwright'), '/workspace/tools/ms-playwright']) { if (!fs.existsSync(base)) continue; for (const d of fs.readdirSync(base)) if (d.startsWith('chromium_headless_shell')) { const p = path.join(base, d, 'chrome-linux/headless_shell'); if (fs.existsSync(p)) return p; } } }
const br = await chromium.launch({ executablePath: process.env.WM_CHROME || findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const rows = [];
for (const id of ids) {
  const common = ['--intro', intro, '--width', String(W), '--height', String(H), '--bg', '#101418'];
  wm(['still', id, ...common, '--at-time', times.join(','), '--out', path.join(out, `${id}-cli.png`)]);
  const html = path.join(out, `${id}.html`); wm(['html', id, ...common, '--img-max', 'orig', '--out', html]);
  const page = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.WMP && window.WMP.ready, null, { timeout: 60000 });
  await page.evaluate(() => { window.WMP.setPlay(false); window.WMP.setQuality(1); });
  for (let k = 0; k < times.length; k++) {
    const d = await page.evaluate(async (T) => { window.WMP.T = T; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return document.getElementById('wmCv').toDataURL('image/png'); }, times[k]);
    const f = path.join(out, `${id}-web-${k}.png`); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
    const c = path.join(out, `${id}-cli-${k}.png`);
    const r = spawnSync('magick', ['compare', '-metric', 'PSNR', c, f, path.join(out, `${id}-diff-${k}.png`)], { encoding: 'utf8' });
    const psnr = parseFloat((r.stderr || '').split(' ')[0]); const ae = spawnSync('magick', ['compare', '-metric', 'AE', '-fuzz', '1%', c, f, 'null:'], { encoding: 'utf8' });
    rows.push({ id, T: times[k], psnr: isFinite(psnr) ? psnr : (r.stderr.trim() === 'inf' ? Infinity : r.stderr.trim()), pixelsOver1pct: parseFloat(ae.stderr) });
  }
  await page.close();
}
await br.close();
console.log(JSON.stringify(rows, null, 1));
