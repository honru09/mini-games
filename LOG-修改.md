# 修改日志

> 简易记录项目修改内容。每次改动完成前更新；格式：`日期 时间｜修改内容`。

- 2026-08-07 16:29｜补记：平台已聚焦为 6 款精选游戏，并完成白皮书、美术清单、品牌 Logo、💵 资源与 asset manifest 第一阶段融合。
- 2026-08-07 16:29｜开始接入五子棋 Canvas 与俄罗斯方块 DOM/网格两个 P0 美术纵切。
- 2026-08-07 16:55｜更新 `AGENTS.md`，登记奖励与成长系统 v1.0 为权威新增需求，并明确当前代码尚未实现及 18 条验收要求。
- 2026-08-07 18:01｜完成 Economy & Progression v1.0：三模式权威奖励、有效局/投降/AFK、防重复对刷、首胜/连胜/等级、AI 日上限、胜场统计与 Reward Breakdown；同步数据库、三语言、文档和全套测试。
- 2026-08-07 18:24｜修复 AI 断线补发重复计数；调整商城入门商品最低价格为 10💵；增强 Supabase 失败后奖励不回档，并同步构建产物与项目说明。
- 2026-08-07 18:28｜完成六款游戏 Gameplay P0 升级并同步构建/回归；具体规则、表现、观战与协议取舍见 `LOG-游戏板块.md`。
- 2026-08-07 18:57｜加固 Supabase 原子购买：数据库校验服务端价格表、永久/近期幂等、100 条请求上限、余额并发拒绝，并扩展迁移状态与 fake adapter 回归。
- 2026-08-07 19:12｜五子棋升级为威胁搜索，象棋升级为限宽 Alpha-Beta；AI 候选开始携带归一化特征，供赛后根据胜/平/负持续学习，同时限制无效对局只审计不训练。
- 2026-08-07 20:06｜正式联机切换为 Tank Server Authority 与 Tetris Battle Coordination；补齐快照重连、观战结果、赛事 UI、棋钟/拍卖路由、性能计数、协议文档与生成产物。
- 2026-08-07 20:06｜修正 E2E 异常子服务清理、AI 角色旧断言和越界头像 fallback；统一 `npm test` 全部通过。
- 2026-08-07 20:09｜补齐 `hello_ack` 的七项 Gameplay capability 协商，并将协议设计文档同步为最终消息名、观众上限与赛事真实边界。
- 2026-08-08 00:15｜完成三语言全量覆盖收口：三词典统一为 822 个唯一 key；修复动态 DOM/属性、设置弹层、对局标题、象棋 Canvas、Tetris 垃圾事件、AI 历史名称、服务端错误、异步切换竞态与失败回退；同步修正 Tank/Tetris 规则、英乌术语/数词表达和六款全能成就，并重建产物、更新文档、通过完整 `npm test`。
- 2026-08-07 23:23｜修复 Tank/Tetris 对局持续重建 DOM 导致的闪屏，改为稳定渲染树、keyed 增量更新与方块池，并补齐定时器清理和节点 identity 回归。
- 2026-08-07 23:23｜默认联机升级为 Tetris/象棋/大富翁 v2 服务端规则权威；赛事接通自动房间、席位、Server Result 和下一轮，观众支持跨桌切换。
- 2026-08-07 23:23｜修复大富翁未验证快照污染 turn、v2 购买按钮 ownership 来源和掷骰重复点击窗口；全量 E2E 改测默认 v2。
- 2026-08-07 23:23｜补齐三语言动态游戏文案、更新白皮书/AGENTS/README/一次性报告并同步最终构建产物。
- 2026-08-08 00:26｜修改 `.gitignore`，补充 `__pycache__`、Python 编译缓存和 `deliverables/~$*` 的版本库忽略规则。
- 2026-08-08 00:50｜审阅副窗分支与主分支提交图，确认 `c5bb59e` 已被 `main` 包含；同步 Project Execution OS 到 AGENTS、README、WHITEPAPER、CI、package scripts 和 CSS Motion Tokens。
- 2026-08-08 00:50｜将三份 Gameplay 简易报告迁移到 `简易报告/`，按最后核对时间追加 `202608072006`/`202608072323` 后缀并修正交叉引用。
- 2026-08-08 00:56｜将 `PROJECT_STATUS.json`、任务 execution/plan/acceptance 同步到 `3e72c311` 的验证状态，保留真实设备、Supabase 和网络闸门的 BLOCKED 事实。
- 2026-08-08 01:02｜将 Project Execution OS 任务状态收口为 `ACCEPTED`，补充最后发布提交、线上证据和 Release Candidate 阻塞边界。
- 2026-08-08 01:58｜审查并整理主线、线上页面、Seat/Social 独立分支及未完成合并状态；同步交接报告中的当前事实、冲突约束和执行优先级。
- 2026-08-08 03:03｜修改 READY 开局、观战与房主转移回归流程；同步 Profile/Presence/i18n、六款 AI Seat 控制回调、六款成就条件及联机测试，修正设置弹层和热座移除断言。
- 2026-08-08 03:36｜修改服务端 owned/装备权限、每日任务日期与 claimId 幂等、回放隐私/过期、Metrics Bearer/限频/审计、商城与赛事 UI；同步三语言、Supabase schema、README/AGENTS/项目状态。
- 2026-08-08 13:34｜统一正式玩法为人机/联机双模式；同步 AGENTS、包描述、奖励需求、交接报告、项目状态和 v3.2 正式白皮书，并通过项目状态、DOM、Reward、构建与 DOCX 结构审计。
- 2026-08-08 13:51｜修改线上 WebSocket 冒烟以执行 Seat v2 READY 开局、消除连接事件竞态并脱敏凭证；同步 Render 环境变量脚本、README 与 AGENTS。
- 2026-08-08 17:45｜重构注册与商城信息层级和 481–768px 降级；修复商城价格漂移、Starter Background 假购买入口、重复弹层、滚动锁、游戏顶栏/Avatar alt/60 组商品三语泄漏，并同步构建、白皮书和项目状态。
- 2026-08-08 18:14｜修正 DOCX 页眉 v3.3、P3 阶段缺字、第 26 章标题孤行与追加章节分页；逐页复验 1–40 页并重跑 Quality Gates/完整 npm test。
- 2026-08-08 18:30｜将 HTML 首屏 fallback 标题改为“小游戏合集”，与 `app_title` 中文词典一致；重建 `public/index.html` 并通过 i18n、DOM 与 Quality Gates。
- 2026-08-08 20:13｜将 M0 Source Manifest 八项从 planned 更新为 draft，固定源 SHA/poster/默认关闭旗标；修正素材库审计以支持 Schema 已允许的 reference-only 集合，并同步 README、AGENTS、WHITEPAPER、PROJECT_STATUS 与执行证据。
- 2026-08-09 00:43｜重构认证、导航、主题、i18n、资产 manifest、WebSocket 消息与服务端鉴权；DeepSeek 默认升级为 `deepseek-v4-flash`，Honru 无 Key 时使用安全本地回退。
- 2026-08-09 00:43｜修复手机 Honru 浮层遮挡 Profile/Games、显式退出后旧 App 透出、素材库 manifest 哈希漂移及 E2E 未认证即启动 AI 的竞态；完整 `npm test` 与 Quality Gates 全部通过。
- 2026-08-09 00:43｜将 M0 Art Bible/Design Token/IP 模板和验收矩阵从六主题同步为 `light/dark`，全部既有 M0 PNG/SVG、Prompt、Source Manifest 路径与 SHA 保留不变。
- 2026-08-09 00:47｜本次仅更新简易报告索引；无产品代码修改。
- 2026-08-09 01:00｜将 Ghost Game P0 计划、执行和项目状态写回 `RELEASED`，记录提交 `aac40da`、Pages/Render 部署与线上 HTTP/WS/Companion/浏览器验收；RC 仍保持 `BLOCKED`。
- 2026-08-09 02:01｜将五子棋旧风格以默认关闭纵切接入 M0 Sticker 表现，保持 15×15/AI/联机/快照不变；修复 decode/销毁/开关撤销异步边界和 `<=480px` 三语言游戏顶栏重叠，并同步素材库、状态与构建产物。
- 2026-08-09 02:21｜素材库审计新增 `reference-only` 明确分支：候选只能留在 `art-source/`、远端键为空且不得冒充生产 Manifest；同步 Honru v2/P1 合法任务状态与项目能力矩阵。
- 2026-08-09 03:06｜修正 Honru 状态三色归并的 16 位色距溢出，改用 32 位重建九状态平涂与派生图；同步素材库、任务状态与项目能力矩阵。
- 2026-08-09 09:19｜修复登录页黑夜 Logo、主题按钮可访问名称、Honru 解码/撤旗标/replay/节流/终局语义/生命周期；调整飞行棋合法反馈与象棋重绘保留，并同步构建、文档和项目状态。
- 2026-08-09 10:31｜将 Chat 默认页从 Honru 改为玩家消息并保留 Honru 独立子页；深度重构个人主页为身份/成长/六游戏战绩/成就/任务/社交/收藏/本人回放；修复账号缓存隔离与失效 token 主动推送，同步三语言、协议、构建、文档和项目状态。
- 2026-08-09 12:43｜将 Honru P2、Direct Chat v1 与深度 Profile 快进发布至 GitHub main/Pages/Render；同步任务状态、项目状态、回滚点，并修正赛事与聊天旧审计文档漂移。
- 2026-08-09 14:37｜Tetris 升级为 `tetris-rule-v3` Advanced Battle（T-Spin/B2B/Combo/Perfect Clear）并保留旧 v2/紧急开关回退；Direct Chat 接入默认关闭的跨实例 ID-only 事件；同步三语言、协议、文档和构建产物，发布 `0c507ab` 至 Render/Pages。
- 2026-08-09 18:35｜重构六款局内为纸板桌游舞台，实时同步房主/本人/AI/READY/离线/观战状态；修正席位 `false` 泄漏、重排误标和 Tetris 手机横向滚动，移除个人主页元叙事文案并保留简洁标题。
- 2026-08-09 19:05｜将 Game Stage/Tabletop Wave A 状态更新为已验收发布，推送 `7fc6601` 至 main/Pages/Render，并同步项目状态、任务计划、三日志、README/AGENTS 与发布报告。
- 2026-08-09 19:36｜同步 AGENTS、WHITEPAPER、PROJECT_STATUS、报告索引和 npm 脚本，冻结六领域分轨、旧范围裁决、最高质量图片模型门禁与“无明确指令不发布”规则。
- 2026-08-09 19:48｜将七份进度报告升级为逐项展示前置依赖、证据入口、验收口径与下一阶段，并强化 QA 对来源存在性、verified 证据、依赖无环和请求全覆盖的检查。
- 2026-08-09 19:55｜将任务验收、执行状态与 PROJECT_STATUS 更新为完整回归通过，保持 `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`。
- 2026-08-09 21:34｜将六款局内升级为 fixed `100dvh` 全视口 Shell，补页面输入/滚动锁、内部滚动、Hub 滚动与游戏卡焦点恢复、Rules/Victory/Reward 命名 dialog/Tab/Esc/背景关闭焦点生命周期、Tetris 全尺寸 44px 控件和滚动条细化；同步台账四项 verified、58 来源、七报告、AGENTS/README/WHITEPAPER/PROJECT_STATUS 与构建产物。
- 2026-08-09 21:59｜根据 Terra Max 二轮终审补 Rules 单按钮 Tab 闭环、Victory 单实例与外部移除清理、切换/销毁前回收；专项动态 QA 扩至 22 项并完成完整回归与双构建校验。
- 2026-08-10 00:49｜扩充 Seat 公开 Avatar/Frame/Effect/NameFx/Lang 与可访问个人页入口，接入服务端权威身份、幂等、频控、双向 Block、观众/访客/AI 边界和客户端静音/队列/清理；修复嵌套按钮、本人 Profile 状态、测试桩兼容及三语言 `profile_title`；根据 Terra Max 终审补语言旗帜、目标头像气泡、发送者复合事件键、900ms 冷却、事件级举报、观战离席确认、44px 触控与延迟任务清理；同步台账、七报告、AGENTS、WHITEPAPER、PROJECT_STATUS 与构建产物。
- 2026-08-10 03:17｜把历史一次性报告无损归档到按日期目录，修正白皮书 Tournament 状态夸大、台账硬依赖/遗漏、planned 报告措辞和来源追溯；同步 AGENTS、README、WHITEPAPER、PROJECT_STATUS 与报告入口。
- 2026-08-10 03:17｜将商城商品卡语义修正为 `role=group + aria-current`，统一 Canvas/img 圆形 Avatar、Frame/Effect stacking，并让 `effect-4` 仅旋转装饰环；动态背景改为真实 animated WebP + poster/fallback、播放暂停、observer/visibility 清理和 reduced-motion；三语、构建与状态台账同步。
- 2026-08-10 04:32｜统一 Header/Mobile Nav/Modal/Auth/Toast 层级，修复管理员态跨账号残留、建房待选游戏串房、观战自身房重复显示、登录 deviceUid、房间码原生校验抢断与 44px 触控；普通账号隐藏赛事入口，并同步三语、233 项台账、七份进度报告、AGENTS/README/WHITEPAPER/PROJECT_STATUS 与构建产物。
- 2026-08-10 05:12｜把 Tank 旧四向摇杆改为八扇区/斜向 Pointer Capture 控制，拆分键盘/摇杆/D-pad/开火输入并补齐 blur、visibility、pointercancel、lostcapture、destroy 清理；同步三语、生成产物、E2E 控件定位、台账与七份进度报告。Terra Max 因 auth_unavailable 未能施工，主负责人接管并完成逐项审核。
- 2026-08-10 05:20｜补充 AGENTS/README 的 Tank Controls 专项测试命令，完成最终 JSON/语法与质量闸门复核。
- 2026-08-10 05:42｜修改 ART-035 为 partial，更新 Tank Art P1 plan/execution/acceptance、PROJECT_STATUS、AGENTS、README、WHITEPAPER 与七份自动进度报告；确认生产 manifest、Tank Controls、Authority、规则和协议不变。
- 2026-08-10 06:20｜修改 Social Match P0 验收与 PROJECT_STATUS：确认 `resetState()` 仅在真实断开时清空 capability，补充联机回归、双构建哈希及 localhost 保存权限未执行说明。
- 2026-08-10 07:06｜修改 Profile/公开 Profile/Room Seat/重连与客户端只读缓存，接入 `player-character-v1` 安全投影；同步 Player Character 台账、执行状态、AGENTS/README/WHITEPAPER、PROJECT_STATUS、Social Match Seat QA 与构建产物；修正后完整 `npm test` 通过。
- 2026-08-10 07:08｜修改 PROJECT_STATUS 的 Player Character 能力、Social Match/Player Character 构建哈希、七份分类进度报告和收口证据；progress ledger、Quality Gates、JSON 与 diff check 复核通过。
- 2026-08-10 07:26｜修改 ART-036 需求执行状态为 source-only accepted、台账 ART-036 为 partial、素材库更新时间与七份分类进度报告；确认生产 Manifest、Player Character schema、Monopoly 规则/商城未变。
- 2026-08-10 07:34｜修改 ECO-029 执行/验收/台账为 contract-only partial，补 package 专项入口；确认正式角色目录、价格、购买/装备、Supabase RPC 与商城 UI 保持未执行。
- 2026-08-10 07:37｜修改 npm pretest 同时运行 Player Character P0 与 ECO-029，回写执行/验收/简报证据；修正后的完整 `npm test` 全部通过。
- 2026-08-10 08:16｜修改 Monopoly 客户端只读表现 seam、现有 WebSocket 根级 transition 转交、代码原生 marker/CSS、ECO-029 requestId 目录保留、Social Match 客户端生命周期回归、UI/GAME 合同状态、PRODUCT_REQUIREMENTS_LEDGER、PROJECT_STATUS、AGENTS/README/WHITEPAPER、分类进度报告与最终构建哈希；最终完整 `npm test` 114.7 秒通过。
- 2026-08-10 08:21｜修改 Player Character P0 历史收口报告，明确其中 07:06 的旧构建哈希为历史快照，并指向当前 UI-037/GAME-045 canonical 构建数字；未改变历史测试结论。
# 2026-08-10 08:48
- 修改 `public/src/games/monopoly.js`：接入状态栏、拍卖倒计时、机会卡可访问 dialog、首步权威边界、计时器清理与 44px 控件。
- 修改 `public/src/games/monopoly-presentation-adapter.js`：增加只读破产差分元数据。
- 修改 `public/index-template.html`、三份 locale、`scripts/build.js`、`package.json`、项目台账/报告同步 UI-037/GAME-045 状态矩阵事实。
# 2026-08-10 09:04
- 修改 `public/src/core/02-app-shell.js`：玩家聊天会话行区分系统空态文案与玩家昵称/消息原文，修复语言切换覆盖遗漏。
- 修改 `qa/player-chat-contract.js`：增加聊天空态 i18n 与原文边界回归。
- 修改 `public/index.html`、`PROJECT_STATUS.json` 与最新简易报告，完成最终构建数字同步。
# 2026-08-10 09:16
- 修改 `PROJECT_STATUS.json`：同步 `uiRepairP03`、Social Match、UI-037/GAME-045 当前构建证据，更新为 `public/index.html` 907134 bytes / SHA-256 `CB7E359D3A98E9BB1419FDFB80B08297462A4795B6C12D09C06F80AB57709142`，并记录 `npm test` 152.5 秒全通过。
- 修改 `简易报告/UIRepair-P0.3聊天空态语言收口-202608100904.md` 与 `简易报告/UI037-GAME045状态矩阵本地收口-202608100848.md`，同步最终测试与哈希数字。
# 2026-08-10 09:47
- 修改 `public/src/shop/05-profile.js`、`public/src/online/03-websocket.js`：统一公开身份原文边界、Profile/社交弹层可访问生命周期和独立键盘入口。
- 修改 `public/src/core/02-app-shell.js`、`public/src/ui/07-roster.js`：修复 Chat 系统 fallback raw、排行榜 Profile 按钮和背景 radio 状态。
- 修改 `qa/ui-profile-social-contract.js`、`qa/ui-identity-preview-contract.js`、`qa/player-chat-contract.js`、`qa/ui-room-lobby-contract.js`、`package.json`，补 P0.4 专项/回归入口。
- 修改需求台账、`PROJECT_STATUS.json`、七份分类报告、P0.4 简易报告、三份中文日志；最终构建为 912517 bytes / SHA-256 `581E760A92E5FC5046F4388C21C93C6552346E6471BDC71F972BB709CCC1F537`，完整 `npm test` 127.2 秒通过。
# 2026-08-10 09:51
- 修改 `AGENTS.md`、`README.md`、`WHITEPAPER.md`：同步 UI Repair P0.3/P0.4 的实现范围、测试数字、哈希和未完成外部闸门；不改变发布状态。
# 2026-08-10 10:10
- 修改 `public/src/core/06-assets.js`：动态背景失败时清理 `asset-ready`，按 poster→static fallback 恢复，并统一 observer/visibility/reduced-motion/playback 状态同步与 cleanup。
- 修改 `public/src/shop/06-shop.js`、`qa/ui-identity-preview-contract.js`、`package.json`：同步商城播放控件、动态 VM 回归和完整测试入口。
- 修改 `PROJECT_STATUS.json`、`requirements/PRODUCT_REQUIREMENTS_LEDGER.json`、七份分类进度报告、P0.5 active task、`AGENTS.md`、`README.md`、`WHITEPAPER.md` 与简易报告入口；完整 `npm test` 110.4 秒通过，构建为 915127 bytes / SHA-256 `1A4D1DD87F3AFB89B13436B20E8B488B3A021698B996AF393D084E5206E61D1D`。
# 2026-08-10 10:27
- 修改 `public/src/shop/06-shop.js`、`public/src/online/03-websocket.js`、`public/src/core/02-app-shell.js` 与 `public/index-template.html`：访客可只读逛商城，永久购买和社交/主动邀请 mutation 在控件与客户端方法两层阻断。
- 修改 `qa/ui-profile-social-contract.js`、`package.json`、需求台账、状态、七份报告、AGENTS/README/WHITEPAPER 与简易报告入口；完整 `npm test` 131.0 秒通过，构建为 917621 bytes / SHA-256 `810A5D419A31AA796238E7B47D93CCBA08246CDBBD65BE47CF71D6A43780B7A8`。
# 2026-08-10 10:40
- 修改 `public/src/shop/05-profile.js`、`public/src/online/03-websocket.js`、三份 locale：新增权威 Profile loading dialog、pending UID、成功/null/取消/迟到响应边界。
- 修改 `qa/ui-profile-loading-contract.js`、`package.json`、需求台账、状态、七份报告、AGENTS/README/WHITEPAPER 与简易报告入口；完整 `npm test` 172.2 秒通过，构建为 920073 bytes / SHA-256 `492036CBC9783566C58FC81887533B6E275EFE947727C0BCDC470D3FBEBFA761`。
# 2026-08-10 10:51
- 修改 `public/src/shop/06-shop.js` 与 `public/index-template.html`：收口桌面/平板/手机商城密度、左侧真实身份试穿、Premium Background poster 比例、动态/静态标签、价格底对齐、全宽操作和 44px 触控目标。
- 修改三份 locale、`qa/ui-shop-layout-contract.js`、生成产物与 active task；同步 `PROJECT_STATUS.json`、需求台账、七份进度报告、AGENTS/README/WHITEPAPER 和简易报告。
- 完整 `npm test` 130.3 秒通过；`public/index.html` 为 920833 bytes / SHA-256 `65300B75CA057403B413B412E9A4F3FF1F9FA6CF541410D5A8A203F6D391D429`。Terra Max 已创建但回传不可读，未采纳其结论；未提交、未推送、未部署。
# 2026-08-10 11:08
- 修改 `public/src/core/02-app-shell.js`、`public/src/online/03-websocket.js` 与 `public/index-template.html`：增加 Direct Chat 刷新/历史 pending、live status、未读语义、日期分隔、旧页滚动锚点、断线 pending 清理、移动安全区和 enterkeyhint。
- 主负责人修正“立即重渲染提前消费历史滚动锚点”和“真实断线 loading 卡死”，并保持既有 Social Match capability、direct-chat-v1 权限和正文隐私边界。
- 修改三份 locale、`qa/ui-chat-presentation-contract.js`、`package.json`、需求台账、状态、七份报告、AGENTS/README/WHITEPAPER 与简易报告；完整 `npm test` 113.2 秒通过，构建为 924691 bytes / SHA-256 `1E00C59C0C6E5FA197BD7C4DB2EA60795897A5CB2992340863FF5F78199133F5`。
- 2026-08-10 11:47｜修改 `server/index.js`、`public/src/online/03-websocket.js`、`public/src/core/02-app-shell.js`、`public/index-template.html`、三份 locale、`package.json`、协议登记与 README：完成 `match-chat-v1` 房间文字聊天及 Game Stage 表现；正文保持当前房间内存边界。
- 2026-08-10 11:47｜主负责人修正 `qa/social-match-contract.js`、`qa/game-stage-contract.js` 的相邻模块误扫，并修正 `qa/match-chat-contract.js` 的 replayed ack 误判；随后为房聊补充内存草稿保留/生命周期清理回归。
- 2026-08-10 11:47｜修改 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json`、`PROJECT_STATUS.json`、`AGENTS.md`、`README.md`、`WHITEPAPER.md`、七份进度报告和简易报告索引；Social Match P1 本地收口，下一主线更新为 Home Engagement P0。
- 2026-08-10 11:47｜最终 `npm test` 142.6 秒 ALL_PASS；双次构建一致，脚本输出 923629 characters、物理文件 937519 bytes、SHA-256 `1A709832AD0320518DB9E944AEEA70BD508231FF56FF6BCF2B88B7436694C305`；未提交、未推送、未部署。
- 2026-08-10 12:14｜修改 `public/index-template.html`、`public/src/core/02-app-shell.js` 和三份 locale：首页增加语义化三步引导、既有 `played` 推荐、level/streak 目标、正式账号/访客匹配入口和推荐游戏卡焦点。
- 2026-08-10 12:14｜主负责人把访客“查看成长”改为“开始第一局”，把仅导航的“去玩”改为“查看”，并把三步改为有序列表；`qa/home-engagement-contract.js` 增加动态正式账号/访客/焦点矩阵。
- 2026-08-10 12:14｜首次完整链 E2E 邀请建房一次性超时，单独 E2E 和后续两次完整链均通过；最终 `npm test` 131.5 秒 ALL_PASS。双次构建一致：927995 characters、物理文件 942085 bytes、SHA-256 `7980FEDB5222444C42AA7DC3540EE000F353D85ACB0A0316920B417E9903919B`。
- 2026-08-10 12:14｜修改需求台账、PROJECT_STATUS、报告生成器、AGENTS/README/WHITEPAPER、七份进度报告和简易报告索引；下一主线更新为 Tabletop Presentation M1，仍未提交、推送或部署。
- 2026-08-10 12:56｜修改 `public/src/games/00-tabletop-perspective.js`、`gomoku.js`、`ludo.js`：完成本地近端视角消费者并修正棋盘外坐标不得夹到边缘；修改 `qa/tabletop-perspective-contract.js` 与 `qa/e2e-online.js`，按视角映射屏幕坐标并增加越界/非整数回归。
- 2026-08-10 12:56｜修改 Tabletop M1 active task、需求台账、PROJECT_STATUS、AGENTS、README、WHITEPAPER 和七份分类进度报告；完整 `npm test` 通过，双构建 930449 characters / 944539 physical bytes / SHA-256 `CCA3CAB3193F2A75922B78D6A626716FFA92B012C063A68F4D5D489815F0D301`，未提交、未推送、未部署。
- 2026-08-10 13:10｜修改 `public/src/games/gomoku.js`：移除 Sticker 红色方框，增加墨线环/放射冲击、reduced-motion 静态降级与 reset/restore/destroy 计时器清理；修改 `qa/tabletop-perspective-contract.js` 纳入 Action Presentation 和飞行棋路径合同。
- 2026-08-10 13:10｜修改需求台账、PROJECT_STATUS、Action Presentation active task、七份分类报告和简易报告索引；完整 `npm test` 117.8 秒 ALL_PASS，构建 932061 characters / 946151 physical bytes / SHA-256 `6D196D68BA9F4B5910CDD262719879AB98271243825F601D3727B3CD0010FAAC`，未提交、未推送、未部署。
- 2026-08-10 13:31｜修改 `public/index-template.html`、`public/src/core/01-utils.js`、`public/src/games/ludo.js` 和三份 locale：增加 reduced-motion 安全的五子棋/飞行棋入场镜头，以及消费既有 placement 的 2/3/4 人三语可访问排名台。
- 2026-08-10 13:31｜修改 `qa/tabletop-perspective-contract.js`、`qa/overlay-dialog-accessibility.js`、需求台账、PROJECT_STATUS、AGENTS/README/WHITEPAPER、七份报告和简报入口。首次完整链仅触及 180 秒工具超时且无断言失败，300 秒上限重跑 118 秒 ALL_PASS；双构建 934153 characters / 948243 physical bytes / SHA-256 `7FE8BC67E7D8E4B2C4356EB655C569E746787C851525CA30ACE4CAA7917C2FF6`。
# 2026-08-10 14:22
- 修改 `shared/progression/victory-mastery.js`：只读取胜场自有字段，异常/不可转换值安全回退；修改 `qa/victory-mastery.js` 和 `qa/security-online.js` 覆盖继承字段、Symbol、超大数及客户端伪造。
- 修改 `qa/metrics-online.js`：固定 8188 改为临时空闲端口，消除 Windows CLOSE_WAIT 偶发占用；专项与完整链均通过。
- 修改 `shared/progression/profile-journey.js`、`public/src/core/02-app-shell.js`、`public/index-template.html`、`scripts/build.js`、`package.json` 和三份 locale：增加 Profile Journey 三目标卡，优先已有胜场路线，复用既有 Games/成就/商城动作并适配手机。
- 修改需求台账、PROJECT_STATUS、AGENTS、README、WHITEPAPER、七份进度报告、简易报告 README、两个 active task、两份中文简报与三份日志；完整 `npm test` 130.7 秒 ALL_PASS，质量门禁/台账/双构建通过。Profile Journey 双构建 944592 characters / 958703 physical bytes / SHA-256 `499FF4D17BDE07A420DA4730E3B58B6A4354288322D37F844C8AE4E835B7C634`；未提交、未推送、未部署。
# 2026-08-10 14:50
- 修改 `server/index.js`、`public/src/online/03-websocket.js`、`public/src/shop/05-profile.js`、`public/index-template.html` 和三份 locale：完成好友比较的服务端权限、请求生命周期和响应式可访问弹层。
- 主负责人修正真实断线时 Profile Compare 清理与旧 Direct Chat 静态合同的结构回归；六组专项与完整 `npm test` 118.1 秒 ALL_PASS。
- 修改需求台账、PROJECT_STATUS、AGENTS、README、WHITEPAPER、协议注册表、报告生成器、七份进度报告、简易报告索引和 active task；双构建 951578 characters / 965692 physical bytes / SHA-256 `5528D0C6A15C42D096E92B2BA8A7454C1C9332FA414A52497312325496776934`，未提交、未推送、未部署。
# 2026-08-10 15:33
- 修改 `public/src/ui/07-roster.js` 与 `public/src/core/04-social.js`：Profile 编辑器/成就弹层统一接入命名 dialog、初始焦点、Tab、Esc、背景/显式关闭、幂等滚动锁和焦点恢复。
- 主负责人补充保存/取消/关闭动作及手机宽度断言，并移除会压过响应式 CSS 的成就卡 460px 内联宽度。
- 修改 `public/index-template.html`、`package.json`、需求台账、PROJECT_STATUS、AGENTS、README、WHITEPAPER、报告生成器、七份报告、简报索引和 active task；完整 `npm test` 122.5 秒 ALL_PASS，双构建 953847 characters / 967961 physical bytes / SHA-256 `B07BD0597D0B9834FB2C2C084ED7FD9AAE6ABC6B85D42766BE91DBFFA9C65B96`，未提交、未推送、未部署。
# 2026-08-10 15:59
- 修改 `scripts/build.js`、`public/src/core/02-app-shell.js`、`public/src/shop/06-shop.js`、`public/index-template.html`、三份 locale 和 `package.json`：接入纯稀有度目录、本人收藏分布与商城标签。
- 主负责人修正 Terra 初版遗漏默认免费集合的问题；专项新增正常 starter 账号零误报回归，目录由 117 项扩为 150 项。
- 修改需求台账、PROJECT_STATUS、AGENTS、README、WHITEPAPER、报告生成器、七份报告、简报索引和 active task；完整 `npm test` 114.2 秒 ALL_PASS，双构建 962213 characters / 976327 physical bytes / SHA-256 `457169CB1982748D74CC2E1CBF145176802B0271D88A49B8B1963BC6712B7636`，未提交、未推送、未部署。
- 2026-08-10 16:27｜修改 `PROJECT_STATUS.json`、需求台账、报告生成器、AGENTS/README/WHITEPAPER、简报索引与三份日志：Home Engagement P1 安全聚合纵切已记录为本地完成，UI-010/ECO-023 保持 `partial`，真正可恢复对局转为独立权威恢复合同；主审“每账号固定 localStorage key + 日期 value”的有界存储修正已入账。完整 `npm test` 179.7 秒、单独 E2E 53.7 秒和双构建 SHA-256 `4A861DD2F6763FE4AFA4640E7F6AEC7418A0DC9E4EAD52BD41831C0988E43C37` 通过；未提交、未推送、未部署。
- 2026-08-10 17:10｜修改 `public/src/core/02-app-shell.js`、`public/index-template.html`、三份 locale、`package.json` 与构建产物：在既有 Home pulse 内加入正式账号身份条，复用头像组合/昵称闪名/收藏 X/Y/既有路由，访客私有字段短路、catalog 异常安全降级、移动端单列和三语文案保持一致。
- 2026-08-10 17:10｜修改 Home Identity active task、PROJECT_STATUS、需求台账、报告生成器、AGENTS/README/WHITEPAPER、七份进度报告、简报索引与三份中文日志；红测 8 项失败后转绿，完整 `npm test` 120.7 秒通过；双构建 971303 characters / 985572 bytes / SHA-256 `963DEAEFC5B46621ACCE9B713444D3F3B7F5DC41C775990CD87BE36E501D69FF`，未提交、未推送、未部署。
- 2026-08-10 17:28｜修改 Home Shell、模板、三份 locale、`showHub()` Home 生命周期、`package.json` 与构建产物：新增同实例当前对局返回入口；主负责人修正旧 Home VM 未加载新 helper 的 `ReferenceError` 兼容回归。
- 2026-08-10 17:28｜修改 PROJECT_STATUS、需求台账、报告生成器、AGENTS/README/WHITEPAPER、七份进度报告、简报索引、active task 与三份日志；完整 `npm test` 199.8 秒通过，双构建 974130 characters / 988467 bytes / SHA-256 `8ECE8C16D5AE051DE59A31D9FA14949FF607675504059BC26BD050BE505F81E8`，未提交、未推送、未部署。
# 2026-08-10 18:27
- 修改 `public/src/core/06-assets.js`、`public/src/ui/07-roster.js`、`public/src/shop/06-shop.js`、`public/src/core/02-app-shell.js`、`public/src/core/04-social.js`、`public/src/online/03-websocket.js` 与 `server/index.js`：统一用户可见货币名称为 G Coins，保留 `coins`/`currency` 字段和 `💵` fallback，不改奖励数值/价格/协议。
- 修改三份 locale、`public/assets/manifests/asset_manifest.json`、`README.md`、`WHITEPAPER.md`、`AGENTS.md`、`package.json`、`asset-library/catalog.json`、需求台账和项目状态；重新构建 `public/index.html`。
- 货币专项、i18n、素材库审计、DOM、商城和 Reward 回归均通过；完整 `npm test` 将在本批最后执行。
- 2026-08-10 18:34｜完整 `npm test` 221 秒 ALL_PASS；进度台账、61 项来源追溯、7 份报告、Quality Gates、`git diff --check` 和连续双构建通过。最终 `public/index.html` 为 990079 bytes，SHA-256 `E9516112DB8D4C47D1A79B5BB9FA0844162F6AB051B3679A3A1B9236110672F0`；未提交、未推送、未部署。
- 2026-08-10 18:36｜补齐 G Coins 本地验证证据 JSON、简易报告索引和最终测试数字；本批状态保持 `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`。
- 2026-08-10 18:38｜将 `gCoinsP0` 纳入 PROJECT_STATUS capabilities 并同步 UI-011/ECO-018/ECO-023 后续口径；Quality Gates 再次通过。
- 2026-08-10 19:06｜修改商城、WebSocket 客户端和服务端购买回执：新增单笔 pending、requestId+uid+category+id 关联、可访问成功/失败/超时状态，以及关闭/断线/注销清理；价格、扣款、owned、Reward、Supabase RPC 不变。
- 2026-08-10 19:06｜Terra Max 以 max 创建但未交付可审阅文件后被中断；主负责人接管并纠正所有成功/失败分支关联字段、旧 Shop VM DOM 合同与滚动发布边界。专项、i18n、DOM、Shop、Security、Supabase Adapter、Progress Ledger、Quality Gates 和完整 `npm test`（122.3 秒）通过；双构建为 980789 characters / 995152 bytes / SHA-256 `5ACF7F4769D9A1D1642DA736A0AE8210E19FD034FC9E93DAEDB19640644E30F6`，未提交、未推送、未部署。
- 2026-08-11 00:04｜修改服务端测试管理员集成、赛事外部控制面、前端私有投影、Render 环境写入顺序和 Blueprint；修正好友 payload、沙盒能力名、participants 广播及 sender-excluded 测试语义。
- 2026-08-11 00:04｜修改 WebSocket `room_update`：仅接受当前房间/观战/恢复目标的同 ID 更新，防止离房后的排队旧消息阻塞下一次建房。完整 `npm test` 148.1 秒、连续三轮 E2E、双构建 SHA-256 `52CE07C2185B9EDC8A34D374BA15A270B2FC9F7643CC0539E967E622A307A828` 通过。
- 2026-08-11 00:04｜需求台账更新为 234 项（93 verified、28 implemented、37 partial、57 planned、19 blocked）、42 个覆盖组；重新生成 20260811 总报告和六分类报告，并同步 PROJECT_STATUS、AGENTS、README、WHITEPAPER 与简报索引。
- 2026-08-11 00:51｜修改 `scripts/build.js` 为跨平台统一 LF 生成物；修改 Render/服务端测试管理员配置、沙盒房间设置和局内社交结算生命周期；修正 PROJECT_STATUS 总体状态为 `BLOCKED`、20260811 报告入口和 Tournament UI 已隐藏事实。Quality Gates、管理员合同/在线/安全、Social Match、Match Chat、完整 `npm test` 167.7 秒和双构建 SHA-256 `E8B8D37C66D8843B61F040EAF5028995A5EBF5E30FDD6ABFF6036AB84EDE304E` 全部通过。
