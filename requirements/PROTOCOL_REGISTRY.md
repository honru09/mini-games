# Gameplay Protocol Registry

统一注册表实现位于 `server/gameplay/protocol.js`，专项静态契约位于 `qa/protocol-version.js`。

| Protocol | C→S | S→C | Authority | Idempotency / reconnect | Invalid / compatibility | Tests |
|---|---|---|---|---|---|---|
| `tank-authority-v1` | `tank_input(matchId,seq,clientTick,input)` | `tank_snapshot`, `tank_result` | Server simulation | input seq；完整 snapshot resume | future/stale/legacy move rejected | `qa/tank-authority.js`、Tank focused E2E |
| `tetris-battle-authority-v1` | lock/KO claim、只读 presentation | battle/garbage/KO/result | Server coordination fallback | seq + placementSeq + attackId；snapshot resume | stale/duplicate/unknown fields rejected | `qa/tetris-battle-protocol.js`、Tetris focused E2E |
| `tetris-rule-v2` | `tetris_action(matchId,seq,action)` | `tetris_rule_state`, `tetris_rule_battle`, `tetris_result` | Shared Tetris Rule Core | per-player seq + state hash + full snapshot | `ERR_*`；未协商则使用 v1，不接受 v2 silent failure | `qa/tetris-rule-core.js`、`qa/rule-authority.js`、`qa/rule-authority-online.js` |
| `xiangqi-clock-v1` | `move(matchId,seq,from,to)` | `clock_state`, timeout | Server clock fallback | move seq；clock snapshot | stale/not-turn rejected | `qa/xiangqi-clock.js` |
| `xiangqi-rule-v2` | `xiangqi_action(matchId,seq,from,to)` | `xiangqi_rule_state`, `xiangqi_result` | Shared Xiangqi Rule Core + clock | per-player seq + board hash + snapshot | illegal/stale/not-turn explicit `ERR_*` | `qa/xiangqi-rule-core.js`、`qa/rule-authority-online.js` |
| `monopoly-auction-v1` | open/bid/turn-end + host stable state | auction events | Auction subsystem fallback | auction revision/bidId + snapshot | deadline/revision/property errors | `qa/monopoly-auction.js`、`qa/spectator-room.js` |
| `monopoly-rule-v2` | `monopoly_action(matchId,seq,action)` | `monopoly_rule_state`, `monopoly_result` | Shared Monopoly Rule Core | per-player seq + state hash + full snapshot | invalid state/action/deadline explicit `ERR_*` | `qa/monopoly-rule-core.js`、`qa/rule-authority-online.js` |
| `spectator-room-v1` | join/leave only | initial snapshot + room/game events | Server read-only seat | room/match snapshot on reconnect | all mutation rejected | `qa/spectator-room.js` |
| `tournament-orchestrator-v1` | create/consent/start；manual result 仅恢复入口 | state、match assignment、bye | Server pairing + real room + result adapter | pairing/binding/result guard；participant reconnect | participant busy/offline explicit；client result rejected | `qa/tournament.js`、`qa/tournament-auto-room.js`、`qa/tournament-auto-online.js` |
| `game-cosmetic-presentation-v1` | Profile equipped IDs | started/rejoined/spectator presentation | Public presentation only | `cosmeticSchemaVersion=1`；unknown ID fallback | 不广播 owned/price/balance/purchase | `qa/game-cosmetic-profile.js` |

## Capability 与错误

- 客户端在 `hello.payload.capabilities` 声明版本；服务端同时接受连字符 ID 与下划线 capability 别名。
- 新规则消息进入未协商/未激活房间时返回 `ERR_PROTOCOL_VERSION`；非法动作使用 `ERR_INVALID_MOVE`、`ERR_NOT_ACTIVE_PLAYER`、`ERR_STALE_SEQ`、`ERR_DUPLICATE_ACTION`、`ERR_MATCH_FINISHED`、`ERR_INVALID_STATE` 等统一代码。
- `ENABLE_RULE_AUTHORITY_V2=0` 只用于紧急回滚与旧协议回归。它不会把 v1 描述成完整规则权威。
