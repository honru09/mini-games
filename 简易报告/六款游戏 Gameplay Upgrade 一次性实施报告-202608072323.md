# 六款游戏 Gameplay Upgrade 一次性实施报告

> 最后核对：2026-08-07（Asia/Tokyo）  
> 本报告已按当前源码、服务端协议和专项 QA 更新；旧版本中“仅客户端中继/尚未接入”的段落属于历史记录，不代表当前主路径。
> 第二阶段历史基线见 `简易报告/六款游戏 Gameplay Upgrade 第二阶段完成报告-202608072006.md`；第三阶段当前结论见 `简易报告/六款游戏 Gameplay Upgrade 第三阶段最终完成报告-202608072323.md`。

## 1. 执行结论

本轮已将产品基线收敛为六款：五子棋、飞行棋、迷你大富翁、坦克大战、俄罗斯方块、象棋。井字棋、弹珠跳棋、国际跳棋、斗兽棋、贪吃蛇的运行时模块、注册表和测试入口均已删除。

六款游戏统一具备人机和联机入口，并接入 Spectator、恢复、Match Stats、Cosmetic Presentation、奖励结算和 AI 票据链；旧同设备多人入口已按后续产品决定删除。服务端默认新客户端路径已经升级：Tank 是 `tank-authority-v1` 全实时权威模拟；Tetris、象棋、大富翁分别使用 `tetris-rule-v2`、`xiangqi-rule-v2`、`monopoly-rule-v2` 共享纯 Rule Core。旧 Battle Coordination、棋钟、拍卖和 relay 只作为 capability 不匹配或紧急回滚路径。

## 2. 六款游戏已实现能力

### 五子棋

- Threat-space 搜索：立即成五、立即封堵、双威胁、反击和中心/棋群评分。
- Classic/Grass 棋盘、软 3D 棋子、Hover Ghost、最后落子、胜线和操作反馈。
- 观战输入隔离、`serialize/onRestore/getMatchStats`、赛事接口与按玩家棋子外观。
- AI 只向 DeepSeek 发送近优合法候选；断网仍使用本地强策略。

### 飞行棋

- 起飞、终点、吃子、安全格、发展平衡和骰子期望评分；超点折返规则保持一致。
- 2–4 人、基地/飞机/骰子按玩家映射，逐格移动、撞击、归位、骰子与减动效反馈。
- 观战、恢复、完成数/撞击/起飞/名次统计和三语言 UI。

### 迷你大富翁

- 净资产、现金储备、未来租税风险、地产回报和对手领先差距的可解释决策。
- 角色/车辆、Owner 色条、现金变化来源、机会卡、逐格移动、Net Worth 排名和观战。
- `monopoly-rule-v2` 服务端共享规则：Seeded Dice、移动、现金、产权、租金、机会卡、拍卖、破产、净资产与名次；`monopoly-auction-v1` 作为旧客户端回退，不接平台 💵，不擅自加入建筑规则。

### 坦克大战

- 实时 Arena：固定 50ms 客户端表现循环，WASD/方向键/触控摇杆、Fire、炮弹、墙体、命中、伤害、击毁、重生、无敌和季节视觉。
- AI 影响图、炮弹预测、垂直避弹、无障碍火线、低血/高威胁目标、BFS 侧翼路径；只在近优带中接受模型/人格微调。
- 正式联机使用 `tank-authority-v1`：服务器 20Hz 模拟、输入 seq、碰撞/炮弹/伤害/重生/排名权威、10Hz 快照和重连校正；旧中继只作兼容回退。
- 修复主循环每帧清空并重建棋盘导致的持续闪屏；棋盘、坦克、炮弹、特效和控制器改为稳定渲染树与 keyed 增量更新，reset/destroy 清理瞬态计时器。

### 俄罗斯方块

- Simultaneous Survival Battle：确定性 matchId + 7-Bag、各自大井、前三名 Mini Board、Hold/Next/Ghost、Soft/Hard Drop、旋转、Garbage/Cancel、Alive Ring、KO 和最终名次。
- 本地 AI 使用 Dellacherie 井面特征（落点高度、消行、行/列转换、洞、井深、凹凸）和第二块前瞻；候选特征进入个性化学习。
- 正式联机默认使用 `tetris-rule-v2`：共享 Rule Core 覆盖 7-Bag、Spawn、Move、Rotation、Collision、Hold、Lock、Line Clear、Garbage、Top Out、终局与确定性 hash；`tetris-battle-authority-v1` 仅作兼容回退。
- 修复周期性清空布局/主井/Mini Board 导致的持续闪屏；主井和迷你井使用固定方块池增量更新，并修复重连 presentation 元数据和成功动作广播旧 seq。

### 象棋

- 限宽 Alpha-Beta/Negamax：子力、位置、机动性、将帅安全、将军和高价值吃子评估，合法层过滤自曝将。
- Classic/Grass、Wood/Jade 棋子、选棋/合法点/吃子轮廓、将军反馈、Captured Pieces、观战与恢复。
- `xiangqi-rule-v2` 由共享 Rule Core 验证回合、九宫、河界、马腿、象眼、炮架、兵向、将帅照面、Check 与 Terminal，并与服务端棋钟一并推进；`xiangqi-clock-v1` 是兼容回退。

## 3. AI 专项策略与持续学习

`server/ai-strategy-skills.js` 内嵌六款策略知识包。每款先由本地规则/搜索产生合法近优候选，再让 DeepSeek 在候选带内裁决；无 token、无 Key、超时、限流、断网或非法响应都回退本地最优。

`server/ai-learning.js` 使用 `personal-linear-v2`：

1. 对局中实时记录有限决策缓冲：局面 SHA-256 截断哈希、候选归一化特征、选择、局部排名、模型/技能版本；不保存原始完整局面、PIN、对话或密钥。
2. 有效胜局强化实际选择相对其它近优候选的特征；有效败局回归本地强基线，若本地首选也失败则尝试同一近优带的反事实候选；平局只做小幅中性校正并保留经验。
3. 模型按账号 × 游戏隔离，胜/平/负都会写经验；无效、争议、AFK、秒投对局只审计不调权。`resultId`、revision 和账号/游戏锁防止重放与并发覆盖。
4. 本地 JSON 提供离线开发和 outbox；Supabase `ai_learning_models` / `ai_learning_experiences` 与 `apply_ai_learning_v1` 原子持久化。schema 与 fake adapter 已验证，真实 Supabase 凭证、迁移和生产 RLS/并发/备份回滚仍待执行。
5. 当前 Render 保持单实例；横向扩容前必须为 Reward Resolver 与 AI 学习 outbox 增加数据库内版本冲突重算、单写者或等价一致性机制。

## 4. 共享平台能力

- Spectator 独立席位：中途加入、初始快照、重连、人数上限、可配置延迟发送队列、只读服务端拒绝与最终结果广播。
- `tournament-orchestrator-v1`：3–4 人循环赛、5+ 三轮 Swiss、Bye、对手分、积分快照和重连；已接通在线/busy 检查、真实 6 位房间自动创建、席位分配、单盘 Server Result、自动下一轮。赛事积分与 💵/XP 解耦，客户端手工结果被拒绝。
- `game-cosmetic-presentation-v1`：Profile 保存六款白名单装备 ID 与 schema v1；started/rejoined/spectator 只公开当前局装备，owned/余额/价格/购买记录保持私有，未知 ID 回退默认。
- Reward Resolver v1.0：人机/联机双模式奖励、有效局/AFK/秒投、防刷、首胜、连胜、重复对手衰减、等级曲线、独立 `wins/totalWins`、Reward Breakdown、reward/economy/history/analytics 流水和 Supabase 原子 RPC；旧同设备多人奖励分支已删除。
- 白皮书 × 美术资源：品牌 mark、💵 SVG、五子棋木纹/软 3D 棋子、俄罗斯方块玻璃井/七类纹理/封面已接入；其它四款保持 CSS/Canvas/Emoji fallback，正式资产按清单排期。

## 5. 验证结果

已通过：

- `node scripts/build.js`
- `node qa/dom-smoke.js`
- `node qa/ai-games.js`
- `node qa/ai-strength.js`
- `node qa/ai-learning.js`
- `node --experimental-websocket qa/ai-learning-online.js`
- `qa/gameplay-upgrade.js`、`tank-authority.js`、`tetris-battle-protocol.js`、`spectator-room.js`、`tournament.js`、`xiangqi-clock.js`、`monopoly-auction.js`
- `tetris-rule-core.js`、`xiangqi-rule-core.js`、`monopoly-rule-core.js`、`rule-authority.js`、`rule-authority-online.js`、`protocol-version.js`
- `tournament-auto-room.js`、`tournament-auto-online.js`、`game-cosmetic-profile.js`、`gameplay-load.js`、`gameplay-memory.js`、`timer-audit.js`、`network-chaos.js`
- `reward-system.js`、`supabase-schema.js`、`security-online.js`、`reconnect-online.js`、`supabase-adapter.js`、`e2e-online.js`、`ws-close-test.js`
- 最终 `npm test`：`PASS`，109.8 秒；包含构建、704 个三语言键、361 个静态引用键、i18n runtime、六款游戏、AI、三套 v2 Rule Authority、赛事、负载/内存/计时器、Security、Reconnect、Supabase Adapter、完整 E2E 与 WS Close。
- 关键可靠性门禁：Gameplay、Rule Authority Online、Tournament Auto Online、Reconnect、Spectator、完整 E2E 连续 5 轮全部 `PASS`，总计 374.9 秒，无 `FLAKY`。
- 默认 v2 完整 E2E：大富翁连续 20 次动作双端收敛；Tetris v2 动作、漂移校正与重连；Tank 权威输入、快照、重连与唯一结算均 `PASS`。

真实手机/平板帧率、震动、横竖屏长局和真实 Supabase SQL/RLS/并发/备份回滚仍需要发布环境验收，不能用自动化桩替代。

## 6. 历史差分与明确边界

第二阶段报告中“Tetris 仅 Battle Coordination、象棋仅棋钟、大富翁仅拍卖、赛事未自动建桌”是当时准确的历史基线；第三阶段用渐进式 v2 capability 和 v1 回退解决这些缺口，没有破坏旧客户端。仍未完成/未执行的是：真实设备矩阵、真实 `tc/netem` 网络整形、30 分钟真实 Synthetic Session、真实 Supabase 迁移/RLS/并发/备份回滚、Tetris T-Spin/B2B/Combo/Perfect Clear、Replay UI、赛事 Forfeit/Admin Recovery 专用 UI、好友/聊天/举报、赛季、多实例一致性与跨端发行。

本报告不把客户端签名、中继兼容、逻辑 Chaos 桩或 DeepSeek 的语言回答当成防作弊/真实网络/规则权威；当前边界以 `requirements/AUTHORITY_MATRIX.md`、`requirements/PROTOCOL_REGISTRY.md`、`WHITEPAPER.md` 和源码为准。自动化通过不等于 `PRODUCTION_READY`，当前 RC 因实机与真实网络闸门保持 `BLOCKED`。

## 7. 第三阶段考虑与取舍

1. 没有推倒第二阶段协议：默认新客户端通过 capability 进入三套 v2 Rule Authority，v1 保留为可测试、可回滚的兼容路径。
2. Tank/Tetris 闪屏按根因修复：保留主循环频率，消除每帧/周期性 DOM 重建，使用稳定节点和对象池；因此没有用降低帧率掩盖问题。
3. 全量 E2E 改测默认 v2 主路径；v1 Auction/Clock/Battle 仍由各自专项、安全和观战测试覆盖，避免用子系统权威冒充完整规则权威。
4. 大富翁回归过程中额外修复两类真实问题：未验证 snapshot 先污染 `monopolyTurn`；v2 购买按钮读取静态 Rule Cell 的不存在 owner 字段，并补上 server roll 的防重复点击等待态。
5. 观众跨桌采用有序 `spectate_leave → spectate_join`，服务端现有玩家席/同账号/人数限制继续生效，没有为赛事另造一套观战权限。

## 8. 未实现与原指令出入

- 真实 Desktop Chrome/第二浏览器、Android、iPhone、Tablet：未执行，原因是当前环境没有对应实机与可审计录像/性能数据。
- 真实 `tc/netem`/等价 50/100/200ms、jitter、loss、reorder：未执行；现有 `qa/network-chaos.js` 只证明 duplicate/stale/reorder 逻辑拒绝。
- 30 分钟真实 Synthetic Session：未执行；1000 次纯逻辑生命周期内存测试不能替代它。
- 5/6 人多桌赛事的真实 WebSocket 全生命周期、赛事专用 Forfeit/Admin Recovery UI 和外部观众多桌切换 E2E：核心编排/自动房/结果/下一轮与切桌入口已实现，但这些组合场景证据仍不完整。
- Tetris T-Spin/B2B/Combo/Perfect Clear 与产品化 Replay UI：按第三阶段 P2/后续顺序保留，未阻塞本次 P0 Rule Core。
- 真实 Supabase 迁移、RLS/事务并发、备份回滚与多实例一致性：缺少生产 `service_role` 环境和运维窗口，不能用 fake adapter 代替。
