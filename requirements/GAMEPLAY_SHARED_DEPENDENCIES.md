# Gameplay Upgrade Shared Dependencies

> 六款游戏侧只声明接口，不在 Gameplay 任务中修改奖励、账号、商城、Supabase、全局大厅或服务端权威边界。

| ID | 需要的公共能力 | 输入 | 输出 | 未来归属 |
|---|---|---|---|---|
| `SPECTATOR_ROOM_V1` | 房间只读观战席位 | roomId、viewerUid、delayPolicy | spectator state、join/leave、延迟事件流 | 房间/WS |
| `TOURNAMENT_ORCHESTRATOR_V1` | Round Robin / Swiss 分桌 | participants、round、history | pairings、spectators、standings | 平台赛事 |
| `REALTIME_TANK_PROTOCOL_V1` | 实时输入与状态校正 | matchId、tick、player、input | authoritative snapshot / verified event | 服务端实时层 |
| `TETRIS_BATTLE_PROTOCOL_V1` | 同时开局与垃圾幂等 | startAt、placementSeq、attackId、target | garbage/KO/final placement consensus | WS/结算 |
| `MONOPOLY_AUCTION_PROTOCOL_V1` | 非当前玩家快速报价 | auctionId、bidder、amount、serverTime | accepted bid、deadline、winner | WS/房间 |
| `XIANGQI_CLOCK_PROTOCOL_V1` | 权威棋钟 | matchId、side、serverTime、increment | remainingMs、timeout result | WS/结算 |
| `GAME_COSMETIC_PROFILE_V1` | 已装备的游戏皮肤 | uid、gameId、slot | stable cosmetic IDs | 账号/商城 |

