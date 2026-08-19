# ADR-003：Operational Metrics 首个 Server Seam 与隔离测试分组

- 状态：`accepted / PARTIAL / LOCAL_ONLY / NOT_RELEASED`
- 日期：2026-08-16
- 决策人：Ghost Game 主负责人（本地实施决策）
- 影响 Requirement：`TECH-040`、`TECH-052`、`TECH-039`

## 背景

`server/index.js` 同时拥有账号、房间、比赛协议、社交、奖励与运营指标等多类职责。T7 的长期目标是让 Auth/Profile、Room/Presence、Match Protocol、Chat/Playline、Reward/Economy、Telemetry 各自形成深 Module，但一次迁移六类所有权会同时放大 wire、JSON fallback、Supabase、Cluster 与滚动兼容风险。

Operational Metrics 已有三个管理员只读路由、鉴权与频控、历史快照、CSV、访问审计、incident 去重及 JSON 持久化，行为集中且 wire 可独立回归，适合作为首个真实纵切。该纵切必须有至少两个 Adapter，避免只为假想替换点增加浅层包装；测试并行也必须先证明真实 server 进程消费独立端口与目录，不能只在内存 fake 上宣称隔离完成。

后续本地纵切已按同一决策继续落地 Auth/Profile、Room/Presence 与 Match Protocol。Room/Presence 又承担赛事多源房释放、多目标房迁移与失败恢复，因此事务边界必须覆盖整张 canonical room/session graph，而不是把多个单房命令拼成“看似原子”。Match Protocol 则把三套 v2 Rule Authority 的输入、transition、fence 与副作用提交集中到可替换 seam，保持现有 wire 与旧路径兼容。

## 决策

### Operational Metrics Module

- 在 `server/boundaries/operational-metrics.js` 建立 seam。外部 Interface 固定为 `capture(force)`、`handle(input)`、`recordError(context, error)`；调用者不再分别拥有 cadence、历史上限、鉴权、频控、告警、CSV、访问审计结果和 incident 去重规则。
- Module 通过内部 `load()/save()` 持久化 Interface 接受两个真实 Adapter：
  - JSON runtime Adapter：由 `server/index.js` 注入现有 `db.metricsHistory`、`db.opsIncidents`、裁剪与 `saveDB()`，保持当前本地 JSON 生产回退。
  - isolated in-memory Adapter：持有与输入对象分离的 history/incidents，只供独立合同与 lane 测试使用，不冒充生产持久化。
- Module 返回有限、冻结、分类化结果；HTTP 调用者只负责把 `handle()` 的 status/headers/body 写入 response，把成功的 access audit 结果交回现有 Analytics 记录路径。访问审计失败必须进入统一 fail-closed `500 metrics_unavailable`，不得把未审计读取回成 200，也不得泄漏原始异常。
- 从 Adapter 读回的 incident 不受信任：fingerprint 必须符合固定格式，context/kind 重新走 allowlist 净化，count/firstAt/lastAt 必须是有限有界整数，任何 token、正文、Infinity 或畸形值不得经 Metrics wire 回显。

### Wire 与兼容边界

- 保持 `GET /api/metrics`、`GET /api/metrics/history`、`GET /api/metrics/export`；非目标 method/path 继续返回 `handled:false`。
- 保持现有 HTTP 管理员令牌鉴权、每 IP 有界频控、`Cache-Control: no-store`、`metrics-v2` JSON、history 形状、CSV BOM/header、access IP 摘要和稳定错误 reason。
- 保持启动强制 capture、周期 capture、Cluster metrics 转发与既有 `recordOperationalError()` 调用位置。没有新增 capability、WebSocket message、Supabase 表、奖励、玩家档案或用户可见前端变化。

### Isolated Server Test Group

- `server/testing/isolated-test-group.js` 只暴露 `create(options).run(plan)`。明确列入 `isolated` 的 lane 并行准备不同动态端口、`DATA_DIR`、账号命名空间 helper 与 lane-scoped injectable clock；明确列入 `shared` 的全局状态测试保持串行。
- 正式 QA 必须并行启动两个真实 `server/index.js`，分别消费各自端口、目录与账号 helper，并证明持久文件和账号不串 lane。
- `server/testing/isolated-node-process.js` 只暴露 `run/dispose`，为 lane 提供创建时冻结的 env snapshot、每次 run 的新 Node 子进程、有限输出、超时和终止清理；`qa/server-test-isolation.js` 的双 lane probe 已验证 PID、real wall clock、module cache 与 parent env/cache 隔离。该 seam 不 monkey-patch `Date.now()`、不替换 server 全局 Timer，依赖真实 wall clock 的测试仍不得仅凭 lane clock 并行。
- injectable clock 只对显式接收 `context.clock.now` 的 Module 生效；`serverEnv()`/child env 不注入虚拟时间，也不宣称 server 全局时间可控。
- lane 清理先验证路径项位于配置 root。普通目录再校验真实路径后递归删除；symlink/junction/reparse path 只 unlink lane 自身，绝不跟随到 root 外目标。即使目标已不存在，也用 `lstat` 识别 dangling path 并完成清理。

### Auth/Profile 与 Room/Presence 后续纵切

- Auth/Profile 固定为 `session(command)` / `profile(command)` 深 Interface；Room/Presence 固定为 `room(command)` / `presence(command)`。两者均提供 JSON runtime 与 isolated in-memory Adapter，调用方继续拥有 wire、广播和跨领域副作用。
- Room/Presence 的读取投影不写 canonical graph，所有返回 DTO 深冻结；Memory Adapter 隔离未知 nested graph，同时保持 Session 身份和 opaque handle 语义。
- Room 命令包括 `seat`、`update_ai_controllers`、`release_many`、`rehome_many`。多源、多目标赛事迁移只允许整批提交或整图恢复；duplicate roomId、active canonical Session retire、目标席位冲突和 Adapter fault 均 fail-closed。
- 赛事调用方在 batch bind/attach、源房释放、目标房注册及 Authority 准备完成前不发送目标房 wire。连续补偿失败进入一个按需 `roomGraphRecoveryQueue`；terminal/quarantine guard 全部 mutation，恢复后清 queue/timer 并刷新 Room/Lobby。
- canonical、stale、非目标与 Bye spectator 统一清理，客户端沿用 `spectate_left`；重复选择当前游戏保持已接受 READY，不制造隐式状态重置。

### Match Protocol 后续纵切（2026-08-17）

- `server/boundaries/match-protocol.js` 固定 `command(input)` 与 `transition(input)` 深 Interface；兼容别名 `action` / `advance` 保持非枚举，调用方不直接编排三套 Rule Authority 的副作用。
- Module 只负责 Tetris/Xiangqi/Monopoly v2 action 与 timer transition 的 dispatch、输入/状态 fence、稳定错误和 effect plan；合法性、局面与结果仍由对应 Rule Authority 持有，不把 Rule、Reward、Replay 或 wire schema 搬进 Module。
- JSON runtime Adapter 通过 detached `read/write` 状态回调接入现有进程；isolated memory/runtime Adapter 复用同一 `load/save/commit` contract。journal 有界且不写玩家持久字段，不声称 Supabase 或 durable recovery。
- 处理前依次校验 room/session/member、`matchId`、generation/epoch、authority match、player sequence/duplicate/stale 与事件 revision；不满足时返回分类 `gameplay_error`，底层异常、token/secret/reason 原文均被 fail-closed 过滤。
- Effect ordering 固定为 metric → turn/audit → broadcast → terminal settle/stop（按游戏只插入合法的 battle/state event）；terminal 具幂等保护。Adapter 在任一 callback/持久化失败时恢复 room 与 Authority checkpoint/本地 state，并返回稳定 `match_protocol_unavailable`/`match_protocol_effect_failed`。
- `server/index.js` 将三套真人与 AI v2 action、Tetris/Xiangqi/Monopoly timer transition 接入同一 seam；Authority 缺失、旧 capability 或滚动实例不具备新字段时保留旧 inline fallback，不新增消息类型或玩家可见能力。

### Reward/Economy P5 后续决策（2026-08-17）

- Reward 数值、资格和 profile projection 继续由 `server/reward-engine.js` 与既有 settlement caller 持有；本次只把确认后的 outbox、`resultId` 幂等、同 uid 串行和远端 retry 收口到 `server/boundaries/reward-economy.js`。
- Boundary 使用 JSON runtime 与 isolated memory 两个 Adapter；legacy `pendingRewardSync` 形状保持不变，注入 `remoteApply` 以保留 `apply_reward_v1` RPC 与滚动回退。
- 本地 JSON/ fake Supabase 回归不得升级为真实 Supabase/RLS、跨实例 lease/PubSub、备份恢复或发布证据；失败保留 outbox，`applied/duplicate` 才移除，回滚不删除数据。

### Server Clock/Timer P6 后续决策（2026-08-17）

- 在 `server/boundaries/server-clock-timer.js` 建立 `now/schedule/dispose` 深 Module；生产 Node Adapter 与 Manual deterministic Adapter 形成真实 seam，Module 隐藏 raw handle、FIFO/catch-up、owner generation、cancel/dispose、同步 arm 和异常隔离。
- 首个 caller 只迁移 Operational Metrics：构造注入 `now` 使用 `serverClockTimer.now()`，`metricsHistorySweep` 使用 owner `operational-metrics-history` 的 `schedule()`，server close/bootstrap failure 统一 `dispose()`。
- P6 不迁移 `server/gameplay/metrics.js` 的 `generatedAt`，也不迁移 heartbeat、guest/reconnect、Room/Tournament、Chat/Expression、Reward/AI outbox、游戏 tick 或 transport deadline；因此是 focused vertical slice，不是 server-wide time virtualization。
- `qa/server-clock-timer.js`、`qa/timer-audit.js`、Metrics Module/online 与 T7/Quality Gate 共同证明声明范围；不得用单浏览器矩阵、Node 子进程 fresh-child 或 lane clock 冒充全局时间已可控。

## 不在范围内

- Operational Metrics、Auth/Profile、Room/Presence、Match Protocol、Chat/Playline 与 Reward/Economy outbox 六类本地窄纵切已落地；P7 Reward/Progression Projection 与 P8–P12 Boundary Clock/room recovery/guest cleanup/reconnect/heartbeat owner 也已按独立批次落地。正式 token TTL、其他 lifecycle、outbox/gameplay/transport timer 与 Metrics `generatedAt` 尚未迁移，`TECH-040` 与 T7 因此仍保持 `partial`。
- 不把整个 `server/index.js` 拆完，不改变 WebSocket protocol、Rule Authority、Replay、Reward、Economy、Social、Supabase schema 或 Cluster 一致性。
- 不提供 Supabase Metrics Adapter，不把 isolated in-memory Adapter 用于生产。
- 不虚拟化或替换 Node/server 全局 wall clock、Timer、单例或其他共享全局状态；P6 的 Manual Adapter 只在显式 seam 内使用，子进程的 module-cache/env/real wall-clock 隔离只由 `IsolatedNodeProcess` 作为测试边界提供，未显式列入 isolated lane 的测试仍保持串行。
- 不宣称构建时间、测试总时长、吞吐、内存或生产可靠性已有改善；这些结论必须来自独立测量。

## 替代方案

- 一次迁移全部六类 server ownership：拒绝。变更面过大，无法把 wire 或持久化回归定位到单一纵切。
- 只抽一个 JSON Adapter：拒绝。单 Adapter 只形成假想 seam；第二个隔离内存 Adapter 让同一 Interface 真正可替换、可测试。
- 保留所有 Metrics 逻辑在 HTTP caller，仅抽薄 repository：拒绝。鉴权、频控、cadence、审计和 incident 规则仍会散落，删除 Module 后复杂性不会回到清晰单点。
- 在测试进程 monkey-patch `Date.now()` 或仅设置未消费的 clock 环境变量：拒绝。会污染并行 lane，且不能证明子进程实际使用虚拟时间。
- 无条件并行全部 online QA：拒绝。仍依赖固定端口、进程全局环境或共享外部状态的测试必须串行。
- 清理时对 symlink/junction 先 `realpath` 再递归删除：拒绝。可能跟随到 root 外目标；只允许 unlink lane 路径项。

## 证据与验收

- 本地合同/测试：`server/boundaries/operational-metrics.js`、`server/boundaries/server-clock-timer.js`、`server/testing/isolated-node-process.js`、`server/testing/isolated-test-group.js`、`server/testing/node-process-isolation-probe.js`、`qa/server-boundary-adapters.js`、`qa/server-test-isolation.js`、`qa/server-clock-timer.js`、`qa/timer-audit.js`、`qa/metrics-online.js`、`npm run test:technical-optimization-t7`、`npm run test:node-process-isolation`。
- Match Protocol 合同/测试：`server/boundaries/match-protocol.js`、`server/index.js` 接线、`qa/match-protocol-boundary.js`（21 项）、`npm run test:match-protocol-boundary`。
- 兼容回归：`qa/technical-optimization-mainline-contract.js`、`qa/code-health-sweep.js`、`qa/production-readiness-contract.js`、`qa/supabase-adapter.js`、`qa/security-online.js` 与相关安全回归。
- 当前状态：六类 Boundary、Reward/Economy outbox、Node 子进程隔离、P6 Clock/Timer、P7 Reward/Progression Projection 与 P8–P12 owner 窄迁移已完成本地实现/相应验证；剩余 owner 与 server-wide clock/Timer 可控性仍未完成，T7 总体为 `partial`。
- Room/Presence/赛事证据：`qa/room-presence-boundary.js`（43 项）、`qa/tournament-atomic-online.js`（17 项）、`qa/tournament.js`、`qa/tournament-auto-room.js`、`qa/tournament-auto-online.js`、`qa/tournament-recovery-online.js`、`qa/spectator-room.js`、`qa/reconnect-online.js`、`qa/e2e-online.js`。
- 外部证据：第二浏览器、物理 Android/iPhone/Tablet、真实网络、真实 Supabase/多实例均为 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`；共享 Gate 的开发通道已由所有者政策统一打开，本 ADR 本身不提供这些外部证据，也不授予发布。

## 风险、兼容与回滚

- JSON runtime Adapter 仍通过 callback 连接 `server/index.js` 的可变 `db` 与同步 `saveDB()`；它是首个 seam，不是 server 拆分完成。后续迁移必须继续用小纵切，而不能把此 Adapter 扩成全能 repository。
- 鉴权频控 bucket 仍为进程内状态，重启会清空；与旧行为一致。Adapter 读写或访问审计失败统一返回稳定 500，可能牺牲一次管理员可观测读取，但不会绕过审计或暴露原始异常。
- 动态端口 reservation 在交给真实 server 前必须关闭，存在极短的外部进程抢占窗口；失败 lane 会分类失败并清理，不能据此宣称 OS 级端口租约。
- 多房事务仍运行在单进程内存图上；恢复队列只能防止当前进程内部分提交和迟到 wire，不能冒充 Supabase 多实例事务、durable recovery 或生产容灾。
- Match Protocol 的 JSON Adapter 仍由 `server/index.js` 提供内存态 callback；effect journal 与 room 快照回滚只覆盖当前进程，不等于跨实例 durable commit。Authority/wire 滚动兼容依赖旧 inline fallback，不能把本地 21/21 合同升级为生产防作弊或跨设备证据。
- 回滚时可把 `server/index.js` 的 Metrics 调用恢复为原内联实现，并把 Metrics `now` 注入/周期 cadence 恢复为 `Date.now`/原生 interval；同时保留 `metricsHistory`、`opsIncidents`、三个 HTTP 路由和原 wire，无需迁移或删除用户数据。测试分组可退回串行执行，不改生产状态。
- Match Protocol 回滚时移除 `matchProtocolBoundary` 注入与 action/transition wrapper，恢复原有三套 Authority inline handler；保留既有 `tetris_action`/`xiangqi_action`/`monopoly_action` wire、Rule Authority、Reward、Replay 与数据，不删除用户数据。
- `IsolatedNodeProcess` 回滚时移除 `context.node` 与 probe 文件，`IsolatedServerTestGroup` 可退回当前端口/目录/账号/显式 clock 合同；不修改 `server/index.js`，不改变生产 wall clock、环境变量或 module cache。

## 后续动作

- 按独立纵切继续正式 token TTL、其他 lifecycle、outbox 与 transport deadline 等 server clock/Timer owner；P6 已建立并由 `server/index.js` 消费 Clock/Timer Interface，P7–P12 已完成各自声明范围，后续仍须先审计 ownership/lifecycle，再逐批迁移，gameplay timer 最后处理。
- `server/gameplay/metrics.js` 的 `generatedAt` 与其他 `Date.now()`/Timer 仍须显式注入后才能称为可控；当前 `IsolatedNodeProcess` 只证明 fresh child 的 real wall-clock/module-cache/env 边界，不把 lane clock 或 P6 Metrics-only seam 描述成 server wall-clock virtualization。
- 如需并行更多 online QA，先逐项消除固定端口、共享目录、全局环境与外部服务依赖，再加入 isolated 清单。
