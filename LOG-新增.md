# 新增日志

> 简易记录项目新增内容。每次改动完成前更新；格式：`日期 时间｜新增内容`。

- 2026-08-07 16:29｜创建 `LOG-新增.md`、`LOG-修改.md`、`LOG-删除.md` 三份中文简易日志。
- 2026-08-07 16:29｜新增五子棋与俄罗斯方块 P0 美术纵切母图和运行时 WebP（大厅封面、五子棋棋盘底材、俄罗斯方块玻璃井底材）。
- 2026-08-07 16:55｜新增 `requirements/` 需求目录，原样收录《Mini Games 对局奖励与成长系统需求增补》并创建需求索引。
- 2026-08-07 18:01｜新增统一服务端奖励引擎、奖励专项回归，以及 `reward_history`、`economy_ledger`、`analytics_events` 审计能力。
- 2026-08-07 18:24｜新增 Supabase 奖励持久 outbox、自动重试机制、奖励流水时间索引，以及 AI 重放、三人名次和 Supabase 短暂故障专项回归。
- 2026-08-07 18:28｜新增六款 Gameplay Upgrade 专项测试、差分/共享依赖文档与一次性实施报告；详情见 `LOG-游戏板块.md`。
- 2026-08-07 18:57｜新增六款游戏 AI 策略知识包，内嵌威胁搜索、Alpha-Beta、随机博弈、净资产策略、影响图和 Tetris 井面评估的研究原则。
- 2026-08-07 19:12｜新增个性化 AI 持续学习引擎、模型/经验数据库表、原子学习 RPC 与专项回归；按玩家和游戏保存局面哈希、候选特征、胜负经验及可回滚修订。
- 2026-08-07 20:06｜新增 Gameplay 第二阶段 Shared Protocol：Tank/Tetris 服务端模块、独立观众席、循环/瑞士赛事、象棋棋钟、大富翁拍卖、公开 Cosmetic 合同及六套专项 QA。
- 2026-08-07 20:06｜新增真实设备待测清单与《六款游戏 Gameplay Upgrade 第二阶段完成报告》；未执行项和 Authority 边界已明确登记。
- 2026-08-07 20:09｜本次最终协议一致性复核无新增文件。
- 2026-08-08 00:15｜新增 60 组三语言服务端错误 reason、语言覆盖/运行时专项回归和零依赖 locale 规范化脚本；鉴权、商城、结算、赛事、观战均可显示具体本地化原因。
- 2026-08-07 23:23｜新增 Tetris、象棋、大富翁共享纯 Rule Core 与三套 v2 Authority adapter、协议注册表、Authority Matrix、Cosmetic Profile 合同及配套 QA。
- 2026-08-07 23:23｜新增 Tournament 自动真实房间/结果/下一轮测试、负载/内存/计时器/逻辑 Chaos 测试和《六款游戏 Gameplay Upgrade 第三阶段最终完成报告》。
- 2026-08-08 00:50｜新增 Project Execution OS：10 个项目级 Skill 规范、项目状态矩阵、风险登记、所有权矩阵、Quality Gates、证据清单模板、Motion Tokens 与副窗融合审阅简易报告。
- 2026-08-08 00:50｜新增 `简易报告/` 归档目录及报告索引，集中保存带年月日时后缀的一次性简易报告。
- 2026-08-08 00:56｜新增 Project Execution OS 当前任务的回归证据登记，完整 npm test 与快速 Quality Gates 均通过。
- 2026-08-08 01:02｜新增线上发布证据：GitHub Pages workflow 成功、Render live、远程 main 与两个首页 HTTP 200 验收通过。
- 2026-08-08 00:26｜新增生成物忽略规则，避免 Python 缓存与 Office 临时锁文件进入版本库。
- 2026-08-08 01:58｜新增《下一窗口执行交接报告》，汇总未整合 Seat/Social/个性化分支、产品入口缺口、逻辑不一致、未完成项和下一步验收顺序。
- 2026-08-08 03:03｜新增 Seat v2、AI Seat/托管者、Social Graph、Profile v2、Premium Background、统一图标系统、Supabase 字段与专项 QA；本轮 npm test、Quality Gates 全部通过。
- 2026-08-08 03:36｜新增游戏外观商品与装备入口、每日任务服务端领取、7 天 Replay MVP、管理员 Metrics 只读接口、赛事 3–6 人选择器与 Admin Recovery 控件；专项及全量回归通过。
- 2026-08-08 13:34｜新增 Replay v1.1 分享/撤销与公开延迟、Tournament v1.1 自愿弃权/指定判负、Metrics v2 管理页面/历史/CSV/告警，以及交接收口一次性报告和验证证据。
- 2026-08-08 13:51｜新增 Render `METRICS_ADMIN_TOKEN` 安全写入能力；生成 256-bit 管理令牌并仅保存到 Render 与本机用户环境变量。
- 2026-08-08 17:45｜新增六款 640/320 大厅过渡封面、轻量素材库与 Schema/哈希/许可审计、商城/响应式契约 QA、五档视觉证据，并冻结 Sticker Cartoon Art Bible/Golden Set M0 执行包。
- 2026-08-08 18:14｜新增可重复的白皮书 P0 增量更新脚本，并生成 40 页 DOCX 最终视觉验收基线。
- 2026-08-08 18:30｜新增首屏静态标题与中文词典一致性回归，防止已删除玩法在 i18n 加载前短暂闪现。
- 2026-08-08 20:13｜新增 Sticker Cartoon M0 Draft：Teacher 八状态与四 Avatar Alpha 源、核心 UI 状态板、五子棋精确 15×15/五连、飞行棋 52 格/每方四机/四剪影、Prompt/provenance、八份 IP Review、视觉证据与执行报告。
- 2026-08-09 00:43｜新增 Ghost Game/Honru 原创 SVG 品牌、独立登录 Page、用户名密码与旧 PIN 迁移、一次性访客、Home/Games/Chat/Profile 四区、Honru 签到/对话、昼夜动态场景、Supabase 迁移字段及四套专项 QA。
- 2026-08-09 00:43｜新增 Ghost Game 冻结需求、浏览器 1440/768/390/360 验收证据，以及 Sticker Cartoon M0 六主题收敛为昼夜双主题的 Change Request。
- 2026-08-09 00:47｜新增 Ghost Game P0 本地验收与发布前收口简易报告，并更新简易报告归档索引。
- 2026-08-09 01:00｜新增 Ghost Game P0 线上发布证据与线上发布收口简易报告。
- 2026-08-09 02:01｜新增默认关闭的 Sticker Cartoon P1 五子棋 998-byte SVG 底材、双闸门 Manifest 管线、激活态规则/安全/回退 QA、30 组合浏览器证据与收口报告。
- 2026-08-09 02:21｜新增 Honru v2 source-only 角色母图候选：色键源、原始 Alpha、Ink/Paper/Cream 三色平涂版、192/96/64/44px 派生、完整 Prompt/provenance、技术/IP Draft、审计证据与简易报告。
- 2026-08-09 03:06｜新增 Honru 九状态 source-only 表情素材：色键/Alpha/三色平涂/四档派生、Prompt 与任务 ID、技术/IP Draft、素材库登记、审计证据和简易报告。
- 2026-08-09 09:19｜新增 Honru P2 默认关闭运行时预览：九张 Alpha WebP、Manifest/Catalog 投影、32 项专项 QA、自动化/浏览器未执行证据与简易报告。
- 2026-08-09 10:31｜新增 Direct Chat v1 好友私聊、离线留言、历史/未读/已读/幂等/安全边界、Supabase 消息与已读 RPC、三语言响应式 UI，以及玩家聊天/Profile 三套专项 QA 和本地收口报告。
- 2026-08-09 12:43｜新增 `94ae977` 的 Render/Pages/HTTP/WS 线上发布证据与玩家私聊、个人主页、Honru P2 线上收口简易报告。
- 2026-08-09 14:37｜新增 Supabase 生产迁移/验收/加密备份/隔离恢复/非破坏回滚工具链、Cluster lease/PubSub/遥测基线、PWA 192/512 图标与安全离线壳层、Honru cleanup 技术候选及 Production Readiness 证据/简易报告。
- 2026-08-09 18:35｜新增六款默认可见 Pocket Tabletop Wave A、共用 Game Stage/真实 Seat Rail/Command Tray、两项专项 QA 与本地浏览器视觉证据，默认美术覆盖达到 52/100。
- 2026-08-09 19:05｜新增 `7fc6601` 的 Render/Pages/HTTP/生产 WS/线上 Chromium 发布证据与 Game Stage/Tabletop Wave A 线上收口简易报告。
- 2026-08-09 19:36｜新增 208 项唯一原子需求台账、六分类加总计七份进度报告、确定性报告生成器、台账 QA 与全量需求治理 active task；反查补入 Honru 聊天范围裁决和 D 盘 LibreOffice/DOCX 任务。
- 2026-08-09 19:48｜新增台账 Schema v2 的 57 项来源词典、97 个依赖节点/168 条无环依赖、六类验收口径和 40 个历史/当前请求覆盖组，覆盖全部 208 项需求。
- 2026-08-09 19:55｜新增全量需求治理的 Quality Gates 与完整 `npm test` 验收记录；本次无新增产品功能、图片或线上发布物。
- 2026-08-09 21:34｜新增沉浸式 Game Shell 五个稳定插槽、Shell 与三类结算弹层专项 QA、四档浏览器截图/交互证据、活动任务冻结件与本地收口简易报告。
- 2026-08-09 21:59｜新增沉浸式 Game Shell P0 最终验收简易报告；本次无其他新增。
- 2026-08-10 00:49｜新增 Social Match P0：`match-expression-v1`、十个稳定 Emoji ID、六个快捷语 ID、目标投掷、头像旁气泡、局内公开 Profile 入口、专项合同/在线 QA、活动任务验收证据与本地收口简易报告。
- 2026-08-10 03:17｜新增 Requirements Governance P0 的 233 项原子需求、60 个来源、41 个请求覆盖组、121 个依赖节点/235 条无环依赖，重建七份 20260810 分类进度报告与历史报告归档索引。
- 2026-08-10 03:17｜新增 UI Repair P0.1：Avatar/Frame/Effect 统一裁切层级、真实身份组合商城预览、Premium Background 播放/暂停/静态降级与生命周期、专项 QA、浏览器证据和中文简报。
- 2026-08-10 04:32｜新增 UI Repair P0.2：Room Launchpad 游戏/人数/隐私/观战配置、六位房间码加入、Lobby 权威状态与本人房过滤、专项 QA、四档三语言双主题浏览器证据及本地验收简报。
- 2026-08-10 05:12｜新增 Tank Controls P0：八扇区 Pointer Capture 摇杆、D-pad 降级、独立多指开火、输入释放与专项 QA；同步 Tank Controls 冻结件、E2E 合同和本地验收简报。
- 2026-08-10 05:20｜本次新增文档索引与快速开始中的 Tank Controls 专项测试入口，未新增产品运行时能力。
- 2026-08-10 05:42｜新增 Tank Art P1 逐字 Prompt/provenance、清理版与拒绝版源稿登记、素材库 G-12/G-13 reference-only 条目、Tank Art P1 收口简报。
- 2026-08-10 06:20｜新增 Social Match 会话能力复核修正简报，记录同一 WebSocket 会话失效后局内表达 capability 保持、双构建哈希和浏览器权限边界。
- 2026-08-10 07:06｜新增 Player Character P0 独立公开合同、服务端深模块、专项隐私/联机/重连测试、Social Match Seat 合同修正及本地实现收口简报。
- 2026-08-10 07:08｜新增 Player Character P0 最终构建 SHA-256 证据与分类进度报告同步结果。
- 2026-08-10 07:26｜新增 ART-036 角色五姿态与大富翁实体棋盘最高质量 source-only 源稿、逐字 Prompt/provenance、人工审查清单、素材库 G-14/G-15 和收口简报。
- 2026-08-10 07:34｜新增 ECO-029 角色经济合同、默认空目录纯适配器、8 组 owned/equipped/requestId/隐私专项 QA 和收口简报。
- 2026-08-10 07:37｜新增 ECO-029 完整主链 106.6 秒全通过证据；Player Character P0 与经济合同现已同时受 pretest 保护。
- 2026-08-10 08:16｜新增 UI-037/GAME-045 代码原生角色表现投影与 Monopoly Presentation Adapter，补充连续 revision/transition、重连/观战 snap、reduced-motion、跨 realm 输入兼容、专项 QA 与收口简易报告；未审批 ART-036 仍未进入 runtime。
# 2026-08-10 08:48
- 新增 `public/src/games/monopoly-ui-state.js`，统一大富翁完整局内状态矩阵派生。
- 新增 `qa/ui-037-monopoly-presentation.js`，覆盖 16 个状态/隐私/兼容断言。
- 新增 `简易报告/UI037-GAME045状态矩阵本地收口-202608100848.md`，记录本地收口、验证结果与未完成闸门。
# 2026-08-10 09:04
- 新增 `简易报告/UIRepair-P0.3聊天空态语言收口-202608100904.md`，记录玩家聊天系统空态 i18n 修正和最终回归。
# 2026-08-10 09:16
- 新增 UI Repair P0.3 最终回归证据：局内表情目标无昵称 fallback 的本地化边界、最终构建哈希与完整 `npm test` 收口记录。
- 新增 `PROJECT_STATUS.json` 的 `uiRepairP03` 本地能力条目，明确已实现范围、未执行外部闸门与不发布边界。
# 2026-08-10 09:47
- 新增 UI Repair P0.4：公开 Profile/社交/邀请/举报/Block 弹层专项合同、玩家原文与系统文案分离、键盘 Profile 入口、背景 radio 语义和本地验收简易报告。
- 新增 `requirements/active/ui-repair-p04-profile-social-p0-20260810/` 的冻结合同、计划、执行、验收和所有权文件。
- 新增 `PROJECT_STATUS.json` 的 `uiRepairP04` 本地能力证据。
# 2026-08-10 09:51
- 新增 AGENTS/README/WHITEPAPER 的 UI Repair P0.3/P0.4 当前节点说明与最终构建证据索引。
# 2026-08-10 10:10
- 新增 UI Repair P0.5 动态背景预览状态收口简易报告、active task 完成证据与动态 VM 回归。
- 新增 Premium Background poster/animated/static fallback 链、统一 playback-state 订阅合同及 `uiRepairP05` 状态证据。
# 2026-08-10 10:27
- 新增 UI Repair P0.6 访客持久化动作提示 active task、15 项专项合同、no-send VM 回归、`uiRepairP06` 状态证据和收口简易报告。
- 新增访客商城只读说明与购买/好友/Block/Report/主动邀请的三语言 `aria-disabled` 提示。
# 2026-08-10 10:40
- 新增 UI Repair P0.7 公开 Profile 权威加载态 active task、UID 绑定/取消/迟到响应专项合同、`profile_loading` 三语文案和收口简易报告。
- 新增 `uiRepairP07` 状态证据，记录 leaderboard cache miss 改走 `profile_get` 的本地回归。
# 2026-08-10 10:51
- 新增 UI Repair P0.8 商城密度/试穿层级/商品卡排版 active task、专项合同、浏览器权限限制证据和收口简易报告。
- 新增 `uiRepairP08` 状态证据，记录 1080px 桌面商城、144px 商品网格、Premium Background 16:9 poster、动态/静态层级标签与手机 44px/双列合同。
# 2026-08-10 11:08
- 新增 UI Repair P0.9 玩家 Direct Chat 表现层 active task、16 项专项合同、会话/历史加载状态、日期分隔、滚动锚点、未读语义和收口简易报告。
- 新增 `uiRepairP09` 状态证据与 `test:ui-chat-presentation` 入口；所有三语系统文案进入 locale。
- 2026-08-10 11:47｜新增 `match-chat-v1` 房间自由文本聊天 active task 的验收/执行证据、Game Stage 房聊合同、草稿保留回归、收口简易报告与最终构建哈希记录。
- 2026-08-10 11:47｜新增 `PROJECT_STATUS.json` 的 `socialMatchChatP1` 能力条目，记录服务端权威、内存 50 条边界、外部闸门与下一条 Home Engagement 主线。
- 2026-08-10 12:14｜新增 Home Engagement P0 active task、首页三步引导/推荐/成长目标、20 个三语言文案、静态与动态 VM 合同及本地收口简报。
- 2026-08-10 12:14｜新增 `PROJECT_STATUS.json` 的 `homeEngagementP0` 能力条目，记录正式账号/访客分支、可访问焦点、外部闸门和 Tabletop Presentation M1 下一主线。
# 2026-08-10 12:56
- 新增 Tabletop Presentation M1 第一纵切 active task 收口证据、唯一 `TabletopPerspective` 模块、专项契约、本地收口简报和 `tabletopPerspectiveM1` 状态条目。
- 新增本地近端视角回归：五子棋第二席 180°、飞行棋 2/3/4 人阵营旋转、越界输入拒绝、E2E 压紧后同步和双构建哈希记录。
# 2026-08-10 13:10
- 新增 Tabletop Presentation M1 Action Presentation active task、动作表现冻结合同、专项回归断言和动作表现收口简报。
- 新增五子棋程序化墨线冲击/reduced-motion 静态强调的收口证据；登记飞行棋既有路径移动、起飞、碰撞和终点反馈的复核范围。
# 2026-08-10 13:31
- 新增 Tabletop Presentation M1 Stage Finish active task、镜头/排名台冻结合同、三语言排名文案、Victory 动态排名回归和本地收口简报。
- 新增 `tabletopStageFinishM1` 状态证据：五子棋/飞行棋入场镜头、飞行棋 2/3/4 人真实 placement 排名台、双构建哈希和外部门禁。
# 2026-08-10 14:22
- 新增 Progression Identity P1：六款游戏各 1/10/50/100/1000 胜场称号，共 30 个三语称号、只读派生模块、异常输入回归、本人/公开 Profile 接入和收口简报。
- 新增 Profile Journey P1：三张只读目标卡（最近称号、成就进度、收藏规模）、共享派生模块、专项 QA、active task 与收口简报。
- 新增 `progressionIdentityP1`、`profileJourneyP1` 状态证据，并同步七份进度报告和报告入口。
# 2026-08-10 14:50
- 新增 Profile Compare P1：正式好友/双向 Block 权限消息、窄化战绩投影、双列比较弹层、三账号在线回归、active task 与收口简报。
- 新增 `profileCompareP1` 状态证据，并在协议注册表登记 `profile-compare-v1`；三语比较文案和手机单列/44px 合同已纳入完整测试。
# 2026-08-10 15:33
- 新增 Profile Modal A11y P1 active task、动态浏览器式生命周期合同、`profileModalA11yP1` 状态证据和本地收口简报。
- 新增 Profile 编辑器/成就弹层的 44px、`100dvh` 内部滚动和手机响应式合同；专项进入 `pretest`。
# 2026-08-10 15:59
- 新增 Collection Rarity Catalog P1：150 项五类显式不可变目录、四档中性展示、本人 Profile 分布、商城三语标签、专项 QA、active task 与收口简报。
- 新增 `collectionRarityP1` 状态证据；默认免费 avatar 0–29 与 frame/effect/background 0 明确归入 Starter。
- 2026-08-10 16:27｜新增 `homeEngagementP1` 能力治理证据与《HomeEngagement-P1社交收藏脉冲收口》简报，记录正式账号-only 的在线好友数/本人收藏/既有成长方向安全聚合、既有 Profile/Chat/Shop 入口和有界本地关闭状态；本批不新增功能或持久数据。
- 2026-08-10 17:10｜新增 Home Identity P1 active task、红测/绿测专项、现有首页脉冲身份条与《HomeIdentity-P1当前身份条收口》简报；新增正式账号-only 56px 头像组合、raw 昵称、本地化等级和安全边界证据。
- 2026-08-10 17:28｜新增 Home Active Match Return P0 active task、当前对局返回卡、三语文案、stale/lifecycle 专项与《HomeActiveMatchReturn-P0当前对局返回收口》简报。
# 2026-08-10 18:27
- 新增 G Coins Naming / Unified Currency P0 active task、契约、专项 QA、G Coins source-only Prompt/provenance、素材库 ART-026 条目、收口简报与 PROJECT_STATUS/需求台账证据。
- 新增三语言 `currency_name`、`currency_aria`、`currency_legal`，以及 `currencyName()` / `currencyAmountText()` 统一显示 seam。
- 2026-08-10 18:36｜新增 `requirements/active/g-coins-naming-unified-p0-20260810/evidence/local-verification-202608101827.json`，记录 221 秒完整回归、双构建哈希与未发布边界。
- 2026-08-10 19:06｜新增 Shop Purchase Feedback P0 active task、状态机合同、专项 QA、三语言购买状态、协议注册表、验证证据和《ShopPurchaseFeedback-P0购买状态收口》简报。
- 2026-08-11 00:04｜新增隔离式测试管理员 P0：`server/test-admin.js`、四类专项/安全 QA、active task、Render `sync:false` 声明、TECH-053 台账项与中文简报；提供私有无限 G Coins、MAX、当前目录全拥有和显式能力白名单，真实凭证不写入仓库。
- 2026-08-11 00:04｜新增离房后旧 `room_update` 不得复活旧房间的客户端生命周期回归；修复后连续三轮 E2E 全通过。
- 2026-08-11 00:51｜新增测试管理员共享 UID 校验 helper、沙盒设置不可翻转回归、结算后局内聊天/表达拒绝及观众延迟取消回归；新增 Supabase 管理员远端引导 fail-closed 静态合同。
