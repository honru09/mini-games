# AGENTS.md — Mini Games Platform 项目上下文

> 本文件是给 Codex / 新协作者的项目说明书。新环境克隆本仓库后，Codex 会自动读取本文件；
> 也可以直接说「读一下 AGENTS.md 了解项目」。

## 1. 项目一句话

**Mini Games Platform** — 网页版多人游戏平台：五子棋、飞行棋、迷你大富翁、坦克大战、
俄罗斯方块、象棋，共 6 款精选插件化游戏。
平台是主体（大厅 / 好友 / 房间 / 排行榜 / 金币 / 成长 / 社交），游戏是插件。

核心理念 **Fast Fun Loop**：打开 3 秒开局 → 5 分钟一局 → 立刻再来；先看到「人」，再看到「游戏」。

两种玩法：**人机对战**（DeepSeek 合法选项 + 本地 AI 回退）、**联机对战**（WebSocket 房间 + 游戏大厅 + 邀请 + 在线状态 + 全球排行榜）。真人联机房可加入服务端可识别的 AI Seat；本地热座、本机联机和局域网入口已删除。
含 **PIN 账号体系**、**💵 商城**、**三语言 i18n**（zh-CN / en-US / uk-UA）、
**Settings 设置页**（主题 + 语言 + 联机服务配置）。

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
│   │   ├── games/       # 6 款游戏（本地 + 人机 scheduleAI）
│   │   ├── online/      # WebSocket 客户端（03-websocket）
│   │   ├── shop/        # 04-auth / 05-profile / 06-shop
│   │   └── ui/          # 07-roster（档案/排行榜/结算）
│   ├── locales/         # i18n 翻译文件（zh-CN / en-US / uk-UA）
│   └── assets/          # 品牌、Avatar v2、Premium Background、Vendor Icon、游戏美术与 manifest；必须保留程序化 fallback
├── server/index.js      # 零依赖 Node 服务：静态文件 + 手写 WebSocket(/ws) + /api/ai + Supabase
├── server/reward-engine.js # Economy & Progression v1.0 唯一奖励配置、等级曲线与纯计算层
├── scripts/             # 运维脚本
│   ├── render-status.js # 只读查看服务/部署状态
│   ├── render-env.js    # 写 Render 环境变量
│   ├── render-deploy.js # 手动触发 Render 部署
│   ├── supabase-status.js # 检查 Supabase 连通性与迁移字段
│   └── ws-live-test.js  # 线上 WebSocket 冒烟
├── qa/                  # 测试
│   ├── dom-smoke.js      # 前端冒烟
│   ├── ai-games.js       # 6 款 AI 合法选择、回退与状态机回归
│   ├── reward-system.js  # Reward Config、等级曲线、防刷与三模式奖励回归
│   ├── e2e-online.js     # 端到端联机
│   ├── security-online.js # 鉴权/商城/结算/AI 安全回归
│   ├── reconnect-online.js # 断线重连与超时回归
│   ├── room-seats.js     # Seat v2 / READY / AI controller / 观战 / 身份结算
│   ├── social-graph.js   # Friend / Block / Report / Presence Privacy
│   ├── asset-manifest-v2.js # Premium Background 预算、路径与动态策略
│   ├── icon-system.js    # Vendor SVG、许可证、白名单与 a11y
│   ├── supabase-schema.js # 9 表、RLS 与原子 RPC 静态回归
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
node qa/dom-smoke.js            # 前端冒烟
node qa/ai-games.js             # 6 款人机状态机
node qa/reward-system.js        # 奖励与成长纯服务端回归
node qa/asset-manifest-v2.js    # Premium Background 资源与性能预算
node qa/icon-system.js          # 统一 SVG 图标系统
node --experimental-websocket qa/room-seats.js # Seat/READY/AI/观战/房主转移
node --experimental-websocket qa/social-graph.js # 好友/屏蔽/举报/隐私
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
- 服务端权威维护统一 Seat、READY、公开/私密、观战者、AI 托管者和结算身份；回合制游戏仍中继受信 Seat 走子，坦克/俄罗斯方块使用专项服务端权威层。
- 连接必须先用服务端签发的 session token 鉴权；uid 本身不是凭证。
- 对局开始时服务端下发一次性 `matchId`，保留有限 `moveLog`；异常掉线进入重连窗口，显式离开仍立即释放席位。
- 服务端在实时广播和 `moveLog` 中附带可信 `player`；客户端只接受当前行动者的输入，大富翁提前结算另由服务端限制为房主。
- 任一真人离房都会结束当前局并压紧席位；有其他真人时房主转移并更新全部 AI `controllerUid`，只有最后一名真人离开才关闭房间。
- `peer_left.payload.roomClosed` 明确区分房间是否关闭：`true` 为房主关闭房间，`false` 为房间保留、仅结束当前对局。
- 消息类型见 README「消息协议」表；新消息在 `server/index.js handleMessage` 和
  `public/index.html online.onMessage` 两处成对添加。
- 房主权限：选游戏、增删 AI、房间公开性、观战权限、开始、结束本局、新一局；非房主请求由服务端拒绝或忽略。
- 观战者使用独立 `spectatorRoom`，不占 Seat，不能发送房间 move/result。

### 人数规则
- 房间容量 2-5（建房时选）。
- **按 active Seat 数开局**：房间不满也能开始，但所有真人必须在线且 READY。
- `server/index.js joinRoom` 从统一 Seat 表分配空席；席位压紧后通过 `player_reassigned` 同步索引。
- 前端 `startOnlineGame(id, sizeOverride)` 用 `online.roomInfo.size` 决定 `playerCount`，不能写死成 2。

### 结算与排行榜
- 所有正式奖励由 `server/reward-engine.js` 的统一 Reward Resolver 决定；客户端和六款游戏只提交结果/展示明细，不能直接修改金币、XP、等级、连胜或胜场。
- 联机 1v1 胜/平/负为 `3/2/1💵` 与 `12/10/8 XP`；3–5 人按第 1/2/3/其他名次为 `4/3/2/1💵` 与 `14/12/10/8 XP`。
- AI 胜/平/负为 `1/0/0💵` 与 `8/6/5 XP`，服务端票据绑定对局且每日最终货币（含等级里程碑）最多产生 `3💵`；无服务端票据的内部规则运行不进入正式成长。
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
- `💵`、XP、未来 Rank/MMR 必须完全分离；混合房的 AI Seat 不得拥有奖励账号身份。
- 调整数值或资格阈值时必须同步 `qa/reward-system.js`、安全回归和联机 E2E。

### 人机对战（DeepSeek AI）
- 6 款游戏各自的 `scheduleAI()` 都把局面和规范化合法选项交给 `aiChoose()`；模型返回值只有与选项原文完全匹配时才会执行，游戏自身的落子函数还会再次校验。
- 客户端约 2.2 秒硬超时，服务端 DeepSeek 上游共享约 5 秒截止时间；无 token、无 Key、限流、断网、超时或非法响应都会静默使用原有 minimax / 启发式 / 贪心 fallback。
- 异步响应绑定局次、回合、阶段与局面；重开或离开游戏后旧响应会被废弃。`qa/ai-games.js` 用本地模型桩覆盖全部 6 款游戏，不需要真实 Key。
- DeepSeek Key 只存在服务端环境变量，绝不能写进前端或仓库。

### 账号与 PIN
- 首次进入弹「创建账号」：昵称、头像、背景、PIN（4-20 位仅字母数字）。
- 同设备自动登录（deviceFingerprint）；换设备用 PIN 登录。
- PIN 服务端使用版本化慢哈希兼容迁移，登录有失败退避；客户端注册/登录成功后只保存会话 token，不再持久化 PIN。
- session token 默认有效 30 天（`AUTH_TOKEN_TTL_MS` 可调整）；每个账号最多保留最近 5 个有效 token，超过上限淘汰最旧 token，`logout` 只撤销当前 token。
- 服务端消息：register / login / hello / profile_get / profile / purchase / result / logout。

### Social Graph v1
- 权威协议：`requirements/SOCIAL_GRAPH_V1_PROTOCOL.md`；关系只由服务端的 `friend_requests` / `friendships` / `blocks` / `reports` 维护，客户端不能自报。
- 请求支持发送、重复幂等、接受、忽略、发送方取消、移除；Block 会解除既有关系，并阻止好友请求、房间邀请、公开房发现和按码直加入。
- Report 只创建 Moderation Intake，不自动处罚；原因固定、限频，保存最小上下文和过滤后的目标显示快照。
- Presence 由服务端根据连接、房间状态和 `presencePreference` / `presenceVisibility` 生成；隐身用户对普通用户必须显示离线 / 不可加入，不能从排行榜或其他公开接口旁路泄露。
- 大厅 Social Rail 固定为 Friends / Online / Recent；Incoming Request 必须显示接受/忽略，好友/成员菜单必须保留 Block / Report。
- 改社交协议时同步 `server/index.js`、`public/src/online/03-websocket.js`、`supabase/schema.sql`、`qa/social-graph.js` 与 README 消息表。

### 安全边界
- `owned`、金币、XP、等级、连胜、胜场、局数、成就等权威字段不可由客户端 profile 消息写入；商城价格与扣款在服务端完成。
- `/api/ai` 要求 Bearer token，并限制 Origin、请求体、并发和速率。
- 现有中继仍不做完整规则权威模拟；双方恶意串通仍可能提交一致的伪造走法，这是产品取舍，不把客户端签名误认为防作弊。

### 国际化 (i18n)
- `public/locales/` 含三个翻译文件：zh-CN.json / en-US.json / uk-UA.json。
- 前端 i18n 框架：`t(key)` 翻译、`setLanguage(lang)` 切换、`applyI18n()` 扫描 DOM。
- 语言存储在 localStorage `mg_lang`，同步到服务端 profile.lang。
- 语言旗帜在昵称旁、排行榜、玩家列表等 6 处实时显示。
- 新 UI 文本禁止硬编码：用 `data-i18n` 属性或 `t()` 调用。

### Settings 设置页
- 入口：Header ⚙️ 按钮 → `openSettingsPage()`。
- 功能：主题切换（白天/黑夜）、语言切换（三选一）、联机服务地址配置。
- 主题独立快捷切换：Header 🌙/☀️ 按钮。

### UI
- 主题：`light/midnight/ocean/forest/cyber/sakura` 六个运行时 ID；旧 `dark` 只做兼容映射（localStorage `mg_theme`）。
- 大厅为双栏布局；毛玻璃 + backdrop-filter；3D 骰子；开局倒计时。
- 房间内切换游戏：`end_game` 消息 → `finishRoomGame()`。
- Premium Background 固定 ID `20–31`：六主题各一静态/一动态，商城价 24/32💵；动态只允许一个可见 Profile 或明确商城预览播放，并在离屏、页面隐藏、减少动态或加载失败时回退静态。
- 平台操作统一使用 `public/src/core/06-assets.js` 的 `icon(name,size,label?)` 和 `public/assets/icons/ui/` Vendor SVG；游戏娱乐 Emoji 可保留，icon-only 按钮必须提供 `aria-label`。
- Featured Showcase 只允许一个槽位且纯展示；Collection v1 提供 Metadata、Progress 与 Avatar + Frame + Background + Name FX 整套 Try-On。Try-On 不得调用购买或装备；Bundle 购买尚未实现。
- 旧头像 `0–55`：read=yes、new registration=no、new purchase=no、historical owned equip=yes；不得在缺少迁移路径和 active-usage≈0 前删除。

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
$env:SUPABASE_URL='https://xxx.supabase.co'   # 可选
$env:SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' # 可选；必须是仅服务端保存的 service_role secret
node scripts/render-env.js
```

Supabase 首次接入或升级时，在 SQL Editor 执行可重复迁移的 `supabase/schema.sql`，再运行 `node scripts/supabase-status.js`。Schema 已对 5 张经济/档案表和 4 张 Social Graph 表共 9 张表启用 RLS 且不开放 anon/authenticated policy，`profiles` 含 `wins/total_wins`、`solo_rate`、首胜、AI 日上限和 XP 曲线版本字段，并创建 `apply_reward_v1` / `apply_purchase_v1` 原子 RPC，因此服务端必须使用 `service_role` key；不要使用 anon/publishable key，也绝不能把 service-role secret 交给浏览器。没有真实凭证时可运行 `qa/supabase-schema.js` 与 `qa/supabase-adapter.js` 做本地定义、映射与幂等回归，但它们不能替代真实 Staging SQL、事务并发、JSON 迁移、连通性、RLS 和备份/恢复验收。

### 凭证
- 所有 token/Key 只存环境变量，绝不写入仓库。
- Render 运维脚本只输出筛选后的状态，不回显 API 原始响应或环境变量值；失败会返回非零退出码。
- 本机 Node v20 需 `--experimental-websocket`；Node 22+ 可直接跑。

## 7. 当前状态

✅ 已完成：
- 6 款精选游戏两模式（人机 / 联机）；本地热座、本机联机和局域网入口已删除
- 联机大厅 / 邀请 / 在线状态 / 排行榜 / Social Graph v1
- PIN 账号体系、💵 商城（头像 / 相框 / 特效 / 背景）
- 三语言 i18n + Settings 设置页 + 语言旗帜
- 毛玻璃 UI、3D 骰子、开局倒计时、双栏大厅
- CI：GitHub Pages 自动构建 + 冒烟 + 部署

✅ 已完成（本轮）：
- UI/UX 产品级升级：Design System（间距/字号/色彩令牌）、6 套主题、Hero 首屏、卡片入场/按钮光效/胜负彩带/WebAudio 轻音效
- 个性化系统：动态头像框（8 款）、闪名（4 种特效）、动态档案背景（4 款）、等级进度条
- v2.5 产品级打磨：补齐 Motion/Elevation/Icon/Glass 设计令牌与组件规范；统一动效库（转场/入场/弹性/Loading）
- Game Feel：6 款游戏全量接入分级操作反馈（落子/移动/掷骰/射击/放置 → 音效+震动+状态提示），AI 思考中提示
- Visual Polish + a11y：棋盘棋子渐变立体质感、侧栏 sticky、排行榜前三高亮、焦点环/44px 触控目标/最小字号 11px/prefers-reduced-motion
- 前端冒烟 ALL_PASS + 6 款 AI 状态机 ALL_PASS + 联机 E2E ALL_PASS + WS 主动断开测试通过
- 安全回归（鉴权/档案/结算/商城/AI）和断线重连回归均 ALL_PASS；生成产物由 CI 构建后校验与源码同步
- Economy & Progression v1.0：统一服务端 Reward Resolver、AI 票据/日上限、有效局/AFK/秒投拦截、首胜、连胜、重复对手衰减、等级曲线、完整奖励/经济流水与 Reward Breakdown UI
- 独立胜场 `wins/totalWins`、旧等级不降级迁移、Supabase `apply_reward_v1` 单事务落库与失败 outbox 重试
- P0 美术双纵切：五子棋与俄罗斯方块封面/底材已接入；Canvas/DOM 规则层不变，支持 `mg_art_gomoku_v1` / `mg_art_tetris_v1` 独立回滚
- Playroom Seat v1：双模式大厅、READY、公开/私密、快速加入、真人房 AI Seat、观战、AI controllerUid、混合房结算和断线房主转移
- Avatar v2：六主题 48 款原创头像、12 款注册免费资产、动态 Poster 策略、商城试用、Profile / Mini Profile 与身份字段
- Social Graph v1：好友请求全生命周期、屏蔽/举报、Presence Privacy、Supabase 4 表与 Social Rail
- Premium Background Pack v1：六主题 12 款（ID 20–31）、静态/动态响应式资源、预算、回退、Collection Progress 和整套 Try-On
- Platform Icon System v1：32 个 Lucide Vendor SVG、统一组件、许可证、白名单与 a11y
- Featured Showcase 单槽、旧头像 active-usage 遥测，以及 1440/1024/768/390/360 浏览器视觉证据
- 美术母图与 Prompt 位于 `art-source/`，运行时 WebP 位于 `public/assets/`，manifest 与 DOM 冒烟校验路径、ID 和 fallback

⏳ 待办：
1. 使用真实 Supabase Staging 完成 SQL/RLS/并发、JSON 迁移、备份与恢复演练（凭证待提供）
2. Social Communication（聊天）
3. 锦标赛模式、文字/社交游戏
4. 平台扩展（微信小程序 / App / 桌面版）

## 8. 项目历程

- 初版：2-5 人小游戏网页版 → 5 款游戏本地热座。
- 联机版：WS 房间/大厅/邀请、金币、排行榜、像素头像。
- 增强版：人机 AI、黑夜主题、毛玻璃、3D 骰子、倒计时、房间内切游戏。
- 聚焦版：保留 6 款可持续深化的游戏，删除低可玩性条目；接入品牌/现金 SVG、asset manifest 与程序化 fallback。
- v2.0：i18n 三语言、Settings 设置页、语言旗帜。
- v3.2：彻底移除热座入口；落地 Seat v2、真人房 AI、READY、观战、公开/私密、Social Graph、Premium Background 与统一平台图标。
- 部署：GitHub Pages（前端）+ Render（后端）。

## 9. 给新 Codex 窗口的操作建议

- 先读本文件 + `README.md` + `server/index.js` 的 handleMessage + `public/index.html` 的
  `online` 对象与 `games` 注册表，再动手。
- 改前端后跑 `node qa/dom-smoke.js`；改联机逻辑后跑 `node --experimental-websocket qa/e2e-online.js`。
- e2e 用例顺序敏感、对状态文案有断言，改文案时同步更新断言。
- 零 npm 依赖、零打包器；新消息在服务端与前端成对添加；不破坏旧协议与数据。

## 10. 中文简易改动日志（必须维护）

- 仓库根目录固定维护 `LOG-新增.md`、`LOG-修改.md`、`LOG-删除.md`。
- 每次有项目改动时，在全部实现与验证完成后、结束任务前更新这三份文件。
- 格式统一为 `日期 时间｜内容`，使用本地时间；内容保持简短、明确。
- 某一类别本次没有内容时，也在对应日志记录“本次无新增 / 无修改 / 无删除”，避免遗漏审计。
