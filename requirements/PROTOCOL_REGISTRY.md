# Gameplay Protocol Registry

统一注册表实现位于 `server/gameplay/protocol.js`，专项静态契约位于 `qa/protocol-version.js`。

| Protocol | C→S | S→C | Authority | Idempotency / reconnect | Invalid / compatibility | Tests |
|---|---|---|---|---|---|---|
| `tank-authority-v1` | `tank_input(matchId,seq,clientTick,input)` | `tank_snapshot`, `tank_result` | Server simulation | input seq；完整 snapshot resume | future/stale/legacy move rejected | `qa/tank-authority.js`、Tank focused E2E |
| `tetris-battle-authority-v1` | lock/KO claim、只读 presentation | battle/garbage/KO/result | Server coordination fallback | seq + placementSeq + attackId；snapshot resume | stale/duplicate/unknown fields rejected | `qa/tetris-battle-protocol.js`、Tetris focused E2E |
| `tetris-rule-v3` | `tetris_action(matchId,seq,action)` | `tetris_rule_state`, `tetris_rule_battle`, `tetris_result` | Shared Tetris Rule Core + Advanced Battle Score v1 | per-player seq + state hash + full snapshot | `ERR_*`；旧 v2/未协商客户端回退 v1 Coordination，避免严格字段白名单拒绝新状态 | `qa/tetris-rule-core.js`、`qa/rule-authority.js`、`qa/rule-authority-online.js` |
| `xiangqi-clock-v1` | `move(matchId,seq,from,to)` | `clock_state`, timeout | Server clock fallback | move seq；clock snapshot | stale/not-turn rejected | `qa/xiangqi-clock.js` |
| `xiangqi-rule-v2` | `xiangqi_action(matchId,seq,from,to)` | `xiangqi_rule_state`, `xiangqi_result` | Shared Xiangqi Rule Core + clock | per-player seq + board hash + snapshot | illegal/stale/not-turn explicit `ERR_*` | `qa/xiangqi-rule-core.js`、`qa/rule-authority-online.js` |
| `monopoly-auction-v1` | open/bid/turn-end + host stable state | auction events | Auction subsystem fallback | auction revision/bidId + snapshot | deadline/revision/property errors | `qa/monopoly-auction.js`、`qa/spectator-room.js` |
| `monopoly-rule-v2` | `monopoly_action(matchId,seq,action)` | `monopoly_rule_state`, `monopoly_result` | Shared Monopoly Rule Core | per-player seq + state hash + full snapshot | invalid state/action/deadline explicit `ERR_*` | `qa/monopoly-rule-core.js`、`qa/rule-authority-online.js` |
| `spectator-room-v1` | join/leave only | initial snapshot、`spectate_left` 离席确认 + room/game events | Server read-only seat | room/match snapshot on reconnect；离席确认触发本地 Shell/表达清理 | all mutation rejected | `qa/spectator-room.js`、`qa/social-match-online.js` |
| `tournament-orchestrator-v1.1` | create/consent/start、self-forfeit；管理员 target recovery | state、match assignment、bye、forfeited/recovered | Server pairing + real room + result adapter | pairing/binding/result guard；uid-bound target；participant reconnect | participant 只能弃权自己；管理员必须明确 targetUid；赛事不进入普通经济/胜场 | `qa/tournament.js`、`qa/tournament-auto-room.js`、`qa/tournament-auto-online.js`、`qa/tournament-recovery-online.js` |
| `replay-v1.1` | list/get/share/unshare | metadata、bounded move log、一次性明文分享令牌 | Server privacy/expiry guard | 7 天过期；公开延迟；分享只持久化哈希且可撤销 | 原始 ID 不绕过延迟/私密权限；非参与者不能创建分享 | `qa/daily-tasks.js`、`qa/replay-sharing.js` |
| `game-cosmetic-presentation-v1` | Profile equipped IDs | started/rejoined/spectator presentation | Public presentation only | `cosmeticSchemaVersion=1`；unknown ID fallback | 不广播 owned/price/balance/purchase | `qa/game-cosmetic-profile.js` |
| `shop-purchase-feedback-v1` | `purchase(category,id,requestId)` | 既有 `purchase_ok/error` 回显 `requestId/category/id` | Server price/balance/owned authority；客户端只显示状态 | `requestId` 服务端幂等，客户端再绑定账号与商品；关闭/断线/注销清理局部 pending | 旧服务端无关联字段时 fail-closed，不覆盖新请求；发布时先后端再前端 | `qa/shop-purchase-feedback-contract.js`、`qa/security-online.js` |
| `direct-chat-v1` | `chat_list/history/send/read` | `chat_state/history/message/send_ok/read_ok/error` | Server identity、friend/block、ID/seq/time authority | `(senderUid,clientMessageId)`；账号级单调已读；重连拉摘要/历史 | 访客、陌生人、Block、越权历史、伪造身份、超长/冲突 ID 拒绝；旧客户端忽略 | `qa/player-chat-contract.js`、`qa/player-chat-online.js` |
| `playline-v1` | `playline_list/publish/remove` | `playline_state/publish_ok/remove_ok/invalidated/error` | Server author/time/visibility/reference/cursor authority | `(authorUid,clientPostId)` 幂等；签名 keyset cursor；重连重新拉取 viewer-specific feed | 默认关闭；guest/test-admin/Block/伪造结果或记录/篡改 cursor 拒绝；生产 All 需真实持久化与内容治理 | `qa/playline-contract.js`、`qa/playline-supabase-contract.js`、`qa/playline-online.js` |
| `profile-compare-v1` | `profile_compare(uid,requestId)` | `profile_compare_data/error` | Server formal-account、current-friend、bidirectional Block 和窄化投影 authority | `requestId + targetUid` 绑定当前请求；换号/断线/取消丢弃迟到回执 | 访客、陌生人、解除好友、任一方向 Block、畸形 requestId 拒绝；禁止私有经济/任务/回放/凭据字段 | `qa/profile-compare-contract.js`、`qa/profile-compare-online.js` |
| `match-expression-v1` | `match_expression(matchId,eventId,kind,expressionId,targetSeat?)` | `match_expression/ok/error` | Server session/seat/sender/time、白名单、频控与 Block authority | `senderUid|eventId` 单局有界幂等；重连不补历史表达 | 仅正式真人玩家发送；观众/访客/错误 match/非法 ID/目标/Block 拒绝；不写 moveLog/Replay/奖励/数据库 | `qa/social-match-contract.js`、`qa/social-match-online.js` |
| `match-chat-v1` | `match_chat_send(matchId,messageId,text)` / `match_chat_sync(matchId)` | `match_chat_state/message/ok/error` | Server session/seat/sender/time、NFC/控制符净化、160 字/4 行、频控与逐接收者 Block authority | `senderUid|messageId` 单局有界幂等；服务端内存保留最近 50 条，重连显式同步 | 仅正式真人玩家发送；观众/访客只读；不写 moveLog/Replay/奖励/AI/Analytics/数据库 | `qa/match-chat-contract.js`、`qa/match-chat-online.js` |

## Capability 与错误

- 客户端在 `hello.payload.capabilities` 声明版本；服务端同时接受连字符 ID 与下划线 capability 别名。
- 新规则消息进入未协商/未激活房间时返回 `ERR_PROTOCOL_VERSION`；非法动作使用 `ERR_INVALID_MOVE`、`ERR_NOT_ACTIVE_PLAYER`、`ERR_STALE_SEQ`、`ERR_DUPLICATE_ACTION`、`ERR_MATCH_FINISHED`、`ERR_INVALID_STATE` 等统一代码。
- `ENABLE_RULE_AUTHORITY_V2=0` 关闭三套共享权威；`TETRIS_GUIDELINE_SCORING=0` 只让 Tetris v3 回退 v1 Coordination。两者都不会把 v1 描述成完整规则权威。
