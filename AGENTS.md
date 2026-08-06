# AGENTS.md — Mini Games Platform 项目上下文

> 本文件是给 Codex / 新协作者的项目说明书。新环境克隆本仓库后，Codex 会自动读取本文件；
> 也可以直接说「读一下 AGENTS.md 了解项目」。

## 1. 项目一句话

**Mini Games Platform** — 网页版多人游戏平台：井字棋、五子棋、飞行棋、迷你大富翁、弹珠跳棋、
坦克大战、贪吃蛇、俄罗斯方块、国际跳棋、斗兽棋、象棋，共 11 款插件化游戏。
平台是主体（大厅 / 好友 / 房间 / 排行榜 / 金币 / 成长 / 社交），游戏是插件。

核心理念 **Fast Fun Loop**：打开 3 秒开局 → 5 分钟一局 → 立刻再来；先看到「人」，再看到「游戏」。

三种玩法：**本地热座**（2-5 人一台设备）、**人机对战**（DeepSeek AI 对手）、
**联机对战**（WebSocket 房间 + 游戏大厅 + 邀请 + 在线状态 + 全球排行榜）。
含 **PIN 账号体系**、**$ 商城**、**三语言 i18n**（zh-CN / en-US / uk-UA）、
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
│   │   ├── core/        # 00-i18n / 01-utils / 02-app-shell / 03-game-framework / 04-social / 05-ai-personas
│   │   ├── games/       # 11 款游戏（本地 + 人机 scheduleAI）
│   │   ├── online/      # WebSocket 客户端（03-websocket）
│   │   ├── shop/        # 04-auth / 05-profile / 06-shop
│   │   └── ui/          # 07-roster（档案/排行榜/结算）
│   └── locales/         # i18n 翻译文件（zh-CN / en-US / uk-UA）
├── server/index.js      # 零依赖 Node 服务（约 1260 行）
│                         # 静态文件 + 手写 WebSocket(/ws) + /api/ai + Supabase 可选持久化
├── scripts/             # 运维脚本
│   ├── render-status.js # 查 Render 部署状态
│   ├── render-env.js    # 写 Render 环境变量
│   ├── render-deploy.js # 手动触发 Render 部署
│   └── ws-live-test.js  # 线上 WebSocket 冒烟
├── qa/                  # 测试
│   ├── dom-smoke.js     # 前端冒烟
│   ├── e2e-online.js    # 端到端联机
│   └── ws-close-test.js # WS 断开测试
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
node --experimental-websocket qa/e2e-online.js   # 联机 E2E（Node 20 需此开关）

# 3) 本地调试 AI
$env:DEEPSEEK_KEY='sk-...'
node server/index.js
```

浏览器实测：开两个标签访问 localhost:8080 即可模拟两人联机。

## 5. 架构与关键设计（改代码前必读）

### 联机
- 服务端是**房间中继**：客户端各自持有完整对局状态，`move` 消息只做广播。
- 消息类型见 README「消息协议」表；新消息在 `server/index.js handleMessage` 和
  `public/index.html online.onMessage` 两处成对添加。
- 房主权限：选游戏、开始、结束本局、新一局；非房主点这些按钮会被拦（toast 提示）。

### 人数规则
- 房间容量 2-5（建房时选）。
- **按"当前已加入人数"开局**：房间不满也能开始。
- `server/index.js joinRoom` 为每个加入者分配递增且不重复的玩家索引（0,1,2…），切勿改回固定值。
- 前端 `startOnlineGame(id, sizeOverride)` 用 `online.roomInfo.size` 决定 `playerCount`，不能写死成 2。

### 结算与排行榜
- 每局结束：胜利者 +$1（平局/失败 0），所有参与者各 +1 局。
- 联机时每个客户端只上报自己的结果（`applyGameResult` 里 `r.slot === online.player` 过滤）。
- 在线状态：10 秒心跳 / 40 秒超时判离线。

### 人机对战（DeepSeek AI）
- 前端把合法走法列表和局面发给 `POST /api/ai`，服务端代理调 DeepSeek。
- 每个游戏有自己的 `scheduleAI()`，用 `opts.ai` 判断当前回合是否 AI。
- DeepSeek Key 只存在服务端环境变量，绝不能写进前端或仓库。

### 账号与 PIN
- 首次进入弹「创建账号」：昵称、头像、背景、PIN（4-20 位仅字母数字）。
- 同设备自动登录（deviceFingerprint）；换设备用 PIN 登录。
- 服务端消息：register / login / profile_get / profile / result。

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
- 主题：`html[data-theme="dark"]` CSS 变量切换（localStorage `mg_theme`）。
- 大厅为双栏布局；毛玻璃 + backdrop-filter；3D 骰子；开局倒计时。
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
$env:SUPABASE_URL='https://xxx.supabase.co'   # 可选
$env:SUPABASE_KEY='eyJ...'                     # 可选
node scripts/render-env.js
```

### 凭证
- 所有 token/Key 只存环境变量，绝不写入仓库。
- 本机 Node v20 需 `--experimental-websocket`；Node 22+ 可直接跑。

## 7. 当前状态

✅ 已完成：
- 11 款游戏三模式（本地 / 人机 / 联机）
- 联机大厅 / 邀请 / 在线状态 / 排行榜
- PIN 账号体系、$ 商城（头像 / 相框 / 特效 / 背景）
- 三语言 i18n + Settings 设置页 + 语言旗帜
- 毛玻璃 UI、3D 骰子、开局倒计时、双栏大厅
- CI：GitHub Pages 自动构建 + 冒烟 + 部署

✅ 已完成（本轮）：
- UI/UX 产品级升级：Design System（间距/字号/色彩令牌）、6 套主题、Hero 首屏、卡片入场/按钮光效/胜负彩带/WebAudio 轻音效
- 个性化系统：动态头像框（8 款）、闪名（4 种特效）、动态档案背景（4 款）、等级进度条
- v2.5 产品级打磨：补齐 Motion/Elevation/Icon/Glass 设计令牌与组件规范；统一动效库（转场/入场/弹性/Loading）
- Game Feel：11 款游戏全量接入分级操作反馈（落子/移动/掷骰/吃子/射击/放置 → 音效+震动+状态提示），AI 思考中提示
- Visual Polish + a11y：棋盘棋子渐变立体质感、侧栏 sticky、排行榜前三高亮、焦点环/44px 触控目标/最小字号 11px/prefers-reduced-motion
- 前端冒烟 ALL_PASS（66 项）+ 联机 E2E ALL_PASS（40 项）+ WS 断开测试通过

⏳ 待办：
1. 接入 Supabase 数据库（schema 已备好，凭证待提供）
2. 锦标赛模式、文字/社交游戏
3. 平台扩展（微信小程序 / App / 桌面版）

## 8. 项目历程

- 初版：2-5 人小游戏网页版 → 5 款游戏本地热座。
- 联机版：WS 房间/大厅/邀请、金币、排行榜、像素头像。
- 增强版：人机 AI、黑夜主题、毛玻璃、3D 骰子、倒计时、房间内切游戏。
- 扩展版：+6 款游戏、PIN 账号、$ 商城、双栏大厅。
- v2.0：i18n 三语言、Settings 设置页、语言旗帜。
- 部署：GitHub Pages（前端）+ Render（后端）。

## 9. 给新 Codex 窗口的操作建议

- 先读本文件 + `README.md` + `server/index.js` 的 handleMessage + `public/index.html` 的
  `online` 对象与 `games` 注册表，再动手。
- 改前端后跑 `node qa/dom-smoke.js`；改联机逻辑后跑 `node --experimental-websocket qa/e2e-online.js`。
- e2e 用例顺序敏感、对状态文案有断言，改文案时同步更新断言。
- 零 npm 依赖、零打包器；新消息在服务端与前端成对添加；不破坏旧协议与数据。
