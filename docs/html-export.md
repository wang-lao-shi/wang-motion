# 交互网页导出（v10）

单个 `.html` 文件，双击（file://）即可离线播放，不需要服务器和网络。

## 生成

```bash
wm html <id> [通用选项] [--intro stagger|whole|none] [--speed 0.75]
        [--controls false] [--autoplay false] [--all-batches --batch-size 12] [--batch 0]
        [--img-max 1024|1600|orig] --out show.html
```

- 默认入场：`--intro` 或 spec 的 `intro.mode`，都没给时是逐张（stagger）；`none` 表示打开时直接循环
- `--autoplay false`：显示中间的播放按钮，点击后才开始
- `--controls false`：不显示控件（适合嵌进展会屏 / kiosk）
- 图片按长边 `--img-max` 重压为 JPEG q86（带透明通道的 PNG 保留 PNG），`orig` 嵌原图
- `--batch-size N`：图片多于 N 张时像网页那样分批（最后一批向前补满）；`--all-batches` 把所有批次都嵌进去，网页里可切换
- 视频素材会被跳过（只嵌图片）
- 网页端：导出面板选「交互网页」，选项相同，导出前显示预估大小

## 文件里有什么

- 引擎：`engine/player/wm-engine.min.js`（engine + 100 模板 + three.js）gzip + base64 内嵌，约 0.42 MB，加载时用 DecompressionStream 解压（Chrome / Edge / Safari 16.4+ / Firefox 113+）
- 播放器：`engine/player/player.html`（唯一一份模板，`wm html` 和网页 App 都从这里读）
- 数据：`<script type="application/json" id="wm-data">`：模板 id、参数、背景、速度、入场设置、图片批次（data URL）

## 网页里的功能

| 操作 | 按钮 / 快捷键 |
|---|---|
| 逐张 / 整体入场切换 | 左起第 1 个按钮 |
| 重播入场 | 第 2 个按钮 / R |
| 播放 / 暂停 | 空格 |
| 调速 0.1–8× | 速度按钮（对数滑杆 + 预设）/ - / = / 0 复位 / 在按钮上滚轮 |
| 拖动进度 | 进度条（橙色段 = 入场，绿色 = 一圈循环） |
| 切换批次 | ‹ › |
| 全屏 | F / 全屏按钮 |
| ← / → | 后退 / 前进 1 秒 |

控件在右下角，鼠标 2 秒不动自动隐藏。连续 1 秒低于 45 fps 时自动降低渲染精度（100% → 75% → 50%，会提示「流畅模式」），恢复流畅后再升回去。

## 自测

```bash
node tools/test-html.mjs show.html --shots /tmp/shots    # file:// 打开，点遍所有控件，收集报错
```

## 重新构建

改了引擎或模板后：`node tools/build-bundle.mjs`（需要 esbuild）。网页 App：`node tools/build-web.mjs <基础 index.html> <输出 index.html>`，会注入新引擎、播放器模板和 `web/v10-addon.*`。
