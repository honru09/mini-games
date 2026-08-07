# Mini Games 六款游戏 Gameplay Upgrade 差分与决策

> 日期：2026-08-07  
> 输入：《Mini Games 六款游戏 Gameplay Upgrade》v1.0  
> 对照：`WHITEPAPER.md`、现成 v3.0 DOCX 白皮书、六款运行时源码与当前联机边界  
> 原则：代码是事实基线；升级稿决定产品方向；不得跨界修改奖励、账号、商城、Supabase 或大厅。

## 1. 总体结论

升级稿与白皮书在产品方向上基本一致：白皮书已经把坦克/俄罗斯方块列为实时或连续输入游戏，把 Ghost/Hold、垃圾行、棋钟、观战、皮肤和更强 Game Feel 列为目标。主要差异是优先级：白皮书把完整观战、赛事和实时权威协议放在后续阶段，升级稿将六款游戏的游戏侧能力提升为本轮 P0。

采用以下最优合并方案：

1. 立即实施不依赖平台协议的游戏侧 P0：Classic/Grass、两套原型皮肤、输入锁、状态提示、动画、Spectator 只读、序列化、Match Stats。
2. 坦克实时化与俄罗斯方块同步生存战保留为最终默认方向；先完成游戏侧状态机和输入/事件接口，不能把当前房间中继伪装成竞技级权威服务器。
3. 五子棋/象棋多人赛事只实现 `startMatch / setSpectators / reportGameResult` 与配对计划，不改房间容量或奖励。
4. 棋盘主题是游戏内公共 `boardTheme=classic|grass`，与平台六套 UI 主题并存；不接商城、不做 ownership。
5. 玩家皮肤只实现 `setCosmetic / renderCosmetic`，不写购买、价格或账号字段。
6. 所有新增表现状态不得进入规则判定；`deserialize()` 必须可直接恢复最终局面并跳过动画。

## 2. 冲突与裁决

| 主题 | 当前白皮书/代码 | 升级稿 | 裁决 |
|---|---|---|---|
| 平台主题与棋盘主题 | 平台有六套 UI 主题；五子棋/俄罗斯方块已有 P0 底材 | 每款游戏仅 Classic/Grass 公共棋盘 | 两套系统分离；游戏只接收 `classic|grass`，不替换平台主题 |
| 棋盘 ownership | 白皮书允许未来棋盘/骰子皮肤 | 当前明确不做玩家专属棋盘 | 采用升级稿；本轮棋盘对所有参与者和观众一致 |
| 玩家 Cosmetic | 现有商城没有游戏专属皮肤权威字段 | 每个 slot 两套原型皮肤 | 只实现游戏侧接口和 fallback，不接商城/价格/账号 |
| Spectator | 白皮书列为未来平台能力；当前房间只有玩家席位 | 六款必须支持只读观战 | 立即实现游戏侧 `opts.spectator`、序列化和只读输入；加入/离开/延迟策略列共享依赖 |
| 五子棋/象棋多人 | 当前运行时与服务端均为 2 人 | 3–4 人 Round Robin，5+ Swiss | 不把多人塞入单棋盘；实现赛事编排接口，平台房间与奖励另行接入 |
| 飞行棋人数 | 当前棋盘 2–4 人、固定四种颜色 | 不依赖无限 room size | 保持单桌最多 4 人；超过 4 人输出 `MULTI_TABLE_REQUIRED`，不破坏棋盘 |
| 大富翁 Quick Auction | 当前回合制客户端各自持有状态 | 拒购后 5 秒全员拍卖 | 游戏侧实现确定性拍卖状态；联机非当前玩家出价需要协议能力声明 |
| 坦克模式 | 当前 13×13 回合制双人 | 3 分钟实时 Deathmatch | 采用实时化为最终方向；游戏侧固定 tick、输入、重生、四季和统计为 P0，竞技权威 tick 仍是共享依赖 |
| 俄罗斯方块模式 | 当前多人轮流落块、共享回合 | 同时生存 + Garbage/Cancel/Alive Ring | 采用同步生存战；使用每玩家独立井和放置事件，保留 `0/1` 逻辑井与现有资产 fallback |
| 象棋棋钟 | 当前无权威棋钟 | Casual/Rapid/Blitz | 实现 Clock UI/状态 API；联机权威时间依赖服务器，不由客户端宣称可信 |
| 奖励/经济 | 已实现统一 Reward Resolver、独立胜场与 Supabase 单事务落库 | 本任务禁止游戏直接改奖励 | 游戏只输出 placement 与 Match Stats，不写 `💵`、XP、等级、连胜、胜场、商城或 schema |

## 3. 六款实施决策

### 五子棋

- 保留 15×15 经典规则、520×520 逻辑画布、代码网格和命中区。
- 增加 Classic/Grass 氛围、Classic Stone/Glow Stone、Ghost Preview、Last Move、Turn HUD、≤900ms 胜线表现。
- `spectator` 禁止 Canvas 输入；新增赛事接口和 `getMatchStats()`。
- 不实施禁手；白皮书将其定义为未来可选规则，升级稿也要求不修改经典核心。

### 飞行棋

- 保持 2–4 人单桌和终点折返规则；逐格移动、起飞、撞击、终点演出只属于表现层。
- 增加公共棋盘、基地/飞机/骰子两套原型皮肤、Spectator 与 Match Stats。
- 超过 4 人由平台分桌，游戏返回 `MULTI_TABLE_REQUIRED`。

### 迷你大富翁

- 保持 24 格、局内资金与平台 `💵` 严格分离。
- 增加 Turn HUD、资产摘要、Owner 头像/色条、逐格移动、买房/卡牌/现金变化、Net Worth 身份和 Spectator。
- Quick Auction 采用确定性递增报价与 5 秒状态；联机出价桥接列共享依赖。

### 坦克大战

- 废弃默认轮流移动，采用固定 tick 的实时 Arena。
- P0：键盘、自动触控控制、射击链路、2 秒重生、短暂无敌、3 分钟、四季纯视觉、对象数量上限、多坦克数组、Spectator、Match Stats。
- 不加入天气属性、独立炮塔、Power Up。

### 俄罗斯方块

- 废弃轮流落块，采用每玩家独立 10×18 井的 Simultaneous Survival Battle。
- P0：7-Bag、Hold、Ghost、Next、Garbage Attack/Cancel、Incoming Meter、Alive Ring、KO 观战、5 分钟兜底、主井 + Mini Board、Match Stats。
- `wells` 继续只保存 `0/1`；皮肤类型和动画不得写入规则快照。

### 象棋

- 保持传统 9×10 合法走法规则。
- 增加 Classic/Grass、Classic Wood/Jade、Last Move 起终点、合法点/可吃轮廓、移动/吃子、Captured Pieces、将军提示、Turn HUD、Spectator、Match Stats。
- Casual/Rapid/Blitz 只实现游戏侧 Clock State API；联机权威棋钟列共享依赖。

## 4. Shared Dependencies

以下能力不能在本任务内通过改游戏文件安全完成：

- `SPECTATOR_ROOM_V1`：只读席位、加入/离开、延迟、人数与聊天权限。
- `TOURNAMENT_ORCHESTRATOR_V1`：Round Robin / Swiss 配对、分桌、积分和跨局生命周期。
- `REALTIME_TANK_PROTOCOL_V1`：服务器时间、输入序列、快照/校正、权威碰撞或可验证事件。
- `TETRIS_BATTLE_PROTOCOL_V1`：同时开局时间、放置序号、垃圾事件幂等、KO/最终排名共识。
- `MONOPOLY_AUCTION_PROTOCOL_V1`：非当前玩家报价、倒计时权威时间、断线处理。
- `XIANGQI_CLOCK_PROTOCOL_V1`：权威棋钟、超时结果和重连补偿。
- `GAME_COSMETIC_PROFILE_V1`：未来由账号/商城提供已装备皮肤，本轮只定义游戏侧输入。

## 5. 完成闸门

每款游戏只有同时满足以下条件才可在专项日志写“完成”：

- 规则/输入/动画分离；
- `serialize/deserialize` 恢复正确；
- Spectator 无输入；
- Cosmetic 不改变 hitbox/规则；
- reduced-motion 有静态路径；
- `getMatchStats()` 完整；
- 单游戏测试通过；
- DOM、AI、联机回归未破坏；
- Shared Dependency 未被伪装为已完成。

## 6. 2026-08-07 最终实施状态

| 游戏 | 游戏侧 P0 | 自动化验收 | 仍需共享能力 |
|---|---|---|---|
| 五子棋 | Classic/Grass、按玩家棋子皮肤、Ghost、Last Move、胜线、Turn HUD、Spectator、赛事接口、恢复、统计 | 通过 | 实际 Round Robin/Swiss 分桌与积分 |
| 飞行棋 | Classic/Grass、按玩家基地/飞机/骰子皮肤、3D 骰子、逐格移动、起飞/撞击/归位反馈、终点折返、Spectator、恢复、统计 | 通过 | 5 人以上分桌；现有规则没有飞行捷径 |
| 迷你大富翁 | Classic/Grass、按玩家 Token、Turn HUD、资产/Owner/领先者、逐格移动、现金来源、卡牌、Net Worth 身份、Spectator、恢复、统计 | 通过 | 联机 Quick Auction 协议；当前规则无建房升级 |
| 坦克大战 | 固定 tick 实时 Arena、WASD/方向键/摇杆/射击、多坦克、命中/击毁/重生/无敌、3 分钟、四季、Spectator、恢复、统计 | 通过 | 服务器权威 tick、输入序列、快照校正 |
| 俄罗斯方块 | 同步生存、主井+Mini Board、7-Bag、Hold/Ghost/Next、Garbage/Cancel/Alive Ring、KO 观战、5 分钟、恢复、统计 | 通过 | 权威同步开局、垃圾幂等、KO/排名共识 |
| 象棋 | Classic/Grass、按阵营棋子皮肤、Last Move、合法点/可吃轮廓、移动表现、Captured、将军、Turn HUD、Casual/Rapid/Blitz UI/API、Spectator、恢复、统计 | 通过 | 服务端权威棋钟；实际赛事分桌编排 |

实现没有修改奖励、账号、商城、Supabase schema、好友关系或服务端消息分发。`public/index.html` 仅由既有构建脚本从当前模板和源码重新生成。
