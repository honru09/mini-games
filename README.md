# Mini Games Platform 🎮

> 多人游戏平台 — 11 款插件化游戏，先看到人，再看到游戏。
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
- 🎬 **动效 + 手感**：统一 Motion 动效库（转场/入场/弹性/Loading）、11 款游戏全量操作反馈（音效+震动+状态提示）、棋盘棋子立体质感
- ✨ **个性化**：动态头像框（8 款含流光/烈焰/彩虹/赛博脉冲）、闪名（4 种特效）、动态档案背景（星空/樱花/赛博矩阵/海浪）、等级进度条
- 🔑 **PIN 账号**：设备识别 + 换机登录，账号永不丢失
- 🛍️ **$ 商城**：头像 / 头像框 / 动态特效 / 个人背景（56 款头像，4 大主题分类）
- 🎭 **AI 角色化**：5 个性格各异的 AI 对手，会说话、会失误、会嘴硬
- 🏆 **全球排行榜**：$ 金币 + 各游戏局数统计

## 11 款游戏

| 游戏 | 人数 | 联机 | 人机 AI |
|---|---|---|---|
| 井字棋 ⭕ | 2 | ✅ | ✅ minimax 永胜 |
| 五子棋 ⚫ | 2 | ✅ | ✅ 启发式 |
| 飞行棋 ✈️ | 2-4 | ✅ | ✅ 启发式 |
| 迷你大富翁 🏙️ | 2-5 | ✅ | ✅ 启发式 |
| 弹珠跳棋 🔮 | 2-5 | ✅ | ✅ 启发式 |
| 坦克大战 🛡️ | 2 | ✅ | ✅ 贪心 |
| 贪吃蛇 🐍 | 2-4 | ✅ | ✅ 贪心 |
| 俄罗斯方块 🧱 | 2-4 | ✅ | ✅ 最佳放置 |
| 国际跳棋 ⚪ | 2 | ✅ | ✅ 启发式 |
| 斗兽棋 🐘 | 2 | ✅ | ✅ 贪心 |
| 象棋 ♞ | 2 | ✅ | ✅ 启发式 |

## 三种玩法

- **👥 本地热座**：2-5 人共用一台设备
- **🤖 人机对战**：11 款游戏都以规范化合法选项接入 DeepSeek，并保留本地 AI 快速回退，单人且断网也能玩（可选 5 个 AI 角色：傲娇 / 赌狗 / 毒舌 / 萌妹 / 数学老师）
- **🌐 联机对战**：房间中继 + 大厅 + 邀请 + 排行榜

## 快速上手

```bash
# 克隆
git clone https://github.com/honru09/mini-games.git
cd mini-games

# 运行（零依赖）
node server/index.js
# → http://localhost:8080

# 测试（Node 20 需要 --experimental-websocket）
node scripts/build.js
node qa/dom-smoke.js
node qa/ai-games.js
node --experimental-websocket qa/security-online.js
node --experimental-websocket qa/reconnect-online.js
node --experimental-websocket qa/supabase-adapter.js
node --experimental-websocket qa/e2e-online.js
node --experimental-websocket qa/ws-close-test.js
```

## 联机玩法

1. 房主在大厅选好人数，点「创建房间」→ 选游戏 → 等待
2. 房间出现在所有人的游戏大厅，点击「加入」即可
3. 也可在玩家列表邀请在线玩家
4. 人齐自动开局，或房主手动开始

## 消息协议

WebSocket 端点 `/ws`，所有消息为 JSON：

| 方向 | 消息 | 说明 |
|---|---|---|
| C→S | `hello` | 使用 uid + 服务端会话 token 鉴权；异常断线后尝试恢复房间 |
| C→S | `register` / `login` / `logout` | 创建 PIN 账号、登录、撤销当前会话 token |
| C→S | `profile_get` / `profile` | 查询档案；仅修改 name/lang 与本人已拥有的外观装备，不能写金币、owned、XP、局数等权威字段 |
| C→S | `create` / `join` / `leave` | 创建、加入、主动离开房间 |
| C→S | `invite` / `invite_accept` / `invite_decline` | 邀请及应答 |
| C→S | `select_game` | 房主选游戏 |
| C→S | `start` | 房主开始 |
| C→S | `move` | 走子（服务端记录有限 moveLog，并附带可信发送者 `player` 广播给其他参与者） |
| C→S | `restart` / `end_game` | 房主发起新一局或结束本局 |
| C→S | `result` | 联机携带 `matchId` 与完整结果 claim，所有参与者一致后才结算；单机使用唯一 `resultId` 并受去重/频控保护 |
| C→S | `purchase` | 服务端按商品目录和余额原子购买（requestId 幂等） |
| S→C | `hello_ack` / `registered` / `logged_in` / `logged_out` / `auth_error` | 认证状态与服务端签发 token |
| S→C | `lobby` | 等待中房间列表 |
| S→C | `created` / `joined` / `room_update` / `started` | 加房结果、房间实时状态和开局信息（含 `matchId`） |
| S→C | `player_reassigned` | 有成员离房并压紧席位后，通知仍在房间中的客户端更新玩家索引 |
| S→C | `restart` / `end_game` | 房主操作广播：以新 `matchId` 重开，或结束本局回到选游戏状态 |
| S→C | `leaderboard` | 全球排行榜 |
| S→C | `invite` | 收到邀请 |
| S→C | `peer_left` | 成员主动离开；`payload.roomClosed=true` 表示房主已关闭房间，`false` 表示房间保留且当前对局结束 |
| S→C | `peer_status` / `rejoined` / `reconnect_expired` / `resume_expired` / `host_changed` | 掉线等待、令牌重连、moveLog 恢复、超时释放与房主转移 |
| S→C | `result_pending` / `result_ok` / `result_error` | 结算共识状态 |
| S→C | `profile_data` / `profile_ok` / `purchase_ok` / `purchase_error` | 档案与购买结果 |

服务端签发的会话 token 默认有效 30 天（可通过 `AUTH_TOKEN_TTL_MS` 调整）；每个账号最多保留最近 5 个有效 token，通常对应 5 台设备或浏览器。新会话超过上限时会淘汰最旧 token，`logout` 只撤销当前 token。

## 部署

### 前端（GitHub Pages）
推 `main` 自动触发 `.github/workflows/pages.yml` 构建部署。

### 后端（Render）
```powershell
$env:RENDER_KEY='rnd_xxx'
node scripts/render-deploy.js
```

后端也支持 `DATA_DIR`（测试或持久磁盘路径）和 `ALLOWED_ORIGINS`。`POST /api/ai` 要求已认证账号的 Bearer token，并带 Origin、请求体大小、并发和速率限制。11 款游戏只把合法选项交给模型，客户端约 2.2 秒超时且会再次精确校验返回值；无 Key、断网、限流或非法响应会立即使用本地算法。生产环境不要把 DeepSeek key 放到前端。

### 数据库（Supabase）
`supabase/schema.sql` 可重复执行建表/迁移，并为 `profiles`、`history` 启用 RLS；没有面向 `anon`/`authenticated` 的访问策略，浏览器不能直连这些表。

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 将项目 URL 写入 `SUPABASE_URL`，将 **secret `service_role` key** 写入 Render 的 `SUPABASE_KEY`。不要使用 `anon`/publishable key；也绝不能把 service-role secret 放到前端、日志或仓库。
3. 用同一组服务端凭证运行 `node scripts/supabase-status.js`，检查 REST 连通性及 `auth_tokens`、`recent_results`、`purchase_requests`、`solo_rate`、`daily_key`、history 审计字段。

`history` 是结算流水：联机对局按每位参与者各写一行（同一 `match_id` 可有多行），单机对局写一行；`result_id` 用于幂等去重，并非“一局全房间只写一行”。

`profiles.solo_rate` 保存服务端维护的单机/人机结算频控时间戳，不属于客户端可写档案字段。没有真实 Supabase 凭证时，可运行 `node --experimental-websocket qa/supabase-adapter.js`，用本地 fake PostgREST 验证字段映射、写入顺序和空库迁移行为；它不能替代真实项目的连通性与 RLS 验收。

## 开发原则

- **零 npm 依赖** — 手写 WebSocket，纯 Node 测试
- **单文件前端** — `public/index.html` 含全部 HTML/CSS/JS
- **新消息成对添加** — `server/index.js` handleMessage ↔ `online.onMessage`
- **不破坏旧协议** — 所有更新兼容已有用户数据
- **无打包器** — 不用 webpack/vite/rollup
