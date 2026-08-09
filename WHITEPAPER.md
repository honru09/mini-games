# Mini Games Platform · 项目白皮书

**版本：v3.4（2026-08-09 Production Readiness 工程基线版）**
**状态：6 款精选游戏 + Direct Chat/Profile + Tetris Advanced Battle v3 + Supabase/Cluster 运维合同 + PWA + Honru cleanup 技术候选已自动化验证**
**发布成熟度：AUTOMATED_VERIFIED；真实设备与真实网络闸门未执行，Release Candidate 为 BLOCKED**

> 本文件是仓库内的公开技术总纲。完整排版版位于 `deliverables/`；实现事实以当前源码、测试和本文件为准。

## 0. 三十秒定位

- 产品：网页版多人游戏平台，保留 6 款可持续深化的插件化游戏。
- 游戏：五子棋、飞行棋、迷你大富翁、坦克大战、俄罗斯方块、象棋。
- 模式：人机对战、WebSocket 联机对战；旧同设备多人入口、档案槽位、奖励分支及其对应三语文案已删除。
- 核心体验：打开约 3 秒开局，约 5 分钟一局，结算后立刻再来；先看到人，再看到游戏。
- 技术：零 npm 运行依赖；前端模板 + JS 模块构建成单页；Node 静态服务、手写 WebSocket、DeepSeek 代理、可选 Supabase。
- 线上：GitHub Pages 前端 + Render 后端。

## 1. 产品基线

| runtime_id | 游戏 | 人数 | AI | 联机 | AI Seat |
|---|---|---:|---:|---:|---:|
| `gomoku` | 五子棋 | 2 | ✅ | ✅ | ✅ |
| `ludo` | 飞行棋 | 2–4 | ✅ | ✅ | ✅ |
| `monopoly` | 迷你大富翁 | 2–5 | ✅ | ✅ | ✅ |
| `tank` | 坦克大战 | 2 | ✅ | ✅ | ✅ |
| `tetris` | 俄罗斯方块 | 2–4 | ✅ | ✅ | ✅ |
| `xiangqi` | 象棋 | 2 | ✅ | ✅ | ✅ |

平台能力包括用户名密码账号、旧 PIN 原 UID 迁移、一次性访客、设备自动登录、💵 虚拟现金商城、排行榜、XP/等级/连胜、48 款 Avatar v2 与高级背景、三语言、昼夜双主题、好友/拉黑/举报、正式好友一对一私聊、Presence 隐私、统一真人/AI/空 Seat、READY、公开/私密房、快速加入、掉线托管/房主转移、独立观众席、赛事编排、每日任务、Replay v1.1 和管理员 Metrics v2。

## 2. 架构

```text
public/index-template.html + public/src/*
                 │ node scripts/build.js
                 ▼
          public/index.html
                 │ HTTP + WebSocket /ws + POST /api/ai
                 ▼
          server/index.js
             ┌───┴──────────────────────────────┐
             │ 调用共享纯规则核心               │ 可选 REST（service_role，仅服务端）
             ▼                                  ▼
shared/rules/{tetris,xiangqi,monopoly}.js   Supabase profiles/history/reward_history/
                                           economy_ledger/analytics_events/
                                           ai_learning_models/ai_learning_experiences
```

关键约束：

- `public/index.html` 是生成物；改前端必须修改模板或 `public/src/` 后重新构建。
- 服务端对 Tank 执行 `tank-authority-v1` 的 20Hz 位置/碰撞/炮弹/伤害/重生/排名权威模拟。
- 默认新客户端协商 `tetris-rule-v3`、`xiangqi-rule-v2` 与 `monopoly-rule-v2`：Tetris v3 增加 T-Spin/B2B/Combo/Perfect Clear 高级战斗计分与 12 行攻击封顶；旧 v2 严格客户端或 `TETRIS_GUIDELINE_SCORING=0` 回退 Tetris Battle Coordination，避免滚动发布字段冲突。
- 五子棋和飞行棋仍以客户端规则校验、服务端顺序/玩家身份和稳定点快照为主，不能描述为完整 Server Rule Authority。
- `move` 由服务端记录顺序、发送者编号和有限 moveLog；客户端仍会验证当前行动者与具体走法。
- 开局按当前已加入人数，不要求房间达到容量上限。
- 真人离房会按 Seat v2 规则结束或保留当前局、压紧席位并迁移 AI Controller；房主离开时转移房主并保留真人会话，不再无条件关闭房间。
- 联机结果需要同一 `matchId` 下所有参与者提交一致 claim；AI 结果必须使用服务端签发的 `matchId/resultId` 票据、有效动作进度、去重和频控。
- 独立 Spectator Seat 支持中途加入、快照、重进、人数上限和服务端只读隔离。
- `tournament-orchestrator-v1.1` 支持 3–4 人循环赛及 5+ 人三轮瑞士制，并接通 3–6 人独立选择、六款游戏、真实房间自动创建、玩家席位、服务端结果、自动下一轮、Bye、重连、参与者自愿弃权和管理员明确目标恢复；赛事积分不进入普通 💵、XP 或胜场。
- Replay v1.1 保存 7 天版本化动作流，支持列表、播放/暂停、跳转、0.5–4×、公开房延迟 5 分钟、参与者分享/撤销；服务端只持久化分享令牌哈希。
- Metrics v2 通过 `METRICS_ADMIN_TOKEN` Bearer 鉴权提供脱敏快照、有界历史、CSV、阈值告警、脱敏错误聚合和访问审计；`/admin-metrics.html` 不持久化令牌。
- Profile 只向比赛 presentation 暴露白名单 `gameCosmetics` 装备 ID 和 `cosmeticSchemaVersion=1`；owned、余额、价格与购买记录保持私有，未知 ID 回退默认。

## 3. 本地强 AI、DeepSeek 与持续学习

六款游戏各自的 `scheduleAI()` 先用本地强策略/搜索生成合法近优候选，再把候选和归一化特征交给 `aiChoose()`。模型返回值必须与某个选项完全匹配，游戏逻辑还会再次验证；无 token、无 Key、超时、限流、断网或非法返回时使用本地策略，不会随机送子。

### AI 专项知识与持续学习

`server/ai-strategy-skills.js` 内嵌六款策略知识包：五子棋威胁空间、象棋限宽 Alpha-Beta、飞行棋终点/吃子/安全风险、大富翁净资产与现金储备、坦克影响图/避弹/火线/BFS 侧翼、俄罗斯方块 Dellacherie 井面与第二块前瞻。DeepSeek 只在本地近优带内裁决。

`server/ai-learning.js` 的 `personal-linear-v2` 按账号 × 游戏隔离。对局中缓存局面哈希、候选特征、选择和局部排名；有效胜局强化选择特征，败局用同一近优带的反事实候选修正，平局做中性校正并保留经验。无效/争议/AFK/秒投只审计不调权。模型、经验、版本、resultId 和 revision 通过本地 JSON 及 Supabase `ai_learning_models`、`ai_learning_experiences`、`apply_ai_learning_v1` 原子持久化；不保存原始完整局面、PIN、对话或密钥。

DeepSeek Key 只存在于服务端环境变量。`qa/ai-games.js` 使用本地模型桩覆盖全部六款游戏，不依赖真实 Key。

## 4. 账号、经济与数据

- 正式用户名为 4–20 位 ASCII 字母数字且至少各一个，大小写不敏感唯一；密码为 8–64 位可打印 ASCII，服务端使用随机盐 scrypt 慢哈希。
- 旧 PIN 账号可绑定到用户名密码并保留原 UID、资产、战绩与外观；客户端只持久化服务端 session token，不保存密码或 PIN。
- 权威字段：💵 余额、owned、XP、等级、连胜、按游戏胜场 `wins`、总胜场 `totalWins`、局数、成就与结算历史；胜场与余额完全独立。
- Economy & Progression v1.0 由统一服务端 Reward Resolver 驱动：联机 1v1 胜/平/负为 `3/2/1💵` 与 `12/10/8 XP`，多人按名次为 `4/3/2/1💵` 与 `14/12/10/8 XP`。
- AI 通过服务端票据与有效动作进度结算，胜/平/负为 `1/0/0💵` 与 `8/6/5 XP`，每日 AI 货币上限为 `3💵`。
- 每日首胜、连胜 XP、重复对手衰减、有效比赛/AFK/秒投判定和 `XPNext=min(200,30+5×Level)` 等级曲线均由服务端配置化执行。
- 每日任务进度由服务端从有效人机/联机结算派生，领取以 `taskKey + UTC date + claimId` 幂等写入经济流水；客户端不能直接加币。
- `history` 保留兼容结算记录，`reward_history` 保存完整奖励明细与防刷依据，`economy_ledger` 审计每次 💵 增减，`analytics_events` 记录比赛和经济埋点。
- Supabase 正式奖励通过 `apply_reward_v1` 按账号加锁并以 `result_id` 幂等，在单事务中更新档案、历史、奖励明细和可选经济流水；埋点仍独立写入。
- Supabase schema、RLS、奖励/购买/AI 学习/Direct Chat RPC，以及数据库租约、fencing token、持久事件游标和指标快照已就绪；生产脚本默认 dry-run，要求加密备份→事务迁移→RLS/并发验收→隔离恢复→非破坏回滚。真实执行仍取决于 DB URL 与仅服务端保存的 `service_role` secret。
- 未配置 Supabase 时回退到 JSON；当前 Render 未挂载持久磁盘，因此不能把 JSON 回退描述为生产持久化已完成。
- 当前 Render 按单实例运行；扩容前必须把 Reward Resolver 与 AI 学习 outbox 改为数据库内版本冲突重算、单写者或等价的一致性方案，不能让多个进程各自覆盖模型/档案。

## 5. 白皮书 × 美术资源融合

运行时根目录是 `public/assets/`，权威索引是 `public/assets/manifests/asset_manifest.json`。

首批已落地：

- `P-001-MARK`：Header 与 Hero 使用的 Playroom 品牌 SVG。
- `P-001-WORDMARK`：可用于分享卡和后续商店物料的字标 SVG。
- `P-003`：平台虚拟现金 SVG，商城、排行榜、档案与结算统一显示 💵。
- `public/src/core/06-assets.js`：稳定资源路径、现金组件和加载失败 fallback。
- `G-02/G-07/G-08/G-09/G-11/G-06-COVER`：六款游戏均有 640×360 / 320×180 响应式大厅封面、lazy/srcset、完整性哈希与 Emoji fallback。
- `G-02-BOARD-SURFACE / G-11-WELL-SURFACE`：五子棋木纹 Canvas 与俄罗斯方块玻璃井两个旧纵切继续保留。
- `Game Stage + Tabletop Wave A`：六款共用 Header/真实 Seat Rail/Arena/Command Tray，代码原生 Cream/Ink 底材与核心实体默认覆盖 `52/100`；严格 `mg_art_tabletop_wave_a='0'` 回退旧表现。
- `art-source/`：保留六张封面高分辨率母图与可复现 Prompt；`public/assets/` 只保存运行时 WebP。
- `asset-library/`：记录 provenance、来源、许可、目录/许可证独立哈希、Prompt/模型、预览与未来对象键；它是 sidecar，不替代生产 manifest。

融合规则：

1. 每项资产必须有稳定 `asset_id`、运行时路径、状态、fallback、a11y 与许可证字段。
2. 游戏 runtime ID 只允许 `gomoku/ludo/monopoly/tank/tetris/xiangqi`。
3. 首屏只加载品牌和公共 UI；游戏棋盘/棋子按选中游戏懒加载。
4. 美术替换必须原子包含棋盘、棋子、状态、动效、音频与 fallback，不能只换一张不可交互大图。
5. 资源加载失败必须回退到现有 CSS/Canvas/DOM Emoji/WebAudio，不阻塞大厅和开局。
6. 三语言文字、规则网格、命中区域、焦点环和数值仍由代码生成，不烘焙进图片。

已完成的 P0 纵切：

1. 五子棋 Canvas：木纹氛围层、软 3D 黑白棋、最后落子、胜线、既有落子 WebAudio 与 fallback。
2. 俄罗斯方块 DOM/网格：玻璃井、七类方块纹理、active/ghost/locked/clear、既有 WebAudio 与 fallback。
3. 六款大厅封面使用 640×360 / 320×180 `srcset` 懒加载；任一封面失败时保留 Emoji。
4. `mg_art_gomoku_v1` 与 `mg_art_tetris_v1` 可独立关闭；规则、快照、AI 和联机消息不含美术状态。
5. 注册与商城已覆盖 48 款 Avatar v2、主预览/试穿、服务端价格对齐、单例弹层、滚动锁和 1440/768/481/390/360 响应式。
6. 当前六封面是可回滚的软 3D 过渡版，不作为 `Pocket Tabletop Sticker` 最终风格验收结论。
7. 六款 Game Stage/Tabletop Wave A 已默认接入且不读取规则/快照/奖励；390px Tetris 改为单列预览、Arena 无内部横溢、七项控制至少 44px。
8. Honru 前端助手聊天 UI 已删除；玩家私聊是 Chat 唯一产品入口，签到、品牌资产、后端兼容和默认关闭局内反应继续保留。

下一批严格执行新报告：先 Art Bible v1、Design System v3、Motion System v1 和 Source Manifest v2；再用 1 Persona×8 状态、4 Avatar、核心 UI、五子棋与飞行棋完整纵切组成 Golden Set，并完成 IP Similarity Review。Golden Set 未通过前不得批量重绘 48 Avatar 或其余游戏。资源制作不改变已完成的规则、AI、商品 ID、奖励或权威协议。

## 6. 质量与发布闸门

```bash
node scripts/build.js
node qa/dom-smoke.js
node qa/ai-games.js
node qa/ai-strength.js
node qa/ai-learning.js
node --experimental-websocket qa/ai-learning-online.js
node qa/gameplay-upgrade.js
node qa/tank-authority.js
node qa/tetris-battle-protocol.js
node qa/tetris-rule-core.js
node qa/xiangqi-rule-core.js
node qa/monopoly-rule-core.js
node qa/rule-authority.js
node --experimental-websocket qa/rule-authority-online.js
node qa/protocol-version.js
node --experimental-websocket qa/game-cosmetic-profile.js
node qa/metrics-online.js
node --experimental-websocket qa/daily-tasks.js
node --experimental-websocket qa/replay-sharing.js
node qa/gameplay-load.js
node --expose-gc qa/gameplay-memory.js
node qa/timer-audit.js
node qa/network-chaos.js
node qa/spectator-room.js
node qa/tournament.js
node qa/tournament-auto-room.js
node --experimental-websocket qa/tournament-auto-online.js
node --experimental-websocket qa/tournament-recovery-online.js
node qa/xiangqi-clock.js
node qa/monopoly-auction.js
node qa/reward-system.js
node qa/supabase-schema.js
node --experimental-websocket qa/security-online.js
node --experimental-websocket qa/reconnect-online.js
node --experimental-websocket qa/supabase-adapter.js
node --experimental-websocket qa/e2e-online.js
node --experimental-websocket qa/ws-close-test.js
```

发布前必须满足：

- 构建产物与模板/源码同步。
- 六款游戏人机和联机初始化与关键动作通过，构建产物中不存在旧同设备多人模式入口。
- 安全、重连、结算、商城和 Supabase adapter 回归通过。
- asset manifest 可解析，SVG/XML 合法，无孤儿路径，无旧货币显示。
- 360px 与桌面、六主题、三语言、normal/reduced-motion 均可用。
- 30 分钟生产正式好友 WebSocket 会话已通过：15 条消息、15 次已读、2 次重连、0 异常断开、P95 181ms；该证据不等同于浏览器 UI、真机或网络整形。
- 自动化 PASS 不替代 Desktop Chrome/第二浏览器、Android、iPhone、Tablet 实机矩阵，也不替代 `tc/netem` 或等价真实网络整形。
- 实机矩阵、真实网络、真实 Supabase 与人工美术审批完成前，发布状态必须保持 `BLOCKED`。

## 7. 路线图

### P0：当前执行

- [x] 聚焦为六款精选游戏并删除其余运行时模块、白名单和测试场景。
- [x] 建立 `public/assets/`、asset manifest、品牌 SVG、现金 SVG 与 fallback。
- [x] 💵 迁移到商城、档案、排行榜和结算 UI。
- [x] 完成五子棋和俄罗斯方块两个美术纵切，并加入 manifest/flag/fallback/QA。
- [x] 六款大厅封面 640/320 双尺寸接入；注册/商城重排、三语言商品与 Avatar alt、价格契约、五档响应式和滚动锁通过自动化及本地浏览器验收。
- [x] 建立本地素材库 provenance sidecar、Schema 子集验证、目录/许可证独立哈希和六封面交叉审计。
- [x] 冻结 `Pocket Tabletop Sticker` M0：Art Bible、Design/Motion、Source Manifest、Golden Set 与 IP Review；当前过渡封面不冒充最终风格。
- [x] 完成 M0 Draft 源：Teacher 八状态与四 Avatar Alpha、Core UI HTML/CSS 状态板、精确五子棋 15×15/五连、飞行棋 52 格/每方四机/四剪影；Source Manifest 固定 hash/provenance，生成式规则错误稿不进入当前源路径。
- [x] 完成默认可见 Game Stage + Tabletop Wave A：共用 Stage 16、六底材 18、六核心实体 18，总覆盖 `52/100`；M0/P1/P2 审批闸门保持独立。
- [x] 删除 Honru 助手 Chat/Dock/表单并保留玩家私聊与签到；完成 Tetris 360/390px 单列预览和 44px 操作适配。
- [ ] 完成 Teacher/Avatar 人工清稿、IP 双人审查、六主题×三语×五宽运行时集成验收与 Golden Set 人工决议；完成前全部 M0 旗标默认关闭。
- [x] 实施 Economy & Progression v1.0：联机/AI 权威结算隔离、有效局、防刷、独立胜场、`apply_reward_v1` 单事务落库、奖励流水与 Reward Breakdown UI。
- [x] 实施 Gameplay Shared Protocol V1：Tank Authority、Tetris Battle Coordination、Spectator Room、Tournament Orchestrator、Xiangqi Clock、Monopoly Auction。
- [x] 实施 Gameplay Rule Authority v2：Tetris/象棋/大富翁共享纯规则核心、服务端动作验证、完整快照、确定性哈希与 v1 兼容回退。
- [x] 接通 Tournament 自动真实房间、席位分配、单盘服务端结果回传、自动下一轮、Bye 与重连状态。
- [x] 接入 `game-cosmetic-presentation-v1`：Profile 白名单装备、公开 presentation、私有经济隔离与未知 ID fallback。
- [x] 修复 Tank/Tetris 运行时持续重建 DOM 引发的闪屏，改为稳定渲染树和 keyed 增量更新，并增加节点身份回归。
- [x] Seat/Social/Profile v2：真人/AI/空席、READY、AI Controller、房主转移、公开/私密房、好友/拉黑/举报、Presence 隐私、Avatar/背景/收藏试穿。
- [x] 游戏外观商城：服务端价格/owned/装备权威校验，按游戏筛选、预览、购买、装备和六款 fallback。
- [x] Daily Task：服务端进度、领取幂等和经济流水。
- [x] Replay v1.1：7 天记录、播放器、延迟公开、分享令牌哈希和撤销。
- [x] Tournament v1.1：六款 3–6 人创建、自动多桌、自愿弃权、管理员指定判负、赛事积分经济隔离。
- [x] Metrics v2：管理员只读页面、脱敏历史/CSV/阈值/错误闭环、限频与访问审计。
- [ ] 配置并验证真实 Supabase，完成 JSON 数据迁移、并发/RLS、备份和回滚演练。
- [x] 执行 30 分钟生产正式好友 WebSocket Synthetic Session；协议稳定性通过但不替代 UI/真机。
- [ ] 执行真实设备矩阵与真实网络整形，解除对应 RC `BLOCKED`。

### P1

- 先完成 `Pocket Tabletop Sticker` Art Bible 与 Golden Set；通过后按五子棋/飞行棋 → 其余四款 → Avatar/Persona/主题/社交顺序原子扩展完整美术包。
- 旧 `commerceId`、owned/equipped、服务端价格和游戏 runtime ID 保持不变，仅递增 `artworkVersion`；每批必须含 source/runtime/poster/fallback/manifest/license/budget/pivot/event/QA。
- 聊天、Feed、公会、处罚/申诉后台和赛季系统。
- 高级延迟观战、完整 Guideline 余项（T-Spin Mini/逐格 Drop 分等）、真实跨实例 Metrics 与外部遥测接收端验收。

### P2

- PWA 基线已实现；微信小程序、原生 App 与桌面商店发行仍需开发者账号、证书、真机和审核。
- 选择三款高复用游戏进行 GLB/Godot 试点，Web 继续保留 2D fallback。

## 8. 凭证与部署

- 所有 Key/token 只放环境变量，不写入仓库或前端。
- 前端推送 `main` 后由 GitHub Pages workflow 构建部署。
- Render 服务通过 `node scripts/render-deploy.js` 手动触发部署。
- Metrics 生产环境必须配置高熵 `METRICS_ADMIN_TOKEN`；不得把令牌写入前端、URL、仓库或日志。
- Render 当前保持单实例；真实 Supabase 迁移/并发验收和多实例一致性改造完成前不应横向扩容。
- 本机 Node 20 运行 WebSocket 测试需要 `--experimental-websocket`；Node 22+ 可直接运行。

## 9. Agent Execution OS

Playroom 后续工程执行采用项目级 Skills、需求冻结、文件所有权和证据化验收制度。规范入口为 `.agents/README.md`，
高风险共享文件登记在 `HIGH_RISK_FILES.md`，能力状态登记在 `PROJECT_STATUS.json`，Quality Gates 登记在
`requirements/QUALITY_GATES.json`。任务必须经历 `DRAFT → REQUIREMENT_FROZEN → PLANNED → IMPLEMENTING → VERIFYING → ACCEPTED`；
真实设备、真实 Supabase、真实网络整形未执行时保留 `NOT_EXECUTED`，Release Candidate 不得标记为 `production-ready`。

视觉动效统一由 `MOTION_TOKENS.json` 和现有 CSS 令牌驱动，平台层保持可读、快速和稳定，玩家层承载个性化表现；不因视觉参考强行迁移技术栈，
也不自动安装未经审计的第三方 Skill。
