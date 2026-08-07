# Mini Games Platform 🎮

> 多人游戏平台 — 6 款精选插件化游戏，先看到人，再看到游戏。
> 打开 3 秒开局 → 5 分钟一局 → 立刻再来。

线上试玩：https://honru09.github.io/mini-games/
后端地址：https://mini-games-online.onrender.com

---

## 平台特色

- 🎯 **Fast Fun Loop**：3 秒入局，5 分钟一局，即开即玩
- 🌐 **三语国际化**：中文 / English / Українська，Settings 一键切换
- 🏳️ **语言旗帜**：个人档案、排行榜、房间大厅实时显示
- ⚙️ **Settings 设置页**：6 套主题（日光/午夜/海洋/森林/赛博/樱花）、三语言、联机地址
- 🎨 **Design System**：统一间距（4px 刻度）/ 字号 / 色彩令牌，卡片入场动画、按钮光效、胜负彩带、WebAudio 轻音效（零资源）
- 🎬 **动效 + 手感**：统一 Motion 动效库（转场/入场/弹性/Loading）、6 款游戏全量操作反馈（音效+震动+状态提示）、棋盘棋子立体质感
- ✨ **个性化**：六主题 48 款原创头像、12 款 Premium Background、动态头像框、闪名、Featured Showcase、Profile / Mini Profile 与等级进度条
- 🔑 **PIN 账号**：设备识别 + 换机登录，账号永不丢失
- 🛍️ **💵 商城**：头像 / 动态头像 / 头像框 / 名称效果 / 个人背景，支持六主题筛选、单品试用、Collection Progress、整套 Try-On、购买和装备
- 🪑 **统一 Seat 房间**：真人 / AI / 空席、HOST、READY、公开 / 私密、快速加入、观战与断线接管
- 🤝 **Social Graph v1**：好友请求、接受/忽略/取消、移除、屏蔽、举报、在线隐私与最近一起玩
- 🧩 **统一平台图标**：32 个 Vendor SVG 通过 `icon(name, size, label?)` 调用，保留许可证、文字回退与 aria-label
- 🎭 **AI 角色化**：5 个性格各异的 AI 对手，会说话、会失误、会嘴硬
- 🏆 **全球排行榜**：💵 虚拟现金 + 各游戏局数统计

## 6 款精选游戏

| 游戏 | 人数 | 联机 | 人机 AI |
|---|---|---|---|
| 五子棋 ⚫ | 2 | ✅ | ✅ 启发式 |
| 飞行棋 ✈️ | 2-4 | ✅ | ✅ 启发式 |
| 迷你大富翁 🏙️ | 2-5 | ✅ | ✅ 启发式 |
| 坦克大战 🛡️ | 2 | ✅ | ✅ 贪心 |
| 俄罗斯方块 🧱 | 2-4 | ✅ | ✅ 最佳放置 |
| 象棋 ♞ | 2 | ✅ | ✅ 启发式 |

## 两种玩法

- **🤖 人机对战**：按具体游戏选择 AI 数量；6 款游戏均使用合法选项约束与本地策略回退
- **🌐 联机对战**：公开 / 私密房、快速加入、邀请、READY、观战，以及真人与 AI 共用的真实 Seat 协议

本地热座、本机联机和局域网联机入口已经移除；人数只在具体游戏的人机设置或 Room Setup 中选择。

## 快速上手

```bash
# 克隆
git clone https://github.com/honru09/mini-games.git
cd mini-games

# 运行（零依赖）
node server/index.js
# → http://localhost:8080

# 全量测试（Node 20 的脚本已自带 --experimental-websocket）
npm test

# 可选专项
node qa/asset-manifest-v2.js
node qa/icon-system.js
node --experimental-websocket qa/social-graph.js
```

## 联机玩法

1. 选择快速加入，或在 Room Setup 创建公开 / 私密房并设置容量与观战权限
2. 房主选游戏，可把空席设为等待真人或添加带难度 / Persona 的 AI Seat
3. 真人成员点击 READY；所有真人在线且 READY 后，由房主显式开始
4. 游戏中可按房间权限观战；异常掉线保留 Seat，超时后转移房主和 AI 托管权

## 消息协议

WebSocket 端点 `/ws`，所有消息为 JSON：

| 方向 | 消息 | 说明 |
|---|---|---|
| C→S | `hello` | 使用 uid + 服务端会话 token 鉴权；异常断线后尝试恢复房间 |
| C→S | `register` / `login` / `logout` | 创建 PIN 账号、登录、撤销当前会话 token |
| C→S | `profile_get` / `profile` | 查询档案；仅修改 name/lang 与本人已拥有的外观装备，不能写金币、owned、XP、胜场、局数等权威字段 |
| C→S | `create` / `join` / `quick_join` / `leave` | 创建公开/私密房、按码加入、快速加入与主动离房 |
| C→S | `ready` / `room_settings` | 真人 READY；房主修改公开性和观战权限 |
| C→S | `add_ai` / `remove_ai` | 房主添加或移除真实 AI Seat |
| C→S | `spectate` / `leave_spectator` | 进入 / 离开只读观战身份 |
| C→S | `invite` / `invite_accept` / `invite_decline` | 邀请及应答 |
| C→S | `social_get` / `friend_request` / `friend_request_action` / `friend_remove` | 读取本人 Social Graph；发送、接受/忽略/取消请求与移除好友 |
| C→S | `block` / `unblock` / `report` | 屏蔽/解除屏蔽；举报固定原因与最小房间/档案上下文 |
| C→S | `select_game` | 房主选游戏 |
| C→S | `start` | 房主开始 |
| C→S | `move` | 走子（服务端记录有限 moveLog，并附带可信发送者 `player` 广播给其他参与者） |
| C→S | `bot_move` / `bot_tank_input` / `bot_tetris_*` | 仅当前 AI `controllerUid` 可提交；服务端以 AI Seat 身份广播或校验 |
| C→S | `restart` / `end_game` | 房主发起新一局或结束本局 |
| C→S | `solo_start` / `solo_progress` | 已认证人机对局获取服务端票据，并上报由合法游戏动作产生的有效进度 |
| C→S | `result` | 联机携带 `matchId` 与完整结果 claim，所有参与者一致后才结算；人机携带服务端签发的 `matchId/resultId` 与胜平负 |
| C→S | `purchase` | 服务端按商品目录和余额原子购买（requestId 幂等） |
| S→C | `hello_ack` / `registered` / `logged_in` / `logged_out` / `auth_error` | 认证状态与服务端签发 token |
| S→C | `lobby` | 公开房列表，含真人/AI/空席、READY、状态与观战能力 |
| S→C | `created` / `joined` / `room_update` / `started` | 加房结果、完整 Seat 状态和开局信息（含 `matchId`） |
| S→C | `spectating` / `spectator_left` | 观战身份建立或解除 |
| S→C | `player_reassigned` | 有成员离房并压紧席位后，通知仍在房间中的客户端更新玩家索引 |
| S→C | `restart` / `end_game` | 房主操作广播：以新 `matchId` 重开，或结束本局回到选游戏状态 |
| S→C | `leaderboard` | 全球排行榜 |
| S→C | `invite` | 收到邀请 |
| S→C | `social_state` / `social_ok` / `social_error` | 本人的好友/请求/屏蔽状态、幂等成功或安全拒绝；关系数据不接受客户端自报 |
| S→C | `peer_left` | 成员离开；只要仍有真人就保留房间并转移房主，最后一名真人离开才 `roomClosed=true` |
| S→C | `peer_status` / `rejoined` / `reconnect_expired` / `resume_expired` / `host_changed` | 掉线等待、令牌重连、moveLog 恢复、超时释放与房主转移 |
| S→C | `solo_started` | 下发人机对局的服务端 `matchId/resultId` 票据 |
| S→C | `result_pending` / `result_ok` / `result_error` | 结算共识状态；`result_ok.payload.reward` 含当前玩家完整 Reward Breakdown |
| S→C | `profile_data` / `profile_ok` / `purchase_ok` / `purchase_error` | 档案与购买结果 |

服务端签发的会话 token 默认有效 30 天（可通过 `AUTH_TOKEN_TTL_MS` 调整）；每个账号最多保留最近 5 个有效 token，通常对应 5 台设备或浏览器。新会话超过上限时会淘汰最旧 token，`logout` 只撤销当前 token。

### Social Graph 与隐私

- 好友请求支持重复幂等、接受、忽略、发送方取消和移除；Block 会解除既有关系并阻止请求、邀请、公开房发现和按码直加入。
- Report 只创建 Moderation Intake，不自动处罚；服务端保存固定原因、目标显示快照及最小上下文，并过滤 HTML、控制字符与超长文本。
- Presence 由服务端生成；设置为 invisible 的用户对普通用户统一显示为离线 / 不可加入，排行榜和社交接口遵循同一隐私规则。
- 完整协议与安全边界见 `requirements/SOCIAL_GRAPH_V1_PROTOCOL.md`。

## 奖励与成长（Economy & Progression v1.0）

- 联机 1v1：胜/平/负为 `3/2/1💵` 与 `12/10/8 XP`。
- 3–5 人联机：第 1/2/3/其他名次为 `4/3/2/1💵` 与 `14/12/10/8 XP`。
- AI：胜/平/负为 `1/0/0💵` 与 `8/6/5 XP`，每账号每天通过 AI 触发的最终货币总额最多 `3💵`（含等级里程碑）；达到上限后仍得 XP。
- 无服务端票据的内部规则运行不能产生正式 `💵` 或 XP，也不能改写账号等级与连胜。
- 每日首次有效联机胜利额外 `+2💵/+5 XP`；3/5/8+ 连胜额外 `+2/+4/+6 XP`。
- 同一玩家组合 24 小时内第 11–20 局货币减半；第 21 局起货币为 0、XP 为 50%。
- 等级曲线：`XPNext(level)=min(200, 30+5×level)`；每跨越 5 级里程碑奖励 `5💵`。
- 胜场使用独立的 `wins`（按游戏）与 `totalWins`（总胜场）权威字段，只在有效正式胜利结算时增长，与 💵 余额完全解耦。

所有数值与有效局阈值集中在 `server/reward-engine.js`。服务端同时检查身份、票据/幂等、联机共识、持续时间、有效操作、唯一操作指纹和活跃参与者；AI 操作带不可重复 `actionId`，断线补发不会重复计入。秒投、无进度、过早取消、争议与 AFK 不获得正常奖励。客户端只展示服务端返回的奖励明细。

## 部署

### 前端（GitHub Pages）
推 `main` 自动触发 `.github/workflows/pages.yml` 构建部署。

### 后端（Render）
```powershell
$env:RENDER_KEY='rnd_xxx'
node scripts/render-deploy.js
```

后端也支持 `DATA_DIR`（测试或持久磁盘路径）和 `ALLOWED_ORIGINS`。`POST /api/ai` 要求已认证账号的 Bearer token，并带 Origin、请求体大小、并发和速率限制。6 款游戏只把合法选项交给模型，客户端约 2.2 秒超时且会再次精确校验返回值；无 Key、断网、限流或非法响应会立即使用本地算法。生产环境不要把 DeepSeek key 放到前端。

## 白皮书 × 美术资源运行时

- `public/assets/manifests/asset_manifest.json` 锁定 6 个游戏 runtime ID、平台 asset ID、状态、fallback 和 a11y 语义。
- 首批已接入 `public/assets/brand/` 品牌 SVG 与 `public/assets/ui/currency_cash.svg`；Header、Hero、商城、排行榜与结算统一显示 💵。
- `public/assets/avatars/v2/` 提供六主题 48 款头像；普通列表加载 64 Poster，Mini/Full Profile 与主动试用按需播放动态版本。
- `public/assets/backgrounds/v1/` 提供六主题 12 款 Premium Background，固定 ID `20–31`；每款包含 Desktop、Poster、Mobile、Mini、Animated/Static Fallback，动态只在可见 Profile 或明确商城预览播放。
- `public/assets/icons/ui/` Vendor 32 个 Lucide 1.27.0 SVG；来源、版本、ISC/MIT 许可证和包完整性均随仓库保留。
- P0 纵切已接入五子棋与俄罗斯方块响应式大厅封面、五子棋木纹 Canvas 底材、俄罗斯方块玻璃井底材，以及软 3D 棋子/七类纹理/ghost/locked/clear 绘制状态。
- 两款纵切可分别用 `mg_art_gomoku_v1`、`mg_art_tetris_v1` 本地 flag 回滚；关闭只影响绘制层，不改变规则、快照或联机协议。
- 所有美术资源保留 CSS / Canvas / DOM Emoji / WebAudio 回退，资源加载失败不能阻塞大厅或开局。

### 数据库（Supabase）
`supabase/schema.sql` 可重复执行建表/迁移，创建 `apply_reward_v1` / `apply_purchase_v1` 原子 RPC，并为 `profiles`、`history`、`reward_history`、`economy_ledger`、`analytics_events`、`friend_requests`、`friendships`、`blocks`、`reports` 共 9 张表启用 RLS；没有面向 `anon`/`authenticated` 的访问策略，浏览器不能直连这些表。

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 将项目 URL 写入 `SUPABASE_URL`，将 **secret `service_role` key** 写入 Render 的 `SUPABASE_SERVICE_ROLE_KEY`；旧 `SUPABASE_KEY` 仅保留兼容。不要使用 `anon`/publishable key，也绝不能把 service-role secret 放到前端、日志或仓库。
3. 用同一组服务端凭证运行 `node scripts/supabase-status.js`，检查 REST 连通性、9 张表、档案状态字段和 RPC。

`history` 是兼容结算流水：联机对局按每位参与者各写一行（同一 `match_id` 可有多行），AI 对局写一行；`result_id` 用于幂等去重。`reward_history` 保存资格、阻断原因、对手组合、基础与最终奖励、等级/连胜前后值和明细；`economy_ledger` 审计每次正式 💵 增减；`analytics_events` 保存比赛与奖励事件。

`profiles.wins` / `profiles.total_wins` 分别保存按游戏胜场和总胜场；服务端/API 对应 `wins` / `totalWins`，不得由余额推导胜场。正式奖励统一调用 `apply_reward_v1`：按账号加事务锁、以 `result_id` 幂等校验，并在同一事务中更新 `profiles`、写入 `history`、`reward_history` 和可选 `economy_ledger`；`analytics_events` 仍为独立埋点写入。

`profiles.solo_rate` 保存服务端维护的人机结算频控时间戳，首胜日期与 AI 日货币累计也只由服务端更新，均不属于客户端可写档案字段。正式奖励会先写入本地 outbox；Supabase 事务短暂失败后会以相同 `result_id` 自动重试，`applied` 或匹配 `resultId` 的 `duplicate` 都是成功终态。当前 Render 单实例且未挂载持久磁盘，outbox 只能覆盖进程存活期/正常重启场景，不能替代真实 Supabase；扩容多实例前还必须把 Reward Resolver 迁移为数据库内权威计算或增加版本冲突重算。没有真实 Supabase 凭证时，可运行 `node --experimental-websocket qa/supabase-adapter.js` 与 `node qa/supabase-schema.js` 验证本地映射、RPC 幂等和 RLS 定义；它们不能替代真实 Staging 的 SQL、事务并发、JSON 迁移、连通性与备份/恢复验收。

## 开发原则

- **零 npm 依赖** — 手写 WebSocket，纯 Node 测试
- **单文件前端** — `public/index.html` 含全部 HTML/CSS/JS
- **新消息成对添加** — `server/index.js` handleMessage ↔ `online.onMessage`
- **不破坏旧协议** — 所有更新兼容已有用户数据
- **无打包器** — 不用 webpack/vite/rollup
