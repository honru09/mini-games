# Gameplay V2 Shared Protocol 设计

## 1. 版本与能力协商

服务端 `hello_ack.capabilities` 增加：

- `tank_authority_v1`
- `tetris_battle_authority_v1`
- `spectator_room_v1`
- `tournament_v1`
- `xiangqi_clock_v1`
- `monopoly_auction_v1`
- `game_cosmetic_presentation_v1`

`started` / `rejoined` 携带 `gameplay` metadata。旧客户端仍可进入普通棋类房间；Tank/Tetris 新客户端优先专用消息，不再把客户端坐标或客户端最终排名作为权威。

## 2. Tank

- C→S：`tank_input {matchId, seq, clientTick, input}`。
- S→C：`tank_snapshot {matchId, serverTick, serverNow, remainingMs, season, players, projectiles, destructibles, ack}`。
- S→C：`tank_result {matchId, order, stats}`。
- 服务器 20Hz 模拟，快照 10Hz；输入 seq 单调、future tick 有界、每玩家频率限制。
- 客户端本地预测，收到快照后小误差平滑、大误差快速校正；远端坦克使用目标插值。

## 3. Tetris

- S→C `started.gameplay.tetris`：`startAt/matchSeed/rulesetVersion/matchEndAt`。
- C→S：`tetris_lock_claim {matchId, seq, placementSeq, attackId, linesCleared, attack, score, lines, boardHeight, stateHash}`。
- S→C：`tetris_battle {attackId, source, target, amount, cancelled, incoming, revision}`。
- C→S：`tetris_ko_claim`；S→C：`tetris_ko`、`tetris_result`。
- 服务端决定目标、Cancel、Incoming、KO 顺序和最终排名；不重放完整方块规则。

## 4. Spectator

- C→S：`spectate_join {room, matchId}`、`spectate_leave`。
- S→C：`spectate_joined {room, game, gameplay, gameSnapshot, moveLog, players, cosmetics}`。
- spectators 不占 player seat、没有 player index、不参与结果、任何 gameplay mutation 在服务端拒绝。
- V1 `spectatorDelayMs=0`，保留延迟队列字段；`maxSpectators` 默认 20。

## 5. Tournament

- 赛事状态独立于 game state：waiting→round_ready→round_playing→round_complete→finished。
- 3–4 人 Round Robin；5+ 三轮 Swiss，避免重复、每人最多一次 Bye。
- 赛事积分 3/1/0，与 💵/XP 完全无关。
- 第一版提供服务端编排/重连/结果接口；每桌仍复用普通双人 Match。

## 6. Xiangqi Clock

- `started.gameplay.xiangqiClock` 携带 mode、remaining、activePlayer、turnStartedAt、serverNow。
- 服务端在接受可信顺序 move 时扣时并切换；广播 `xiangqi_clock`。
- timeout 由服务端产生 `xiangqi_timeout`；断线期间继续走。

## 7. Monopoly Auction

- 当前玩家 `pass` 后服务器打开 5 秒拍卖，广播 `monopoly_auction_open`。
- 所有 eligible 玩家发送 `monopoly_bid`；服务器校验 amount/revision/局内 cash snapshot。
- deadline 关闭后广播 winner/price/property；客户端只修改局内 money/owner。
- 不接平台 💵，不新增建筑系统。

## 8. Cosmetic Presentation

- 开局 metadata 仅广播每个 slot 的公开 Cosmetic ID。
- 未知 ID、资源失败都由游戏消费端回退默认；不得广播 owned 列表。
