# Gameplay Upgrade 第二阶段真实仓库审计

> 审计时间：2026-08-07（Asia/Tokyo）  
> 输入：第二阶段总控执行指令 v2.0、上一轮一次性实施报告、当前工作树源码与 QA  
> 原则：以当前代码行为为事实基线；工作树已有大量用户/其他任务改动，本轮只做增量接入，不回退或覆盖较新的正确实现。

## 1. 基线结论

上一轮报告中的六款游戏侧 P0 均真实存在，当前 `qa/gameplay-upgrade.js`、`qa/dom-smoke.js`、`qa/ai-games.js` 全部通过。当前代码还在上一轮报告之后增加了两套“休闲房主客户端中继”能力：

- Tank：`tank-host-relay-v1`，房主周期广播快照，服务端仅校验房主身份与消息序号。
- Tetris：确定性 7-Bag、placement seq、attackId 去重、房主周期 sync/最终排名。

它们改善了休闲房间收敛和重连，但碰撞、伤害、垃圾、KO 和最终排名仍由客户端或房主客户端决定，不能称为 Server Authority。

## 2. 未完成矩阵

| 项目 | 上一报告状态 | 当前代码实际状态 | 本轮动作 |
|---|---|---|---|
| 六款游戏 P0 | 游戏侧完成 | 真实存在，基线 QA 通过 | 冻结规则，修复接入问题，不推倒重写 |
| Tank realtime | 游戏侧完成 | 50ms 固定步长、多坦克、重生、3 分钟真实存在 | 保留 |
| Tank 网络 | 未完成 | `tank-host-relay-v1`；房主客户端算碰撞/排名，服务端只校验 seq | 替换为服务端 20Hz 模拟、输入序列、快照、伤害/重生/结果权威；客户端预测/校正 |
| Tetris battle | 游戏侧完成 | 同步生存、Garbage/Cancel/Alive Ring、确定性 Bag 真实存在 | 保留 |
| Tetris 网络 | 未完成 | `casual-host-relay-v1`；房主客户端协调垃圾、KO、最终名次 | 实现服务端 startAt/seed、attackId、目标、垃圾队列、KO/placement、超时结果；明确只到 Battle Coordination Authority |
| Spectator game | 游戏侧完成 | 六款均能 `setSpectators()` 且输入只读 | 保留 |
| Spectator room | 未完成 | 房间只有 `clients` 玩家 Map；大厅不显示进行中房间 | 实现独立 spectators、加入/离开/重连、上限、快照、服务端输入拒绝 |
| Tournament adapters | 游戏侧接口完成 | 五子棋/象棋有 `startMatch/reportGameResult` | 保留 |
| Tournament platform | 未完成 | 无赛事状态、配对、多桌、积分或重连 | 新增纯编排模块与 WS 生命周期；3–4 Round Robin、5+ 三轮 Swiss |
| Xiangqi local clock | 游戏侧完成 | Casual/Rapid/Blitz UI/API 真实存在 | 保留 |
| Xiangqi server clock | 未完成 | 联机 `authoritative:false`，服务器不计时 | 实现服务器时间基准、move 切钟、timeout、重连状态 |
| Monopoly auction | 未完成 | pass 后直接结束购买阶段；无 auction state/message | 实现服务端开拍、报价、revision、deadline、重连与局内所有权结果 |
| Cosmetic consumer | 游戏侧完成 | 六款 `setCosmetic()` 有 fallback/按玩家映射 | 统一 ID 合同与公开 presentation metadata；不改商城/owned |
| Performance/mobile | 自动化部分完成 | 输入锁、对象上限、reduced-motion 已有部分覆盖；无真实设备矩阵 | 增加调试指标与自动化长局；生成 NOT_EXECUTED 真实设备清单 |

## 3. 当前房间与重连事实

- `server/index.js` 单文件约 2400 行，房间为 `{host, clients: Map<session, player>, game, matchId, moveLog...}`。
- `move` 只做可信 player 标注、日志与广播；服务端不模拟六款完整规则。
- 玩家异常掉线保留席位并重放有限 `moveLog`；日志截断则结束当前局。
- 当前没有独立 spectator collection；`joinRoom()` 会拒绝已开始房间。
- 当前没有通用 `game_state` 快照发布；实时游戏重连依赖 moveLog 和房主快照消息。
- 结算仍使用服务端一致 claim 和 Reward Resolver；第二阶段协议不得改奖励公式。

## 4. 协议实施边界

### Tank

目标为 Full Match Authority：服务器维护位置、方向、炮弹、可破坏墙、HP、击杀、死亡、重生、剩余时间与最终排名。客户端只发送输入，保留本地预测；伪造位置/击杀消息不进入权威状态。

### Tetris

目标为 Battle Coordination Authority：服务器维护统一开局、攻击幂等、Alive Ring、Incoming、Cancel、KO、placement 和最终名次。V2 暂不在服务器重放每个 Tetromino 的完整旋转/碰撞，因此不能宣传完整 Rule Authority；客户端仍可能伪造 `linesCleared` claim，服务端只做顺序、范围、频率和状态一致性约束。

### Turn games

象棋服务器只权威棋钟和超时，不宣称权威验证象棋合法走法。大富翁服务器只权威拍卖时序/报价/归属事件，不改变平台货币或新增建筑系统。

## 5. 基线验证

- `node qa/gameplay-upgrade.js`：通过。
- `node qa/dom-smoke.js`：通过。
- `node qa/ai-games.js`：通过。

## 6. 文件所有权与并发保护

本轮允许新增 `server/gameplay/`、Shared Protocol QA、审计/报告/清单；公共接线集中修改 `server/index.js`、`public/src/online/03-websocket.js`、`public/src/ui/07-roster.js`。不修改奖励引擎、账号/PIN、商城购买、Profile UI、Supabase schema 或已删除游戏。
