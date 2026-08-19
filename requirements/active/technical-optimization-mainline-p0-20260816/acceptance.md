# 技术优化主线验收

当前结论：`T7 PARTIAL — P7 REWARD_PROGRESSION + P8 BOUNDARY_CLOCK_INJECTION + P12 HEARTBEAT_SWEEP_TIMER IMPLEMENTED_LOCAL`；保留历史合同标记：`P11 RECONNECT_LIFECYCLE_TIMER VERIFIED_LOCAL`。T0 AUTHORIZATION_AND_CONTRACT_COMPLETE，T1–T6 已完成各自声明范围。T7 已完成六个 Server Boundary、Node fresh-child、P5 Reward outbox、P6 Operational Metrics Clock/Timer、P7 Reward/Progression Projection、P8 六 Boundary 显式 now 注入、P9 Room Graph Recovery、P10 Ephemeral Cleanup、P11 Reconnect Lifecycle 与 P12 Heartbeat Sweep Timer。P12 保留访客 `close(true)`、普通超时 `close()`、AFK/赛事/resume TTL 语义，只统一 owner、单次时间采样和分域异常隔离；其余 lifecycle timer、outbox cadence、gameplay tick、transport deadline 与 `server/gameplay/metrics.js generatedAt` 仍未迁移，因此 `TECH-040` 与 T7 保持 `partial`。四窗口并行构建状态由自动生成 TECH-027 报告与 `build --check` 动态绑定；P12 的统一 Quality Gates 与完整 `npm test` 正在本批末复核，三条共享 Gate 不因本批改变，也不授予发布。

## T1 已完成（本地）

- `ClientDiagnosticsRing` 已进入构建图：默认关闭、仅内存 64 条 FIFO、5 分钟 TTL、固定事件/字段 allowlist、ID 类别化哈希、敏感字段 fail-closed、`clear/dispose` 清理；无网络、localStorage、监听器、计时器或自动外发。
- `RendererRuntimeGovernor` 与 `RendererQualityAdapter` 已进入构建图：保持 HIGH/BALANCED/LOW 静态 DPR 上限，Dynamic DPR 只在实际动画 loop 采样并由每个 Renderer Adapter 接受/拒绝，resize 合帧、单循环所有权、hidden/suspend/reduced-motion/context generation/dispose 与有限数值诊断均有测试。
- 六款 Ghost3D Renderer 已接入共享质量适配器；它只消费帧间隔并调整表现层质量，不写入 Rule/Authority/Protocol/Reward。真实 WebGL、GPU/内存、真机或跨浏览器证据仍未执行，因此 `TECH-049/TECH-034` 与三条共享 Gate 的 release 状态不变。
- Tank Renderer 的 60fps 插值热路径已移除坐标对象、`forEach` 回调与逐帧材质树遍历，改为固定池、直接坐标换算和索引循环；Authority、协议、输入、镜头语义、固定 InstancedMesh 容量和 DOM fallback 均不变。
- 证据：`public/src/core/13-client-diagnostics-ring.js`、`public/src/core/13-renderer-runtime-governor.js`、`public/src/core/13-renderer-quality-adapter.js`、`public/three/tank-entry.js`、`qa/client-diagnostics-buffer.js`、`qa/renderer-runtime-governor.js`、`qa/renderer-quality-adapter.js`、`qa/tank-ghost3d-renderer.js`、`npm run test:technical-optimization-t1`、`npm run test:tank-ghost3d`。

## T2 已完成（本地）

- `GameModuleLoader` 统一六个既有 Renderer island：固定 gameId/资源类型、完整 SHA-256 manifest、单飞加载、导出验证、失败回到 inline fallback；不创建 Adapter，不接管 Foundation，也不改变 Rule/Authority/Protocol/Reward/Replay/Social/Persistence。
- `scripts/build.js --check/--write` 提供确定性、零漂移检查与同目录临时文件 `fsync`/原子 rename；失败保留旧产物并输出字符数、UTF-8 bytes 与 SHA-256。
- `public/sw.js` 仅接受显式 `GAME_MODULE_WARMUP_V1`，固定 allowlist、同源/MIME/no-store/basic/哈希校验，渲染器缓存与 Shell/locale/API 隔离；登录、首页和安装路径不预加载 Three/GSAP。
- T2 构建的单一 Codex in-app Chromium 证据采集于 `http://localhost:8091`：五档视口 × Home/Games/Playline/Profile 20/20、六款本地 AI Game Stage、三语言、双主题、reduced-motion、forced-colors、零横溢出、零裸 key、console warn/error=0；该证据在后续构建产生后只作为 historical-as-of 保留。

## T2 验证

- `npm run test:technical-optimization-t2`：通过。
- `node qa/prove-current-build-evidence-contract.js`：在 T2 收口时通过；T2 构建为 `1,647,354 characters / 1,661,897 bytes / SHA-256 1B26D7D58DCC6B4A9BE55BE09C0D787E1B1AF08CBD6C54D4175BF73064F2D1DF`。
- `npm run quality:gates`：退出码 0。
- `npm test`：T2 收口时退出码 0；包含 pretest、完整回归、posttest、T2 专项与当时的证据合同。
- 确定性构建检查：T2 收口时输出与 T2 证据哈希一致；T3 构建产生后不再把该历史哈希描述为当前。

## T3 已完成（本地、默认关闭）

- `FeedbackBus` 只接受固定语义 cue，具有 16 条重入队列、8 个监听器、64 个 cue ID、每秒 32 条接收上限、generation 清理、hidden/reduced-effects/静音/禁震收敛和 Adapter 故障隔离；无 DOM、网络、持久化、Timer、AudioContext 或原始输入依赖。
- `GameplayInputGate` 绑定 `matchId + revision + generation + semantic sequence`，只保留 16 条 intent、64 个 ID 与 50–100ms 最大存活窗。Tetris 保留七类离散动作；Tank 使用 neutral + 八方向 + `firing:boolean` 的完整 `control_state`，不保存按键、触点或轨迹。
- Tetris 仅在显式 `gameplayInputGateV1` 且 `tetris-rule-v3` 时进入 Gate；Tank 仅在相同显式开关且 `tank-authority-v1` 时进入 Gate。两者 wire seq、Rule/Authority、Reward、Replay 和旧同步/Relay fallback 未改变。
- `LocalFeedbackAdapter` 仅在 `feedbackBusV1 + tankSpatialAudioV1` 显式开启且真实用户手势调用 `unlock()` 后创建 AudioContext；只消费 `tank_fire/tank_hit`，支持 StereoPanner 左右声像及无 panner 中心回退，最多 8 个声部，所有 WebAudio/vibrate 失败静默并在 dispose 清理。
- Tank Authority 纵切只在已接受 snapshot 显示 shots/hp/alive 变化后发出稳定 cue，避免 pointer 与 accepted action 双触发；失焦/隐藏先提交中性控制状态再 reset，重连/恢复/spectator/换局/销毁均清队列或 dispose。

## T3 验证

- `npm run test:technical-optimization-t3`：通过；包含 FeedbackBus 12 项、GameplayInputGate 11 项、LocalFeedbackAdapter 12 项及真实 Tetris/Tank 调用方回归。
- `node qa/gameplay-upgrade.js`：通过；覆盖 Tetris `move_left`、Tank 九方向+按住开火、Authority seq 不变，以及 accepted snapshot 后的正向 pan 声像。
- `node qa/tank-controls.js`：通过；摇杆/D-pad/键盘/开火、blur、hidden、destroy 保持中性释放。
- 确定性构建：`1,705,706 characters / 1,720,249 bytes / SHA-256 014E2886711070F7B14CCCDF78E981C14871536BAE32A1A6369E823A56507067`。
- 当前单一 Codex in-app Chromium 窄范围证据：568×726 下 Home/Games/Playline/Profile 四区、Tetris 七控件与 move-left、Tank D-pad/摇杆/开火与 projectile、零横溢出/裸 key、返回清理及最终 Home/zh-CN/light；浏览器表面未提供 console 捕获，因此不宣称 console=0。证据：`requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-t3-202608161627.json`。

## T4 已完成（本地、默认关闭）

- `BoardAIKernel` 是纯、确定性的 Xiangqi/Gomoku 搜索模块：固定 Zobrist hash、4096 项 LRU 置换表、版本化 opening book、合法候选/预算/节点/取消边界与候选 ID-only 输出。
- `BoardAIWorkerBroker` 只暴露 `request/cancel/dispose`；Worker wire 使用 `BOARD_AI_SEARCH_V1` / `BOARD_AI_CANCEL_V1` / `BOARD_AI_RESULT_V1`，单活跃请求、超时、崩溃、重复/迟到结果和同步回退均 fail-closed；健康 Worker 跨回合复用，取消/超时/崩溃/dispose 才终止。
- Xiangqi 与 Gomoku 只在显式 `technicalFeatures.boardAIWorkerV1`、本地 AI、非在线、非观众时启用；Worker 仅返回候选 ID，主线程重新执行合法性/空位检查并进入既有 `doMove`/`applyMove`。Gomoku 超过 200 个完整合法候选时跳过优化，不静默截断。
- 原同步搜索、DeepSeek、学习路径、在线权威和奖励/回放边界均保留；reset/restore/spectator/destroy 清理请求、Worker、TT 与计时状态。
- T4 专项：`npm run test:technical-optimization-t4`，覆盖 Kernel、Worker VM/wire、Broker 生命周期、Xiangqi/Gomoku parity 与调用方 fallback。
- 当前构建：`public/index.html` 1,785,103 characters / 1,799,646 bytes / SHA-256 `3C714ECACE20B4CAC4020B53AAFB2F5F9F68F68884D18F71BD3C826BDE3811EE`。

## T5 已完成（本地、默认关闭）

- `TankSnapshotWireCodec` 以严格 canonical `tank-authority-v1` 为唯一输入/输出，按接收者生成 `tank-snapshot-delta-v2` keyframe/delta；缺 base、错 match、旧/重复/冲突 frame、serverTick 回退、未知字段、非有限数和非法长度全部 fail-closed。弹道只改变顺序时也无损，恢复失败保留 tick 高水位。
- 服务端 `ENABLE_TANK_SNAPSHOT_DELTA_V2=0` 默认关闭；能力客户端与旧客户端可同房。重连/观众 bootstrap 继续完整 v1，新 Session 的首次 live v2 为 keyframe；断线 Session 不重建 base，同一 Authority tick 不重复广播。
- 延迟观众帧改为房间级最多 320 个共享 Timer，真正发送前重新校验 room、match、session、spectator membership marker；离开、换局和 Authority 停止后旧帧失效，不再跨场泄漏。
- 客户端 codec 已进入确定性构建图并位于 WebSocket 调用方之前；旧 match 的延迟 v1 不再重置当前 decoder。解码成功后仍只把完整 v1 snapshot 交给既有 `onAuthoritySnapshot()`。
- `TankPredictionAdapter` 默认关闭，最多 8 条未确认完整 control state，同一 client tick 最后状态生效；只输出本地玩家 x/y/d 与有限修正计划。Authority tick/ack 永远是事实，queue-full/漏记命令由可信 ack 自动 rebase；弹道、HP、墙体、击杀、排名、终局、Reward 和 Replay 均不进入模块。
- Tank 调用方只在 `technicalFeatures.tankPredictionV1===true` 且 `tank-authority-v1` 时启用：旧 `tank_input` 发送前登记预测，accepted snapshot 后消费，blur/hidden/restore/reconnect/spectator/result/destroy 清理；任一拒绝继续原有 reconciliation。

## T5 验证

- `npm run test:technical-optimization-t5`：通过；覆盖 codec/stream/client/prediction、真实 Tank 调用方、混合 v1/v2、本地 WebSocket、默认关闭 v2 的能力客户端回归、350ms 延迟观众退出、重连、协议、Authority 与受控传输预检。默认关闭专项为 `qa/tank-snapshot-default-off-online.js`，由正式用户名密码客户端验证能力声明不改变 v1 线上帧。
- T5 主审补入预测路径扫掠、frame/serverTick 双高水位与 codec 健康协商；T7 收口时构建为 1,856,788 characters / 1,871,331 bytes / SHA-256 `346622A3D69C55A4457F5D3F7A683C78AAA09A21B485C70AD22E39D552E5E914`。随后所有者清除 Honru Runtime 合并构建为 1,862,601 characters / 1,877,144 bytes / SHA-256 `3A72225B0BE9EA2ACE6FC2BA1DE1907E54928D3BC890015FEC170F059E6661CC`；两者现在都只作 historical-as-of。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络整形、低端性能、线上最新版本与真实 Supabase 证据均未执行；设备与 Supabase Gate 为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`，原创美术 Gate 为 `OPEN_BY_OWNER_AUTHORIZATION`，发布保持 `LOCAL_ONLY / NOT_RELEASED`。

并行构建状态（2026-08-19）：静态文档保留时点构建快照，当前 `public/index.html` 身份以自动生成 TECH-027 报告和当次 `node scripts/build.js --check` 为准；任何时点 SHA 都不冒充浏览器可见证据。本轮保留并行窗口接入的六款 Ghost3D default-on、exact-zero/failure fallback、美术与表现增强。

## Ghost3D Default-on 接入（2026-08-18）

- 六款既有程序化 Three r185 Renderer 已纳入正式表现层；缺少 `mg_ghost3d_*_v1` 默认启用，精确 `"0"` 回滚到原 DOM/Canvas。Renderer failure/context loss、storage 异常、LOW 和 reduced-motion 均保持安全 fallback。
- `qa/ghost3d-default-on-contract.js`、六款 Ghost3D 专项合同/layout/cache/ESM/Renderer 与 `node scripts/build.js --check` 已通过。此处仍是本地实现证据，不提升 `TECH-049` 或共享设备/网络 Gate 的 release 状态。

## T6 已完成（Tank P0、本地 shadow、默认关闭）

- `EngagementIntegrityAnalyzer` 为纯内存、固定摘要、惰性 TTL/容量上限、快照只读的 audit-only 深模块；不产生执行性 verdict。
- 服务端仅在 Tank Authority 接受动作后观察，Human/AI 分 cohort；Test Admin 与 spectator 排除，重连边界单独标记，所有异常 fail-open。
- `ENABLE_ENGAGEMENT_INTEGRITY_SHADOW=0` 保持旧行为；`=1` 只增加数值 Metrics，且在既有 result/reward 回执之后 finalize，再清理 analyzer。Reward、Replay、Analytics、Supabase、wire、capability 均未改变。
- 验证：`npm run test:technical-optimization-t6`、`node --experimental-websocket qa/engagement-integrity-online.js` 与 `npm run quality:gates` 通过；覆盖 flag 0/1 公共字段与奖励不变、重复/非法/限流不计数、Human/AI/Test Admin/spectator、生命周期与清理。
- T6 当前范围是 Tank P0；Tetris/Xiangqi/Monopoly 扩展、真实作弊真值/误报率、生产遥测与独立 Reward Policy 仍未执行。三条共享 Gate 和发布边界不变。

Action Entropy/APM 当前只允许 shadow/audit；本 Wave 绝不改 Reward、扣币或封禁。

## T7 部分完成（六类 Server Boundary + P6/P7/P8，本地）

- `OperationalMetrics` Module 外部 Interface 固定为 `capture/handle/recordError`，隐藏历史 cadence/上限、管理员鉴权与频控、告警、CSV、访问审计结果、incident 去重与 Adapter 读回净化。
- 持久化 Seam 已有两个真实 Adapter：JSON runtime Adapter 继续使用 `db.metricsHistory/db.opsIncidents + saveDB()`；isolated in-memory Adapter 持有分离状态供合同和并行 lane 使用。单一 JSON Adapter 不被冒充为可替换架构完成。
- `server/index.js` 已消费 Module result，三个 Metrics GET 路由、`metrics-v2` JSON、history、CSV、JSON fallback、启动/周期 capture、Cluster 转发及稳定错误 wire 保持不变。访问审计失败 fail-closed 为无原始异常的 500；从持久状态读回的 context/kind/count/timestamps 会重新净化，不允许 token、Infinity 或畸形值回显。
- `IsolatedServerTestGroup` 只暴露 `create().run()`：isolated lane 并行使用动态端口、独立 `DATA_DIR`、账号命名空间 helper 与显式注入 clock，shared lane 保持串行；两个真实 `server/index.js` 并行启动用于证明 harness 被实际消费。
- `IsolatedNodeProcess` 只暴露 `run/dispose`：每次 run 使用新 Node 子进程、创建时冻结的 lane 环境快照、有限 stdout/stderr、超时与 dispose 清理，并用 `hrtime` 计算持续时间。双 lane probe 证明子进程拥有独立 wall clock/module cache/PID，父进程 `Date.now`、`process.env` 与 fixture cache 不被改写；该 seam 不 monkey-patch，也不虚拟化 server 全局 `Date.now()`/Timer。
- `AuthProfileBoundary` 只暴露 `session/profile`，并提供 JSON runtime 与隔离 in-memory Adapter；既有用户名密码、旧 PIN、scrypt、30 天/五会话淘汰、注销当前 token、公开/私有 Profile、好友比较重验、Test Admin 隔离与 Supabase 队列保持兼容。
- Auth/Profile wire 未改名、未加客户端权威字段；公开投影继续移除 owned、用户名、任务、会话与经济私有数据，更新入口继续使用服务器 allowlist。
- lane clock 只被显式接收 `context.clock.now` 的 Module 消费，不替换子进程 `Date.now()` / wall clock。清理对普通目录做真实 under-root 验证，对 live/dangling symlink、junction 或 reparse path 只 unlink lane 路径项并保留 root 外目标。
- 验证入口：`npm run test:technical-optimization-t7`、`npm run test:match-protocol-boundary`、`node qa/metrics-online.js`、`node --experimental-websocket qa/security-online.js`、`node qa/technical-optimization-mainline-contract.js`、`node qa/code-health-sweep.js`、`node qa/production-readiness-contract.js`。架构决策：`requirements/ADR/003-server-boundary-adapters-metrics.md`。
- `ServerClockTimer` 深 Module 外部 Interface 仍只有 `now/schedule/dispose`；P6 迁移 Operational Metrics now/cadence，P8 复用同一 `serverNow` 将六个既有 Boundary 的显式 now 接线统一，不增加 clock Interface 或业务耦合。
- P7 `reward-progression-v1` 只暴露 `apply`，集中 profile/daily/achievement/recentResults/history/ledger/Analytics 投影；Reward Resolver、P5 outbox、daily claim、wire 与 Supabase owner 保持不变。
- 未完成：正式 token TTL、其他 Room/Tournament lifecycle、Chat/Expression delay、Reward/AI outbox cadence、游戏 tick、transport deadline 与 Metrics `generatedAt` 仍使用既有原生时间。生产 Supabase/多实例与真实性能证据也未执行；T7、`TECH-040` 和发布均不提升为 complete/verified/released。

## T7 Room/Presence 纵切已完成（本地）

- `RoomPresenceBoundary` 只暴露 `room(command)` / `presence(command)`；Room/Lobby/Presence 的 Seat、容量、membership、host transfer、reconnect replacement、隐私与心跳窗口，以及 `seat/update_ai_controllers/release_many/rehome_many` 均集中在 Module 内。
- JSON runtime 与 isolated in-memory 两个 Adapter 通过同一 Interface 工作；runtime Adapter 只观察/更新现有内存 rooms/sessions/users，不把临时房间冒充为 JSON durable persistence。Memory Adapter 深复制未知 nested graph，同时保持 Session 身份与 opaque handle 语义。
- 纯读取投影不修改 canonical graph，所有嵌套 DTO 深冻结；duplicate roomId、active canonical Session retire、目标冲突和部分写入均 fail-closed。
- 赛事 batch bind/attach 使用精确 rollback receipt，多源房释放和多目标 rehome 只能整批提交或整图恢复；Runtime Adapter fault 真实进入补偿路径。目标房 wire 在事务和 Authority 准备完成后才暴露，terminal/quarantine guard 全部 mutation。
- 离房、过期和赛事失败使用有界 retry 与单一按需 `roomGraphRecoveryQueue`；恢复成功后清 queue/timer 并刷新 Room/Lobby。canonical、stale、非目标与 Bye spectator 同步清理，统一发送 `spectate_left`。
- 重复 `select_game` 选择同一游戏保持 READY 幂等；match reset 先提交 READY reset，再停止 Authority/清局内状态，避免投影与 canonical 状态错序。
- `server/index.js` 的消息类型、错误 reason、Seat 递增、容量 2–5、spectator、Test Admin/Block、结算、Authority、广播和 Supabase 兼容行为保持原样；调用方只消费成员变换和投影结果。
- 专项 `node qa/room-presence-boundary.js` 为 43 项；`qa/tournament-atomic-online.js` 为 17 项。Tournament unit/auto/auto-online/recovery、Spectator、Social Match lifecycle、Reconnect 与 E2E 的既有完成事实保留；P6 后的当前完整回归以本文件末次验证记录为准，不沿用 `324922B8…B478E6` 的旧构建身份。
- T7 后续只继续正式 token TTL 与其余 server-wide lifecycle/outbox/gameplay/transport timer 按 owner 迁移；P7–P12 与 Match Protocol、Chat/Playline、Reward outbox、Node 子进程隔离的既有本地事实保持不变。P8–P12 不虚拟化真实 Node 子进程 wall clock，也不改变 protocol、Rule/Authority、Reward 数值、Replay、Social、Supabase 或玩家 wire。

## P11 Reconnect Lifecycle Timer 已完成（本地）

- reconnect grace 到期与 `expireDetachedSession()` Presence 失败重试统一使用 `reconnect-expiry:<sessionId>` ServerClockTimer lease；`Session.leaveRoom()` 删除失败重试使用 `room-removal-retry:<sessionId>` lease。
- 每个回调先清空 Session timer 字段；恢复、成功离房和 Room/Presence Boundary 清理都经过统一 lease/native cancel 适配器；原有重试上限、退避、恢复窗口、席位与消息协议保持不变。
- `node qa/timer-audit.js`、`node qa/connection-route-resilience.js`、`node --experimental-websocket qa/reconnect-online.js`、`node --experimental-websocket qa/e2e-online.js` 均通过；P11 收口时的统一 Quality Gates 与专用端口完整 `npm test` 也已通过。

## P12 Heartbeat Sweep Timer 已完成实现（本地）

- heartbeat 从原生 interval 迁移为唯一 `heartbeat-sweep` repeat owner；访客/普通超时、房间 AFK、赛事清理和 resume TTL 共用 lease 注入的同一 `now`。
- `HeartbeatSweepIsolation.run()` 隔离单 session、room、tournament 与 resume 分域；访客通知、`close(true)` 和 cleanup 也分别隔离，错误记录失败不再让 repeat owner 失活。
- `qa/heartbeat-sweep.js` 用 Manual Clock 动态证明首 tick 故障后同 tick 后续操作和第二 tick 仍执行，并锁定 guest `close(true)`、普通 timeout `close()` 与最终零 pending；Timer Audit 改为 heartbeat block 内静态合同。
- ServerClock/Heartbeat、T7 focused、Room/Presence、Ghost Auth、Connection Route、Reconnect、Tournament unit/Auto/Atomic/Recovery 与独立端口 E2E 均通过；统一 Quality Gates 与完整 `npm test` 待本批末更新。

## T7 Match Protocol 纵切已完成（本地）

- `MatchProtocolBoundary` 固定 `command(input)` / `transition(input)` seam，覆盖 Tetris/Xiangqi/Monopoly v2 action 与 timer transition；Rule Authority 继续拥有合法性、局面和结果。
- JSON runtime 与 isolated memory/runtime Adapter 共享 detached `load/save/commit` contract；journal 有界，不新增玩家持久字段、Supabase 表或 Reward/Replay 能力。
- match/generation/authority/member/session、sequence duplicate/stale 与 event revision fences 在 Authority 前 fail-closed；异常 reason 脱敏并映射稳定 `gameplay_error`。
- effect ordering 固定 metric → turn/audit → broadcast → terminal settle/stop；终局幂等，非法 terminal order/late timeout fail-closed，Adapter/Authority fault 恢复 room 与 Authority checkpoint/local state。`server/index.js` 的真人、AI 与 timer 路径统一接线，旧 inline fallback 保留滚动兼容。
- `node qa/match-protocol-boundary.js` 与 `npm run test:match-protocol-boundary`：21/21 通过。该纵切仍为 LOCAL_ONLY / NOT_RELEASED，不代表真实浏览器、设备、网络、Supabase、多实例或生产证据。

## T7 Server Clock/Timer P6 已完成声明范围（本地）

- `server/boundaries/server-clock-timer.js` 以 `now/schedule/dispose` 小 Interface 隐藏真实 Node handle、owner replacement/generation、cancel/dispose、异常隔离与 Manual FIFO/catch-up；Node 与 Manual 两个 Adapter 使 seam 可替换且可确定性验证。
- `server/index.js` 在 P6 当时只把 Operational Metrics 构造 `now` 与 `metricsHistorySweep` cadence 接入该 Module，并在正常 close 与 bootstrap failure 释放；P8–P12 后续已分别迁移六 Boundary 显式时间、room recovery、guest cleanup、reconnect/room-removal 与 heartbeat owner，其余 owner 仍未迁移。
- 专项入口为 `npm run test:server-clock-timer`、`node qa/timer-audit.js`、`node qa/server-boundary-adapters.js`、`node qa/metrics-online.js` 和 `npm run test:technical-optimization-t7`。该 P6 复用 `TECH-039/040/052`，不新增 Requirement ID。
- P6 主审后的 23 个 Clock/Timer 边界场景、Quality Gates 与完整 `npm test` 已在其记录快照退出码 0；P8 收口时当前确定性构建更新为 `0F7CD4F9…079D95`，固定为 2,070,498 characters / 2,085,121 bytes。
- 当前状态是 `FOCUSED_VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`；没有玩家可见变化，不把单浏览器矩阵冒充 Clock/Timer 正确性或外部环境证据。

## T7 Reward/Progression P7 与 Boundary Clock Injection P8 已完成声明范围（本地）

- P7：`reward-progression-v1` 的 `apply` Interface、JSON/Memory Adapter、15 项专项、Reward/Daily/完整回归与统一 `meta.at` 已完成；不重算 Reward，也不接管 P5 outbox 或 daily claim。
- P8：Auth/Profile、Room/Presence、Match Protocol、Chat/Playline、Reward/Economy 与 Reward/Progression 六个调用方统一使用 `serverNow → ServerClockTimer.now()`；Timer Audit 防止 raw `Date.now` 构造接线回流。
- P8 focused 集中回归的 T7、Reward、Daily、Security、Player Chat、Playline、Reconnect 与 E2E 均退出码 0；完整 Quality Gates、`npm test` 与确定性双构建将在本批最终收口记录中绑定。

## 每个 Wave 共同完成定义

- Requirement ID、IN/OUT、Interface、Adapter、Authority、版本、预算、回滚和 Feature Gate 已冻结。
- 正常、缺 capability、旧客户端、乱序/重复/缺基线、断线/重连、离房/换局、切账号、取消、超时和资源不足均有回归。
- 内存、队列、对象池、日志、Worker、Timer、Listener、AudioNode、WebGL 资源均有硬上界和 dispose 证据。
- 三语、44px、键盘/触控、reduced-motion、静音/禁震、后台恢复和失败 fallback 不丢状态。
- 运行专项、共享 Quality Gates、完整回归与确定性构建；玩家可见变化另需当前浏览器证据。
- 只有测量结果可写压缩率、Draw Call、FPS、内存、误报率与延迟；目标值不冒充事实。

## Gate 自动推进

- 所有可确定性机器验证项默认继续，失败后修复并重新验证。
- 外部环境一旦连接即可自动运行对应脚本，无需逐项询问；没有环境则保留 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`，不得扩大为开发 `BLOCKED`。
- 人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE`：未执行时不得冒充 PASS，但不阻塞开发、runtime 或发布候选。自动测试和所有者清除均不自行授予发布权；commit、push、Pages 或 Render 仍必须取得当前用户的独立明确命令。
