# 六款游戏 Gameplay Upgrade 一次性实施报告

> 完成时间：2026-08-07 18:28（Asia/Tokyo）  
> 输入：《Mini Games 六款游戏 Gameplay Upgrade》v1.0  
> 对照：`WHITEPAPER.md`、现成 v3.0 DOCX 白皮书、六款当前源码、当前 WebSocket 房间边界

## 1. 我的核心考虑

本轮选择“游戏侧能力立即落地，共享平台能力如实留依赖”。原因是当前联机架构是客户端持有完整状态、服务端中继走子；如果只在游戏文件里宣称已经具备权威实时竞技、观战席位或赛事编排，会产生错误安全承诺。

因此采用以下取舍：

1. 坦克正式改为实时 Arena，俄罗斯方块正式改为同步生存战，保留旧消息格式兼容，但不假装当前中继已达到竞技级权威同步。
2. 六款统一实现游戏侧 Spectator 只读、状态恢复、Match Stats、公共棋盘主题和按玩家 Cosmetic 映射；不接账号、商城或价格。
3. 五子棋/象棋的 3–4 人 Round Robin、5+ Swiss 只提供比赛接口和依赖说明，不把多人挤进一张双人棋盘。
4. 规则状态和表现状态分离；俄罗斯方块 `wells` 始终是 `0/1`，皮肤只在 `serialize().presentation`。
5. 保留现有合法规则和联机兼容。升级稿与当前规则冲突时，优先不悄悄改规则。

## 2. 已实现

### 五子棋

- Classic/Grass 公共棋盘；Classic/Glow 按玩家棋子皮肤。
- Hover Ghost、Last Move、落子反馈、五连高亮连线、Turn HUD。
- Spectator 输入隔离；`startMatch/setSpectators/reportGameResult` 赛事接口。
- `serialize/onRestore/getMatchStats`，恢复后无需重播动画。

### 飞行棋

- Classic/Grass；基地、飞机、骰子按玩家映射两套原型。
- 3D 骰子；逐格移动表现；起飞、撞击、归位差异反馈。
- 修正终点超点折返；逻辑位置与飞行动画分离。
- Spectator、恢复、完成数/撞击/起飞/名次统计；超过单桌能力声明 `MULTI_TABLE_REQUIRED`。

### 迷你大富翁

- Classic/Grass；Character/Car 按玩家 Token。
- 中央 Turn HUD、领先者与 Net Worth、现金/身份/地产/建筑摘要。
- 地产 Owner 色条与玩家标识；逐格移动；现金变化来源；机会卡中央翻牌表现。
- Net Worth 身份和按净资产排名；Spectator、恢复和 Match Stats。

### 坦克大战

- 原轮流移动废弃，改为固定 50ms 模拟步长的实时 Deathmatch。
- WASD/方向键、自动触控摇杆、Fire；多人 `tanks[]`。
- 炮口闪光、炮弹、墙体破坏、命中、伤害、击毁、2 秒重生、1.5 秒无敌。
- 3 分钟，Kills → Deaths → Damage 排名；春夏秋冬纯视觉战场。
- 短期履带/焦痕/爆炸对象限量；Spectator、恢复和完整 Match Stats。

### 俄罗斯方块

- 原轮流落块废弃，改为 Simultaneous Survival Battle。
- 自己大井、前三名对手 Mini Board、其余 Compact Status、观众切换观察对象。
- 7-Bag、左右、Soft/Hard Drop、双向旋转、Hold、Ghost、Next。
- Double/Triple/Tetris 垃圾攻击、650ms Incoming、优先抵消、Alive Ring。
- KO 后自动观战、最后存活者获胜、5 分钟兜底；按 KO 时间/高度/Lines/Score 排名。
- `wells` 二值不变；Classic/Neon Block、Classic/Grid Background 只在表现层。

### 象棋

- Classic/Grass；Classic Wood/Jade 按阵营棋子皮肤。
- Last Move 起终点、选棋、合法落点、可吃轮廓、移动浮起表现、Captured Pieces。
- 将军文字/轻反馈、Turn HUD。
- Casual/Rapid/Blitz 棋钟 UI 与状态 API；本地棋钟可运行，联机明确为非权威。
- Spectator、赛事接口、恢复和完整 Match Stats。

## 3. 与原稿存在的出入及原因

| 原稿要求 | 当前结果 | 原因 |
|---|---|---|
| 六个 Agent 并行 | 本次顺序实施 | 当前侧会话禁止使用子 Agent；不影响产品结果 |
| 五子棋/象棋实际 Round Robin/Swiss | 只完成游戏侧比赛/观战/报告接口 | 房间仍是 2–5 玩家席位，没有赛事编排、分桌与跨局积分生命周期 |
| 好友点击后直接观战 | 只完成六款游戏的只读观战能力 | 好友入口、观战席位、延迟和人数属于房间/WS 公共能力 |
| 飞行棋特殊飞行捷径 | 未增加新捷径规则 | 当前代码与白皮书的飞行棋规则没有捷径；擅自新增会改变既有合法规则。起飞、逐格、撞击和归位表现已完成 |
| 大富翁 5 秒 Quick Auction | 未接入联机；标记依赖 | 当前 WS 只信任当前行动者的 move，缺少非当前玩家报价、权威 deadline、断线恢复协议 |
| 大富翁建筑数量/建筑标识 | UI/Stats 已预留，当前恒为 0 | 当前迷你规则没有买房升级/建筑规则，不为满足 UI 擅自扩充经济规则 |
| 大富翁 Camera Follow | 未启用 | 当前 24 格圆形棋盘完整显示在单屏，强制镜头移动反而降低可读性 |
| 坦克竞技级实时同步 | 游戏侧实时、联机中继可用；未做权威校正 | 需要服务端 tick、输入序列、碰撞裁决与快照校正；本轮明确禁止改服务端 |
| 坦克鼠标独立炮塔 | 未实现 | 属于 P1；V1 采用坦克方向=炮口方向，优先稳定实时循环 |
| 俄罗斯方块权威垃圾/KO 共识 | 游戏侧事件与 E2E 已实现；未做服务端权威 | 需要 startAt、placementSeq、attackId 幂等和最终排名共识协议 |
| T-Spin/Combo/B2B | 未实现 | 原稿列为后续扩展，不属于本轮 P0 |
| 象棋联机权威棋钟 | UI/API 已实现，联机不宣称权威 | 需要服务器时间、超时裁决和重连补偿 |
| 游戏皮肤接商城 | 未实现 | 原稿明确禁止本任务修改商城/账号；当前仅提供按玩家 `setCosmetic/renderCosmetic` |

## 4. 白皮书差分结论

- 白皮书仍把“回放/观战、锦标赛”列为后续；本轮已提前完成六款游戏侧观战与赛事接口，但平台入口和分桌仍未完成。
- 白皮书把坦克/俄罗斯方块列为可深化游戏；升级稿进一步确定实时 Arena 与同步生存战，本次代码已采用升级稿作为最终玩法方向。
- 白皮书已有五子棋和俄罗斯方块 P0 美术纵切；本轮保留资源 flag/fallback，并为六款补了代码级主题与 Prototype Cosmetic，没有制造新的付费资产。
- 白皮书当前人数表仍受平台 Registry 限制；游戏内部已使用数组化玩家状态，但没有跨任务放宽房间/Registry 上限。
- 现成 DOCX 在对比时被 Word 进程占用，本轮没有强制关闭 Word 或覆盖文档；差分与裁决落在 `requirements/`，避免破坏用户正在打开的文件。

## 5. 测试结果

- 六款语法检查：通过。
- `qa/gameplay-upgrade.js`：28 项专项断言全部通过。
- `qa/dom-smoke.js`：全部通过。
- `qa/ai-games.js`：六款 AI 状态机全部通过。
- `qa/e2e-online.js`：全部通过，包含实时坦克双方同时输入、射击广播、俄罗斯方块双方无轮次落块与逻辑井同步。
- 奖励、安全、重连、Supabase 适配回归：在本轮完整测试中全部通过；失败只曾出现在旧坦克/俄罗斯方块回合制 E2E 断言，更新为新玩法后通过。

自动化 DOM 桩覆盖 Desktop/触控输入逻辑和滚动锁；尚未在多台真实手机/平板上完成帧率、横竖屏、震动和长局热性能手工验收。

## 6. 本轮未修改的禁止区域

- 未修改 `server/index.js`、奖励引擎、账号/PIN、商城、好友、Supabase schema、三语言基础设施或 WebSocket 主分发器。
- `public/index.html` 由既有 `scripts/build.js` 生成，不是手写公共壳改造。
- 没有重新加入已删除的井字棋、弹珠跳棋、国际跳棋、斗兽棋或贪吃蛇；仓库中它们保持删除状态。

## 7. 后续共享依赖

后续真正完成平台级闭环时，按优先级实施：

1. `REALTIME_TANK_PROTOCOL_V1` 与 `TETRIS_BATTLE_PROTOCOL_V1`。
2. `SPECTATOR_ROOM_V1`。
3. `TOURNAMENT_ORCHESTRATOR_V1`。
4. `XIANGQI_CLOCK_PROTOCOL_V1` 与 `MONOPOLY_AUCTION_PROTOCOL_V1`。
5. `GAME_COSMETIC_PROFILE_V1`。

这些项目不属于遗漏，而是已明确隔离的跨模块工作；在对应服务端/房间协议完成前，不应宣传为权威竞技、完整锦标赛或商城皮肤闭环。
