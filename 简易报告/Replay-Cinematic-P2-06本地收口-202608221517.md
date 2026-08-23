# Replay Cinematic P2-06 本地收口

## 一句话结论

`P2-06 / P-REPLAY-CINEMATIC-V1` 已完成本地实现和机器验收：Replay 现在具备三层 2.5D 电影式演出、可逆 GSAP Timeline 与静态回退，同时不触发 AI、solo 票据或正式奖励副作用。状态保持 `LOCAL_ONLY / NOT_RELEASED / RELEASE_EVIDENCE_PENDING`。

## 做了什么

- 新增 background / midground / foreground 三层 Replay 表现和 idle / overview / playing / paused / seeking / result 六态生命周期。
- 复用 CameraSystem 的 overview、focus、result 语义镜头，seek 会从权威 Replay 事件重建目标状态。
- 新增独立懒加载 GSAP Timeline Adapter，只消费 transform/autoAlpha，并支持 kill、settle、dispose。
- 修正事件数量进度偏差、关闭清理、滚动锁、Escape、焦点恢复和页面隐藏生命周期。
- Replay 模式明确禁止本地 AI、solo match ticket、普通 `onEnd` 奖励流程。

## 用户现在能看到什么

当前本地源码已具备 Replay overview、逐事件节拍、暂停、拖动定位和结果收束的分层表现；GSAP 不可用、reduced-motion、forced-colors 或页面隐藏时，会直接呈现稳定的静态关键帧与现有 DOM/Canvas 游戏画面。

## 还没做什么

- 尚未完成与当前构建绑定的浏览器可见 Replay 全流程复核。
- 尚未执行第二浏览器、物理 Android/iPhone/Tablet、真实网络整形和低端性能验收。
- `GAME-031` 仍是 partial：Tetris 规则级 Replay、Tank 权威时间轴、五子棋/飞行棋完整权威事件尚未补齐。
- 没有修改 Replay 服务端事实、协议、TTL、可见性或分享权限。

## 验证

- `node qa/replay-cinematic-v1.js`：通过，6 状态 / 3 层 / 静态 fallback / 权威边界均成立。
- `npm run test:visual-25d`：通过。
- `npm run quality:gates`：通过。
- 隔离端口 `COSMETIC_PROFILE_PORT=19445` 的完整 `npm test`：退出码 0。
- `node qa/brief-report-contract.js`、`node qa/approval-gate-policy.js`、`git diff --check`：通过。
- `node scripts/build.js --check`：通过。

## 风险与下一步

- P2-07 继续保持 `FROZEN_OPTIONAL_EXPERIMENT`，不恢复 Three.js/GLB 第二运行时。
- 下一可执行美术单元是 `P2-08 / P-AUDIO-SPECTRUM-ART-V1`，只做主题音效与视觉反馈的表现闭环；音频权威、浏览器解锁、静音和生命周期必须继续由既有 Audio Runtime 管理。

## 发布状态

当前本地聚合构建为 2,075,347 characters / 2,090,098 bytes / SHA-256 `BFAEEEE42AC6F191A15EBC258DE55D858AA717B4539E9F299DC48B66B0E880D8`。未 commit、未 push、未触发 GitHub Pages、Render 或生产数据写入。

## 追溯入口

- `art-source/platform/replay-cinematic-v1/`
- `art-source/production/ghost-game-art-program-v1/P2-06_LOCAL_ACCEPTANCE.md`
- `public/src/core/29-replay-cinematic.js`
- `public/replay-cinematic-entry.js`
- `qa/replay-cinematic-v1.js`

## 阶段百分比

- 美术生产总计划：27/33 = 81.82%。
- P0：12/12 = 100%。
- P1：9/9 = 100%。
- P2：6/12 = 50%。
- P2-06 本地实现与机器证据：100%；当前构建浏览器可见、真机、真实网络、发布：0%。
