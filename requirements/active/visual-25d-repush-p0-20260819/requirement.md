# Ghost Game 2.5D 表现重推 P0

状态：`ACTIVE / LOCAL_ONLY / NOT_RELEASED`

来源：用户 2026-08-19《Ghost Game 2.5D 游戏重推指南》，附件 SHA-256
`E6FD38CE8338CBFCCFD76AEE54932C088DE398386CBAB090B9813229D89397E7`，并与
`art-source/production/ghost-game-art-program-v1/ART_2_5D_REALIGNMENT_20260819.md` 对齐。

## 目标

把当前表现主线从“六款游戏继续扩张 Ghost3D”重排为“六款游戏共享一套 2.5D 空间语言”：
Vanilla DOM/CSS/Canvas 为生产基础，GSAP Core/Timeline 为可清理动效适配器，Three.js/Ghost3D
仅保留冻结的可选实验层。

## 首个 Demo

真实流程固定为 `Home → Games → Gomoku → Result → Games`：背景三层视差、卡片浮起/倾斜、
Honru 眼睛跟随与飞入、页面推入/拉远、Game Stage 聚焦、落子冲击、结果节奏和返回回收。
规则、AI、联机、奖励、Replay、协议、数据和现有 Game Stage 不重写。

## 范围

- IN：`DepthScene`、Camera System、页面转场、Honru 2.5D 行为、语义 Game Stage 事件、GSAP
  性能/清理/reduced-motion 合同、Gomoku 首个可见 Demo，以及六款后续共享迁移顺序。
- OUT：React/Next、PixiJS、Rive、Unity、复杂 GLB/骨骼、全屏实时 3D、规则/Authority/Reward/Replay
  改造；现有 Ghost3D/Three.js 文件不删除、不继续扩张。

## 关联既有 Requirement

`UI-028`、`GAME-042`、`GAME-048`、`GAME-049`、`GAME-050`、`GAME-051`、`GAME-052`、
`TECH-049`、`TECH-054`。不创建重复 Requirement ID。
