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
- ✨ **个性化**：动态头像框（8 款含流光/烈焰/彩虹/赛博脉冲）、闪名（4 种特效）、动态档案背景（星空/樱花/赛博矩阵/海浪）、等级进度条
- 🔑 **PIN 账号**：设备识别 + 换机登录，账号永不丢失
- 🛍️ **💵 商城**：头像 / 头像框 / 动态特效 / 个人背景（56 款头像，4 大主题分类）
- 🎭 **AI 角色化**：5 个性格各异的 AI 对手，表达风格不同；强制胜/防守和本地强策略不会被人格覆盖
- 🧠 **AI 持续学习**：按“账号 × 游戏”独立模型；对局中记录近优候选，胜局强化、败局反事实修正、平局保留中性经验，JSON 与 Supabase 原子恢复
- 🏆 **全球排行榜**：💵 虚拟现金 + 各游戏局数统计

## 6 款精选游戏

| 游戏 | 人数 | 联机 | 人机 AI |
|---|---|---|---|
| 五子棋 ⚫ | 2 | ✅ | ✅ 威胁空间搜索 |
| 飞行棋 ✈️ | 2-4 | ✅ | ✅ 终点/吃子/风险期望 |
| 迷你大富翁 🏙️ | 2-5 | ✅ | ✅ 净资产/现金储备策略 |
| 坦克大战 🛡️ | 2 | ✅ | ✅ 影响图/避弹 |
| 俄罗斯方块 🧱 | 2-4 | ✅ | ✅ 井面+双块前瞻 |
| 象棋 ♞ | 2 | ✅ | ✅ 限宽 Alpha-Beta |

## 三种玩法

- **👥 本地热座**：2-5 人共用一台设备
- **🤖 人机对战**：6 款游戏都以规范化合法选项接入 DeepSeek，并保留本地 AI 快速回退，单人且断网也能玩（可选 5 个 AI 角色：傲娇 / 赌狗 / 毒舌 / 萌妹 / 数学老师）
- **🌐 联机对战**：Tank 服务端模拟 + Tetris/象棋/大富翁共享 Rule Core 服务端权威 + 独立观众席 + 自动赛事建桌/结果/下一轮 + 大厅 / 邀请 / 排行榜

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
npm run test:i18n
node qa/dom-smoke.js
node qa/ai-games.js
node qa/ai-strength.js
node qa/ai-learning.js
node --experimental-websocket qa/ai-learning-online.js
node qa/gameplay-upgrade.js
node qa/tank-authority.js
node qa/tetris-battle-protocol.js
node qa/tetris-rule-core.js
node qa/xiangqi-rule-core.js
node qa/monopoly-rule-core.js
node qa/rule-authority.js
node --experimental-websocket qa/rule-authority-online.js
node qa/protocol-version.js
node --experimental-websocket qa/game-cosmetic-profile.js
node qa/spectator-room.js
node qa/tournament.js
node --experimental-websocket qa/tournament-auto-online.js
node qa/xiangqi-clock.js
node qa/monopoly-auction.js
node qa/reward-system.js
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
| C→S | `profile_get` / `profile` | 查询档案；仅修改 name/lang、本人平台外观与白名单 `gameCosmetics` 装备，不能写金币、owned、XP、胜场、局数等权威字段 |
| C→S | `create` / `join` / `leave` | 创建、加入、主动离开房间或观众席 |
| C→S | `spectate_join` / `spectate_leave` | 进入/离开独立观众席；不占玩家位、不能发送游戏输入 |
| C→S | `invite` / `invite_accept` / `invite_decline` | 邀请及应答 |
| C→S | `select_game` | 房主选游戏 |
| C→S | `start` | 房主开始 |
| C→S | `move` / `game_state` | 回合制走子与稳定点快照；服务端记录有限 moveLog 并附带可信 `player`；Tank/Tetris 正式路径另用权威协议，旧 relay 仅兼容 |
| C→S | `tank_input` | `tank-authority-v1` 单调输入序列；坐标、炮弹、伤害、重生和最终排名由 20Hz 服务端模拟决定 |
| C→S | `tetris_lock_claim` / `tetris_ko_claim` / `tetris_state` | `tetris-battle-authority-v1` 落块/KO 申报与只读棋盘展示；目标、垃圾队列、KO/名次由服务端协调 |
| C→S | `tetris_action` | `tetris-rule-v2` 单调输入；服务端共享 Rule Core 执行移动/旋转/Hold/Lock/Clear/Garbage/Top Out |
| C→S | `xiangqi_action` | `xiangqi-rule-v2` 的 `from/to/seq`；服务端验证九宫、河界、马腿、象眼、炮架、将帅照面、Check/Terminal 并推进棋钟 |
| C→S | `monopoly_action` | `monopoly-rule-v2`；服务端 Seeded Dice、移动、现金、产权、租金、机会卡、拍卖、破产与名次 |
| C→S | `monopoly_auction_open` / `monopoly_bid` / `monopoly_turn_end` | 大富翁实时拍卖、revision 出价、服务端截止与回合稳定点 |
| C→S | `tournament_create` / `tournament_consent` / `tournament_start` / `tournament_next` / `tournament_get` | 3–4 人循环赛、5+ 三轮瑞士制；全员同意后自动建真实房、分配玩家、接收单盘服务端结果并推进下一轮 |
| C→S | `restart` / `end_game` | 房主发起新一局或结束本局 |
| C→S | `solo_start` / `solo_progress` | 已认证人机对局获取服务端票据，并上报由合法游戏动作产生的有效进度 |
| C→S | `result` | 联机携带 `matchId` 与完整结果 claim，所有参与者一致后才结算；人机携带服务端签发的 `matchId/resultId` 与胜平负 |
| C→S | `purchase` | 服务端按商品目录和余额原子购买（requestId 幂等） |
| S→C | `hello_ack` / `registered` / `logged_in` / `logged_out` / `auth_error` | 认证状态与服务端签发 token |
| S→C | `lobby` | 可加入的等待房与可观战的进行中房间列表 |
| S→C | `created` / `joined` / `room_update` / `started` | 加房结果、房间实时状态和开局信息（含 `matchId`） |
| S→C | `player_reassigned` | 有成员离房并压紧席位后，通知仍在房间中的客户端更新玩家索引 |
| S→C | `restart` / `end_game` | 房主操作广播：以新 `matchId` 重开，或结束本局回到选游戏状态 |
| S→C | `leaderboard` | 全球排行榜 |
| S→C | `invite` | 收到邀请 |
| S→C | `peer_left` | 成员主动离开；`payload.roomClosed=true` 表示房主已关闭房间，`false` 表示房间保留且当前对局结束 |
| S→C | `peer_status` / `rejoined` / `reconnect_expired` / `resume_expired` / `host_changed` | 掉线等待、令牌重连、权威快照/稳定快照恢复、超时释放与房主转移 |
| S→C | `spectate_joined` / `spectator_error` / `match_result` | 观战初始快照、只读保护与最终结果 |
| S→C | `tank_snapshot` / `tank_result` | Tank 权威状态、ack 和最终排名 |
| S→C | `tetris_battle` / `tetris_garbage_due` / `tetris_ko` / `tetris_result` | Tetris Battle Coordination Authority 事件 |
| S→C | `tetris_rule_state` / `tetris_rule_battle` | Tetris v2 完整规则状态、hash 与垃圾事件 |
| S→C | `xiangqi_rule_state` / `xiangqi_result` | 象棋 v2 权威棋盘、棋钟、Check/Terminal 与结果 |
| S→C | `monopoly_rule_state` / `monopoly_result` | 大富翁 v2 权威棋盘经济状态、Server RNG 与结果 |
| S→C | `clock_state` / `clock_timeout` | 象棋服务端棋钟基准与超时结果；不代表服务端验证完整象棋规则 |
| S→C | `auction_open` / `auction_bid` / `auction_closed` | 大富翁服务端拍卖状态、竞价与产权结果 |
| S→C | `tournament_state` / `tournament_match_assigned` / `tournament_bye` | 赛事状态、自动房间分配、轮空、积分与排名 |
| S→C | `gameplay_error` | 统一 `protocol/code/message/reason` 错误；覆盖协议版本、非法/重复/过期动作等 |
| S→C | `solo_started` | 下发人机对局的服务端 `matchId/resultId` 票据 |
| S→C | `result_pending` / `result_ok` / `result_error` | 结算共识状态；`result_ok.payload.reward` 含当前玩家完整 Reward Breakdown |
| S→C | `profile_data` / `profile_ok` / `purchase_ok` / `purchase_error` | 档案与购买结果 |

服务端签发的会话 token 默认有效 30 天（可通过 `AUTH_TOKEN_TTL_MS` 调整）；每个账号最多保留最近 5 个有效 token，通常对应 5 台设备或浏览器。新会话超过上限时会淘汰最旧 token，`logout` 只撤销当前 token。

## 奖励与成长（Economy & Progression v1.0）

- 联机 1v1：胜/平/负为 `3/2/1💵` 与 `12/10/8 XP`。
- 3–5 人联机：第 1/2/3/其他名次为 `4/3/2/1💵` 与 `14/12/10/8 XP`。
- AI：胜/平/负为 `1/0/0💵` 与 `8/6/5 XP`，每账号每天通过 AI 触发的最终货币总额最多 `3💵`（含等级里程碑）；达到上限后仍得 XP。
- 本地热座：不产生正式 `💵` 或 XP，不能改写账号等级与连胜。
- 每日首次有效联机胜利额外 `+2💵/+5 XP`；3/5/8+ 连胜额外 `+2/+4/+6 XP`。
- 同一玩家组合 24 小时内第 11–20 局货币减半；第 21 局起货币为 0、XP 为 50%。
- 等级曲线：`XPNext(level)=min(200, 30+5×level)`；每跨越 5 级里程碑奖励 `5💵`。
- 胜场使用独立的 `wins`（按游戏）与 `totalWins`（总胜场）权威字段，只在有效正式胜利结算时增长，与 💵 余额完全解耦。

所有数值与有效局阈值集中在 `server/reward-engine.js`。服务端同时检查身份、票据/幂等、联机共识、持续时间、有效操作、唯一操作指纹和活跃参与者；AI 操作带不可重复 `actionId`，断线补发不会重复计入。秒投、无进度、过早取消、争议与 AFK 不获得正常奖励。客户端只展示服务端返回的奖励明细。

### AI 专项知识与持续学习

`server/ai-strategy-skills.js` 内嵌六款策略知识包：五子棋威胁空间、象棋限宽 Alpha-Beta、飞行棋终点/吃子/安全风险、大富翁净资产与现金储备、坦克影响图/避弹/火线/BFS 侧翼、俄罗斯方块 Dellacherie 井面与第二块前瞻。DeepSeek 只在本地近优候选带内裁决；断网仍执行本地强策略。

`server/ai-learning.js` 的 `personal-linear-v2` 按账号 × 游戏隔离。对局中缓存局面哈希、候选特征和选择；从 AI 视角看，有效胜局强化实际选择，败局用同一近优带做反事实修正，平局只做小幅中性校正并保留审计经验；无效/争议/AFK/秒投只审计不调权。模型与经验通过本地 JSON 和 Supabase `ai_learning_models`、`ai_learning_experiences`、`apply_ai_learning_v1` 原子持久化，`resultId` 重放不会二次训练；不保存原始完整局面、PIN、对话或密钥。

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
- P0 纵切已接入五子棋与俄罗斯方块响应式大厅封面、五子棋木纹 Canvas 底材、俄罗斯方块玻璃井底材，以及软 3D 棋子/七类纹理/ghost/locked/clear 绘制状态。
- 两款纵切可分别用 `mg_art_gomoku_v1`、`mg_art_tetris_v1` 本地 flag 回滚；关闭只影响绘制层，不改变规则、快照或联机协议。
- 所有美术资源保留 CSS / Canvas / DOM Emoji / WebAudio 回退，资源加载失败不能阻塞大厅或开局。

### 数据库（Supabase）
`supabase/schema.sql` 可重复执行建表/迁移，创建 `apply_reward_v1`、`apply_purchase_v1`、`apply_ai_learning_v1` 原子 RPC，并为 `profiles`、`history`、`reward_history`、`economy_ledger`、`analytics_events`、`ai_learning_models`、`ai_learning_experiences` 启用 RLS；没有面向 `anon`/`authenticated` 的访问策略，浏览器不能直连这些表。

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 将项目 URL 写入 `SUPABASE_URL`，将 **secret `service_role` key** 写入 Render 的 `SUPABASE_KEY`。不要使用 `anon`/publishable key；也绝不能把 service-role secret 放到前端、日志或仓库。
3. 用同一组服务端凭证运行 `node scripts/supabase-status.js`，检查 REST 连通性、档案奖励状态字段、奖励/经济流水表和 AI 学习表。

`history` 是兼容结算流水：联机对局按每位参与者各写一行（同一 `match_id` 可有多行），AI 对局写一行；`result_id` 用于幂等去重。`reward_history` 保存资格、阻断原因、对手组合、基础与最终奖励、等级/连胜前后值和明细；`economy_ledger` 审计每次正式 💵 增减；`analytics_events` 保存比赛与奖励事件。

`profiles.wins` / `profiles.total_wins` 分别保存按游戏胜场和总胜场；服务端/API 对应 `wins` / `totalWins`，不得由余额推导胜场。正式奖励统一调用 `apply_reward_v1`：按账号加事务锁、以 `result_id` 幂等校验，并在同一事务中更新 `profiles`、写入 `history`、`reward_history` 和可选 `economy_ledger`；`analytics_events` 仍为独立埋点写入。

`profiles.game_cosmetics` 保存 `cosmeticSchemaVersion=1` 的公开已装备游戏外观 ID。未知 ID 在服务端回退默认值；比赛 Metadata 只广播装备 ID，不含 `owned`、余额、价格或购买记录。当前只接通既有原型外观，不新增游戏皮肤商品或购买入口。

`profiles.solo_rate` 保存服务端维护的人机结算频控时间戳，首胜日期与 AI 日货币累计也只由服务端更新，均不属于客户端可写档案字段。正式奖励会先写入本地 outbox；Supabase 事务短暂失败后会以相同 `result_id` 自动重试，`applied` 或匹配 `resultId` 的 `duplicate` 都是成功终态。当前 Render 单实例且未挂载持久磁盘，outbox 只能覆盖进程存活期/正常重启场景，不能替代真实 Supabase；扩容多实例前还必须把 Reward Resolver 迁移为数据库内权威计算或增加版本冲突重算。没有真实 Supabase 凭证时，可运行 `node --experimental-websocket qa/supabase-adapter.js`，用本地 fake PostgREST 验证字段映射、单事务 RPC payload、幂等重试和空库迁移行为；它不能替代真实项目的 SQL、并发、连通性与 RLS 验收。

AI 学习模型与经验在 `apply_ai_learning_v1` 中按账号+游戏加锁，以 `result_id` 幂等并校验 revision；服务端 outbox 会在 Supabase 暂时不可用时排队。当前 Render 单实例且未挂载持久磁盘，JSON/outbox 不能替代真实 Supabase；真实项目仍需执行迁移、RLS、并发、备份和回滚验收。

## 开发原则

- **零 npm 依赖** — 手写 WebSocket，纯 Node 测试
- **单页构建产物** — `public/index-template.html + public/src/*` 构建为 `public/index.html`
- **三语言全量覆盖** — 静态文案使用 `data-i18n*`，运行时文案使用 `t()` / `setLocalizedText()`，服务端错误使用稳定 reason；用户昵称等原文节点标记 `data-i18n-raw`。新增或修改界面文字后必须同步三份 locale，并运行 `npm run test:i18n`
- **新消息成对添加** — `server/index.js` handleMessage ↔ `public/src/online/03-websocket.js` onMessage；随后重建生成物
- **不破坏旧协议** — 所有更新兼容已有用户数据
- **无打包器** — 不用 webpack/vite/rollup

## Project Execution OS

Playroom 的长期开发按项目级执行系统运行，而不是依赖单次长 Prompt：

1. `RECON`：读取 `AGENTS.md`、`HIGH_RISK_FILES.md`、`PROJECT_STATUS.json`、需求和 dirty worktree。
2. `REQUIREMENT_FROZEN`：在 `requirements/active/<task>/` 固定 Goal、IN、OUT、契约、所有权、测试与回滚点。
3. `IMPLEMENTING`：Builder 只改 ownership 文件；共享高风险文件由 Master 集成。
4. `VERIFYING`：通过 Quality Gates、自动化回归、浏览器/视觉证据；未执行项明确写 `NOT_EXECUTED`。
5. `ACCEPTED`：同步代码事实到 README/AGENTS/WHITEPAPER/requirements/状态矩阵和三份中文日志，再提交发布。

项目级 Skills 在 `.agents/skills/`，质量闸门配置在 `requirements/QUALITY_GATES.json`，当前能力与发布阻塞项在 `PROJECT_STATUS.json`。
当前不会为了视觉参考强行迁移 React/Framer/GSAP，也不会自动安装未经审计的第三方 Skill。

## 第三阶段发布状态

- 自动化：`npm test`、关键协议 5 次连续回归、10/25/50 逻辑并发房、1000 次生命周期内存、Timer Audit 均已通过。
- 浏览器：本地 Desktop Chromium 已确认 Tank/Tetris 连续运行保持稳定 DOM 根节点与尺寸，控制台无 warning/error。
- 未执行：Android Chrome、iPhone Safari、Tablet、第二桌面浏览器、真实 `tc/netem`、30 分钟真实 Synthetic Session、真实 Supabase/RLS/并发/备份回滚。
- 因真实设备发布闸门未完成，当前结论是 `AUTOMATED_VERIFIED`，Release Candidate 总状态仍为 `BLOCKED`，不能写 `PRODUCTION_READY`。
