# T7 Room/Presence Boundary P2

状态：`REQUIREMENT_FROZEN / VERIFIED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

## Goal

将 `server/index.js` 中房间座位/容量不变量、加入/离开/房主转移、断线重连替换、公开房间投影、Presence 隐私与赛事多房间成员迁移收敛到一个可替换、可测试的深 Module。保持既有 WebSocket wire、房间容量 2–5、递增席位、重连窗口、观战席、Test Admin 隔离、Supabase 兼容和所有游戏 Authority 行为不变。

## IN

- `RoomPresenceBoundary` 外部 Interface：`room(command)` 与 `presence(command)`。
- Seat 规范化、公开 Seat 投影、按当前加入人数的容量检查、顺序压紧与 `player_reassigned` 结果；纯读取投影不得修改 canonical graph。
- join/remove/host transfer、异常 detach、token 绑定的 reconnect resume 和过期前后的 fail-closed 结果。
- `seat`、`update_ai_controllers`、`release_many`、`rehome_many`：AI Controller 批量归属、赛事多源房释放、多目标房迁移、非目标/Bye/观众状态清理与整张 room/session graph 原子回滚。
- Lobby/Room payload、在线 UID 集合、`everyone/friends/nobody/invisible` Presence 隐私与 10 秒心跳 / 40 秒超时判定。
- JSON runtime Adapter 与 isolated in-memory Adapter；Memory Adapter 深复制未知嵌套图，同时保留 Session 身份与 opaque handle 语义；显式注入 clock，禁止 monkey-patch `Date.now()`。
- `server/index.js` 仅保留广播、结算、Authority、spectator guard 和兼容 wrapper；Module 不发送 WebSocket、不写 Reward/Replay。
- 赛事迁移只有在全部源/目标写入、Authority 准备和事务提交成功后才暴露目标房 wire；失败进入有界重试与单一按需恢复队列，恢复后刷新 Room/Lobby。

## OUT

- 不改变任何 WebSocket 消息类型、字段、顺序、capability 或错误文案契约。
- 不改变游戏规则、Match Protocol、Authority、Reward/Economy、Replay、AI、Social/Block 权威或 Supabase schema/RLS/RPC。
- 不把房间内存状态宣称为 durable persistence；真实 Supabase、多实例和生产发布证据仍由独立 Gate 管理。
- 运行时纵切不修改前端、未清除/外部受限美术或线上部署；本批文档收口只同步权威台账、报告、简报与三日志。

## Non-negotiable

- 房间容量只能在 2–5；选定游戏的 GAME_MAX 仍限制后续加入，未选游戏按房间容量。
- 真实玩家席位按当前空位递增分配；离房/过期后压紧并返回重分配结果，AI controller 跟随新房主。
- reconnect 只能以同 UID + 同 token hash 在窗口内替换断开的旧 Session；过期不得偷偷占回旧席位。
- Test Admin、访客、spectator 和屏蔽关系的既有访问边界不放宽；Presence 隐私 fail-closed 为 offline。
- Module 只返回结果/投影，transport/settlement/authority 继续由调用方持有。
- duplicate roomId、active canonical Session retire、目标房重复成员和任何部分迁移均 fail-closed；多源、多目标赛事迁移只能整批成功或整批恢复。
- canonical、stale、非目标、Bye spectator 都必须清理统一观战状态；客户端只接收既有 `spectate_left`，不得产生分叉 wire。
