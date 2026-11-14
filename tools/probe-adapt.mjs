// v10.2 探针：不开浏览器，直接跑 100 个模板的排版函数 + engine/adapt.js，统计「图片可见比例 / 重叠 / 出画」
// usage: node tools/probe-adapt.mjs [--mode area|fit|map] [--canvas 16:9] [--json out.json]
import { M, E, normParams, deviceInfo } from '../engine/lib.js';
import { adaptCards, ADAPT_MODES } from '../engine/adapt.js';
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : a), []));
const modeArg = args.mode || 'map';
const [cw, ch] = String(args.canvas || '16:9').split(':').map(Number); const aspect = cw / ch;
const src = fs.readFileSync(path.join(ROOT, 'engine/wm_entry.js'), 'utf8');
const paths = [...src.matchAll(/import t\d+ from '(\.\/templates\/[^']+)'/g)].map((m) => m[1]);
let MAP = {};
if (modeArg === 'map') { const core = fs.readFileSync(path.join(ROOT, 'engine/core.js'), 'utf8'); const m = core.match(/export const ADAPT_MAP = (\{[^;]*\});/); MAP = m ? Function('return ' + m[1])() : {}; }
const RATIOS = [['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1], ['9:16', 9 / 16]];
function glyphs(str) { const s = String(str || ''); return { w: s.length * 0.6, h: 1, glyphs: [], items: [], words: [] }; }
function stats(cards, mA, ctx) {
  let kept = 0, area = 0, out = 0; const R = [];
  for (const c of cards) {
    if (!c || c.hidden || c.light || c.device || (c.text != null && c.text !== '') || (c.color && !c.useMedia) || c._adaptBg) continue;
    const s = c.s ?? 1; const w = (c.w ?? 0.3) * s, h = (c.h ?? (c.w ?? 0.3) / mA) * s; const uv = c.uv || [0, 0, 1, 1];
    const fA = Math.abs(c.fullAspect ?? (w / h) / ((uv[2] - uv[0]) / (uv[3] - uv[1])));
    const a = Math.abs(w * h) * (c.opacity ?? 1); if (!(a > 0)) continue;
    kept += a * Math.min(fA / mA, mA / fA); area += a;
    const flat = Math.abs(c.rx || 0) < 0.05 && Math.abs(c.ry || 0) < 0.05 && Math.abs(c.z || 0) < 0.05;
    if (flat) { const x0 = (c.x || 0) - w / 2, x1 = (c.x || 0) + w / 2, y0 = (c.y || 0) - h / 2, y1 = (c.y || 0) + h / 2;
      const ix = Math.max(0, Math.min(x1, ctx.view.w / 2) - Math.max(x0, -ctx.view.w / 2)), iy = Math.max(0, Math.min(y1, 0.5) - Math.max(y0, -0.5));
      out += Math.abs(w * h) - ix * iy; R.push([x0, x1, y0, y1, c.layer ?? 0]); }
  }
  let ov = 0; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const A = R[i], B = R[j]; if (Math.abs(A[4] - B[4]) > 1e-6) continue;
    ov += Math.max(0, Math.min(A[1], B[1]) - Math.max(A[0], B[0])) * Math.max(0, Math.min(A[3], B[3]) - Math.max(A[2], B[2])); }
  return { kept, area, ov, out };
}
const res = [];
for (const pth of paths) {
  const tpl = (await import(pathToFileURL(path.join(ROOT, 'engine', pth)).href)).default;
  const defs = tpl.params || {}; const bp = {}; for (const [k, d] of Object.entries(defs)) bp[k] = d?.default;
  const mode = modeArg === 'map' ? (tpl.adapt || MAP[tpl.id] || 'area') : modeArg;
  const row = { id: tpl.id, mode };
  for (const [nm, mA] of RATIOS) {
    const media = Array.from({ length: 12 }, () => ({ w: mA * 900, h: 900 }));
    const acc = { n: { kept: 0, area: 0, ov: 0, out: 0 }, a: { kept: 0, area: 0, ov: 0, out: 0 } }; let err = null;
    for (let s = 0; s < 8; s++) {
      for (const which of ['n', 'a']) {
        try {
          const dur = tpl.duration || 16, t = (dur * s) / 8, u = s / 8, pad = (bp.padding ?? 6) / 100; const p = normParams({ ...bp }, defs);
          const spec = which === 'a' ? { cardRatio: 'media' } : {}; const adaptMode = which === 'a' ? mode : null;
          const ctx = { t, u, dur, p, n: 12, view: { w: aspect, h: 1 }, inner: { w: aspect * (1 - 2 * pad), h: 1 - 2 * pad }, aspect, ratioOf: () => mA, adaptMode, media, M, E, spec, pad, isPortrait: aspect < 1,
            title: String(p.text ?? ''), words: String(p.text ?? '').split(/\s+/).filter(Boolean), titleSpec: null, glyphs, device: (ty, o) => deviceInfo(ty, o),
            camDist: 2, fullFrame: (z = 0, mg = 1.04) => ({ x: 0, y: 0, z, w: aspect * mg * (1 + (-z) / 2), h: mg * (1 + (-z) / 2) }) };
          if (which === 'n') ctx.ratioOf = () => mA; // native = v9 auto 下的形状（cardAR 返回模板默认）
          let lo = tpl.layout(ctx) || []; let cards = Array.isArray(lo) ? lo : lo.cards || [];
          if (which === 'a') cards = adaptCards(cards, ctx, { R: mA, mode, fit: 'blur', ratioOfMedia: () => mA });
          const st = stats(cards, mA, ctx); for (const k in st) acc[which][k] += st[k];
        } catch (e) { err = String(e.message).slice(0, 50); }
      }
    }
    const f = (o) => (o.area ? o.kept / o.area : null);
    row[nm] = err && !acc.a.area ? { err } : { keepN: +(f(acc.n) ?? 0).toFixed(3), keep: +(f(acc.a) ?? 0).toFixed(3), ovN: +(acc.n.area ? acc.n.ov / acc.n.area : 0).toFixed(3), ov: +(acc.a.area ? acc.a.ov / acc.a.area : 0).toFixed(3), outN: +(acc.n.area ? acc.n.out / acc.n.area : 0).toFixed(3), out: +(acc.a.area ? acc.a.out / acc.a.area : 0).toFixed(3) };
  }
  res.push(row);
}
if (args.json) fs.writeFileSync(args.json, JSON.stringify(res, null, 1));
for (const r of res) console.log(r.id.padEnd(24), r.mode.padEnd(5), RATIOS.map(([k]) => (r[k].err ? 'ERR' : `${r[k].keep.toFixed(2)}/${(r[k].ov - r[k].ovN).toFixed(2)}/${(r[k].out - r[k].outN).toFixed(2)}`)).join('  '));
