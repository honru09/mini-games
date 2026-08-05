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
- ⚙️ **Settings 设置页**：主题（白天/黑夜）、语言、联机地址
- 🔑 **PIN 账号**：设备识别 + 换机登录，账号永不丢失
- 🛍️ **$ 商城**：头像 / 头像框 / 动态特效 / 个人背景
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
- **🤖 人机对战**：DeepSeek AI 对手，单人也能玩
- **🌐 联机对战**：房间中继 + 大厅 + 邀请 + 排行榜

## 快速上手

```bash
# 克隆
git clone https://github.com/honru09/mini-games.git
cd mini-games

# 运行（零依赖）
node server/index.js
# → http://localhost:8080

# 测试
node qa/dom-smoke.js
node --experimental-websocket qa/e2e-online.js
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
| C→S | `hello` | 声明当前档案 uid |
| C→S | `register` | 创建 PIN 账号 |
| C→S | `login` | PIN 登录 |
| C→S | `profile` | 同步档案（含 lang 语言字段） |
| C→S | `create` | 创建房间 |
| C→S | `join` | 加入房间 |
| C→S | `invite` | 邀请玩家 |
| C→S | `select_game` | 房主选游戏 |
| C→S | `start` | 房主开始 |
| C→S | `move` | 走子（服务端广播给另一方） |
| C→S | `result` | 上报对局结果 |
| C→S | `end_game` | 结束本局（切换游戏） |
| S→C | `lobby` | 等待中房间列表 |
| S→C | `room_update` | 房间实时状态 |
| S→C | `leaderboard` | 全球排行榜 |
| S→C | `invite` | 收到邀请 |
| S→C | `peer_left` | 对方离开 |

## 部署

### 前端（GitHub Pages）
推 `main` 自动触发 `.github/workflows/pages.yml` 构建部署。

### 后端（Render）
```powershell
$env:RENDER_KEY='rnd_xxx'
node scripts/render-deploy.js
```

### 数据库（Supabase）
`supabase/schema.sql` 建表，配置环境变量后 Render 自动连接。

## 开发原则

- **零 npm 依赖** — 手写 WebSocket，纯 Node 测试
- **单文件前端** — `public/index.html` 含全部 HTML/CSS/JS
- **新消息成对添加** — `server/index.js` handleMessage ↔ `online.onMessage`
- **不破坏旧协议** — 所有更新兼容已有用户数据
- **无打包器** — 不用 webpack/vite/rollup