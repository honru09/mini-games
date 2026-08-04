# AGENTS.md — 小游戏合集（在线版）项目上下文

> 本文件是给 Codex / 新协作者的项目说明书。新环境克隆本仓库后，Codex 会自动读取本文件；
> 也可以直接说「读一下 AGENTS.md 了解项目」。

## 1. 项目一句话

网页版多人小游戏合集：井字棋、五子棋、飞行棋、迷你大富翁、弹珠跳棋、
坦克大战、贪吃蛇、俄罗斯方块、国际跳棋、斗兽棋、象棋，共 11 款。
支持三种玩法：**本地热座**（2-5 人一台设备）、**人机对战**（DeepSeek AI 对手）、
**联机对战**（WebSocket 房间 + 游戏大厅 + 邀请 + 在线状态 + 全球排行榜）。
另含 **PIN 账号体系**（唯一账号、设备识别、换机登录）与 **$ 货币商城**
（头像 / 头像框 / 动态效果 / 背景）。

## 2. 线上地址与仓库

- 前端（GitHub Pages）：https://honru09.github.io/mini-games/
- 后端（Render，Node）：https://mini-games-online.onrender.com
- 仓库：https://github.com/honru09/mini-games（默认分支 `main`）
- 本地项目路径（旧机器）：`Documents/Codex/2026-08-04/ni-xi/outputs/mini-games-online`

## 3. 目录结构

```
mini-games-online/
├── AGENTS.md            # 本文件（新窗口/新机器的入口）
├── README.md            # 用户向说明：玩法、部署、消息协议
├── public/index.html    # 整个前端（单文件：HTML+CSS+JS，约 5000+ 行）
│                         # 包含：11 款游戏逻辑、联机客户端、AI 客户端、主题/UI、账号/商城
├── server/index.js      # 零依赖 Node 服务（约 600 行）
│                         # 静态文件 + 手写 WebSocket(/ws) + /api/ai DeepSeek 代理 + Supabase 可选持久化
├── scripts/             # 运维脚本（不进游戏逻辑）
│   ├── render-status.js # 查 Render 部署状态
│   ├── render-env.js    # 写 Render 环境变量（SUPABASE_URL/KEY、DEEPSEEK_KEY）
│   ├── render-deploy.js # 手动触发 Render 部署（API 建的服务无 webhook，推送后必须手动触发）
│   └── ws-live-test.js  # 线上 WebSocket 冒烟（2 人局 + 多人局 + 结束切游戏）
├── qa/                  # 测试（DOM 桩，无需真实浏览器）
│   ├── dom-smoke.js     # 前端冒烟：11 款游戏各人数初始化/结算/账号/人机
│   ├── e2e-online.js    # 端到端联机：真实 server + 多客户端，覆盖 2 人/3 人/4 人房间
│   └── ws-close-test.js # WS 断开最小复现（guest 断开 host 收到 peer_left）
├── supabase/schema.sql  # 数据库建表（profiles / history）+ 常用管理查询
├── render.yaml          # Render Blueprint（备用，实际服务已用 API 创建）
├── package.json         # 零依赖，scripts.start = node server/index.js
└── data/                # 本地 JSON 存储（.gitignore，接入 Supabase 前服务端回退用）
```

## 4. 快速开始

```bash
# 1) 本地跑全站（前端 + 联机后端一体）
node server/index.js            # 打开 http://localhost:8080

# 2) 测试（先装依赖？不需要，零依赖）
node qa/dom-smoke.js            # 前端冒烟，约 15 秒，预期 ALL_PASS
node --experimental-websocket qa/e2e-online.js   # Node 20 需此开关（Node 21+ 可直接跑）

# 3) 本地调试 AI（可选）
$env:DEEPSEEK_KEY='sk-...'      # Windows PowerShell
node server/index.js
```

浏览器实测技巧：开两个浏览器标签都访问 localhost:8080 即可模拟两人联机；
多人局创建 4 人房间后，可只进 3 人点「开始游戏」验证“不满人数开局”。

## 5. 架构与关键设计（改代码前必读）

### 联机
- 服务端是**房间中继**：客户端各自持有完整对局状态，`move` 消息只做广播；
  所以断线重连恢复对局等复杂逻辑不存在，设计上就不做。
- 消息类型见 README「消息协议」表；新消息在 `server/index.js handleMessage` 和
  `public/index.html online.onMessage` 两处成对添加。
- 房主权限：选游戏、开始、结束本局、新一局；非房主点这些按钮会被拦（toast 提示）。

### 人数规则（重要，曾被用户反馈过 bug）
- 房间容量 2-5（建房时选）。
- **按“当前已加入人数”开局**：房间不满也能开始，几个人就开几人的局。
- 选游戏只受人数上限约束（`GAME_MAX`：井字棋/五子棋 2，飞行棋 4，大富翁/弹珠 5）；
  开始才要求 ≥ 最低人数（都是 2）。
- `server/index.js joinRoom` 会为每个加入者分配**递增且不重复**的玩家索引（0,1,2…），
  切勿改回固定值，否则 3 人以上房间会错乱。
- 前端 `startOnlineGame(id, sizeOverride)` 用 `online.roomInfo.size` 决定 `playerCount`，
  不能写死成 2。

### 结算与排行榜
- 每局结束：胜利者 +1 **L 金币**（平局/失败 0），所有参与者各 +1 局（对应游戏 + 总局数）。
- 联机时每个客户端只上报自己的结果（`applyGameResult` 里 `r.slot === online.player` 过滤），
  服务端记账后广播新排行榜。
- 玩家档案：无账号密码，本地生成 uid（`u_xxxx`），昵称 + 20 个像素头像；
  前端 localStorage 存 roster，服务端按 uid 记账。
- 在线状态：10 秒心跳 / 40 秒超时判离线；`leaderboardPayload` 计算 `online` 字段。

### 人机对战（DeepSeek AI）
- 前端把**合法走法列表**和局面发给 `POST /api/ai`，服务端代理调 DeepSeek，
  返回 `{"choice":"..."}`；前端校验合法性，非法则随机合法走法兜底。
- 每个游戏在 `public/index.html` 里有自己的 `scheduleAI()`（井字棋/五子棋/飞行棋/大富翁/弹珠），
  用 `opts.ai`（Set<玩家索引>）判断当前回合是否 AI，并禁止人类点击 AI 座位。
- 骰子类游戏（飞行棋/大富翁）AI 掷骰是本地随机，AI API 只做“选子/买地”等决策。
- DeepSeek Key 只存在服务端环境变量 `DEEPSEEK_KEY`，绝不能写进前端或仓库。

### 账号与 PIN（重要）
- 本机不自动建档：首次进入会弹「创建账号」——填昵称、选头像/背景、设 PIN（4-20 位仅字母数字）。
- mg_account（localStorage）保存账号；deviceFingerprint() 用 UA/语言/屏幕/时区/平台生成设备指纹，
  同一设备刷新自动登录（不重建 uid）；换设备时用 PIN 登录（loginAccount），服务端按 pin_hash 校验唯一性。
- 服务端消息：register（PIN 唯一性校验）/ login / profile_get / profile（个人化字段）/ result（$ 结算）。
- 商城数据（owned / background / frame / effect / 头像 20-27）随 profile 同步到服务端。

### 货币与商城
- 币种显示为 $（内部字段仍叫 coins，胜者 +1 $，平/负 0）。
- 商城 openShop()：头像（基础 0-19 免费 + 商城 20-27）、头像框、动态效果、背景，购买后写入 owned。
- 点击任意玩家头像（排行榜/玩家列表/大厅/自己的档案）会弹出详情小框 openProfileModal。

### UI
- 主题：`html[data-theme="dark"]` 变量切换（`initTheme`/`applyTheme`，localStorage `mg_theme`）。
- 大厅为双栏布局：主栏（模式/人数/联机/游戏卡）+ 侧栏（大厅/排行榜/玩家列表）。
- 毛玻璃：CSS 变量 `--card` 半透明 + `backdrop-filter`；深色主题覆盖在 CSS 末尾。
- 3D 骰子：`makeDice3D(size, sm)` 返回 `{wrap, die, roll, reset}`，飞行棋/大富翁在用。
- 开局倒计时：`runCountdown()` 在 board-area 上盖 3-2-1 遮罩（联机开局/重开时）。
- 房间内切换游戏：`end_game` 消息 → `finishRoomGame()`（房主或服务端广播触发）。

## 6. 部署与环境变量

### 前端
推 `main` 自动触发 GitHub Pages workflow（`.github/workflows/pages.yml`，发布 `public/`）。

### 后端（Render）
当前服务由 **API 创建，没有挂 GitHub webhook**，所以推代码后不会自动部署，必须手动触发：

```powershell
$env:RENDER_KEY='rnd_xxx'          # 从用户获取
node scripts/render-deploy.js      # 部署最新 main
```

环境变量写入：

```powershell
$env:RENDER_KEY='rnd_xxx'
$env:DEEPSEEK_KEY='sk-...'
# 可选（接 Supabase 时）：
$env:SUPABASE_URL='https://xxx.supabase.co'
$env:SUPABASE_KEY='eyJ...'
node scripts/render-env.js
```

### 凭证（重要）
- GitHub PAT、Render API Key、DeepSeek Key 都曾出现在对话里，**建议用户轮换**。
- 本文件与仓库内**不允许出现任何明文 token**；要用时向用户索要。

### Node 版本注意
- 本机 Node v20 没有全局 WebSocket 客户端：跑联机 E2E / WS 调试脚本需加 `--experimental-websocket`。
- Node 21+ 可直接 `node qa/e2e-online.js`。若换机器建议直接装 Node 22 LTS。

## 7. 项目历程（为什么是这样）

- 最初：用户要求 2-5 人小游戏网页版 → 5 款游戏本地热座（单文件 index.html）。
- 然后：加联机（WS 房间/大厅/邀请）、L 金币、排行榜、像素头像、在线状态；
  发现“所有游戏都变成 2 人局”的两个根因（前端 playerCount 写死 2 + 服务端加入者索引固定为 1）并修复。
- 再然后：人机模式（DeepSeek API）、黑夜主题、毛玻璃、3D 骰子、开局倒计时、
  房间内「结束本局」切换游戏、不满人数开局。
- 部署：GitHub Pages（前端）+ Render（后端）；Supabase 表结构已备好但**尚未接入**
  （用户要求“先游戏完美运行，再接入数据库”）。
- 2026-08：新增 6 款游戏（坦克大战/贪吃蛇/俄罗斯方块/国际跳棋/斗兽棋/象棋）、PIN 账号体系、
  $ 货币商城（头像/头像框/背景/特效）、点击头像查看他人档案、双栏大厅、AI 智能化
  （井字棋 minimax 永不胜、五子棋启发式、飞行棋/大富翁/跳棋启发式）。

## 8. 当前状态与待办

✅ 已完成：11 款游戏三模式、联机大厅/邀请/在线状态/排行榜、人机 AI、主题/UI、多人局与切游戏、
  PIN 账号体系、$ 货币商城、点击头像查看档案、双栏大厅。

⏳ 待办：
1. **接入 Supabase**：代码与 `supabase/schema.sql`（含 pin_hash/个人化字段）已就绪，
   只等用户提供 Project URL + anon key → `scripts/render-env.js` 写入 → 触发部署。
   （目前排行榜数据在 Render 实例的临时磁盘 `data/leaderboard.json`，实例重启会丢。）
2. 可选：给 Render 挂 GitHub webhook，让推代码自动部署后端。
3. 可选：用户提示过的“换电脑后 token 轮换”。

⚠️ 注意：Render 免费实例冷启动约 30-60 秒；第一次访问可能慢属正常。

## 9. 给新 Codex 窗口的操作建议

- 先读本文件 + `README.md` + `server/index.js` 的 handleMessage + `public/index.html` 的
  `online` 对象与 5 个 `game*` 函数，再动手。
- 改前端后跑 `node qa/dom-smoke.js`；改联机逻辑后跑 `node --experimental-websocket qa/e2e-online.js`，全绿再推。
- e2e 用例顺序敏感、对状态文案有断言，改 `setStatus`/`renderRoomPanel` 文案时同步更新断言。
- 测试会在仓库根生成 `qa/e2e-run.log`（已被 .gitignore 忽略，勿提交）。
