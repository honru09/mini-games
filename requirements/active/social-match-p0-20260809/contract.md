# match-expression-v1 合同

## Capability

- 客户端与服务端能力：`match-expression-v1`。
- 未协商能力时不显示发送入口；未知消息由旧客户端自然忽略，旧服务端不影响游戏。

## C → S

`match_expression`

```json
{
  "matchId": "m_xxx",
  "eventId": "mx_xxx",
  "kind": "emoji",
  "expressionId": "emoji_wave",
  "targetSeat": 1
}
```

- `eventId`：`^[A-Za-z][A-Za-z0-9_-]{7,80}$`。
- `kind`：`emoji | quick`。
- Emoji ID：`emoji_wave / emoji_thumbsup / emoji_cheer / emoji_wow / emoji_oops / emoji_cry / emoji_angry / emoji_sly / emoji_heart / emoji_game`。
- Quick ID：`quick_hello / quick_good_luck / quick_nice / quick_wow / quick_thanks / quick_again`。
- `targetSeat` 可省略或为当前真人/AI有效席位；定向到真人时执行双向 Block 检查。AI 只可成为表现目标，不产生社交动作。

## S → C

`match_expression`

```json
{
  "protocol": "match-expression-v1",
  "matchId": "m_xxx",
  "eventId": "mx_xxx",
  "senderUid": "u_xxx",
  "player": 0,
  "targetSeat": 1,
  "kind": "emoji",
  "expressionId": "emoji_wave",
  "createdAt": 1786280880000
}
```

`match_expression_ok`

```json
{"eventId":"mx_xxx","matchId":"m_xxx","replayed":false}
```

`match_expression_error`

```json
{"eventId":"mx_xxx","reason":"rate_limited","retryAfter":3}
```

## Authority 与幂等

- `senderUid/player/createdAt/protocol` 由服务端签发。
- 房间按 `senderUid|eventId` 保存有界幂等索引，仅存在内存；同一索引重复只回 `ok(replayed:true)`。
- 幂等索引在新 match、结束、房间销毁时清空，单局最多 300 条。

## Seat identity projection

- Seat 继续展示公开 Avatar/Frame/Effect/NameFx/Lang，并可附带独立 `player-character-v1` 白名单投影。
- `playerCharacter` 只含 `schemaVersion`、`characterId` 与固定 `slots` ID；不进入表达事件、Replay、规则快照或奖励。
- 角色投影由服务端 `publicSeat` 生成，客户端只读缓存；未知或缺失值回退确定性默认角色。

## 频控

- 同一账号：10 秒最多 4 条、60 秒最多 12 条、单局最多 80 条。
- 超限返回 `rate_limited` 与整数秒 `retryAfter`，不广播。
- 客户端另有约 900ms 视觉冷却，但不作为安全边界。

## Trust & Safety

- 发送者必须是持久正式账号的当前真人席位；访客、AI、观众禁止发送。
- 定向真人存在任一方向 Block 时返回 `blocked`。
- 每个接收者在收到事件前再次检查与发送者的双向 Block；不合格接收者完全看不到事件。
- 本批没有用户自由文本，不需要保存原文；举报继续使用既有 `report`，contextType=`match`、contextId=`eventId`、matchId 为当前局。
- 客户端“静音局内表达”只影响本地显示，不改变 Block/Report 状态。

## 重连、Replay 与失败

- 表达不写 moveLog、gameSnapshot、Replay、Analytics、Profile、奖励或数据库；重连不补发。
- 服务端结算产生 `match_result` 后，到房主明确结束或重开之前允许临时赛后表达；它不能改变 finalResult、奖励或 Replay，`end_game` / `restart` 必须清理全部表达缓存与延迟任务。
- 延迟到达且 matchId 已变化的事件由客户端丢弃；退出/重开时清空气泡、动画、计时器和目标状态。
- 观众接收表达时遵循房间 spectatorDelayMs 和 Block 过滤，但永远不能发送。
- 错误 reason：`unsupported_capability / persistent_account_required / spectator_readonly / not_in_room / match_not_active / invalid_match / invalid_event_id / invalid_expression / invalid_target / blocked / rate_limited`。
