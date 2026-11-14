# CHANGELOG

## v10.1 — 2026-11-14

新增：背景音乐（本地文件或网址），网页 App、导出、交互网页、CLI 同一套规则
- 网页 App：舞台和演示工具栏「🎵 音乐」弹层 + 导出面板「背景音乐」一行（上传 / 网址、音量、起始秒、淡入、结尾淡出、循环、长度跟音乐、交互网页只引用网址）；预览与演示时跟着播放 / 暂停，预览入场时从头开始；M 静音；本地文件存浏览器（IndexedDB），刷新后还在
- 导出：MP4 / PPTX / ZIP 带音轨（WebCodecs AudioEncoder，优先 AAC，不支持时 Opus）；ZIP 附原音乐文件，spec.json 写入 `audio`；GIF / 图片提示不含声音
- 交互网页：默认嵌入音乐，可选只引用网址；声音默认开启，浏览器拦截时第一次点击 / 按键即出声；拖进度、重播、换批时音乐对齐；调速不改音乐；🔊 按钮与 M 键
- CLI：`--audio file|url`、`--audio-volume`、`--audio-offset`、`--audio-fade-in`、`--audio-fade-out`、`--no-audio-loop`、`--audio-fit`、`--audio-link`；spec.json `audio{}`
- 工具：`tools/test-audio.mjs`

修复
- Windows：自动查找 Chrome / Edge 和 FFmpeg，修复本地图片等素材路径读取。
- 网页快捷键：M 控制背景音乐静音，案例图片切换改为 I，避免同时触发。
- `render --audio` 原来用 `-shortest`，音乐比视频短时视频会被截短；现在长度永远按动画算

兼容
- 不加音乐时所有输出与 v10 一致

## v10 — 2026-11-14

新增
- 统一时间轴：入场 → 成形停顿 → 原动效循环 N 圈；速度作用于整条时间轴；0.4 s 起速缓入避免「定格后顿一下」
- 逐张入场层 `engine/intro.js`：4 种方式（rise / fly / pop / flip）× 4 种顺序（index / center / ltr / random），或整体入场；挂在 layoutFrame，100 个模板零改动
- 引擎接口 `renderAtTime(T)` / `renderTimeSync(T)`；原 `renderAt(t)` 不变
- CLI：`--speed`、`--intro*`、`--no-ramp`、`render --loops/--length/--gif-once`、`still --at-time`、`sheet --intro-frames`、`wm html`、`wm intro-compat`；`wm info` 显示入场适配
- spec.json：`speed`、`intro{mode,style,order,dur,hold,seed,phase,ramp}`、`loops`、`length`、`player{controls,autoplay,imgMax,allBatches}`
- 播放器 `engine/player/player.html` + 引擎包 `engine/player/wm-engine.min.js`；工具 `tools/build-bundle.mjs`、`tools/build-web.mjs`、`tools/test-html.mjs`、`tools/test-web.mjs`
- 网页 App：调速弹出面板（0.1–8× 对数滑杆 + 预设，按钮显示「0.5× · 40 秒/圈」，- / = / 0，滚轮，记忆）、舞台「预览入场」、导出面板入场栏、交互网页格式、GIF 只导入场段 / 只播一次、关键帧含入场帧、≥4× 运动模糊、慢速自定义秒数、ZIP spec 记录速度与入场、「复制给 Agent」加 `wm html`
- 文档：docs/intro.md、docs/html-export.md，SKILL.md 新增「调速 / 入场 / 交互网页」三节

兼容
- 不开入场且 1× 时 CLI 与网页都走 v9 原代码路径：100 模板 × 3 时刻静帧与 v9 逐像素一致
- 旧 spec.json 照常可用；`--duration` 含义不变（与 `--speed` 互斥）

已知
- 19 个同屏少于 3 张卡的模板，逐张入场自动改整体淡入
- 交互网页只嵌图片（视频卡面跳过）
