# wang-motion

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-在线体验-brightgreen.svg)](https://w18774994563.github.io/wang-motion/)

> 🌐 **在线体验 / 动效工坊**：[https://w18774994563.github.io/wang-motion/](https://w18774994563.github.io/wang-motion/)  
> 无需安装任何环境，直接在浏览器中交互体验 100 款 3D 卡片动效、调节参数并实时导出视频。

卡片动效模板渲染器：给一组图片或视频，选一个模板，输出 MP4、WebM、GIF 或静帧 PNG。适合做作品集展示、产品图轮播、相册动效、社媒短视频片头。

- 100 个模板：70 个复刻 + 30 个原创，分 16 个分类
- 全部自有代码（Three.js + Playwright 无头 Chromium），不依赖在线服务
- 每个模板都是**无缝循环**：首尾帧一致，可直接做循环播放
- 横竖方屏通吃：16:9、9:16、1:1、4:5 等画幅都能自动适配

## 当前内容

- 模板总数 100（`wm list` 统计，不含 `_` 开头的测试模板）：70 个复刻（`ref: "animos"`）+ 30 个原创（`ref: "original"`）
- 分类 16 个，详见下方「分类与数量」
- 引擎能力：卡片特效、镜像倒影、渐隐遮罩、字形文字卡片、样条镜头路径与雾效、粒子系统（dot / bokeh / spark / quad / streak / petal）、模板后期（chroma / glitch / scan / flash / tint / grade / bloom / leak / barrel / tracking / noise）、设备样机（phone / tablet / laptop / watch / browser / crt）、翻页卷曲、卡片厚度
- 内置字体：Inter、Noto Sans SC（GB2312 字符集）
- 下划线开头的是测试模板，`wm list` 不显示，但可以用 id 直接渲染（如 `_fxtest`）

## 安装

需要 Node 18 或更高版本。

```bash
cd wang-motion
npm install                                            # 安装 playwright-core
npx playwright-core install chromium-headless-shell    # 本机没有 Chrome/Chromium 时运行
npx playwright-core install-deps chromium              # Linux 缺系统库时运行（需要 sudo）
node bin/wm.mjs doctor                                 # 检查运行环境
```

其他依赖：

| 依赖 | 用途 | 安装 |
|---|---|---|
| ffmpeg | `render` 编码视频；MP4/MOV 素材转码 | `apt install ffmpeg` / `brew install ffmpeg` |
| ImageMagick | `sheet` 拼接预览图；首次生成示例素材 | `apt install imagemagick` / `brew install imagemagick` |

浏览器查找顺序：`WM_CHROME` 环境变量 → `~/.cache/ms-playwright`（或 `PLAYWRIGHT_BROWSERS_PATH`）→ 系统 Chromium / Chrome。也可以手动指定：

```bash
WM_CHROME=/path/to/chrome node bin/wm.mjs doctor
```

`doctor` 输出示例：

```
chrome: /root/.cache/ms-playwright/chromium_headless_shell-xxxx/chrome-linux/headless_shell
ffmpeg: ok
imagemagick: ok
playwright-core: ok
webgl2: true
templates: 100
```

想用 `wm` 代替 `node bin/wm.mjs`，在项目目录运行一次 `npm link`。下文统一写 `node bin/wm.mjs`。

## 快速开始

```bash
# 1. 看有哪些模板
node bin/wm.mjs list

# 2. 先出一张静帧确认效果（360p 约 4 秒）
node bin/wm.mjs still cover-flow --res 360 --out cover.png

# 3. 用自己的图出视频
node bin/wm.mjs render cover-flow --media-dir ./my-photos --ratio 16:9 --res 1080 \
     --text "2026 作品集" --out out.mp4
```

不给素材时自动使用 `examples/demo-media` 里的 12 张编号示例图。

## 命令

### list：列出模板

```bash
node bin/wm.mjs list                       # 按分类列出全部
node bin/wm.mjs list orbit                 # 只看一个分类
node bin/wm.mjs list --category orbit      # 同上
node bin/wm.mjs list --json                # JSON：id、name、category、slots、desc、tags、ref、params（参数名）、duration、file
```

`ref` 字段区分来源：`animos` 为复刻，`original` 为原创。`slots` 是建议素材张数，`duration` 是默认循环秒数。

### info：查看模板参数

```bash
node bin/wm.mjs info cover-flow
node bin/wm.mjs info "Cover Flow"          # 也可以用显示名（不区分大小写）
```

输出完整 JSON，`params` 里每个参数有 `type`（number / choice / color / text / list）、`default`、`min`/`max`、`options`、`label`。例如 `cover-flow`：

```
padding 6% · cornerRadius 3% · cardSize 46% · gap 4% · sideTilt 40° · flowAngle 0°
ease custom | smooth | natural | slowDown | snappy | accelerate | elastic | bounce | overshoot | impulse | swing | linear
cardRatio auto | 1:1 | 4:3 | 3:4 | 4:5 | 16:9 | 9:16
direction rightToLeft | leftToRight · motion stopAtCenter | continuous · loopCards 5 · perspective 30%
```

### still：导出静帧 PNG

```bash
node bin/wm.mjs still cover-flow --at 0.3 --out a.png                 # 循环 30% 处
node bin/wm.mjs still cover-flow --at 0,0.5 --res 360 --out a.png     # 多帧 → a-0.png、a-1.png
node bin/wm.mjs still cover-flow --at 3.5 --out a.png                 # 大于 1 视为秒
node bin/wm.mjs still cover-flow --at 1 --seconds --out a.png         # 强制按秒解释（第 1 秒）
node bin/wm.mjs still cover-flow --ratio 9:16 --res 720 --out p.png   # 竖屏 720×1280
node bin/wm.mjs still cover-flow --width 1200 --height 630 --out og.png
```

- `--at`：≤1 是循环相位（0–1），>1 是秒；不给时默认 0.3；逗号分隔可一次出多帧，文件名自动加 `-0`、`-1`……
- `--res`：短边像素，still 默认 720
- `--width` + `--height`：直接指定尺寸（两个都给才生效，会取偶数）
- 其他渲染选项（素材、文字、背景、参数）与 `render` 相同
- 配合 `--spec` 时，spec 里的 `res` 不生效（still 固定默认 720），需要在命令行写 `--res`

### sheet：拼接预览图

需要 ImageMagick。

```bash
node bin/wm.mjs sheet cover-flow --frames 8 --out flow.jpg            # 一个模板的 8 个时刻
node bin/wm.mjs sheet cover-flow arc-carousel wheel-spin --out cmp.jpg # 多个模板各一帧对比
node bin/wm.mjs sheet --category orbit --out orbit.jpg                # 一个分类全部
node bin/wm.mjs sheet --category grid --ratio 9:16 --cols 5 --res 300 --out g.jpg
```

- 不给 id 时为全部模板（100 张，较慢）
- `--frames N`：每个模板取 N 个等距时刻（0、1/N……）；默认 1，此时用 `--at`（默认 0.3）
- `--ratio` 默认 **1:1**，`--res` 默认 360（命令行优先，其次读 spec 的 ratio/res）；`--cols` 默认 min(6, 模板数)（多帧时等于帧数）
- 每格缩放进 `res×res` 的方框：非 1:1 画幅的格子会更小（如 `--ratio 16:9 --res 300` 每格 300×169）
- 每格带标签（模板 id，多帧时附 `u=` 相位）

### render：渲染视频

```bash
# MP4（h264，默认）
node bin/wm.mjs render arc-carousel --media-dir ./photos --ratio 16:9 --res 1080 \
     --duration 16 --fps 30 --text "标题" --out out.mp4

# WebM（vp9）
node bin/wm.mjs render cover-flow --media a.jpg,b.jpg,c.jpg --out out.webm

# GIF（≤20fps，宽 ≤720，自动调色板）
node bin/wm.mjs render cover-flow --res 360 --duration 4 --out out.gif

# 加配乐（时长取视频与音频较短者）
node bin/wm.mjs render cover-flow --audio bgm.mp3 --out out.mp4

# 按 JSON 规格渲染（模板 id 可省略，取 spec.template）
node bin/wm.mjs render --spec spec.json --out out.mp4
```

| 选项 | 说明 | 默认 |
|---|---|---|
| `--out` | 输出文件；扩展名决定格式 | `<id>.mp4` |
| `--format` | 强制格式 `mp4` / `webm` / `gif` | 由扩展名决定 |
| `--ratio` | 画幅 | 模板默认，一般 16:9 |
| `--res` | 短边像素 | 1080 |
| `--width` `--height` | 直接指定尺寸 | |
| `--duration` | **整个循环**的秒数 | 模板默认（多数 12–20） |
| `--fps` | 帧率 | 30 |
| `--crf` | h264 质量（越小越好） | 16 |
| `--preset` | h264 预设 | medium |
| `--workers` | 并行渲染页数 | min(4, CPU 核数) |
| `--motionblur N` | 运动模糊子帧数（如 6），越大越慢 | 关 |
| `--keyframes JSON` | 参数关键帧，见下文 | |
| `--audio` | 配乐文件 | |

注意 `--duration` 是**压缩/拉伸整段循环**，不是裁剪：同一个模板 8 秒和 16 秒走完的是同样的动作，只是快慢不同。

速度参考（2 核机器）：360p 静帧约 4 秒；2 秒 360p 视频约 8 秒。1080p 长视频会慢得多，先用低分辨率确认效果。

### doctor：环境检查

```bash
node bin/wm.mjs doctor
```

检查 Chromium、ffmpeg、ImageMagick、playwright-core、缺失的系统库、WebGL2，并报告模板数。

## 素材

```bash
--media a.jpg,b.png,c.mp4      # 逗号分隔，按给出的顺序
--media-dir ./photos           # 整个目录，按文件名自然排序（2.jpg 在 10.jpg 前）
--count 24                     # 卡片数量覆盖（素材不够时循环复用）
--card-ratio 4:3               # 卡片比例（也可用 --param cardRatio=4:3），默认 auto
```

- 支持格式：png、jpg/jpeg、webp、gif、svg、webm、mp4、mov、m4v
- 视频素材在卡片里循环播放。MP4/MOV 会自动转码为 WebM（需要 ffmpeg）
- 素材数少于模板 `slots` 时会循环复用；图片以 cover 方式填满卡片
- 优先级：`--media-dir` > `--media` > spec 里的 `media` > 示例素材
- 相对路径按**当前工作目录**解析（spec 里的路径也是）

## 文字

```bash
--text "WANG MOTION"                 # 标题叠加层
--text "第一行\n第二行"               # \n 换行
--text-pos bottom                    # top-left top top-right left center right bottom-left bottom bottom-right，默认 bottom
--text-size 6                        # 字高，占画面高度的百分比，默认 6
--text-color "#ffffff"               # 默认白色
--text-anim rise                     # rise（上浮淡入，默认）| fade | pop | loop-fade | none
```

只有 `loop-fade`（开头淡入、结尾淡出）是**首尾无缝**的；`rise` / `fade` / `pop` 只在开头入场一次，循环播放时会在接缝处跳变。做循环视频请用 `loop-fade`。

`title-stagger-rise`、`word-slot-roll`、`product-launch` 三个模板自己用 `--text` 内容做文字动画（没给 `--text` 时用模板的 `text` 参数），这时不再画叠加标题。多行文字、字重、偏移等更多设置用 spec 的 `text` 数组。

## Logo

```bash
--logo logo.png --logo-pos top-right     # 位置同 --text-pos，默认 top-left
```

Logo 大小只能在 spec 里设：`"logo": { "src": "logo.png", "position": "top-right", "size": 6 }`，`size` 是占画面高度的百分比，默认 8；也支持 `opacity`。

## 背景

```bash
--bg "#111111"                               # 纯色
--gradient "#0f2027,#2c5364" --angle 90      # 渐变，2–3 色，角度默认 90（90 = 上→下，0 = 左→右）
--bg-image bg.jpg --dim 0.5                  # 图片背景（cover），dim 是亮度系数 0–1：1 = 原图（默认），越小越暗
```

只给 2 色时渲染为对称的 色1→色2→色1（中间是第二色）；要单向渐变请给 3 色。

spec 里可写 `{ "type": "gradient", "colors": [...], "angle": 90, "radial": true, "animate": true }`；另有 `{ "type": "aurora", "colors": [...] }` 流光背景。

## 画面与质感

```bash
--padding 8              # 画面内边距 %（= --param padding=8）
--radius 4               # 卡片圆角 %（= --param cornerRadius=4）
--shadow false           # 关闭卡片投影
--grain 0.3              # 胶片颗粒 0–1
--vignette 0.4           # 暗角 0–1
--motionblur 6           # 运动模糊
--param key=value        # 任意模板参数，可重复；见 wm info
```

`--param` 值的写法：数字直接写；颜色 `--param tint=#ffcc66`（`ffcc66` 会自动补 `#`）；文本 `--param text=2026`；列表用 `|` 分隔 `--param words="ONE|TWO|THREE"`。

## 画幅

`--ratio` 支持 `16:9`、`4:3`、`1:1`、`4:5`、`3:4`、`9:16`、`21:9`、`2:3`、`3:2`，也可写任意 `a:b`。`--res` 是短边：`--ratio 9:16 --res 1080` → 1080×1920，`--ratio 16:9 --res 720` → 1280×720。

## 输出格式

| 格式 | 编码 | 说明 |
|---|---|---|
| `.mp4` | h264，yuv420p，faststart | 默认；`--crf`、`--preset` 可调；音频 AAC 192k |
| `.webm` | vp9，crf 28 | 音频 Opus |
| `.gif` | 调色板 | 帧率上限 20，宽上限 720 |
| `.png` | — | 用 `still` 命令 |

## spec.json

一个 JSON 文件描述全部设置，命令行选项会覆盖 spec 里的同名项。

```json
{
  "template": "cover-flow",
  "ratio": "1:1",
  "res": 360,
  "duration": 2,
  "fps": 24,
  "media": ["examples/demo-media/demo01.png", "examples/demo-media/demo02.png", "examples/demo-media/demo03.png"],
  "params": { "cardSize": 55, "sideTilt": 30 },
  "background": { "type": "gradient", "colors": ["#0f2027", "#2c5364"], "angle": 90 },
  "text": [{ "content": "WANG MOTION", "position": "bottom", "size": 7, "color": "#ffffff", "animate": "fade" }],
  "logo": { "src": "logo.png", "position": "top-right", "size": 6 },
  "keyframes": { "cardSize": [[0, 40, "outCubic"], [1, 60], [2, 40]] },
  "fx": { "vignette": 0.4 }
}
```

```bash
node bin/wm.mjs render --spec spec.json --out out.mp4
node bin/wm.mjs still  --spec spec.json cover-flow --at 0.5 --res 360 --out s.png   # 模板 id 可省略（读 spec 的 template）；命令行 --res 优先于 spec
```

上例在仓库根目录运行；`logo.png` 换成你自己的文件（素材或 logo 文件不存在时会提示 file not found 并以退出码 3 退出；路径相对当前目录）。

字段说明：

- `media`、`logo.src`、`background.image`：相对路径按**运行命令时的当前目录**解析，不是 spec 文件所在目录
- `text`：数组，可多条；每条 `content`、`position`、`size`、`color`、`animate`（rise / fade / pop / loop-fade / none），以及 `weight`（默认 700）、`font`、`x`/`y`（偏移 %）、`opacity`、`delay`、`in`（入场秒数）、`shadow: false`
- `keyframes`：`{ 参数名: [[秒, 值, 缓动?], ...] }`，缓动写在**起点**那一帧上，默认 `inOutCubic`；数值参数插值，非数值在中点切换；关键帧不会自动回绕，想保持首尾无缝就让最后一帧（循环末尾）的值等于第一帧。命令行等价：`--keyframes '{"cardSize":[[0,40],[2,60]]}'`
- `fx`：`motionBlur`、`shutter`（0.5）、`grain`、`vignette`、`aberration`（色差）
- 其他：`count`、`cardRatio`、`shadow`

## 分类与数量

`wm list` 共 100 个模板（不含 `_` 测试模板）：70 个复刻，30 个原创（★，`ref: "original"`）。

| 分类 | 总数 | 复刻 | 原创 | 模板（★ = 原创） |
|---|---:|---:|---:|---|
| 3d-perspective | 14 | 12 | 2 | `card-globe` `card-tunnel` `cover-ring-vertical` `cover-ring` `depth-stack-scroll` `double-helix`★ `moebius-ribbon`★ `orbit-globe` `parallax-totem` `showcase-stream` `sphere-cascade` `sphere-wall` `spiral-stream` `totem-wall` |
| carousel-flow | 12 | 10 | 2 | `arc-carousel`★ `card-totem` `carousel-flow` `cover-flow-vertical` `cover-flow` `diagonal-carousel` `film-strip` `focus-slider` `hero-reel` `mosaic-marquee` `parallax-rows`★ `wheel-carousel` |
| device-mockup | 3 | 0 | 3 | `phone-hero-swing`★ `phone-scroll-feed`★ `phone-trio-fan`★ |
| flythrough | 1 | 0 | 1 | `gallery-corridor`★ |
| glitch | 1 | 0 | 1 | `glitch-cut-slideshow`★ |
| grid | 10 | 8 | 2 | `bento-reshuffle`★ `column-drift` `feed-scroll` `flip-grid` `grid-reveal` `masonry-scroll`★ `pop-grid` `spotlight-zoom` `ticker-loop` `ticker-tilt` |
| isometric | 5 | 3 | 2 | `iso-cascade` `iso-endless-stairs`★ `iso-equalizer`★ `iso-focus` `iso-orbit` |
| kinetic-type | 2 | 0 | 2 | `title-stagger-rise`★ `word-slot-roll`★ |
| light-fx | 3 | 0 | 3 | `glow-sweep-grid`★ `light-leak-cuts`★ `prism-converge`★ |
| multiscene | 15 | 14 | 1 | `bloom-belt` `collage-reel` `fan-shuffle` `flyby-rolodex` `grid-dive` `grid-zoom-strip` `lens-orbit` `pop-parade` `product-launch`★ `scatter-dial` `spread-columns` `spread-rows` `stairway` `sweep-ring` `triple-scene` |
| orbit | 10 | 8 | 2 | `atom-orbits`★ `focus-orbit` `orbit-bloom` `orbit-carousel` `orbit-showcase` `photo-orbit` `planet-rings`★ `vortex-spin` `wheel-spin-bottom` `wheel-spin` |
| particles | 2 | 0 | 2 | `bokeh-cover-flow`★ `dust-hero-light`★ |
| reveal-wipe | 4 | 4 | 0 | `diagonal-wipe` `mosaic-reveal` `split-reveal` `stripe-reveal` |
| spotlight-focus | 6 | 4 | 2 | `center-stage` `deck-peel` `focus-rack`★ `focus-shift` `polaroid-develop`★ `zoom-parallax` |
| stack-scatter | 9 | 7 | 2 | `card-fountain`★ `card-toss` `cascade-deck` `cascade-drop` `desk-photo-toss`★ `image-trail` `position-dance` `poster-burst` `stack-slide` |
| transitions | 3 | 0 | 3 | `spin-zoom`★ `whip-pan`★ `zoom-punch`★ |
| **合计** | **100** | **70** | **30** | |

挑模板的思路：

| 想要的效果 | 先看 |
|---|---|
| 一张一张主推（产品、封面） | `carousel-flow`（cover-flow、arc-carousel）、`spotlight-focus` |
| 大量图片铺满墙、滚动 | `grid`、`3d-perspective`（sphere-wall、card-tunnel） |
| 环绕、旋转 | `orbit` |
| 多段镜头、片头感 | `multiscene`、`transitions` |
| 散落、抛洒、堆叠 | `stack-scatter` |
| 擦除揭示 | `reveal-wipe` |
| 手机/电脑样机 | `device-mockup` |
| 文字为主 | `kinetic-type` |
| 光效、故障风 | `light-fx`、`glitch`、`particles` |

## 常见问题

**chrome: NOT FOUND**
运行 `npx playwright-core install chromium-headless-shell`，或用 `WM_CHROME=/path/to/chrome` 指定。

**doctor 报 missing libs**
Linux 缺系统库：`sudo npx playwright-core install-deps chromium`。

**webgl2: false / 画面全黑**
引擎用 SwiftShader 软件渲染 WebGL2，一般不需要 GPU。若仍为 false，换 Playwright 自带的 headless shell 试试。

**sheet 报错或没有输出**
需要 ImageMagick（`magick` 或 `montage` 命令）。

**render 报 ffmpeg 错误**
确认 `ffmpeg` 在 PATH 里，且编译了 libx264（MP4）/ libvpx（WebM）。

**素材路径找不到**
相对路径按当前工作目录解析。在别的目录运行时，用绝对路径或先 `cd` 到 spec 所在目录。

**改短 `--duration` 后动作变快了**
`--duration` 是整段循环的长度，会等比压缩动画，不会裁掉后半段。想要更舒缓就加长。

**循环播放时标题闪一下**
默认 `rise` 只入场一次。循环视频用 `--text-anim loop-fade`。

**Logo 太大/太小**
命令行没有 logo 尺寸选项，在 spec 里写 `logo.size`（占画面高度 %，默认 8）。

**视频素材没动 / 不显示**
MP4/MOV 会自动转码为 WebM（需要 ffmpeg）。仍有问题时可先自行转成 WebM：`ffmpeg -i in.mp4 -c:v libvpx-vp9 -b:v 0 -crf 32 -an in.webm`。

**渲染太慢**
先用 `still --res 360` 或 `sheet --frames 8` 确认效果；视频先用 `--res 360 --duration 4` 试；`--motionblur` 会成倍增加耗时。

**中文显示成方块**
叠加标题用系统中文字体（Noto Sans CJK SC / PingFang SC）；系统没装时可安装 `fonts-noto-cjk`。文字卡片模板使用内置的 Noto Sans SC（GB2312 字符集）。

## 新增模板

一个模板就是 `engine/templates/<分类>/<id>.js` 里一个导出普通对象的 ES 模块，`layout(ctx)` 按时间返回每张卡片的状态，引擎负责渲染。放进目录即被 `wm list` 识别；文件名以 `_` 开头则为隐藏测试模板。

编写规范、`ctx` 字段、卡片属性表、特效 / 文字卡片 / 镜头路径 / 粒子 / 后期 / 设备样机 / 厚度 / 翻页卷曲的 API，见 [docs/AUTHORING.md](docs/AUTHORING.md)。

要点：动画必须对相位 `u` 周期（u=0 与 u=1 一致）；随机数用 `M.rand(i, seed)`；尺寸基于 `ctx.inner`/`ctx.view` 以适配各种画幅；模板文件不能 import three.js。

## 目录

- `bin/wm.mjs`：命令行工具
- `engine/core.js`：渲染引擎（Three.js）
- `engine/lib.js`：数学、缓动、样条函数
- `engine/index.html`：无头浏览器加载的渲染页
- `engine/templates/<分类>/<id>.js`：模板，一个文件一个
- `docs/AUTHORING.md`：模板编写规范与引擎 API
- `examples/demo-media`：12 张示例素材
