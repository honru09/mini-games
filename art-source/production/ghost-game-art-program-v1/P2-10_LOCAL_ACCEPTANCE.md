# P2-10 Local Acceptance

- Unit: `P2-10 / P-TOURNAMENT-BROADCAST-OVERLAY-V1`
- State: `implemented_owner_cleared_release_evidence_pending`
- Runtime: 管理员赛事弹层中的 Ghost-native 状态、等待首轮/正式轮次、领先者和最多三桌赛况
  Overlay；只消费现有权威 `tournament_state` 的三语展示投影。
- Motion: 本地懒加载 GSAP Core/Timeline 只使用 transform/autoAlpha；只有 `live` 信号点执行
  有限脉冲，waiting/complete/finished 静态；hidden/reduced-motion/destroy 全部清理。
- Art: 启用态复用 P1-06 `card-tournament` 作为 decode-gated 背景；失败保留代码原生 Ghost
  背景，flag 关闭或模块失败回到既有单图卡。
- Accessibility/i18n: 宿主复用统一命名 dialog、焦点圈、Escape/backdrop、焦点恢复和滚动锁；
  打开期间切换语言会从稳定赛事状态重渲染。
- Authority: 不创建视频/音频流、直播推流、录制、Replay、延迟缓存、观战权限、赛事操作、
  Room/Rule/Protocol/Reward/Chat/Analytics/Supabase；普通玩家入口继续默认隐藏。
- Requirement status: `GAME-028` 继续保持 `planned / FUTURE_EXPANSION`，本单元不将装饰
  Overlay 冒充高级延迟观战、反串通或播放控制能力。
- Review: 本地 1200×630 主板和 zh-CN/en-US/uk-UA contact sheet，只含虚构展示字符串。
- Local evidence: `npm run test:tournament-broadcast-overlay`、i18n、Overlay/Dialog、Tournament、
  Quality Gates、隔离端口完整 `npm test`（`NPM_TEST_FINAL_PASS_P2_10_CURRENT`）与确定性构建。
- Final local build: `2,128,980 characters / 2,143,738 bytes / SHA-256
  6D00D5BEE45D9F19A2707F0211E9E8C257A3D28585718A0D23A5D0F95229EAEB`。
- `NOT_EXECUTED`: 当前构建真实赛事 Runtime 浏览器矩阵、第二浏览器、物理设备、真实网络、
  低端性能、真正媒体直播和发布部署。
