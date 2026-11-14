# 素材比例自适应（v10.2）

## 一句话
卡片形状跟着素材走：16:9 的图就是 16:9 的卡，9:16 的图就是竖卡，图片完整显示。模板的位置、旋转、动画一概不动，引擎只在排版结果上改卡片宽高（`engine/adapt.js`）。

## 开关
| spec 字段 | CLI | 网页 | 说明 |
|---|---|---|---|
| `cardRatio: "media"` | `--card-ratio media`（默认） | 卡片形状「跟随素材」（导入图片后默认） | 本批主比例：中位数，±3% 吸附到常用比例 |
| `cardRatio: "auto"` | `--card-ratio template` | 「模板原样」 | v9 / v10 的形状，逐像素一致 |
| `cardMix: "own"` | `--card-mix own` | 「各自比例」 | 每张卡用自己图片的比例 |
| `fit` | `--fit blur\|color\|cover` | 整屏动效 | 整屏卡片：完整 + 模糊底（默认）/ 纯色底（`fitColor`）/ 铺满裁切 |
| `ratio` | `--ratio media` | 画面比例「跟随素材」 | 画面 = 素材主比例；网页导出短边不变（1080p → 1080×1920），PPTX 固定 16:9 |
| `focus: [[x,y]\|null, …]` | `--focus "N:x,y;…"` | 「调整裁切焦点」 | 裁切时保留哪里，0..1，按素材顺序 |

CLI 使用 `--ratio media` 时需要 FFprobe 或 FFmpeg 读取素材尺寸；无法读取时会提示并回退到 4:3。

旧 spec.json 没有 `cardRatio` = 模板原样（老作品重渲不变）。CLI 直接给参数（不用 `--spec`）时默认 `media`；`sheet` / `intro-compat` 始终模板原样。网页没导入图片时按模板原样（默认案例图不变）。

## 换形方式
- **area**（默认）：等面积换形，单边最多放大 1.3 倍，防止长条卡撞到邻居
- **fit**：缩进原卡片框，绝不重叠。用于 20 个排得紧的模板（`ADAPT_MAP`，在 `engine/core.js`）：focus-slider、mosaic-marquee、bento-reshuffle、column-drift、flip-grid、grid-reveal、spotlight-zoom、ticker-loop、ticker-tilt、glow-sweep-grid、grid-dive、lens-orbit、spread-columns、spread-rows、triple-scene、pop-grid、wheel-spin-bottom、feed-scroll、pop-parade、stairway
- **ratio**：模板自己按主比例排（planet-rings：图片切成竖条贴在球面上）
- **整屏卡片**（盖满留白后画面、无倾斜的卡）：按 `fit` 处理，模糊底 = 同一张图放大 + 模糊 + 压暗垫在下面
- **不换形**：手机 / 电脑样机屏幕、拼图切片（`uv` 子区域）、文字卡、光效卡、纯色卡；这些按焦点裁切

模板作者可以在模板里写 `adapt: 'area' | 'fit' | 'ratio' | 'none'` 覆盖默认。

## 实测（`node tools/probe-adapt.mjs`）
不开浏览器，直接跑 100 个模板的排版函数，16:9 画面 × 1:1 / 4:3 / 16:9 / 9:16 四种素材 × 8 个时刻，统计图片可见面积、同层卡片重叠增量、出画增量。结果见 `docs/qa-v10.md` 的 v10.2 节。

## 已知限制
- 拼图类（split-reveal、word-slot-roll、hero-reel 拼贴段）和手机样机仍会裁切，靠焦点
- 比例差异很大（9:16 进 16:9 画面）时，整屏模板的模糊底会占画面左右大块，这时建议画面比例跟素材
- 换形按卡片中心缩放；少数以边缘对齐的布局（底部对齐的条）边缘会略有移动
