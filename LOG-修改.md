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
