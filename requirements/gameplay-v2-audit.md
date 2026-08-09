# Gameplay Upgrade 第二阶段真实仓库审计（历史基线）

> 第三阶段提示：本文件冻结第二阶段结束时的差分与边界，不再代表第三阶段默认运行路径。第三阶段已补齐 Tetris/象棋/大富翁共享 Rule Core 服务端权威、赛事自动真实房间/结果/下一轮和 Cosmetic Profile 合同；当前事实请以 `AUTHORITY_MATRIX.md`、`PROTOCOL_REGISTRY.md`、第三阶段最终完成报告及源码为准。

> 审计时间：2026-08-07（Asia/Tokyo）  
> 口径：以当前源码、协议专项 QA 和线上回归为准；“已完成”只表示代码与自动化闸门已完成，不替代真实设备或真实 Supabase 验收。

## 1. 基线结论

平台当前只保留六款 runtime：`gomoku`、`ludo`、`monopoly`、`tank`、`tetris`、`xiangqi`。六款均有本地、人机和联机入口，游戏侧观战、恢复、Match Stats、Cosmetic Presentation 和 Reward Resolver 已接入。

正式联机路径已经从旧的客户端房主中继升级为按能力协商的共享协议：Tank 使用 `tank-authority-v1` 服务端 20Hz 模拟；Tetris 使用 `tetris-battle-authority-v1` Battle Coordination Authority；象棋使用 `xiangqi-clock-v1`；大富翁使用 `monopoly-auction-v1`。旧 relay 消息仅作为旧客户端/兼容回退，不是新客户端的权威主路径。

人机路径由六款本地强策略提供确定性合法回退，DeepSeek 只在近优候选带内裁决。服务端按“账号 × 游戏”维护 `personal-linear-v2` 学习模型：对局中缓存局面哈希、候选特征和选择，赛果后用胜局强化、败局反事实修正、平局中性反馈更新。本地 JSON 已验证幂等与重启恢复；Supabase `apply_ai_learning_v1` 的原子写入、revision 冲突和恢复路径已通过 schema/fake adapter，真实项目仍未验收。

## 2. 能力矩阵

| 项目 | 当前实际状态 | 证据 / 边界 |
|---|---|---|
| 六款游戏 P0 | 已完成 | `qa/gameplay-upgrade.js`、`qa/dom-smoke.js`、`qa/ai-games.js`、`qa/ai-strength.js` |
| Tank realtime | 已完成 | 50ms 客户端表现循环；服务端 `TankAuthority` 20Hz 固定步长、碰撞/炮弹/伤害/重生/排名权威 |
| Tank 网络 | 已完成（服务端权威） | `tank-authority-v1`、输入 seq/future tick/频率约束、快照校正、重连；旧 relay 只兼容 |
| Tetris battle | 已完成 | 同步生存、确定性 7-Bag、Garbage/Cancel/Alive Ring、KO/名次与表现层 |
| Tetris 网络 | 已完成（Battle Coordination Authority） | `tetris-battle-authority-v1` 统一 startAt/seed/目标/垃圾/KO/placement/超时；暂不宣称服务端完整重放每个方块旋转与碰撞规则 |
| Spectator room | 已完成 | 独立观众席、中途加入、快照、重连、上限、只读输入拒绝、最终结果 |
| Tournament platform | 已完成编排层 | 3–4 人 Round Robin、5+ 三轮 Swiss、积分/Bye/重连快照；每桌仍复用普通 Match，赛事与货币/XP 解耦 |
| Xiangqi server clock | 已完成（棋钟权威） | `xiangqi-clock-v1`、Server Time、切钟、timeout、重连；不宣称服务端完整验证所有象棋规则 |
| Monopoly auction | 已完成（拍卖权威） | `monopoly-auction-v1`、revision、余额快照、deadline、产权、重连；不接平台货币、不新增建筑规则 |
| Cosmetic presentation | 已完成 | 稳定公开 ID、未知 ID/fallback、六款消费端映射；不广播 owned |
| AI 持续学习 | 已完成（个人模型） | `server/ai-learning.js`、`ai_learning_models/experiences`、原子 RPC、resultId 幂等、35+ 单元/线上断言 |
| Economy & Progression | 已完成（服务端统一解析） | `server/reward-engine.js`、有效局/防刷、首胜/连胜/衰减、独立胜场、Reward Breakdown、`apply_reward_v1` 与 outbox |

## 3. 协议与安全边界

### Tank

客户端只发送 `{matchId, seq, clientTick, input}`。服务器维护位置、方向、炮弹、可破坏墙、HP、击杀、死亡、重生、剩余时间和唯一最终排名；客户端可预测并在快照到达后校正。伪造坐标、击杀、名次或旧 `move` 不进入权威状态。

### Tetris

服务器维护统一开局、攻击幂等、Alive Ring、Incoming、Cancel、KO、placement 和最终名次。客户端提交带 `seq/placementSeq/attackId` 的声明，服务器做范围、状态、频率和序列约束，并广播只读战斗事件。完整 Tetromino 规则重放仍是明确的后续边界，不能把 Battle Coordination Authority 写成 Full Rule Authority。

### Turn games

象棋服务器只权威棋钟与超时；大富翁服务器只权威拍卖时序、报价、截止和局内产权事件。具体走法/棋盘仍由客户端规则层和服务端既有一致性协议共同处理。

### Spectator / Tournament

观众没有玩家索引，不参与结果，不发送任何 gameplay mutation；赛事状态独立于单盘状态，积分为 3/1/0，与 💵、XP、胜场流水完全分离。

## 4. AI 与持续学习边界

- 六款游戏均先执行本地强策略：五子棋威胁空间搜索、象棋限宽 Alpha-Beta、飞行棋终点/吃子/安全风险、大富翁净资产/现金储备/租税风险、坦克影响图/避弹/火线/BFS 侧翼、俄罗斯方块 Dellacherie 井面 + 第二块前瞻。
- DeepSeek 只接收合法选项和归一化候选特征；返回值必须精确命中候选，不能覆盖强制胜/防守或服务端权威协议。
- 学习模型按账号和游戏隔离，避免一个玩家污染全局 AI；不保存原始完整局面、PIN、对话或密钥，只保存局面哈希、归一化特征、结果和版本。
- 无效/争议/AFK/秒投对局只写审计经验，不更新策略权重；有效胜/负/平都记录，`resultId` 重放不会二次训练。

## 5. 已验证闸门

- `node scripts/build.js`
- `node qa/dom-smoke.js`
- `node qa/ai-games.js`、`node qa/ai-strength.js`、`node qa/ai-learning.js`
- `node --experimental-websocket qa/ai-learning-online.js`
- Gameplay / Tank Authority / Tetris Protocol / Spectator / Tournament / Xiangqi Clock / Monopoly Auction 专项 QA
- Reward / Schema / Security / Reconnect / Supabase adapter / E2E / WS close 回归

自动化通过不等于真实设备矩阵、真实 Supabase SQL/RLS 并发验收或完整 Tetris Rule Replay 已完成；这些边界在发布说明中必须保留。当前 Render 仍按单实例运行，不能据此推断多实例下 Reward Resolver 或 AI 模型 outbox 已具备冲突安全性。

## 6. 仍然明确未完成的事项

1. 提供真实 `SUPABASE_URL` 与仅服务端 `service_role` secret，执行 schema 迁移、并发/RLS/备份/回滚验收。
2. 完整 Tetris Rule Replay Authority、T-Spin/B2B/Combo/Perfect Clear、高级延迟观战回放和赛季系统。
3. 执行当前版本第二桌面浏览器、Android、iPhone、Tablet、真实网络整形与 30 分钟会话矩阵。
4. 冻结远端素材库提供商、桶、CORS、生命周期与成本后再执行外部上传。
5. 多实例部署前，把 Reward Resolver 与 AI 学习 outbox 迁移为数据库内版本冲突重算或单写者架构，并补跨实例 Pub/Sub/长期指标。
6. 微信小程序、App 与桌面发行。

## 7. 维护规则

- 改前端先改 `public/src/` 或模板，再运行 `node scripts/build.js`；不手改生成产物。
- 新 WebSocket 消息必须同时接入 `server/index.js` 和 `public/src/online/03-websocket.js`，并补协议专项 QA。
- 任何功能改动最后更新仓库根目录三份中文简易日志：`LOG-新增.md`、`LOG-修改.md`、`LOG-删除.md`；不再维护第四份游戏日志。
