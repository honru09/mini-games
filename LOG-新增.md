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
