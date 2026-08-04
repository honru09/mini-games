# 小游戏合集（在线版）

一个零依赖的网页版小游戏合集：井字棋、五子棋、飞行棋、迷你大富翁、弹珠跳棋。
- 线上试玩：https://honru09.github.io/mini-games/（前端 GitHub Pages + 后端 Render + 数据库 Supabase）

- 本地热座模式：2-5 人共用一台设备轮流操作
- 人机对战模式：🤖 用 DeepSeek AI 当对手，先选人数（含 AI），单人也能玩全部游戏
- 联机对战模式：全部 5 款游戏均可通过 WebSocket 房间联机（井字棋/五子棋 2 人，
  飞行棋 2-4 人，大富翁/弹珠跳棋 2-5 人）
- 游戏大厅：所有等待中的房间实时展示，玩家一键加入，无需输入房间码或链接
- 按当前人数开局：房间人数不满也能开始，几个人就开几人的局
- 房间内切换游戏：点「⏹ 结束本局」结束当前对局，不用离开房间即可换游戏再开
- 玩家列表：网站收录所有已注册档案，显示在线/离线状态，可直接邀请或接受邀请
- 用户档案：免账号密码，输入昵称 + 从 20 个程序生成的像素风头像中选一个即可建档
- L金币货币：每局获胜获得 1 枚 L 金币（平局/失败没有），写入个人档案
- 对局统计：档案记录每个游戏的游玩局数与总局数
- 总排行榜：金币数实时更新、离线玩家战绩永久保留
- 界面主题：黑夜/白昼一键切换，毛玻璃卡片、3D 晃动骰子、开局倒计时
- 数据存储：可接入 Supabase 数据库（PostgreSQL），全部玩家/对局数据集中管理
- 房主可设置房间人数并选择游戏，进入等待模式，人齐自动开局或由房主手动开始
- 前端是单个 `public/index.html`，服务端是零依赖的 Node.js（手写 WebSocket，无需 npm install）

## 本地运行

```bash
node server/index.js
```

打开 http://localhost:8080 即可。也可以用环境变量改端口：`PORT=3000 node server/index.js`。

## 联机怎么玩

1. 房主在大厅选好人数（2-5 人），点「🎮 创建房间」，选好游戏后进入等待模式；
2. 房间会自动出现在所有人的「游戏大厅」里（显示房主、人数、游戏）；
3. 其他玩家在游戏大厅看到房间后点「加入」即可，无需输入任何房间码/链接；
4. 也可以在「玩家列表」里直接邀请在线玩家，对方收到弹窗点「接受」即加入；
5. 人齐自动开局，或由房主点「▶ 开始游戏」提前开始；各自操作自己的回合，实时同步。

大厅的房间面板会实时显示：房间码、人数（1/2）、已选游戏、等待状态。

> 本地测试：开两个浏览器标签都访问 http://localhost:8080 即可模拟两人。

## 用户档案、金币与排行榜

### 档案

- 首次进入自动创建"我的档案"，点顶部档案按钮可改昵称（12 字以内）和 20 个头像之一
- 大厅的玩家槽位（按人数显示）可分别为每位玩家绑定档案；未设置的槽位开局时自动建档
- 每个档案记录：L金币数、每个游戏的游玩局数、总游玩局数
- 档案保存在浏览器 localStorage，同时会同步到服务端（全球总榜按服务端数据为准）

### 头像

不再使用 emoji，改为 20 个程序生成的像素风头像（不同肤色/发型/发色/眼镜/帽子/腮红
组合），无需任何外部图片资源，离线也能正常显示。

### 每局 L 金币结算

| 游戏 | 结算规则 |
|---|---|
| 井字棋 | 胜 +1 枚 / 平、负 0 枚 |
| 五子棋 | 胜 +1 枚 / 平、负 0 枚 |
| 飞行棋 | 冠军 +1 枚 / 其他 0 枚 |
| 迷你大富翁 | 最终赢家 +1 枚 / 其他 0 枚 |
| 弹珠跳棋 | 冠军 +1 枚 / 其他 0 枚 |

每局结束后所有参与者的档案都会 +1 局数（对应游戏 + 总局数）；胜者额外获得 1 枚 L 金币。
联机对局中双方各自结算自己的档案。

### 排行榜

- 大厅底部"总排行榜"按 L 金币数排名（头像 / 昵称 / 各游戏局数 / 金币数）
- 排行榜支持「全部 / 在线」筛选；客户端每 10 秒心跳保活，断开 40 秒内判定离线，
  当前档案在线时显示绿色"在线"圆点
- 联机服务在线时展示全球总榜，任何人得分后所有在线页面实时刷新
- 无服务端时展示本地排行榜（数据只存在本机）

### 数据持久化

服务端把排行榜写入 `data/leaderboard.json`（含用户档案、各游戏积分、历史记录），
启动时自动加载、变更后原子写入。部署时请挂载持久化磁盘（如 Render 的 Persistent Disk /
Railway Volume），否则免费套餐的重启会把数据清空。

## 部署上线（完整版：前端 + 服务端 + 数据库）

### 1. 前端：GitHub Pages（已完成 ✅）

仓库内置 `.github/workflows/pages.yml`，推送到 `main` 自动发布 `public/`。

### 2. 数据库：Supabase（免费 PostgreSQL，含管理后台）

1. 打开 https://supabase.com → 注册/登录（可用 GitHub 账号）
2. New project → 起名、设置数据库密码、选离你近的 Region
3. 左侧 **SQL Editor** → 粘贴执行本仓库 `supabase/schema.sql`（建表）
4. 左侧 **Project Settings → API**，复制两个值备用：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public` key（形如 `eyJ...`）

### 3. 服务端：Render（已部署 ✅ https://mini-games-online.onrender.com）

1. 打开 https://render.com → 注册/登录（用 GitHub 账号，无需付费）
2. **New → Blueprint** → 选择本仓库 `honru09/mini-games`
3. Render 读取 `render.yaml` 自动创建服务
4. 等首次部署完成后，打开该服务的 **Environment**，填入：
   - `SUPABASE_URL` = 第 2 步的 Project URL
   - `SUPABASE_KEY` = 第 2 步的 anon key
   - `DEEPSEEK_KEY` = DeepSeek 开放平台的 API Key（人机模式 AI 对手，不填则 AI 随机走子）
   - 保存后服务会自动重启

### 4. 前端连接服务端（已默认配置 ✅）

线上游戏页（`https://honru09.github.io/mini-games/`）已默认连接
`https://mini-games-online.onrender.com`，打开即可跨设备联机 + 全球排行榜 + 玩家在线状态。
如需更换后端，仍可在联机面板「⚙ 设置」中修改"联机服务地址"。

> 服务端未配置 Supabase 时会自动回退到本地 JSON 文件存储（`data/leaderboard.json`），
> 适合本地开发；生产环境请务必配置 Supabase，数据才会永久保存且便于管理。

### 数据管理（Supabase Dashboard）

所有数据集中在 Supabase 的 PostgreSQL 里，两张表：

- `profiles`：玩家档案（uid / 昵称 / 头像 / L金币 / 各游戏局数 / 总局数 / 创建与更新时间）
- `history`：对局流水（玩家 / 游戏 / 金币 / 时间），可用于审计、统计、报表

常用查询见 `supabase/schema.sql` 末尾注释；也可以在 Dashboard 的 Table Editor
里直接增删改查。若日后需要管理员后台、封禁、数据导出等，都在这套表结构上扩展。

## 消息协议（联机模式）

WebSocket 端点：`/ws`。所有消息均为 JSON：

| 方向 | 消息 | 说明 |
|---|---|---|
| 客户端→服务端 | `{"type":"hello","payload":{"uid":"u_xxx"}}` | 声明当前档案（用于在线状态） |
| 客户端→服务端 | `{"type":"profile","payload":{"uid","name","avatar"}}` | 创建/更新档案 |
| 客户端→服务端 | `{"type":"create","payload":{"capacity":2}}` | 创建房间 |
| 服务端→房主 | `{"type":"created","room":"XXXXXX","player":0}` | 返回房间码 |
| 服务端→全部 | `{"type":"lobby","payload":[...]}` | 游戏大厅：等待中的房间列表（实时） |
| 客户端→服务端 | `{"type":"join","payload":{"room":"XXXXXX"}}` | 加入房间 |
| 服务端→加入者 | `{"type":"joined","room":"XXXXXX","player":1}` | 加入成功 |
| 客户端→服务端 | `{"type":"invite","payload":{"toUid"}}` | 邀请在线玩家 |
| 服务端→受邀者 | `{"type":"invite","payload":{"fromName","room","game"}}` | 收到邀请 |
| 受邀者→服务端 | `{"type":"invite_accept","payload":{"room"}}` / `invite_decline` | 接受/拒绝邀请 |
| 服务端→房主 | `{"type":"invite_result","payload":{"accepted"}}` | 邀请结果 |
| 服务端→双方 | `{"type":"room_update","payload":{"room","game","players","size","capacity"}}` | 房间实时状态 |
| 房主→服务端 | `{"type":"select_game","payload":{"game":"gomoku"}}` | 选择游戏（进入等待模式） |
| 服务端→双方 | `{"type":"started","game":"gomoku"}` | 双方到齐且已选游戏，自动开局 |
| 任意→服务端 | `{"type":"move","payload":...}` | 走子（服务端转给另一方） |
| 房主→服务端 | `{"type":"restart"}` | 重开一局 |
| 客户端→服务端 | `{"type":"result","payload":[{"uid","game","coins","played"}]}` | 上报对局结果（金币+局数） |
| 服务端→全部 | `{"type":"leaderboard","payload":{"list","total"}}` | 排行榜推送（实时） |

服务端只做房间管理和消息中继，走子校验在两端各自执行；对局状态完全由双方本地确定性同步。

## 本地开发

```bash
node server/index.js   # 默认 http://localhost:8080
```

本地不配 Supabase 时使用 JSON 文件存储，功能与线上一致。
