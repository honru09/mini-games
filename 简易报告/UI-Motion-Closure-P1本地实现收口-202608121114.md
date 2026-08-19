# UI Motion Closure P1 本地实现收口

时间：2026-08-12 11:14（Asia/Tokyo）

## 结论

Home / Games / Playline / Profile 已完成第一条正式 DOM GSAP 路由动效纵切，状态为 `LOCAL_IMPLEMENTED / VERIFYING`，不是浏览器或真机视觉 verified。线上仍是 `da3d05c`，本批未提交、未推送、未部署。

## 实现

- `GhostRouteMotion` 外部 Interface 只有 `transition / settle / dispose / snapshot`。
- 路由认证、连接、hash、aria 和业务 renderer 始终同步提交；首次 lazy-load 只预热后续转场，不延迟或闪回当前页面。
- 后续不同 route 使用 `committed → enter → settled` 单 timeline，对 route root 与最多 11 个语义分组做 360ms 内的 transform/opacity 分层进入。
- 目标页全程可点击、可聚焦；hidden、`aria-hidden`、`inert` 同步。
- generation、单 loader promise、sticky failure、旧 handle 隔离、认证/注销、后台、Game Shell、reduced-motion 和 dispose 均安全 settle。
- GSAP `3.15.0` DOM ESM 图为 `index.js / CSSPlugin.js / gsap-core.js`，官方来源和 SHA-256 已固定；Gomoku 继续使用独立 core-only 图。
- SW 升级 v4，两条 GSAP/Three island 都不进入安装 shell，只按需缓存。

## 主审纠正

1. 识别 core-only GSAP 无 CSSPlugin，不能直接驱动 DOM transform/autoAlpha。
2. timeline 必须在本地 context 创建，每个 handle 只能 kill 自己的 timeline。
3. 删除入口重复 CSSPlugin 注册，由官方 index 唯一注册。
4. 否决 120ms 延迟 route commit：它会破坏现有下一帧 focus 和同步导航兼容；通过 Change Request 改为同步 commit + 新页进入。
5. 子分组不用 `autoAlpha:0`，改为 opacity 0.15，保证控件全程可见/可聚焦。
6. 移除转场期间 pointer blocking 与 layout containment。
7. 修正 Gomoku cache QA 的合法版本升级兼容，同时继续拒绝两条大模块进入安装 shell。

## Terra Max

按要求多次创建 `gpt-5.6-terra / reasoning_effort=max` Builder 和 Reviewer，均未在限定执行内返回文件或可用结论；已中断且没有采用任何不可审阅结果。最终实现、修正、集成与审核由主负责人完成。

## 测试

- `npm run test:route-motion`：Contract 18、Bridge Runtime 17、Adapter 11、ESM Graph 16、Cache 4，全部通过。
- `npm run test:i18n`、`node qa/dom-smoke.js`、Hub IA、Ghost Shell：通过。
- `npm run quality:gates`：通过。
- 完整 `npm test`：通过，176.6 秒。
- 双构建稳定：1,312,603 characters / 1,327,152 bytes；SHA-256 `1C802828EF5E799358F8199163428AD2BFBC5572CD90997999E82EC80B887DF3`。
- localhost entry、GSAP index/CSSPlugin/core：HTTP 200，`text/javascript`。

## 未执行与下一步

- in-app Browser 在插件初始化前仍返回 `Transport closed`，可见路由转场、visible reduced-motion、第二浏览器、手机/平板和低端 FPS 均为 `NOT_EXECUTED`。
- 下一 CLOSE 批按既有路由进入 UI-037 / ART-020 / ART-021 的身份、Avatar 与动态背景表现收口；未审批素材继续 source-only/default-off，不把 DOM route motion 引入 Game Shell 输入。
