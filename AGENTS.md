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
**昼夜双主题**、Home/Games/Chat/Profile 四区外壳、原创品牌角色 **Honru** 与六款统一 Game Stage。

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
│   │   ├── core/        # i18n / utils / assets / app-shell / game-framework / social / ai-personas
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
node qa/dom-smoke.js            # 前端冒烟
node qa/game-stage-contract.js  # 对局舞台、Seat Rail、Tetris 手机布局
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
node qa/timer-audit.js
node qa/network-chaos.js
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
- Chat 只提供玩家消息；旧 `#/chat?view=honru` 与未知 view 归一到 `#/chat`。正式账号仅能与当前好友发送一对一纯文本消息，访客禁止持久私聊。会话列表的系统空态走 i18n，玩家昵称/消息正文才标记 `data-i18n-raw`，避免语言切换冻结系统文案。
- `chat_list/chat_history/chat_send/chat_read` 与 `chat_state/chat_history/chat_message/chat_send_ok/chat_read_ok/chat_error` 成对维护；sender、conversation、message ID、十进制字符串 seq 与时间由服务端权威签发。
- `(senderUid,clientMessageId)` 发送幂等；正文 NFC/控制符净化后限 500 Unicode/2000 UTF-8 bytes，只用 `textContent` + `data-i18n-raw` 渲染，不进入日志、Analytics、Replay、Profile、排行榜或 localStorage。
- 任一方向 Block 阻断发送和历史并从摘要/未读排除；解除好友后历史只读；已读必须对应本人真实收到的入站 seq 且账号级单调推进。
- 主动推送前重新校验 session token，已被五 token 上限淘汰或登出的旧 WebSocket 不得收到消息。
- 本地 JSON 有界回退为 90 天/每会话 500/全局 50,000；Supabase 启用时发送先经过数据库好友/Block/幂等事务并持久化成功再回执。多实例与生产持久化仍以真实 Supabase 迁移/并发/备份验收为前提。
- `ENABLE_CLUSTER_COORDINATION=1` 且真实 Supabase 迁移完成后，实例使用数据库时间租约与 fencing token；Direct Chat PubSub 只发布 message ID/参与 UID，其他实例再从数据库拉正文并重新校验有效 session。缺配置时保持现有单实例行为。

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
- Home/Games/Chat/Profile 共用同一路由；`<=640px` 使用底部四项导航，平板与桌面使用顶部导航；Games 集中全部六款游戏。
- Light 为缓慢云海/大气层，Dark 为向外运动的深空星场；毛玻璃、reduced-motion 和游戏中暂停环境动效同时生效。
- 房间内切换游戏：`end_game` 消息 → `finishRoomGame()`。

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
$env:SUPABASE_KEY='sb_secret_...'              # 可选；必须是仅服务端保存的 service_role secret
$env:METRICS_ADMIN_TOKEN='高熵随机值'           # 可选；管理员 Metrics API Bearer token
$env:ENABLE_CLUSTER_COORDINATION='1'             # 仅在真实迁移/验收后开启
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
- 前端冒烟 ALL_PASS + 6 款 AI 状态机 ALL_PASS + 联机 E2E ALL_PASS + WS 主动断开测试通过
- 安全回归（鉴权/档案/结算/商城/AI）和断线重连回归均 ALL_PASS；生成产物由 CI 构建后校验与源码同步
- Economy & Progression v1.0：统一服务端 Reward Resolver、AI 票据/日上限、有效局/AFK/秒投拦截、首胜、连胜、重复对手衰减、等级曲线、完整奖励/经济流水与 Reward Breakdown UI
- 独立胜场 `wins/totalWins`、旧等级不降级迁移、Supabase `apply_reward_v1` 单事务落库与失败 outbox 重试
- 视觉商城素材 P0：六款 640×360/320×180 大厅封面、48 Avatar 注册目录、商城主预览/单例/价格契约、五档响应式、三语商品与 Avatar alt 已通过自动化和本地浏览器验收；当前六封面只是 Sticker Cartoon 前的可回滚软 3D 过渡版
- Sticker Cartoon M0 Draft：`art-source/style/` 已含 Art Bible、Facial Kit、Motion、Source Manifest 与 Prompt/provenance；Teacher 八状态、四 Avatar 已有 Alpha Draft，核心 UI 有 HTML/CSS 状态板，五子棋/飞行棋有规则精确 SVG 纵切，`qa/sticker-art-contract.js` 固定 hash/Alpha/15×15/五连/52 格/四机。人工清稿、IP 双人审查、运行时矩阵和 Golden Set 人工决议未执行，全部新旗标默认关闭。
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
- Honru Runtime P2 默认关闭纵切：九状态 Alpha WebP、Manifest/Catalog 双闸门、签到/聊天/邀请/局内反馈/真实胜负映射、replay/重开/销毁/解码竞态隔离与 33 项专项 QA；登录页黑夜 Logo 已修复。人工/IP/真实设备闸门通过前不得默认开启。
- Seat/Social/Profile v2 已进入 main：真人/AI/空席、READY、AI Controller、公开/私密房、观战、房主转移、好友/拉黑/举报、Presence 隐私和 Profile v2。
- Gameplay Cosmetic 产品闭环：服务端定价/owned/装备校验、商城按游戏筛选、公开档案只返回装备 ID，六款游戏保留 fallback。
- Daily Task / Replay / Metrics：服务端任务进度与 claimId 幂等领取；Replay v1.1 支持 7 天保留、公开延迟、分享/撤销和播放控制；Metrics v2 提供 Bearer 管理员只读页面、有界历史、CSV、阈值告警、脱敏错误闭环、限频与访问审计。
- Direct Chat v1 + Profile 深度优化：好友私聊、离线留言、历史/未读/已读/幂等/Block/访客与 token 淘汰安全边界；Chat 只保留玩家消息，旧 Honru 深链归一到 `#/chat`；个人主页完成身份、成长、六游戏战绩、成就、任务、社交、收藏和本人回放信息架构，专项与完整 `npm test` 通过。
- Production Readiness 工程基线：Tetris `tetris-rule-v3` 高级战斗计分及旧 v2→v1 安全回退；Supabase 生产运维、集群租约/PubSub/脱敏遥测合同；带 192/512 PNG 与 Apple 图标的安装型 PWA 安全缓存；Honru cleanup v1 非运行时候选技术通过。30 分钟生产正式好友 WS 会话通过（15 条消息/已读、2 次重连、0 异常断开、P95 181ms）；真实凭证/人工/真机/真实网络闸门仍未通过。
- Game Stage + Tabletop Wave A：六款默认进入统一 Header/真实 Seat Rail/Arena/Command Tray，Cream/Ink 代码原生底材与核心实体覆盖 `52/100`；严格 `mg_art_tabletop_wave_a='0'` 回退旧表现。Honru 助手聊天 UI 与死样式已删除，玩家私聊与签到保留；Tetris 手机 Arena 单列且七项触控 ≥44px。提交 `7fc6601` 已发布到 Pages/Render，Quality Gates、完整 `npm test`、生产 WS、本地桌面/390px 与线上 1280px 浏览器验收通过。
- 沉浸式 Game Shell P0 本地验收：`#screen-game` fixed `100dvh` 全视口，Header/Seat/Arena/Command/Overlay 五插槽冻结；页面滚轮、触摸链和 Scroll Key 默认滚动被锁，游戏事件继续传播，内部滚动保留；进入/退出恢复 Hub 滚动与游戏卡焦点；Rules/Victory/Reward 统一命名 dialog、初始焦点、Tab 循环、Esc/背景关闭与焦点恢复；1440×900、1024×768、390×844、844×390、三语言、双主题、Quality Gates、完整 `npm test` 和双构建 Hash 均通过。未提交、未推送、未部署。
- Social Match P0 本地验收：`match-expression-v1` 完成十个稳定 Emoji ID、六个快捷语 ID、目标席位、服务端权威身份/时间、eventId 幂等、10 秒/60 秒/单局频控、双向 Block 与逐接收者过滤、观众/访客/AI 发送拒绝；Seat 展示公开 Avatar/Frame/Effect/NameFx/Lang，真人头像/名字可打开公开 Profile；Command Slot 提供表达盘、目标和本地静音，头像旁最多三条气泡，退出/重开/销毁清理，reduced-motion 静态降级。表达不进入 moveLog、Replay、奖励、AI 学习、Analytics 或数据库。四档浏览器、专项 QA、Quality Gates、完整 `npm test` 与双构建 Hash 均通过。原创 Honru Emoji 与美术投掷素材仍未执行；未提交、未推送、未部署。
- Social Match P1 房间自由文本聊天本地验收：新增 `match-chat-v1`，完成服务端权威身份/席位/时间、NFC/控制符净化、160 字/640 bytes/4 行、messageId 幂等、10 秒/60 秒/单局频控、Block 逐接收者过滤、观众延迟只读与当前对局 50 条内存历史；Game Stage 提供中央历史、未读、输入、举报、本地静音和头像旁短气泡，收到新消息时保留当前局内内存草稿，生命周期完整清理。正文不进入 moveLog、Replay、奖励、AI、Analytics、数据库、localStorage 或普通日志。主负责人修正旧 Social Match/Game Stage 静态测试误扫边界及重渲染丢草稿问题；专项、旧 Social Match、Game Stage 与完整 `npm test`（142.6 秒）均通过。双次构建一致：923629 characters、物理文件 937519 bytes、SHA-256 `1A709832AD0320518DB9E944AEEA70BD508231FF56FF6BCF2B88B7436694C305`。未提交、未推送、未部署。
- Home Engagement P0 本地验收：首页新增语义化三步引导、按既有 `played` 稳定推荐游戏、level/streak 轻量目标、访客安全 fallback 和正式账号/访客差异入口；推荐按钮进入 Games 并聚焦对应卡片。主负责人把访客“查看成长”修正为“开始第一局”，把仅导航的“去玩”修正为“查看”，并将三步改为有序列表。未增加服务器 mutation、经济数值、游戏规则或未审批美术；专项动态矩阵、三语言、DOM、Ghost Shell、响应式和完整 `npm test`（131.5 秒）通过。双次构建一致：927995 characters、物理文件 942085 bytes、SHA-256 `7980FEDB5222444C42AA7DC3540EE000F353D85ACB0A0316920B417E9903919B`。未提交、未推送、未部署。
- Home Engagement P1 社交收藏脉冲本地验收：仅正式账号显示已有在线好友数、本人收藏编目进度与既有成长方向，复用 Profile/Chat/Shop，访客与未登录保持隐藏；关闭状态为每账号固定 `localStorage` key、以本地日期作 value，storage 异常安全退化。主负责人将“每日新 key”修正为跨日期有界存储并补专项回归。没有 server、protocol、economy、purchase、rules、AI、Replay、Supabase 或 art 变化；专项、共享回归、单独 E2E（53.7 秒）和后续完整 `npm test`（179.7 秒）通过。首次完整链在邀请房间一次性超时，随后单独 E2E 与完整链均通过；双构建一致：968233 characters、982494 bytes、SHA-256 `4A861DD2F6763FE4AFA4640E7F6AEC7418A0DC9E4EAD52BD41831C0988E43C37`。UI-010/ECO-023 仍为 partial，真正可恢复对局须独立权威恢复合同；未提交、未推送、未部署。
- Home Identity P1 当前身份条本地验收：既有 Home pulse 仅对正式账号展示 56px 已装备头像/头像框/特效、raw 昵称和本地化 `Lv.N`，继续复用收藏 X/Y、Profile/Chat/Shop；访客/未登录在读取 `owned` 或调用身份 helper 前短路，catalog 异常安全降级，不展示余额、XP、价格、owned ID、购买记录、角色 slot 或未审批图片。红测 8 项失败后转绿；专项、Home P0/P1、Collection Rarity、Victory Mastery、Identity Preview、Profile Route、i18n、DOM、响应式、Ghost Shell、pretest、Quality Gates 与完整 `npm test`（120.7 秒）通过；双构建一致：971303 characters、985572 bytes、SHA-256 `963DEAEFC5B46621ACCE9B713444D3F3B7F5DC41C775990CD87BE36E501D69FF`。UI-011 仍为 partial；G Coins/角色服装/背景与正式获得路径另有门禁，下一条只冻结当前仍有效对局的同实例返回入口；未提交、未推送、未部署。
- Home Active Match Return P0 本地验收：首页仅在连接/认证、非观众、真人席位、同一 `currentGame/currentGameId/online.game/matchId` 且未结算时显示“返回当前对局”；点击重新校验 matchId 后只调用既有 `showGame()` fast path。结算、离房、过期、reset、replay/reconnect、异常 seat 和 stale click 均隐藏/no-op；不显示 room code、matchId、token、对手或经济字段，也不承诺跨设备/跨重启恢复。主负责人补上旧 Home VM 对新 helper 的 `typeof` 兼容守卫；专项、Home P0/P1/Identity、重连、安全、E2E 与完整 `npm test`（199.8 秒）通过；双构建一致：974130 characters、988467 bytes、SHA-256 `8ECE8C16D5AE051DE59A31D9FA14949FF607675504059BC26BD050BE505F81E8`。未提交、未推送、未部署。
- Social Match 会话状态复核已修正：同一 WebSocket 内会话失效、注销、退出房间或重置对局不会清空已协商 `match-expression-v1`，只有真实断开才清空；Social Match 合同/在线 QA 和双次构建通过。localhost 会话失效后的 in-app 浏览器复核因用户保存权限阻断，保留为外部闸门。
- Tabletop Presentation M1 第一纵切本地收口：新增唯一可逆 `TabletopPerspective`；五子棋第二席 180° 近端视角，飞行棋按本人 2/3/4 人逻辑阵营旋转基地、轨道、终点和移动位置；标准规则坐标、协议、快照、Replay、奖励、AI 和观众公共视角保持不变。主负责人修正 E2E 屏幕坐标尺寸/视角映射，并修正棋盘外坐标夹边漏洞；专项、Tabletop Wave A、AI、Gameplay、连续默认参数 E2E 与完整 `npm test` 通过。双构建一致：930449 characters、物理文件 944539 bytes、SHA-256 `CCA3CAB3193F2A75922B78D6A626716FFA92B012C063A68F4D5D489815F0D301`。localhost 浏览器复核被机器保存权限阻断；动作表现、第二浏览器、真机、真实网络、reduced-motion 可见复核和人工美术审批仍未完成。未提交、未推送、未部署。
- Tabletop Presentation M1 代码原生动作/收尾本地收口：五子棋最后一步用可清理的墨线环/放射冲击替换红框，reduced-motion 保持静态强调；飞行棋标准 `movementPath` 驱动起飞/移动/碰撞/终点反馈；五子棋/飞行棋新增 520ms 轻透视入场，减少动态时完全关闭；飞行棋结算使用既有 `placement` 展示 2/3/4 人三语可访问有序排名台，其他五款 Victory DOM/焦点/关闭行为不变。专项、i18n、Overlay 动态、Gameplay、DOM 和完整 `npm test`（118 秒）通过；双构建一致：934153 characters、物理文件 948243 bytes、SHA-256 `7FE8BC67E7D8E4B2C4356EB655C569E746787C851525CA30ACE4CAA7917C2FF6`。localhost 浏览器仍被保存权限阻断，正式材质/角色/动作素材和外部门禁未完成；未提交、未推送、未部署。
- Progression Identity P1 本地收口：六款游戏分别建立 `1/10/50/100/1000` 胜场五级阶梯，共 30 个差异化三语称号；`shared/progression/victory-mastery.js` 只从服务端权威 `wins` 确定性派生，旧账号无需迁移，客户端 profile mutation 不能伪造。本人主页显示当前/下一目标，公开 Profile 显示已解锁称号；异常数值、继承字段、未知游戏、移动长文案均有回归。主负责人另修正排行榜缓存绕过权威 Profile 请求和 Metrics 固定 8188 端口碰撞；完整 `npm test` 132.2 秒 ALL_PASS，双构建 937242 characters / 951343 physical bytes / SHA-256 `41C9F1A26C050C7F3705C5DD0422567C0F6D219E630B99D57E4AD7D967E34142`。未改 Reward/Supabase/规则/协议/AI/Replay/未审批美术，未提交、未推送、未部署。
- Profile Journey P1 本地收口：在 Profile P0 后增加三张只读“下一段旅程”目标卡，分别显示最近已投入游戏的胜场称号目标、成就进度和本人收藏规模，并复用 Games/成就/商城入口。主负责人修正零胜首胜目标压过已有进行中称号的排序；Terra Max 审核确认好友比较必须另建正式好友/双向 Block/窄化投影权限，不得扩张公开 Profile。专项、三语、响应式、Profile/Social、DOM 与完整 `npm test`（130.7 秒）通过；双构建 944592 characters / 958703 physical bytes / SHA-256 `499FF4D17BDE07A420DA4730E3B58B6A4354288322D37F844C8AE4E835B7C634`。未改服务端、奖励、商城价格、Supabase、协议、规则、AI、Replay 或美术，未提交、未推送、未部署。
- Profile Compare P1 本地收口：新增 `profile_compare/profile_compare_data/profile_compare_error`，仅正式账号可比较当前好友，且服务器每次请求重新校验双向 Block；回执绑定 `requestId + targetUid`，只返回公开身份、等级、总局数/胜场、六款权威胜场/派生称号与成就数量。Profile 好友弹层提供桌面双列、手机单列、三语与统一焦点/Esc/滚动锁生命周期。主负责人修正断线清理与旧 Direct Chat 静态合同的结构回归；专项、三账号在线权限、三语言、DOM、Profile/Social 与完整 `npm test`（118.1 秒）通过；双构建 951578 characters / 965692 physical bytes / SHA-256 `5528D0C6A15C42D096E92B2BA8A7454C1C9332FA414A52497312325496776934`。未扩大公开 Profile，未返回余额、owned、价格、任务、回放、最近对手、在线偏好或凭据；未提交、未推送、未部署。
- Profile Modal A11y P1 本地收口：旧 `openProfileEditor()` 与 `openAchievementsModal()` 已接入统一 `setupAccessibleOverlayDialog` 和 owner 滚动锁，具备命名 dialog、昵称输入/关闭按钮初始焦点、Tab/Shift+Tab、Esc/背景/显式关闭、幂等清理和发起控件焦点恢复。Terra Max 先建立 17 项红灯合同并定位真实 canonical source，主负责人批准最小所有权例外后由第二个 Terra Max 实现；主审补充保存/取消/关闭动作和手机宽度断言，并确认移除会覆盖响应式 CSS 的 460px 内联宽度。专项、三语言、DOM、Profile/Social、Profile Route 与完整 `npm test`（122.5 秒）通过；双构建 953847 characters / 967961 physical bytes / SHA-256 `B07BD0597D0B9834FB2C2C084ED7FD9AAE6ABC6B85D42766BE91DBFFA9C65B96`。未改字段、成就逻辑、协议、服务端、持久化、奖励、价格、规则、AI、Replay 或美术，未提交、未推送、未部署。
- Collection Rarity Catalog P1 本地收口：新增 `CollectionRarityCatalog`，按五类 `category + stable numeric id` 显式编目 150 项资产，固定 Starter/Uncommon/Rare/Epic 四档，仅作为中性展示。本人 Profile 显示已编目进度与分布，商城卡显示三语稀有度；公开 Profile、好友比较和服务端不消费 owned。Terra Max 初版覆盖 117 项商城/Playroom ID；主负责人补入默认免费 avatar 0–29 与 frame/effect/background 0，修复正常新账号被误报 33 件“未编目”的问题。专项、pretest、三语言、DOM、商城价格、Profile、Shop 布局与完整 `npm test`（114.2 秒）通过；双构建 962213 characters / 976327 physical bytes / SHA-256 `457169CB1982748D74CC2E1CBF145176802B0271D88A49B8B1963BC6712B7636`。目录源码不含 price/coins/purchase/reward 推导，不改购买、装备、owned、Supabase、规则、AI、Replay 或美术，未提交、未推送、未部署。
- UI Repair P0.1 本地实现：Canvas 与 Avatar v2 `<img>` 统一圆形裁切和 Frame/Effect 层级；`effect-4` 只旋转装饰环；商城头像/相框/特效/背景改为真实身份组合预览；Premium Background 使用真实 animated WebP、poster、播放/暂停、失败 fallback、observer/visibility 清理与 reduced-motion 静态降级。专项、三语、响应式、Quality Gates、完整 `npm test`、双构建 Hash 与 1280×720 双主题三语浏览器验收通过；其 Header/Modal 层级缺陷已由 P0.2 解决。未提交、未推送、未部署。
- UI Repair P0.2 本地验收：统一 Header `120` / Mobile Nav `220` / Modal `900` / Auth `11000` / Toast `12000` 层级；Room Launchpad 覆盖游戏、严格 min/max 容量、公开/私密、观战、6 位无歧义码和统一错误态；`pendingGame` 只绑定本次 `created.room`；Lobby 只信服务端 Join/Spectate 并过滤玩家/观众自身房；普通用户 Tournament 创建/打开/自动弹窗关闭，换号重新由 `hello_ack.admin` 授权；Ghost Game 三语品牌承诺更新。1440×900、1024×768、390×844、844×390、双主题、三语、两标签等待/进行中/观战、Quality Gates、完整 `npm test` 和双构建 Hash 均通过。浏览器 reduced-motion、第二桌面浏览器和真机未执行；未提交、未推送、未部署。
- Tank Controls P0 本地验收：坦克客户端支持 Pointer Capture 八扇区/斜向摇杆、跟手方向反馈、独立多指开火、四方向 D-pad 无障碍降级、WASD/方向键/Space、blur/visibility/pointercancel/lostcapture/destroy 输入释放、44px/safe-area/reduced-motion；严格复用既有 relay/authority 输入对象和单调 seq，未改服务端/协议/规则。专项 Tank Controls、Tank Authority、Gameplay Upgrade、E2E、三语、DOM、响应式、Immersive Shell、Quality Gates、完整 `npm test` 通过。in-app 浏览器 localhost 因已保存权限拦截，第二浏览器、Android/iPhone/Tablet、真实网络整形未执行；Tank 皮肤/地图仍属 ART-035；未提交、未推送、未部署。
- Tank Art P1 已完成最高质量 `gpt-image-2` source-only 概念批次：四种原创坦克材质与一块实体桌游竞技场，清理版与拒绝版均保留不可变 SHA 和逐字 Prompt/provenance。清理版仅进入 `asset-library/catalog.json` 的 `reference-only`，生产 manifest、Tank renderer、Controls、Authority、规则、协议和 fallback 均未改；Reviewer B、IP Review、人工清稿与用户 Golden Set 未执行，不能视为已上线美术。
- G Coins 命名/统一货币 P0 已本地收口：正式显示名冻结为 `G Coins`，内部 `coins`/`currency` 字段、奖励数值、商城价格和协议不变；`currencyIcon()`、`currencyName()`、`currencyAmountText()` 成为统一显示 seam，三语言补齐品牌、ARIA 与法律说明。G Coins 色键源稿已登记为 `ART-026-GCOINS-SOURCE-CHROMA-V1`、1254×1254、SHA-256 `9D6D8870329B04B5A136F66449498656B7601BEE15AFBDABC2A73EAA030919AD`，保持 `reference-only/source-only`，未接入生产 Manifest；旧 `💵` 只作 fallback。专项、i18n、素材库、构建和完整 `npm test` 通过；未提交、未推送、未部署。
- Shop Purchase Feedback P0 已本地实现：正式账号同一时刻只允许一笔购买 pending，客户端按 `requestId + uid + category + id` 绑定状态；服务端沿用 `purchase_ok/error` 并回显关联字段，价格、余额、owned、RPC 与幂等权威不变。商城以 `aria-live` 显示处理中/成功/失败/超时，重复点击、错配/迟到响应、关闭、断线和注销均 fail-closed；旧服务端无关联字段时不覆盖新状态，发布须先后端再前端。专项、i18n、DOM、Shop、Security、Supabase Adapter 通过；未提交、未推送、未部署。
- Test Admin P0 已完成本地安全验收：四个环境变量精确绑定并 fail-closed，引导账号使用 scrypt；私有投影为 `∞ G Coins`、`Lv.MAX` 与当前目录全拥有，公开档案/排行榜/Presence/Lobby/好友/Block/举报/私聊保持隐藏或拒绝。测试房间和赛事控制面隔离，测试局不写正式奖励、经济、Replay、AI 学习、Analytics 或 outbox；未来能力必须显式加入白名单。主负责人还修复了离房后旧 `room_update` 晚到复活旧房间的竞态；连续三轮 E2E、完整 `npm test`（148.1 秒）和双构建 SHA-256 `52CE07C2185B9EDC8A34D374BA15A270B2FC9F7643CC0539E967E622A307A828` 通过。实际密码/UID 不进入仓库或报告。

### UI Repair P0.3–P0.9 本地收口

Chat 空态、公开 Profile/社交弹层、背景预览和访客只读态已分别由 P0.3–P0.6 收口。P0.7 继续修复公开 Profile：排行榜缓存缺失时不再直接报不存在，而是使用现有 `profile_get` 展示命名、可取消、带滚动锁的三语言加载 dialog；成功/空响应按 UID 结束，取消后的迟到响应不得重新打开旧 Profile，公开缓存与服务端字段不变。专项、Profile/Social、三语言、DOM 与完整 `npm test`（172.2 秒）通过；最终 `public/index.html` 为 920073 bytes，SHA-256 `492036CBC9783566C58FC81887533B6E275EFE947727C0BCDC470D3FBEBFA761`。第二浏览器、真机、真实网络和 visible reduced-motion 仍未执行；未提交、未推送、未部署。
Chat 空态、公开 Profile/社交弹层、背景预览和访客只读态已分别由 P0.3–P0.6 收口。P0.7 完成排行榜缓存缺失时的权威 `profile_get` loading/取消/null/迟到响应；P0.8 完成商城真实试穿、商品密度、Premium Background 层级和手机双列/44px。P0.9 完成玩家 Direct Chat 表现层：会话刷新/连接 live status、aria-busy、未读语义、历史加载/日期分隔、加载旧页滚动锚点、真实断线 pending 清理、移动 `enterkeyhint`/安全区/overscroll；没有新增 wire 类型或改变好友/Block/访客/Supabase 边界。主负责人审核修正了“加载旧页前置重渲染导致锚点提前消费”和“断线 loading 卡死”两个边界，并保留 Social Match capability 断言。Chat 专项、旧合同、线上 Direct Chat、Social Match 生命周期、三语言、DOM、完整 `npm test`（113.2 秒）通过；最终 `public/index.html` 为 924691 bytes，SHA-256 `1E00C59C0C6E5FA197BD7C4DB2EA60795897A5CB2992340863FF5F78199133F5`。P0.8 的 Terra Max 审核回传不可读，未采纳其结论；localhost 可见复核被本机保存权限阻断，第二浏览器、真机和真实网络仍未执行；未提交、未推送、未部署。

⏳ 待办：
1. UI Repair P0.9、Social Match P1、Home Engagement P0/P1、Home Identity P1、Home Active Match Return P0、Tabletop Presentation M1、Progression Identity P1、Profile Journey/Compare/Modal A11y/Collection Rarity P1 和 G Coins 命名/统一货币 P0 均已完成本地实现/自动化验收；UI-034 普通赛事入口隐藏已随 UI Repair P0.2 本地收口。UI-010/ECO-023/UI-011 仍为 partial，剩余范围包括安全个性化获得目标、G Coins 正式原创图标审批/获得路径、角色目录和真正 durable recovery；当前返回入口不能写成跨设备/跨重启恢复。
2. Tank Controls P0 已本地验收；Tank Art P1 已完成 source-only 生成和 provenance，当前等待人工清稿、Reviewer B、IP Review、Golden Set；通过后另立 runtime 接入任务，不与 Authority 或控制层混改。
3. 提供真实 Supabase DB URL/service-role，并实际执行迁移、浏览器角色 RLS、并发、加密备份、隔离恢复和非破坏回滚验收；通过前 Cluster/Telemetry 保持关闭且 Render 单实例。
4. 当前 in-app 浏览器的 localhost 访问被已保存权限拦截；仍需解除后完成四档 Tank 可见验收，以及第二浏览器、Android/iPhone/Tablet 真机、真实网络整形和浏览器 reduced-motion 实测。
5. 由独立自然人完成 Sticker/Honru 人工清稿、Reviewer B/IP Review 与用户 Golden Set 签字；通过前 M0/P1/P2 未审批位图/SVG 继续默认关闭。代码原生 Wave A 默认开启不代表这些资源已获批。
6. 多实例生产扩容前完成真实 Supabase 并发与 Reward/AI 分布式 outbox 验收；配置并验证外部遥测接收端。
7. 高级延迟观战、文字/社交游戏，以及需开发者账号/证书的微信小程序、原生 App 与商店发行。

### Player Character P0 / UI-037 / GAME-045（代码状态矩阵已实现，外部闸门待完成）

- `server/player-character.js` 是独立深模块：服务端集中维护 `player-character-v1` schema/catalog/default、未知版本/ID/污染/超长输入回退和公开投影；公开投影仅含 `schemaVersion/characterId/slots`。
- 旧账号、访客、AI、观众和重连都得到确定性 fallback；Profile、公开 Profile、Room Seat 与客户端只读缓存已接入。Profile mutation 不接受 `playerCharacter`，Supabase 不新增必需列，缺失字段按默认角色处理。
- `qa/player-character-contract.js` 覆盖 15 项纯模块/联机/隐私/重连断言；Social Match Seat allowlist 已同步角色公开投影。`npm test`（115.2 秒）、Quality Gates、三语、DOM、Security、Reconnect、E2E 全部通过。
- 本阶段不生成角色图、不做商城装备、不改大富翁规则；ART-036、ECO-029 仍按独立闸门推进。UI-037/GAME-045 已新增代码原生 `MonopolyCharacterPresentation`、`MonopolyPresentationAdapter` 与 `MonopolyUiState`：消费公开 Seat、权威位置、连续 revision/transition，支持进入、回合、移动、落点、机会卡、买地、支付、拍卖、破产、断线、重连、观战、结算与 fallback，带拍卖倒计时、机会卡 dialog、三语、44px、reduced-motion 和现有 marker fallback；获批角色 renderer、正式商城与外部设备验收仍未完成。当前批次只本地实现，未提交、推送或部署。
- ART-036 已生成两张最高质量 `gpt-image-2` source-only 方向板并登记 G-14/G-15 `reference-only`；模型实际输出的棋盘为 1254×1254 已如实记录。人工清稿、Reviewer B、IP Review、Golden Set 前不得接入 runtime。
- ECO-029 已完成 contract-only 纯适配器与 8 组专项 QA：默认 active catalog 为空，不能购买/装备；正式 `player_character` 商品必须另行同步服务端价格、Supabase `apply_purchase_v1`、并发/RLS/备份/回滚和商城 UI，禁止借道 Avatar/Game Cosmetic。
- UI-037/GAME-045 代码原生表现与状态矩阵专项已通过：`qa/monopoly-character-presentation.js`、`qa/monopoly-presentation-adapter.js`、`qa/ui-037-monopoly-presentation.js`、`qa/social-match-client-lifecycle.js`；根级 `transition` 只在表现层消费，未改变 `monopoly-rule-v2` wire、Rule Core、奖励、Replay、AI、商城或数据库。未经 ART-036 人工审批，任何方向板仍不得进入 `public/assets` 或 Manifest；本地主线完整 `npm test`、E2E、Quality Gates 均通过。

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
- 项目级 Skills 位于 `.agents/skills/`；第三方 Skill 只登记在 `requirements/skills-registry.json`，当前均为 `REFERENCE`，未经仓库/许可/脚本/网络/破坏性命令/密钥审计不得安装或运行。
- 共享高风险文件见 `HIGH_RISK_FILES.md` 与 `requirements/OWNERSHIP_MATRIX.json`。普通 Agent 不得直接编辑，必须提交 `SHARED_CHANGE_REQUEST.md` 由 Master 集成。
- 机器可读进度见 `PROJECT_STATUS.json`；状态必须区分 `implemented`、`verified`、`production-ready`、`not_executed`、`blocked`。真实设备、真实 Supabase、真实网络整形未执行时不可写生产就绪。
- Motion 统一由 `MOTION_TOKENS.json` 和前端 CSS 令牌驱动；动效分 L0-L4，有大厅/档案/游戏 Shell 密度预算，并必须尊重 reduced-motion、暂停 offscreen 动画、不阻塞输入。
- 发布前运行 `npm run quality:gates` 与完整 `npm test`；最终证据可由 `npm run evidence` 生成。发布声明必须包含 changed files、tests、visual/manual QA、NOT_EXECUTED、known issues、commit、回滚点和线上地址。

## 12. 全量需求台账、分类进度与发布规则

- `requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 是产品需求唯一机器台账；2026-08-11 快照含 234 项唯一原子需求，分为美术与品牌、界面与交互、游戏与局内体验、社交与玩家关系、经济成长与商业化、技术数据 AI 与跨平台六类。
- 台账 Schema v2 同时维护 62 个来源词典入口、121 个显式依赖节点/235 条有向依赖、六种状态验收口径和 42 个历史/当前请求覆盖组；覆盖组联合覆盖全部 234 个 ID，防止跨窗口需求静默消失。
- 总进度入口为 `简易报告/项目总需求进度报告-20260809.md`；六份分类报告由 `scripts/generate-progress-reports.js` 从同一台账生成，禁止直接手改生成报告。
- 新需求必须分配唯一分类 ID；同一需求只能在一个分类计数，跨领域使用 `related`。状态只使用 `verified / implemented / partial / planned / not_executed / blocked`。
- 当前唯一游戏范围仍是六款、人机与联机两种玩法；旧 11 款和三模式白皮书已被替代，不恢复被删除的低可玩性游戏。
- 每个后续批次只进入一个主要领域，先建独立 active task 并冻结 IN/OUT、所有权、回滚和证据，避免美术、UI、游戏、社交与生产基础设施混在一个施工批次。
- 图片生成默认使用最高质量图像模型与设置；只有冻结合同下与高阶模型输出实质等价并通过人工可见对比，才允许交给 `gpt-5.6-terra max` 批量执行。
- **未经用户在当前任务明确要求“推送 / 输出线上 / 部署”，完成本地验收后必须停止，不执行 commit、git push、GitHub Pages 或 Render 发布。**
- 修改台账后运行 `npm run reports:progress` 与 `npm run test:progress-ledger`；QA 会检查来源路径、verified 证据、依赖无环、请求全覆盖和七报告逐项字段。发布前仍需 `npm run quality:gates` 和完整 `npm test`。
