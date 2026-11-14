# 入场与调速（v10）

## 时间轴

```
墙钟 T ──► 模板时钟 τ = T × speed
            ├─ 入场   τ < dur          画面定格在起始姿态，卡片按计划逐张 / 整体就位（P = τ / dur）
            ├─ 停顿   τ < dur + hold   定格，已成形
            └─ 循环   t = phase0·D + ramp(τ − dur − hold)   原动效，无限循环
ramp(x) = x² / 2R（x < R），之后 x − R/2      R = 0.4 s（--intro-ramp / --no-ramp）
总长 = (dur + hold + R/2) / speed + N × D / speed
```

- 速度作用于整条时间轴：0.5× 时入场 2.5 s 变成 5 s，16 s 一圈变成 32 s
- 不开入场时 `t = T × speed`；speed = 1 时 CLI 和网页都直接走 v9 的 `renderAt`，逐像素一致
- 引擎接口：`engine.renderAtTime(T, fps)`（异步，含视频同步）、`engine.renderTimeSync(T, fps)`（同步，网页 / 播放器用）；原 `renderAt(t)` 不变。时间换算在 `engine/intro.js` 的 `timelineInfo / timeMap`

## 入场层（engine/intro.js）

挂在 `core.js` 的 `layoutFrame` 里：模板 `layout()` 算完卡位之后、样机展开（expandDevices）之前统一处理，100 个模板都不用改。

1. **分组**：普通卡 / 光效卡（`light`）/ 镜面倒影（`mirrorY`，跟随同图最近的本体）/ 样机（`device`，整张入场）
2. **可见性**：相机投影卡片中心在画面内（±4%）、正面朝向相机、投影尺寸 > 画面高 1.2%。背面和画面外的卡随最后一张一起淡入
3. **顺序**：index（模板给出的顺序）/ center（到画面中心的距离）/ ltr（屏幕 x，再按 y）/ random（mulberry32，`--intro-seed`）
4. **节奏**：单卡时长 `d = clamp(dur × 0.35, 0.25, 0.8)`，间隔 `(dur − d) / (n − 1)`，卡再多也不超时
5. **方式**（都在相机空间做，球体、隧道里同样成立）：
   - rise：沿相机上方向下沉 9%（按距离缩放）再上浮，淡入
   - fly：沿视线推远 2.2 倍再拉回（屏幕位置不变，由小变大），淡入
   - pop：缩放 easeOutBack 回弹
   - flip：绕卡片自身 Y 轴 90° → 0°
6. **附加层**：粒子、模板后期（glitch / 闪白 / bloom / 漏光 / 色调）、叠加标题和 Logo 在入场最后 20% 淡入（整体入场是后 45%）
7. **退化**：起始姿态可见卡 < 3 → 自动整体淡入。结果预先算在 `engine/intro-compat.js`（`wm intro-compat` 重新生成），`wm info` 和网页都读这张表

## 起始姿态

默认相位 0。下面 7 个模板相位 0 是空场或半成形，`START_PHASE` 改从成形姿态入场：

| 模板 | 起始相位 |
|---|---|
| grid-reveal | 0.5 |
| cascade-drop | 0.7 |
| bloom-belt | 0.2 |
| fan-shuffle | 0.4 |
| sweep-ring | 0.7 |
| triple-scene | 0.45 |
| mosaic-reveal | 0.125 |

单次可用 `--intro-phase` 覆盖。

## 不适合逐张入场的模板（自动整体淡入）

carousel-flow、cover-flow-vertical（1:1/16:9 下同屏只有 1 张完整卡）、phone-scroll-feed、glitch-cut-slideshow、light-leak-cuts、prism-converge、flyby-rolodex、pop-parade、dust-hero-light、diagonal-wipe、split-reveal、stripe-reveal、center-stage、zoom-parallax、card-toss、poster-burst、spin-zoom、whip-pan、zoom-punch 等全屏幻灯 / 转场类。最新名单以 `wm info <id>` 的 `intro.stagger` 为准。

## 检查方法

```bash
wm sheet card-globe cover-flow --intro-frames 6 --res 300 --out /tmp/intro.jpg   # 入场过程（最后一帧是进入循环后一点）
wm still card-globe --intro stagger --at-time 0.5,1.5,2.5,3.2 --res 480 --out /tmp/g.png
```
