# 六款游戏 Gameplay Upgrade 第二阶段完成报告

> 核对时间：2026-08-07（Asia/Tokyo）  
> 依据：当前源码、`npm test` 最终通过结果、专项协议测试与 `REAL_DEVICE_QA_CHECKLIST.md`。  
> 结论：核心 Shared Protocol 已落地并进入正式主路径，但因真实设备 QA、赛事自动建桌、完整 Tetris Rule Authority 等仍未完成，不能把本轮描述为“原指令全部 100% 完成”。

## 1. 本轮实际完成

- 冻结上一阶段六款游戏基线，没有推倒重写，也没有恢复已删除游戏。
- 新增 Tank 与 Tetris 独立服务端模块；新客户端正式路径不再接受旧房主中继作为结果真相。
- 新增独立 Spectator Seat、赛事编排器、象棋服务端棋钟、大富翁实时拍卖、公开 Cosmetic ID 合同。
- Tank/Tetris 重连直接使用权威快照；回合制游戏增加房主稳定点快照，观众可用快照或 moveLog 中途恢复。
- 进行中房间可从大厅进入观战；观众不占玩家位、不进入结算，所有游戏输入由服务端拒绝。
- 增加协议专项 QA、客户端 Authority QA、完整联机集成、性能计数和真实设备待测清单。

## 2. 每款游戏变化

### 五子棋

- 规则与上一阶段 Gameplay 不变。
- 接入真正房间观战、中途 moveLog/稳定快照、只读隔离和最终结果。
- 3 人以上房间可创建五子棋循环赛/瑞士制赛事；当前结果由赛事面板录入，尚未自动创建单盘房间。

### 飞行棋

- 规则、动画与 AI 不重写。
- 接入通用稳定点快照和 Spectator Room；远端慢动画可直接恢复到房主逻辑稳定状态。
- 减动效、人机/联机回归保持通过；旧同设备多人模式已在后续产品收口中删除。

### 迷你大富翁

- 新增 `monopoly-auction-v1`：当前行动者放弃后开拍，所有 eligible 玩家按 revision 出价，服务端维护截止、当前价、竞价者、局内拍卖现金和产权结果。
- 拍卖关闭后客户端同步产权并进入下一回合；生产默认 5 秒，自动化可用 `MONOPOLY_AUCTION_MS` 缩短等待。
- 房主只在 `roll` 稳定点发布通用快照，避免在 `buy/auction` 中间阶段清空有效控件。
- 没有加入建筑/酒店规则，也没有触碰平台 💵、商城余额或 owned。

### 坦克大战

- 新增 `TankAuthority`：20Hz 固定模拟，服务端维护位置、方向、碰撞、墙体、炮弹、HP、Damage/Kill/Death、2 秒重生、1.5 秒无敌、赛季与最终排名。
- Client 只发送单调 `seq + clientTick + input`；坐标、命中、击杀和名次伪造不生效。
- Client 保留本地即时预测；小误差平滑校正、大误差快速拉回，远端 Tank 使用逐快照平滑插值。
- 权威快照约 10Hz，重连直接恢复比分、剩余时间、赛季、墙体、炮弹和玩家状态。
- 新增 frame/long-frame/object 计数；客户端粒子/炮弹/轨迹上限为 40/128/60，服务端炮弹硬上限 160。

### 俄罗斯方块

- 新增 `TetrisBattleAuthority`：统一 `startAt/matchSeed/rulesetVersion/matchEndAt`、placement seq、attackId 幂等、Alive Ring、Garbage Cancel/Queue/Due、KO、placement 和五分钟兜底结果。
- HUD 显示 `TARGET → Pn`；垃圾只在服务端 `due` 后落入井。
- 每位玩家上传只读棋盘 Presentation 供对手、观众与重连恢复；服务端不把 Presentation 当作攻击/KO/排名真相。
- 明确边界：这是 **Battle Coordination Authority**，不是完整 Tetromino Rotation/Collision Rule Replay Authority。
- 新增长局计数接口：frame、long frame、board/active cell/incoming 数量。

### 象棋

- 新增 `xiangqi-clock-v1`：服务端维护双方剩余时间、当前行动者、turnStartedAt、serverNow、move seq 与 timeout。
- 走子扣时、切钟、重连校准和超时结算均由服务端产生；断线窗口内棋钟继续走。
- 当前服务端只校验坐标、行动者和顺序，不重演完整象棋合法规则；客户端合法层仍是主要规则校验。
- 3 人以上房间可创建象棋赛事，限制与五子棋相同。

## 3. Shared Protocol 与 Authority 边界

| 协议 | 已实现 Authority | 明确不包含 |
|---|---|---|
| `tank-authority-v1` | Tick、移动/碰撞、炮弹、伤害、重生、比分、最终排名 | 高级反作弊、独立炮塔瞄准、真实延迟补偿射击 |
| `tetris-battle-authority-v1` | 开局、Seed、目标、攻击幂等、垃圾、KO、名次、截止 | 服务端逐步重放方块旋转/碰撞/T-Spin |
| `spectator_room_v1` | 独立席位、快照、重进、上限、输入拒绝、结果 | Ranked 延迟观战回放、服务端保存完整录像 |
| `tournament-orchestrator-v1` | 循环赛、三轮瑞士制、Bye、多桌数据、积分/对手分、同步 UI | 自动创建/销毁各桌房间、单盘结果自动回传 |
| `xiangqi-clock-v1` | Server Time、扣时/切钟、timeout、重连 | 完整象棋 Rule Authority、可选 Blitz/Rapid 房间 UI |
| `monopoly-auction-v1` | revision、截止、报价顺序、拍卖账本与产权事件 | 全盘税租/机会卡/现金 Rule Authority、平台经济 |
| `game-cosmetic-presentation-v1` | 公开 ID、按玩家展示、未知 ID fallback | 商城商品、价格、Profile 装备 UI、owned 广播 |

## 4. 未完成

1. **真实设备 QA 未执行。** Android、iPhone、平板的横竖屏、震动、锁屏恢复、发热、真实 FPS 和 Safari 音频仍是退出条件，详见根目录清单。
2. **赛事没有自动建桌。** 编排、积分、UI、多人同步和手工结果闭环完成，但 pairing 尚未自动创建五子棋/象棋单盘房间并回传结果。
3. **Tetris 不是完整 Rule Authority。** 没有服务端重放每个 Piece/Rotation/Lock，也未增加 T-Spin、B2B、Combo。
4. **Tank 没有真实 50/100/200ms、jitter、packet reorder 的设备/网络实验。** 当前有序列、future tick、快照校正、重连和 E2E；远端平滑也不是严格 100–150ms 时间缓冲队列。
5. **象棋服务端不验证完整合法走法。** 棋钟权威不等于棋局权威；权威模式暂为统一 10 分钟环境配置，没有完整模式选择 UI。
6. **大富翁不是全盘服务端规则。** 拍卖顺序/截止/产权权威，但完整局内现金变化仍来自现有客户端规则与房主稳定快照，因此不能宣传成完整防作弊。
7. **Cosmetic 只完成消费合同。** 当前联机 Metadata 使用默认游戏外观 ID，真实游戏专属装备字段仍由商城/Profile 任务链提供。
8. 未实现 Mouse Turret / Right Stick 独立炮塔、赛季赛事、完整录像回放。

## 5. 测试

最终统一命令：

```powershell
npm test
```

结果：**PASS，退出码 0，总耗时 189.6 秒**。统一命令覆盖：

- 构建与 DOM 冒烟；六款 AI 状态机、AI 强度、AI 学习与在线持久化。
- `qa/gameplay-upgrade.js` 客户端 Authority、Spectator、Reduced Motion 与旧玩法回归。
- Tank/Tetris Authority，Spectator/Clock/Auction/Tournament 在线集成及纯逻辑生命周期。
- Reward、Supabase Schema/Adapter、安全、断线重连、完整 20 回合 E2E、WS 主动断开。

专项标志均通过：`TANK_AUTHORITY_ALL_PASS`、`TETRIS_PROTOCOL_ALL_PASS`、`SPECTATOR_ROOM_ALL_PASS`、`TOURNAMENT_ALL_PASS`、`XIANGQI_CLOCK_ALL_PASS`、`MONOPOLY_AUCTION_ALL_PASS`、`E2E_ALL_PASS`、`SECURITY_ALL_PASS`、`RECONNECT_ALL_PASS`。

## 6. 手工 QA

- Desktop 浏览器人工试玩：**NOT EXECUTED**（本轮仅自动化/DOM 桩/真实本地 WebSocket）。
- Android Chrome：**NOT EXECUTED**。
- iPhone Safari：**NOT EXECUTED**。
- Tablet：**NOT EXECUTED**。
- 真实网络整形、锁屏、发热、震动：**NOT EXECUTED**。

因此本报告不写“真实设备完成”。

## 7. 性能

- Tank Server：20Hz；Client Snapshot 约 10Hz；客户端对象 hard cap 已实现。
- 纯逻辑合成基准（非设备 FPS）：5 人 Tank 180 秒 / 3,600 Tick 约 **37.62ms CPU**；5 人 Tetris 1,000 个合法 claim + 5 分钟推进约 **18.13ms CPU**。
- 上述数据只衡量本机 Node 纯逻辑，不含 WebSocket、DOM、布局、绘制、设备温度和后台调度。
- 真实 FPS / long session 数值未执行；只增加了运行时计数接口，待实机清单记录。

## 8. 安全边界

- Tank 正式结果由服务端模拟产生，旧 `move` 坐标/Kill/Final 在新协议下被拒绝。
- Tetris Server 验证 attackId/seq/placementSeq/攻击表并决定 Battle 结果，但恶意客户端仍可能伪造其本地消行事实；完整 Rule Replay 才能进一步收口。
- Spectator 的 UI 与服务端同时只读，不能靠伪造消息占玩家输入。
- Tournament 积分与 💵/XP 完全分离；赛事面板不直接发平台奖励。
- Xiangqi Clock 与 Monopoly Auction 是局部服务端权威，不能外推成整局防作弊。
- Cosmetic Metadata 只广播公开 ID，不广播 owned、价格、余额或 PIN。
- 本轮没有修改 Reward 公式、账号/PIN、商城购买、Profile 装备 UI 或 Supabase 大结构。

## 9. 文件修改

主要新增：

- `server/gameplay/tank-sim.js`
- `server/gameplay/tetris-battle.js`
- `server/gameplay/turn-protocols.js`
- `server/gameplay/tournament.js`
- `qa/tank-authority.js`
- `qa/tetris-battle-protocol.js`
- `qa/spectator-room.js`
- `qa/tournament.js`
- `qa/xiangqi-clock.js`
- `qa/monopoly-auction.js`
- `requirements/gameplay-v2-audit.md`
- `requirements/gameplay-v2-protocol-design.md`
- `requirements/GAME_COSMETIC_PROFILE_V1.md`
- `REAL_DEVICE_QA_CHECKLIST.md`
- 本报告。

主要修改：`server/index.js`、Tank/Tetris/Xiangqi/Monopoly 客户端、WebSocket 客户端、Roster/赛事 UI、Gameplay/E2E/DOM QA、`package.json`、`README.md`、`WHITEPAPER.md`、`AGENTS.md` 和生成的 `public/index.html`。

## 10. 后续建议

1. 先在真实手机/平板按清单执行性能与恢复验收；这是把本轮状态改为“完整完成”的第一前提。
2. 提取无 DOM 的 Tetris Rule Core，让服务端重放 Piece Action，再做 T-Spin/B2B/Combo。
3. 将 Tournament pairing 自动映射到独立 Game Match/Room，并由单盘服务端结果自动回传。
4. 为象棋提取服务端合法规则核心；为大富翁提取全盘局内经济/位置核心，消除当前局部 Authority 边界。
5. 完成真实 Supabase 凭证、RLS、备份/恢复和并发验收后再上线生产持久化。
