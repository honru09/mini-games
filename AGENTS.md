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
**昼夜双主题**、Home/Games/Chat/Profile 四区外壳与原创助手 **Honru**。

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
│   └── assets/          # 品牌、UI、游戏美术与 manifest；必须保留程序化 fallback
├── server/index.js      # 零依赖 Node 服务：静态文件 + 手写 WebSocket(/ws) + /api/ai + /api/companion + Supabase
├── server/auth-credentials.js # 用户名规范、随机盐 scrypt 密码哈希与恒定工作量验证
├── server/companion.js  # Honru 请求净化、Prompt、白名单响应与三语离线回退
├── server/reward-engine.js # Economy & Progression v1.0 唯一奖励配置、等级曲线与纯计算层
├── server/ai-strategy-skills.js # 六款 AI 专项知识包（运行时不联网）
├── server/ai-learning.js # personal-linear-v2 玩家×游戏持续学习
├── server/gameplay/     # Tank、三套 Rule Authority、赛事、协议、指标与兼容适配器
├── shared/rules/        # Tetris / Xiangqi / Monopoly 无 DOM 共享纯规则核心
├── scripts/             # 运维脚本
│   ├── render-status.js # 只读查看服务/部署状态
│   ├── render-env.js    # 写 Render 环境变量
│   ├── render-deploy.js # 手动触发 Render 部署
│   ├── supabase-status.js # 检查 Supabase 连通性与迁移字段
│   └── ws-live-test.js  # 线上 WebSocket 冒烟
├── qa/                  # 测试
│   ├── dom-smoke.js      # 前端冒烟
│   ├── ai-games.js       # 6 款 AI 合法选择、回退与状态机回归
│   ├── reward-system.js  # Reward Config、等级曲线、防刷与人机/联机双模式奖励回归
│   ├── rule-authority-online.js # 三套 v2 真实 WebSocket 动作/状态/错误/重连
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
node qa/ai-games.js             # 6 款人机状态机
node qa/ai-strength.js          # 六款战术强度与候选特征
node qa/ai-learning.js          # 个人持续学习纯单元回归
node --experimental-websocket qa/ai-learning-online.js
node qa/gameplay-upgrade.js     # 六款共享 Gameplay 接口
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
- 五子棋/飞行棋仍是服务端顺序与身份校验 + 客户端规则/稳定快照；Tank 使用 `tank-authority-v1` 服务端模拟；Tetris/象棋/大富翁默认分别协商 `tetris-rule-v2`、`xiangqi-rule-v2`、`monopoly-rule-v2` 共享 Rule Core 服务端权威，v1 只保留兼容回退。
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
node scripts/render-env.js
```

Supabase 首次接入或升级时，在 SQL Editor 执行可重复迁移的 `supabase/schema.sql`，再运行 `node scripts/supabase-status.js`。Schema 已对 `profiles` / `history` / `reward_history` / `economy_ledger` / `analytics_events` / `ai_learning_models` / `ai_learning_experiences` 启用 RLS 且不开放 anon/authenticated policy，`profiles` 含 `wins/total_wins`、`solo_rate`、首胜、AI 日上限和 XP 曲线版本字段，并创建 `apply_reward_v1`、`apply_purchase_v1`、`apply_ai_learning_v1` 单事务 RPC，因此服务端必须使用 `service_role` key；不要使用 anon/publishable key，也绝不能把 service-role secret 交给浏览器。没有真实凭证时可运行 `qa/supabase-adapter.js` 做本地 fake PostgREST 映射与幂等回归，但它不能替代真实 SQL、事务并发、连通性、备份回滚与 RLS 验收。

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

⏳ 待办：
1. 提供真实 Supabase 凭证并执行迁移、RLS/并发、备份与回滚验收（当前只通过 fake adapter）
2. 执行 Desktop Chrome/第二浏览器、Android、iPhone、Tablet 实机矩阵，以及真实 `tc/netem`/等价网络整形和 30 分钟 Synthetic Session；完成前 RC 保持 `BLOCKED`
3. Tetris T-Spin/B2B/Combo/Perfect Clear、外部 Sentry/跨实例长期指标存储、高级延迟观战与文字/社交游戏
4. 多实例部署前完成 Reward Resolver 与 AI 学习 outbox 的数据库版本冲突重算/单写者改造
5. 平台扩展（微信小程序 / App / 桌面版）
6. 按 `requirements/active/sticker-cartoon-golden-set-m0-20260808/` 执行 Art Bible v1、Design/Motion v3、Source Manifest v2、IP Review 与 Persona/Avatar/UI/五子棋/飞行棋 Golden Set；闸门通过前不批量生产

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
