# Gameplay V2 Shared Protocol 设计（第二阶段历史设计）

> 第三阶段提示：本文件保留 v1 兼容协议的设计依据。默认新客户端现协商 `tetris-rule-v3`（高级战斗计分）、`xiangqi-rule-v2`、`monopoly-rule-v2`；旧 Tetris v2 客户端回退 v1 Coordination。赛事也已接通自动真实房间和单盘服务端结果；当前注册表见 `PROTOCOL_REGISTRY.md`。

> 实施状态：V1 已接入服务端、前端与专项 QA；本文描述当前主路径及仍保留的真实边界，不再把旧 host relay 当作正式路径。

## 1. 版本与能力协商

服务端 `hello_ack.capabilities` 增加：

- `tank_authority_v1`
- `tetris_battle_authority_v1`
- `spectator_room_v1`
- `tournament_orchestrator_v1`
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

- S→C `started.gameplay`：`protocol/startAt/matchSeed/rulesetVersion/matchEndAt`。
- C→S：`tetris_lock_claim {matchId, seq, placementSeq, attackId, linesCleared, attack, score, lines, boardHeight, stateHash}`。
- S→C：`tetris_battle {attackId, source, target, amount, cancelled, incoming, revision}`。
- C→S：`tetris_ko_claim`；S→C：`tetris_ko`、`tetris_result`。
- 服务端决定目标、Cancel、Incoming、KO 顺序和最终排名；不重放完整方块规则。

## 4. Spectator

- C→S：`spectate_join {roomId, matchId}`、`spectate_leave`（服务端兼容旧字段 `room`）。
- S→C：`spectate_joined {room, game, gameplay, presentation, gameSnapshot, moveLog, players, cosmetics}`。
- spectators 不占 player seat、没有 player index、不参与结果、任何 gameplay mutation 在服务端拒绝。
- V1 `spectatorDelayMs=0`，已实现延迟发送队列；`maxSpectators` 默认 12，可用环境变量调整到 1–50。

## 5. Tournament

- 赛事状态独立于 game state：waiting→round_ready→round_playing→round_complete→finished。
- 3–4 人 Round Robin；5+ 三轮 Swiss，避免重复、每人最多一次 Bye。
- 赛事积分 3/1/0，与 💵/XP 完全无关。
- 本节保留 V1 设计基线；当前 `tournament-orchestrator-v1.1` 已完成全员同意后自动建真实房、席位分配、单盘服务端结果回传、自动推进下一轮、Bye 与重连恢复。生产赛季、跨实例编排和高级延迟观战仍未完成。

## 6. Xiangqi Clock

- `started.gameplay.clock` 携带 protocol、remainingMsByPlayer、activePlayer、turnStartedAt、serverNow。
- 服务端在接受可信顺序 move 时扣时并切换；广播 `clock_state`。
- timeout 由服务端产生 `clock_timeout`；断线期间继续走。

## 7. Monopoly Auction

- 当前玩家 `pass` 后发送 `monopoly_auction_open`，服务器打开默认 5 秒拍卖并广播 `auction_open`。
- 所有 eligible 玩家发送 `monopoly_bid`；服务器校验 amount/revision/局内 cash snapshot。
- deadline 关闭后广播 `auction_closed` 及 winner/price/property；客户端只修改局内 money/owner。
- 不接平台 💵，不新增建筑系统。

## 8. Cosmetic Presentation

- 开局 metadata 仅广播每个 slot 的公开 Cosmetic ID。
- 未知 ID、资源失败都由游戏消费端回退默认；不得广播 owned 列表。

## 9. Reward 与 AI 学习边界

- Gameplay Authority 只产生可信状态、排序或超时结果；正式 💵/XP/等级/连胜/胜场仍统一交给 `server/reward-engine.js` 的 Reward Resolver，客户端不得按协议事件自行加奖。
- Tournament 的 3/1/0 赛事积分独立于正式经济；`tournament-orchestrator-v1.1` 已自动建真实房、分配席位、接收单盘服务端结果并推进下一轮，生产赛季与跨实例编排仍未完成。
- `personal-linear-v2` 只学习服务端票据绑定的有效人机局，并按账号 × 游戏隔离；胜局强化、败局反事实修正、平局中性反馈，无效局只审计。
- JSON 是本地/单实例回退；Supabase `apply_reward_v1` / `apply_ai_learning_v1` 的真实迁移、RLS 与并发尚未验收，完成版本冲突重算或单写者改造前保持 Render 单实例。
