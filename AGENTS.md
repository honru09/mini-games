# AGENTS.md — Mini Games Platform 项目上下文

> 本文件是给 Codex / 新协作者的项目说明书。新环境克隆本仓库后，Codex 会自动读取本文件；
> 也可以直接说「读一下 AGENTS.md 了解项目」。

## 1. 项目一句话

**Ghost Game / Mini Games Platform** — 网页版多人游戏平台：五子棋、飞行棋、迷你大富翁、坦克大战、
俄罗斯方块、象棋，共 6 款精选插件化游戏。
平台是主体（大厅 / 好友 / 房间 / 排行榜 / 💵 / 成长 / 社交），游戏是插件。

核心理念 **Fast Fun Loop**：打开 3 秒开局 → 5 分钟一局 → 立刻再来；先看到「人」，再看到「游戏」。

两种玩法：**人机对战**（六款本地强策略 + DeepSeek 近优裁决）、
**联机对战**（WebSocket 房间 + 游戏大厅 + 邀请 + 在线状态 + 全球排行榜）。
含 **用户名密码账号 + 旧 PIN 迁移 + 一次性访客**、**💵 商城**、**三语言 i18n**（zh-CN / en-US / uk-UA）、
**昼夜双主题**、Home/Games/Playline/Profile 四区外壳、原创品牌角色 **Honru** 与六款统一 Game Stage。

### 唯一主线总指挥

任何涉及下一主线、需求分类、视觉收口、3D Renderer、GSAP 动效、设备/Supabase/美术 Gate 或发布顺序的任务，必须先完整阅读 `requirements/GHOST_GAME_MAINLINE_COMMAND.md`，随后读取 `requirements/MAINLINE_CONTROL_ROUTING.json` 的当前四类路由与三条共享 Gate。原子需求仍只以 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 为事实源；Defect、Acceptance Gap 与 Shared Repair 归回现有需求/覆盖组，只有真正新增产品能力才建立新 Requirement ID。

任何新位图、UI mockup、宣传图、分享卡、角色图、游戏贴图或参考图编辑任务，必须先完整阅读 `requirements/ART_GENERATION_SKILL_PIPELINE.md`，为该资产族记录九个已安装图像 Skill 入口的 `APPLIED / NOT_APPLICABLE / UNAVAILABLE_EXTERNAL_CREDENTIAL` 路由结果，再进入生成、派生和审查。外部 `EXTERNAL_REFERENCE_ONLY / blocked-license` 素材可按受控全信息 reference lane 提供给已授权 Skill；其许可状态、输入哈希、相似风险与 runtime 禁止边界必须继续单独记录。

## 2. 线上地址与仓库

- 前端（GitHub Pages）：https://honru09.github.io/mini-games/
- 后端（Render，Node）：https://mini-games-online.onrender.com
- 仓库：https://github.com/honru09/mini-games（默认分支 `main`）

## 3. 目录结构

```
mini-games-online/
├── AGENTS.md            # 本文件
├── README.md            # 用户向说明
├── public/
│   ├── index.html       # 构建产物（index-template.html + src/ 合并）
│   ├── index-template.html # 前端骨架模板
│   ├── src/             # 前端源码（build.js 合并进 index.html）
│   │   ├── core/        # i18n / utils / assets / app-shell / game-framework / social / ai-personas / diagnostics / renderer-governor
│   │   ├── games/       # 6 款游戏规则/表现 + 人机 scheduleAI
│   │   ├── online/      # WebSocket 客户端（03-websocket）
│   │   ├── shop/        # 04-auth / 05-profile / 06-shop
│   │   └── ui/          # 07-roster（档案/排行榜/结算）
│   ├── locales/         # i18n 翻译文件（zh-CN / en-US / uk-UA）
│   ├── manifest.webmanifest / sw.js # PWA 安装与安全离线壳层
│   └── assets/          # 品牌、UI、游戏美术与 manifest；必须保留程序化 fallback
├── server/index.js      # 零依赖 Node 服务：静态文件 + 手写 WebSocket(/ws) + /api/ai + /api/companion + Supabase
├── server/auth-credentials.js # 用户名规范、随机盐 scrypt 密码哈希与恒定工作量验证
├── server/companion.js  # Honru 请求净化、Prompt、白名单响应与三语离线回退
├── server/reward-engine.js # Economy & Progression v1.0 唯一奖励配置、等级曲线与纯计算层
├── server/ai-strategy-skills.js # 六款 AI 专项知识包（运行时不联网）
├── server/ai-learning.js # personal-linear-v2 玩家×游戏持续学习
├── server/cluster-coordinator.js # 可选 Supabase 租约、持久事件、跨实例 Chat 引用与脱敏遥测
├── server/gameplay/     # Tank、三套 Rule Authority、赛事、协议、指标与兼容适配器
├── shared/rules/        # Tetris / Xiangqi / Monopoly 无 DOM 共享纯规则核心
├── shared/progression/  # 服务端权威胜场到只读成长身份的共享派生模块
├── scripts/             # 运维脚本
│   ├── render-status.js # 只读查看服务/部署状态
│   ├── render-env.js    # 写 Render 环境变量
│   ├── render-deploy.js # 手动触发 Render 部署
│   ├── supabase-status.js # 检查 Supabase 连通性与迁移字段
│   ├── supabase-production-ops.ps1 # 默认 dry-run 的备份/迁移/验收/恢复/非破坏回滚
│   ├── long-session-smoke.js # 正式好友 WS 长会话与重连证据
│   └── ws-live-test.js  # 线上 WebSocket 冒烟
├── qa/                  # 测试
│   ├── dom-smoke.js      # 前端冒烟
│   ├── ai-games.js       # 6 款 AI 合法选择、回退与状态机回归
│   ├── reward-system.js  # Reward Config、等级曲线、防刷与人机/联机双模式奖励回归
│   ├── rule-authority-online.js # Tetris v3 + 象棋/大富翁 v2 动作/状态/错误/重连/滚动兼容
│   ├── tournament-auto-online.js # 自动建房、结果回传与下一轮生命周期
│   ├── game-cosmetic-profile.js # 公开装备合同与私有字段隔离
│   ├── e2e-online.js     # 端到端联机
│   ├── security-online.js # 鉴权/商城/结算/AI 安全回归
│   ├── reconnect-online.js # 断线重连与超时回归
│   ├── supabase-adapter.js # 本地 fake PostgREST 适配器回归
│   └── ws-close-test.js  # WS 主动断开测试
├── supabase/schema.sql  # 数据库建表
├── render.yaml          # Render Blueprint
├── package.json         # 零依赖
└── data/                # 本地 JSON 存储（.gitignore）
```

## 4. 快速开始

```bash
# 1) 本地跑全站
node server/index.js            # http://localhost:8080

# 2) 测试
npm run test:i18n              # 三语言唯一 key、占位符、动态切换与界面泄漏检查
node qa/pwa-offline-i18n.js    # 真实 SW VM：离线三语与 API/其他 JSON 缓存隔离
node qa/dom-smoke.js            # 前端冒烟
node qa/game-stage-contract.js  # 对局舞台、Seat Rail、Tetris 手机布局
npm run test:game-stage-density-final # 六款 Wave C 过程链、生命周期与共享布局
node qa/monopoly-character-presentation.js # 角色公开投影与代码原生 fallback
node qa/monopoly-presentation-adapter.js # Monopoly revision/transition 表现 Adapter
node qa/social-match-client-lifecycle.js # 同连接 capability 保留/真实断开清理
node qa/tabletop-art-runtime.js # 六款 Wave A 与严格 0 回滚
node qa/ai-games.js             # 6 款人机状态机
node qa/ai-strength.js          # 六款战术强度与候选特征
node qa/ai-learning.js          # 个人持续学习纯单元回归
node --experimental-websocket qa/ai-learning-online.js
node qa/gameplay-upgrade.js     # 六款共享 Gameplay 接口
node qa/tank-controls.js       # Tank Controls P0：摇杆/D-pad/开火/释放
node qa/tank-authority.js
node qa/tetris-battle-protocol.js
node qa/tetris-rule-core.js
node qa/xiangqi-rule-core.js
node qa/monopoly-rule-core.js
node qa/rule-authority.js
node --experimental-websocket qa/rule-authority-online.js
node qa/protocol-version.js
node --experimental-websocket qa/game-cosmetic-profile.js
node qa/gameplay-load.js
node --expose-gc qa/gameplay-memory.js
node qa/heartbeat-sweep.js # heartbeat 分域异常后同 tick/第二 tick liveness
node qa/timer-audit.js
node qa/network-chaos.js
node qa/controlled-transport-preflight.js # Tetris 重连序号、Tank 测试 epoch、旧 WS callback 与 DM 数值序预检
node qa/spectator-room.js
node qa/tournament.js
node qa/tournament-auto-room.js
node --experimental-websocket qa/tournament-auto-online.js
node qa/xiangqi-clock.js
node qa/monopoly-auction.js
node qa/reward-system.js        # 奖励与成长纯服务端回归
node qa/supabase-schema.js      # SQL 表、RLS 与原子 RPC 静态回归
node qa/production-readiness-contract.js # Cluster/Telemetry/PWA/Production Ops/美术审批边界
node --experimental-websocket qa/security-online.js
node --experimental-websocket qa/reconnect-online.js
node --experimental-websocket qa/supabase-adapter.js
node --experimental-websocket qa/e2e-online.js   # 联机 E2E（Node 20 需此开关）
node --experimental-websocket qa/ws-close-test.js

# 3) 本地调试 AI
$env:DEEPSEEK_KEY='sk-...'
node server/index.js
```

浏览器实测：开两个标签访问 localhost:8080 即可模拟两人联机。

## 5. 架构与关键设计（改代码前必读）

### 联机
- 五子棋/飞行棋仍是服务端顺序与身份校验 + 客户端规则/稳定快照；Tank 使用 `tank-authority-v1` 服务端模拟；Tetris 默认协商 `tetris-rule-v3`（T-Spin/B2B/Combo/Perfect Clear Advanced Battle Score），象棋/大富翁协商各自 v2。旧 Tetris v2 客户端与 `TETRIS_GUIDELINE_SCORING=0` 均回退 v1 Coordination，避免严格字段白名单在滚动发布时拒绝新状态。
- 连接必须先用服务端签发的 session token 鉴权；uid 本身不是凭证。
- 对局开始时服务端下发一次性 `matchId`，保留有限 `moveLog`；异常掉线进入重连窗口，显式离开仍立即释放席位。
- 服务端在实时广播和 `moveLog` 中附带可信 `player`；客户端只接受当前行动者的输入，大富翁提前结算另由服务端限制为房主。
- 真人离房时，服务端结束当前对局、压紧剩余席位并通过 `player_reassigned` 更新索引；若离开者是房主，则转移给剩余真人最低席位并迁移 AI Controller。
- `peer_left.payload.roomClosed` 明确区分房间是否关闭：只有最后一个真人离开、房间不再有真人会话时为 `true`；仍有真人时为 `false`，房间保留并广播 `host_changed`（如适用）。
- 消息类型见 README「消息协议」表；新消息在 `server/index.js handleMessage` 和
  `public/src/online/03-websocket.js onMessage` 两处成对添加，再运行构建同步 `public/index.html`。
- 房主权限：选游戏、开始、结束本局、新一局；非房主点这些按钮会被拦（toast 提示）。
- 独立观众席不占玩家位；观众只能接收快照/结果，服务端拒绝 `move`、Tank input、Tetris claim、拍卖出价等 mutation。
- 赛事编排由 `tournament-orchestrator-v1.1` 维护 3–4 人循环赛、5+ 三轮 Swiss、Bye、积分和重连快照；全员同意后自动创建真实 6 位房间、分配席位、启动比赛、接收单盘服务端结果并自动推进下一轮。参赛者只能为自己弃权，管理员恢复必须明确 `targetUid`，赛事桌不进入普通 💵/XP/胜场。
- `ENABLE_RULE_AUTHORITY_V2=0` 是三套 v2 的紧急兼容开关；默认开启。新协议/消息必须同步 `server/gameplay/protocol.js`、README 注册表、客户端 capability 与专项测试。

### 人数规则
- 房间容量 2-5（建房时选）。
- **按"当前已加入人数"开局**：房间不满也能开始。
- `server/index.js joinRoom` 为每个加入者分配递增且不重复的玩家索引（0,1,2…），切勿改回固定值。
- 前端 `startOnlineGame(id, sizeOverride)` 用 `online.roomInfo.size` 决定 `playerCount`，不能写死成 2。

### 结算与排行榜
- 所有正式奖励由 `server/reward-engine.js` 的统一 Reward Resolver 决定；客户端和六款游戏只提交结果/展示明细，不能直接修改金币、XP、等级、连胜或胜场。
- 联机 1v1 胜/平/负为 `3/2/1💵` 与 `12/10/8 XP`；3–5 人按第 1/2/3/其他名次为 `4/3/2/1💵` 与 `14/12/10/8 XP`。
- AI 胜/平/负为 `1/0/0💵` 与 `8/6/5 XP`，服务端票据绑定对局且每日最终货币（含等级里程碑）最多产生 `3💵`。
- 联机时客户端提交完整结果 claim；服务端等待房间成员提交相同结果后才结算，`matchId`/重复提交都会校验。
- 人机必须先通过 `solo_start` 获取服务端 `matchId/resultId`，并用 `solo_progress` 上报由游戏合法动作回调产生的进度；新客户端的每个操作含不可重复 `actionId`，重连补发不得重复计入；旧版客户端自造 `solo resultId/coins` 会被拒绝。
- 有效局同时检查服务端开局时间、结构合法的有效操作数、唯一操作指纹和活跃参与者；秒投、过早取消、无进度、争议和 AFK 不产生正常奖励。
- 每日首次有效联机胜利额外 `+2💵/+5 XP`；3/5/8+ 连胜增加 `+2/+4/+6 XP`；同一玩家组合 24 小时第 11–20 局货币减半，第 21 局起货币为 0、XP 为 50%。
- `history` 保留兼容结算流水；`reward_history` 保存完整 Reward Breakdown；`economy_ledger` 审计每次正式 💵 增减；`analytics_events` 保存奖励与比赛埋点。
- 胜场使用服务端权威 `wins`（按游戏）和 `totalWins`（总胜场），只在有效正式胜利时增长，与 💵 余额完全解耦；Supabase 映射为 `profiles.wins` / `profiles.total_wins`。
- 配置 Supabase 时，正式奖励统一调用 `apply_reward_v1`：同一事务更新档案并写入 `history`、`reward_history` 与可选 `economy_ledger`；`analytics_events` 独立写入。匹配 `resultId` 的 duplicate 是幂等成功终态。
- Supabase 正式奖励先进入本地持久 outbox，RPC 成功后移除；短暂失败会按相同 `resultId` 自动重试，重启加载远端档案时优先保留未同步奖励对应的本地档案。
- 在线状态：10 秒心跳 / 40 秒超时判离线。

### 奖励与成长系统 v1.0（已实现）

- 权威增补文档：`requirements/Mini Games 对局奖励与成长系统需求增补.md`。
- 奖励数值、游戏权重、有效局阈值、等级曲线全部集中在 `server/reward-engine.js`；禁止重新散落到游戏文件。
- 等级需求为 `XPNext(level)=min(200, 30+5×level)`，累计 XP 迁移不降低既有等级；每跨越 5 级里程碑奖励 `5💵`。
- `result_ok.payload.reward` 返回当前玩家独立的资格、阻断原因、基础/加成/衰减、总 💵/XP、等级和连胜前后值，前端以 Reward Breakdown 弹层展示。
- `💵`、XP、未来 Rank/MMR 必须完全分离。
- 调整数值或资格阈值时必须同步 `qa/reward-system.js`、安全回归和联机 E2E。

### 人机对战（本地强 AI + DeepSeek）
- 6 款游戏各自的 `scheduleAI()` 先用规则/搜索筛出规范化合法近优候选，再交给 `aiChoose()`；模型返回值只有与候选原文完全匹配时才会执行，游戏自身的落子函数还会再次校验。
- DeepSeek 默认使用官方 `deepseek-v4-flash`；只有服务端环境变量 `DEEPSEEK_MODEL=deepseek-v4-pro` 可切换，旧 `deepseek-chat/reasoner` 不再使用。
- 客户端约 2.2 秒硬超时，服务端 DeepSeek 上游共享约 5 秒截止时间；无 token、无 Key、限流、断网、超时或非法响应都会静默使用六款本地强策略 fallback，不随机送子。
- 异步响应绑定局次、回合、阶段与局面；重开或离开游戏后旧响应会被废弃。`qa/ai-games.js` 用本地模型桩覆盖全部 6 款游戏，不需要真实 Key。
- DeepSeek Key 只存在服务端环境变量，绝不能写进前端或仓库。
- `server/ai-strategy-skills.js` 内嵌六款专项策略；`server/ai-learning.js` 使用 `personal-linear-v2` 按账号 × 游戏隔离学习。对局中缓存近优候选，胜局强化、败局反事实修正、平局中性反馈；无效/争议/AFK/秒投只审计不调权。
- AI 模型与经验只保存局面哈希和归一化特征，通过 JSON 或 Supabase `ai_learning_models` / `ai_learning_experiences` + `apply_ai_learning_v1` 原子持久化；`resultId` 重放、revision 冲突和账号/游戏并发均受保护。

### 账号、访客与旧 PIN 迁移
- 未认证时只显示 Ghost Game 登录前品牌页；可在进入应用前切换语言与昼夜主题。
- 正式账号用户名为 4–20 位 ASCII 字母数字且至少各一个，大小写不敏感唯一；密码为 8–64 位可打印 ASCII，保留大小写和首尾空格。
- 密码服务端使用版本化随机盐 `scrypt`；未知用户与畸形哈希仍执行 dummy scrypt。客户端只保存会话 token，不持久化密码或 PIN。
- 旧 PIN 注册/登录继续兼容；`legacy_bind` 将旧账号绑定到用户名密码并保留原 uid、资产、战绩与外观。
- 访客由服务端生成 uid/token，不写 JSON/Supabase/排行榜/持久 AI 学习；显式退出立即删除，异常断线保留 60 秒重连窗口；永久购买与社交 mutation 由服务端拒绝。
- session token 默认有效 30 天（`AUTH_TOKEN_TTL_MS` 可调整）；每个账号最多保留最近 5 个有效 token，超过上限淘汰最旧 token，`logout` 只撤销当前 token。
- 新认证消息：`username_check/username_status`、`register/login(authVersion:2)`、`legacy_bind`、`guest_login/guest_logged_in`；既有 `hello/profile_get/profile/purchase/result/logout` 保持兼容。

### Honru Companion
- `companion_checkin/companion_checkin_ok` 按账号与日期幂等；访客签到只存在内存。
- `POST /api/companion` 要求 Bearer token，并复用 Origin、请求体、并发、速率与超时边界；聊天原文不落库。
- 无 Key、超时或上游错误使用三语本地回退；没有可信来源时不得伪造天气或新闻。
- 当前前端不再提供 Honru Chat 子页、Dock、表单或快捷问题；后端接口只作为兼容/安全边界保留，签到与默认关闭的局内反应不受影响。

### 玩家私聊（direct-chat-v1）
- 玩家私聊不再占独立 Page，由全局 DM dialog 复用唯一 `direct-chat-v1` 状态；旧 `#/chat*` 归一到 `#/playline` 并打开私信。正式账号仅能与当前好友发送一对一纯文本消息，访客禁止持久私聊。会话列表的系统空态走 i18n，玩家昵称/消息正文才标记 `data-i18n-raw`，避免语言切换冻结系统文案。
- `chat_list/chat_history/chat_send/chat_read` 与 `chat_state/chat_history/chat_message/chat_send_ok/chat_read_ok/chat_error` 成对维护；sender、conversation、message ID、十进制字符串 seq 与时间由服务端权威签发。
- `(senderUid,clientMessageId)` 发送幂等；正文 NFC/控制符净化后限 500 Unicode/2000 UTF-8 bytes，只用 `textContent` + `data-i18n-raw` 渲染，不进入日志、Analytics、Replay、Profile、排行榜或 localStorage。
- 任一方向 Block 阻断发送和历史并从摘要/未读排除；解除好友后历史只读；已读必须对应本人真实收到的入站 seq 且账号级单调推进。
- 主动推送前重新校验 session token，已被五 token 上限淘汰或登出的旧 WebSocket 不得收到消息。
- 本地 JSON 有界回退为 90 天/每会话 500/全局 50,000；Supabase 启用时发送先经过数据库好友/Block/幂等事务并持久化成功再回执。多实例与生产持久化仍以真实 Supabase 迁移/并发/备份验收为前提。
- `ENABLE_CLUSTER_COORDINATION=1` 且真实 Supabase 迁移完成后，实例使用数据库时间租约与 fencing token；Direct Chat PubSub 只发布 message ID/参与 UID，其他实例再从数据库拉正文并重新校验有效 session。缺配置时保持现有单实例行为。

### Playline 社区（playline-v1）
- 四区为 Home / Games / Playline / Profile；Playline P0 只提供 `text/game_share/result_share/record_share`、All/Friends、删除、举报与公开资料/全局好友私信入口，不包含评论、点赞、转发、关注、媒体或陌生人私信。
- `ENABLE_PLAYLINE_V1` 默认关闭。作者、时间、可见性、引用快照、签名 cursor、幂等、频控、好友/Block 与举报目标由服务端权威处理；guest 与 Test Admin 禁止读写玩家 UGC。
- 本地 JSON 与 fake Supabase 只作为单实例/Adapter 回归；真实生产开放前必须完成内容治理、真实 Supabase 迁移/RLS/并发/加密备份/隔离恢复/回滚和运营门禁。

### 局内房间聊天（match-chat-v1）
- `match_chat_send/match_chat_sync` 与 `match_chat_state/match_chat_message/match_chat_ok/match_chat_error` 成对维护；客户端只提交 `matchId/messageId/text`，sender、席位、时间和协议由服务端签发。
- 只有 active match 的正式真人席位可以发送；访客与观众只读，AI、旧 capability、错误 match 和无效席位被拒绝。观众历史与实时消息遵守当前 spectator delay。
- 正文复用 NFC/危险控制符净化并限制为 160 Unicode 字符、640 UTF-8 bytes、4 行；`(senderUid,messageId)` 在当前对局内有界幂等，10 秒/60 秒/单局频控和逐接收者 Block 由服务端执行。
- 每局最近 50 条仅保存在房间内存；离开、结束、换局和销毁清空历史、草稿、未读、气泡与 timer。正文不得进入 moveLog、Replay、奖励、AI 学习、Analytics、数据库、localStorage 或普通日志；举报只保存批准的 match/message ID。
- Game Stage Command Slot 提供中央历史、未读、输入、举报和本地静音，头像旁显示短气泡；玩家名字/正文走 raw `textContent`，三语言、44px、移动键盘和 reduced-motion 合同必须同步保持。

### 安全边界
- `owned`、金币、XP、等级、连胜、胜场、局数、成就等权威字段不可由客户端 profile 消息写入；商城价格与扣款在服务端完成。
- `/api/ai` 要求 Bearer token，并限制 Origin、请求体、并发和速率。
- Tetris/象棋/大富翁 v2 动作由服务端共享 Rule Core 验证；五子棋/飞行棋仍不是完整规则权威，恶意客户端串通的边界继续存在。v1 compatibility adapter、客户端签名或 DeepSeek 返回都不得描述为防作弊。
- Profile 的 `gameCosmetics` 只接受六款游戏白名单 ID；比赛仅广播 `cosmeticSchemaVersion` 与装备 ID，禁止暴露 owned、余额、价格、PIN、session token 或购买记录。

### 国际化 (i18n)
- `public/locales/` 含三个同构翻译文件：zh-CN.json / en-US.json / uk-UA.json；三份唯一 key 集合必须完全一致，禁止重复属性、空值、占位符签名不一致或在非中文词典中混入中文回退。可用 `npm run format:locales` 做无依赖规范化。
- 前端 i18n 框架：`t(key)` 翻译、`setLanguage(lang)` 切换、`applyI18n()` 扫描 DOM；动态节点由 observer 补翻译，并保存与语言无关的源值，支持中文 → 英文 → 乌克兰语 → 中文原地连续切换。
- 静态文本使用 `data-i18n`；`title`、`placeholder`、`aria-label`、`alt` 分别使用对应的 `data-i18n-*` 属性。运行时文本使用 `t()`，需要后续原地切换的节点优先使用 `setLocalizedText()`。
- 服务端用户可见错误经 `translateServerMessage()` 按稳定 reason/key 翻译；非中文界面遇到未知中文错误时只显示本地化通用错误，不直接泄漏中文原文。
- 用户昵称、房间名等用户自定义原文必须标记 `data-i18n-raw`，禁止机器翻译或运行时替换。
- `RUNTIME_I18N` 只允许兼容仍未迁移的旧文案；新增界面文案必须进入三份 locale 并通过稳定 key 调用，不能继续扩大中文替换表。
- 语言存储在 localStorage `mg_lang`，同步到服务端 profile.lang。
- 语言旗帜在昵称旁、排行榜、玩家列表等 6 处实时显示。
- 新 UI 文本禁止硬编码；新增或修改文案时同步三份 locale，并运行 `npm run test:i18n` 与 `node qa/dom-smoke.js`。前者检查重复/缺失 key、占位符、静态引用、服务端 reason 和连续异步切换，后者检查大厅和六款游戏的英、乌界面无中文或裸露 key。

### Settings 设置页
- 入口：Header ⚙️ 按钮 → `openSettingsPage()`。
- 功能：白天/黑夜双主题、语言切换（三选一）、联机服务地址配置。
- 主题独立快捷切换：Header 🌙/☀️ 按钮。

### UI
- 运行时主题只有 `light/dark`；旧 `midnight/ocean/forest/cyber/sakura` 读取时映射到双主题，个人购买背景 ID 不变（localStorage `mg_theme`）。
- Home/Games/Playline/Profile 共用同一路由；`<=640px` 使用底部四项导航，平板与桌面使用顶部导航；Games 集中全部六款游戏；私信使用全局 dialog。
- Light 为缓慢云海/大气层，Dark 为向外运动的深空星场；毛玻璃、reduced-motion 和游戏中暂停环境动效同时生效。
- Theme Contrast P1 以 `qa/theme-contrast-design-system.js` 约束双主题唯一性、语义 token 与代表性 WCAG 对比；平台组件使用 surface/text/focus/disabled/status/overlay/glass token。Premium Background 只用自身 `premium-bg-light/dark` textTone，Game Stage 只用自身 Ink/Cream，不随平台主题重绘。自动化通过不等于玻璃/图片、forced-colors、真机或人工可见验收。
- 网站视觉、排版、转场、局内表现或视频式动效任务必须先读取对应 GSAP 官方 skill：基础 Tween 用 `gsap-core`，多步编排用 `gsap-timeline`，滚动页才用 `gsap-scrolltrigger`，插件用 `gsap-plugins`，纯辅助函数用无需注册的 `gsap-utils`，并始终用 `gsap-performance` 复核。React/Vue/Svelte 迁移时追加 `gsap-react` / `gsap-frameworks`；当前原生前端不得套用框架生命周期代码。
- GSAP 动效以 transform/autoAlpha、作用域、可清理实例、响应式和 `prefers-reduced-motion` 为完成边界；沉浸式 Game Shell 不使用 ScrollTrigger 驱动局内输入或核心状态，未使用的插件不得进入首屏包。
- 房间内切换游戏：`end_game` 消息 → `finishRoomGame()`。

### Profile Design System P1（本地实现）

- 本人 Profile 固定为 `identity / growth / journey / library` 四个稳定区域；核心四项与辅助四项统计分层，编辑只保留 Hero 主入口，底部仅保留退出。
- 公开 Profile 的 `profile_get/profile_data` wire 继续严格为 UID-only；客户端以最多 32 条的有序请求记录关联本地 `requestId + targetUid`，不得把 requestId 偷加进协议。取消、同 UID 重开、迟到响应、真实断线、换号和注销均须 fail-closed 清理。
- 公开 Profile 好友操作固定为私聊、战绩比较、单一“关系与安全”入口；非好友只保留单一关系/安全主入口，不新增陌生人私信或公开字段。
- Profile 弹层只复用现有 `GhostSurfaceMotion` 的 `profile-dialog/open` 与 `settle`；可访问关闭、焦点恢复、滚动锁和 DOM 移除同步完成，不复制 Adapter、GSAP import 或 ScrollTrigger。
- 该 Profile 批次当时只达到本地 `implemented`，当时浏览器连接器为 `Transport closed`；该历史阻塞已由 2026-08-14 单浏览器 localhost 部分证据更新。第二浏览器、Android/iPhone/Tablet、真实网络和低端 FPS 仍为 `NOT_EXECUTED`；线上仍为 `da3d05c`。
- Profile 专项 14+9 项、Quality Gates、完整 `npm test`（156.6 秒）和确定性双构建均通过；最终生成物为 1,337,226 characters / 1,351,775 bytes / SHA-256 `8E7BB74A304E6D9BF5CEC0F21CF30C834921CED2F0583C23CC4B79AD0758B39F`。两次 Terra Max 终审未交付可用结论，按 reviewer limit 记录，不冒充独立审查通过。

## 6. 部署与环境变量

### 前端
推 `main` 自动触发 GitHub Pages workflow（`.github/workflows/pages.yml`）。

### 后端（Render）
API 创建的服务无 webhook，推送后须手动触发：

```powershell
$env:RENDER_KEY='rnd_xxx'
node scripts/render-deploy.js
```

环境变量写入：

```powershell
$env:RENDER_KEY='rnd_xxx'
$env:DEEPSEEK_KEY='sk-...'
$env:DEEPSEEK_MODEL='deepseek-v4-pro'          # 可选；默认 deepseek-v4-flash
$env:SUPABASE_URL='https://xxx.supabase.co'   # 可选
$env:SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' # 可选；必须是仅服务端保存的 service_role secret
$env:METRICS_ADMIN_TOKEN='高熵随机值'           # 可选；管理员 Metrics API Bearer token
$env:ENABLE_CLUSTER_COORDINATION='0'             # 默认关闭；仅在真实迁移/恢复/多实例验收后开启
$env:TELEMETRY_WEBHOOK_URL='https://...'         # 可选；必须 HTTPS
$env:TELEMETRY_WEBHOOK_ALLOWLIST='telemetry.example.com' # 必须显式允许域名
$env:TETRIS_GUIDELINE_SCORING='0'              # 仅紧急回退 Tetris v3；正常为 1
node scripts/render-env.js
```

Supabase 首次接入或升级优先用 `scripts/supabase-production-ops.ps1`：默认 dry-run，执行时先做加密/受限 ACL 备份，再事务迁移、运行 `production-acceptance.sql`；恢复演练只允许隔离目标，回滚脚本不删除用户数据。Schema 还包含 Cluster lease/event cursor/metrics snapshot。没有真实凭证时的静态/fake 回归不能替代真实 SQL、RLS、并发、备份、恢复与回滚。

### 凭证
- 所有 token/Key 只存环境变量，绝不写入仓库。
- Render 运维脚本只输出筛选后的状态，不回显 API 原始响应或环境变量值；失败会返回非零退出码。
- 本机 Node v20 需 `--experimental-websocket`；Node 22+ 可直接跑。

## 7. 当前状态

### 2026-08-19 当前权威节点：2.5D 重排 + T7 P7–P12 本地实现（LOCAL_ONLY / NOT_RELEASED）

- `GATE-ART-GOLDEN-SET = OPEN_BY_OWNER_AUTHORIZATION`；原创 Ghost-native 资产在稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚齐全后，可取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并进入可逆 default-on runtime。人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE`，不阻塞开发或 runtime；外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材可按用户授权的受控全信息 reference lane 提供给已授权 Skill，逐输入记录路径、SHA、provider、model、taskId 与 transmissionScope；许可状态与 runtime 禁止边界不变。
- 设备/浏览器/真实网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`、开发状态 `OPEN`、发布状态 `RELEASE_EVIDENCE_PENDING`。原子需求仍可因缺真实环境保持 `blocked/not_executed`，但不得扩大成全项目开发停工或伪造发布证据。
- 四窗口并行期间，当前 `public/index.html` 的精确 characters/bytes/SHA 以自动生成 TECH-027 报告和当次 `node scripts/build.js --check` 为准；静态状态只保留时点快照，不能冒充永久当前。当前身份尚无匹配浏览器完整矩阵；`1CFC9A4E…51C31ACB` 与更早单浏览器证据均为 historical-as-of。
- 用户 2026-08-19 新指南已将生产视觉主线重排为 `Vanilla DOM + CSS + Canvas + GSAP` 的共享 2.5D 空间语言：`DepthScene`、八模式 `CameraSystem`、Honru 空间行为、页面转场和 Gomoku 首个完整 Demo 优先；现有 Ghost3D/Three.js 代码、素材和历史证据冻结保留，不删除、不继续扩张，也不再是六款游戏的必经路径。合同与证据入口：`requirements/active/visual-25d-repush-p0-20260819/`、`qa/visual-25d-contract.js`。
- Ghost3D 六款合同已改为冻结可选实验层：精确 `"1"` 才 opt-in，缺失或 `"0"` 保留 DOM/Canvas fallback；这不影响规则、Authority、Protocol、Reward、Replay、AI 或持久化。旧 default-on 文字仅作历史快照，不得再作为当前失败依据。
- Honru 九状态、十枚 Emoji 与 `P-GCOINS-ICON-V1` 已分别取得所有者清除并以 Manifest-backed default-on 接入；均保留独立 flag、旧资产/Unicode/文字/P-003 fallback 与 decode/Manifest 失败回滚。G Coins 只改表现层，不改 `coins/currency`、价格、奖励、数据库或协议。
- T7 仍为 `partial`：P7 已集中 Reward/Progression 投影，P8 把六个 Boundary 的显式 `now` 统一到 `serverNow`，P9 把 `room-graph-recovery` 周期迁移为 owner lease，P10 把访客延迟清理迁移为 `ephemeral-cleanup:<uid>` 一次性 lease，P11 把 reconnect grace/Presence 失败重试与 room removal retry 迁移为按 Session owner lease；P12 把 heartbeat 迁移为单一 `heartbeat-sweep` repeat owner，复用一次 `now`，并通过 `HeartbeatSweepIsolation` + Manual Clock 故障注入保证单 session/room/tournament 异常不停止同 tick 后续任务或下一 tick。访客继续 `close(true)`，普通超时继续 `close()`。P12 专项、连接、赛事和独立端口 E2E 已通过；统一 Quality Gates/完整 `npm test` 将在 2.5D 并行构建稳定后集中记录。Metrics `generatedAt`、正式 token TTL、其他 Room/Tournament lifecycle、Chat/Expression delay、Reward/AI outbox cadence、游戏 tick 与 transport deadline 仍未迁移；不得把 P8–P12 写成 server-wide time virtualization。
- 本节优先于下方 2026-08-16 的“当前构建/当前节点”措辞；`324922B8…B478E6` 的 Honru 定向投掷窄证据和更早哈希均为 historical-as-of。未执行 commit、push、Pages、Render 或生产数据写入。

### 2026-08-18 T7 Chat/Playline + Reward/Economy outbox + Reward Projection（LOCAL_ONLY / NOT_RELEASED）

- Match Protocol（21/21）与 Chat/Playline（22/22）本地边界已完成；Chat 修复了 Test Admin target 的稳定 `test_admin_isolated` reason、history/read 频控顺序和隐藏历史 list/unread 泄漏，完整 `npm test` 已退出码 0。
- Reward/Economy P5 继续只拥有 JSON/memory detached outbox、`resultId` 幂等/冲突、同 uid 串行、先落 outbox 后远端、失败重试与 Supabase RPC 兼容；P7 的 `reward-progression-v1` 已接管 resolved Reward 的本地 profile/daily/achievement/history/ledger/Analytics 投影，数值仍只来自 Reward Resolver。
- 证据入口：`requirements/active/t7-reward-economy-boundary-p5-20260817/`、`requirements/active/t7-reward-progression-projection-p7-20260818/`、`requirements/active/t7-server-boundary-clock-injection-p8-20260818/`、`npm run test:technical-optimization-t7`；真实 Supabase/RLS/多实例/备份恢复、设备/网络与发布仍未执行。

### 2026-08-16 OWNER_AUTHORIZED_ART_CLEARANCE / Honru Runtime 当前构建窄范围单浏览器收口（LOCAL_ONLY / NOT_RELEASED）

- `GATE-ART-GOLDEN-SET` 当前为 `OPEN_BY_OWNER_AUTHORIZATION`。九状态 `P-HONRU-STATES-V1` 与十枚 `P-HONRU-EMOJI-V1` 均已取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，以 Manifest-backed default-on、双 kill switch 和永久 fallback 可逆接入；九状态回退 v1 SVG，Emoji 回退 Unicode/本地化文字。Emoji 只替换既有 `match-expression-v1` 选择器、头像气泡与定向投掷表现，`direct-chat-v1` / `match-chat-v1` 仍为纯文字。
- 当前 `public/index.html` 为 1,862,601 characters / 1,877,144 bytes / SHA-256 `3A72225B0BE9EA2ACE6FC2BA1DE1907E54928D3BC890015FEC170F059E6661CC`。单一 Codex in-app Chromium 的两个本地会话仅以 `127.0.0.1` / `localhost` 隔离 localStorage，不是第二浏览器证据。
- 该 Chromium 已实测 Honru Home idle、签到 check-in、dark theme 可见；Emoji picker 10/10 atlas cell ready；`emoji_wave` 定向投掷飞行节点及发送/接收 Seat 气泡可见。九状态其余状态由机器合同覆盖，本次没有冒充九种状态逐一可见验收。
- 同一会话还通过 visible reduced-motion（0 flight、静态 Emoji 保留）、390×844（0 横溢出、10/10 picker ready）、zh-CN/en-US/uk-UA、light/dark 与双会话 console warn/error=0。证据：`requirements/active/honru-emoji-runtime-p0-20260811/current-build-single-browser-honru-art-202608162216.json`。
- 这只是 Honru Art runtime 的当前构建窄范围单浏览器证据，不替代五档四区完整矩阵。人工清稿、独立自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`；第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端性能、真实 Supabase 与生产发布保持 `RELEASE_EVIDENCE_PENDING`。任何 commit、push、Pages 或 Render 发布仍只接受用户当前明确命令。

### 2026-08-16 T7 前置节点：首个 Server seam + 所有者 Gate 解禁（historical-as-of）

- 该段只记录 2026-08-16 当时的 T7 前置状态；当前状态以上方 2026-08-17 节点及 `requirements/active/technical-optimization-mainline-p0-20260816/plan.json` / `acceptance.md` 为准。T7 已完成三个纵切，仍不得写成 complete。
- T7 的 Interface、双 Adapter、真实双服务器隔离和回滚决策见 `requirements/ADR/003-server-boundary-adapters-metrics.md`。lane clock 只对显式依赖注入生效，不替换 Node 子进程 wall clock；共享全局状态测试保持串行。
- T5 已补 frame/serverTick 双高水位与 codec 健康协商：codec 缺失或 create/reset 失败时不声明 `tank-snapshot-delta-v2`；v1 Authority/fallback 保留。T6 仍只是默认关闭、无 Reward 影响的 Tank accepted-action shadow。
- Gate 状态只以 `requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md` 与 `requirements/MAINLINE_CONTROL_ROUTING.json` 为准：设备与 Supabase 为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；原创 Ghost-native 美术为 `OPEN_BY_OWNER_AUTHORIZATION`，按 `OWNER_AUTHORIZED_ART_CLEARANCE` 可进入可逆 default-on runtime 候选。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 仅为可选咨询，缺失不得阻止开发或未来发布候选，也不得冒充已 PASS；外部 `blocked-license` 素材可按用户授权的受控全信息 reference lane 提供给 Skill，逐输入保留路径/SHA/provider/model/taskId/transmissionScope，仍保持 source-only/相似风险审查/运行时禁止边界。
- Honru 九状态与十枚 Honru Emoji 已分别取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，以 Manifest-backed default-on 方式在当前本地构建接入；九状态保留素材总开关/局内反应分开关与 v1 SVG fallback，Emoji 保留总开关/投掷分开关、Unicode/文字 fallback、Manifest allowlist、decode/资源失败回退。Emoji 只接入既有 `match-expression-v1` 的选择器、头像气泡与定向投掷；`direct-chat-v1` 与 `match-chat-v1` 仍是纯文字协议。
- 该节点记录的 1,856,788 characters / 1,871,331 bytes / SHA-256 `346622A3D…5E914`、后续 `3A72225B…61CC`、`324922B8…B478E6`、`915A97F3…B8C8EFC`、`2C8D4F8B…F1F1` 与 `E5D3AE78…D10C` 均为 historical-as-of；当前构建以上方 `F03FD5D3…C4844` 节点为准。下方更早构建和旧 `BLOCKED` 文案同样只作历史记录，发布仍只接受当前用户明确命令。

### 2026-08-15 ECO-012 / UI-027 G Coins 表现统一 P1

- 当时 `public/index.html` 为 1,582,693 characters / 1,597,229 bytes / SHA-256 `3D0532737A932B505DDDE04EFB565B527EE63FD9E660CDAD4648B38E6559062D`。新增 `currencyAmountNode()` 作为带图标金额的唯一深模块 seam：原子 `role=img` 只提供一次完整 `N G Coins` 读屏名，内部图标与数字 decorative；裸 `formattedText`、非法值、signed、Test Admin `∞` 与 P-003 失败均 fail-closed。
- Home、本人/公开 Profile、编辑器、Shop 余额/价格、排行榜、邀请与玩家列表已一次迁移；Reward Breakdown 继续使用纯文本 `currencyAmountText()`。`coins/currency`、价格、奖励、协议、Supabase、Test Admin 公开边界与未审批 P1 美术均未改变。
- 浏览器真实发现旧 v11 cache 让新增 `shop_available_label` 裸露后，Service Worker 升级为 v13：locale 与通用 SHELL 分离安装、`no-cache` 获取、严格 JSON 校验、network-first 刷新与最后合法离线回退；坏响应、quota failure、无 cache 503、waiting/activate/旧 cache 清理均有回归。独立 Terra Max 两轮复核的 P1 已全部修正。
- 当时单一 Codex in-app Chromium 已复核 Profile、Shop、排行榜、玩家列表、zh-CN/en-US/uk-UA、light/dark 与 390×844 黑夜乌克兰语 Shop；最终只保留 v13 cache，无裸 key、横溢出或 console warn/error，临时 viewport 已复位并回到 Profile、zh-CN、light。
- `ECO-012` 与 `UI-027` 继续 `partial`；该 P1 专项本身不是完整五档四区矩阵，当前构建完整单浏览器矩阵由后续 P4 证明，第二浏览器、真机、真实网络、读屏设备与 Golden Set 仍未完成。保持 `LOCAL_ONLY / NOT_RELEASED`。

### 2026-08-16 TECH-027 单浏览器 PROVE P4 历史构建收口（historical-as-of / LOCAL_ONLY / NOT_RELEASED）

- P4 历史构建为 1,597,548 characters / 1,612,091 bytes / SHA-256 `963F83511200AC16AA309EC1FA5BE243F01FB5CADD4DD5E2B41D7B718C8B686B`；`requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-202608160305.json` 已明确标为 historical-as-of。
- 该历史 P4 完成五档 viewport × Home/Games/Playline/Profile 20/20、Shop/DM/Achievement/Room Lobby、六款 Game Stage、深滚动跨路由与同路由回顶、Monopoly compact/micro 密度、en/uk 复数边界、三语言、light/dark、visible reduced-motion、forced-colors、零横溢出/裸 key、console 0 与最终清理。
- 2026-08-16 缩放修复后当前 `public/index.html` 为 1,597,513 characters / 1,612,056 bytes / SHA-256 `ED91C148936E13EE4BCF9BB2A81FDAC9AFA5DFCE9F94F03F89210B21FFB47C90`；当前新矩阵尚未重采集，`TECH-027` 仍为 `partial`，`GATE-DEVICE-BROWSER-NETWORK` 仍为 `BLOCKED`。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络、Supabase、真实性能、人工美术/Reviewer B/IP/Golden Set、线上最新构建与发布仍 `NOT_EXECUTED/BLOCKED`；本批未 commit、push、Pages 或 Render deploy。

### 2026-08-16 技术优化授权与自动 Gate 子项推进边界（LOCAL_ONLY / NOT_RELEASED）

- 用户正式授权此前长需求中的 Delta/紧凑数值、Tank prediction/reconciliation、Renderer 生命周期/DPR/Context Loss、Haptic/Input Buffer/空间音频、Worker AI/TT/Opening Book、APM/Action Entropy、客户端脱敏环形诊断、按需加载/SW 预热、Server 深模块/测试隔离与所有机器可完成 Gate 子项自动推进。
- 该授权已归回既有 Requirement：`GAME-013/044`、`TECH-030/044`、`TECH-049/033/034/039/040/052`、`GAME-037/038/014/005/007/010/016`、`TECH-023/024/025`、`ECO-004/005`、`UI-027/029/030/031`；没有制造重复原子 ID。合同和批次计划见 `requirements/active/technical-optimization-mainline-p0-20260816/`。
- 机器可确定验证的协议兼容/回滚、Renderer 资源生命周期、Worker 取消/隐私、a11y/i18n、性能/fallback、构建/测试隔离和本地浏览器证据默认自动继续；复合 Gate 仅允许子项进入 `TECHNICAL_PASS`，不得假解锁共享 Gate。
- 三条共享 Gate 均不再阻止开发：设备与 Supabase 缺口只保留为 `RELEASE_EVIDENCE_PENDING`；原创美术使用 `OWNER_AUTHORIZED_ART_CLEARANCE`，可选人工/Reviewer B/IP/Golden Set 咨询不再是内部准入先决条件。发布仍只接受当前用户明确命令。
- 本批先修复 `public/index-template.html` 的 `maximum-scale=1,user-scalable=no` 缩放缺陷并加入 `qa/immersive-game-shell.js` 回归；未因此宣称真机或 P4 当前矩阵仍有效，新的构建必须重新采集可见证据。

### 2026-08-16 技术优化 T1 本地基线（LOCAL_ONLY / NOT_RELEASED）

- `ClientDiagnosticsRing` 与 `RendererRuntimeGovernor` 已完成本地实现并加入 `scripts/build.js`；两者均为 inert/default-off 深模块，不实例化、不联网、不写 localStorage、不改变 Ghost3D Foundation 外部 Interface。
- `ClientDiagnosticsRing` 固定 64 条、5 分钟 TTL、事件/字段 allowlist、ID 类别化哈希和敏感字段 fail-closed；`RendererRuntimeGovernor` 保持既有静态 DPR 上限，仅在显式开启时产生带 hysteresis/cooldown 的质量建议，负责 resize 合帧和生命周期失效。
- 专项证据：`qa/client-diagnostics-buffer.js`、`qa/renderer-runtime-governor.js`、`npm run test:technical-optimization-t1`；最终 `npm run quality:gates` 与完整 `npm test` 均已退出码 0，完整回归约 171 秒，确定性双构建的字符数、字节数与 SHA-256 完全一致。
- 当前构建（T1 接入后）为 1,632,559 characters / 1,647,102 bytes / SHA-256 `1C65343FE0246E2DA99C7646822FFF6CFBB8328A015D99A2AFDC61C60C090C2A`；旧 P4 及缩放修复构建证据均保持 historical-as-of，当前浏览器矩阵必须重采集。

### 2026-08-16 TECH-027 当前 T1 构建窄范围浏览器证据（LOCAL_ONLY / NOT_RELEASED）

- 当前 `1C65343FE0246E2DA99C7646822FFF6CFBB8328A015D99A2AFDC61C60C090C2A` 已由单一 Codex in-app Chromium 复核五档 viewport × Home/Games/Playline/Profile（20/20）、六款本地 AI Game Stage、三语言切换、双主题、reduced-motion、forced-colors、零横向溢出、零裸 key 与 console warn/error=0。
- 证据入口：`requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-t1-202608161410.json`。这是 T1 窄范围当前证据，不替代旧 P4 的完整结构化矩阵；旧 P4 仍是 historical-as-of。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络整形、完整 Shop/DM/Achievement/Room 深矩阵、真实性能/读屏与线上最新构建在该 T1 批次仍未执行；本段为 historical-as-of。当前 `TECH-027` 保持 `partial`，`GATE-DEVICE-BROWSER-NETWORK` 的开发状态为 `OPEN`、发布状态为 `RELEASE_EVIDENCE_PENDING`。

### 2026-08-15 TECH-027 单浏览器 PROVE P3 历史构建证据（historical as-of）

- P3 的 1,580,313 characters / 1,594,847 bytes / SHA-256 `0A6FE8494AA5B14188D006E2FCDFA97AA7DAB438E127A6442FFF298BC5B1CDB4` 曾完成单 Chromium 五档四区、共享表面、六款 Game Stage、三语、双主题、visible reduced-motion 与 forced-colors；构建变化后已由防陈旧合同降为 historical as-of。
- `3D053273…9062D` 当时只有 G Coins 窄范围可见证据，现亦为 historical-as-of；P4 `963F835…686B` 同样已因缩放修复降为历史，当前构建为 `ED91C148…47C90` 但尚未重采集矩阵。`TECH-027` 仍为 `partial`，共享 Gate 仍 `BLOCKED`。

### 2026-08-15 受控本地传输预检与 Tetris 重连序号修复 P0

- 修复 `tetris-rule-v3` 重连快照未回填本地 `battleSeq` 的缺陷：合法权威快照中当前玩家 `seq=7` 后，下一次真实控制发送 `seq=8`；错误 match、旧 revision 与畸形 seq 快照均不能污染发送序号。
- 新增 `qa/controlled-transport-preflight.js`，一次覆盖 Tetris `1→3→重复 3→迟到 2`、Tank 断线清输入与测试 epoch 隔离、旧 WebSocket callback 隔离、同连接 capability 保留，以及 DM `10→2→重复 10→11` 的十进制数值排序和 ID 去重。
- 专项已接入 `test:controlled-transport-preflight`、`test:chaos`、Quality Gates 和 `npm test` posttest。目标回归、Quality Gates、完整 `npm test`（约 169.4 秒）均通过；确定性构建为 1,580,313 characters / 1,594,847 bytes / SHA-256 `0A6FE8494AA5B14188D006E2FCDFA97AA7DAB438E127A6442FFF298BC5B1CDB4`。
- 本批只是确定性本地传输预检，不是 OS/代理级真实网络整形；该批次当时把 `TECH-030` 与共享 Gate 记为 `blocked/BLOCKED`，此措辞现为 historical-as-of。当前该原子外部证据项仍未闭环，但共享 Gate 为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；第二浏览器、物理 Android/iPhone/Tablet、真实 50/100/200ms 延迟/抖动/丢包/乱序和生产验证仍为 `NOT_EXECUTED`。
- 当前改动保持 `LOCAL_ONLY / NOT_RELEASED`，未 commit、push、Pages 或 Render deploy。

### 2026-08-15 TECH-027 单浏览器 PROVE P2 历史构建证据（historical as-of）

- 当时的 `public/index.html` 已用单一 Codex in-app Chromium 重采集 1440×900、1024×768、768×1024、390×844、844×390 的 Home/Games/Playline/Profile，以及 Shop、DM、成就、房间大厅和六款 Game Stage；三语言、双主题、visible reduced-motion、forced-colors、零横溢出、零裸 key、`scrollY=0` 与 console 0 均有可见证据。
- 修复认证工具栏/Tab/输入与 <=1024px 顶栏/导航被后置 CSS 覆盖的触控下限，最终均保持 44px；媒体和 viewport 模拟已清除。
- `qa/prove-current-build-evidence-contract.js` 以 current/historical 双模式绑定 HTML SHA/bytes，并解析 full-source artifact，锁定 5 个 viewport、4 条路由、6 款 Game Stage、单浏览器与完整 `notGranted`；已进入 Quality Gates 和 `npm test` posttest。
- Terra Max（max）两轮只读终审后无 P0/P1 阻塞；当时 Quality Gates、完整 `npm test`（约 184 秒）与确定性双构建通过。该历史构建为 1,579,909 characters / 1,594,443 bytes / SHA-256 `4141BBAC492D361AEC2A777D76FD1AACC0600866307709B26568C62EC8780850`。
- 该 P2 矩阵只对上述历史构建有效；后来的 P3 `0A6FE849…1CDB4`、P4 `963F835…686B` 与 G Coins `3D053273…9062D` 窄范围证据也均为 historical as-of，当前缩放修复构建 `ED91C148…47C90` 尚未重采集完整单浏览器矩阵。`TECH-027` 继续 `partial`，共享 Gate 继续 `BLOCKED`；第二浏览器、物理 Android/iPhone/Tablet、真实网络、双正式好友 UI、真实性能/音频/恢复、生产与发布仍未执行。

### 2026-08-14 Ludo Ghost3D 可替换 Renderer 纵切 P1

- 飞行棋已成为 Ghost3D Foundation 的第二款默认关闭纵切：仅精确 `mg_ghost3d_ludo_v1 === '1'` 才懒加载 `public/three/ludo-entry.js`；Wave B DOM 棋盘与 DOM 骰子永久保留，Renderer 只能发 revision-bound `select_token`，不能掷骰、改规则或写协议/Replay/Reward/AI/数据。
- Three r185 程序化场景覆盖 52 格轨道、2/3/4 人基地/终点线/棋子和只读骰子；HIGH 使用 GSAP `focus → travel → capture/finish → restore → settled` 单复合时间线，BALANCED/LOW、reduced-motion、隐藏、context loss、reset/restore/destroy 均有静态降级或清理合同。
- 主审修正不可达 roll/dice motion、物理旋转方向、吃子回基地/终点脉冲/镜头复位、首帧 environment 顺序，以及 390×844 的 min-height 溢出、Grid auto-track 回缩、frame 内容裁切和横竖切换后尺寸不重算。现在棋盘几何统一以 frame content width 为真值，resize/orientation 只合并到一帧并在 destroy 清理。
- 单一 Codex in-app Chromium 已完成默认二维回退、临时 HIGH opt-in、390×844、1440×900、实时 viewport 切换、visible reduced-motion、80/92px DOM 骰子和零 console warn/error 部分证据；临时 flag、媒体模拟与 viewport override 已清除。
- Ludo 专项（ESM graph 48、Renderer 80、bridge/layout/cache）、Quality Gates、完整 `npm test`（151.3 秒）和确定性双构建均通过；最终为 1,386,099 characters / 1,400,633 bytes / SHA-256 `5F3EB0843D736584918AD2C90798A61FE20332E08B70F6D3D109CFF4DB14704A`。
- `TECH-049` 继续 `partial`；该历史批次的第二浏览器、Android/iPhone/Tablet、真实网络、低端 FPS/GPU/内存与正式美术均未执行。当前设备证据为 `RELEASE_EVIDENCE_PENDING`；原创美术按 `OWNER_AUTHORIZED_ART_CLEARANCE` 可逆接入，Reviewer B/IP/Golden Set 仅为可选咨询。本批未 commit、push 或 deploy；下一条本地主线为 Monopoly Ghost3D。

### 2026-08-14 Monopoly Ghost3D 可替换 Renderer 纵切 P2

- 大富翁已成为第三款 default-off Ghost3D 纵切：只有 Wave B 保持开启且 `mg_ghost3d_monopoly_v1 === '1'` 时才懒加载 `public/three/monopoly-entry.js`；永久保留 24 格 DOM 棋盘、DOM 掷骰、购买、放弃与竞价，Canvas 永久 `aria-hidden`、pointer-transparent、零游戏输入。
- Renderer 只消费冻结的 2–5 人公开表现帧与 revision-bound `token_moved`。首帧、reconnect、room-restored、spectator-bootstrap、terminal、reduced-motion 与 fallback 都静态 snap；HIGH 仅允许一条 `focus → travel → land → settled` 语义时间线，Rule/Authority/Protocol/Replay/Reward/AI/DB 均未变化。
- 主审修正非语义首帧 Camera Entrance、Renderer 假骰子、38px 触控尺寸、844×390 裁切、390×844 重复 Meta 内滚动、1024×768 Canvas 拉伸与实时 viewport shrink-wrap。真实 DOM 骰子在 3D ready 后由 Command 区持有，fallback 时回到棋盘中心。
- Terra Max 终审又发现两条迟到回调缺口：context-loss fresh Adapter 与 Foundation mount/config/render failure fallback。当前 bridge 同时使用 host generation + adapter epoch；旧 `onReady/onError/onContextLost/onFailure` 不能改 ready、挪动 DOM 骰子或重复 recovery，真实 Foundation 失败回归已固化。
- 单一 Codex in-app Chromium 已覆盖 default-off、临时 HIGH、2/3/4/5 人、1440×900/1024×768/390×844/844×390、三语、双主题、真实 roll/buy/pass/bid、visible reduced-motion 与零 console warn/error；临时 flag、媒体和 viewport override 已清理。
- Monopoly 专项（ESM graph 59、Renderer 71、bridge/layout/cache）、Foundation 与相关规则/拍卖/表现回归、Quality Gates、最终完整 `npm test`（139.7 秒）通过；双构建为 1,422,463 characters / 1,436,997 bytes / SHA-256 `A69CAF292FEFE477664B05486D2D6F560075307C05F6C1D86841E0B6A4298B0C`。
- `TECH-049` 继续 `partial`；该历史批次未取得设备、真实网络/性能或正式美术证据。当前外部环境只保留发布证据待决；原创 GLB/正式美术取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可逆接入，Reviewer B/IP/Golden Set 仅为可选咨询。本批未 commit、push 或 deploy；下一条 CLOSE 主线为 Xiangqi Ghost3D，复用 `GAME-052 + TECH-049`，不是 Tank 所属的 `GAME-051`。

### 2026-08-15 Xiangqi Ghost3D 本地纵切 P3

- 象棋已成为第四款 Ghost3D default-off 纵切：只有 `mg_ghost3d_xiangqi_v1 === '1'` 才按需加载 `public/three/xiangqi-entry.js`；默认、存储异常、import/mount/render/context loss 或任何失败都继续使用永久可玩的 DOM 棋盘。
- Bridge 在现有 `onRestore()` 扁平化前消费 accepted `xiangqi-rule-v2` 的 match/revision/hash/lastMove.capture，只投影冻结 10×9 公开表现帧。Renderer 永久零输入，唯一动作是 revision-bound `piece_moved`；live/reconnect/room-restored/spectator-bootstrap、gap/stale/malformed/terminal 均按合同静态收敛。
- DOM 棋盘补齐真实 `role=grid` 键盘路径：方向键游标、Enter/Space 选择/走子、Escape 清理；selected/legal/keyboard cue 出现时 3D 层临时隐藏，提交后恢复，焦点不丢失。窗口 resize/orientation 与 `ResizeObserver` 合帧重算，三档高度预算覆盖桌面、平板、390×844 与 844×390。
- Three r185 程序化棋盘提供七类可区分棋子几何；HIGH 使用唯一有限 GSAP `focus → travel → capture/settle → settled`，BALANCED 更轻，LOW/reduced-motion 静态。无 ScrollTrigger、GLB、纹理、外部素材或未审批美术。
- 单一 Codex in-app Chromium 已覆盖 default-off、临时 opt-in、四档 viewport、三语、双主题、真实键盘 cue、visible reduced-motion 与零 console warn/error；证据为 `requirements/active/xiangqi-ghost3d-vertical-slice-p3-20260814/evidence/single-browser-visible-verification-202608150003.json`。
- Xiangqi 专项（ESM 76、Renderer 65、bridge/layout/cache）、共享 Wave C、Quality Gates 与完整 `npm test`（162.7 秒）通过；Terra Max post-fix 独立终审无 P0/P1 代码阻断。确定性双构建为 1,459,188 characters / 1,473,722 bytes / SHA-256 `A4855B36015AE43CB45F90D5750699DB14ABEDA6F2D3A5574009BCE9DB9DD58B`。
- `GAME-052` 保持 `implemented`，`TECH-049` 保持 `partial`。本段为 historical-as-of：当时第二浏览器、物理 Android/iPhone/Tablet/触控、真实网络与低端性能未执行；当前均为发布证据待决。原创美术可按 `OWNER_AUTHORIZED_ART_CLEARANCE` 继续，Reviewer B/IP/Golden Set 仅为可选咨询；未提交、推送或部署。下一条 CLOSE Renderer 主线为 Tetris P4（`GAME-048 + TECH-049`）。

### 2026-08-15 Tetris Ghost3D 本地纵切 P4

- Tetris 已成为第五款 Ghost3D default-off 纵切：只有 Wave B 非 `'0'` 且 `mg_ghost3d_tetris_v1 === '1'` 才按需加载 `public/three/tetris-entry.js`；默认、存储、import、WebGL、render、context 或资源失败都继续使用永久 DOM 18×10 主井、七项触控、键盘、Hold/Next/Incoming、对手井、KO 和结果 UI。
- `TetrisGhost3DPresenter` 只消费已提交 local/AI 或 accepted `tetris-rule-v3` 的当前观察井；legacy battle/relay、optimistic、stale/gap/malformed 与未知来源始终 DOM-only。Renderer 永久零输入，唯一 motion 是能由前一 active、可信 lock 和目标井严格推导的 `piece_locked`。
- HIGH 严格使用一条三 child tween 的 `focus → impact → settled`，BALANCED 两 child tween，LOW/reduced-motion 零 timeline；时长只用 120/180/260ms Motion Tokens。恢复、重连、reconcile、focus switch 与 context loss 都建立静态 fresh generation，不补播旧锁定。
- 主审与 Terra Max 双轴审查修正了七种 Tetromino 旋转坐标、reconcile/source fail-closed、resize/listener/visibility 生命周期、构造和普通 Renderer 失败复活、Canvas/active/KO 层级、对手重复、583px 竖屏误分类、锁事实一致性、context-loss generation、生产全局 import hook 与 GSAP 3/2 tween 预算。
- 单一 Codex in-app Chromium 已覆盖 default-off、临时 HIGH opt-in、2/4 人、1440×900/1024×768/390×844/844×390/583×726、三语、双主题、真实键盘/Hard Drop、修正前 visible reduced-motion 与零 console warn/error；最终修正后又复核 default-off、1 Canvas/7 控件 opt-in、键盘左移、Canvas ready 与零横溢出。修正后 reduced-motion 可见重模拟仍为 `NOT_EXECUTED`，自动化静态合同通过。
- Tetris 专项为 ESM 88、Renderer 121 以及 Presenter/layout/cache 全通过；最终完整 `npm test` 147.9 秒通过。确定性双构建为 1,518,538 characters / 1,533,072 bytes / SHA-256 `9A42890C22D50225EE2D5AF0238BA4CE80D115A43A2F691E9555DE109B4D0DFE`。
- `GAME-048` 保持 `implemented`，`TECH-049` 保持 `partial`；本段记录的“三条共享 Gate 仍为 BLOCKED”仅是 historical-as-of。当前设备/Supabase 开发状态为开放、发布证据待决，美术 Gate 由所有者授权开放；第二浏览器、物理 Android/iPhone/Tablet/触控、5 人真实可见联机、真实网络与低端性能仍未执行，Reviewer B/IP/Golden Set 仅为可选咨询。未提交、推送或部署。

### 2026-08-15 Tank Ghost3D 本地纵切 P5

- Tank 已成为第六款 Ghost3D default-off 纵切：只有 Wave B 非 `'0'` 且 `mg_ghost3d_tank_v1 === '1'` 才按需加载 `public/three/tank-entry.js`；默认、storage、import、WebGL、mount、render、context 或资源失败均回到永久 DOM Tank。
- `TankGhost3DPresenter` 只消费已提交 local/AI 或 accepted `tank-authority-v1` 原始 receipt；旧 relay、乐观预测、普通 restore、Replay 与结果层始终 DOM-only。Renderer 永久零输入，DOM board click、摇杆、D-pad、键盘、独立开火、HUD、Wave C、玩家与结算继续拥有输入和语义。
- Frame 与 pool 固定为 13×15/17 Arena、最多 5 tank、128 projectile、221 terrain；authority receipt 的 tick-0、同 tick 去重/冲突、畸形 tick、正常 +2、gap 静态 snap 与 source/match/generation 隔离均有回归。HIGH/BALANCED/LOW/reduced-motion 只在 `tank_ko/hit/fire/spawn` 使用有限 Motion Token，位置插值不外推。
- 主负责人和 `gpt-5.6-terra` max Standards/Spec 终审修正了新 revision 旧 FX timeline、同 tick/NaN receipt 防火墙、动态 import 失败永久锁死，并重新跑完五类专项；ESM 32、Renderer 65、Presenter/bridge 49、layout 18、cache 15 全部通过。
- 单一 Codex in-app Chromium 已覆盖 default-off、临时 HIGH、1440×900/1024×768/390×844/844×390、44px D-pad、DOM 开火、Canvas pointer-through、零横溢出和 console warn/error=0；该历史批次未执行最终修正后的 visible reduced-motion、第二浏览器、物理 Android/iPhone/Tablet/触控、真实网络、低端性能、5 人真实可见联机和正式 Tank Art。
- `GAME-051` 与 `GAME-044` 保持 `implemented`，`TECH-049` 保持 `partial`；本段旧 `BLOCKED` Gate 语义为 historical-as-of。当前设备/Supabase 为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`，Tank 原创美术取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可逆接入。本批未 commit、push、Pages/Render deploy。

### 2026-08-14 素材完整性与分层结构补全 P1

- 原创候选仍为 14 族；G Coins P1 加入后为 247 个文件：212 张 PNG 已全部进入逐族接触表并完成可见复核，2 张 SVG 以全文件 SHA-256 登记且各有同族 PNG 可见稿，32 份 Markdown 与 1 份 HTML 已全文读取；中断未造成文件丢失或覆盖。G Coins P1 只到 source-only 机器技术首选，未通过人工清稿、Reviewer B、IP 或 Golden Set。
- 外部两处素材仍为 `reference-only / blocked-license`。836 个容器/预览文件、18,567,721,249 bytes 的逐文件 SHA-256 与 aggregate `a7151ed3c6b32fd1306962accd42f8f838a8e5b8d1ea54f4fc4a56397842298f` 保持不变。
- 以前未执行的分层源结构库存已补齐：288 PSD、361 AI、3,170 EPS 共 3,819/3,819 份只读解析成功，0 失败；PSD 共 35,107 个图层记录、7,553 个组、1,078 个文本标记和 565 个智能对象标记。没有解压落地、复制、上传或 runtime 接入。
- Illustrator 私有语义、字体字形、链接对象正文和可编辑效果没有被重建；结构读取不能冒充授权、人工清稿、Reviewer B、IP Review、Golden Set 或完整 Adobe 视觉语义。该批次把 `GATE-ART-GOLDEN-SET` 记为 `BLOCKED` 的措辞为 historical-as-of；当前原创 Ghost-native 美术 Gate 为 `OPEN_BY_OWNER_AUTHORIZATION`，外部受限素材可在用户授权的受控全信息 reference lane 进入任务相关 Skill 输入，但不直接进入 runtime，且每次传递必须留证。
- Pixel Avatar v3 统一为：C2PA/模型来源、源/Alpha 哈希与四角色技术选择已固定，但精确 Prompt 与 Builder 修复配方为 `NOT_RECOVERED`。Honru cleanup Reviewer A 为机器 `TECHNICAL_PASS`，人工门禁仍全部未执行。
- 独立 `psd-tools 1.18.0` 二次解析确认 288/288 PSD、0 错误；专项、Quality Gates、完整 `npm test`（139.6 秒）和确定性双构建通过，构建保持 1,362,068 characters / 1,376,602 bytes / SHA-256 `BFBD2109B77B1F4C5E070DAB6B98C806E25AD621ACBE3E2E83AD5C5FB7130CAE`。本批未提交、推送或部署。

### 2026-08-14 Supabase Production DATA 只读预检 P0

- 当前进程未提供 Supabase project URL、server-only service role、生产 DB URL 或隔离恢复 DB URL；本批没有读取/输出凭证值，也没有连接、备份、迁移、恢复或回滚真实数据库。
- 本机 `psql / pg_dump / pg_restore` 已可用；`scripts/supabase-production-ops.ps1` 默认 dry-run 确认为零连接、零写入、零备份。Schema、Production Readiness 与 fake Adapter 专项通过，但只属于 `LOCAL_STATIC_OR_FAKE_ONLY`。
- 修复 `restore-drill` 隔离缺陷：恢复目标只要与生产源属于同一 Supabase project ref 就 fail-closed，不再允许“同项目、不同 database”绕过；不同项目仍必须显式确认。
- DATA 专项、Quality Gates 与完整 `npm test`（141.4 秒）通过；确定性双构建为 1,362,068 characters / 1,376,602 bytes / SHA-256 `BFBD2109B77B1F4C5E070DAB6B98C806E25AD621ACBE3E2E83AD5C5FB7130CAE`。
- 该批次把 `GATE-SUPABASE-PRODUCTION` 记为 `BLOCKED` 的措辞为 historical-as-of；当前开发状态为 `OPEN`、发布状态为 `RELEASE_EVIDENCE_PENDING`，Cluster 继续默认关闭。真实加密备份、事务迁移/RLS/RPC/并发、不同项目恢复、非破坏回滚和双实例仍为 `NOT_EXECUTED`；本批未提交、推送或部署。

### 2026-08-14 TECH-027 最新单浏览器可见矩阵 PROVE P1 部分证据收口

- 当时最新 localhost 构建已在一个 Codex in-app Chromium 中完成 1440×900、1024×768、768×1024、390×844、844×390 五档 CSS viewport 的 Home/Games/Playline/Profile 可见矩阵；Shop、DM 空态、Achievement Outcome、Rooms Lobby 和六款 Game Stage 进入/返回均已抽查。
- 三语言、light/dark 与 CDP `prefers-reduced-motion: reduce` 已真实切换；reduced-motion 下五子棋棋盘为 `animation:none / 0s / transform:none`，局内仍可操作；当时会话 console warn/error 为 0。
- 可见复核修正三处缺陷：Games 排行榜侧栏 intrinsic width 导致的 1024/390 横溢出、390px 乌克兰语成就卡双列文字重叠、1024px 平板房间/邀请主要操作只有 38px。现在对应页面无横溢出，平板/手机触控操作为至少 44px。
- 最终完整 `npm test` 160.6 秒通过；确定性双构建均为 1,362,068 characters / 1,376,602 bytes / SHA-256 `BFBD2109B77B1F4C5E070DAB6B98C806E25AD621ACBE3E2E83AD5C5FB7130CAE`。最终构建已再次以 390×844、`uk-UA` 可见复核成就面板，页面无横溢出、8 项单列稳定、console warn/error 为 0。
- TECH-027 继续为 `partial`；该批次的共享 Gate `BLOCKED` 表述为 historical-as-of，当前开发状态为 `OPEN`、发布状态为 `RELEASE_EVIDENCE_PENDING`。单浏览器证据只记录在 Gate 的 `partialEvidence`；第二桌面浏览器、物理 Android/iPhone/Tablet、真实网络、两正式好友双浏览器私聊、真实 FPS/发热/音频/锁屏、forced-colors、线上最新构建抽查仍为 `NOT_EXECUTED`。
- 本批未修改 Rule、Authority、Protocol、Reward、Replay、Supabase、经济或未审批美术 runtime；未提交、未推送、未部署。

### 2026-08-13 Ghost-native Outcome Surface CLOSE P1 本地收口

- Victory、Reward Breakdown 与 Achievement Wall 现共用 `ghost-outcome-surface`：状态标识 → 核心结果/数值 → 明细 → 下一步动作；Victory 删除随机高饱和彩带，Game Stage 保持 Ink/Cream，平台成就/奖励保持昼夜毛玻璃。
- Reward 仍只读展示服务端权威 Breakdown、G Coins 与 XP，不计算或改写奖励；Rule、Authority、Protocol、Replay、Supabase、商城价格与经济配置均未修改。
- `GhostSurfaceMotion` 只允许 `victory-dialog / reward-dialog` 在沉浸式 Game Shell 内播放一次有限 Timeline；Achievement/DM 等仍静态。Adapter 对最多 16 个语义项使用 transform/autoAlpha stagger，hidden、reduced-motion、替换、关闭、settle、dispose 全部清理，并排除旧棋盘/通用 Modal CSS keyframe 竞争。
- 本地浏览器已复核桌面 dark、390×844 无横向溢出/44px 操作和 light theme 重开；专项、三语、DOM、Reward、Overlay、快速 Quality Gates 与最终完整 `npm test`（151.3 秒；此前全链 154.6 秒也通过）通过。构建为 1,361,503 characters / 1,376,033 bytes / SHA-256 `57BFD553E0C250A1BF386792D7B889CB0B45377F1F17C8BEDB36E2B789ECFE2D`。
- 第二浏览器、Android/iPhone/Tablet、真实网络、forced-colors、visible reduced-motion、真实低端 FPS 与 Golden Set 仍未执行。线上保持 `bd49e6d`/`da3d05c`，本批不提交、不推送、不部署。

### 2026-08-13 Shop Design System CLOSE P1 本地收口

- 商城与共享弹层本地收口已完成：`public/src/core/01-utils.js` 提供 document 级 topmost overlay registry，父子 dialog 的 Esc/Tab 只由顶部层处理，关闭后按层恢复焦点并清理监听。
- `public/src/shop/06-shop.js` 保留分类、商品预览和购买 pending；切换语言刷新商城标题/Tab/预览/状态，关闭商城解绑 `languagechange`；动态背景播放按钮跟随实时 reduced-motion；价格与协议不变。
- 正常用户可见货币统一为 G Coins；`CURRENCY='💵'` 仅保留资源加载失败 fallback/历史服务端兼容，不得删除。未审批 G Coins 源稿继续 source-only。
- 专项、`npm run quality:gates`、完整 `npm test`（176.1 秒）通过；构建 `1,356,934 bytes` / SHA-256 `B1E3509AB28CC03FF43C22FB43A069F8D031083A1C3664B5FC2D270C8B80662`。
- 本地浏览器可见且无 warn/error；第二浏览器、真机、真实网络、forced-colors、visible reduced-motion 与 Golden Set 仍未执行。线上保持 `bd49e6d`/`da3d05c`，本批不提交、不推送、不部署。

### 2026-08-13 TECH-040 Code Health / Health Sweep P1 本地收口

- 新增 `qa/code-health-sweep.js` 与 `npm run test:health`，并纳入 Fast Quality Gates；它检查 package QA/脚本入口、四个有文档用途的 Render/WS 运维脚本 allowlist、Manifest integrated 路径、Feature Flag 运行时消费者、台账/报告发布语义，以及持久化/AI 强化与社交 Guard QA。
- 删除被现行 `qa/theme-contrast-design-system.js` 替代的旧 `qa/theme-contrast-design-system-contract.js`，删除一次性隔离发布 helper `scripts/publish-isolated.js`；移除无运行时消费者的 `mg_companion_honru_v1` Manifest 字段，正式 Honru SVG 与 fallback 保留。
- `asset-library/catalog.json` 已同步生产 Manifest SHA-256；`qa/progress-ledger.js` 改为验证合法且不早于总指挥基线的快照日期，七份报告统一生成到 `20260813`。
- `npm run test:health`、资产/台账/路由专项、`npm run quality:gates`、完整 `npm test`（178.6 秒）通过；构建保持 `1,356,934 bytes` / SHA-256 `B1E35009AB28CC03FF43C22FB43A069F8D031083A1C3664B5FC2D270C8B80662`。本批仍不提交、不推送、不部署，线上保持 `bd49e6d`/`da3d05c`。

### 2026-08-13 Game Stage 输入连续性 CLOSE P1 本地收口

- 六款游戏统一复用同一 `showGame → enterImmersiveGameShell → createGameInstance` 进入链；局内返回按钮和服务端 `end_game` 仍统一经过 `showHub/finishRoomGame`。
- 新增 `qa/game-stage-input-continuity.js`，覆盖 `game-active` 文档滚动锁、Arena/Seat/Command 内部滚动、wheel/touchmove/keydown 监听清理、六款 Game ID 循环进入/退出、返回焦点和滚动位置恢复；已接入 `test:immersive-shell`、Fast Quality Gates 与完整测试。
- 规则、Authority、Protocol、Reward、Replay、数据库及未审批美术 runtime 均未修改。最新浏览器可见、第二浏览器、真机、真实网络和 visible reduced-motion 仍是外部门禁，线上保持 `bd49e6d`/`da3d05c`，本批不提交、不推送、不部署。

### 2026-08-13 Game Stage 共享 HUD / 状态密度 CLOSE P1 本地收口

- 六款 Game Stage 命令区新增统一 State Strip：模式（本地/人机/联机/观战）、连接（在线/连接中）和观众数量独立展示；共享状态栏增加 `role=status`、`aria-live=polite`、`aria-atomic=true` 与 `data-stage-status-kind`。
- `setStatus()` 仅在表现层把思考、连接、警告和终局映射为语义 kind；新增懒加载 `GhostGameStageMotion`/`game-stage-motion-entry.js` 使用官方 GSAP Core/Timeline，仅动画 transform/opacity/autoAlpha，页面隐藏、reduced-motion、Shell 退出和 dispose 时清理/静态降级。
- 新增 `qa/game-stage-hud-density.js`，接入 `test:immersive-shell`、Fast Quality Gates 与完整 `npm test`；三语 key、专项、Health、台账和报告同步。规则、Authority、Protocol、Reward、Replay、数据库、公开字段和未审批美术 runtime 均未修改。
- 本地构建已重新生成；最新浏览器、第二浏览器、真机、真实网络、visible reduced-motion 和低端性能仍是 Gate，线上保持 `bd49e6d`/`da3d05c`，本批不提交、不推送、不部署。

✅ 已完成：
- 6 款精选游戏两种正式玩法（人机 / 联机）；旧同设备多人入口与残留奖励分支已删除
- 联机大厅 / 邀请 / 在线状态 / 排行榜
- 用户名密码账号、一次性访客、旧 PIN 迁移、💵 商城（头像 / 相框 / 特效 / 背景 / 六款游戏外观）
- 三语言 i18n + Settings 设置页 + 语言旗帜
- Ghost Game / Honru 原创品牌、四区应用外壳、昼夜动态场景、毛玻璃 UI、3D 骰子与开局倒计时
- CI：GitHub Pages 自动构建 + 冒烟 + 部署

✅ 已完成（本轮）：
- UI/UX 产品级升级：Design System（间距/字号/色彩令牌）、昼夜双主题、Hero 首屏、卡片入场/按钮光效/胜负彩带/WebAudio 轻音效
- 个性化系统：动态头像框（8 款）、闪名（4 种特效）、动态档案背景（4 款）、等级进度条
- v2.5 产品级打磨：补齐 Motion/Elevation/Icon/Glass 设计令牌与组件规范；统一动效库（转场/入场/弹性/Loading）
- Game Feel：6 款游戏全量接入分级操作反馈（落子/移动/掷骰/射击/放置 → 音效+震动+状态提示），AI 思考中提示
- Visual Polish + a11y：棋盘棋子渐变立体质感、侧栏 sticky、排行榜前三高亮、焦点环/44px 触控目标/最小字号 11px/prefers-reduced-motion
- Theme Contrast Design System P1 本地收口：旧五套运行时主题 CSS 已清零，旧存储值继续迁移到 light/dark；新增实色 surface/text/accent/border/focus/disabled/status/icon/overlay/glass/toast 令牌和数值对比合同，统一 Button/Input/Dialog/Toast/Header/Nav/Auth/Shop/DM/Profile/Room，修正登录 Logo 与 PWA 色，并保护 Premium Background textTone 和 Game Stage Ink/Cream 独立。Game Stage 独立性修正后的 `npm run quality:gates` 与完整 `npm test`（189.0 秒）通过，双构建为 1,333,571 characters / 1,348,120 bytes / SHA-256 `ED29E547F6D6E4475D21414E0979479DB619AA019FC4952AD484D8668008CC66`；Terra Max 终审重试因 429 未形成可采纳结论，按 reviewer limit 记录。最新浏览器、forced-colors、真机、真实网络和低端性能仍未执行，线上仍为 `da3d05c`。
- 前端冒烟 ALL_PASS + 6 款 AI 状态机 ALL_PASS + 联机 E2E ALL_PASS + WS 主动断开测试通过
- 安全回归（鉴权/档案/结算/商城/AI）和断线重连回归均 ALL_PASS；生成产物由 CI 构建后校验与源码同步
- Economy & Progression v1.0：统一服务端 Reward Resolver、AI 票据/日上限、有效局/AFK/秒投拦截、首胜、连胜、重复对手衰减、等级曲线、完整奖励/经济流水与 Reward Breakdown UI
- 独立胜场 `wins/totalWins`、旧等级不降级迁移、Supabase `apply_reward_v1` 单事务落库与失败 outbox 重试
- 视觉商城素材 P0：六款 640×360/320×180 大厅封面、48 Avatar 注册目录、商城主预览/单例/价格契约、五档响应式、三语商品与 Avatar alt 已通过自动化和本地浏览器验收；当前六封面只是 Sticker Cartoon 前的可回滚软 3D 过渡版
- Sticker Cartoon M0 Draft：`art-source/style/` 已含 Art Bible、Facial Kit、Motion、Source Manifest 与 Prompt/provenance；Teacher 八状态、四 Avatar 已有 Alpha Draft，核心 UI 有 HTML/CSS 状态板，五子棋/飞行棋有规则精确 SVG 纵切，`qa/sticker-art-contract.js` 固定 hash/Alpha/15×15/五连/52 格/四机。人工清稿、IP 双人审查、运行时矩阵和 Golden Set 人工决议未执行，全部新旗标默认关闭。
- Honru Pixel Avatar v3 已有 explorer、night-cadet、arcade-builder、stargazer 四款 1254×1254 source/Alpha 技术候选、不可变 hash 与 source-only 合同；人工清稿、Reviewer B、IP Review、Golden Set、44/64/96/192px 真机/主题/reduced-motion 矩阵均为 `NOT_EXECUTED`。候选未进入 `public/assets`、Manifest、默认头像、商城、Profile/Room runtime 或线上。
- 五子棋与俄罗斯方块旧局内纵切继续保留；Canvas/DOM 规则层不变，支持 `mg_art_gomoku_v1` / `mg_art_tetris_v1` 独立回滚
- 本地素材库 `asset-library/` 已建立 provenance、Schema 子集、目录/许可证独立哈希审计；运行时仍以 `asset_manifest.json` 为唯一机器事实源，远端对象存储尚未选择
- 美术母图与 Prompt 位于 `art-source/`，运行时 WebP 位于 `public/assets/`，manifest 与 DOM 冒烟校验路径、ID 和 fallback
- Gameplay Shared Protocol V1：`tank-authority-v1` 20Hz 服务端权威、`tetris-battle-authority-v1` Battle Coordination、独立观众席、循环/瑞士赛事编排、`xiangqi-clock-v1` 棋钟、`monopoly-auction-v1` 实时拍卖
- Tank/Tetris 权威快照重连、通用稳定点快照、公开 Cosmetic ID 合同、协议专项测试与第二阶段报告
- Gameplay Rule Authority v2：Tetris/象棋/大富翁共享纯规则核心、服务端动作/结果权威、完整快照/哈希、统一错误码、capability 协商与 v1 回退
- Tournament 自动生命周期：在线/busy 检查、真实房间、席位分配、单盘 Server Result、自动下一轮、Bye 与重连状态
- Gameplay Cosmetic Profile v1：六款白名单装备、Supabase `game_cosmetics`、公开 presentation 与私有经济隔离
- Tank/Tetris 闪屏修复：稳定 DOM 渲染树、keyed 节点增量更新、destroy/reset 定时器清理和节点身份回归
- 第三阶段自动化巩固：10/25/50 逻辑并发、1000 生命周期内存、Timer Audit、逻辑 Chaos 与关键协议连续回归
- 六款 AI 专项知识包、`personal-linear-v2` 个人持续学习、胜/负反事实更新、平局经验和 Supabase 原子学习 RPC
- Honru Runtime P2 的九状态 Alpha WebP 已取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，当前本地构建以 Manifest-backed default-on 接入签到/邀请/局内反馈/真实胜负映射，并保留素材总开关、局内反应分开关、decode/资源失败回退与 v1 SVG 永久 fallback。人工清稿、自然人 Reviewer B、IP/法律与逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE`；第二浏览器、真机和真实网络只保留发布证据待决。
- Seat/Social/Profile v2 已进入 main：真人/AI/空席、READY、AI Controller、公开/私密房、观战、房主转移、好友/拉黑/举报、Presence 隐私和 Profile v2。
- Gameplay Cosmetic 产品闭环：服务端定价/owned/装备校验、商城按游戏筛选、公开档案只返回装备 ID，六款游戏保留 fallback。
- Daily Task / Replay / Metrics：服务端任务进度与 claimId 幂等领取；Replay v1.1 支持 7 天保留、公开延迟、分享/撤销和播放控制；Metrics v2 提供 Bearer 管理员只读页面、有界历史、CSV、阈值告警、脱敏错误闭环、限频与访问审计。
- Direct Chat v1 + Profile 深度优化：好友私聊、离线留言、历史/未读/已读/幂等/Block/访客与 token 淘汰安全边界；本地 Playline P0 已把私聊收进全局 DM dialog，旧 Chat 深链归一到 `#/playline`；个人主页完成身份、成长、六游戏战绩、成就、任务、社交、收藏和本人回放信息架构。
- Playline Community P0 本地实现：四区改为 Home/Games/Playline/Profile；受限文本、游戏、正式结果与权威记录分享形成闭环，All/Friends、删除、举报、签名 cursor、guest/Test Admin/Block 和 Supabase Adapter 合同通过。生产 capability 默认关闭，真实数据库与内容治理门禁未执行；未提交、未推送、未部署。
- Production Readiness 工程基线：Tetris `tetris-rule-v3` 高级战斗计分及旧 v2→v1 安全回退；Supabase 生产运维、集群租约/PubSub/脱敏遥测合同；带 192/512 PNG 与 Apple 图标的安装型 PWA 安全缓存；Honru cleanup v1 非运行时候选技术通过。30 分钟生产正式好友 WS 会话通过（15 条消息/已读、2 次重连、0 异常断开、P95 181ms）；真实凭证/人工/真机/真实网络闸门仍未通过。
- Game Stage + Tabletop Wave A：六款默认进入统一 Header/真实 Seat Rail/Arena/Command Tray，Cream/Ink 代码原生底材与核心实体覆盖 `52/100`；严格 `mg_art_tabletop_wave_a='0'` 回退旧表现。Honru 助手聊天 UI 与死样式已删除，玩家私聊与签到保留；Tetris 手机 Arena 单列且七项触控 ≥44px。提交 `7fc6601` 已发布到 Pages/Render，Quality Gates、完整 `npm test`、生产 WS、本地桌面/390px 与线上 1280px 浏览器验收通过。
- 沉浸式 Game Shell P0 已随 `da3d05c` 发布：`#screen-game` fixed `100dvh` 全视口，Header/Seat/Arena/Command/Overlay 五插槽冻结；页面滚轮、触摸链和 Scroll Key 默认滚动被锁，游戏事件继续传播，内部滚动保留；进入/退出恢复 Hub 滚动与游戏卡焦点；Rules/Victory/Reward 统一命名 dialog、焦点循环与恢复。Pages/Render 线上均含 `enterImmersiveGameShell`，后续 Wave B 只提升局内密度与表现。
- Social Match P0 已随 `da3d05c` 发布：`match-expression-v1` 完成十个稳定 Emoji ID、六个快捷语 ID、目标席位、服务端权威身份/时间、eventId 幂等、10 秒/60 秒/单局频控、双向 Block 与逐接收者过滤、观众/访客/AI 发送拒绝；Seat 展示公开 Avatar/Frame/Effect/NameFx/Lang，真人头像/名字可打开公开 Profile；Command Slot 提供表达盘、目标和本地静音，头像旁最多三条气泡，退出/重开/销毁清理，reduced-motion 静态降级。当前本地构建已把取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 的十枚 Honru Emoji atlas 接入选择器、头像气泡与定向投掷，保留 Unicode/文字 fallback、双 kill switch 与 Manifest/decode 失败回退；该本地增量尚未发布，且不扩展纯文字 Direct Chat 或 match-chat 协议。
- Social Match P1 房间自由文本聊天已随 `da3d05c` 发布：`match-chat-v1` 完成服务端权威身份/席位/时间、净化、幂等、频控、Block、观众延迟只读与当前对局 50 条内存历史；Game Stage 提供中央历史、未读、输入、举报、本地静音和头像旁短气泡。Pages/Render 线上均含 `match-chat-v1`；正文仍不进入 moveLog、Replay、奖励、AI、Analytics、数据库、localStorage 或普通日志。
- Game Stage Wave B 本地实现：五子棋新增 Arena/状态/最后落子；Tetris 拆分主井、Hold/Next/Incoming、对手、HUD 与七项控制；飞行棋新增实体舞台、骰子、回合/选择状态与排名；大富翁新增实体舞台、骰子、地产/机会卡/拍卖与交易 unavailable 只读状态。共享 CSS 覆盖桌面、平板、390px 与低高度横屏。`mg_art_game_stage_wave_b_v1` 缺失时默认启用，只有精确 `'0'` 回退 Wave A，storage 读取失败安全回退 Wave A；规则、AI、联机、Authority、奖励、Replay、角色公开投影与数据库不变。四款专项、共享布局、规则/AI/表现回归通过；浏览器 localhost 被已保存权限阻断，因此状态仍为本地 `implemented`，未提交、未推送、未部署。
- Game Stage Wave C 本地密度/过程纵切已覆盖六款：五子棋 `turn→aim→select→place→impact→line→terminal`；Tetris `spawn→fall/move/rotate→lock→line-clear→combo/B2B/T-Spin/perfect-clear/garbage→terminal`；飞行棋、大富翁、Tank、象棋继续使用各自已冻结过程链。五子棋防止终局 pending/locked 被迟到 restore 降级；Tetris 覆盖实例隔离、观众、Authority、v3 高级计分和 Replay 非阻塞；Tank 高频权威快照按 KO/重生/移动优先级合并，象棋被动 clock 不覆盖 check/terminal。六款 process 均不进入权威 snapshot/serialized state，Authority/Rule Core/Protocol/Reward/Replay 不变；timer、reconnect/reset/destroy、reduced-motion 与桌面/平板/390px/横屏合同已覆盖。Quality Gates、完整 `npm test`（153.4 秒）和双构建通过，最终物理文件 1,255,936 bytes、SHA-256 `BACD4460A3AC0EC4098A3837C482A4BF00BFB092044B853823CC312663A95BE3`；浏览器运行时仍立即 `Transport closed`，故最新本地浏览器、第二浏览器、真机、真实网络和 visible reduced-motion 仍为 `NOT_EXECUTED`。未提交、未推送、未部署。
- Home Engagement P0 本地验收：首页新增语义化三步引导、按既有 `played` 稳定推荐游戏、level/streak 轻量目标、访客安全 fallback 和正式账号/访客差异入口；推荐按钮进入 Games 并聚焦对应卡片。主负责人把访客“查看成长”修正为“开始第一局”，把仅导航的“去玩”修正为“查看”，并将三步改为有序列表。未增加服务器 mutation、经济数值、游戏规则或未审批美术；专项动态矩阵、三语言、DOM、Ghost Shell、响应式和完整 `npm test`（131.5 秒）通过。双次构建一致：927995 characters、物理文件 942085 bytes、SHA-256 `7980FEDB5222444C42AA7DC3540EE000F353D85ACB0A0316920B417E9903919B`。未提交、未推送、未部署。
- Home Engagement P1 社交收藏脉冲本地验收：仅正式账号显示已有在线好友数、本人收藏编目进度与既有成长方向，复用 Profile/Chat/Shop，访客与未登录保持隐藏；关闭状态为每账号固定 `localStorage` key、以本地日期作 value，storage 异常安全退化。主负责人将“每日新 key”修正为跨日期有界存储并补专项回归。没有 server、protocol、economy、purchase、rules、AI、Replay、Supabase 或 art 变化；专项、共享回归、单独 E2E（53.7 秒）和后续完整 `npm test`（179.7 秒）通过。首次完整链在邀请房间一次性超时，随后单独 E2E 与完整链均通过；双构建一致：968233 characters、982494 bytes、SHA-256 `4A861DD2F6763FE4AFA4640E7F6AEC7418A0DC9E4EAD52BD41831C0988E43C37`。UI-010/ECO-023 仍为 partial，真正可恢复对局须独立权威恢复合同；未提交、未推送、未部署。
- Home Identity P1 当前身份条本地验收：既有 Home pulse 仅对正式账号展示 56px 已装备头像/头像框/特效、raw 昵称和本地化 `Lv.N`，继续复用收藏 X/Y、Profile/Chat/Shop；访客/未登录在读取 `owned` 或调用身份 helper 前短路，catalog 异常安全降级，不展示余额、XP、价格、owned ID、购买记录、角色 slot 或未审批图片。红测 8 项失败后转绿；专项、Home P0/P1、Collection Rarity、Victory Mastery、Identity Preview、Profile Route、i18n、DOM、响应式、Ghost Shell、pretest、Quality Gates 与完整 `npm test`（120.7 秒）通过；双构建一致：971303 characters、985572 bytes、SHA-256 `963DEAEFC5B46621ACCE9B713444D3F3B7F5DC41C775990CD87BE36E501D69FF`。UI-011 仍为 partial；G Coins/角色服装/背景与正式获得路径另有门禁，下一条只冻结当前仍有效对局的同实例返回入口；未提交、未推送、未部署。
- Identity / Avatar / Background CLOSE P1 本地实现步骤已收口：统一表现深模块集中 Avatar/Frame/Effect/NameFx、raw 名称、语言和非法字段回退，旧 `avatarStageNode/nameFxNode` 保持兼容 Adapter；Seat 缓存缺失、Lobby 房主、邀请、Social/玩家列表、全局 DM 与 Playline 作者均使用完整公开身份。48 Avatar 素材全部保留，新账号默认免费仍策展为 100/101；Premium Background 生命周期和 Honru Pixel v3 source-only/runtime 0 引用门禁通过。专项、三语、DOM、Quality Gates、最后一处 DM i18n 修复后的完整 `npm test`（166.5 秒）与双构建通过，最终 1,317,990 characters / 1,332,539 bytes / SHA-256 `1E878CC3B8B8985B58601BD5F34A1F8FB884989A6A94E7815528E25F63E4A44B`；Terra Max 终审未返回可用结论，保留 reviewer limit，不冒充独立审查通过。SOC-001 为 implemented，ART-021 仍 partial，浏览器/真机/人工美术门禁未执行；未提交、未推送、未部署。
- Home Active Match Return P0 本地验收：首页仅在连接/认证、非观众、真人席位、同一 `currentGame/currentGameId/online.game/matchId` 且未结算时显示“返回当前对局”；点击重新校验 matchId 后只调用既有 `showGame()` fast path。结算、离房、过期、reset、replay/reconnect、异常 seat 和 stale click 均隐藏/no-op；不显示 room code、matchId、token、对手或经济字段，也不承诺跨设备/跨重启恢复。主负责人补上旧 Home VM 对新 helper 的 `typeof` 兼容守卫；专项、Home P0/P1/Identity、重连、安全、E2E 与完整 `npm test`（199.8 秒）通过；双构建一致：974130 characters、988467 bytes、SHA-256 `8ECE8C16D5AE051DE59A31D9FA14949FF607675504059BC26BD050BE505F81E8`。未提交、未推送、未部署。
- Social Match 会话状态复核已修正：同一 WebSocket 内会话失效、注销、退出房间或重置对局不会清空已协商 `match-expression-v1`，只有真实断开才清空；Social Match 合同/在线 QA 和双次构建通过。localhost 会话失效后的 in-app 浏览器复核因用户保存权限阻断，保留为外部闸门。
- Tabletop Presentation M1 第一纵切本地收口：新增唯一可逆 `TabletopPerspective`；五子棋第二席 180° 近端视角，飞行棋按本人 2/3/4 人逻辑阵营旋转基地、轨道、终点和移动位置；标准规则坐标、协议、快照、Replay、奖励、AI 和观众公共视角保持不变。主负责人修正 E2E 屏幕坐标尺寸/视角映射，并修正棋盘外坐标夹边漏洞；专项、Tabletop Wave A、AI、Gameplay、连续默认参数 E2E 与完整 `npm test` 通过。双构建一致：930449 characters、物理文件 944539 bytes、SHA-256 `CCA3CAB3193F2A75922B78D6A626716FFA92B012C063A68F4D5D489815F0D301`。localhost 浏览器复核被机器保存权限阻断；动作表现、第二浏览器、真机、真实网络、reduced-motion 可见复核和人工美术审批仍未完成。未提交、未推送、未部署。
- Tabletop Presentation M1 代码原生动作/收尾本地收口：五子棋最后一步用可清理的墨线环/放射冲击替换红框，reduced-motion 保持静态强调；飞行棋标准 `movementPath` 驱动起飞/移动/碰撞/终点反馈；五子棋/飞行棋新增 520ms 轻透视入场，减少动态时完全关闭；飞行棋结算使用既有 `placement` 展示 2/3/4 人三语可访问有序排名台，其他五款 Victory DOM/焦点/关闭行为不变。专项、i18n、Overlay 动态、Gameplay、DOM 和完整 `npm test`（118 秒）通过；双构建一致：934153 characters、物理文件 948243 bytes、SHA-256 `7FE8BC67E7D8E4B2C4356EB655C569E746787C851525CA30ACE4CAA7917C2FF6`。localhost 浏览器仍被保存权限阻断，正式材质/角色/动作素材和外部门禁未完成；未提交、未推送、未部署。
- Progression Identity P1 本地收口：六款游戏分别建立 `1/10/50/100/1000` 胜场五级阶梯，共 30 个差异化三语称号；`shared/progression/victory-mastery.js` 只从服务端权威 `wins` 确定性派生，旧账号无需迁移，客户端 profile mutation 不能伪造。本人主页显示当前/下一目标，公开 Profile 显示已解锁称号；异常数值、继承字段、未知游戏、移动长文案均有回归。主负责人另修正排行榜缓存绕过权威 Profile 请求和 Metrics 固定 8188 端口碰撞；完整 `npm test` 132.2 秒 ALL_PASS，双构建 937242 characters / 951343 physical bytes / SHA-256 `41C9F1A26C050C7F3705C5DD0422567C0F6D219E630B99D57E4AD7D967E34142`。未改 Reward/Supabase/规则/协议/AI/Replay/未审批美术，未提交、未推送、未部署。
- Profile Journey P1 本地收口：在 Profile P0 后增加三张只读“下一段旅程”目标卡，分别显示最近已投入游戏的胜场称号目标、成就进度和本人收藏规模，并复用 Games/成就/商城入口。主负责人修正零胜首胜目标压过已有进行中称号的排序；Terra Max 审核确认好友比较必须另建正式好友/双向 Block/窄化投影权限，不得扩张公开 Profile。专项、三语、响应式、Profile/Social、DOM 与完整 `npm test`（130.7 秒）通过；双构建 944592 characters / 958703 physical bytes / SHA-256 `499FF4D17BDE07A420DA4730E3B58B6A4354288322D37F844C8AE4E835B7C634`。未改服务端、奖励、商城价格、Supabase、协议、规则、AI、Replay 或美术，未提交、未推送、未部署。
- Profile Compare P1 本地收口：新增 `profile_compare/profile_compare_data/profile_compare_error`，仅正式账号可比较当前好友，且服务器每次请求重新校验双向 Block；回执绑定 `requestId + targetUid`，只返回公开身份、等级、总局数/胜场、六款权威胜场/派生称号与成就数量。Profile 好友弹层提供桌面双列、手机单列、三语与统一焦点/Esc/滚动锁生命周期。主负责人修正断线清理与旧 Direct Chat 静态合同的结构回归；专项、三账号在线权限、三语言、DOM、Profile/Social 与完整 `npm test`（118.1 秒）通过；双构建 951578 characters / 965692 physical bytes / SHA-256 `5528D0C6A15C42D096E92B2BA8A7454C1C9332FA414A52497312325496776934`。未扩大公开 Profile，未返回余额、owned、价格、任务、回放、最近对手、在线偏好或凭据；未提交、未推送、未部署。
- Profile Modal A11y P1 本地收口：旧 `openProfileEditor()` 与 `openAchievementsModal()` 已接入统一 `setupAccessibleOverlayDialog` 和 owner 滚动锁，具备命名 dialog、昵称输入/关闭按钮初始焦点、Tab/Shift+Tab、Esc/背景/显式关闭、幂等清理和发起控件焦点恢复。Terra Max 先建立 17 项红灯合同并定位真实 canonical source，主负责人批准最小所有权例外后由第二个 Terra Max 实现；主审补充保存/取消/关闭动作和手机宽度断言，并确认移除会覆盖响应式 CSS 的 460px 内联宽度。专项、三语言、DOM、Profile/Social、Profile Route 与完整 `npm test`（122.5 秒）通过；双构建 953847 characters / 967961 physical bytes / SHA-256 `B07BD0597D0B9834FB2C2C084ED7FD9AAE6ABC6B85D42766BE91DBFFA9C65B96`。未改字段、成就逻辑、协议、服务端、持久化、奖励、价格、规则、AI、Replay 或美术，未提交、未推送、未部署。
- Collection Rarity Catalog P1 本地收口：新增 `CollectionRarityCatalog`，按五类 `category + stable numeric id` 显式编目 150 项资产，固定 Starter/Uncommon/Rare/Epic 四档，仅作为中性展示。本人 Profile 显示已编目进度与分布，商城卡显示三语稀有度；公开 Profile、好友比较和服务端不消费 owned。Terra Max 初版覆盖 117 项商城/Playroom ID；主负责人补入默认免费 avatar 0–29 与 frame/effect/background 0，修复正常新账号被误报 33 件“未编目”的问题。专项、pretest、三语言、DOM、商城价格、Profile、Shop 布局与完整 `npm test`（114.2 秒）通过；双构建 962213 characters / 976327 physical bytes / SHA-256 `457169CB1982748D74CC2E1CBF145176802B0271D88A49B8B1963BC6712B7636`。目录源码不含 price/coins/purchase/reward 推导，不改购买、装备、owned、Supabase、规则、AI、Replay 或美术，未提交、未推送、未部署。
- UI Repair P0.1/P0.5 本地实现：Canvas 与 Avatar v2 `<img>` 统一圆形裁切和 Frame/Effect 层级；`effect-4` 只旋转装饰环；商城头像/相框/特效/背景改为真实身份组合预览；Premium Background 对真实 animated WebP 先 preload、仅 load 后播放，visibility/离屏/恢复、运行时 reduced-motion、poster/static 失败 fallback、release 清理和迟到资源事件均受合同保护。专项、三语、响应式、Quality Gates、完整 `npm test`、双构建 Hash 与既有 1280×720 双主题三语浏览器验收通过；第二浏览器、真机、真实网络和 visible reduced-motion 未由本项新增执行。其 Header/Modal 层级缺陷已由 P0.2 解决。未提交、未推送、未部署。
- UI Repair P0.2 本地验收：统一 Header `120` / Mobile Nav `220` / Modal `900` / Auth `11000` / Toast `12000` 层级；Room Launchpad 覆盖游戏、严格 min/max 容量、公开/私密、观战、6 位无歧义码和统一错误态；`pendingGame` 只绑定本次 `created.room`；Lobby 只信服务端 Join/Spectate 并过滤玩家/观众自身房；普通用户 Tournament 创建/打开/自动弹窗关闭，换号重新由 `hello_ack.admin` 授权；Ghost Game 三语品牌承诺更新。1440×900、1024×768、390×844、844×390、双主题、三语、两标签等待/进行中/观战、Quality Gates、完整 `npm test` 和双构建 Hash 均通过。浏览器 reduced-motion、第二桌面浏览器和真机未执行；未提交、未推送、未部署。
- Tank Controls P0 本地验收：坦克客户端支持 Pointer Capture 八扇区/斜向摇杆、跟手方向反馈、独立多指开火、四方向 D-pad 无障碍降级、WASD/方向键/Space、blur/visibility/pointercancel/lostcapture/destroy 输入释放、44px/safe-area/reduced-motion；严格复用既有 relay/authority 输入对象和单调 seq，未改服务端/协议/规则。专项 Tank Controls、Tank Authority、Gameplay Upgrade、E2E、三语、DOM、响应式、Immersive Shell、Quality Gates、完整 `npm test` 通过。in-app 浏览器 localhost 因已保存权限拦截，第二浏览器、Android/iPhone/Tablet、真实网络整形未执行；Tank 皮肤/地图仍属 ART-035；未提交、未推送、未部署。
- Tank Art P1 已完成最高质量 `gpt-image-2` source-only 概念批次：四种原创坦克材质与一块实体桌游竞技场，清理版与拒绝版均保留不可变 SHA 和逐字 Prompt/provenance。清理版仅进入 `asset-library/catalog.json` 的 `reference-only`，生产 manifest、Tank renderer、Controls、Authority、规则、协议和 fallback 均未改；Reviewer B、IP Review、人工清稿与用户 Golden Set 未执行，不能视为已上线美术。
- G Coins 命名/统一货币 P0 已本地收口：正式显示名冻结为 `G Coins`，内部 `coins`/`currency` 字段、奖励数值、商城价格和协议不变；`currencyIcon()`、`currencyName()`、`currencyAmountText()` 成为统一显示 seam，三语言补齐品牌、ARIA 与法律说明。G Coins 色键源稿已登记为 `ART-026-GCOINS-SOURCE-CHROMA-V1`、1254×1254、SHA-256 `9D6D8870329B04B5A136F66449498656B7601BEE15AFBDABC2A73EAA030919AD`，保持 `reference-only/source-only`，未接入生产 Manifest；旧 `💵` 只作 fallback。专项、i18n、素材库、构建和完整 `npm test` 通过；未提交、未推送、未部署。
- Honru Emoji Runtime P0 严格复用 `emoji_wave/thumbsup/cheer/wow/oops/cry/angry/sly/heart/game` 十个稳定 ID；十枚 1254² RGBA Alpha、192/96/64/44 派生、1024×768 atlas、640×360 poster、逐枚 Prompt/provenance 与 G-17–G-27 登记已取得 `OWNER_AUTHORIZED_ART_CLEARANCE`。当前本地构建已将版本化 atlas/poster 写入 Manifest allowlist 并默认开启选择器、头像气泡和定向投掷；总开关 `mg_art_honru_emoji_v1` 与投掷开关 `mg_art_honru_emoji_throw_v1` 可独立回滚，路径、cell、clearance、decode 或资源失败时回到 Unicode/本地化文字。`direct-chat-v1` 与 `match-chat-v1` 仍为纯文字；人工清稿、Reviewer B、IP/法律与额外 Golden Set 为可选咨询，真机/第二浏览器/真实网络与发布仍待证据。
- Shop Purchase Feedback P0 已本地实现：正式账号同一时刻只允许一笔购买 pending，客户端按 `requestId + uid + category + id` 绑定状态；服务端沿用 `purchase_ok/error` 并回显关联字段，价格、余额、owned、RPC 与幂等权威不变。商城以 `aria-live` 显示处理中/成功/失败/超时，重复点击、错配/迟到响应、关闭、断线和注销均 fail-closed；旧服务端无关联字段时不覆盖新状态，发布须先后端再前端。专项、i18n、DOM、Shop、Security、Supabase Adapter 通过；未提交、未推送、未部署。
- Test Admin P0 已完成线上安全验收：四个环境变量精确绑定并 fail-closed，引导账号使用 scrypt；私有投影为 `∞ G Coins`、`Lv.MAX` 与当前目录全拥有，公开档案/排行榜/Presence/Lobby/好友/Block/举报/私聊保持隐藏或拒绝。测试房间和赛事控制面隔离，测试局不写正式奖励、经济、Replay、AI 学习、Analytics 或 outbox；未来能力必须显式加入白名单。主负责人还修复了离房后旧 `room_update` 晚到复活旧房间的竞态，并依据 Terra Max 发布审计统一 Render/runtime UID 校验、锁死沙盒私有/无观战设置、清理结算后的局内聊天/表达临时态与延迟投递、对 Supabase 管理员引导失败执行监听前 fail-closed；连续三轮 E2E、完整 `npm test`（167.7 秒）和双构建 SHA-256 `E8B8D37C66D8843B61F040EAF5028995A5EBF5E30FDD6ABFF6036AB84EDE304E` 通过。`da3d05c` 已由 Render 部署 `dep-d9sv99f40ujc73dvlru0`，Render/Pages 字节一致；in-app 浏览器与线上临时访客烟测确认私有 MAX/无限币展示、公开档案/Lobby/加入/观战隔离、沙盒零奖励和正式战绩不变。实际密码/UID 不进入仓库或报告。

### UI Repair P0.3–P0.9 本地收口

Chat 空态、公开 Profile/社交弹层、背景预览和访客只读态已分别由 P0.3–P0.6 收口。P0.7 继续修复公开 Profile：排行榜缓存缺失时不再直接报不存在，而是使用现有 `profile_get` 展示命名、可取消、带滚动锁的三语言加载 dialog；成功/空响应按 UID 结束，取消后的迟到响应不得重新打开旧 Profile，公开缓存与服务端字段不变。专项、Profile/Social、三语言、DOM 与完整 `npm test`（172.2 秒）通过；最终 `public/index.html` 为 920073 bytes，SHA-256 `492036CBC9783566C58FC81887533B6E275EFE947727C0BCDC470D3FBEBFA761`。第二浏览器、真机、真实网络和 visible reduced-motion 仍未执行；未提交、未推送、未部署。
Chat 空态、公开 Profile/社交弹层、背景预览和访客只读态已分别由 P0.3–P0.6 收口。P0.7 完成排行榜缓存缺失时的权威 `profile_get` loading/取消/null/迟到响应；P0.8 完成商城真实试穿、商品密度、Premium Background 层级和手机双列/44px。P0.9 完成玩家 Direct Chat 表现层：会话刷新/连接 live status、aria-busy、未读语义、历史加载/日期分隔、加载旧页滚动锚点、真实断线 pending 清理、移动 `enterkeyhint`/安全区/overscroll；没有新增 wire 类型或改变好友/Block/访客/Supabase 边界。主负责人审核修正了“加载旧页前置重渲染导致锚点提前消费”和“断线 loading 卡死”两个边界，并保留 Social Match capability 断言。Chat 专项、旧合同、线上 Direct Chat、Social Match 生命周期、三语言、DOM、完整 `npm test`（113.2 秒）通过；最终 `public/index.html` 为 924691 bytes，SHA-256 `1E00C59C0C6E5FA197BD7C4DB2EA60795897A5CB2992340863FF5F78199133F5`。P0.8 的 Terra Max 审核回传不可读，未采纳其结论；localhost 可见复核被本机保存权限阻断，第二浏览器、真机和真实网络仍未执行；未提交、未推送、未部署。

⏳ 待办：
1. UI Repair P0.9、Social Match P1、Home Engagement P0/P1、Home Identity P1、Home Active Match Return P0、Tabletop Presentation M1、Progression Identity P1、Profile Journey/Compare/Modal A11y/Collection Rarity P1 和 G Coins 命名/统一货币 P0 均已完成本地实现/自动化验收；UI-034 普通赛事入口隐藏已随 UI Repair P0.2 本地收口。UI-010/ECO-023/UI-011 仍为 partial，剩余范围包括安全个性化获得目标、G Coins 原创图标的 `OWNER_AUTHORIZED_ART_CLEARANCE`/获得路径、角色目录和真正 durable recovery；当前返回入口不能写成跨设备/跨重启恢复。
2. Tank Controls P0 已本地验收；Tank Art P1 已完成 source-only 生成和 provenance，下一步是补齐稳定 ID/版本/SHA、机器视觉/技术/相似风险审查、fallback、feature flag 与回滚后取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，再另立 runtime 接入任务。人工清稿、Reviewer B、IP/法律与逐资产 Golden Set 仅为可选咨询，不与 Authority 或控制层混改。
3. Honru Emoji 十枚 atlas 已取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并在当前本地构建默认接入 `match-expression-v1` 的选择器、头像气泡与定向投掷。后续若要让 Direct Chat 或 match-chat 发送图片/Emoji token，必须另立版本化协议与安全/持久化审查；现有两条聊天协议继续纯文字。
4. 提供真实 Supabase DB URL/service-role，并实际执行迁移、浏览器角色 RLS、并发、加密备份、隔离恢复和非破坏回滚验收；通过前 Cluster/Telemetry 保持关闭且 Render 单实例。
5. 当前 in-app 浏览器的 localhost 访问被已保存权限拦截；仍需解除后完成四档 Tank 可见验收，以及第二浏览器、Android/iPhone/Tablet 真机、真实网络整形和浏览器 reduced-motion 实测。
6. 可按风险需要补充 Sticker/Honru 人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set；这些均记录为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，不得伪造成 PASS，也不阻塞满足 `OWNER_AUTHORIZED_ART_CLEARANCE` 的原创资产进入可逆 runtime。未取得逐族所有者清除的位图/SVG 继续 source-only/default-off，代码原生 Wave A 默认开启不替代所有者清除。
7. 多实例生产扩容前完成真实 Supabase 并发与 Reward/AI 分布式 outbox 验收；配置并验证外部遥测接收端。
8. 高级延迟观战、文字/社交游戏，以及需开发者账号/证书的微信小程序、原生 App 与商店发行。

### Player Character P0 / UI-037 / GAME-045（代码状态矩阵已实现，外部闸门待完成）

- `server/player-character.js` 是独立深模块：服务端集中维护 `player-character-v1` schema/catalog/default、未知版本/ID/污染/超长输入回退和公开投影；公开投影仅含 `schemaVersion/characterId/slots`。
- 旧账号、访客、AI、观众和重连都得到确定性 fallback；Profile、公开 Profile、Room Seat 与客户端只读缓存已接入。Profile mutation 不接受 `playerCharacter`，Supabase 不新增必需列，缺失字段按默认角色处理。
- `qa/player-character-contract.js` 覆盖 15 项纯模块/联机/隐私/重连断言；Social Match Seat allowlist 已同步角色公开投影。`npm test`（115.2 秒）、Quality Gates、三语、DOM、Security、Reconnect、E2E 全部通过。
- 本阶段不生成角色图、不做商城装备、不改大富翁规则；ART-036、ECO-029 仍按独立闸门推进。UI-037/GAME-045 已新增代码原生 `MonopolyCharacterPresentation`、`MonopolyPresentationAdapter` 与 `MonopolyUiState`：消费公开 Seat、权威位置、连续 revision/transition，支持进入、回合、移动、落点、机会卡、买地、支付、拍卖、破产、断线、重连、观战、结算与 fallback，带拍卖倒计时、机会卡 dialog、三语、44px、reduced-motion 和现有 marker fallback；角色 renderer 须在 ART-036 取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可逆接入，正式商城与外部发布证据仍未完成。当前批次只本地实现，未提交、推送或部署。
- ART-036 已生成两张最高质量 `gpt-image-2` source-only 方向板并登记 G-14/G-15 `reference-only`；模型实际输出的棋盘为 1254×1254 已如实记录。具体资产在稳定 ID/版本/SHA/provenance、机器视觉/技术/相似风险审查、fallback/flag/回滚齐全并取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 后才可进入可逆 runtime；人工清稿、Reviewer B、IP/法律与 Golden Set 仅为可选咨询。
- ECO-029 已完成 contract-only 纯适配器与 8 组专项 QA：默认 active catalog 为空，不能购买/装备；正式 `player_character` 商品必须另行同步服务端价格、Supabase `apply_purchase_v1`、并发/RLS/备份/回滚和商城 UI，禁止借道 Avatar/Game Cosmetic。
- UI-037/GAME-045 代码原生表现与状态矩阵专项已通过：`qa/monopoly-character-presentation.js`、`qa/monopoly-presentation-adapter.js`、`qa/ui-037-monopoly-presentation.js`、`qa/social-match-client-lifecycle.js`；根级 `transition` 只在表现层消费，未改变 `monopoly-rule-v2` wire、Rule Core、奖励、Replay、AI、商城或数据库。未取得 ART-036 `OWNER_AUTHORIZED_ART_CLEARANCE` 的方向板仍不得进入 `public/assets` 或 Manifest；本地主线完整 `npm test`、E2E、Quality Gates 均通过。

## 8. 项目历程

- 初版：2-5 人小游戏网页版 → 聚焦六款可持续深化的游戏。
- 联机版：WS 房间/大厅/邀请、金币、排行榜、像素头像。
- 增强版：人机 AI、黑夜主题、毛玻璃、3D 骰子、倒计时、房间内切游戏。
- 聚焦版：保留 6 款可持续深化的游戏，删除低可玩性条目；接入品牌/现金 SVG、asset manifest 与程序化 fallback。
- v2.0：i18n 三语言、Settings 设置页、语言旗帜。
- 部署：GitHub Pages（前端）+ Render（后端）。

## 9. 给新 Codex 窗口的操作建议

- 先读本文件 + `README.md` + `server/index.js` 的 handleMessage + `public/src/online/03-websocket.js` 的
  `online` 对象与 `public/src/08-registry.js` 游戏注册表，再动手。
- 改前端后跑 `node qa/dom-smoke.js`；改联机逻辑后跑 `node --experimental-websocket qa/e2e-online.js`。
- e2e 用例顺序敏感、对状态文案有断言，改文案时同步更新断言。
- 零 npm 依赖、零打包器；新消息在服务端与前端成对添加；不破坏旧协议与数据。

## 10. 中文简易改动日志（必须维护）

- 仓库根目录固定维护 `LOG-新增.md`、`LOG-修改.md`、`LOG-删除.md`。
- 每次有项目改动时，在全部实现与验证完成后、结束任务前更新这三份文件。
- 格式统一为 `日期 时间｜内容`，使用本地时间；内容保持简短、明确。
- 某一类别本次没有内容时，也在对应日志记录“本次无新增 / 无修改 / 无删除”，避免遗漏审计。

## 11. Project Execution OS（研究报告落地）

- 所有大型任务先执行 `.agents/skills/playroom-recon`，再按 `.agents/skills/playroom-plan` 建立 `requirements/active/<task>/`，冻结 `IN/OUT/契约/所有权/验收证据` 后才施工。
- 项目级 Skills 位于 `.agents/skills/`；第三方 Skill 统一登记在 `requirements/skills-registry.json`，状态生命周期为 `REFERENCE → PILOT → APPROVED`，安全问题可标 `BLOCKED`。未经仓库/许可/脚本/网络/破坏性命令/密钥审计不得进入 `PILOT/APPROVED`；GSAP 官方 skills 已完成审计并登记为 `APPROVED`。
- 共享高风险文件见 `HIGH_RISK_FILES.md` 与 `requirements/OWNERSHIP_MATRIX.json`。普通 Agent 不得直接编辑，必须提交 `SHARED_CHANGE_REQUEST.md` 由 Master 集成。
- 机器可读进度见 `PROJECT_STATUS.json`；状态必须区分 `implemented`、`verified`、`production-ready`、`not_executed`、`blocked`。真实设备、真实 Supabase、真实网络整形未执行时不可写生产就绪。
- Motion 统一由 `MOTION_TOKENS.json` 和前端 CSS 令牌驱动；动效分 L0-L4，有大厅/档案/游戏 Shell 密度预算，并必须尊重 reduced-motion、暂停 offscreen 动画、不阻塞输入。
- GSAP 官方 skills 是 Motion 实现与审核的必经门禁；每个动效任务在 requirement/contract 中记录使用的 skill、时间线/插件选择、销毁点、离屏暂停、低动效分支和性能证据，详见 `requirements/active/gsap-motion-governance-p0-20260811/`。
- 发布前运行 `npm run quality:gates` 与完整 `npm test`；最终证据可由 `npm run evidence` 生成。发布声明必须包含 changed files、tests、visual/manual QA、NOT_EXECUTED、known issues、commit、回滚点和线上地址。

## 12. 全量需求台账、分类进度与发布规则

- `requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 是产品需求唯一机器台账；2026-08-13 快照含 242 项唯一原子需求，分为美术与品牌、界面与交互、游戏与局内体验、社交与玩家关系、经济成长与商业化、技术数据 AI 与跨平台六类。
- 台账 Schema v2 同时维护 76 个来源词典入口、129 个显式依赖节点/267 条有向依赖、六种状态验收口径和 48 个历史/当前请求覆盖组；覆盖组联合覆盖全部 242 个 ID，防止跨窗口需求静默消失。2026-08-12 起 `requirements/GHOST_GAME_MAINLINE_COMMAND.md` 负责阶段顺序、需求冻结、Ghost3D 与 GSAP 门禁，不替代原子台账。
- 总进度入口为 `简易报告/项目总需求进度报告-20260817.md`；它按六方向整合全部 242 项明细，六份分类报告只作快速索引。全部报告由 `scripts/generate-progress-reports.js` 从同一台账生成，禁止直接手改。
- 新需求必须分配唯一分类 ID；同一需求只能在一个分类计数，跨领域使用 `related`。状态只使用 `verified / implemented / partial / planned / not_executed / blocked`。
- 当前唯一游戏范围仍是六款、人机与联机两种玩法；旧 11 款和三模式白皮书已被替代，不恢复被删除的低可玩性游戏。
- 每个后续批次只进入一个主要领域，先建独立 active task 并冻结 IN/OUT、所有权、回滚和证据，避免美术、UI、游戏、社交与生产基础设施混在一个施工批次。
- 图片生成默认使用最高质量图像模型与设置；只有冻结合同下与高阶模型输出实质等价并通过人工可见对比，才允许交给 `gpt-5.6-terra max` 批量执行。
- **未经用户在当前任务明确要求“推送 / 输出线上 / 部署”，完成本地验收后必须停止，不执行 commit、git push、GitHub Pages 或 Render 发布。**
- 修改台账后运行 `npm run reports:progress` 与 `npm run test:progress-ledger`；QA 会检查来源路径、verified 证据、依赖无环、请求全覆盖和七报告逐项字段。发布前仍需 `npm run quality:gates` 和完整 `npm test`。
- 每个主线批次结束或切换到下一 Part 前，必须先读取 `requirements/BRIEF_REPORT_CONTRACT.md`、运行报告生成器，并在简报和对话中输出六方向“本地实现 / 最终闭环”百分比；完整需求统一从总进度入口查阅，分类报告只作快速索引。
- 每个体验纵切还必须遵守 `requirements/VERTICAL_SLICE_DEFINITION.md` 的十项完成门槛；`npm run test:vertical-slice` 检查证据等级、真实可见/输入/状态/a11y/i18n/reduced-motion/性能/清理/回滚/权威边界。CSS、文字、图标、静态截图或 VM 不能单独把需求写成完成；缺浏览器、真机或生产证据时保持 `implemented`/`partial`/`NOT_EXECUTED`，原创美术的可选人工/IP 咨询只如实记录，不阻塞 `OWNER_AUTHORIZED_ART_CLEARANCE`。
- 涉及协议、数据、Renderer、支付、跨端、安全、备份、回滚或发布边界的重大选择，必须先引用 `requirements/ADR/README.md` 与 `000-template.md`；`npm run test:adr` 检查状态、替代方案、证据、回滚和敏感信息边界。ADR 的 `accepted` 不等于已实现或已发布。
- 缺陷必须按 `requirements/BUG_INTAKE_CONTRACT.md` 与 `BUG_INTAKE_TEMPLATE.json` 建立稳定 bugId，经过脱敏、分级、复现、修复、回归和关闭；`npm run test:bug-intake` 检查合同。没有回归证据或外部环境证据时不得写 `closed`/`verified`。
- 首屏、Game Stage、GSAP 动效、素材和长列表必须遵守 `requirements/PERFORMANCE_BUDGET_CONTRACT.md`；网页动效使用 `gsap-performance` skill 的 transform/opacity、批量读写、有限 tween、离屏暂停和清理规则，`npm run test:performance-budget` 检查 Manifest 与源码边界。真实设备 FPS/GPU/内存/网络仍保持 `NOT_EXECUTED`。
- 用户提供的 RPG 角色动画包与 Q 版 UI 分层包已登记到 `asset-library/external-source-register-20260813.json`：状态仍为 `reference-only / blocked-license / EXTERNAL_REFERENCE_ONLY`，并已开启用户授权的受控全信息 reference lane；Skill 可掌握 URL/hash/许可、预览、结构/图层/对象库存，任务相关输入逐项留证。64/64 角色接触表、354/354 UI 预览、256 份 ZIP 内 License/README 和全部 836 个外部文件的逐文件 SHA-256 已审计；外部素材不得直接复制、描摹、换色、解压进仓库或进入 `public/assets`/Manifest/runtime；由其影响的输出先保持 source-only 并完成相似风险审查。

## 13. 2026-08-12 Wave C 当前收口点

### Control Plane Reset 当前主线裁决

- 当前台账仍为 242 项；`requirements/MAINLINE_CONTROL_ROUTING.json` 将它们唯一映射为 `NOW_CLOSURE` 146、`NON_BLOCKING_FOR_DEVELOPMENT` 32、`EXTERNAL_GATE` 0、`DEFERRED_MAINLINE` 48、`FUTURE_EXPANSION` 16。
- 三条共享 Gate 固定为 `GATE-DEVICE-BROWSER-NETWORK`、`GATE-SUPABASE-PRODUCTION`、`GATE-ART-GOLDEN-SET`；最新报告入口为 `简易报告/项目总需求进度报告-20260817.md`，语义 QA 为 `qa/mainline-control-plane.js`。
- 历史 CONTROL 批次中的 TECH-027 `Transport closed` 已由 2026-08-14 单浏览器 localhost 部分证据更新；该批次旧 `BLOCKED` 语义只作 historical-as-of。TECH-027 仍为 `partial`；第二浏览器、物理真机、真实网络与真实 Supabase 为 `RELEASE_EVIDENCE_PENDING`，人工 Golden Set 为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`。

- 五子棋/Tetris Wave C 已补齐 reviewer P1：五子棋拥有真实可取消 AI timeout、Canvas keyboard grid 与 44px 触控等价输入；Tetris 在 restore、Replay 与 Authority snapshot 后保持单一有效 AI timer。
- Wave C 过程条和实际棋盘 transform 使用 Motion Token；网页/游戏后续复杂动效继续强制经过 `gsap-core`、`gsap-timeline` 与 `gsap-performance`，并保留 reduced-motion 与清理路径。
- `npm run test:game-stage-density-final`、规则权威、网络混沌、i18n、DOM、Quality Gates 和完整 `npm test`（159.8 秒）通过；双构建稳定为逻辑 1,251,511 bytes、磁盘 1,266,060 bytes、SHA-256 `6B823D0E2F2399EB622799E4E1DEC6EEBC43F7DA02E78075C80F0A51E910AF1D`。
- 浏览器内核仍在导航前返回 `Transport closed`，当前可见矩阵保持 `NOT_EXECUTED`；该批次状态仍是 `implemented/VERIFYING`，不得写成视觉 verified。

### Ghost3D Foundation P0 本地边界

- `public/src/core/08-ghost3d-foundation.js` 现已作为 inert core 在游戏实现之前进入确定性构建；对外只有 `create` / `QUALITY`，实例只有 `apply(message)`、`snapshot()`、`dispose()`。该注册不创建实例、不挂载 Adapter、不改变任何 Game Stage。
- Foundation 只消费调用方经 `apply` 注入的语义 frame/input/motion/environment/lifecycle 数据；源码零 DOM/平台/engine 依赖，不读取或监听 `document`、`window`、`matchMedia` 等环境，也不包含 Three.js 类型或值。规则、协议、回放、奖励、AI、经济、社交和持久状态继续隔离。
- Foundation P0 的历史批次本身没有 vendor、ESM island、游戏 Adapter 或可见 scene；后续 Gomoku 纵切已经另立 active task，不能反向扩大 Foundation Interface，也不能把后续 Renderer 事实写进规则层。
- 三轮 reviewer 修正已固定在 Foundation 本地合同：先移除宽 Interface 与 DOM/平台耦合，再校正异步 mount/configuration、stale quality/environment 与 fresh-adapter recover，最后收紧 motion readiness，并以 VM browser-global、cross-realm frame 和 hostile projection 覆盖外部 seam。`qa/ghost3d-foundation.js` 当前为 41 条本地断言，不替代浏览器或美术 Gate。

### Gomoku Ghost3D P0 当前本地边界

- `requirements/active/gomoku-ghost3d-vertical-slice-p0-20260812/` 是 TECH-049 的后续纵切，不新增 Requirement。精确旗标 `mg_ghost3d_gomoku_v1 === '1'` 才懒加载 `public/three/gomoku-entry.js`；默认关闭、storage/模块/WebGL/渲染/context-loss 任一失败都保留 Wave B Canvas、键盘和触控。
- Renderer 使用同源封闭相对 ESM 图：Three `r185 / 0.185.1`、GSAP `3.15.0` core，版本、许可证与 SHA-256 见 `vendor-provenance.md`。不使用 import map、CSSPlugin、ScrollTrigger、GLB、纹理、Loader 或未审批美术；`.gitattributes` 禁止 Git 换行改写 byte-pinned vendor。
- `onReady` 只能在首个语义 frame 真正 render 成功后触发。HIGH 使用可 kill 的 `entrance → settled` Camera timeline 与 `focus → place → settled` 落子 timeline；LOW/reduced-motion 静态 settle。suspend、render failure、context loss、fresh recovery 与 dispose 都必须保持指针/fallback 和资源清理合同。
- `npm run test:gomoku-ghost3d` 覆盖 ESM graph 55、Renderer 78、bridge、layout 与 SW lazy-cache；专项已进入 pretest/full test 和快速 Quality Gates。2026-08-14 修复后的双构建为 1,362,068 characters / 1,376,602 bytes / SHA-256 `BFBD2109B77B1F4C5E070DAB6B98C806E25AD621ACBE3E2E83AD5C5FB7130CAE`。
- 2026-08-14 已在单一 Codex in-app Chromium 当时 localhost 构建完成默认关闭 Canvas 回退、临时 opt-in BALANCED Three 首帧 ready、Raycast 落子/AI 回合及 CDP reduced-motion 的部分可见复核；旗标和媒体模拟均已清除。第二浏览器、Android/iPhone/Tablet、真实性能/网络、GLB/正式美术、Reviewer B/IP/Golden Set 尚未完成；TECH-049 继续 `partial`、ART-033 继续 `planned`，不得写成跨设备 `3D_VISUAL_VERIFIED` 或生产就绪。线上仍是 `da3d05c`，本批未提交、推送或部署。
- 2026-08-14 Chromium 又暴露 Game Stage DOM adapter 误用 core-only GSAP 的 `y/scale/autoAlpha/clearProps` 警告，以及 Three r185 的 `PCFSoftShadowMap` 弃用。当前修复固定为 DOM adapter 使用官方 `esm/index.js + CSSPlugin`、Three renderer 继续独立 core-only 图并使用 `PCFShadowMap`、Service Worker 升为 v6；图/缓存/Renderer/HUD 专项和完整 `npm test`（182.7 秒）通过。修复后的 Browser 控制台/输入复核仍为 `NOT_EXECUTED`，不得借用修复前零警告记录。

### UI Motion Closure P1 当前本地边界

- `requirements/active/ui-motion-closure-p1-20260812/` 复用 `UI-028 / TECH-054`，不新增 Requirement ID。`GhostRouteMotion` 对外只有 `transition / settle / dispose / snapshot`；`setAppRoute()` 的认证、连接、hash、aria 和路由 renderer 仍在每次调用内同步提交，动效不能延迟现有下一帧焦点或浏览器前进/后退。
- 页面 DOM island 使用官方 GSAP `3.15.0` 的 `esm/index.js + CSSPlugin.js + gsap-core.js` 封闭相对图，首次需要时只预热，后续路由只编排 `committed → enter → settled` 的有限新页进入。Gomoku 仍直接 import core-only 文件，两条图相互隔离；不使用 CDN、ScrollTrigger 或额外插件。
- generation、单 loader promise、sticky failure、旧 handle 隔离、hidden/aria-hidden/inert、认证/注销、document hidden、Game Shell、reduced-motion 和 dispose 都落到确定静态状态。只动画 transform/opacity，最多 12 个 target、总窗口不超过 360ms；目标页始终可聚焦和点击。
- Route Motion 专项为 18+17+11+16+4 条断言；Quality Gates 与完整 `npm test`（176.6 秒）通过，双构建稳定为 1,312,603 characters / 1,327,152 bytes / SHA-256 `1C802828EF5E799358F8199163428AD2BFBC5572CD90997999E82EC80B887DF3`。浏览器连接器仍在初始化前 `Transport closed`，所以可见/reduced-motion/真机/低端 FPS 保持 `NOT_EXECUTED`；未提交、推送或部署。

### Direct Message Design System P1 当前本地边界

- `requirements/active/direct-message-design-system-p1-20260812/` 复用 `UI-024 / UI-027 / UI-028 / SOC-012 / TECH-054`，不增加消息类型或产品能力。全局私信仍只消费 `direct-chat-v1`；会话栏与线程现在分开承载服务状态、总未读、好友完整公开身份、摘要、本地化时间、消息正文与已发送/发送中/失败重试元数据。
- `GhostSurfaceMotion` 对外只有 `run / settle / dispose / snapshot`，DM 只发 `open / thread / back / close` 四个语义阶段。私有 Adapter 复用已固定的 GSAP 3.15 Core+CSSPlugin 图，只使用有限 label、transform/opacity、generation last-wins、kill/revert；不使用 ScrollTrigger、持续循环或布局属性。
- reduced-motion、后台、Game Shell、首次预热和模块失败均同步落到可交互稳定态；这些阻断环境不下载可选 GSAP。桌面双栏、手机 `100dvh`、四边 safe-area、内部滚动和 44px 操作已进入合同；玩家名字、摘要与正文继续只用 `textContent + data-i18n-raw`。
- 专项为 18+12+9 条断言，三语 1,632 keys、进度台账、快速 Quality Gates、包含新 Motion 执行测试的完整 `npm test`（147.1 秒）与双构建均通过；最终 1,333,055 characters / 1,347,604 bytes / SHA-256 `0546BBFB5C2FACA13D9D3D9C121FFBA7A1C48E9C98D5A516DA23C25EA2BCAB62`。浏览器初始化继续返回 `Transport closed`，所以最新可见矩阵、第二浏览器、真机、真实网络、visible reduced-motion 和低端 FPS 保持 `NOT_EXECUTED`；未提交、推送或部署。

### 2026-08-15 PWA Offline i18n v13 与审批降阻 P1

- Service Worker v13 将三份 locale 从通用 SHELL 分离，以同源、无 query、GET、`no-cache` 和严格响应校验安装；运行时 network-first 刷新最后合法离线词典。其他 JSON 即使伪装成 script destination 也不缓存，成功导航只有 `text/html` 可覆盖离线壳层。API/WS/Auth/Chat/Token 排除、六款 Ghost3D 与 GSAP lazy island 边界保持。
- VM 红绿回归覆盖 GitHub Pages 子路径、三语、query/Authorization/跨源/POST/API/未知语言/任意 JSON、500/HTML/no-store、quota failure、503 与 JSON 导航污染。单一 Codex in-app Chromium 未强制 `skipWaiting()`，真实走完 v11/v12 waiting → v13 激活，最终只保留 v13 cache；三语 G Coins 新标签均无裸 key，console warn/error 为 0。
- `requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md` 规定技术 Reviewer、哈希/Alpha/尺寸、对比度、a11y、i18n、性能、fallback、Manifest、缓存、自动回归和本地浏览器证据默认机器继续。人工清稿、独立自然人 Reviewer B、IP/法律最终判断与用户 Golden Set 属于 `OPTIONAL_ADVISORY_EVIDENCE`；第二浏览器、真机、真实网络和真实 Supabase 是外部环境发布证据。
- 本批不改变三条共享 Gate，不提交、不推送、不部署。第二浏览器、物理 Android/iPhone/Tablet PWA 更新和真实网络仍为 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`，不阻塞其他开发。

## 14. Godogen Asset Generator Skill（2026-08-18）

- 已按项目负责人要求安装 `htdt/godogen` 的 `asset-gen` Skill：源仓库 `https://github.com/htdt/godogen`，分支 `master`，安装版本 `05cebffc8b10c5817e8a3db495b82e7b6004ab84`，本地入口为 `C:\Users\wangxr\.codex\skills\asset-gen\SKILL.md`。
- 后续任何游戏开发任务开始前都必须先读取并按该 Skill 做适用性预检；涉及游戏图片、贴图、GLB/3D 模型、角色、Rig、动画 Sprite 或背景移除时，必须使用该 Skill 的工具链，并记录稳定 ID、runtime 路径、游戏内尺寸、成本、来源/provenance、许可状态、fallback、feature flag 与回滚。
- 纯规则、Authority、协议、UI、镜头、Renderer 性能或测试代码任务也要执行该 Skill 的 `NOT_APPLICABLE` 预检，但不得为代码任务调用付费生成 API；任何实际生成调用都必须先取得当前用户明确确认，且不能把外部 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材直接送入 runtime。
- `asset-gen` 输出默认留在受控 runtime 资产目录；接入 `public/assets`、Manifest 或默认 runtime 前，继续经过项目 `GATE-ART-GOLDEN-SET`、provenance、相似风险、fallback 与回滚合同。该 Skill 的安装不等于美术清除、真机证据或发布授权。

## 15. 六款 Ghost3D 正式默认表现层（2026-08-18）

- 六款局内 Renderer 已从“exact opt-in 技术试验”切换为正式 local presentation default：缺少 `mg_ghost3d_{game}_v1` 时启用，只有精确字符串 `"0"` 回滚；Wave B 自身仍以精确 `"0"` 关闭，storage 不可用时 fail-closed 到旧 DOM/Canvas。
- Gomoku、Ludo、Monopoly、Xiangqi、Tetris、Tank 均消费冻结 Semantic Presentation Model / Motion Event；Three r185 + GSAP 只在对应 lazy GameModuleLoader island 内。Renderer 不进入 Rule、Authority、Protocol、Reward、Replay、AI、Economy、Social、Persistence 或网络 payload。
- Renderer 首个语义 frame ready 后才隐藏可替换 2D paint：Gomoku/Ludo/Monopoly 使用 board opacity fallback，Xiangqi 保留 DOM 点击/键盘 cue，Tetris 隐藏 cell paint，Tank 隐藏可替换 DOM paint；HUD、控制、44px 触控、无障碍与原输入所有权继续保留。
- `qa/ghost3d-default-on-contract.js` 是跨六款总合同；六款专项 contract/layout/cache/ESM/Renderer 与 `npm run test:ghost3d-default-on` 已通过。该结论是本地 implemented/verified contract，不是第二浏览器、Android/iPhone/Tablet、真实 50/100/200ms 网络、低端性能或发布证据。
- 当前仍使用程序化几何；GLB/贴图/正式生产美术替换不是本批已完成项。任何新资产必须按已安装 godogen `asset-gen` 做 NOT_APPLICABLE/APPLIED 预检；付费生成需用户明确确认，并补 Manifest、SHA/provenance、尺寸、许可、fallback、flag 与回滚。
