# 技术优化深模块合同

## 设计原则

以 Depth、Leverage 与 Locality 为优先：每个模块隐藏一种复杂性，对外只暴露稳定 Interface；协议、渲染、输入、AI、奖励和诊断之间通过明确 Seam 连接，禁止共享可变内部状态。

## 模块与 Interface

### `TankSnapshotWireCodec`（GAME-013 + TECH-030/TECH-044 Acceptance Gap）

- `create(config) -> { encode, decode, forget, reset, dispose }`；服务端 `createTankSnapshotStream()` 只把 `encode` 适配为按接收者的 `encodeFor`。
- `encode(canonicalSnapshot, { recipientKey, forceKeyframe }) -> keyframe | delta`；`decode(envelope) -> canonical tank-authority-v1 snapshot | NEED_KEYFRAME`。
- 隐藏严格字段字典、独立 frameId、每 session 基线缓存、serverTick 高水位和无损 JSON patch；首批不做浮点量化。TankAuthority、`tank.js` 与 Ghost3D 永远只见完整 canonical snapshot。
- 缺基线、错 match、旧/重复 frame、未知字段、非有限数、越界索引、非法长度或版本不匹配必须 fail closed，等待/请求下一 keyframe。
- 老客户端继续 full v1；新旧客户端可同房；独立 `TANK_SNAPSHOT_DELTA_V2` 回滚不能绑到 Rule Authority v2，也不能退回 host relay。
- 延迟观众共享房间级最多 320 个帧 Timer；真正发送前复核 room、match、membership marker 与 session 存活，离房/换局/停止清理或失效。相同 Authority tick 不重复广播，避免 v1 fallback 破坏 decoder base。

### `TankPredictionAdapter`（GAME-044 Acceptance Gap）

- `submitLocalInput(command)` 仅形成可撤销的表现预测。
- `acceptAuthority(snapshot)` 以服务器 tick/ack 为事实，重放未确认输入并在误差预算内平滑修正。
- 离房、换局、重连、spectator、旧 epoch 和协议降级清空预测队列。
- 模块默认关闭、最多 8 条完整 control state；同一 client tick 只采用最后状态。调用方仍在发送旧 `tank_input` 前登记预测，所有拒绝均回到原 Authority reconciliation，不预测弹道、HP、墙体、击杀、排名或终局。

### `RendererRuntimeGovernor`（TECH-049/TECH-033/TECH-034 Shared Repair）

- 复用 Tetris/Tank 既有固定容量 InstancedMesh；其他游戏只有基准证明收益后才增加 Pool。
- 当前六款 Renderer 为程序化 geometry，无获批 Texture/Atlas；Atlas 保持 ART Gate 后置。
- `observeFrameBudget` 只输出质量建议，`QualityAdapter` 决定 DPR/阴影/粒子档位。
- `onContextLost/onContextRestored` 只切换 Renderer generation；Rule、输入和对局继续由 DOM/2D 承担。

### `FeedbackBus`（GAME-037/GAME-038 Acceptance Gap）与 `GameplayInputGate`（GAME-014/GAME-044 Acceptance Gap）

- Feedback 输入为白名单语义事件，输出为 Haptic/Audio Adapter；InputGate 只接收游戏已映射的 semantic intent，不保存原始键位/指针/触摸轨迹。
- 用户设置、浏览器能力、后台、静音和 reduced-motion/reduced-effects 可独立关闭。
- `navigator.vibrate` 和 Web Audio 失败必须静默回退；不得影响合法动作提交。
- T3 的三个模块默认关闭：`FeedbackBus` 固定 16 条重入队列、8 个监听器、64 个 cue ID 与每秒 32 条接收上限；`GameplayInputGate` 固定 16 条队列、64 个 ID、50–100ms 最大存活窗且不创建延迟 Timer；`LocalFeedbackAdapter` 最多 8 个 oscillator/gain/panner 声部。
- Tetris 只在明确 `gameplayInputGateV1` 且 `tetris-rule-v3` Authority 时把七类离散语义动作送入 Gate；Tank 只在相同显式开关且 `tank-authority-v1` 时发送完整 `control_state`（neutral + 八方向 + `firing`）。Gate 的 sequence 与既有 wire sequence 独立，旧 Battle/Relay/本地同步路径永久保留。
- Tank 左右声像另需 `feedbackBusV1 + tankSpatialAudioV1` 双显式开关；AudioContext 只能由真实键盘/指针操作调用 `unlock()` 后创建。`tank_fire/tank_hit` 只从本地事实或服务端已接受 Authority snapshot 产生，pan 由已接受的场内横坐标归一化，避免 pointer 与 accepted action 双触发。
- 换局、规则重连、恢复、spectator、失焦/隐藏与销毁分别 reset/dispose；hidden、静音、禁震、reduced-effects、缺 AudioContext/StereoPanner 与所有 WebAudio/vibrate 异常均静默，合法输入继续使用现有同步 fallback。

### `BoardAIWorkerBroker`（GAME-005/007/010/016 + TECH-033 Acceptance Gap）

- `request({gameId, matchGeneration, turn, positionHash, legalCandidates, budgetMs})`。
- Worker 只返回候选 ID/评分；主线程二次验证仍为最终合法性 Gate。
- 置换表按游戏/规则版本/账号隔离并有内存上界；开局库带版本、来源与 deterministic fallback。

T4 本地纵切补充合同：

- `BoardAIKernel` 对外仅提供固定版本、`hashPosition` 与 `create().solve/clear`；Kernel 内部隐藏 Xiangqi/Gomoku 搜索、Zobrist、4096 项 LRU TT、版本化 opening book、节点/预算/取消检查与候选评分。
- `BoardAIWorkerBroker` 实例仅暴露 `request/cancel/dispose`。Worker 与同步 Adapter 使用同一 canonical request/result binding；Worker 只能返回候选 ID/有限评分，不能返回棋盘、账号、凭证、聊天或奖励字段。
- Worker 默认关闭且只允许本地 AI 回合；online、spectator、Authority、Protocol、Reward、Replay、Social、Persistence 不进入该路径。健康 Worker 可跨回合复用 TT；取消、超时、崩溃、协议异常、切换对局和 dispose 必须终止或清理。
- Xiangqi/Gomoku 调用方必须在主线程重新执行 `legalMovesOf()`/空位检查与既有 `doMove()`/`applyMove()`；Gomoku 完整合法候选超过 200 时跳过 Worker，不得静默截断候选集合。
- 原同步搜索、DeepSeek 和个人学习路径保持为 fallback；T4 仅是性能/搜索优化，不改变结果权威、奖励、回放或网络协议。

### `EngagementIntegrityAnalyzer`（TECH-044 + ECO-004/005 Acceptance Gap）

- 只消费服务端已接受的合法动作摘要，不消费原始按键或聊天正文。
- 输出 `auditOnly` 特征、置信区间与 reason；先观测误报，再独立版本化 Reward Policy。
- Test Admin、AI、spectator、重连补发、辅助功能输入和不同游戏节奏分开校准。
- T6-P0 仅接入 Tank Authority：`ENABLE_ENGAGEMENT_INTEGRITY_SHADOW=1` 才创建内存 analyzer，默认 `0`；只在 `acceptInput().ok` 之后观察，重复/旧序号/非法 tick、非法 match、限流和 spectator 请求不计入。
- Analyzer 只接收固定类别摘要（`gameId/mode/actorSlot/actorClass/sourceClass/actionClass/acceptedAt/sequenceClass/reconnectEpoch/inputModality`），服务端统一传 `inputModality=unobserved`；不得携带 UID、matchId、原始 payload、坐标、聊天或凭证。
- Human/AI 采用独立有界 cohort；Test Admin 不创建 analyzer 且不进入 shadow 计数。指标仅为固定数字聚合，生命周期随新局、重连、结算、重置和销毁清理；异常 fail-open。
- T6 不新增 WebSocket/Supabase/Analytics/Replay 字段，不调用或修改 `normalizedActionKey`、`recordRoomAction`、`reward-engine`，不扣币、不封禁、不改变 Reward/XP/胜场。

### `ClientDiagnosticsRing`（TECH-023/024/025 Acceptance Gap）

- 首个纵切固定 64 条、字段 allowlist、字符串截断、ID hash/类别化、无正文/凭证/PII、无网络和无 localStorage；后续有测量依据才可提高到 100。
- 只在 Desync、不可恢复协议错误或未捕获异常时生成有界 envelope；发送失败直接丢弃，不影响心跳或对局。

### `GameModuleLoader`（TECH-033 + TECH-039 ADR）

- 生产 Interface 只有 `prefetch(gameId)` 与 `load(gameId, options)`；当前 T2 只统一六款既有的可选 Renderer entry，隐藏固定版本 URL、SHA-256、单飞导入、导出验证和旧单页 fallback，不创建 Adapter 或接管 Foundation 生命周期。
- SW 只在显式游戏意图后预热固定 allowlist 中、响应 SHA-256 验证通过的 Renderer entry；安装、登录和首页不预载 Three/GSAP，API/WS/Auth/Chat/locale/JSON/vendor 继续隔离。
- 单个 Renderer entry 失败时回退当前内联 DOM/Canvas/程序化实现；不得留下半注册游戏或重复事件监听。真正六款逻辑 code splitting 仍须独立 TECH-039 ADR，不在 T2 冒充完成。
- 架构决策见 `requirements/ADR/002-game-module-loader-cache-build.md`。

### `ServerBoundaryAdapters`（TECH-040/TECH-052 + TECH-039 ADR）

- 目标架构仍是 Auth/Profile、Room/Presence、Match Protocol、Chat/Playline、Reward/Economy、Telemetry 六类深 Module；T7 当前已完成六类本地窄纵切、Node fresh-child、P5 outbox、P6 Clock/Timer、P7 Reward/Progression Projection、P8 Boundary Clock Injection、P9 Room Graph Recovery、P10 Ephemeral Cleanup、P11 Reconnect Lifecycle 与 P12 Heartbeat Sweep Timer；其余 token/lifecycle/outbox/gameplay/transport 时间所有权仍待深化，`TECH-040` 与 T7 总体保持 `partial`。
- T7 Room/Presence 纵切现已完成：`RoomPresenceBoundary` 只暴露 `room(command)` / `presence(command)`，隐藏 Seat 规范化、2–5 容量与选定游戏上限、递增席位/压紧、加入/离开/房主转移、断线窗口内同 UID+token hash 替换、Lobby/Room projection、Presence 隐私，以及 `update_ai_controllers/release_many/rehome_many` 的赛事多房 graph transaction。JSON runtime Adapter 读取现有内存 rooms/sessions/users，isolated in-memory Adapter 深复制未知 nested graph 并保留 Session/opaque handle 语义；两者通过同一 Interface 回归。
- 纯读取投影不修改 canonical graph，嵌套 DTO 深冻结；duplicate roomId、active canonical Session retire 和部分迁移 fail-closed。赛事 batch bind/attach 只在整图提交和 Authority 准备后暴露目标 wire，失败进入有界 retry 与单一 `roomGraphRecoveryQueue`，恢复后清 queue/timer 并刷新 Room/Lobby；canonical/stale/非目标/Bye spectator 统一使用 `spectate_left`。
- `server/index.js` 继续拥有 WebSocket 消息解析、权限与屏蔽/Test Admin guard、广播、结算/forfeit、spectator guard、Authority、timer 和其他持久化；Room/Presence Module 只返回结果/投影，不发送 wire 或修改 Rule/Reward/Replay/Supabase。
- Match Protocol 纵切固定 `command(input)` / `transition(input)`，只编排 Tetris/Xiangqi/Monopoly v2 Rule Authority 的 action/advance；JSON runtime 与 isolated memory/runtime Adapter 共享 detached `load/save/commit` contract，Rule Authority 仍拥有合法性、局面和结果。
- Match Protocol 在 Authority 前执行 match/generation/authority/member/session、sequence duplicate/stale 与 event revision fences；effect 顺序固定为 metric → turn/audit → broadcast → terminal settle/stop，terminal 幂等，Adapter/Authority fault 恢复 room、Authority checkpoint/local state 并映射稳定错误。`server/index.js` 的真人、AI 与 timer 路径统一接线，旧 inline fallback 保留滚动兼容。
- Operational Metrics 外部 Interface 只有 `capture/handle/recordError`；内部持久化 Seam 同时存在 JSON runtime Adapter 与 isolated in-memory Adapter。Module 隐藏 cadence/上限、鉴权/频控、告警/CSV、访问审计结果、incident 去重与持久读回净化。
- `ServerClockTimer` 外部 Interface 只有 `now/schedule/dispose`；Node 与 Manual deterministic 两个 Adapter 隐藏 raw handle、FIFO/catch-up、owner generation、cancel/dispose 和异常隔离。P6 迁移 Operational Metrics `now/cadence`，P8 统一六 Boundary 的显式 `now`，P9–P11 迁移 room recovery、guest cleanup 与 reconnect/room-removal，P12 迁移 `heartbeat-sweep` 并用 `HeartbeatSweepIsolation.run` 保持分域故障后的 repeat liveness。Metrics `generatedAt`、正式 token TTL、其余 Room/Tournament、Chat/Expression、Reward/AI outbox、游戏 tick 与 transport deadline 均保持后续 owner 批次。
- Node 子进程隔离补充合同：`server/testing/isolated-node-process.js` 外部 Interface 只有 `run/dispose`。每次 `run` 都创建 fresh Node child，使用创建时冻结的 env snapshot、有限输出与 timeout/kill 清理，并以 `hrtime` 计算耗时；它不注入虚拟时间、不 monkey-patch `Date.now()`、不共享 parent `require.cache`。Probe 只证明本地测试边界，不代表 server 全局 clock/Timer 已可控或生产多实例已隔离。
- `server/index.js` 消费 result 并保持 `/api/metrics`、`/api/metrics/history`、`/api/metrics/export`、`metrics-v2`、CSV、JSON fallback、Cluster 转发和稳定错误 wire。访问审计或 Adapter 失败必须 fail-closed 为不泄漏原始异常的 500；恶意持久 incident 不得把 token、正文、Infinity 或畸形数值带回 wire。
- 测试并行只允许隔离端口、目录、账号命名空间，并通过 lane context 显式依赖注入 clock 的分组；正式 QA 必须并行启动两个真实 `server/index.js` 证明端口、`DATA_DIR` 与账号 helper 被消费。`IsolatedNodeProcess` 另以双 lane probe 证明 fresh-child 的 real wall clock/module cache/env 边界；它不替换 Node 子进程的 `Date.now()` / wall clock，任何仍使用 server 进程全局时间、Timer 或其他共享全局状态的测试保持串行。
- lane 清理必须验证 under-root；普通目录验证真实路径后递归删除，symlink/junction/reparse path 即使 dangling 也只 unlink lane 自身，绝不跟随到 root 外目标。
- 架构决策、替代方案、风险和回滚见 `requirements/ADR/003-server-boundary-adapters-metrics.md`。

- Match Protocol 专项回归：`qa/match-protocol-boundary.js`（21/21）与 `npm run test:match-protocol-boundary`；本地结果不提升为真实设备、网络、Supabase、多实例或生产证据。
- Chat/Playline 纵切固定 `chat(command)` / `playline(command)`，本地 JSON lane 接入既有 Direct Chat/Playline caller；发送/已读 mutation 串行化，wire、session/广播/Cluster ownership 不变。Supabase 配置时保留既有 Direct Chat 事务 RPC fallback；专项 22/22、私聊/Playline/Security 在线回归通过。

人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 只作为 `OPTIONAL_ADVISORY_EVIDENCE`：未执行时不得冒充 PASS，但不阻塞开发、runtime 或发布候选。设备与 Supabase 外部环境缺口同样只保留为 `RELEASE_EVIDENCE_PENDING`；实际 commit、push、Pages 或 Render 发布仍必须取得当前用户的独立明确命令。

## 回滚

每个模块独立 feature/capability gate；默认先 shadow/default-off。回滚必须恢复旧 JSON/DOM/内联/同步 AI/无反馈路径，且不删除用户数据、不重写历史 Replay、不改变奖励结果。
