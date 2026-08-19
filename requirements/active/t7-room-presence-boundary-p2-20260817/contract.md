# T7 Room/Presence Boundary P2 合同

## Deep Module Interface

```js
const boundary = createRoomPresenceBoundary({
  adapter, now, heartbeatTimeoutMs, gameMin, gameMax,
  normalizeVisibility, normalizeAIDifficulty, normalizeAIPersona,
  publicPlayerCharacter, isHiddenUid, isFriend, isAllowedBetween,
  gameplayMetadata, secureEqual,
});

boundary.room(command);      // register / unregister / inspect / payload / lobby / seat / join / remove / compact / detach / resume / retire_session / set_ready / reset_ready / add_ai / remove_ai / update_ai_controllers / release_many / rehome_many
boundary.presence(command);  // public / online_uids
```

调用方只依赖稳定的 `ok/reason` 结果、公开 payload 或成员变换结果；席位数组、隐私判定、心跳窗口、token 比较、重排算法和 Adapter 状态不从 Interface 泄漏。纯读取投影不得规范化或写回 canonical graph；成员变换、inspect、compact 与嵌套 DTO 深冻结，不返回 canonical room/session/details 引用。带 `room.id` 的 caller-owned 对象不是隐式注册：Adapter 中不存在 canonical room 时必须 `room_not_found`，避免 stale 引用绕过 seam。

## Adapter seam

- JSON runtime Adapter：读取服务端现有 `rooms`、`sessions`、`db.users`，并通过 `putRoom/removeRoom` 回写同一运行时 Map；不声称把临时房间持久化到 JSON。
- isolated in-memory Adapter：复制 users、sessions、rooms、clients、spectators 和 seats，供同一 Interface 的纯回归使用；不会共享生产对象或跨测试 lane 状态。
- 两个 Adapter 只暴露 `read/putRoom/removeRoom`；Module 不知道 WebSocket、`server/index.js`、Supabase、Reward 或 Replay。
- Memory Adapter 的 `putRoom` 保持 canonical room/session 图；首次注册复制外部 source graph，后续写回不替换 canonical 引用。`resume` 替换后旧 Session 从 clients/sessions 移除并清理 room/player/resume/detached/reconnectTimer。
- Memory Adapter 深复制未知 plain nested graph；Session 仍保持可识别身份，Timer/Socket/opaque handle 只保留 opaque 语义，不对外展开或 JSON 化。duplicate roomId 与 active canonical Session retire 一律拒绝。

## Tournament graph transaction

- `release_many` 在单次命令内释放多个源房成员；`rehome_many` 同时释放全部源房、清除 canonical/stale/非目标 spectator 状态并写入全部目标房。目标房重复 ID、席位冲突、成员遗漏或任一次 Adapter 写入失败都会恢复整个 room/session graph。
- `update_ai_controllers` 批量更新 AI Controller；赛事 bind/attach 只消费 Boundary 的批量结果和精确 rollback receipt，不再在调用方直接改 canonical clients/host/seats。
- 调用方只有在 batch bind、batch attach、源房提交和目标 Authority 准备全部成功后才发送目标房 wire。terminal/quarantine 期间所有房间 mutation 由 guard 拒绝；失败进入有界 retry 与单一按需 `roomGraphRecoveryQueue`，恢复成功后清 timer/queue 并重新投影 Room/Lobby。
- canonical、stale、非目标与 Bye spectator 离开均使用既有 `spectate_left`；关闭观战也复用同一 wire，不新增消息类型。

## Ownership

- Module：座位/成员/Presence 规则、Room/Lobby/Presence 公开投影、reconnect replacement 的不变量与 fail-closed 结果。
- `server/index.js`：消息解析、权限 guard、广播、结算/forfeit、Authority、spectator Access Guard、timer 调度与 JSON/Supabase 其他写入。
- Rollback：移除 boundary 注入与 wrapper 即回到旧 inline seat/presence 逻辑；不删除用户数据、不重写 Replay、不改变奖励。

## Evidence boundary

机器/本地回归可证明 `VERIFIED_LOCAL`，不能提升为第二浏览器、真机、真实网络、真实 Supabase 或生产就绪。人工清稿、Reviewer B、IP/法律与 Golden Set 对原创美术仍是 `OPTIONAL_ADVISORY_EVIDENCE`，不阻塞本纵切。

## T7 后续状态（边界外）

Match Protocol 已在独立 `server/boundaries/match-protocol.js` 深模块完成本地 `command` / `transition` 接线与 21/21 专项回归，证据入口为 `server/index.js`、`qa/match-protocol-boundary.js` 与 `npm run test:match-protocol-boundary`。该 seam 的 Adapter、fences、effect ordering 和 rollback 不属于 Room/Presence ownership；本合同仍只约束 `room(command)` / `presence(command)`、43 项 Room/Presence 不变量及其赛事 graph transaction。Chat/Playline、Reward/Economy ownership 和 server 全局 clock/Timer 虚拟化仍未完成；Node 子进程 fresh-child wall-clock/module-cache/env 窄合同已由 T7 隔离测试补充验证。
