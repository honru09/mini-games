# Ghost Game 技术优化主线 P0 需求冻结

状态：`AUTHORIZED / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## 用户授权

2026-08-16 用户明确将此前长需求中的技术优化与“机器可完成 Gate 自动解除”升级为正式授权。该授权加入既有总指挥，不重排 `CLOSE → PROVE → DATA → ART → PARITY → LOOP`，也不授予 commit、push、Pages、Render 或生产数据写入权限。

## 原子范围

1. `GAME-013 + TECH-030/TECH-044` Acceptance Gap/Shared Repair：Tank 专用 WebSocket revision/frame 增量状态同步、紧凑数值编码、全量快照恢复、协议协商和滚动回退；不泛化或替换全站 JSON 协议。
2. `GAME-044` Acceptance Gap：Tank 本地输入预测、服务端 Authority reconciliation、插值与误差预算；不改变服务器权威。
3. `TECH-049/TECH-033/TECH-034` Shared Repair：Renderer 资源生命周期治理、已有固定容量 Instancing、Dynamic DPR、Context Loss 与永久 DOM/2D fallback。当前没有获批纹理，不为了“用 Atlas”虚构 Atlas 工作。
4. `GAME-037/GAME-038/GAME-014/GAME-044` Acceptance Gap：震动生命周期、Tank 左右声像，以及 Tetris/Tank 50–100ms 有界语义输入缓冲；全部可关闭、可降级、不阻塞输入。
5. `GAME-005/GAME-007/GAME-010/GAME-016 + TECH-033` Acceptance Gap：五子棋/象棋 Worker AI、Zobrist 置换表与版本化开局库；输出仍只能落入合法候选。
6. `TECH-044 + ECO-004/ECO-005` Acceptance Gap：APM、Action Entropy 与互动率反刷，先 shadow/audit，再校准，最后才允许单独评估 Reward Eligibility。
7. `TECH-023/TECH-024/TECH-025` Acceptance Gap：客户端脱敏环形诊断、Desync/异常 envelope、预算与隐私边界。
8. `TECH-033 + TECH-039` Acceptance Gap/ADR：首屏 Core 与游戏模块按需加载、可回滚 Loader、Service Worker 安全预热和 deterministic build。
9. `TECH-040/TECH-052 + TECH-039` Shared Repair/ADR：Server/WebSocket 深模块拆分、隔离 Adapter、测试分组/并行和构建效率；行为与协议保持兼容。T7 已完成 Operational Metrics → Auth/Profile → Room/Presence → Match Protocol → Chat/Playline、Reward/Economy outbox、Node fresh-child、P6 Operational Metrics Clock/Timer、P7 Reward/Progression Projection、P8 六 Boundary 显式 now、P9 Room Graph Recovery、P10 Ephemeral Cleanup、P11 Reconnect Lifecycle 与 P12 Heartbeat Sweep Timer；后续仍按 owner 迁移正式 token TTL、其余 lifecycle/outbox/gameplay/transport deadline。

移动 Thumb Zone、`touch-action` 冲突处理、44px、三语文本伸缩、字体/Glyph 与 tabular number 属于 `UI-027/UI-029/UI-030/UI-031` 的 Acceptance Gap，不新建重复 Requirement。当前发现的全局 `maximum-scale=1,user-scalable=no` 属于 `UI-030` Defect，必须先修复。

## 不在本批直接完成

- 未经版本协商直接替换现有 JSON 协议。
- 用客户端预测替代 Tank Authority，或让 Renderer 写入 Rule/Replay/Reward。
- 在没有量化误报率前用熵分数扣奖励、封号或处罚。
- 把聊天正文、密码、token、完整玩家输入或任意 PII 放入遥测。
- 未实测就宣称“包体降低 70%”“Draw Call ≤15”“主线程永远 60fps”。这些都是测量目标，不是当前事实。
- 用一个浏览器、CSS viewport 或模拟网络解除第二浏览器/真机/真实网络 Gate。

## Gate 自动推进规则

- 哈希、协议兼容、内存上界、对象池、fallback、context loss、Worker 取消、隐私脱敏、a11y、i18n、reduced-motion、静态/VM/E2E、确定性构建和本地浏览器证据：机器自动执行、失败自动修正并重验。
- 第二真实浏览器、物理 Android/iPhone/Tablet、真实网络整形、真实 Supabase/多实例：环境可用后自动执行；不可用时只保留对应缺口，不阻塞其他工作。
- 原创 Ghost-native 美术按 `OWNER_AUTHORIZED_ART_CLEARANCE` 开放开发与未来发布候选；人工清稿、独立自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 仅为可选咨询，未执行时不得伪造成 PASS，也不得再阻塞施工。

## 权威边界

`Rule / Authority / Reward / Replay / Social / Persistence` 是事实源；预测、插值、动效、音频、触觉和 3D 只消费已批准的语义事件。所有新协议必须 capability 协商、版本化、有限缓冲、可观测、可回退并同步服务端/客户端/注册表/专项测试。
