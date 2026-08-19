# Mini Games Platform 🎮

> Ghost Game（临时品牌名）— 6 款精选插件化游戏与原创助手 Honru，先看到人，再看到游戏。
> 体验目标：打开约 3 秒开局 → 约 5 分钟一局 → 立刻再来。

线上试玩：https://honru09.github.io/mini-games/
后端地址：https://mini-games-online.onrender.com

---

## 当前 Gate 与发布边界

- 原创 Ghost-native 资产通过 `OWNER_AUTHORIZED_ART_CLEARANCE` 进入可逆的 default-on runtime 候选；人工清稿、独立自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 只是 `OPTIONAL_ADVISORY_EVIDENCE`，不是开发、runtime 或未来发布的前置条件，也不得伪造为 PASS。
- `GATE-DEVICE-BROWSER-NETWORK` 与 `GATE-SUPABASE-PRODUCTION` 均为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；缺少第二浏览器、真机、真实网络或生产 Supabase 证据不阻塞本地开发，但不得冒充跨设备或生产验证。
- 外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材仍不具备发布授权，只保留 URL/hash/许可元数据登记，不进入任何分析/生成输入。源像素/图层不得直接进入 runtime，外部影响候选先保持 source-only 并完成相似风险复核。
- 任何本地 `implemented/verified` 或所有者清除都不自动触发发布；commit、push、Pages 或 Render 仍只能由当前用户明确命令授权。

当前本地权威构建为 2,006,468 characters / 2,021,091 bytes / SHA-256 `F03FD5D382095770B36DF0D3A32654F8E435556D800D96F310FF90EA721C4844`，保持 `LOCAL_ONLY / NOT_RELEASED`。`915A97F3…B8C8EFC` 的单一 Codex in-app Chromium 五档四区、共享表面、六款 Game Stage、三语、双主题、visible reduced-motion 与 forced-colors 可见矩阵已降为 historical-as-of；当前构建尚无匹配的浏览器完整矩阵，第二浏览器、真机、真实网络和生产 Supabase 仍只是发布证据待决。技术优化 T7 已完成六类 Server Boundary、Node fresh-child 隔离，以及只覆盖 Operational Metrics `now/cadence` 的 Clock/Timer P6 窄纵切；Reward 数值/profile projection、Metrics `generatedAt` 与其余 server-wide clock/Timer 仍待后续，整体继续为 `partial`。

## 平台特色

- 🎯 **Fast Fun Loop**：目标约 3 秒入局、约 5 分钟一局；当前线上冷启动与真实设备仍需专项实测
- 🌐 **三语国际化**：中文 / English / Українська，Settings 一键切换
- 🏳️ **语言旗帜**：个人档案、排行榜、房间大厅实时显示
- ⚙️ **Settings 设置页**：白天云海 / 黑夜星空双主题、三语言、联机地址
- 🧭 **四区应用外壳**：Home / Games / Playline / Profile；手机使用底部四项导航，平板与桌面使用顶部导航
- 🚀 **首页下一步**：三步轻引导、按既有战绩推荐游戏、level/streak 目标与访客安全入口；推荐后把键盘焦点落到对应游戏卡
- 🎨 **Design System**：统一间距（4px 刻度）/ 字号 / 色彩令牌，卡片入场动画、按钮光效、胜负彩带、WebAudio 轻音效（零资源）
- 🎬 **动效 + 手感**：统一 Motion 动效库（转场/入场/弹性/Loading）、6 款游戏全量操作反馈（音效+震动+状态提示）、棋盘棋子立体质感
- ✨ **个性化**：动态头像框（8 款含流光/烈焰/彩虹/赛博脉冲）、闪名（4 种特效）、动态档案背景（星空/樱花/赛博矩阵/海浪）、等级进度条
- 🔐 **用户名密码账号**：用户名大小写不敏感唯一，密码使用随机盐 scrypt 慢哈希；旧 PIN 账号可原 UID 迁移
- 👻 **一次性访客**：服务端签发临时身份；退出立即删号，不进入持久库、排行榜、永久购买或持续 AI 学习
- 📨 **全局玩家私聊**：正式好友一对一纯文本消息收进全局 DM dialog，不再占独立 Page；离线留言、历史分页、账号级未读/已读、多会话同步继续复用 `direct-chat-v1`
- 🪐 **Playline 社区纵切**：本地 P0 提供 All/Friends、纯文本、游戏/正式结果/权威记录分享、删除、举报与 Block；`ENABLE_PLAYLINE_V1` 默认关闭，真实生产开放仍等待持久化与内容治理门禁
- 💬 **局内玩家交流**：`match-expression-v1` 提供白名单 Emoji/快捷语，`match-chat-v1` 提供当前对局 50 条有界文字历史、未读、头像旁气泡、举报和静音；服务端执行身份、净化、幂等、频控、Block 与观众延迟，正文不进入 Replay、奖励、AI、Analytics 或持久库
- 👻 **Honru 品牌角色**：保留每日签到与品牌形象；所有者已清除的九状态和十枚 Emoji 以 Manifest default-on runtime 候选接入，并保留独立 kill switch 与 SVG/Unicode/文字 fallback。前端助手聊天框已移除，Direct Chat 和 match-chat 仍是纯文字
- 🎮 **Game Stage Wave B（本地未发布）**：五子棋强化棋盘状态/最后落子层级，Tetris 拆分主井、Hold/Next/Incoming、对手 HUD 与七项控制；严格保留 Wave A 回滚和全部规则/协议边界
- 🎲 **沉浸式 Game Shell**：六款游戏进入 fixed `100dvh` 全视口对局；真实 Seat Rail、Arena、Command Tray 均在 Shell 内，页面滚动/回弹被锁而内部区域可滚，桌面、平板、手机横竖屏均有独立布局
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
node qa/pwa-offline-i18n.js
node qa/dom-smoke.js
node qa/game-stage-contract.js
node qa/monopoly-character-presentation.js
node qa/monopoly-presentation-adapter.js
node qa/social-match-client-lifecycle.js
node qa/match-chat-contract.js
node --experimental-websocket qa/match-chat-online.js
node qa/tabletop-art-runtime.js
node qa/ai-games.js
node qa/ai-strength.js
node qa/ai-learning.js
node --experimental-websocket qa/ai-learning-online.js
node qa/gameplay-upgrade.js
node qa/tank-controls.js
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
| C→S | `playline_list` / `playline_publish` / `playline_remove` | `playline-v1`：读取 All/Friends、发布四类受限动态和幂等删除；作者、可见性、引用快照、时间、游标、频控与 Block 由服务端权威裁决，默认关闭 |
| C→S | `match_expression` | `match-expression-v1`：正式真人玩家发送白名单 Emoji/快捷语；服务端校验 match、eventId、目标、频控与 Block，并权威签发发送者/席位/时间；能力属于连接级协商状态，同一连接内会话失效/注销/房间重置不会丢失 |
| C→S | `match_chat_send` / `match_chat_sync` | `match-chat-v1`：正式真人玩家发送局内自由文本或同步本局最近 50 条；NFC/控制符净化、160 字/4 行、messageId 幂等、频控、Block 与观众/访客只读由服务端权威处理 |
| C→S | `profile_get` / `profile` | 查询档案；仅修改 name/lang、本人平台外观与白名单 `gameCosmetics` 装备，不能写金币、owned、XP、胜场、局数等权威字段 |
| C→S / S→C | `profile_compare` / `profile_compare_data` / `profile_compare_error` | Profile Compare P1：仅正式好友且双方未 Block 可读取窄化比较投影；回执绑定 requestId/targetUid，只含身份、等级、总局数/胜场、六款胜场/称号与成就数量 |
| C→S | `create` / `join` / `leave` | 创建、加入、主动离开房间或观众席 |
| C→S | `spectate_join` / `spectate_leave` | 进入/离开独立观众席；不占玩家位、不能发送游戏输入 |
| C→S | `invite` / `invite_accept` / `invite_decline` | 邀请及应答 |
| C→S | `select_game` | 房主选游戏 |
| C→S | `start` | 房主开始 |
| C→S | `move` / `game_state` | 回合制走子与稳定点快照；服务端记录有限 moveLog 并附带可信 `player`；Tank/Tetris 正式路径另用权威协议，旧 relay 仅兼容 |
| C→S | `tank_input` | `tank-authority-v1` 单调输入序列；坐标、炮弹、伤害、重生和最终排名由 20Hz 服务端模拟决定；`tank-snapshot-delta-v2` 只属于 S→C 快照传输能力，不替换该输入协议 |
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
| S→C | `playline_state` / `playline_publish_ok` / `playline_remove_ok` / `playline_invalidated` / `playline_error` | viewer-specific 动态投影、签名 cursor、幂等发布/删除回执与失效通知；guest/test-admin/伪造结果或记录/篡改游标拒绝 |
| S→C | `match_expression` / `match_expression_ok` / `match_expression_error` | 局内表达事件、幂等回执与稳定错误；接收前按每个玩家重新执行 Block，观众只读且遵循延迟；不进入 Replay、规则、奖励或数据库 |
| S→C | `match_chat_state` / `match_chat_message` / `match_chat_ok` / `match_chat_error` | 本局房间文字历史、实时消息、幂等回执与稳定错误；服务端签发 sender/seat/time，观众延迟接收，逐接收者 Block 过滤；不进入 Replay、规则、奖励、AI、Analytics 或数据库 |
| S→C | `lobby` | 可加入的等待房与可观战的进行中房间列表 |
| S→C | `created` / `joined` / `room_update` / `started` | 加房结果、房间实时状态和开局信息（含 `matchId`） |
| S→C | `player_reassigned` | 有成员离房并压紧席位后，通知仍在房间中的客户端更新玩家索引 |
| S→C | `restart` / `end_game` | 房主操作广播：以新 `matchId` 重开，或结束本局回到选游戏状态 |
| S→C | `leaderboard` | 全球排行榜 |
| S→C | `invite` | 收到邀请 |
| S→C | `peer_left` | 成员主动离开；仍有真人时 `roomClosed=false` 并保留房间/转移房主，最后一个真人离开时 `roomClosed=true` |
| S→C | `peer_status` / `rejoined` / `reconnect_expired` / `resume_expired` / `host_changed` | 掉线等待、令牌重连、权威快照/稳定快照恢复、超时释放与房主转移 |
| S→C | `spectate_joined` / `spectate_left` / `spectator_error` / `match_result` | 观战初始快照、离席确认与本地状态清理、只读保护及最终结果 |
| S→C | `tank_snapshot` / `tank_result` | Tank 权威状态、ack 和最终排名；已协商且服务端显式开启时 `tank_snapshot` 可携带 `tank-snapshot-delta-v2` keyframe/delta，客户端先恢复为完整 v1；默认关闭、旧客户端始终收到完整 v1 |
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
| S→C | `profile_data` / `profile_ok` / `purchase_ok` / `purchase_error` | 档案与购买结果；购买回执关联 `requestId/category/id`，便于 UI 丢弃迟到或错配状态 |

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
- Progression Identity P1 在本地按六款游戏分别提供 `1/10/50/100/1000` 胜场称号：服务端从权威 `wins` 确定性派生，旧账号无需迁移；本人主页显示当前称号和下一目标，他人公开档案显示已解锁称号。称号不另存数据库，不修改奖励或胜场写入，也不能由客户端 profile 伪造。

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

- Player Character P0（SOC-031）已本地实现：服务端 `player-character-v1` 深模块统一 schema/catalog/default、未知输入回退和隐私裁剪；公开 Profile/Room Seat/重连只广播稳定角色与 slot ID，客户端仅只读缓存，不能通过 Profile mutation 伪造装备。专项 15 项、Social Match Seat 回归、Security/Reconnect/E2E、三语、DOM、Quality Gates 和完整 `npm test` 通过。角色美术、商城装备、真实 Supabase/真机/网络整形仍未闭环；未提交、推送或部署。

- UI-037 / GAME-045 已完成本地代码原生表现与状态矩阵收口：`MonopolyCharacterPresentation.project()` 负责公开角色 fallback、权威/视觉位置、阶段状态、朝向与 reduced-motion；`MonopolyPresentationAdapter` 校验 `matchId/revision/stateHash`，只在连续合法 `transition.move` 时生成逐格计划，重连/观战/乱序/跳 revision 一律 snap；`MonopolyUiState` 和局内状态栏覆盖进入、回合、移动、落点、机会卡、买地、支付、拍卖、破产、断线、重连、观战、结算和安全回退，拍卖倒计时与机会卡 dialog 均保持只读/服务端权威。现有根级 transition 只在表现层消费，规则、奖励、Replay、AI、商城和数据库不变；ART-036 方向板在取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 且完成 Manifest/flag/fallback QA 前保持 source-only，真实设备/浏览器只是发布证据待决。

- `public/assets/manifests/asset_manifest.json` 锁定 6 个游戏 runtime ID、平台 asset ID、状态、fallback 和 a11y 语义。
- 首批已接入 `public/assets/brand/` 品牌 SVG 与 `public/assets/ui/currency_cash.svg`；Header、Hero、商城、排行榜与结算统一显示 G Coins。内部余额字段仍兼容 `coins`，旧 `💵` 只保留为资源失败 fallback。
- G Coins 是 Ghost Game 平台内虚拟货币，仅限站内使用，不可兑换现金、不可提现、不可转赠；`P-GCOINS-ICON-V1` 已取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，以 `mg_art_gcoins_p1_v1` Manifest-backed default-on 接入当前本地可逆 runtime，加载/解码失败回退 `P-003` 再回退 `💵`。源稿 `ART-026-GCOINS-P1-CANDIDATE-B` 仍保留在 `art-source/` 为 reference-only；人工清稿、Reviewer B、IP/法律与 Golden Set 只是可选咨询，第二浏览器、真机、真实网络与发布仍待证据。
- 测试管理员由服务端四个环境变量精确绑定，私有界面显示无限 G Coins、MAX 等级和测试徽章；公开档案、排行榜、Presence、Lobby、持久社交、正式经济、Replay、AI 学习和 Analytics 均保持隔离。提交 `da3d05c` 已在 Render/Pages 上线，浏览器与临时访客隔离烟测通过；凭证不进入仓库，关闭 `TEST_ADMIN_ENABLED` 并重启即可回滚。
- 商城购买反馈已在本地接入现有服务端权威：按钮显示处理中，成功/失败进入可访问 live status；回执按 `requestId + 账号 + 商品` 关联，重复点击、迟到响应、关闭商城、断线与注销不会污染下一笔购买。价格、扣款和 owned 仍只由服务端决定。
- 六款游戏都已接入 640×360 / 320×180 响应式大厅封面；五子棋与俄罗斯方块从旧版升级，飞行棋、大富翁、坦克和象棋补齐封面。当前六图是可回滚的软 3D 过渡批次，不等同于最终游戏包或 Sticker Cartoon Golden Set。
- 五子棋木纹 Canvas 与俄罗斯方块玻璃井两个旧纵切继续保留，规则、快照、AI 与联机协议不包含美术状态。
- 两款纵切可分别用 `mg_art_gomoku_v1`、`mg_art_tetris_v1` 本地 flag 回滚；关闭只影响绘制层，不改变规则、快照或联机协议。
- Game Stage + Tabletop Wave A 已默认启用：共用 Stage/Seat/Command 与六款底材/核心实体按冻结矩阵达到 `52/100`；只有 `mg_art_tabletop_wave_a='0'` 才回退旧表现。
- Tabletop Presentation M1 第一纵切已在本地完成：五子棋第二席 180° 近端视角，飞行棋按本人 2/3/4 人阵营旋转到统一近端；标准规则坐标、协议、快照、Replay、奖励、AI 与观众公共视角保持不变。专项与完整 `npm test`、连续默认参数 E2E、双构建通过；当前未提交、未推送、未部署。动作表现和外部设备/浏览器闸门另行排队。
- Tabletop M1 的代码原生动作/收尾也已本地完成：五子棋墨线冲击替代红框，飞行棋保留标准路径移动/碰撞/到达，两个棋盘有 reduced-motion 安全入场，飞行棋结算按真实 placement 显示 2/3/4 人三语排名台；规则、协议、奖励和未取得所有者清除的原创素材边界不变。
- Progression Identity P1 已本地完成：六款各有五级权威胜场称号，共 30 个三语名称；本人主页/公开 Profile 已接入，异常输入与客户端伪造被拒绝。完整测试和双构建通过，外部浏览器/真机可见验收与正式图片徽章审批仍独立开放。
- ECO-017/UI-025 Profile P1 已完成两段安全纵切：Journey 三目标卡与正式好友窄化战绩比较。比较权限由服务端按正式账号、当前好友和双向 Block 重新校验，不复用公开 `profile_get`，也不返回余额、owned、任务、回放或在线偏好。
- Profile Modal A11y P1 已统一旧 Profile 编辑器/成就弹层的 dialog、初始焦点、Tab、Esc、背景关闭、滚动锁、焦点恢复与手机滚动/44px 控件；保存、取消和关闭均走同一幂等生命周期。
- Collection Rarity Catalog P1 已显式编目 150 项稳定资产 ID；本人 Profile 显示收藏分布，商城卡显示三语 Starter/Uncommon/Rare/Epic。目录不读取价格，不影响购买、拥有、装备或服务端字段。
- Home Engagement P1 已本地收口：仅正式账号显示已有在线好友数、本人收藏编目进度和既有成长方向，复用 Profile/Chat/Shop；访客隐藏。关闭状态使用每账号固定 `localStorage` key、以本地日期为 value，主审已补跨日期有界存储回归。无 server、protocol、economy、purchase、rules、AI、Replay、Supabase 或 art 变化；UI-010/ECO-023 仍为 `partial`，真正可恢复对局须另立权威恢复合同。完整 `npm test`（179.7 秒）和双构建通过，未提交、未推送、未部署。
- Home Identity P1 已本地收口：在既有正式账号脉冲内加入 56px 已装备头像组合、raw 昵称与本地化 `Lv.N`，继续复用收藏 X/Y、Profile/Chat/Shop；访客/未登录不读取 `owned` 或调用身份 helper，catalog 异常安全降级。完整 `npm test`（120.7 秒）和双构建一致：971303 characters、985572 bytes、SHA-256 `963DEAEFC5B46621ACCE9B713444D3F3B7F5DC41C775990CD87BE36E501D69FF`。UI-011 仍为 `partial`，G Coins/角色服装/背景与正式获得路径另有门禁；下一主线是只返回当前仍有效的同实例对局，不承诺跨设备/跨重启恢复。未提交、未推送、未部署。
- Home Active Match Return P0 已本地收口：仅对仍连接/认证、非观众、真人席位、同一内存游戏实例且未结算的联机对局显示返回入口；点击重新校验 matchId 后只复用 `showGame()` fast path。结算/离房/过期/reset/replay/reconnect/异常 seat/stale click 均隐藏或 no-op，不新增协议、持久化、奖励或 Replay。完整 `npm test`（199.8 秒）和双构建一致：974130 characters、988467 bytes、SHA-256 `8ECE8C16D5AE051DE59A31D9FA14949FF607675504059BC26BD050BE505F81E8`。它不是跨设备/跨重启的 durable recovery；未提交、未推送、未部署。
- 手机 Tetris 将主井与对手预览改为单列/自适应网格，Arena 不再横向滚动，七项操作保持至少 `44×44px`。
- 注册与商城完成产品级重排：48 款 Avatar v2（12 免费/36 商城）、单一滚动容器、五档响应式、主预览/试穿、单例弹层、服务端价格对齐和三语言商品/辅助文本。
- UI Repair P0.1 已在本地实现：Canvas/Avatar v2 统一圆形裁切与 Frame/Effect 层级，环绕特效不再旋转头像本体；商城用真实背景、Avatar、Frame、Effect、NameFx 组合预览，动态背景支持真实 WebP 播放/暂停、poster/fallback、离屏清理和 reduced-motion。专项/完整测试与 1280×720 双主题三语浏览器通过；Header 遮挡 Modal 的层级问题已由 P0.2 解决。
- UI Repair P0.2 已完成本地验收：全局 Header/Nav/Modal/Auth/Toast 层级稳定；Room Launchpad 支持按游戏严格容量、公开/私密、观战、6 位房间码和统一错误态；Lobby 显示等待/进行中、真人/AI、观战与房主资料，只使用服务端 Join/Spectate 权限并过滤当前玩家/观众房；普通用户 Tournament UI 默认隐藏且换号后重新由服务端授权；Ghost Game 三语副标题更新。四档真实视口、双主题、三语、两标签等待/进行中/观战、完整 `npm test` 与双构建 Hash 通过；仍未提交、推送或部署。
- Tank Controls P0 已完成本地实现与自动化验收：八扇区/斜向 Pointer Capture 摇杆、跟手方向反馈、独立多指开火、四方向 D-pad 降级、键盘按住、失焦/切后台/销毁释放、44px/safe-area/reduced-motion；复用既有 `tank-host-relay-v1` / `tank-authority-v1` 输入对象和单调序列，没有服务端或规则改动。专项、Tank Authority、Gameplay、联机 E2E、三语、DOM、响应式、Immersive Shell、Quality Gates、完整 `npm test` 通过；localhost 浏览器访问被已保存权限拦截，真机/第二浏览器/网络整形未执行；Tank 皮肤与地图另属 ART-035；仍未提交、推送或部署。
- Tank Art P1 当前只完成 source-only 概念批次：内置 `gpt-image-2` 生成四套原创材质坦克与实体桌游竞技场清理版，同时保留带符号噪声的拒绝版作为审计证据。两版均有逐字 Prompt、模型、尺寸、SHA、许可和素材库条目，但状态是 `reference-only`，不在生产 Manifest；如果选为 runtime，必须先取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并补齐 Manifest/flag/fallback QA。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 只是可选咨询；本批未提交、推送或部署。
- `asset-library/` 是本地 provenance sidecar，分别校验目录与许可证哈希；`asset_manifest.json` 仍是唯一运行时机器事实源。未冻结对象存储提供商、许可、生命周期与凭证前不上传外部桶。
- `Pocket Tabletop Sticker × Expressive Sticker Cartoon` M0 视觉方向已由所有者确认：Art Bible v1、Facial Kit 16×3、Design/Motion、Source Manifest v2、Teacher 八状态与四 Avatar Alpha 源、Core UI 状态板、精确五子棋 15×15/五连和飞行棋 52 格/每方四机规格均已落地并通过 `test:sticker-art`。每个原创资产族在 runtime 接入前仍需自己的 `OWNER_AUTHORIZED_ART_CLEARANCE` 与 Manifest/flag/fallback QA；人工清稿、Reviewer B、IP/法律和逐资产 Golden Set 是可选咨询。
- Honru 九状态已按 `OWNER_AUTHORIZED_ART_CLEARANCE` 进入 Manifest-backed default-on 本地 runtime：主开关/局内反应开关、decode/资源失败与永久 v1 SVG fallback 仍可逆，不进入规则、AI、联机、Replay 或奖励。当前只有单 Chromium 窄范围可见证据，完整矩阵与发布证据仍待补齐。
- Honru Emoji P0 已按 `OWNER_AUTHORIZED_ART_CLEARANCE` 将十个稳定 `emojiId`、atlas/poster 和逐枚 provenance/SHA 接入 Manifest-backed default-on `match-expression-v1` 选择器、头像气泡和目标席位投掷；保留双 kill switch、严格 allowlist、decode/资源失败和 Unicode/文字 fallback。Direct Chat 与 match-chat 仍为纯文字；单 Chromium 窄证据不替代完整矩阵、真机或发布。
- `/api/companion` 与净化/限流/离线回退继续作为后端兼容和安全边界，但当前产品前端没有 Honru 对话入口；旧 `#/chat*` 会归一到 `#/playline` 并打开全局好友私信弹层。
- 所有美术资源保留 CSS / Canvas / DOM Emoji / WebAudio 回退，资源加载失败不能阻塞大厅或开局。

### ART-036 角色与大富翁美术源稿

- 已在 `art-source/` 生成玩家角色五姿态方向板和大富翁 24 格实体棋盘方向板，均为最高质量 `gpt-image-2`、完整 provenance、素材库 G-14/G-15 `reference-only`。`asset-library-audit` 与 `asset-manifest-v2` 通过；生产 Manifest、`public/assets`、角色 schema、Monopoly 规则和商城未变。棋盘实际输出 1254×1254，已保留为方向参考。runtime 接入需取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并完成 Manifest/flag/fallback QA；人工清稿、Reviewer B、IP/法律与逐资产 Golden Set 是可选咨询，真机视觉是发布证据。
- ECO-029 角色经济支线也已完成 contract-only 本地验收：默认商品目录为空，只提供纯 owned/equipped/requestId/公开投影适配器，不扣币、不发放、不持久化。真实商品必须在后续任务同步服务端价格与 Supabase 原子购买 RPC 后才能启用。
- `qa/monopoly-character-presentation.js`、`qa/monopoly-presentation-adapter.js`、`qa/social-match-client-lifecycle.js` 已纳入 `pretest` 与完整 `npm test`；代码原生 fallback 不是 ART-036 Golden Set 或正式商城完成证据。

### 数据库（Supabase）
`supabase/schema.sql` 可重复执行建表/迁移，创建奖励/购买/AI 学习/Direct Chat/Playline RPC，以及 `cluster_instances`、fencing lease、持久事件/游标和 `metrics_snapshots`；全部敏感表启用 RLS 并撤销 `anon`/`authenticated` 访问。Playline 生产能力默认关闭，静态/fake 合同不能替代真实 RLS、并发、备份与恢复验收。

1. 设置只存在于本机进程的 `SUPABASE_DB_URL`，运行 `scripts/supabase-production-ops.ps1`；默认仅显示计划，`-Execute -Action migrate` 才会先加密备份、事务迁移并执行生产验收。
2. 用隔离临时数据库运行 `restore-drill`，再运行真实并发/RLS 验收；`rollback` 只撤销本轮 Cluster RPC 并过期租约，不删除用户数据。
3. 将项目 URL 与 secret `service_role` key 写入 Render 的 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`，运行 `node scripts/supabase-status.js`。浏览器绝不能接触 service-role 或 DB URL。
4. 全部真实证据通过后才设置 `ENABLE_CLUSTER_COORDINATION=1`；否则 Render 保持单实例和现有 JSON fallback。

`history` 是兼容结算流水：联机对局按每位参与者各写一行（同一 `match_id` 可有多行），AI 对局写一行；`result_id` 用于幂等去重。`reward_history` 保存资格、阻断原因、对手组合、基础与最终奖励、等级/连胜前后值和明细；`economy_ledger` 审计每次正式 💵 增减；`analytics_events` 保存比赛与奖励事件。

`profiles.wins` / `profiles.total_wins` 分别保存按游戏胜场和总胜场；服务端/API 对应 `wins` / `totalWins`，不得由余额推导胜场。正式奖励统一调用 `apply_reward_v1`：按账号加事务锁、以 `result_id` 幂等校验，并在同一事务中更新 `profiles`、写入 `history`、`reward_history` 和可选 `economy_ledger`；`analytics_events` 仍为独立埋点写入。

### UI Repair P0.3–P0.9 本地收口

P0.3–P0.8 已收口 Chat 原文边界、公开 Profile、动态背景、访客 affordance 与商城层级。P0.9 继续升级玩家 Direct Chat 表现：会话连接/刷新 live status、aria-busy、未读语义、历史加载和日期分隔、加载旧页阅读位置保持、真实断线 pending 清理、移动 `enterkeyhint=send`、安全区和 overscroll。没有新增 WebSocket 消息，也没有改好友/Block/访客、正文净化、Supabase 或持久化。主负责人修正了滚动锚点过早消费和断线加载态两个边界；Chat 专项、旧合同、线上 Direct Chat、Social Match 生命周期、三语言、DOM、完整 `npm test`（113.2 秒）通过。构建 `public/index.html` 为 924691 bytes，SHA-256 `1E00C59C0C6E5FA197BD7C4DB2EA60795897A5CB2992340863FF5F78199133F5`。第二浏览器、真机/真实网络和 localhost 可见复核仍未执行；未提交、推送或部署。

`profiles.game_cosmetics` 保存 `cosmeticSchemaVersion=1` 的公开已装备游戏外观 ID。未知 ID 在服务端回退默认值；比赛 Metadata 只广播装备 ID，不含 `owned`、余额、价格或购买记录。商城已提供六款游戏外观的筛选、预览、服务端权威购买、装备和默认回退入口。

`profiles.solo_rate` 保存服务端维护的人机结算频控时间戳，首胜日期与 AI 日货币累计也只由服务端更新，均不属于客户端可写档案字段。正式奖励会先写入本地 outbox；Supabase 事务短暂失败后会以相同 `result_id` 自动重试，`applied` 或匹配 `resultId` 的 `duplicate` 都是成功终态。当前 Render 单实例且未挂载持久磁盘，outbox 只能覆盖进程存活期/正常重启场景，不能替代真实 Supabase；扩容多实例前还必须把 Reward Resolver 迁移为数据库内权威计算或增加版本冲突重算。没有真实 Supabase 凭证时，可运行 `node --experimental-websocket qa/supabase-adapter.js`，用本地 fake PostgREST 验证字段映射、单事务 RPC payload、幂等重试和空库迁移行为；它不能替代真实项目的 SQL、并发、连通性与 RLS 验收。

AI 学习模型与经验在 `apply_ai_learning_v1` 中按账号+游戏加锁，以 `result_id` 幂等并校验 revision；服务端 outbox 会在 Supabase 暂时不可用时排队。当前 Render 单实例且未挂载持久磁盘，JSON/outbox 不能替代真实 Supabase；真实项目仍需执行迁移、RLS、并发、备份和回滚验收。

玩家私聊在无 Supabase 时使用本地 JSON 的 90 天/每会话 500 条/全局 50,000 条有界回退；启用 Supabase 后，发送必须先通过数据库内好友/Block/幂等事务并持久化成功才回执，已读游标只允许推进到本人真实收到的消息。消息正文不进入 Profile、排行榜、Replay、Analytics、普通日志或浏览器 `localStorage`；会话系统空态文案不被错误标记为玩家原文，三语言切换保持即时覆盖。真实 Render 持久化仍以执行本次 schema 迁移并完成 staging 并发/备份回滚验收为前提。

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

项目级 Skills 在 `.agents/skills/`，质量闸门配置在 `requirements/QUALITY_GATES.json`，当前能力与发布证据待决项在 `PROJECT_STATUS.json`。
当前不会为了视觉参考强行迁移 React/Framer；GSAP 官方 skills 已纳入动效门禁。Gomoku Ghost3D 继续按需加载固定 `3.15.0` core；四区路由另以首次交互 lazy-load 的同版本 Core+CSSPlugin ESM island 提供有限分层进入，路由业务始终同步提交，失败/reduced-motion/后台/Game Shell 均静态回退。两条 island 都不进入规则或首屏安装缓存，也不载入 ScrollTrigger。未经审计的第三方 Skill 仍不会自动安装；外部 reference-only 素材仅沿受控 Skill reference lane 传递元数据与任务相关输入。

## 第三阶段发布状态

- 自动化：`npm test`、关键协议 5 次连续回归、10/25/50 逻辑并发房、1000 次生命周期内存、Timer Audit 均已通过。
- 浏览器：本地 in-app Chromium 已完成当前 P0 的 1440/768/481/390/360 注册、商城、大厅、六封面、英/乌语言、overflow、44px 控件、单例与滚动锁验收，控制台无 warning/error；证据在 `deliverables/visual-qa/visual-commerce-p0-20260808/`。
- 已执行：30 分钟生产正式好友 WebSocket 会话通过（15 条消息与已读、2 次重连、0 异常断开、P95 181ms）；逻辑 Chaos、完整 `npm test` 与 Quality Gates 通过。
- 已执行：本轮本地 in-app Chromium 默认桌面/390px 的 Auth/Home/Games/Playline/Profile、全局 DM 弹层、五子棋/Tetris、light/dark、overflow/44px/控制台矩阵。
- 已执行：Game Stage + Tabletop Wave A 提交 `7fc6601` 已发布到 Pages/Render；两端 HTTP 内容一致，生产 WS 与线上 Chromium 登录前/访客/六游戏/AI 五子棋 Stage 抽查通过。
- 未执行：Android Chrome、iPhone Safari、真实 Tablet、第二桌面浏览器、真实 `tc/netem`、真实 Supabase/RLS/并发/备份回滚。
- 当前两条外部环境 Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`：本地开发可继续，但在第二浏览器、真机、真实网络和生产 Supabase 证据补齐前不得写 `PRODUCTION_READY`；发布仍需当前用户明确命令。
