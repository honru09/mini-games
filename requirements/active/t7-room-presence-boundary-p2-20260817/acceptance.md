# T7 Room/Presence Boundary P2 验收

状态：`VERIFIED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

## 本地结论

`RoomPresenceBoundary` 已在同一 `room(command)` / `presence(command)` Interface 下收口房间成员、席位、房主、重连、Presence 与赛事多房图事务；Operational Metrics、Auth/Profile、Room/Presence 三个纵切均已具备本地实现与回归证据。T7 的 Match Protocol 后续已在独立 `server/boundaries/match-protocol.js` seam 完成本地接线与 21/21 专项回归；它不属于本 Room/Presence Module，也不改变本合同的 ownership。Chat/Playline、Reward/Economy ownership 仍未迁移，T7 总体与 `TECH-040` 继续保持 `partial`。

### T7 后续状态（边界外）

- Match Protocol 的 `command` / `transition`、JSON runtime/isolated memory Adapter、match/generation/sequence/revision fences、effect ordering 与 rollback 由独立合同和 ADR 记录；本 Room/Presence 合同不拥有这些接口，也不把其副作用纳入房间成员事务。
- 证据入口：`server/boundaries/match-protocol.js`、`server/index.js` 接线、`qa/match-protocol-boundary.js`（21 项）、`npm run test:match-protocol-boundary`。

## 已验收的不变量

- 仅接受 2–5 容量；已选游戏的 `GAME_MAX` 继续限制加入，加入使用当前最低空席，离开/过期后的 `compact` 返回 `player_reassigned` 结果。
- 房主离开或断线过期时，剩余真人按席位确定性转移房主，AI `controllerUid` 跟随；最后真人离开返回 `closed` 并由 Adapter 移除房间。
- `detach` 只为已开始对局建立有限重连窗口；`resume` 必须由 Adapter 当前 sessions 中的 live 新 Session 发起，要求同 UID、同 token hash、显式 detached 标记和有限 `resumeUntil`。替换后旧 Session 从 clients/sessions 清除，room/player/timer/resume 字段归零，迟到 callback 不能复活旧席位。
- JSON runtime Adapter 保持现有 `rooms/sessions/users` 引用；isolated in-memory Adapter 深复制初始状态并保留 canonical room/session 图。带 stale caller-owned room 的命令不得绕过 Adapter 或在 `unregister` 后复活房间。
- Presence 仅从 Adapter canonical user 与 live heartbeat（`0 <= now-lastSeen < 40s`）计算；`everyone/friends/nobody/invisible`、双向 Block、隐藏 Test Admin、未知 UID、畸形/未来时间戳均 fail-closed 为 `offline`，`online_uids` 不泄漏未知或隐藏账号。
- Adapter、clock、投影、token 比较和持久回写异常只返回稳定 `room_presence_unavailable`/`offline` 结果，不回显底层异常文本。
- 成员 mutation 的 Adapter 写入/删除失败会恢复 canonical room Map、seat array、host 与相关 Session 字段；未知 Session 默认拒绝，断线清理只有显式 `allowUnregistered` 才能使用。
- `inspect`、成员变换、重排与 AI/READY 操作只返回冻结 DTO；AI 席位、READY 和 tournament 源房释放均通过 Room/Presence 结果完成，调用方不直接修改 canonical clients/host/seats。
- `seat`、`update_ai_controllers`、`release_many`、`rehome_many` 已进入同一 Interface；纯读取投影不修改 canonical graph，嵌套 DTO 深冻结，Memory Adapter 隔离未知嵌套图并保留 Session/opaque handle 语义。
- 多源、多目标赛事迁移整批提交；batch bind/attach 带精确 rollback receipt，Runtime Adapter fault 真实穿透到补偿路径。duplicate roomId、active canonical Session retire、目标冲突和任何部分写入均 fail-closed。
- 赛事目标 wire 延后到房图事务及 Authority 准备完成；terminal/quarantine 覆盖全部 mutation guard。连续补偿失败只进入一个按需 `roomGraphRecoveryQueue`，恢复后清 queue/timer 并主动刷新 Room/Lobby。
- canonical、stale、非目标与 Bye spectator 都在同一事务中清理，客户端统一收到 `spectate_left`；关闭观战不再使用错误的 `spectator_left`。重复 `select_game` 选择同一游戏保持既有 READY 幂等。

## 验证命令与结果

- `npm run test:room-presence-boundary`：通过（43 个断言，含双 Adapter、纯读取/深冻结、未知嵌套图隔离、容量/席位、host transfer、resume、Presence、READY/AI、duplicate/retire fail-closed、多源 `release_many`、多目标 `rehome_many`、spectator 清理与整图回滚）。
- `node --check server/boundaries/room-presence.js`：通过。
- `npm run test:technical-optimization-t7`：包含本专项入口，并与既有 Metrics/Auth/Profile/Isolation 回归串联。
- `node --experimental-websocket qa/tournament-atomic-online.js`：通过（17 项，覆盖 batch bind/attach、源房 fault、精确补偿、quarantine/recovery、目标 wire 时序与 spectator-only 参赛者迁移）。
- `node qa/tournament.js`、`node qa/tournament-auto-room.js`、`node --experimental-websocket qa/tournament-auto-online.js`、`node --experimental-websocket qa/tournament-recovery-online.js`、`node --experimental-websocket qa/spectator-room.js`、`node qa/social-match-client-lifecycle.js`、`node --experimental-websocket qa/reconnect-online.js`、`node --experimental-websocket qa/e2e-online.js`：通过。
- `npm run quality:gates`：共享 Gate 已注册 `room-presence-boundary-t7`；完整执行记录由主线收口批次维护。

## 未执行与回滚

第二浏览器、物理 Android/iPhone/Tablet、真实网络整形、真实 Supabase/多实例、生产发布和 commit/push/deploy 均为 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。本纵切保持既有 WebSocket wire、Rule/Authority/Reward/Replay、Supabase schema、前端与美术不变。回滚方式为仅移除 `server/index.js` 的 Room/Presence seam 注入并恢复旧 inline wrapper；不删除用户数据、不重写 Replay、不改变奖励。Match Protocol 的独立回滚不由本合同代行。
