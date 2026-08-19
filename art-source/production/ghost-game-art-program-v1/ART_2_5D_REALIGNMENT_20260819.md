# Ghost Game 美术生产 2.5D 重排记录

状态：`ACTIVE / ART-SCOPE-REALIGNED / LOCAL_ONLY / NOT_RELEASED`

## 当前裁决

2026-08-19 用户明确把平台视觉主线从“六款游戏全部继续扩张 Ghost3D”改为“Vanilla DOM + CSS + Canvas + GSAP 的共享 2.5D 空间语言”。现有 Ghost3D/Three.js 代码、回退与历史证据冻结保留，不删除、不继续扩张，也不再作为美术生产的必经消费者。

本记录只改变美术交付和消费优先级，不改变六款游戏、Rule、Authority、Protocol、AI、联机、Reward、Replay、Economy 或数据事实。

## 美术交付的新默认形态

每个受影响资产族优先交付：

1. 可拆分的 `background / midground / foreground` 三层母版。
2. 透明 PNG/WebP/SVG 原子、棋盘/卡面材质、接触阴影、光晕、遮罩和局部语义 VFX。
3. Desktop/Mobile 裁切、静态海报、reduced-motion 与低带宽版本。
4. 不烘焙规则文字、数值、棋盘网格、计时、进度填充或聊天正文。
5. 由 GSAP Core/Timeline 消费的状态素材；高频鼠标跟随不生成逐帧图，不把美术帧序列当作镜头状态机。
6. `2.5D Runtime -> 既有 DOM/CSS/Canvas -> 既有静态资产/Unicode` 的回滚链。现有 Three Renderer 只保留为可选实验消费者。

GLB、复杂模型、骨骼和完整实时 3D 场景不再是当前 33 单元的默认完成条件。`P2-07` 保留原 ID 以避免需求消失，但冻结为 Demo 证据不足后才可重新评估的可选实验。

## 已完成单元的影响

| 单元 | 处理 | 结论 |
|---|---|---|
| P0-01 Auth/Launch | 不变 | 已有桌面/移动与静态 fallback 可直接作为 2.5D 前中景消费者。 |
| P0-02 Platform Scenes | 消费优先级提升 | `far/mid/foreground` 直接成为 DepthScene 三层；不重新生成。 |
| P0-03 Game Stage Shared | 消费语义调整 | Shell、灯、环、徽章和语义 VFX 由 2.5D Stage 首选消费；不改变事件语义。 |
| P0-04 Modal | 不变 | Modal 插画不参与镜头权威。 |
| P0-05 Loading State | 不变 | 静态/reduced-motion/低带宽链继续成立。 |
| P0-06 Gomoku | 成为首个 Demo 美术基线 | 棋盘、棋子、材质、最后一步与结果 VFX 优先进入 CSS/Canvas 2.5D；Three 仅兼容。 |
| P0-07 Ludo | 推广顺序第二 | 飞机、路径、骰子、领奖台按透明原子与层级运动消费；不要求 GLB。 |
| P0-08 Honru Context | 消费入口增加 | 已确认 Honru 不改形象；现有状态可用于空间导航、进入、结果与 attention，眼睛跟随由代码完成。 |

这些单元的资产、SHA、所有者清除、进度百分比和发布状态不回退。

## 未开始单元的影响

- `P0-09` Reward/XP/成就/任务/G Coins：顺序与范围不变；反馈原子按 2.5D 前景飞入、接触阴影、光晕和静态等价态设计。
- `P0-10` Player Character：继续七槽透明分层；不要求骨骼/GLB。
- `P0-11` Avatar Frame/Effect：继续 44/64/96/192 与 reduced-motion；只做有界前景效果。
- `P0-12` Game Icon：选中态明确为 2.5D 卡片前景原子。
- `P1-01..P1-04` 四款剩余游戏：统一交付棋盘/井/Arena 的前中后景、透明实体原子、接触阴影与局部 VFX；不交复杂 3D 场景。
- `P1-08` Honru Edge/Cursor：收口为 `idle / hover / attention / enter-game / result`；保持已确认头顶、脸、双脚和 Q 版幽灵手，不再重绘人物手或替换形象。
- `P2-04` Personal Home Scene、`P2-05` Spectator Camera、`P2-06` Replay：改为 2.5D 分层与镜头预设/Timeline 消费。
- `P2-07` GLB Character/Prop Expansion：`FROZEN_OPTIONAL_EXPERIMENT`；只有 Gomoku 2.5D Demo 在包体、FPS、内存、输入、a11y 和视觉目标上有可复核缺口时才重新冻结范围。

## GSAP 与性能边界

- 单次浮起、倾斜、回弹、视差使用 transform/autoAlpha；不高频动画 `top/left/width/height`。
- 高频指针跟随复用 `gsap.quickTo()` 或当前 RAF/CSS 变量适配器，不在每次 pointermove 创建新 Tween。
- 进入、结果、退出使用可逆、可 `kill()` 的 Timeline；离开页面、切换状态与 reduced-motion 时清理。
- 美术只提供可视原子，不把 Timeline、Camera Mode 或游戏语义烘焙进图片。

## 不变边界

- 已确认 Honru 形象不改；P0-08 仅沿用现有母版和 Q 版幽灵手。
- 外部 `EXTERNAL_REFERENCE_ONLY / blocked-license` 许可与 runtime 禁止状态不变；受控 Skill reference lane 继续逐输入登记。
- 当前结论不构成 commit、push、Pages、Render、生产数据或发布授权。
- 浏览器可见、第二浏览器、真机和真实网络仍分别保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`，不能由文档或静态合同冒充。
