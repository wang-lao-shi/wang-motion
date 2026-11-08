# Authoring wang-motion templates

A template is ONE ES module in `engine/templates/<category>/<id>.js` exporting a plain object.
It is a **pure function of time**: `layout(ctx)` returns the state of every card for this frame.
The engine (Three.js) does rendering, cover-fit, rounded corners, shadows, back-faces, sorting,
background, text/logo overlays, keyframes, motion blur, grain, and export. Templates must NOT import three.js
(they are imported by Node for `wm list`). Import only `../_common.js` and `../../lib.js` (or a sibling template module in the same category to reuse its exported helper, e.g. `wall()` from sphere-wall.js).
_common.js also has: `P.cardRatio()`, `cardAR(ctx, defaultAspect)` (per-template shape for 'auto'), `EASINGS`/`easeOf(name)` (built-in easing menu), `latticeMedia()` (seamless media pattern for scrolling lattices), `curvePoint()` (flat lattice → concave/convex sphere or cylinder), and 3×3 rotation helpers `mRx/mRy/mRz/mMul/mApply/eulerYXZ`.

```js
import { base, P, rotX, rotY, rotZ, fit, sizeH, sizeW, backFade } from '../_common.js';
import { E, beats } from '../../lib.js';
export default {
  id: 'cover-flow', name: 'Cover Flow', category: 'carousel-flow',
  slots: 12,                    // suggested media count
  desc: 'one line: what it looks like',
  tags: ['carousel', 'apple', 'product'],
  ref: 'standard' | 'original',  // template category reference
  params: base({               // base() adds padding + cornerRadius
    cardSize: P.pct('Card size', 37, 5, 100),
    perspective: P.perspective(55),
    direction: P.choice('Direction', 'left', ['left', 'right']),
    ease: P.choice('Easing', 'inOutCubic', ['linear','inOutCubic','outBack','outExpo','inOutQuint','spring']),
  }),
  shadow: true,          // default drop shadow on/off
  shadowOpacity: 0.45,
  sheen: 0,              // glossy top-light 0..1
  rim: 0,                // white rim highlight on bottom edge 0..1
  depthWrite: false,     // true => z-buffer (use for dense 3D solids: spheres, tunnels); false => painter sort
  duration: 16,          // default loop seconds
  camera(ctx) { return { perspective: ctx.p.perspective }; },   // optional
  layout(ctx) { ... return cards; },
};
```

## ctx
- `t` seconds, `u` loop phase 0..1 (u=0 and u=1 must look identical → seamless loop), `dur`
- `p` params (defaults merged with user params and keyframes, evaluated at t)
- `n` number of media items (or spec.count). You may return MORE cards than n (media index wraps).
- `view` {w: aspect, h: 1}: the frame at z=0 spans x∈[-aspect/2, aspect/2], y∈[-0.5, 0.5]. y is UP.
- `inner` same minus padding; `aspect`; `isPortrait`; `pad`
- `ratioOf(i)` card aspect (w/h) for media i (honours Card ratio = auto/1:1/4:3...)
- `M` math (clamp, lerp, fract, mod, rad, smooth, rand(i,seed), win(u,a,b), wrap, grid(n,aspect), fib(k,n), TAU)
- `E` easings (linear, in/out/inOut Quad/Cubic/Quart/Quint/Expo/Sine, outBack, inOutBack, outElastic, outBounce, spring)
- `camDist` camera distance to z=0 plane (set after camera())

Camera: perspective camera looking at origin from +z; `perspective` % → fov = 6 + p*1.6 deg, distance chosen so z=0 plane exactly fills the frame height. `camera(ctx)` may return {perspective|fov, x, y, z, lookX, lookY, lookZ, roll}.

## Card state (all optional except w)
| key | meaning |
|---|---|
| media | media index (wraps) |
| x,y,z | position (world, frame height = 1) |
| rx,ry,rz, order | Euler rotation radians, order default 'YXZ' ('XYZ' = Rx·Ry·Rz) |
| w,h | size (h defaults to w/ratioOf(media)) ; s = uniform scale |
| opacity | 0..1 (≤0.001 hidden) |
| bright | colour multiplier (depth/back fade) ; sat = saturation |
| bend | curvature 1/R around local Y (card wraps a cylinder of radius R, edges bend away from camera) ; bendX around local X ; negative = concave |
| radius | corner radius as fraction of min side (default from Corner radius param) |
| uv | [u0,v0,u1,v1] sub-rect of the media (tiles, mosaics, slices) ; fullAspect = aspect of the whole virtual image when tiling |
| zoom, panX, panY | Ken-Burns inside the card |
| mask | {type:'line', angle(rad), p:0..1 progress, soft} / {type:'circle', cx, cy, r, soft} / {type:'rect', rect:[x0,y0,x1,y1], soft} (card uv space, line keeps the side with proj<p) |
| mirrorBack | true (default: back shows image mirrored) / false (dark back) / 'unmirror' |
| border, borderColor | inner border (fraction of min side) |
| sheen, rim, blur (mip bias 0..6), shadow (opacity override, 0 = none) |
| edgeX, edgeTop, edgeBottom, edgeW | thin white highlight lines on the left+right / top (slightly inset) / bottom edges, strength 0..1, width in world units (default 0.004); template-level defaults allowed (`edgeX: 0.8` on the template object) |
| shear | vertical shear of the card plane: local y += x·shear (parallelogram cards; helix ribbons) |
| layer | coarse z-layer for painter sort (higher draws later) |
| depthWrite/depthTest | per-card override |
| color + useMedia:false | flat colour card |

## Rules
1. Seamless loop: everything periodic in u. For step motions use `beats(u, n, move, ease)` from lib.js.
2. Deterministic: use `M.rand(i, seed)` never Math.random.
3. Fit the frame for every ratio (16:9, 1:1, 9:16): size from `ctx.inner`/`ctx.view`, not constants for one ratio.
4. Expose the reference's parameters with the same defaults (names camelCase). Add useful extras.
5. Keep cards ≤ ~300 per frame.

## Motion Tuning & Testing Workflow
- Reference frames: evaluate 8 phases at u = 0, .125, ... .875 (16s loop, 1:1 frame, default settings). Verify motion fluidity, layout geometry, depth hierarchy, and loop transition.
- Render check: `node bin/wm.mjs still <id> --ratio 9:16 --res 480 --at 0.4 --out /tmp/x.png` to verify multiple aspect ratios (16:9, 9:16, 1:1).

## Corner radius
Engine default: radius = min(card-relative `cornerRadius% × min(w,h) × 3.2`, frame-relative `cornerRadius% × 0.8 × frame short side`). Setting `c.radius` or `c.radiusMul` bypasses the cap (see reveal-wipe/_frame.js `frameRadiusMul`).
Templates whose cards zoom (camera dives, hero zooms) should set `radiusMode: 'card'` on the template object so the radius scales with the card (all multiscene templates do). Reference behaviour: static large cards ≈2.2–2.6% of frame; zoomed cards' corners grow with the zoom.

## X0 — colour / text / list params + title (2026-11-04, phase 4)
- `P.color(label, '#ffcc66')`, `P.text(label, 'WANG MOTION')`, `P.list(label, ['A','B'])` in `_common.js`.
- CLI: `--param tint=#ffcc66` (a bare `ffcc66` gets its `#`), `--param text=2026` (always kept as a string), `--param words="ONE|TWO|THREE"` (list splits on `|`). The same normalisation applies to `spec.params` in a JSON spec.
- `ctx.title`: content of the first `spec.text` (`--text "..."`), falling back to the template's `text` param, or `''`. `ctx.words` = title split on whitespace. `ctx.titleSpec` = that text entry (color/size/font) or null.
- Set `usesTitle: true` on the template to animate the title yourself; the engine then does NOT draw `spec.text[0]` as an overlay. Further text entries and the logo still draw as overlays.
```js
params: base({ tint: P.color('Tint', '#ffb070'), text: P.text('Text', 'WANG MOTION'), words: P.list('Words', ['FAST', 'BOLD']) }),
usesTitle: true,
layout(ctx) { const letters = [...ctx.title]; /* stagger per letter … */ }
```

## X7 — light cards + blend modes (2026-11-04, phase 4)
A card with `light` is a flat gradient card with no media: no shadow, radius 0, `depthWrite` false, and `blend: 'add'` by default. `h` defaults to `w`. Masks, `opacity`, `bright` (intensity, >1 is fine for additive) and `layer` still apply.
```js
{ light: { type: 'radial', stops: [[0, '#ffffff', 1], [0.35, '#ffb070', 0.8], [1, '#ff3080', 0]] },
  blend: 'add', x: 0.2, y: 0.1, z: 0.05, w: 0.6, opacity: 0.8, layer: 5 }
{ light: { type: 'beam', color: '#fff2c0', spread: 0.25, fade: 0.7 }, w: 0.3, h: 1.2, y: 0.2 }   // shorthand: color → [[0,c,1],[1,c,0]]
{ light: { type: 'linear', angle: Math.PI / 2, stops: [[0, '#ff3080', 0.3], [1, '#ff3080', 0]] }, ...ctx.fullFrame(-0.5) }  // full-frame leak
```
| light key | meaning |
|---|---|
| type | `radial` (0 at centre → 1 at card edge, elliptical on non-square cards) · `linear` (0→1 across the card along `angle`) · `beam` (cone from the `-angle` end, width `spread` at the source → 1 at the far end, alpha fades by `fade` along it; default angle −π/2 = shining down from the top) · `ring` (0 at radius `r` (default 0.7, in half-card units), 1 at ±`width` (default 0.3)) · `streak` (pointed lens along `angle`; use a thin card for anamorphic streaks) |
| stops | up to 4 `[pos 0..1, '#hex', alpha]`, sorted by pos; or `color` for a simple fall-off |
| angle | radians (card uv space); `falloff` = exponent applied to the gradient coordinate (default 1) |

`blend` works on ANY card (media cards too): `'normal'` (default) · `'add'` · `'screen'` · `'multiply'` (darkens what is behind it by the card colour × alpha).
`ctx.fullFrame(z = 0, margin = 1.04)` → `{x, y, z, w, h}` of a plane at depth z that covers the whole frame for the current camera (spread it into a card for leaks or flashes). It assumes the plane faces +z, and its size is padded for oblique cameras.
Not drawn by light cards: media, back-face dimming, border, sheen, rim, edges.

## Card effects (E2: X5 + X10, 2026-11-05)
Per-card shader effects. Each one is a shader `#define`, compiled only for cards that use it, so cards without effects render exactly as before. Units: "long side" = fraction of the card's longer side; uv = card uv 0..1 (y up); angles in radians. All may be animated per frame. Combine freely. Test grid: `wm still _fxtest --res 360 --at 0.25,0.6 [--param mode=more|shapes|sweep|mirror]` (hidden template `grid/_fxtest.js`).

| field | value / range | notes |
|---|---|---|
| media2, mix | media index ; 0..1 | blend to a second image. mix ≤0 = media, ≥1 = media2 (no cost). `zoom2/panX2/panY2` (default = zoom/panX/panY) |
| mixMode | `fade` · `dissolve` · `luma` · `displace` · `blocks` · `ripple` · `swirl` | transition style |
| mixOpts | {amt, edge\|freq, scale, seed, cx, cy, edgeColor, glow} | defaults per mode: amt displace .12 / blocks .08 / ripple .03 / swirl 2.5 rad; edge dissolve .08 / luma .15; freq ripple 4; scale (noise / blocks per long side) dissolve 5 / displace 3 / blocks 10; cx,cy = ripple/swirl centre (.5) ; edgeColor+glow = burning edge (dissolve) |
| dissolve | {p 0..1, scale 5, edge .08, seed, edgeColor, glow 1} | noise burn-away of the card itself (alpha); p=1 gone |
| displace | {type `wave`·`ripple`·`swirl`·`noise`·`heat`, amp, freq, phase, cx, cy} | amp in long side (~.02–.08), swirl amp in rad (~1–4); freq defaults 3/4/1.4/3/6; animate `phase` |
| pixelate | cells across the card width (e.g. 4..60) ; 0 = off | mosaic |
| rgbSplit | number or {amt, angle} ; amt ~.005–.05 long side | chromatic aberration |
| dirBlur | number or {amt, angle} ; amt ~.05–.3 long side | 8-tap motion blur along angle |
| radialBlur | number or {amt, cx, cy} ; amt 0..~.5 | zoom blur toward cx,cy |
| foil | 0..1 | holographic rainbow foil; shifts with card rotation (animate ry/rx) |
| smear | {amt 0..1 (share of blocks), seed, block .06, scale .15} | glitch slices; change `seed` every few frames (`Math.floor(u*24)`) |
| scan | number or {amt 0..1, lines 140, roll} | CRT scanlines; animate `roll` |
| barrel | -1..1 (~.2–.4) | CRT bulge; the outside of the bulged screen becomes transparent |
| duotone | [dark, light, amt] or {dark, light, amt} | luma → two-colour map |
| tint | '#hex' or [color, amt] or {color, amt} | multiply tint |
| shapeMask | {shape, p 0..1, rot, soft .004, outline 0, outlineColor '#fff', cx, cy, invert} | shapes: `circle` `diamond` `hexagon`(`hex`) `star` `heart` `plus`(`cross`) `square`(`rect`). p=1 always covers the whole card (any aspect), p=0 hides it; `invert` cuts a growing hole instead. Shape is fully inside the card up to about p≈.7 (circle/hex/diamond/square), .4 (heart), .3 (star/plus): star/heart/plus must grow larger to cover the corners, so reveal them over a short range of p. outline in the same units (≈.02–.05) |
| fade (X10) | {angle π/2, from 0, to 1} (or `mask: {type:'fade', …}`) | alpha gradient along angle in uv: opaque before `from`, transparent after `to` (default fades toward the card's top) |
| mirrorY (X10) | true | card drawn mirrored vertically (true reflection, also flips the image) |

Floor reflection helper in `_common.js`: `reflect(card, {floorY, gap .004, opacity .35, fade .6, from 0, bright .9, blur})` returns the mirrored copy (y mirrored across floorY = just under the card's bottom edge by default, rx/rz negated, `mirrorY`, fade away from the card, no shadow, layer −1). Pass `floorY` for tilted cards or a shared floor.
```js
{ media: 0, media2: 1, mix: E.inOutCubic(q), mixMode: 'dissolve', mixOpts: { edgeColor: '#ffb040' } }
{ media: 2, shapeMask: { shape: 'heart', p: q * 0.4, outline: 0.03, outlineColor: '#ff4080' } }
{ media: 3, smear: { amt: 0.4, seed: Math.floor(u * 24) }, rgbSplit: { amt: 0.02, angle: 0 }, scan: { amt: 0.6, lines: 80, roll: u * 4 }, barrel: 0.3 }
const c = { media: 4, x: 0, y: 0.12, w: 0.4, ry: 0.3 }; return [c, reflect(c, { opacity: 0.4, fade: 0.7 })];
```

## X1 — Glyph text (E3, 2026-11-05)
A card can be text instead of media: set `text`. The card is the glyph's padded box, masked by an SDF atlas (rasterised once per font+weight at 128 px cap height, 4× supersampled, crisp up to ~4× magnification), so every card feature still works per letter: x/y/z, rx/ry/rz, s, opacity, bright, sat, layer, bend, masks, X5 alpha FX (dissolve, shapeMask, fade). Test: `wm still _glyphtest --res 400 --at 0.3 [--ratio 9:16] [--param mode=big]` (hidden `kinetic-type/_glyphtest.js`).

| field | value | notes |
|---|---|---|
| text | 'W' or a whole word 'WANG' | one glyph or a word (word cards keep kerning but ignore `tracking`; ≤ ~18 Latin chars per card) |
| h | cap height, world units (default .1) | `w`/card size are computed by the engine; `s` scales on top |
| font, weight | 'Inter' (default), 100–900 (default 700) | 'Inter' = vendored variable Inter (`engine/vendor/fonts`). Any installed family by name. Fallback chain: WM Inter → WM Noto Sans SC (vendored variable, real CJK bold, see X8 "Bold CJK font") → system fonts |
| color | '#hex' (default '#fff') | flat fill |
| outline | stroke width as a fraction of cap height (0 = filled, ≤ .25) | stroke centred on the contour |
| mediaFill | media index | letters filled with media instead of `color` |
| fillUv | 'screen' (default) · 'card' | screen: media cover-fits a frame rect so all letters are windows onto ONE continuous image (zoom/panX/panY apply); card: each glyph box gets its own cover-fit |
| fillRect | [x0,y0,x1,y1] frame fractions, origin top-left (default [0,0,1,1]) | screen-fill window |
| uv | [u0,v0,u1,v1] sub-rect of the glyph box (y up) | e.g. `[0,0,1,.5]` = bottom half, placed where it sits inside the full glyph → split/slice/stretch effects |

Anchor: the card position is the glyph's **advance centre, cap middle**, and rotations pivot there.

`ctx.glyphs(str, { font, weight, h, tracking 0 (× h), align 'center'|'left'|'right', maxW (world, word-wrap), lineH 1.6 (× h) })` → `{ glyphs:[{ch, x, y, w, i, line, word, col}], words:[{text, x, y, w, i, line}], width, height, lines }`: pure metrics (synchronous canvas measureText in the page, cached), block centred on (0,0), x/y = the anchor of each glyph/word, w = advance. Spaces get no glyph entry. Pass the same font/weight/h to the cards.
```js
const L = ctx.glyphs('WANG MOTION', { h: 0.08, weight: 800, tracking: 0.05 });
return L.glyphs.map((g) => { const e = E.outCubic(M.clamp(u * 3 - g.i * 0.05, 0, 1));
  return { text: g.ch, weight: 800, h: 0.08, x: g.x, y: g.y - (1 - e) * 0.06, opacity: e }; });
{ text: 'IMAGE', weight: 900, h: 0.2, mediaFill: 0, fillUv: 'screen', zoom: 1.1 }   // word card as an image window
{ text: 'R', h: 0.3, outline: 0.04, color: '#ffcc66' }
```
Limitations: no drop shadow, border, edge lines or rim on glyph cards (forced off; shadow quad would be a box); X5 *media* effects (rgbSplit, displace, pixelate…) on a `fillUv:'screen'` glyph are skipped (alpha FX still apply); CJK now uses the vendored variable Noto Sans SC (real weights) for GB2312 chars. X9 thickness (later) will use the glyph's bounding box for side walls.

## X8 — Camera path & fog (E3, 2026-11-05)
Helpers in `engine/lib.js` (`import { spline, splineTangent, lookAlong } from '../../lib.js'`):
```js
spline(points, t, { closed: true, tension: 0.5 })      // -> [x,y,z]; points = [[x,y,z]...] or [{x,y,z}...]
splineTangent(points, t, { closed, tension, raw })     // -> unit [dx,dy,dz] (raw: d/dt, un-normalised)
lookAlong(points, t, ahead = 0.02, { bank: 0, maxRoll: 0.6, closed, tension, up: [0,1,0] })
  // -> { x, y, z, lookX, lookY, lookZ, roll, rollAxis: 'view' }  — return it (plus fov/fog) from camera()
```
- Catmull-Rom (cardinal): tangent = `tension * (p[i+1] - p[i-1])`; 0.5 = classic, 0 = straight segments. `t` 0..1 spans the whole path.
- `closed: true` (default) wraps t mod 1, so t=0 and t=1 give the same position, look target and roll → pass `ctx.u` for a seamless loop (checked: still at u=0 vs u=0.99999 RMSE 0.0026). Open paths clamp t, and `ahead` stops at the end.
- `ahead` = look-at distance as a path fraction; larger = the camera aims further into turns.
- `bank`: roll = atan(bank · lateral curvature) (curvature in 1/world units, averaged over ±ahead so it eases in/out), capped at `maxRoll` rad; positive roll leans into the turn. 0 = level camera.
- `rollAxis: 'view'` (set by lookAlong) makes the engine roll about the view axis (lookAt with world up, then rotate). Without it the classic `roll` (up = (sin r, cos r, 0)) is kept, so old templates are unchanged. Avoid paths that look straight up/down (world-up lookAt degenerates).
- Fog: `camera()` may return `fog: { color, near, far }` (view depth, world units; linear ramp). `color` defaults to the background colour (`background.color` / first gradient colour / template `background`). Cards mix toward the fog colour; light cards (X7) fade their alpha instead; card shadows fade with depth. No `fog` (or far ≤ near) = off, and cards compile the exact classic shader (FOG is a define, like the X5 FX).
- Fog matches flat backgrounds; with gradients/images pick a `color` close to the background behind the far cards.
- Tip: flythroughs through many overlapping cards look right with `depthWrite: true` on the template (painter sort uses card centres).
- Test template: `engine/templates/flythrough/_pathtest.js` (hidden): `wm still _pathtest --at 0.2,0.6 --res 400`; `--param bank=0 fog=false`.

### Bold CJK font (E3)
- `engine/vendor/fonts/NotoSansSC-GB2312-VF.ttf`: variable Noto Sans SC (wght 100–900), subset to ASCII + all GB2312 hanzi/punctuation (7542 chars, 4.1 MB; OFL, `OFL-NotoSansSC.txt`). Registered by `loadFonts()` as `WM Noto Sans SC`.
- Glyph cards: font stack = requested family → `WM Inter` → `WM Noto Sans SC` → system fallbacks. So `font: 'Inter'` + Chinese text gets real weight 300…900 hanzi (Latin/digits still Inter, metrics unchanged). `font: 'Noto Sans SC'` (or `'Noto Sans CJK SC'`) uses the vendored face for everything.
- Characters outside GB2312 (rare/traditional hanzi) fall back to system fonts (no real bold). Canvas title overlays (`spec.text`) do not use the vendored CJK face (unchanged).

## Particles helpers (X3a)
Pure, deterministic, loop-periodic helpers in `engine/lib.js` (named exports, `import { drift, emit, hash } from '../../lib.js'`):
- `hash(k, seed=0)` → [0,1) integer hash per particle index/seed (stable across runs).
- `drift(k, u, {speed=1, seed=0, dims=3})` → `{x,y,z}` in [0,1): `x = fract(u*speed + h0)` travels, `y = h1`, `z = h2` are fixed per particle (dims<3 zeroes the rest). `speed` is rounded to an integer so `u=0` and `u=1` match — map x onto the travel axis, y/z onto the cross axes.
- `emit(u, k, {rate=16, life=0.5, seed=0})` → `{age, birth}`: `rate` slots born evenly per loop (slot = k mod rate, jittered birth), each alive for `life` of the loop; `age` is 0..1 within life or `-1` when dead (skip/hide it). Wraps across the seam, so `emit(0,k)` equals `emit(1,k)`. Concurrent alive ≈ rate × life.

## Particles (X3b)
`layout(ctx)` may return `{ cards, particles }` instead of an array (a plain array is still accepted = cards only).
```js
import { drift } from '../../lib.js';
particles: [{ count: 1200, seed: 1, shape: 'dot' /*'dot'|'bokeh'|'spark'*/, blend: 'add' /*'add'|'normal'*/, depthTest: true, order: undefined,
  fn: (k, rnd, ctx) => { const d = drift(k, ctx.u, { speed: 1, seed: 1 });
    return { x: (d.y - .5) * 4, y: (d.x - .5) * 2.6, z: (d.z - .5) * 3, size: 0.01 + rnd(1) * 0.01, opacity: 0.6, color: '#cfe0ff', angle: 0 }; } }]
```
- One `THREE.Points` per group (ShaderMaterial, buffers reused across frames, reallocated only when a group's count grows). Total across groups is capped at **6000**; later groups are truncated first.
- `fn(k, rnd, ctx)` runs per particle per frame. `rnd(j = 0)` = `hash(k*16 + j, seed)`: deterministic per-particle random in [0,1) (use different `j` for independent values). Return `null`/`opacity <= 0` to hide a particle. Defaults: size 0.01, opacity 1, color `group.color ?? '#ffffff'`.
- `size` = world-unit diameter, perspective-attenuated (`px = size · H/2 · P[1][1] / viewZ`), so near particles get big (DOF-like bokeh). Below ~1.5 px points are drawn at 1.5 px with alpha scaled down (no flicker).
- `color`: hex/CSS string or `[r,g,b]` sRGB 0..1. `angle` (rad) rotates the spark star.
- Shapes (procedural in the fragment shader): `dot` soft disc; `bokeh` disc with brighter rim + soft edge; `spark` 4-point star with a hot core.
- `blend: 'add'` (default, AdditiveBlending) or `'normal'`. `depthWrite` is always false; `depthTest` default true.
- Draw order: groups render after all cards (`renderOrder = 1e6 + groupIndex`); pass `order` (a renderOrder number, e.g. `-1` = before cards) to change it. Cards only occlude particles when they write depth (`depthWrite: true` on the template/card); in painter mode particles sit on top.
- Loops: drive positions with `drift()` / `emit()` and any time terms with integer cycles of `ctx.u` (checked: `_particletest` still at u=0 vs 0.9999 RMSE 0.0049 = same as u=0 vs 0.0001, i.e. one step of motion).
- Test template: `engine/templates/flythrough/_particletest.js` (hidden): `wm still _particletest --at 0.3 --res 320`.

## Particles (X3c): instanced shapes, sampleMedia, fog
- More shapes: `shape: 'quad' | 'streak' | 'petal'`. Each group is drawn as one instanced unit plane (InstancedBufferGeometry + ShaderMaterial; buffers reused, grown on demand; counts toward the same 6000 cap). Every instance faces the camera (billboard) and is rotated in the screen plane by `angle` (rad, 0 = +x/right, CCW).
  - `quad`: soft-edged square (confetti, pixels). `size` = side length.
  - `streak`: soft capsule along `angle`, `size` = thickness, length = `size · len` (`len` ≥ 1, default 1). The head (bright end) is at the `+angle` end, the tail fades out, so point `angle` along the direction of travel.
  - `petal`: soft teardrop along `angle` (round end at `-angle`, point at `+angle`) with slight centre shading. `size` = length.
  - `spin` (rad, quad/petal): tumble around the long axis: width × |cos(spin)| (min 12%) and slightly darker when edge-on, so `spin: u·TAU·n` makes petals/confetti flip. Ignored by streaks and Points shapes.
  - Same sizing rules as Points (world units, perspective-scaled, never thinner than 1.5 px with alpha fade below that). `depthWrite` false, `depthTest` default true, both blends.
- `sampleMedia: idx` (any shape): `fn` may return `uvX, uvY` in 0..1 of that media item (raw image uv, no cover-fit; `uvY = 0` is the BOTTOM of the image, like card uv). Colour = `color` (default white) × the media texel, sampled in the vertex shader from a mip level matched to the group's density (`log2(maxSide/sqrt(count)) - 1`), so a grid of dots reads as the image. Missing uv = 0.5,0.5. Videos sample level 0 (live frame).
- Fog: when `camera()` returns `fog`, all particle groups get it too: `blend: 'add'` groups fade out with view depth (alpha × (1 − f)); `'normal'` groups mix toward the fog colour (like cards).
- Groups without sampleMedia and without fog compile the exact X3b shaders (regression stills unchanged).
- Test template: `engine/templates/flythrough/_particletest2.js` (hidden): `wm still _particletest2 --at 0.3 --res 320` (image-coloured 64×40 dot grid from media 0, streaks, petals with fog, confetti quads); `--param fog=false`. Seam: u=0 vs 0.9999 RMSE 0.0042 ≈ one frame step (0.0036).

## Post-FX (X4a)
A template can add a full-screen post pass per frame: return `{ cards, particles?, post }` from `layout()` (or define `post(ctx)` on the template; the layout key wins). With no `post`, or with every effect at 0, the pass is skipped entirely and output is pixel-identical to before (checked: 6 regression stills + `_particletest2` RMSE 0; motion blur + vignette path RMSE 0 vs pre-X4).
```js
post: {
  chroma: 0.02,                                        // radial chromatic aberration (number or {amount}); ~.005–.04
  glitch: { amount, block: 0.04, rgb: 0.6, seed },     // band + block displacement, RGB split, scanline jitter, rare inverted blocks
  scan:   { amount, lines: 140, roll },                // CRT scanlines (number = amount); animate roll with integer cycles of u
  flash:  { amount, color: '#fff' },                   // additive flash (number = white)
  tint:   { color, amount } | '#hex' | ['#hex', amt],  // multiply tint
  grade:  { sat: 1, contrast: 1, bright: 1 },          // colour grade in display space
}
```
- Order in the shader: glitch/chroma displacement → grade → tint → scanlines → flash. Runs after the scene (and after motion-blur accumulation, so glitches stay crisp; with motion blur the middle sub-frame's `post` is used), before the global `fx` grain/vignette/aberration (chained through an extra half-float RT only when both are on).
- Determinism: the pass uses no time/random input of its own; everything comes from the values you return. Drive `seed` from the beat index (e.g. `Math.floor(u*K)*7 + Math.floor(q*12)` for a few re-rolls inside a burst), never from `t`, and periodic terms from integer cycles of `u`. Checked on `_posttest`: still at u=0 ≡ u=1 (RMSE 0); continuous effects u=0 vs 0.99999 ≈ one step of motion; a glitch burst at the loop point looks like every other beat cut.
- Test template: `engine/templates/grid/_posttest.js` (hidden): `wm still _posttest --res 320 --at 0.3 --param fx=glitch` (fx: none|chroma|glitch|scan|flash|tint|grade|all; `amount` %).

## Post-FX (X4b): bloom, leak, barrel, tracking, noise
Same `post` object, five more keys (all off / pixel-identical when absent or 0: X4a `_posttest` stills for every fx at u=0 and 0.3, 6 regression stills and `_particletest2` RMSE 0 vs pre-X4b):
```js
post: {
  bloom:    { amount: 1, threshold: 0.7, radius: 0.02 },   // glow of pixels brighter than threshold (linear, max channel); radius = blur sigma as frac of frame height
  leak:     [{ amount, color: '#ff8a3c', x, y, r: 0.6 }    // additive soft radial light leak; x,y in frame uv (0..1, y = 0 BOTTOM), r = radius in frame heights
           | { amount, color, pos, angle, r }],            //   or pos 0..1 along a line through the centre at `angle` (rad, 0 = left→right; pos 0/1 ≈ off-frame)
                                                           //   one object or an array (max 4); `a` = alias of amount
  barrel:   0.3,                                           // CRT bulge (number or {amount}); corners pushed out by amount/2, black outside + soft edge falloff
  tracking: { amount: 1, pos: 0.5, h: 0.08, seed },         // VHS band at pos (frame y, 0 = bottom; alias `y`), h = band half-size; x offset + streak noise + wash; seed default floor(pos·997)
  noise:    { amount: 0.1, seed },                         // TV static (per output pixel), mix toward noise by amount; re-roll by changing seed
}
```
- Shader order: barrel warp → tracking offset → glitch/chroma displacement → sample (+ bloom glow at the displaced uv) → grade → tint → leaks → tracking streaks → noise → scanlines → flash → barrel edge mask. Scanlines, leaks and noise use the barrel-warped screen uv, so they curve with the CRT.
- Bloom: lazily allocates two half-res half-float RTs + 2 materials on first use (bright pass with 2×2 downsample, separable 9-tap gaussian H+V; large radii split into 2–3 iterations). Source = scene (after motion-blur accumulation). Never touched when unused.
- Determinism: no time/random input; noise/tracking hash only (pixel, seed). Drive `seed` from frame/beat index of u (e.g. `Math.floor(u*fps*duration)` for per-frame static, beat index for tracking), positions from `fract(u·k)`. Checked u=0 ≡ u=1 (RMSE 0) and re-render RMSE 0 for each effect; chained with `--motionblur 6 --vignette 0.5` OK; 9:16 barrel OK.
- Test: `wm still _posttest --res 320 --at 0.3 --param fx=bloom|leak|barrel|tracking|noise|vhs` (`vhs` = barrel + tracking + scan + chroma + light noise). `fx=all` is unchanged (X4a mix).
- Not done: per-block colour channel swap option for `glitch` (add if a template needs it).
- Next: build `glitch-cut-slideshow` / `light-leak-cuts` against X4a+X4b.

## X2 — Device frames (E5, 2026-11-05)
A card with `device` is expanded by the engine into ordinary cards: body slab (X9 walls + back), screen, island/notch/camera, glass gloss, and per type a crown + straps (watch), traffic lights + address pill (browser), power LED (crt), keyboard deck (laptop). All parts share the body's painter-sort key (they never interleave with other cards) and are hidden when their face points away from the camera. Templates without `device` cards are untouched (pixel-identical). Test: `wm still _devicetest --res 400 --at 0.3 [--param mode=all|phone|laptop|back|single] [--param type=crt --param ry=0.6] [--param dw=true]` (hidden `device-mockup/_devicetest.js`).
```js
const I = ctx.device('phone');                 // geometry, all in units of the outer body width (W = 1)
const h = 0.7, w = h * I.aspect;               // size bodies by height
{ device: 'phone', w, x, y, z, rx, ry, rz, media: 3, zoom: 1.05, deviceColor: '#e8e3d8' }          // screen shows media (cover-fit to the screen rect)
{ device: 'phone', w, screenCards: [ { media: k, y: q }, { media: k + 1, y: q - 1 } ] }             // push transition, clipped to the rounded screen
{ device: 'laptop', w: 0.9, rx: 0.35, hinge: 1.88, media: 2 }                                       // deck horizontal in the device frame
{ device: 'browser', chrome: 'light', w: 1.1, screenColor: '#f4f4f6', screenCards: feed }
const c = { device: 'tablet', w, y: 0.1, ry: 0.3, media: 1 }; return [reflect(c, { opacity: 0.3 }), c];   // reflect() knows device heights
```
| field | meaning |
|---|---|
| device | `'phone'` · `'tablet'` · `'laptop'` · `'watch'` · `'browser'` · `'crt'` |
| w (or h) | outer body width (laptop: lid width); `h` = body height alternative; `s` scales |
| x,y,z, rx,ry,rz, order | body centre + rotation (laptop: centre of the lid+deck bounding box, deck horizontal at rx=0) |
| orient | `'portrait'` (default phone/tablet/watch) / `'landscape'` (default crt/browser); swaps bezels, island moves to the left short side |
| deviceColor | body/back/deck colour (defaults: phone/watch `#1d1d20`, tablet `#2b2b2f`, laptop `#c8cacf`, crt `#d8d0bd`, browser `#2a2b2f`) |
| frameColor | side band (default deviceColor mixed 22% toward metal grey; crt/laptop = deviceColor) · `bezelColor` front glass (default near-black; crt = darker body; browser = chrome) |
| thickness | body depth in world units (default from the table: phone 8.5% of W, tablet 4.5%, watch 30%, crt 35%, laptop lid 1.2%, browser 0 = flat) |
| island | false hides the phone island / laptop notch · `led: false` hides the CRT LED · `strap: false \| '#hex'` watch straps |
| gloss, glossAngle | glass reflection band (additive, clipped to the glass; default .1, laptop .07, crt .12 on the screen, browser 0); it sweeps with ry/rx |
| hinge | laptop lid angle to the deck in rad (default 1.88 ≈ 108°) |
| chrome | browser `'dark'` (default) / `'light'` |
| screenBright, screenFx | screen brightness multiplier ; extra card fields for the screen only (e.g. `{ barrel: 0, scan: 0 }` turns off the crt defaults) |
| (everything else) | passed to the screen card: `media`, `zoom`, `panX/panY`, `mask`, `media2/mix/mixMode`, X5 FX, `blur`, `sat`, `border`… (crt screens default to `barrel: .1, scan: {amt: .3, lines: 110}`) |
| screenCards | array of cards laid out INSIDE the screen instead of the single screen card: `x, y` in screen fractions (−.5….5, y up), `w, h` fractions of the screen width / height (default `w: 1, h: 1` = full screen; `h` omitted with `w` set → from the media ratio), plus any card field (media, zoom, pan, radius, color, `text` with `h` = cap height as a fraction of the screen height, FX). Each is clipped to the rounded screen rect, so push/scroll/feed motion leaves the screen cleanly. A `screenColor` (default `#000`) base fills the screen behind them. No rotations inside the screen. |
| opacity, bright, layer, depthWrite, depthTest, shadow, mirrorY, fade | apply to the whole device (shadow only on the body / laptop deck) |

`ctx.device(type, {orient, hinge})` (= `deviceInfo` in lib.js, Node-safe) → `{ aspect (w/h; laptop: lid), w: 1, h, radius, depth, screen: {x0,y0,x1,y1} (fractions of the body, origin top-left), scr: {cx, cy, w, h, r} (screen rect, W units, y up from the body centre), screenAspect, island?, cam?, strap?/crown? (watch), bar (browser) }`; laptop adds `lid {cx,cy,cz,lean}`, `deck {w,d,t,cy,cz}`, `bbox {w,h,d}` (use `bbox.h × w` for its on-screen height).

Engine pieces added for X2 (usable on any card, mostly internal): `radiusW` (absolute corner radius, world units, bypasses the radius formulas); `_clip: [cx, cy, halfW, halfH, r]` (rounded-rect clip in card-local world units, `CLIP` define); `_deco: 'keys'` (procedural laptop keyboard/trackpad, `DECO` define); `_grp`/`_sub` (sort several cards as one unit; renderOrder uses the group's z).

Limitations: devices ignore `bend/bendX/shear`, `sheen/rim/edge*`. `fade` is re-mapped per part only for vertical fades (reflections); other angles apply per part. Screen cards cannot rotate. Laptop keys are a procedural pattern (no legends). One device = 4–9 cards of the 300 budget (each slab = +1–2 meshes). The phone has no rear camera bump.

## X9 — Slab thickness (E5, 2026-11-05)
`thickness: d` (world units) on any card gives it side walls (rounded corners follow the card's radius) and a back face, so cards read as tiles/blocks. Cards without `thickness` render exactly as before. Test: `wm still _thicktest --res 400 --at 0.3 [--param mode=domino] [--param dw=true] [--param depth=8]` (hidden `grid/_thicktest.js`).
```js
{ media: 2, w: 0.4, h: 0.3, ry: 0.5, rx: -0.3, thickness: 0.03 }                               // walls = media edge colour, darker
{ media: 2, w: 0.4, thickness: 0.03, sideColor: '#ff3d6e', back: 'side', sideSpec: 0.4 }        // flat coloured walls + back
{ color: '#4d7cff', useMedia: false, w: 0.2, h: 0.2, thickness: 0.2, radius: 0.02 }               // solid block (iso tiles)
{ media: 4, w: 0.3, thickness: 0.06, back: 'media', mirrorBack: 'unmirror', rx: a }               // domino: readable image on the back
{ text: 'W', h: 0.2, weight: 900, color: '#ffd166', thickness: 0.03, sideColor: '#a8742a' }        // extruded glyph
```
| field | meaning |
|---|---|
| thickness | depth in world units; the front face stays at the card position, walls go back along −normal (follows `bend`/`bendX`) |
| sideColor | `'auto'` (default: media cards sample the image along the nearest edge (blurred, `sideBlur` mip bias, default 4); flat/glyph cards use their colour) or `'#hex'` (flat) |
| sideShade | colour multiplier (default .6 for auto, 1 for hex) ; `sideLight` directional shading 0..1 (default 1, light from top-left-front) ; `sideSpec` specular highlight 0..1 (default 0) |
| back | `'media'` (default for media cards: the card itself drawn at −thickness, `mirrorBack` applies; use `'unmirror'` for a readable back) · `'side'` (default for flat/glyph cards: wall colour; on media cards = image average) · `'#hex'` |

- Painter mode (default): walls are back-face culled and drawn right before their card when the front faces the camera; otherwise card → walls → back face (a convex slab, so order alone is correct). The non-visible face is skipped. Shadows sit behind the back face. `depthWrite: true` (template or card) is also supported and is the right choice when slabs intersect each other.
- Glyph cards: thickness is an extrusion of the glyph silhouette (N flat copies, N ≈ 1.5 × thickness in px, 2–48), coloured `sideColor` × `sideShade` with no lighting; walls are not rasterised from the glyph box. Very thick glyphs at large sizes cost up to 48 extra draws per glyph.
- Fog (X8) applies to walls and caps. Light cards (X7) ignore `thickness`. `opacity < 1` slabs show their own back walls through the front (no order-independent transparency). Rotation, `mirrorY` (reflections), `s` and shear (walls approximate) work; masks/FX shapes on the face do NOT carve the walls (the walls follow the rounded rect).

## X6 — Page curl (E6, 2026-11-05)
Any media/colour card (not light cards) can peel like a sheet of paper:
```js
{ media: 0, w, h, x, y, z, curl: { p: u,              // 0 = flat .. 1 = fully peeled & flipped past the far edge (alias: amount)
    angle: Math.PI,      // card-local direction the fold line TRAVELS (rad). PI = lift the right edge, fold moves left (book page);
                         //   -PI/2 = peel from the top edge downward; 0.75*PI = peel from the bottom-right corner toward top-left
    radius: 0.06,        // cylinder radius in world units (default 12% of the card's short side); small = sharp fold, large = soft roll
    axisOffset: 0,       // shifts the fold line along `angle` (world units)
    back: 'paper',       // 'paper' (cu.paper colour, default '#f2eee6') | 'mirror' (see-through mirrored front) | 'media2' (cu.media ?? card.media2 ?? media+1,
                         //   cover-fit, un-mirrored so a fully turned page reads upright) | any '#hex' colour
    backTint: ['#000', 0.2], // optional tint on the back face ('#hex' = 0.35 amount)
    shade: 1, sheen: 1, shadow: 1 } } // fold darkening by cylinder normal, highlight band at the crest, shadow cast onto the flat page next to the curl
```
- Fold position: f = -E + p·(2E + π·radius) where E = half-extent of the card along `angle`, so p=0 is exactly flat and p=1 leaves the whole sheet flipped, lying at height 2·radius beyond the card. A page-turn template typically eases `p` 0→1 and puts the next page (a plain card) just behind (z −0.001, lower `layer`).
- The curl lifts toward the viewer (+z local). The flipped flap lies at z = 2·radius; keep cards stacked above it ≥ that distance in front or on a higher layer.
- A curled card uses a 96×96 mesh, writes depth (self-occlusion) unless you set `depthWrite: false`, and drops its drop-shadow while p > 0 (draw a flat soft shadow card yourself if wanted). `bend`/`bendX` are ignored on curled cards; masks, uv, zoom, sat, bright, radius, border, edge lines and X5 fx all still apply (the fx/mask operate in flat card uv).
- At p = 0 a curled card renders like a plain card (only the back face differs: it follows `back`).
- Test: `wm still _curltest --at 0.45` (4 variants) and `--param mode=page` (full page turn with media back).
