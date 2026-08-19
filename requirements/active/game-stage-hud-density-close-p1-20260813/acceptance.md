# Game Stage 共享 HUD / 状态密度 CLOSE P1

本地已完成：六款 Game Stage 命令区新增统一 State Strip，固定模式、连接、观众三类信息优先级；`setStatus()` 统一写入 `data-stage-status-kind`，共享状态栏具备 live region 与终局/思考/连接/警告语义样式。状态变化通过懒加载 GSAP Core/Timeline 表现桥提供轻量 pulse，仅动画 transform/opacity/autoAlpha，页面隐藏、reduced-motion、离开或销毁时即时降级并清理。

已验证三语言 key 集合、专项 HUD 合同、语法、构建和既有质量回归。2026-08-14 的真实 Chromium 复核发现 DOM GSAP adapter 使用 core-only 入口时会产生 `y/scale/autoAlpha/clearProps` 警告；现已改为官方 `index.js` DOM 入口并显式要求 CSSPlugin。同期将 Three r185 的弃用 `PCFSoftShadowMap` 改为 `PCFShadowMap`。专项、六款过程链、沉浸 Shell、快速质量门禁与完整 `npm test`（175.9 秒）均通过；双构建稳定为 1,362,068 characters / 1,376,602 bytes / SHA-256 `BFBD2109B77B1F4C5E070DAB6B98C806E25AD621ACBE3E2E83AD5C5FB7130CAE`。浏览器连接在重建后不可用，修复后的可见控制台复核仍须执行。

外部门禁仍未执行：最新本地浏览器可见复核、第二桌面浏览器、Android/iPhone/Tablet、真实网络整形、visible reduced-motion 与低端 FPS。线上保持冻结，不提交、不推送、不部署。
