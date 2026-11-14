# 背景音乐（v10.1）

一套规则，四个地方通用：网页 App 预览 / 演示、网页导出（MP4 / PPTX / ZIP）、交互网页、`wm render` / `wm html`。

## 规则
| 项 | 行为 |
|---|---|
| 起点 | 入场第 0 秒（不开入场时就是视频第 0 秒），从音乐的 `offset` 秒处开始 |
| 调速 | 不改变音乐，音乐永远原速 |
| 长度 | 由动画决定（入场 + 停顿 + N 圈）。音乐短：循环（`loop:false` 时后面静音）；音乐长：结尾 `fadeOut` 秒淡出后切掉 |
| 长度跟音乐 | `fit:true` / `--audio-fit`：圈数 = 能盖住「音乐长度 − offset」的最小整数圈 |
| 音量 | `volume` 0–1；开头 `fadeIn` 秒淡入 |
| 不带声的格式 | GIF、图片 |

## spec.json
```json
"audio": { "src": "audio/bgm.mp3", "volume": 0.8, "offset": 0, "fadeIn": 0.5, "fadeOut": 1, "loop": true, "fit": false }
```
`src` 可以是文件或 http(s) 网址。相对路径先按 spec.json 所在目录找，找不到再按当前目录。

## CLI
```bash
wm render cover-flow --intro stagger --audio bgm.mp3 --audio-volume 0.8 --out show.mp4
wm render cover-flow --audio https://example.com/bgm.mp3 --audio-fit --out full-song.mp4
wm html cover-flow --intro stagger --audio bgm.mp3 --out show.html            # 音乐嵌进网页
wm html cover-flow --audio https://example.com/bgm.mp3 --audio-link --out s.html  # 只引用网址
```
音轨：MP4 / MOV 用 AAC 192k，WebM 用 Opus。

## 网页 App 导出
- 用 WebCodecs AudioEncoder 编码，优先 AAC；浏览器不支持 AAC 时（例如 Linux 版 Chromium）用 Opus，完成提示里会说明。Opus 音轨 Chrome / VLC 能放，PowerPoint / QuickTime 可能无声，这种情况建议在 Windows / Mac 的 Chrome 或 Edge 导出，或用 CLI。
- 网址音乐导出时要读取文件，对方网站不允许跨域读取时会提示先下载再上传。播放预览不受影响。
- 浏览器只能实时录制（不支持 WebCodecs）时，视频不含声音，会提示。

## 交互网页
- 默认嵌入（离线有声），文件会变大：3 分钟 MP3 约 +4~6 MB。
- 声音默认开启。浏览器不允许网页一打开就出声时，画面照常播放，第一次点击 / 按键 / 触摸就出声。
- 音乐走自己的时钟：拖进度、重播、切入场方式、换批次时跟着跳到对应位置；调速时保持原速。
- 🔊 按钮或 M 键静音。
