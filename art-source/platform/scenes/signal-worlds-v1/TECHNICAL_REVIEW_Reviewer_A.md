# P0-02 Platform Scenes v1 — 机器技术审查（Reviewer A）

状态：`TECHNICAL_PASS / OWNER_AUTHORIZED_ART_CLEARANCE_CANDIDATE`

本记录只覆盖可复核的机器技术、路径、尺寸、字节、Alpha、Manifest、回退和生命周期合同；不冒充独立自然人 Reviewer B、IP/法律意见、人工清稿、逐资产 Golden Set 或真实设备/第二浏览器证据。

## 结果

- 4 个路由：Home / Games / Room / Playline。
- 2 个主题：light / dark。
- 2 个独立构图：desktop 1920×1080、mobile 900×1200。
- 48 个 SVG source masters（far / mid / foreground）。
- 80 个 Runtime variants（4 layers × 4 routes × 2 themes × 2 viewports，加 8 poster 与 8 mini）。
- 4 张 contact sheet 审查板（light/dark × desktop/mobile）。
- Runtime 总计 `1,259,316` bytes，预算 `4,194,304` bytes，使用率约 `30.03%`。
- far、static、poster、mini 的 WebP 无 Alpha；mid、foreground 的 WebP 含真实 Alpha chunk；逐文件证据见 `asset-family-manifest-v1.json`。

## 工程检查

`qa/platform-scenes-contract.js` 覆盖：

1. 80 条路径、SHA-256、bytes、尺寸与 WebP 结构。
2. Desktop / Mobile 变体独立存在，Poster / Mini 均为 640×360。
3. far / mid / foreground / static 的层级和 Alpha 约束。
4. Manifest allowlist、5 个 feature flags、owner clearance 与 fallback 链。
5. `prefers-reduced-motion` 静态合成、`saveData` poster、页面隐藏 / 对局中暂停。
6. 三层 decode-before-activate、迟到异步结果隔离、路径失败回退。
7. forced-colors 隐藏装饰层且不影响 HTML 内容。
8. 生成器没有外部 PSD / AI / RPG 路径或输入。

## 风险与边界

- 这是本地机器审查，不是浏览器可见验收；此前 Codex in-app Chromium 连接器报 kernel asset 写入错误，修复后的可见截图保持 `NOT_EXECUTED`。
- 不把单浏览器、静态合同或自动化结果提升为第二浏览器、真机、真实网络或发布证据。
- 资产失败、解码失败、Manifest 漂移、flag 关闭、forced-colors、save-data、reduced-motion 与页面隐藏均有可逆回退。
- 规则、Authority、协议、Replay、奖励、经济、社交和玩家事实不读取或依赖场景位图。

