# Mini Games Platform 🎮

> Ghost Game（临时品牌名）— 6 款精选插件化游戏与原创助手 Honru，先看到人，再看到游戏。
> 体验目标：打开约 3 秒开局 → 约 5 分钟一局 → 立刻再来。

线上试玩：https://honru09.github.io/mini-games/
后端地址：https://mini-games-online.onrender.com

---

## 平台特色

- 🎯 **Fast Fun Loop**：目标约 3 秒入局、约 5 分钟一局；当前线上冷启动与真实设备仍需专项实测
- 🌐 **三语国际化**：中文 / English / Українська，Settings 一键切换
- 🏳️ **语言旗帜**：个人档案、排行榜、房间大厅实时显示
- ⚙️ **Settings 设置页**：白天云海 / 黑夜星空双主题、三语言、联机地址
- 🧭 **四区应用外壳**：Home / Games / Chat / Profile；手机使用底部四项导航，平板与桌面使用顶部导航
- 🎨 **Design System**：统一间距（4px 刻度）/ 字号 / 色彩令牌，卡片入场动画、按钮光效、胜负彩带、WebAudio 轻音效（零资源）
- 🎬 **动效 + 手感**：统一 Motion 动效库（转场/入场/弹性/Loading）、6 款游戏全量操作反馈（音效+震动+状态提示）、棋盘棋子立体质感
- ✨ **个性化**：动态头像框（8 款含流光/烈焰/彩虹/赛博脉冲）、闪名（4 种特效）、动态档案背景（星空/樱花/赛博矩阵/海浪）、等级进度条
- 🔐 **用户名密码账号**：用户名大小写不敏感唯一，密码使用随机盐 scrypt 慢哈希；旧 PIN 账号可原 UID 迁移
- 👻 **一次性访客**：服务端签发临时身份；退出立即删号，不进入持久库、排行榜、永久购买或持续 AI 学习
- 📨 **玩家私聊**：正式好友一对一纯文本消息、离线留言、历史分页、账号级未读/已读、多会话同步；Block/访客/越权读取与伪造身份由服务端拒绝
- 💬 **Honru 助手**：每日抚摸签到、三语言短对话与离线安全回退；聊天原文不落库，不伪造实时天气或新闻
- 🪪 **深度个人主页**：身份背景、等级 XP、六游戏战绩、连胜、成就、任务、好友/最近同玩、收藏与本人近 7 日回放统一展示
- 🛍️ **💵 商城**：头像 / 头像框 / 动态特效 / 个人背景 / 六款游戏外观（游戏外观购买与装备由服务端权威校验）
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

## 两种玩法

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
| C→S | `register` / `login` / `logout` | `authVersion:2` 创建/登录用户名密码账号并撤销当前 token；旧 PIN 消息保留兼容 |
| C→S | `username_check` / `legacy_bind` / `guest_login` | 实时查重、把旧 PIN 账号原 UID 绑定到用户名密码、创建一次性访客 |
| C→S | `companion_checkin` | Honru 每日签到；按账号与日期幂等 |
| C→S | `chat_list` / `chat_history` / `chat_send` / `chat_read` | `direct-chat-v1`：正式好友私聊摘要、排他游标历史、`clientMessageId` 幂等发送与账号级单调已读；访客/陌生人/Block/越权读取由服务端拒绝 |
| C→S | `profile_get` / `profile` | 查询档案；仅修改 name/lang、本人平台外观与白名单 `gameCosmetics` 装备，不能写金币、owned、XP、胜场、局数等权威字段 |
| C→S | `create` / `join` / `leave` | 创建、加入、主动离开房间或观众席 |
| C→S | `spectate_join` / `spectate_leave` | 进入/离开独立观众席；不占玩家位、不能发送游戏输入 |
| C→S | `invite` / `invite_accept` / `invite_decline` | 邀请及应答 |
| C→S | `select_game` | 房主选游戏 |
| C→S | `start` | 房主开始 |
| C→S | `move` / `game_state` | 回合制走子与稳定点快照；服务端记录有限 moveLog 并附带可信 `player`；Tank/Tetris 正式路径另用权威协议，旧 relay 仅兼容 |
| C→S | `tank_input` | `tank-authority-v1` 单调输入序列；坐标、炮弹、伤害、重生和最终排名由 20Hz 服务端模拟决定 |
| C→S | `tetris_lock_claim` / `tetris_ko_claim` / `tetris_state` | `tetris-battle-authority-v1` 落块/KO 申报与只读棋盘展示；目标、垃圾队列、KO/名次由服务端协调 |
| C→S | `tetris_action` | `tetris-rule-v3` 单调输入；服务端共享 Rule Core 执行移动/旋转/Hold/Lock/Clear/Garbage/Top Out，并权威计算 T-Spin/B2B/Combo/Perfect Clear；旧 v2 客户端回退 v1 Coordination |
| C→S | `xiangqi_action` | `xiangqi-rule-v2` 的 `from/to/seq`；服务端验证九宫、河界、马腿、象眼、炮架、将帅照面、Check/Terminal 并推进棋钟 |
| C→S | `monopoly_action` | `monopoly-rule-v2`；服务端 Seeded Dice、移动、现金、产权、租金、机会卡、拍卖、破产与名次 |
| C→S | `monopoly_auction_open` / `monopoly_bid` / `monopoly_turn_end` | 大富翁实时拍卖、revision 出价、服务端截止与回合稳定点 |
| C→S | `tournament_create` / `tournament_consent` / `tournament_start` / `tournament_next` / `tournament_get` | 3–4 人循环赛、5+ 三轮瑞士制；全员同意后自动建真实房、分配玩家、接收单盘服务端结果并推进下一轮 |
| C→S | `restart` / `end_game` | 房主发起新一局或结束本局 |
| C→S | `solo_start` / `solo_progress` | 已认证人机对局获取服务端票据，并上报由合法游戏动作产生的有效进度 |
| C→S | `result` | 联机携带 `matchId` 与完整结果 claim，所有参与者一致后才结算；人机携带服务端签发的 `matchId/resultId` 与胜平负 |
| C→S | `purchase` | 服务端按商品目录和余额原子购买（requestId 幂等） |
| S→C | `hello_ack` / `registered` / `logged_in` / `logged_out` / `auth_error` | 认证状态、稳定错误 reason 与服务端签发 token |
| S→C | `username_status` / `guest_logged_in` / `companion_checkin_ok` | 查重结果、临时访客身份与 Honru 签到幂等结果 |
| S→C | `chat_state` / `chat_history` / `chat_message` / `chat_send_ok` / `chat_read_ok` / `chat_error` | 服务端权威消息 ID、十进制字符串 seq、时间、发送者、未读/已读与稳定错误 reason；正文只发给会话参与者 |
| S→C | `lobby` | 可加入的等待房与可观战的进行中房间列表 |
| S→C | `created` / `joined` / `room_update` / `started` | 加房结果、房间实时状态和开局信息（含 `matchId`） |
| S→C | `player_reassigned` | 有成员离房并压紧席位后，通知仍在房间中的客户端更新玩家索引 |
| S→C | `restart` / `end_game` | 房主操作广播：以新 `matchId` 重开，或结束本局回到选游戏状态 |
| S→C | `leaderboard` | 全球排行榜 |
| S→C | `invite` | 收到邀请 |
| S→C | `peer_left` | 成员主动离开；仍有真人时 `roomClosed=false` 并保留房间/转移房主，最后一个真人离开时 `roomClosed=true` |
| S→C | `peer_status` / `rejoined` / `reconnect_expired` / `resume_expired` / `host_changed` | 掉线等待、令牌重连、权威快照/稳定快照恢复、超时释放与房主转移 |
| S→C | `spectate_joined` / `spectator_error` / `match_result` | 观战初始快照、只读保护与最终结果 |
| S→C | `tank_snapshot` / `tank_result` | Tank 权威状态、ack 和最终排名 |
| S→C | `tetris_battle` / `tetris_garbage_due` / `tetris_ko` / `tetris_result` | Tetris Battle Coordination Authority 事件 |
| S→C | `tetris_rule_state` / `tetris_rule_battle` | Tetris v3 Advanced Battle 完整规则状态、hash、计分与垃圾事件 |
| S→C | `xiangqi_rule_state` / `xiangqi_result` | 象棋 v2 权威棋盘、棋钟、Check/Terminal 与结果 |
| S→C | `monopoly_rule_state` / `monopoly_result` | 大富翁 v2 权威棋盘经济状态、Server RNG 与结果 |
| S→C | `clock_state` / `clock_timeout` | 象棋服务端棋钟基准与超时结果；不代表服务端验证完整象棋规则 |
| S→C | `auction_open` / `auction_bid` / `auction_closed` | 大富翁服务端拍卖状态、竞价与产权结果 |
| C↔S | `tournament_forfeit` / `tournament_forfeited` / `tournament_recover` / `tournament_recovered` | 参赛者仅可为自己弃权；管理员必须指定判负目标；赛事积分不进入普通 💵/XP/胜场 |
| S→C | `tournament_state` / `tournament_match_assigned` / `tournament_bye` | 赛事状态、自动房间分配、轮空、积分与排名 |
| C↔S | `replay_list` / `replay_get` / `replay_share` / `replay_unshare` | 7 天回放、公开延迟、参与者分享/撤销、令牌哈希与权限检查 |
| S→C | `gameplay_error` | 统一 `protocol/code/message/reason` 错误；覆盖协议版本、非法/重复/过期动作等 |
| S→C | `solo_started` | 下发人机对局的服务端 `matchId/resultId` 票据 |
| S→C | `result_pending` / `result_ok` / `result_error` | 结算共识状态；`result_ok.payload.reward` 含当前玩家完整 Reward Breakdown |
| S→C | `profile_data` / `profile_ok` / `purchase_ok` / `purchase_error` | 档案与购买结果 |

正式账号的会话 token 默认有效 30 天（可通过 `AUTH_TOKEN_TTL_MS` 调整）；每个账号最多保留最近 5 个有效 token。新会话超过上限时淘汰最旧 token，`logout` 只撤销当前 token。访客 token/账号不持久化：显式退出立即删除，异常断线仅保留 60 秒重连窗口。

## 奖励与成长（Economy & Progression v1.0）

- 联机 1v1：胜/平/负为 `3/2/1💵` 与 `12/10/8 XP`。
- 3–5 人联机：第 1/2/3/其他名次为 `4/3/2/1💵` 与 `14/12/10/8 XP`。
- AI：胜/平/负为 `1/0/0💵` 与 `8/6/5 XP`，每账号每天通过 AI 触发的最终货币总额最多 `3💵`（含等级里程碑）；达到上限后仍得 XP。
- 每日首次有效联机胜利额外 `+2💵/+5 XP`；3/5/8+ 连胜额外 `+2/+4/+6 XP`。
- 每日任务由服务端按 `taskKey + date + claimId` 记录进度与领取，正式奖励进入经济流水；Replay v1.1 保存 7 天，支持列表、播放/暂停、进度、倍速、公开延迟和可撤销分享链接。
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

后端也支持 `DATA_DIR`（测试或持久磁盘路径）和 `ALLOWED_ORIGINS`。`POST /api/ai` 与 `POST /api/companion` 都要求 Bearer token，并带 Origin、请求体大小、并发、速率和超时限制。默认模型为 `deepseek-v4-flash`，只允许通过服务端 `DEEPSEEK_MODEL=deepseek-v4-pro` 切换；6 款游戏仍只把合法近优选项交给模型，客户端会再次精确校验返回值。无 Key、断网、限流或非法响应时游戏使用本地强算法，Honru 使用本地安全回复。生产环境绝不能把 DeepSeek key 放到前端。

运营指标需单独配置高熵 `METRICS_ADMIN_TOKEN`，可与 `RENDER_KEY` 一起交给 `node scripts/render-env.js` 写入 Render。`/api/metrics`、`/api/metrics/history`、`/api/metrics/export` 均要求 Bearer 管理员令牌，并提供限频、脱敏访问审计、有界历史、CSV 导出、阈值告警和脱敏错误聚合；只读页面为 `/admin-metrics.html`，令牌只保存在页面内存。未配置令牌时 API 返回 503。当前 Render 未挂载持久磁盘，跨重启长期历史仍需外部持久化后端。

## 白皮书 × 美术资源运行时

- `public/assets/manifests/asset_manifest.json` 锁定 6 个游戏 runtime ID、平台 asset ID、状态、fallback 和 a11y 语义。
- 首批已接入 `public/assets/brand/` 品牌 SVG 与 `public/assets/ui/currency_cash.svg`；Header、Hero、商城、排行榜与结算统一显示 💵。
- 六款游戏都已接入 640×360 / 320×180 响应式大厅封面；五子棋与俄罗斯方块从旧版升级，飞行棋、大富翁、坦克和象棋补齐封面。当前六图是可回滚的软 3D 过渡批次，不等同于最终游戏包或 Sticker Cartoon Golden Set。
- 五子棋木纹 Canvas 与俄罗斯方块玻璃井两个旧纵切继续保留，规则、快照、AI 与联机协议不包含美术状态。
- 两款纵切可分别用 `mg_art_gomoku_v1`、`mg_art_tetris_v1` 本地 flag 回滚；关闭只影响绘制层，不改变规则、快照或联机协议。
- 注册与商城完成产品级重排：48 款 Avatar v2（12 免费/36 商城）、单一滚动容器、五档响应式、主预览/试穿、单例弹层、服务端价格对齐和三语言商品/辅助文本。
- `asset-library/` 是本地 provenance sidecar，分别校验目录与许可证哈希；`asset_manifest.json` 仍是唯一运行时机器事实源。未冻结对象存储提供商、许可、生命周期与凭证前不上传外部桶。
- `Pocket Tabletop Sticker × Expressive Sticker Cartoon` M0 已进入 Draft：Art Bible v1、Facial Kit 16×3、Design/Motion、Source Manifest v2、Teacher 八状态与四 Avatar Alpha 源、Core UI 状态板、精确五子棋 15×15/五连和飞行棋 52 格/每方四机规格均已落地并通过 `test:sticker-art`。生成式规则错误稿已排除；人工清稿、IP 双人审查、运行时集成和 Golden Set 人工决议仍未执行，所有新旗标默认关闭。
- Honru 九状态已有默认关闭的 P2 运行时预览：只有 `mg_art_honru_states_v1=1` 与 `mg_art_honru_game_reactions_v1=1` 同时存在时才加载当前状态 WebP；失败回退 v1，不进入规则、AI、联机、Replay 或奖励。人工/IP/真实设备验收前不得默认开启。
- 所有美术资源保留 CSS / Canvas / DOM Emoji / WebAudio 回退，资源加载失败不能阻塞大厅或开局。

### 数据库（Supabase）
`supabase/schema.sql` 可重复执行建表/迁移，创建奖励/购买/AI 学习/Direct Chat RPC，以及 `cluster_instances`、fencing lease、持久事件/游标和 `metrics_snapshots`；全部敏感表启用 RLS 并撤销 `anon`/`authenticated` 访问。

1. 设置只存在于本机进程的 `SUPABASE_DB_URL`，运行 `scripts/supabase-production-ops.ps1`；默认仅显示计划，`-Execute -Action migrate` 才会先加密备份、事务迁移并执行生产验收。
2. 用隔离临时数据库运行 `restore-drill`，再运行真实并发/RLS 验收；`rollback` 只撤销本轮 Cluster RPC 并过期租约，不删除用户数据。
3. 将项目 URL 与 secret `service_role` key 写入 Render 的 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`，运行 `node scripts/supabase-status.js`。浏览器绝不能接触 service-role 或 DB URL。
4. 全部真实证据通过后才设置 `ENABLE_CLUSTER_COORDINATION=1`；否则 Render 保持单实例和现有 JSON fallback。

`history` 是兼容结算流水：联机对局按每位参与者各写一行（同一 `match_id` 可有多行），AI 对局写一行；`result_id` 用于幂等去重。`reward_history` 保存资格、阻断原因、对手组合、基础与最终奖励、等级/连胜前后值和明细；`economy_ledger` 审计每次正式 💵 增减；`analytics_events` 保存比赛与奖励事件。

`profiles.wins` / `profiles.total_wins` 分别保存按游戏胜场和总胜场；服务端/API 对应 `wins` / `totalWins`，不得由余额推导胜场。正式奖励统一调用 `apply_reward_v1`：按账号加事务锁、以 `result_id` 幂等校验，并在同一事务中更新 `profiles`、写入 `history`、`reward_history` 和可选 `economy_ledger`；`analytics_events` 仍为独立埋点写入。

`profiles.game_cosmetics` 保存 `cosmeticSchemaVersion=1` 的公开已装备游戏外观 ID。未知 ID 在服务端回退默认值；比赛 Metadata 只广播装备 ID，不含 `owned`、余额、价格或购买记录。商城已提供六款游戏外观的筛选、预览、服务端权威购买、装备和默认回退入口。

`profiles.solo_rate` 保存服务端维护的人机结算频控时间戳，首胜日期与 AI 日货币累计也只由服务端更新，均不属于客户端可写档案字段。正式奖励会先写入本地 outbox；Supabase 事务短暂失败后会以相同 `result_id` 自动重试，`applied` 或匹配 `resultId` 的 `duplicate` 都是成功终态。当前 Render 单实例且未挂载持久磁盘，outbox 只能覆盖进程存活期/正常重启场景，不能替代真实 Supabase；扩容多实例前还必须把 Reward Resolver 迁移为数据库内权威计算或增加版本冲突重算。没有真实 Supabase 凭证时，可运行 `node --experimental-websocket qa/supabase-adapter.js`，用本地 fake PostgREST 验证字段映射、单事务 RPC payload、幂等重试和空库迁移行为；它不能替代真实项目的 SQL、并发、连通性与 RLS 验收。

AI 学习模型与经验在 `apply_ai_learning_v1` 中按账号+游戏加锁，以 `result_id` 幂等并校验 revision；服务端 outbox 会在 Supabase 暂时不可用时排队。当前 Render 单实例且未挂载持久磁盘，JSON/outbox 不能替代真实 Supabase；真实项目仍需执行迁移、RLS、并发、备份和回滚验收。

玩家私聊在无 Supabase 时使用本地 JSON 的 90 天/每会话 500 条/全局 50,000 条有界回退；启用 Supabase 后，发送必须先通过数据库内好友/Block/幂等事务并持久化成功才回执，已读游标只允许推进到本人真实收到的消息。消息正文不进入 Profile、排行榜、Replay、Analytics、普通日志或浏览器 `localStorage`。真实 Render 持久化仍以执行本次 schema 迁移并完成 staging 并发/备份回滚验收为前提。

跨实例基线启用后使用数据库时间租约与 fencing token；Direct Chat 事件只发布消息 ID 和参与 UID，消费实例再从数据库取正文并重新校验有效 session。聚合 Metrics 可写 `metrics_snapshots` 并投递到显式 HTTPS 域名 allowlist；重定向、私网/回环、秘密字段与聊天正文均拒绝。没有真实迁移时这些功能保持关闭。

30 分钟正式好友 WS 会话默认只连接本机：`npm run synthetic:30`。若明确测试生产 Render，必须同时传入生产 WS URL 并设置 `SYNTHETIC_PRODUCTION_CONFIRM=CREATE_PERSISTENT_QA_ACCOUNTS`；脚本会创建两个永久 QA 账号、好友关系和低频持久消息，因此不能作为无副作用冒烟误运行，也不能替代浏览器 UI 或真机验收。

### PWA / 跨平台 Web

`public/manifest.webmanifest` 与 `public/sw.js` 提供 Ghost Game 安装型 PWA：HTML network-first、版本化静态缓存和昼夜主题色；API、WebSocket、Authorization、token/session/message/chat 不缓存。这是桌面/移动 Web 安装基线，不等于微信小程序、原生 App 或商店发布。

## 开发原则

- **零 npm 依赖** — 手写 WebSocket，纯 Node 测试
- **单页构建产物** — `public/index-template.html + public/src/*` 构建为 `public/index.html`
- **三语言全量覆盖** — 静态文案使用 `data-i18n*`，运行时文案使用 `t()` / `setLocalizedText()`，服务端错误使用稳定 reason；用户昵称等原文节点标记 `data-i18n-raw`。新增或修改界面文字后必须同步三份 locale，并运行 `npm run test:i18n`
- **商城与素材契约** — 修改商品目录或资产索引后运行 `npm run test:shop-contract`、`npm run test:asset-library` 与 `npm run test:ui-responsive`
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
- 浏览器：本地 in-app Chromium 已完成当前 P0 的 1440/768/481/390/360 注册、商城、大厅、六封面、英/乌语言、overflow、44px 控件、单例与滚动锁验收，控制台无 warning/error；证据在 `deliverables/visual-qa/visual-commerce-p0-20260808/`。
- 已执行：30 分钟生产正式好友 WebSocket 会话通过（15 条消息与已读、2 次重连、0 异常断开、P95 181ms）；逻辑 Chaos、完整 `npm test` 与 Quality Gates 通过。
- 未执行：本轮 Chat/Profile 的当前浏览器矩阵（连接器需重启 Codex 后使用已配置 Node 24）、Android Chrome、iPhone Safari、Tablet、第二桌面浏览器、真实 `tc/netem`、真实 Supabase/RLS/并发/备份回滚。
- 因真实设备发布闸门未完成，当前结论是 `AUTOMATED_VERIFIED`，Release Candidate 总状态仍为 `BLOCKED`，不能写 `PRODUCTION_READY`。
