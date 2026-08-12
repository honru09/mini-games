# Mini Games Platform · 项目白皮书

**版本：v3.5（2026-08-10 产品愿景与需求治理融合版）**
**状态：6 款精选游戏 + 沉浸式 Game Shell + Social Match + 全局 Direct Chat + Playline P0 + Tetris Advanced Battle v3 + Supabase/Cluster 运维合同 + PWA 已自动化验证**
**发布成熟度：AUTOMATED_VERIFIED；真实设备与真实网络闸门未执行，Release Candidate 为 BLOCKED**

> 本文件是仓库内的公开技术总纲。完整排版版位于 `deliverables/`；实现事实以当前源码、测试和本文件为准。

## 0. 三十秒定位

- 产品：网页版多人游戏平台，保留 6 款可持续深化的插件化游戏。
- 游戏：五子棋、飞行棋、迷你大富翁、坦克大战、俄罗斯方块、象棋。
- 模式：人机对战、WebSocket 联机对战；旧同设备多人入口、档案槽位、奖励分支及其对应三语文案已删除。
- 核心体验：打开约 3 秒开局，约 5 分钟一局，结算后立刻再来；先看到人，再看到游戏。
- 技术：零 npm 运行依赖；前端模板 + JS 模块构建成单页；Node 静态服务、手写 WebSocket、DeepSeek 代理、可选 Supabase。
- 线上：GitHub Pages 前端 + Render 后端。

### 产品核心排序与长期愿景

- **互动第一，社交第二，个性化是共同基石。** 头像、头像框、背景、闪名和未来虚拟形象共同构成玩家在平台中的身份；这些身份必须能在房间、对局、聊天、Profile 和回放等真实交互里被看见，而不是只存在于商城清单。
- 经典游戏保留可识别的规则核心。Ghost Game 的差异化目标约为体验层的 10%：本地近端视角、实体桌游质感、角色参与、克制的漫画反馈、社交表达和可关闭的特色事件；任何规则变化都必须另立合同并验证公平、AI、联机、Replay 和 Authority。
- 当前先把六款游戏做成视觉、互动、个性化、联机、安全和内容治理模板。长期再建设“地区 → 国家 → 特色小游戏”的全球目录；中国、日本、韩国、美国、亚洲、欧洲等只是未来内容元数据方向，不是当前新增游戏承诺。
- 产品名称为 **Ghost Game**。首页与登录后的价值表达应强调快速进入、经典游戏的新体验、真实玩家互动和可展示的成长，不再以“六款精选游戏联机对战”作为主品牌标语。

## 1. 产品基线

| runtime_id | 游戏 | 人数 | AI | 联机 | AI Seat |
|---|---|---:|---:|---:|---:|
| `gomoku` | 五子棋 | 2 | ✅ | ✅ | ✅ |
| `ludo` | 飞行棋 | 2–4 | ✅ | ✅ | ✅ |
| `monopoly` | 迷你大富翁 | 2–5 | ✅ | ✅ | ✅ |
| `tank` | 坦克大战 | 2 | ✅ | ✅ | ✅ |
| `tetris` | 俄罗斯方块 | 2–4 | ✅ | ✅ | ✅ |
| `xiangqi` | 象棋 | 2 | ✅ | ✅ | ✅ |

平台能力包括用户名密码账号、旧 PIN 原 UID 迁移、一次性访客、设备自动登录、G Coins 商城、排行榜、XP/等级/连胜、48 款 Avatar v2 与高级背景、三语言、昼夜双主题、好友/拉黑/举报、全局正式好友私信、Presence 隐私、统一真人/AI/空 Seat、READY、公开/私密房、快速加入、掉线托管/房主转移、独立观众席、每日任务、Replay v1.1 和管理员 Metrics v2。本地 Playline P0 已提供受限游戏动态闭环，但生产 capability 默认关闭，不能在真实持久化与内容治理完成前描述为已上线社区。赛事编排代码与协议继续保留；普通玩家的赛事入口默认隐藏，仅服务端授权的测试管理员可见受控入口。

Theme Contrast Design System P1 已在本地把昼夜主题从历史层叠补丁收敛为统一语义层：运行时 CSS 只接受 `light/dark`，旧主题存储仍由兼容函数映射；平台外壳统一使用可计算的 surface/text/accent/border/focus/disabled/status/icon/overlay/glass/toast token，代表性实色组合达到普通文字 4.5:1、非文字边界与焦点 3:1。登录 Logo 在 light/dark 显式原色/反白，PWA browser chrome 同步场景色；Premium Background 使用素材自身 textTone，六款 Game Stage 保持 Ink/Cream 主题独立。Game Stage 独立性修正后的 Quality Gates 与完整 `npm test`（189.0 秒）已通过，双构建 SHA-256 为 `ED29E547F6D6E4475D21414E0979479DB619AA019FC4952AD484D8668008CC66`。该结论是本地自动化实现，不包含玻璃/图片背景的真实浏览器计算、forced-colors、visible reduced-motion、第二浏览器、真机或低端性能验收，也尚未发布；Terra Max 终审重试因 429 未形成独立结论。

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
- `tournament-orchestrator-v1.1` 支持 3–4 人循环赛及 5+ 人三轮瑞士制，并接通 3–6 人独立选择、六款游戏、真实房间自动创建、玩家席位、服务端结果、自动下一轮、Bye、重连、参与者自愿弃权和管理员明确目标恢复；赛事积分不进入普通 💵、XP 或胜场。产品将它作为备份保留；普通 UI 的发现、创建、打开和自动弹窗已由 `UI-034` 默认隐藏，受控测试入口按服务端管理员能力开放。
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
- Supabase schema、RLS、奖励/购买/AI 学习/Direct Chat/Playline RPC，以及数据库租约、fencing token、持久事件游标和指标快照已就绪；生产脚本默认 dry-run，要求加密备份→事务迁移→RLS/并发验收→隔离恢复→非破坏回滚。真实执行仍取决于 DB URL 与仅服务端保存的 `service_role` secret。
- 未配置 Supabase 时回退到 JSON；当前 Render 未挂载持久磁盘，因此不能把 JSON 回退描述为生产持久化已完成。
- 当前 Render 按单实例运行；扩容前必须把 Reward Resolver 与 AI 学习 outbox 改为数据库内版本冲突重算、单写者或等价的一致性方案，不能让多个进程各自覆盖模型/档案。

## 5. 白皮书 × 美术资源融合

运行时根目录是 `public/assets/`，权威索引是 `public/assets/manifests/asset_manifest.json`。

首批已落地：

- `P-001-MARK`：Header 与 Hero 使用的 Playroom 品牌 SVG。
- `P-001-WORDMARK`：可用于分享卡和后续商店物料的字标 SVG。
- `P-003`：G Coins 平台货币 SVG，商城、排行榜、档案与结算统一显示 G Coins；旧 `💵` 仅作加载失败 fallback，内部 `coins`/`currency` 字段保持兼容。
- Shop Purchase Feedback P0 在不改变价格/扣款/owned 权威的前提下，为现有 `purchase_ok/error` 增加 `requestId/category/id` 关联回显；客户端按账号与商品绑定单笔 pending，以可访问 live status 展示成功、失败和超时，并丢弃错配/迟到状态。滚动发布必须先后端再前端。
- Test Admin P0 采用环境变量精确绑定、启动期 fail-closed、scrypt 引导与显式能力白名单。无限 G Coins、MAX 等级和全目录拥有均为私有虚拟投影；测试局、赛事控制、公开发现、持久社交、正式奖励/账本、Replay、AI 学习、Analytics 与 outbox 具有独立隔离合同，不能作为生产经济旁路。
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
8. Honru 前端助手聊天 UI 已删除；玩家私聊进入全局 DM dialog，四区为 Home/Games/Playline/Profile。签到、品牌资产、后端兼容和默认关闭局内反应继续保留；系统空态与玩家原文分层。

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
- [x] 普通玩家入口默认隐藏 Tournament 的创建、打开和自动弹窗；保留服务端、协议、数据、受控入口与专项测试。
- [x] Metrics v2：管理员只读页面、脱敏历史/CSV/阈值/错误闭环、限频与访问审计。
- [x] Social Match P0：局内公开身份入口、十个稳定 Emoji ID、六个快捷语 ID、目标投掷、头像旁气泡，以及服务端权威身份、eventId 幂等、频控、双向 Block、逐接收者过滤、观众/访客/AI 发送拒绝；表达保持临时态，不进入 Replay、奖励、AI 学习、Analytics 或数据库；能力按 WebSocket 连接级保存，同一连接内会话失效/注销/房间重置不丢失，真实断开才清空。
- [ ] 配置并验证真实 Supabase，完成 JSON 数据迁移、并发/RLS、备份和回滚演练。
- [x] 执行 30 分钟生产正式好友 WebSocket Synthetic Session；协议稳定性通过但不替代 UI/真机。
- [ ] 执行真实设备矩阵与真实网络整形，解除对应 RC `BLOCKED`。

### P1

- `Player Character P0 / SOC-031` 已本地实现并完成回归：独立于 Honru/Logo/Avatar/Frame/Background/NameFx 的 `player-character-v1` 深模块集中规范化固定角色与 slot 白名单；旧账号、访客、AI、观众、Profile、Room Seat、重连均使用确定性安全投影，客户端不能写入角色字段，Supabase 不要求新增列。Social Match Seat 合同已同步 `playerCharacter` 公开字段，完整 `npm test` 通过。UI-037/GAME-045 已进一步落地代码原生角色位置表现、连续 revision/transition Adapter 与完整 Monopoly 状态矩阵；ART-036 角色/大富翁正式美术、ECO-029 收藏装备事务及外部设备/真实 Supabase 门禁仍按依赖顺序待执行。
- `ART-036` 已进入 source-only accepted：最高质量 `gpt-image-2` 生成玩家角色五姿态与大富翁 24 格实体棋盘方向板，G-14/G-15 仅登记 `reference-only`；实际棋盘输出为 1254×1254 已记录。人工清稿、Reviewer B、IP Similarity Review、Golden Set 以及后续 runtime 接入仍是硬闸门，不能把方向稿当成已上线美术。
- `ECO-029` 已完成 contract-only 纯适配器：默认 `player_character` catalog 为空，集中约束 owned/equipped、服务端 price resolver、requestId 幂等与公开隐私投影；8 组专项 QA 通过。现有 Supabase `apply_purchase_v1` 尚无该类别，因此正式商品、扣币、装备、商城 UI、并发/RLS/备份/回滚仍未执行，禁止借道现有 Avatar/Game Cosmetic 类别。
- UI-037/GAME-045 的本地 fallback 仅消费已存在的服务端 `monopoly-rule-v2` 快照和根级 transition；首次帧、重连、观战、乱序与跳 revision 直接定位，只有连续合法 move 才生成有限步进计划。`MonopolyUiState` 统一状态栏、拍卖倒计时与机会卡可访问 dialog，交易仍明确不可用且不伪造流程。当前 renderer 仍是既有 CSS/DOM `♟/🚗`，ART-036 的 G-14/G-15 方向板保持 `reference-only`，不得进入 Manifest 或 `public/assets`。

- 先完成 `Pocket Tabletop Sticker` Art Bible 与 Golden Set；通过后按五子棋/飞行棋 → 其余四款 → Avatar/Persona/主题/社交顺序原子扩展完整美术包。
- 先做五子棋/飞行棋 `Tabletop Presentation M1`：唯一规则坐标保持不变，每个客户端把本人映射到 A 近端；加入实体斜视棋盘、镜头入场、棋子/飞机移动、克制墨线冲击、2/3/4 人镜头和领奖台，并提供 reduced-motion 与旧表现回滚。
- `Tank Controls P0` 已完成本地实现：移动端八扇区/斜向摇杆、方向键降级、独立多指开火、键盘映射、触觉可选和失焦/销毁释放；只复用既有 Tank Authority 输入字段，未改服务端规则。Tank 皮肤/地图/基地视觉仍另立 ART-035；`Player Character + Monopoly P0` 继续独立定义虚拟形象合同和服务端位置同步行走纵切。
- `Tank Art P1` 已完成最高质量 `gpt-image-2` source-only 概念板与 provenance：四套黑白实体桌游材质坦克（纸板、玉石/黑石、晶体、克制科技）及一块竞技场 inset；初稿因徽记/旗帜/伪文字被拒绝，清理版通过负责人初审后以 `reference-only` 留存。人工清稿、Reviewer B、IP Similarity Review、用户 Golden Set 和后续 runtime 双闸门仍未执行，生产表现继续使用既有 fallback，且不改 Tank Controls/Authority/规则/协议。
- `Social Match P1` 负责局内自由文字聊天、未读、中央历史、头像身份行、举报与静音；它与 Direct Chat、当前大表情协议彼此独立。ART-024/025 + SOC-017 已完成十枚 Honru source-only 候选、四档派生、审查 atlas/poster 和共享目录/投掷合同；它们仍处人工清稿、Reviewer B/IP、Golden Set 与 runtime/chat adapter 门禁中，只能在审批后替换/扩展表现，不阻塞基础文字能力，也不得偷偷改变现有纯文字 wire。
- `Progression Identity P1` 基于服务端权威胜场建立每款游戏 1/10/50/100/1000 胜场称号和徽章阶梯。
- 旧 `commerceId`、owned/equipped、服务端价格和游戏 runtime ID 保持不变，仅递增 `artworkVersion`；每批必须含 source/runtime/poster/fallback/manifest/license/budget/pivot/event/QA。
- Playline P0 已完成受限动态纵切；评论、点赞、转发、关注、媒体、陌生人私信，以及公会、处罚/申诉后台、赛季社区仍按后续内容治理任务推进。
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

## 10. 产品需求治理与分轨路线图

2026-08-09 起，`requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 作为唯一原子需求台账。2026-08-11 快照为 242 项，分为美术与品牌、界面与交互、游戏与局内体验、社交与玩家关系、经济成长与商业化、技术数据 AI 与跨平台六条工作流。Schema v2 保存 72 个来源入口、129 个显式依赖节点/267 条无环依赖、六种验收口径，以及联合覆盖全部 242 项的 47 个历史/当前请求主题组。总入口为 `简易报告/项目总需求进度报告-20260811.md`，六份分类报告由 `scripts/generate-progress-reports.js` 自动生成。`requirements/GHOST_GAME_MAINLINE_COMMAND.md` 融合 2026-08-12 两份用户总指挥报告，负责 CONTROL→CLOSE/Ghost3D→PROVE→DATA→ART→PARITY 的阶段顺序；Defect、Acceptance Gap 与 Shared Repair 不再自动新增 Requirement ID。

Game Stage Wave B/Wave C 已完成六款游戏的本地代码原生密度与可处置过程纵切。新增五子棋 `turn→aim→select→place→impact→line→terminal` 和 Tetris `spawn→fall/move/rotate→lock→line-clear→combo/B2B/T-Spin/perfect-clear/garbage→terminal`，与飞行棋、大富翁、Tank、象棋四条既有过程链共同纳入 `npm run test:game-stage-density-final`。五子棋终局 pending/locked、Tetris 多实例/观众/Authority/v3 高级计分/Replay 非阻塞、Tank 高频权威快照优先级和象棋 clock/check/terminal 均有回归。所有过程状态留在实例内表现层，不进入 authority snapshot/serialized state；15×15、18×10、52 格轨道、24 格棋盘、规则、AI、联机、Authority、Protocol、奖励、Replay、数据库和未审批美术均不变。专项、Quality Gates、完整 `npm test`（153.4 秒）与双构建通过，最终物理文件 1,255,936 bytes、SHA-256 `BACD4460A3AC0EC4098A3837C482A4BF00BFB092044B853823CC312663A95BE3`。浏览器运行时仍立即报 `Transport closed`，所以只标记本地 `implemented`，桌面/平板/390×844/844×390、双主题、visible reduced-motion、第二浏览器、真机与真实网络保持 `NOT_EXECUTED`；未提交、推送或部署。

Avatar/Background 当前只完成安全纵切：默认免费头像展示缩到 100/101，历史已装备 ID、服务端 owned/价格和购买权威继续兼容；Premium Background 对真实 12 帧 animated WebP 先预载，处理页面隐藏、离屏、运行中 reduced-motion、失败回退、释放和迟到资源事件。四款 Honru Pixel Avatar（explorer、night-cadet、arcade-builder、stargazer）只是 1254×1254 source/Alpha 技术候选，仍有边缘清稿、小尺寸轮廓区分和人工审查风险；Reviewer B、IP Review、Golden Set、44/64/96/192px 真机/主题矩阵均为 `NOT_EXECUTED`，候选不得进入 `public/assets`、Manifest、商城、默认头像或线上。

Identity / Avatar / Background CLOSE P1 已把上述安全纵切接进真实消费面：单一深模块统一 Avatar、Frame、Effect、NameFx、raw 名字和语言表现，覆盖 Seat 缓存缺失、Lobby 房主、邀请、Social/玩家列表、全局 DM 列表/线程与 Playline 作者；旧 Adapter、安全 fallback 和服务端公开投影兼容保留。48 款运行时 Avatar 未删除，只有默认免费曝光收紧到 100/101。最后一处 DM i18n 修复后的完整 `npm test`（166.5 秒）和双构建通过；Terra Max 终审未返回可用结论，按 reviewer limit 记录且不冒充通过。该结论不包含浏览器/真机、低端性能、最终背景重绘或 Honru 人工/IP/Golden Set 审批，`ART-021` 因此仍为 partial。

Direct Message Design System P1 已在不改变 `direct-chat-v1` 的前提下完成第一条视觉系统纵切。全局私信弹窗拥有独立会话栏与消息线程：连接状态、总未读、完整公开身份、摘要、本地化时间、消息正文与已发送/发送中/失败重试不再争抢同一层级；桌面使用双栏，手机使用 `100dvh`、四边 safe-area、44px 和内部滚动。新增的 `GhostSurfaceMotion` 是窄 Interface 深模块，只接受 `open/thread/back/close` 四种语义阶段，并以 GSAP 3.15 Core+CSSPlugin 私有 Adapter 编排有限 transform/opacity timeline；generation、kill/revert、reduced-motion、后台、Game Shell、加载失败和 dispose 都回到同步稳定态。玩家原文继续只经 `textContent + data-i18n-raw`，没有新增 wire、陌生人私信、附件、Emoji、公开字段、经济或数据库能力。18+12+9 项专项、三语 1,632 keys、台账、快速 Quality Gates、包含新 Motion 执行测试的完整 `npm test`（147.1 秒）与双构建均通过；最终 1,333,055 characters / 1,347,604 bytes / SHA-256 `0546BBFB5C2FACA13D9D3D9C121FFBA7A1C48E9C98D5A516DA23C25EA2BCAB62`。浏览器连接器仍报 `Transport closed`，因此最新可见/真机/网络/低端性能证据保持 `NOT_EXECUTED`。

沉浸式 Game Shell P0 已完成本地验收：fixed `100dvh`、五个稳定插槽、页面滚动/输入隔离、内部滚动、焦点/滚动恢复，以及 Rules/Victory/Reward 三类可访问 dialog；1440×900、1024×768、390×844、844×390 四档浏览器证据、22 项弹层动态合同、完整 `npm test` 和构建幂等均通过。

Social Match P0 也已完成本地验收：Seat 公开身份、真人 Profile 入口、Command Slot 表达盘、十个稳定 Emoji/六个快捷语、目标与本地静音、三气泡队列和 reduced-motion；服务端完成权威签发、幂等、频控、Block、观众/访客/AI 边界，表达严格排除出持久化与对局权威链。四档浏览器、专项在线 QA、Quality Gates、完整 `npm test` 与双构建 SHA-256 均通过。原创 Honru Emoji 与投掷动画资产、自由文本房聊仍留给 Art M1 / SOC-019；该批次尚未提交、推送或部署。

UI Repair P0.1 已完成本地实现：头像图片与 Canvas 统一圆形裁切、Frame/Effect 层级，环绕特效只旋转装饰环；商城使用真实身份组合预览，Premium Background 使用真实 animated WebP、poster、播放/暂停、失败 fallback、离屏/页面隐藏清理和 reduced-motion 降级。专项、三语、响应式、Quality Gates、完整 `npm test` 与双构建 Hash 已通过，1280×720 双主题三语浏览器行为已验证；其 Header/Modal 层级缺陷已由 P0.2 解决。

UI Repair P0.2 已完成本地验收：平台层级冻结为 Header `120`、Mobile Nav `220`、Modal `900`、Auth `11000`、Toast `12000`；创建/加入/浏览重构为可访问 Room Launchpad 和服务端事实驱动 Lobby；待选游戏必须绑定本次成功创建的房间，观众与玩家均不会重复看到当前房；普通账号不会显示赛事创建、打开或自动弹窗，登录/换号后重新由 `hello_ack.admin` 授权；三语品牌承诺改为“随时开局，一起成长”及其英乌等价表达。1440×900、1024×768、390×844、844×390、双主题、三语、两标签等待/进行中/观战、专项、Quality Gates、完整 `npm test` 与双构建 Hash 已通过。浏览器 reduced-motion、独立第二桌面浏览器、真机和真实网络整形仍未执行；该批次未提交、推送或部署。
- Tank Controls P0 已完成本地实现与自动化验收：Pointer Capture 八扇区/斜向摇杆与跟手反馈、D-pad 无障碍降级、独立多指开火、WASD/方向键/Space、blur/visibility/pointercancel/lostcapture/destroy 释放和 44px/safe-area/reduced-motion 适配；relay/authority 输入对象、seq、服务端位置/弹道/结算不变。专项 Tank Controls、Tank Authority、Gameplay Upgrade、联机 E2E、三语、DOM、响应式、Immersive Shell、Quality Gates、完整 `npm test` 通过；localhost 浏览器因已保存权限未能访问，第二浏览器、真机和真实网络整形仍未执行；该批次未提交、推送或部署。

2026-08-10 长需求已按来源完整入账，新增明确轨道包括：报告分层归档、UI Repair P0、Social Match P1、五子棋/飞行棋 Tabletop Presentation M1、Tank Controls P0、Player Character + Monopoly P0、Progression Identity P1 与 Global Catalog Foundation。后续按该依赖顺序逐批执行；每个 active task 只承担一个主要领域，不把美术、游戏规则、社交协议、经济与生产基础设施杂糅修改。

固定范围继续是六款精选游戏及人机/联机两种正式玩法。旧 11 款、三模式范围已被替代；井字棋、弹珠跳棋、斗兽棋、国际跳棋、贪吃蛇等不恢复。Logo 与 Honru 正式角色分离，美术 M0/P1/P2 在人工清稿、Reviewer B、IP Review、真机矩阵和用户 Golden Set 决议前继续默认关闭。

图片生成必须优先最高质量图像模型与最高质量参数。只有在冻结 Prompt、参考、尺寸、Alpha 与风格合同下，高阶模型和 `gpt-5.6-terra max` 输出经人工可见对比达到实质等价，才允许下放批量生成。

UI Repair P0.3–P0.9 已完成本地收口：P0.3–P0.8 覆盖 Chat 原文边界、公开 Profile/社交弹层、Premium Background、访客 affordance 与商城真实试穿/密度。P0.9 为既有 `direct-chat-v1` 增加表现状态：会话刷新/连接 live status、aria-busy、未读语义、历史加载/日期分隔、加载旧页滚动锚点、真实断线 pending 清理和移动安全区；服务器消息类型、好友/Block/访客权限、正文净化、Supabase 与持久化不变。主负责人审核修正了锚点提前消费和断线 loading 两个边界；Chat 专项、旧合同、线上 Direct Chat、Social Match 生命周期、三语言、DOM、完整 `npm test`（113.2 秒）通过，最终构建为 924691 bytes，SHA-256 `1E00C59C0C6E5FA197BD7C4DB2EA60795897A5CB2992340863FF5F78199133F5`。localhost 可见复核被保存权限阻断，外部设备/网络闸门仍开放；本批次未提交、推送或部署。

Social Match P1 的 `match-chat-v1` 已随 `da3d05c` 发布：客户端只提交 `matchId/messageId/text`，服务器权威签发 sender、席位、时间与协议，执行 NFC/控制符净化、160 字/640 bytes/4 行限制、messageId 幂等、频控、逐接收者 Block 与观众延迟只读。每局最近 50 条只存在房间内存；Game Stage 提供中央历史、未读、输入、头像旁短气泡、举报和本地静音。Pages/Render 当前线上哈希 `E8B8D37C66D8843B61F040EAF5028995A5EBF5E30FDD6ABFF6036AB84EDE304E` 包含该协议；外部设备、真实网络、可见 reduced-motion 与 Honru Emoji 人工审批仍开放。

Home Engagement P0 已完成本地纵切：首页新增语义化三步引导，正式账号按既有 `played` 稳定推荐游戏并显示 level/streak 轻量目标，访客/空档案使用独立 fallback；推荐入口进入 Games 后聚焦对应卡片，正式账号成长入口进入 Profile，访客入口明确写“开始第一局”。全部新增文案进入三语言，桌面/平板/手机布局继承双主题令牌；没有增加服务端状态、经济数值、游戏规则、AI、Replay、数据库或未审批美术。好友比较、稀有收藏差距、装备目标和真正可恢复对局仍需独立隐私/经济/恢复合同。专项动态矩阵、三语言、DOM、Ghost Shell、响应式和完整 `npm test`（131.5 秒）通过；双次构建一致，输出 927995 characters、物理文件 942085 bytes、SHA-256 `7980FEDB5222444C42AA7DC3540EE000F353D85ACB0A0316920B417E9903919B`。未提交、推送或部署。下一条无外部阻塞主线为 Tabletop Presentation M1。
Tabletop Presentation M1 第一纵切已完成本地实现：新增唯一可逆 `TabletopPerspective`，五子棋第二席使用 180° 近端视角，飞行棋按本人 2/3/4 人逻辑阵营旋转基地、轨道、终点和移动位置；协议、规则、快照、Replay、奖励、AI 和观众公共视角保持标准坐标。主负责人修正 E2E 屏幕坐标尺寸/视角映射，并修正棋盘外坐标夹边漏洞。专项、Tabletop Wave A、AI、Gameplay、连续默认参数 E2E 与完整 `npm test` 通过；双构建输出 930449 characters、物理文件 944539 bytes、SHA-256 `CCA3CAB3193F2A75922B78D6A626716FFA92B012C063A68F4D5D489815F0D301` 一致。localhost 可见复核被机器保存权限阻断；下一步是独立 Action Presentation 批次，动作表现、第二浏览器、真机、真实网络、可见 reduced-motion 和人工美术审批仍未完成。未提交、推送或部署。
Tabletop Presentation M1 的代码原生动作/收尾已继续完成：五子棋以 680ms 墨线环/放射冲击替换红色最后一步方框，并在 reduced-motion 下保留静态强调；飞行棋既有标准路径起飞/移动/碰撞/终点反馈经本地视角几何复核；五子棋/飞行棋有 520ms 轻透视入场且 reduced-motion 完全禁用。Shared Victory Overlay 增加可选命名有序排名台，飞行棋从既有 `placement` 显示 2/3/4 人三语名次，不改其他游戏的弹层生命周期。专项、三语、Overlay 动态、Gameplay、DOM 和完整 `npm test`（118 秒）通过；双构建输出 934153 characters、物理 948243 bytes、SHA-256 `7FE8BC67E7D8E4B2C4356EB655C569E746787C851525CA30ACE4CAA7917C2FF6` 一致。localhost 仍被保存权限阻断，正式材质/角色/动作资源与外部设备/网络/人工审批仍开放；未提交、推送或部署。
Progression Identity P1 已完成本地实现：六款游戏分别使用 `1/10/50/100/1000` 胜场五级阶梯，共 30 个差异化三语称号；服务端只从权威 `u.wins` 生成只读 `mastery`，旧账号无需数据库迁移或补授予任务，相同胜场投影天然幂等。本人主页显示当前称号、首胜/下一档目标，公开 Profile 显示已解锁称号；负数、小数、超大数、不可转换值、继承字段、未知游戏和客户端伪造均有安全回归。主负责人补修排行榜缓存绕过权威 Profile 请求及 Windows Metrics 固定端口碰撞。专项、安全联机、三语言、响应式、DOM 与完整 `npm test`（132.2 秒）通过；双构建输出 937242 characters、物理 951343 bytes、SHA-256 `41C9F1A26C050C7F3705C5DD0422567C0F6D219E630B99D57E4AD7D967E34142` 一致。未修改 Reward、Supabase、规则、协议、AI、Replay 或未审批美术；外部浏览器/真机可见验收和正式图片徽章审批仍开放，未提交、推送或部署。
下一条本地独立主线转为 `ECO-017/UI-025 Profile P1`：在已有成长、六款战绩、好友、任务、收藏和本人回放信息架构上继续做可见目标、收藏差距和受控比较；不新增好友隐私泄漏、不绕过商城权威、不提前接入未审批角色图片。
Profile Journey P1 已完成其中安全的第一纵切：主页新增最近称号、成就进度和收藏规模三张只读目标卡，分别复用 Games、成就和商城入口。好友比较不可直接复用公开 `profile_get`，必须先定义正式好友、双向 Block 与窄化字段投影；稀有度也不能从商品价格推断。当前仍未提交、推送或部署。

Profile Compare P1 已完成第二纵切：`profile_compare` 仅接受正式账号对当前好友的请求，每次读取前重新验证好友关系与双向 Block；服务端只投影身份、等级、总局数/胜场、六款权威胜场及派生称号、成就数量，并以 `requestId + targetUid` 绑定回执。客户端在换号、真实断线、取消和迟到响应时清理请求，桌面为双列、手机为单列，沿用统一焦点/Esc/背景关闭/滚动锁。三账号在线回归、三语言、DOM、Profile/Social、完整 `npm test`（118.1 秒）和双构建哈希均通过；公开 `profile_get`、Reward、商城价格、Supabase、规则、AI、Replay 与美术未改。下一本地主线为旧 Profile 编辑器/成就弹层 a11y；稀有度继续等待独立治理目录。未提交、推送或部署。

Profile Modal A11y P1 已完成第三纵切：资料编辑器和成就弹层复用共享 dialog helper 与 owner 滚动锁，昵称输入/关闭按钮作为初始焦点，Tab/Shift+Tab、Escape、背景、保存/取消/关闭都进入同一幂等关闭路径，并恢复发起控件焦点。局部 CSS 提供 `100dvh` 内部滚动、44px 控件和手机宽度；主审补充断言并移除会覆盖响应式规则的成就卡 460px 内联宽度。完整 `npm test`（122.5 秒）和双构建哈希通过。下一本地主线为收藏稀有度不可变展示目录；不按价格推断，不改商城权威。未提交、推送或部署。

Collection Rarity Catalog P1 已完成第四纵切：纯 `CollectionRarityCatalog` 以五类稳定 ID 显式编目 150 项资产，固定 Starter/Uncommon/Rare/Epic 四档，不读取价格、金币、购买或奖励字段。本人 Profile 只从本地 `account.owned` 派生编目进度/分布，商城卡读取单项标签；公开 Profile、好友比较和 WebSocket 不接入 owned。主审补齐默认免费 avatar 0–29 与 frame/effect/background 0，避免新账号误报 33 件“未编目”。完整 `npm test`（114.2 秒）与双构建哈希通过；未提交、推送或部署。

Home Engagement P1 已完成本地安全聚合纵切：仅正式账号可在首页看到在线好友数、本人收藏编目进度和既有成长方向的可关闭脉冲，三个动作只复用 Profile、Chat、Shop；访客/未登录不读取或展示该私有聚合。关闭偏好以每账号固定 `localStorage` key 保存、本地日期为 value，storage 失败安全退化，主审已补跨日期有界存储回归。没有 server、protocol、economy、purchase、rules、AI、Replay、Supabase 或 art 变化，也不显示余额、owned ID、价格、购买记录或好友明细。首次完整链在邀请房间一次性超时，随后单独 E2E（53.7 秒）和后续完整 `npm test`（179.7 秒）通过；双构建一致为 968233 characters / 982494 bytes / SHA-256 `4A861DD2F6763FE4AFA4640E7F6AEC7418A0DC9E4EAD52BD41831C0988E43C37`。UI-010/ECO-023 保持 `partial`，因为真正可恢复对局仍须另立权威恢复合同；未提交、推送或部署。

Home Identity P1 已完成本地只读纵切：在既有 `#home-engagement-pulse` 内，仅正式账号展示现有 `avatarStageNode` 的 56px 头像/头像框/特效组合、raw 昵称和三语 `Lv.N`，继续沿用本人收藏 X/Y 以及 Profile/Chat/Shop 入口。访客和未登录路径在读取 `owned` 或调用身份 helper 前短路；catalog 缺失安全降级；不展示 coins、XP、价格、owned ID、购买记录、角色 slot、未审批图片或任何新 mutation。红测预期 8 项失败后转绿，专项、Home P0/P1、收藏目录、称号、Identity Preview、Profile Route、i18n、DOM、响应式、Ghost Shell、pretest、Quality Gates 与完整 `npm test`（120.7 秒）通过；双构建一致为 971303 characters / 985572 bytes / SHA-256 `963DEAEFC5B46621ACCE9B713444D3F3B7F5DC41C775990CD87BE36E501D69FF`。UI-011 仍为 `partial`，G Coins 获得路径、角色服装/商城/背景和外部人工/设备门禁另行处理；下一主线只可定义为当前仍有效对局的同实例返回入口。

Home Active Match Return P0 已完成本地纵切：Home 仅在 WebSocket 已连接/认证、非观众、真人席位、同一 `currentGame/currentGameId/online.game/matchId` 且未结算时显示“返回当前对局”。按钮在点击时重新校验 matchId，只调用既有 `showGame()` 同实例 fast path；stale click、结算、离房、过期、reset、replay/reconnect 和异常 seat 均 fail-closed。`showHub()` 只在当前路由为 Home 时重渲染卡片，使生命周期变化立即反映；没有新服务器消息、resume 请求、localStorage、结算、奖励、Replay、经济、规则、AI、Supabase 或美术变化。主审修正旧 Home VM 合同未加载新 helper 的兼容回归；完整 `npm test`（199.8 秒）通过，双构建一致为 974130 characters / 988467 bytes / SHA-256 `8ECE8C16D5AE051DE59A31D9FA14949FF607675504059BC26BD050BE505F81E8`。该能力明确不是跨设备、跨重启或持久恢复；未提交、推送或部署。

发布采用显式指令制度：用户未在当前任务明确要求“推送 / 输出线上 / 部署”时，只能完成本地实现与验收，不得执行 commit、git push、GitHub Pages 或 Render 发布。

Game Stage Wave C 的五子棋/Tetris reviewer 收口已完成：五子棋新增真实 `clearTimeout` 生命周期、可聚焦 15×15 keyboard grid、方向键/Enter/Space 和五枚 44×44 触控等价按钮；观众、非当前联机玩家、AI 回合和销毁态无法越权落子。Tetris 的 AI 定时任务改为实例私有 Map，restore、Replay、Authority snapshot、reset 与 destroy 都会取消旧任务，只有 live 非 Replay 状态可以重排一份任务。两款规则、Authority、协议、快照、Replay、奖励与 AI 学习数据形状不变；共享过程动效改用 Motion Token。专项、规则权威、网络混沌、三语言、DOM、Quality Gates、完整 `npm test`（159.8 秒）和双构建 SHA-256 `6B823D0E2F2399EB622799E4E1DEC6EEBC43F7DA02E78075C80F0A51E910AF1D` 通过。浏览器内核仍在页面导航前返回 `Transport closed`，所以最新可见矩阵、第二浏览器、真机和真实网络继续为 `NOT_EXECUTED`；本批未提交、推送或部署。

## 2026-08-12 Control Plane Reset（新总指挥落地）

`requirements/MAINLINE_CONTROL_ROUTING.json` 是总指挥入口的执行侧路由，不取代原子台账。242 项需求目前唯一分为：`NOW_CLOSURE` 146 项、`EXTERNAL_GATE` 32 项、`DEFERRED_MAINLINE` 48 项、`FUTURE_EXPANSION` 16 项。外部依赖合并为三条共享 Gate：设备/浏览器/真实网络、真实 Supabase 生产、人工清稿/Reviewer B/IP Review/Golden Set。`qa/mainline-control-plane.js` 会拒绝漏项、重复归类、Gate 扩散、未来扩展藏匿 P0/P1 和状态语义漂移。

当前阶段停在 `CONTROL`，下一阶段为 `CLOSE/Ghost3D Foundation`。最新本地浏览器仍立即 `Transport closed`，因此 TECH-027 已从历史 `verified` 回写为 `partial`；历史线上证据继续保留，但不能替代最新可见复核。此次只更新治理、报告、状态和 QA，未改运行时、协议、数据、经济、美术 runtime，也未提交、推送或部署。

## 2026-08-12 Ghost3D Foundation P0（本地）

`TECH-049` 现为 `partial`：无依赖 Foundation 以 inert core 形式参与确定性构建，但没有接入任何游戏。公共边界刻意收窄为模块 `create` / `QUALITY`，以及实例 `apply(message)` / `snapshot()` / `dispose()`；语义 frame、input、motion、quality、environment 与 lifecycle 只能从 `apply` 进入，Adapter 和 programmatic fallback 的生命周期留在模块内。源码零 DOM、平台或 engine 依赖，不读取/监听浏览器环境，也不让 Renderer 类型越过 Rule、Authority、Protocol、Replay、Reward、AI、Economy、Social 或持久化边界。

Foundation 批次冻结时，Three `r185 / 0.185.1` 仍只是研究/未来实施策略；该历史事实由 Foundation active task 保留。后续 Gomoku Ghost3D 已另立纵切任务，因此当前全局状态不能继续写成“没有 vendor 或 Adapter”，但同样不能把后续 Renderer 事实反向塞进 Foundation、规则、协议或持久状态。

主审三轮修正也属于本地 Foundation 事实：第一轮移除宽 Interface 与 DOM/平台耦合，第二轮补齐异步 mount/configuration、stale quality/environment 与 fresh-adapter recovery，第三轮收紧 motion readiness，并用 VM browser-global、cross-realm frame、hostile projection 覆盖 narrow seam。当前 `qa/ghost3d-foundation.js` 的 41 条断言仅证明本地合同；不替代浏览器、设备、网络、人工美术或发布证据。

## 2026-08-12 Gomoku Ghost3D P0（本地实现，待可见证明）

`TECH-049` 的首条游戏纵切已在 `requirements/active/gomoku-ghost3d-vertical-slice-p0-20260812/` 落地，状态仍为 `partial`。五子棋只在精确本地旗标 `mg_ghost3d_gomoku_v1 === '1'` 时懒加载同源 ESM island；默认关闭、Wave B Canvas/键盘/触控永久存在。Three `r185 / 0.185.1` 与 GSAP `3.15.0` core 采用版本化相对 import，不使用 import map、CSSPlugin、ScrollTrigger、GLB、纹理、Loader 或未审批美术。`vendor-provenance.md` 固定 tag、commit、NPM integrity、本地 SHA-256 与许可证；`.gitattributes` 保护 vendor bytes 不被 Windows 换行规则改写。

程序化 Renderer 提供真实 Scene、Camera、厚度 geometry、material、lighting、15×15 权威状态投影和 revision-bound Raycast，但不重新判断合法性。`onReady` 只在第一帧真正 `renderer.render()` 成功后触发，失败前 3D pointer 保持关闭；HIGH 使用可 kill 的 `entrance → settled` Camera timeline 与落子 timeline，LOW/reduced-motion 直接抵达静态稳定态。render failure、visibility/shell suspend、context loss、fresh Adapter recovery 与 dispose 都会清理 timeline/render loop/listener/geometry/material/renderer，并把输入安全交还 Wave B。

专项当前为 ESM graph 55、Renderer 78、bridge、layout、SW cache，均已进入 `pretest`、完整测试生命周期和快速 Quality Gates；Service Worker 升级为 `ghost-game-shell-v3-20260812`，但 Three/GSAP 仍不进入安装 shell，只在首次进入五子棋后按需缓存。双构建稳定为 1,302,076 characters / 1,316,625 bytes / SHA-256 `91AC0AAB42577EF1F2385A351F3E3614C8AAE86C5D228929D11EEB76706C67D4`。

这仍不是 `3D_VISUAL_VERIFIED`：最新本地浏览器可见矩阵、第二浏览器、Android/iPhone/Tablet、可见 reduced-motion、真实帧耗/FPS/GPU memory/dispose、真实网络、GLB/正式美术、Reviewer B/IP Review/Golden Set 都没有完成。ART-033 继续 `planned`，线上继续是 `da3d05c`，本批没有 commit、push 或部署。

## 2026-08-12 UI Motion Closure P1（本地实现，待可见证明）

`UI-028 / TECH-054` 的第一条全局 DOM GSAP 纵切已在 `requirements/active/ui-motion-closure-p1-20260812/` 落地。四区继续由现有 `setAppRoute()` 同步拥有认证、连接、hash、`aria-current`、Home/Profile/Playline renderer 与 Hero timer；新的 `GhostRouteMotion` 只负责已提交目标页的有限分层进入，外部 Interface 为 `transition / settle / dispose / snapshot`。这避免把高扇出同步路由隐式改成异步，也保留“切到 Games 后下一帧 focus 推荐卡”等既有键盘合同。

页面 ESM island 固定为官方 GSAP `3.15.0` 的 `index.js / CSSPlugin.js / gsap-core.js` 闭合相对图，三份文件由官方 tag URL 和 SHA-256 provenance 固定。第一次不同 route 只 lazy-load 预热，不在模块迟到后重放页面；后续以单一 `committed → enter → settled` timeline 动画 route root 与最多 11 个语义分组。运动只使用 transform/opacity，分组最低 opacity 0.15，目标页始终可见、可点击、可聚焦；完整窗口不超过 360ms。没有 ScrollTrigger、CDN、持续 rAF、计时器或布局属性动画。

桥接层使用单 loader promise、单调 generation、sticky failure fallback 和 stale-handle 隔离；每条 timeline 在本地 `gsap.context` 中创建，由自己的 handle kill，最终 dispose 只 revert 本实例。相同 route、reduced-motion、document hidden、Game Shell active、认证 Page、注销、加载/模块失败都同步 settle；四区 hidden、`aria-hidden`、`inert` 始终一致。Service Worker 升级 v4，但 DOM GSAP 与 Three/GSAP 3D 图都不进入安装 shell，只按需缓存。

专项为 Route Contract 18、Bridge Runtime 17、Adapter 11、ESM Graph 16、Cache 4 条断言；三语、DOM、Ghost Shell、Quality Gates 与完整 `npm test`（176.6 秒）通过。双构建稳定为 1,312,603 characters / 1,327,152 bytes / SHA-256 `1C802828EF5E799358F8199163428AD2BFBC5572CD90997999E82EC80B887DF3`。浏览器连接器仍在插件初始化前返回 `Transport closed`，所以最新可见、第二浏览器、真机、visible reduced-motion 和低端 FPS 继续 `NOT_EXECUTED`；该能力只能写为本地 implemented，未提交、推送或部署。

## 2026-08-12 Profile Design System P1（本地实现，待可见证明）

`UI-025 / UI-027 / UI-028 / SOC-014` 的 Profile 纵切把本人页从连续卡片流重排为 `identity / growth / journey / library` 四个稳定区域：桌面身份与成长双栏、平板/手机单列；等级、胜场、胜率与 G Coins 作为核心指标，局数、连胜、最佳连胜与成就作为辅助指标。资料编辑只保留 Hero 主入口，六游戏、成就、任务、社交、收藏和本人回放继续使用既有权威数据与入口；44px、safe-area 和横向溢出合同同步保留。

公开 Profile 没有扩张协议。服务端仍只接收 `profile_get { uid }` 并返回 uid-only `profile_data`；客户端为每次请求生成仅本地使用的 requestId，把最多 32 条请求按 WebSocket 消息顺序记录。取消后立即重开同一 UID、迟到响应、UID 不匹配、真实断线、换号和注销都不会打开旧弹层，安全缓存仍可吸收迟到的公开投影。好友操作收为私聊、战绩比较和一个“关系与安全”入口；非好友只保留单一关系/安全主入口，好友/Block/访客权限没有放宽。

Profile 弹层只调用既有 `GhostSurfaceMotion` 的 `profile-dialog/open` 与 `settle`，没有第二套 Adapter、直接 GSAP import 或 ScrollTrigger。关闭时先 settle 可选动效，再同步完成 aria、焦点、滚动锁和 DOM 业务状态，避免表现层延迟可访问关闭。专项 14+9 条及 Profile Route/Loading/Social/Modal/Compare 回归、Quality Gates 和完整 `npm test`（156.6 秒）通过；双构建一致为 1,337,226 characters / 1,351,775 bytes / SHA-256 `8E7BB74A304E6D9BF5CEC0F21CF30C834921CED2F0583C23CC4B79AD0758B39F`。两次 Terra Max 终审任务均未交付可用结论，主负责人未把独立审查冒充通过，而是亲自完成代码和测试终审。

该批次仍不是 browser/device verified：连接器继续 `Transport closed`，最新本地桌面/平板/手机、第二浏览器、真机、visible reduced-motion、真实网络与低端 FPS 均为 `NOT_EXECUTED`。线上保持 `da3d05c`；未提交、推送或部署，也未触碰 UI-037/ART-036/GAME-045、经济、奖励、Supabase、游戏权威或未审批美术。
