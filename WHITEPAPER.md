# Mini Games Platform · 项目白皮书
# 版本：v2.4（2026-08-06）
# 状态：活文档 —— 每次代码变更后应同步更新本文件与 WHITEPAPER-SECRET.md

> 本文档是项目的**唯一权威总纲**。任何新 AI / 新协作者 / 新记忆窗口，先读本文件，
> 再读 AGENTS.md 与 README.md。本文档回答三个问题：
> **我们是什么 · 我们现在有什么 · 我们接下来要做什么。**

---

## 0. 快速定位（30 秒版）

- **产品**：Mini Games Platform —— 网页版多人游戏平台（11 款插件化小游戏）
- **核心哲学**：Fast Fun Loop —— 打开 3 秒开局 → 5 分钟一局 → 立刻再来；先看到「人」，再看到「游戏」
- **技术栈**：零 npm 依赖。前端单文件 `public/index.html`（HTML+CSS+JS），后端零依赖 Node + 手写 WebSocket
- **线上**：前端 GitHub Pages + 后端 Render + 数据库 Supabase（可选）
- **当前版本**：v2.3 已完成，Phase 3（社交与留存）进行中

---

## 1. 产品介绍

### 1.1 一句话
网页版多人游戏平台：井字棋、五子棋、飞行棋、迷你大富翁、弹珠跳棋、坦克大战、贪吃蛇、俄罗斯方块、国际跳棋、斗兽棋、象棋，共 11 款插件化游戏。

### 1.2 三种玩法
| 模式 | 说明 |
|---|---|
| 👥 本地热座 | 2-5 人共用一台设备轮流操作 |
| 🤖 人机对战 | DeepSeek AI 对手，单人也能玩 |
| 🌐 联机对战 | WebSocket 房间 + 游戏大厅 + 邀请 + 在线状态 + 全球排行榜 |

### 1.3 平台能力（已完成）
- PIN 账号体系（唯一账号、设备识别、换机登录）
- $ 货币商城（头像 / 头像框 / 动态特效 / 个人背景）
- 三语言 i18n（zh-CN / en-US / uk-UA）+ Settings 设置页 + 语言旗帜
- 全球排行榜 + 在线状态 + 房间大厅 + 邀请
- 成长系统：XP / 等级 / 连胜（v2.3 新增）
- 游戏插件化框架（v2.3 新增）

### 1.4 平台愿景
平台是主体（大厅/好友/房间/排行榜/金币/成长/社交），游戏是插件。最终目标是：
- 打开 APP → 看到朋友在线 → 点击游戏 → 3 秒开始 → 5 分钟一局 → 立即再玩
- 微信小程序 / Android·iOS / 桌面版（Electron/Tauri）可移植

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────┐
│ 前端 public/index.html（单文件，约 7800 行）      │
│  ├─ core/      通用工具 + i18n + 设置 + 游戏框架  │
│  ├─ online/    WebSocket 客户端 + 大厅渲染       │
│  ├─ shop/      账号 / 档案 / 商城               │
│  ├─ ui/        排行榜 / 玩家列表 / 结果结算      │
│  └─ games/     11 款游戏（每款独立模块）         │
└─────────────────────────────────────────────────┘
                    │ WebSocket (/ws)
                    ▼
┌─────────────────────────────────────────────────┐
│ 后端 server/index.js（零依赖 Node，约 1300 行）  │
│  ├─ 静态文件服务                                │
│  ├─ 手写 WebSocket（RFC6455）房间中继           │
│  ├─ POST /api/ai（DeepSeek 代理）               │
│  └─ Supabase 可选持久化（环境变量启用）          │
└─────────────────────────────────────────────────┘
                    │ REST
                    ▼
┌─────────────────────────────────────────────────┐
│ Supabase（PostgreSQL）：profiles / history       │
│ （schema.sql 已备好，等待 URL + anon key 接入）  │
└─────────────────────────────────────────────────┘
```

### 2.1 构建系统（v2.1 引入）
- `public/src/*.js` 是源码（20+ 模块），`public/index-template.html` 是模板
- `node scripts/build.js` 合并为 `public/index.html`
- **改代码必须改 `src/` 再 build，不要直接改 index.html**

### 2.2 联机设计
- 服务端是**房间中继**：客户端各自持有完整对局状态，`move` 只广播
- 房主权限：选游戏 / 开始 / 结束本局 / 新一局
- 人数规则：房间容量 2-5，**按当前已加入人数开局**（不满也能开始）
- 新消息在 `server/index.js handleMessage` 和 `public/index.html online.onMessage` 两处成对添加

### 2.3 游戏插件化（v2.3）
- 统一生命周期：`init() / render() / move() / serialize() / deserialize() / restart() / destroy()`
- `registerGame(id, factory)` 注册表 + `createGameInstance()` 工厂
- `GAME_REGISTRY` 自动注册旧游戏（`autoRegisterGames()`）

### 2.4 成长系统（v2.3）
- 等级 = 对局经验（XP），不是金币
- 胜利 +10 XP，参与 +4 XP；1级=0，2级=30，3级=80，4级=160，5级=280，之后每级 +150
- 连胜 streak / 最高连胜 bestStreak

---

## 3. 已完成功能清单（按版本）

### v1.0 → v1.5（基础）
- 5 款游戏本地热座 → 11 款游戏
- 联机（WS 房间/大厅/邀请）、L 金币、排行榜、像素头像

### v2.0（2026-08-05）
- 三语言 i18n（zh-CN / en-US / uk-UA）
- Settings 设置页（主题 + 语言 + 联机服务地址）
- 语言旗帜显示（6 处 UI）

### v2.1（Phase 0）
- AGENTS.md / README.md 文档同步（平台定位）
- `scripts/build.js` 模块化构建系统
- 触屏适配（touch-action / getEventPos / 响应式断点 480/768/1024px）

### v2.2（Phase 1）
- 统一胜利叠加层 `showVictoryOverlay()`（11 款游戏）
- 结算爽感：🏆 弹跳动画 + 金币 +1 + 再来一局/分享/邀请按钮
- Tetris 键盘操控（← → ↑ ↓ 空格）
- 国际跳棋 / 斗兽棋提示按钮

### v2.3（Phase 2）
- 游戏插件化框架（统一生命周期）
- 成长系统（XP / 等级 / 连胜）
- 协议版本号 PROTOCOL_VERSION + hello_ack
- Supabase schema 新字段（xp/level/streak/best_streak）

---

## 4. 未完成 / 进行中（Roadmap）

### Phase 3：社交与留存（进行中 ~40%）
- [ ] 称号系统（新手/常胜将军/老赌神/棋圣/传说）
- [ ] 成就/勋章墙（首胜/十胜/五十胜/三连胜/五连胜/资深/全能/社交达人）
- [ ] 每日任务（玩 1 局/玩 3 局/赢 1 局/连胜 2 局，奖励 XP）
- [ ] 我的卡片（首屏玩家中心：等级/金币/在线好友/邀请/最近一起玩）
- [ ] 最近一起玩（playmates 记录 + 服务端同步）

**已写好但未接入**：`public/src/core/04-social.js`（全部函数）

### Phase 4：AI 角色化（未开始）
- 5 个 AI 角色（傲娇/赌狗/毒舌/萌妹/数学老师）
- 每个角色独立说话风格 + 下棋倾向
- 对局内 AI 发言（toast/气泡）

### Phase 5：平台扩展（未开始）
- 游戏逻辑解耦（纯逻辑层可移植）
- PWA 完善（manifest/sw.js）
- 适配层（微信小程序 / App / 桌面版）

---

## 5. 目录结构

```
mini-games/
├── AGENTS.md              # AI 协作指南（活文档）
├── README.md              # 用户向说明
├── WHITEPAPER.md          # 本文件（项目总纲，公开版）
├── WHITEPAPER-SECRET.md   # 私密版（凭证/部署密钥，gitignore 排除）
├── public/
│   ├── index.html         # 构建产物（不要手改！）
│   ├── index-template.html# 模板
│   ├── locales/           # i18n 翻译（zh-CN/en-US/uk-UA）
│   └── src/               # 源码模块
│       ├── core/          # i18n/工具/设置/游戏框架/social
│       ├── online/        # WebSocket 客户端
│       ├── shop/          # 账号/档案/商城
│       ├── ui/            # 排行榜/玩家/结算
│       └── games/         # 11 款游戏
├── server/index.js        # 零依赖 Node 后端
├── scripts/               # build/render 运维脚本
├── qa/                    # 测试（dom-smoke/e2e/ws-close）
├── supabase/schema.sql    # 数据库建表
├── render.yaml            # Render Blueprint
└── data/                  # 本地 JSON 存储（gitignore）
```

---

## 6. 开发 / 测试 / 部署流程

### 6.1 本地开发
```bash
node server/index.js        # http://localhost:8080
```

### 6.2 测试（每次改动必跑）
```bash
node qa/dom-smoke.js                                # 前端冒烟 → ALL_PASS
node --experimental-websocket qa/e2e-online.js      # 联机 E2E → 全 PASS
node --experimental-websocket qa/ws-close-test.js   # WS 断开
```
注意：沙箱环境跑 e2e 可能因系统 temp 权限 EPERM 中断（非代码问题），需无沙箱环境全量验证。

### 6.3 构建
```bash
node scripts/build.js       # 合并 src/ → index.html
```

### 6.4 部署
```powershell
# 前端：推 main 自动触发 GitHub Pages
git push origin main

# 后端：Render 手动触发（API 创建的服务无 webhook）
$env:RENDER_KEY='rnd_xxx'
node scripts/render-deploy.js

# 环境变量
$env:RENDER_KEY='rnd_xxx'
$env:DEEPSEEK_KEY='sk-...'
$env:SUPABASE_URL='https://xxx.supabase.co'   # 可选
$env:SUPABASE_KEY='eyJ...'                     # 可选
node scripts/render-env.js
```

### 6.5 上线地址
- 前端：https://honru09.github.io/mini-games/
- 后端：https://mini-games-online.onrender.com
- 仓库：https://github.com/honru09/mini-games（默认分支 main）

---

## 7. 消息协议（WebSocket）

| 方向 | 消息 | 说明 |
|---|---|---|
| C→S | hello | 声明 uid + proto（协议版本） |
| S→C | hello_ack | 协议版本回执（v2.3+） |
| C→S | register / login | PIN 账号 |
| C→S | profile | 同步档案（含 lang/xp/level/streak） |
| C→S | create / join / leave | 房间 |
| C→S | invite / invite_accept / invite_decline | 邀请 |
| C→S | select_game / start / end_game / restart | 游戏控制 |
| C→S | move | 走子广播 |
| C→S | result | 上报结果（含 xp） |
| S→C | lobby / room_update / started | 大厅与房间 |
| S→C | leaderboard / peer_left / error | 状态 |

---

## 8. 凭证与安全策略（重要）

**完整密钥清单见 `WHITEPAPER-SECRET.md`（不在本公开版中，且已被 .gitignore 排除）。**

- GitHub PAT / Render API Key / DeepSeek Key 都曾出现在对话里，**建议定期轮换**
- 明文 token 绝不写入仓库（git 历史不可清除）
- 凭证只存环境变量（Render Environment / 本机 .env / WHITEPAPER-SECRET.md 且 gitignore）
- 本机 Node v20 需 `--experimental-websocket`；Node 22+ 可直接跑

---

## 9. 活文档维护规则（给 AI 的更新指南）

**每次代码变更后，按以下规则更新本文件：**

1. 版本号：`## 版本` 处更新（如 v2.3 → v2.4）
2. 已完成为清单：新功能移入「3. 已完成功能清单」
3. Roadmap：勾选已完成项，新增待办项
4. 消息协议：新增消息类型必须更新「7. 消息协议」表
5. 目录结构：新增/删除模块更新「5. 目录结构」
6. 测试命令：新增测试更新「6.2 测试」
7. 密钥变化：只更新 WHITEPAPER-SECRET.md，**绝不更新公开版**

**给新 AI 的首读顺序**：
1. WHITEPAPER.md（本文件）—— 全局认知
2. WHITEPAPER-SECRET.md —— 凭证（仅本机）
3. AGENTS.md —— 协作纪律
4. README.md —— 用户视角
5. server/index.js handleMessage + public/src/online/03-websocket.js —— 协议实现
6. 相关游戏模块 —— 具体功能

---

## 10. 变更记录（Changelog）

| 版本 | 日期 | 内容 |
|---|---|---|
| v2.0 | 2026-08-05 | i18n 三语言 + Settings + 语言旗帜 |
| v2.1 | 2026-08-05 | Phase 0：文档/构建系统/触屏 |
| v2.2 | 2026-08-05 | Phase 1：胜利动画 + Tetris 键盘 + 分享 |
| v2.3 | 2026-08-05 | Phase 2：游戏插件化 + XP/等级/连胜 + 协议 v1 |
| v2.4 | 2026-08-06 | Phase 3 进行中 + 本白皮书建立 |
