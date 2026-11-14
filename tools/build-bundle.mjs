#!/usr/bin/env node
// Build the browser bundle of the engine (engine + 100 templates + three.js) used by the HTML player and the web app.
// Output: engine/player/wm-engine.min.js (IIFE, sets window.WMX). Needs esbuild (npx esbuild, or WM_ESBUILD=/path/to/esbuild).
import { spawnSync } from 'child_process';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'engine/player/wm-engine.min.js');
const cands = [process.env.WM_ESBUILD, path.join(ROOT, 'node_modules/.bin/esbuild'), '/opt/panel-apps/node_modules/esbuild/bin/esbuild'].filter(Boolean);
const exe = cands.find((c) => fs.existsSync(c));
const args = [path.join(ROOT, 'engine/wm_entry.js'), '--bundle', '--minify', '--format=iife', '--target=es2020', '--legal-comments=eof', '--outfile=' + out];
const r = exe ? spawnSync(exe, args, { stdio: 'inherit' }) : spawnSync('npx', ['--yes', 'esbuild@0.24', ...args], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
console.log(out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
