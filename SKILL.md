---
name: wang-motion
description: 用 wang-motion CLI（/workspace/wang-motion）把一组图片/视频套进卡片动效模板，输出无缝循环的 MP4 / WebM / GIF / PNG。用户要做作品集展示、产品图轮播、相册动效、卡片墙、3D 环绕、手机样机展示、社媒循环短片时加载。100 个原创模板（ref: "original"），16 个分类。
---

# wang-motion

位置：`/workspace/wang-motion`。命令统一写 `node /workspace/wang-motion/bin/wm.mjs <cmd>`（下文简写 `wm`）。完整用户文档见 `README.md`，模板编写见 `docs/AUTHORING.md`。

## 什么时候用

- 用户给了一批图片/视频，想要「动起来」的展示视频：轮播、卡片墙、3D 球面、环绕、散落、擦除揭示、多段镜头
- 需要**无缝循环**的素材（网页 hero、展会屏、社媒循环）
- 需要多画幅版本（16:9 / 9:16 / 1:1 / 4:5）同一套动效

不适合：需要叙事分镜、配音字幕、逐帧手工设计的解说片或发布片（那类用 HTML+GSAP 的动画方案）。wang-motion 只做「卡片 + 镜头 + 叠加文字/Logo」。

## 工作流（必须先预览再出片）

1. `wm doctor`：确认 chrome / ffmpeg / imagemagick / webgl2 都 ok
2. 选模板：`wm list --json`，按 category、desc、tags、slots 筛；不确定就出预览图对比
3. 预览：`wm sheet <id1> <id2> <id3> --ratio 16:9 --res 300 --out /tmp/cmp.jpg`，用 read_file 看图；单模板看动作用 `--frames 8`
4. 调参：`wm info <id>` 看参数，`wm still <id> --param k=v --res 360 --at 0.3,0.7` 迭代
5. 试渲染：`--res 360 --duration 4` 先出短片检查
6. 正式渲染：目标分辨率/时长，输出路径写清楚

机器只有 2 核：预览阶段一律 ≤400px。参考耗时：360p 静帧约 4 s；2 s 360p 视频约 8 s；1080p 16 s 30fps 是 480 帧，会慢很多，别在探索阶段跑。

## 命令速查

```bash
wm list [category] [--category c] [--json]
wm info <id | "Display Name">
wm still <id> [--at 0.3 | --at 0,0.5,0.9 | --at 3.5 | --at 1 --seconds] [--res 720] [--ratio 9:16] [--width W --height H] --out x.png
wm sheet [ids...] [--category c] [--frames 8] [--ratio 1:1] [--cols 6] [--res 360] [--at 0.3] --out sheet.jpg
wm render <id> [--spec spec.json] --out out.mp4|.webm|.gif [--format mp4] [--audio a.mp3]
          [--ratio 16:9] [--res 1080] [--duration 16] [--fps 30] [--crf 16] [--preset medium] [--workers 2] [--motionblur 6]
wm doctor
```

- `still --at`：≤1 = 循环相位 0–1，>1 = 秒；`--seconds` 强制按秒。逗号列表输出 `x-0.png`、`x-1.png`……
- `--res` = 短边。still 默认 720，sheet 默认 360，render 默认 1080
- `sheet` 默认画幅 1:1；不给 id 就是全部 100 个；每格缩进 `res×res` 方框，16:9 / 9:16 的格子会变小（res 300 → 300×169）
- `still --at` 默认 0.3；`still`/`sheet` 配 `--spec` 时会读 spec 的 res 和 ratio，命令行参数优先；`still --spec s.json` 可省略模板 id（读 spec 的 template）
- `render` 的模板 id 可省略，用 spec 里的 `template`

## 通用选项（still / sheet / render 共用）

```bash
# 素材
--media a.jpg,b.png,c.webm        # 按顺序
--media-dir ./photos              # 自然排序；优先级 media-dir > media > spec.media > 示例图
--count 24 --card-ratio 4:3
# 文字
--text "第一行\n第二行" --text-pos bottom --text-size 6 --text-color "#fff" --text-anim loop-fade
# Logo（尺寸只能 spec logo.size，默认 8 = 画面高 8%）
--logo logo.png --logo-pos top-right
# 背景
--bg "#111" | --gradient "#a,#b[,#c]" --angle 90 | --bg-image bg.jpg --dim 0.5
#   gradient：90=上→下、0=左→右；2 色渲染为对称 a→b→a，单向渐变给 3 色；dim 是亮度系数，1=原图（默认）
# 画面
--padding 8 --radius 4 --shadow false --grain 0.3 --vignette 0.4 --motionblur 6
--param key=value                 # 可重复；颜色 tint=#ffcc66，列表 words="A|B|C"
--keyframes '{"cardSize":[[0,40,"outCubic"],[8,60],[16,40]]}'   # 缓动写在起点帧；末值=首值才无缝
```

位置取值：`top-left top top-right left center right bottom-left bottom bottom-right`。

## 关键限制（会踩坑的）

- `--duration` 是**整个循环**的长度：缩短 = 动作加速，不是裁剪。想要舒缓就加长（多数模板默认 12–20 s）
- 文字动画只有 `loop-fade` 首尾无缝；`rise`（默认）/`fade`/`pop` 只入场一次，循环播放会在接缝处跳。交付循环视频时用 `--text-anim loop-fade`
- `title-stagger-rise`、`word-slot-roll`、`product-launch` 自己用 `--text` 做文字动画（usesTitle），不再画叠加标题
- Logo 大小命令行改不了，要写 spec：`"logo": {"src": "...", "position": "top-right", "size": 6}`
- spec 里的相对路径按**当前工作目录**解析，不是 spec 所在目录。最稳妥：spec 里写绝对路径
- 视频素材：MP4/MOV 会自动转码为 WebM（需要 ffmpeg）
- `--width/--height` 必须同时给，否则按 ratio+res 算；尺寸自动取偶数
- GIF 帧率上限 20、宽上限 720，适合预览不适合高质量交付
- `--audio` 用 `-shortest`：音频比视频长会被截，比视频短则视频被截
- 素材少于模板 `slots` 会循环复用；数量差太多时画面重复明显，告诉用户或换 slots 更少的模板
- `sheet` 需要 ImageMagick；`render` 需要 ffmpeg
- 下划线开头的测试模板不在 list 里，别推荐给用户

## 配方

**作品集轮播（横屏，带标题，可循环）**
```bash
wm render arc-carousel --media-dir ./work --ratio 16:9 --res 1080 --duration 16 \
   --text "2026 作品集" --text-anim loop-fade --gradient "#0f2027,#2c5364" --out portfolio.mp4
```

**竖屏社媒（9:16）**
```bash
wm render cover-flow-vertical --media-dir ./shots --ratio 9:16 --res 1080 --duration 12 \
   --logo logo.png --logo-pos top --out reel.mp4
```

**手机样机展示 App 截图**
```bash
wm render phone-scroll-feed --media-dir ./screens --ratio 9:16 --res 1080 --out app.mp4
```

**大图墙 / 3D 球**：`sphere-wall`、`card-globe`、`card-tunnel`、`ticker-tilt`（素材多时效果好，`--count 24`）

**多画幅一次出齐**
```bash
for r in 16:9 1:1 9:16; do wm render cover-flow --media-dir ./p --ratio $r --res 1080 --out "out-${r/:/x}.mp4"; done
```

**网页 hero 循环（无文字，小体积）**
```bash
wm render sphere-wall --media-dir ./p --ratio 21:9 --res 720 --out hero.webm
```

**加配乐**：`--audio bgm.mp3`，并把 `--duration` 设成音乐长度或其约数。


## 素材张数
每个模板「用得上」的图片数不同（如 `card-globe` 22 张、`cover-ring` 8 张、`arc-carousel` 不限），详见 `docs/capacity.md`。素材少于容量会循环重复；多于容量时只用前 N 张，其余不出现，需要的话分批渲染。`card-globe` / `orbit-globe` 加 `--param mediaSpread=unique` 可以让每张卡用不同的图。

## 选模板

先按用途锁定分类，再用 `sheet` 出 3–6 个候选让用户挑（或自己看图挑）：

| 用途 | 分类 / 模板 |
|---|---|
| 逐张主推、产品、封面 | carousel-flow（cover-flow、arc-carousel、hero-reel）、spotlight-focus（center-stage、focus-rack） |
| 大量图铺满、滚动 | grid（ticker-loop、masonry-scroll、bento-reshuffle）、3d-perspective（sphere-wall、card-tunnel、totem-wall） |
| 环绕、旋转 | orbit（orbit-carousel、wheel-spin、atom-orbits、planet-rings） |
| 片头、多段镜头 | multiscene（triple-scene、grid-dive、collage-reel）、transitions（whip-pan、zoom-punch、spin-zoom） |
| 散落、抛洒、堆叠 | stack-scatter（card-toss、desk-photo-toss、card-fountain、poster-burst） |
| 擦除揭示 | reveal-wipe |
| 等距 2.5D | isometric |
| 手机/设备 | device-mockup |
| 文字为主 | kinetic-type（用 `--text`） |
| 光效、故障、粒子 | light-fx、glitch、particles、flythrough |

`slots` 是建议素材数：用户只有 3–5 张图时选 slots 小的（cover-flow 5）；有 20+ 张选墙类。


## 参数

- 每个模板都有 `padding`（%，默认 6）和 `cornerRadius`（%，默认 3），分别对应 `--padding`、`--radius`
- 常见参数：`cardSize`（%）、`gap`、`perspective`（%）、`speed`、`direction`、`motion`（stopAtCenter / continuous）、`ease`（custom / smooth / natural / slowDown / snappy / accelerate / elastic / bounce / overshoot / impulse / swing / linear）、`cardRatio`（auto / 1:1 / 4:3 / 3:4 / 4:5 / 16:9 / 9:16）
- 一定先 `wm info <id>` 看 `min`/`max`/`options`，别猜参数名；`wm list --json` 的 `params` 只有参数名
- 动态变化用 keyframes：`{参数: [[秒, 值, 缓动?], ...]}`，缓动写在起点帧，默认 inOutCubic

## spec.json

复杂设置（多条文字、logo 尺寸、关键帧）写 spec。命令行同名选项覆盖 spec。

```json
{
  "template": "cover-flow",
  "ratio": "16:9", "res": 1080, "duration": 12, "fps": 30,
  "media": ["/abs/path/01.jpg", "/abs/path/02.jpg"],
  "params": { "cardSize": 55, "sideTilt": 30 },
  "background": { "type": "gradient", "colors": ["#0f2027", "#2c5364"], "angle": 90 },
  "text": [{ "content": "WANG MOTION", "position": "bottom", "size": 7, "color": "#ffffff", "animate": "loop-fade", "weight": 800 }],
  "logo": { "src": "/abs/path/logo.png", "position": "top-right", "size": 6, "opacity": 0.9 },
  "keyframes": { "cardSize": [[0, 40], [6, 60, "outCubic"], [12, 40]] },
  "fx": { "vignette": 0.4, "grain": 0.2, "motionBlur": 0 }
}
```

`background.type`：color / gradient（`radial`、`animate` 可选）/ image（`image`、`dim`）/ aurora。`fx`：motionBlur、shutter、grain、vignette、aberration。text 每条还可设 `font`、`x`/`y`（偏移 %）、`opacity`、`delay`、`in`、`shadow: false`。

## 输出与交付

- 输出：`.mp4`（h264 yuv420p faststart，crf 16）、`.webm`（vp9）、`.gif`、`still` 出 `.png`；命令成功后 stdout 最后一行是输出路径
- 工作文件放项目 `work/` 或用户指定目录；交付前用 read_file 看一张 still（或 `ffmpeg -ss 2 -i out.mp4 -frames:v 1 /tmp/chk.png`）确认画面不是黑屏、文字没被截断
- 用户字幕/文字偏好（如不要标点）同样适用于 `--text`
- 汇报时给：模板 id、画幅/分辨率/时长、文件路径；不要描述内部引擎实现

## 分类一览（100 个原创，ref: "original"）

| 分类 | 数量 | 包含模板 |
|---|---:|---|
| 3d-perspective | 14 | `card-globe` `card-tunnel` `cover-ring-vertical` `cover-ring` `depth-stack-scroll` `double-helix` `moebius-ribbon` `orbit-globe` `parallax-totem` `showcase-stream` `sphere-cascade` `sphere-wall` `spiral-stream` `totem-wall` |
| carousel-flow | 12 | `arc-carousel` `card-totem` `carousel-flow` `cover-flow-vertical` `cover-flow` `diagonal-carousel` `film-strip` `focus-slider` `hero-reel` `mosaic-marquee` `parallax-rows` `wheel-carousel` |
| device-mockup | 3 | `phone-hero-swing` `phone-scroll-feed` `phone-trio-fan` |
| flythrough | 1 | `gallery-corridor` |
| glitch | 1 | `glitch-cut-slideshow` |
| grid | 10 | `bento-reshuffle` `column-drift` `feed-scroll` `flip-grid` `grid-reveal` `masonry-scroll` `pop-grid` `spotlight-zoom` `ticker-loop` `ticker-tilt` |
| isometric | 5 | `iso-cascade` `iso-endless-stairs` `iso-equalizer` `iso-focus` `iso-orbit` |
| kinetic-type | 2 | `title-stagger-rise` `word-slot-roll` |
| light-fx | 3 | `glow-sweep-grid` `light-leak-cuts` `prism-converge` |
| multiscene | 15 | `bloom-belt` `collage-reel` `fan-shuffle` `flyby-rolodex` `grid-dive` `grid-zoom-strip` `lens-orbit` `pop-parade` `product-launch` `scatter-dial` `spread-columns` `spread-rows` `stairway` `sweep-ring` `triple-scene` |
| orbit | 10 | `atom-orbits` `focus-orbit` `orbit-bloom` `orbit-carousel` `orbit-showcase` `photo-orbit` `planet-rings` `vortex-spin` `wheel-spin-bottom` `wheel-spin` |
| particles | 2 | `bokeh-cover-flow` `dust-hero-light` |
| reveal-wipe | 4 | `diagonal-wipe` `mosaic-reveal` `split-reveal` `stripe-reveal` |
| spotlight-focus | 6 | `center-stage` `deck-peel` `focus-rack` `focus-shift` `polaroid-develop` `zoom-parallax` |
| stack-scatter | 9 | `card-fountain` `card-toss` `cascade-deck` `cascade-drop` `desk-photo-toss` `image-trail` `position-dance` `poster-burst` `stack-slide` |
| transitions | 3 | `spin-zoom` `whip-pan` `zoom-punch` |
| **合计** | **100** | |
