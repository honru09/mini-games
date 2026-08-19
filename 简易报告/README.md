# Ghost Game 简易报告入口

这里保留“当前要看”的简易报告。需求事实以 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 为准；进度报告由脚本生成，禁止直接手改。

## 当前总进度

- `项目总需求进度报告-20260819.md`：242 项唯一原子需求、六分类、48 个历史/当前请求覆盖组、79 个来源入口、129 个显式依赖节点/267 条依赖边，以及 146/32/48/16 四类主线路由和三条共享 Gate；四窗口并行期间，当前构建 SHA/bytes 由该自动生成报告的 TECH-027 段和 `node scripts/build.js --check` 共同给出，静态入口不把任一时点快照冒充永久当前；当前仍尚无匹配的浏览器完整矩阵，`915A97F3…B8C8EFC` 的完整单浏览器矩阵仅为 historical-as-of。T7 已完成六类 Server Boundary 本地窄纵切、Reward/Progression P7、Boundary Clock Injection P8、Room Graph Recovery P9、Ephemeral Cleanup P10、Reconnect Lifecycle P11 与 Heartbeat Sweep P12；P12 专项、连接、赛事和独立端口 E2E 已通过，统一 Quality Gates 与完整 npm test 正在本批末集中复核。
- 上述总报告现在是完整整合阅读版：先给主线切换百分比，再按美术、界面、游戏、社交、经济、技术顺序展开 242 项明细；七份分类报告保留为按领域快速查阅版。
- `美术与品牌进度报告-20260819.md`
- `界面与交互进度报告-20260819.md`
- `游戏与局内体验进度报告-20260819.md`
- `社交与玩家关系进度报告-20260819.md`
- `经济成长与商业化进度报告-20260819.md`
- `技术数据AI与跨平台进度报告-20260819.md`

## 最新本地收口

- `美术与开发Gate全面解禁收口-202608162318.md`：所有者授权解除人工清稿、Reviewer B、IP/法律与逐资产 Golden Set 的开发前置，设备/Supabase 改为发布证据待决；清理顶层、艺术来源与 active task 陈旧状态机，扩展防回退 QA，最终 Quality Gates、完整 npm test、报告幂等与双构建通过；本地未发布。
- `技术优化主线-T6互动完整性影子审计P0收口-202608162000.md`：Tank Authority accepted-action shadow、Human/AI cohort、Test Admin/spectator 排除、Reward/公开 wire 不变与当前六方向百分比；默认关闭，本地未发布。
- `技术优化主线-T7房间在场与赛事事务收口-202608171220.md`：Room/Presence 深模块、赛事多房原子迁移、quarantine/recovery、统一观战清理、READY 幂等竞态修复与 Match Protocol 边界入口；T7 仍为 partial，本地未发布。
- `技术优化主线-T7-Match-Protocol边界收口-202608171301.md`：Match Protocol `command/transition` 深模块、JSON/isolated Adapter、match/generation/sequence/revision fences、effect ordering、rollback、三套 v2 Authority 与 server/index 接线；21/21 本地回归通过，T7 仍为 partial，外部证据与发布均未执行。
- `技术优化主线-T7-Chat-Playline边界接线收口-202608171703.md`：Direct Chat/Playline `chat/playline` 深边界、本地 JSON 接线、并发 mutation 串行化、22/22 项专项、私聊/Playline/Security 在线回归和 Supabase RPC fallback；P5 Reward/Economy outbox 已另行完成本地验证，整体仍本地未发布。
- `技术优化主线-T7-Clock-Timer-P6收口-202608172015.md`：`now/schedule/dispose` 深模块、Node/Manual 双 Adapter、owner generation/清理/异常隔离、Operational Metrics `now/cadence` 唯一 caller、Timer Audit 与当前构建证据；server-wide time 仍为 partial，本地未发布。
- `技术优化主线-T7-Reward-Progression-P7-收口-202608180120.md`：已解析 Reward 的 profile/daily/achievement/recentResults 深 Module、JSON/Memory Adapter、固定 `meta.at` 与 P5/wire 保持；完整 Quality Gates、npm test 与双构建通过，本地未发布。
- `技术优化主线-T7-Server-Boundary-Clock-Injection-P8收口-202608182051.md`：六个既有 Server Boundary 统一 `serverNow → ServerClockTimer.now()`，Tank Delta 独立回归、Quality Gates、完整 npm test、进度/简报合同与当前确定性构建检查全部通过；T7 仍 partial，本地未发布。
- `技术优化主线-T7-Room-Graph-Recovery-Timer-P9收口-202608182057.md`：Room Graph Recovery 周期改用 `ServerClockTimer` owner lease，队列清空取消、赛事原子恢复在线回归与 Timer Audit 通过；T7 仍 partial，本地未发布。
- `技术优化主线-T7-Ephemeral-Cleanup-Timer-P10本地实现-202608182132.md`：访客临时账号清理改用按 UID ServerClockTimer lease，账号、连接恢复、Timer Audit、Quality Gates、完整 npm test 与当前 3D 构建检查均通过；本地未发布。
- `技术优化主线-T7-Reconnect-Lifecycle-Timer-P11本地收口-202608182245.md`：reconnect grace/Presence 失败重试与 room removal retry 改用按 Session ServerClockTimer owner lease，统一恢复/离房取消；Timer Audit、重连/E2E、Quality Gates 与专用端口完整 `npm test` 均通过；当前本地未发布。
- `技术优化主线-T7-Heartbeat-Sweep-Timer-P12本地收口-202608190948.md`：heartbeat 改用单一 repeat owner 与同 tick 时间样本，分域隔离保证异常后同 tick/第二 tick 继续；ServerClock/Heartbeat、连接、赛事与独立端口 E2E 已通过，统一全链待本批末记录；当前本地未发布。
- `技术优化主线-T5坦克传输与预测收口-202608162000.md`：Tank v2 keyframe/delta、default-off v1 回退、观众延迟生命周期、Prediction/路径扫掠与 Sol Max 主审修正；本地未发布。
- `技术优化主线-T4棋类AI工作线程收口-202608162000.md`：象棋/五子棋 Worker Broker、Zobrist/TT/开局库、候选 ID-only 与同步/DeepSeek/学习 fallback；默认关闭，本地未发布。
- `技术优化主线-T3反馈与输入边界收口-202608161643.md`：FeedbackBus、GameplayInputGate、Tank 本地声像/震动 Adapter、Tetris/Tank 调用方接入和历史 T3 窄证据；其中“T4–T7 尚未完成”已被上方 T4–T6 后续收口取代，当前只剩 T7 及真实外部证据。
- `技术优化主线-T2游戏模块加载与构建预热-202608161530.md`：GameModuleLoader、deterministic build check/write、SW intent-only warmup和当时的五档四区/六款舞台/三语言/双主题/reduced-motion/forced-colors 证据；该构建现为 historical-as-of。
- `TECH027-当前构建PROVE-P4本地收口-202608160620.md`：历史构建 P4 五档四区/共享表面/六款 Game Stage 单 Chromium 可见矩阵；旧构建继续 historical-as-of，当前 T2 证据以 `current-build-single-browser-verification-t2-202608161530.json` 为准。
- `技术优化主线-T0授权与缩放修复-202608161331.md`：技术优化授权去重归类、深模块合同、自动 Gate 子项边界、viewport 缩放修复、完整测试数字与 T1–T7 下一步；本地未发布。
- `技术优化主线-T1诊断环与渲染治理-202608161401.md`：ClientDiagnosticsRing 与 RendererRuntimeGovernor 的本地基线、Terra Max 审核、专项测试、构建哈希和 T2 下一步；默认关闭，本地未发布。
- `GCoins表现统一P1本地收口-202608151934.md`：Home/Profile/Shop/排行榜/邀请/玩家列表统一原子金额节点，Reward 保持纯文本 seam；Service Worker v13 修复陈旧词典。该报告的旧构建窄证据为 historical-as-of；设备/网络只保留发布证据待决，人工美术咨询可选，本地未发布。
- `TankGhost3D-P5本地纵切收口-202608150945.md`：坦克大战第六款 Ghost3D、accepted `tank-authority-v1` raw receipt、5/128/221 有界对象池、44px 输入与单浏览器部分证据；该报告形成时的“Gate/正式美术阻塞”措辞为 historical-as-of。当前设备/网络不阻塞开发，原创美术按 `OWNER_AUTHORIZED_ART_CLEARANCE` 推进，线上仍未发布。
- `TetrisGhost3D-P4本地纵切收口-202608150210.md`：俄罗斯方块 default-off 单观察井、accepted v3-only、Rule-Core-consistent `piece_locked`、GSAP 3/2 tween 预算、context recovery fresh generation、单浏览器部分证据和最终完整回归；本地未发布。
- `LudoGhost3D-P1本地纵切收口-202608141952.md`：飞行棋 default-off Three r185/GSAP 3.15 Renderer、2/3/4 人投影、单复合移动、390×844/1440×900/实时 viewport/reduced-motion 单浏览器部分证据与最终全链；默认二维 fallback 保留。该报告的跨设备/性能/正式美术 Gate 阻塞措辞为 historical-as-of；当前开发通道开放。
- `GCoins-P1-最高质量源稿技术首选收口-202608141756.md`：A/B/C 三方向、Candidate B Alpha/四档小尺寸和三底色技术审查；该 source-only 报告中“人工清稿、Reviewer B、IP、Golden Set 与真机阻塞”是 historical-as-of。当前原创候选按 `OWNER_AUTHORIZED_ART_CLEARANCE` 推进，可选咨询不阻塞开发。
- `ArtAssets-素材完整性与分层结构补全-202608141010.md`：原创 14 族 236 文件与外部 3,819 份 PSD/AI/EPS 的完整性/结构读取证据；该报告的 Golden Set Gate 阻塞是 historical-as-of。原创 Ghost-native 资产改走所有者清除轨道，外部 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材仍永久禁用。
- `ArtApprovalMatrix-美术候选治理收口-202608140820.md`：统一既有 fallback、source-only、default-off 与外部 reference-only 的候选矩阵；该报告的 Golden Set Gate 阻塞是 historical-as-of。当前人工/IP/Golden Set 仅为可选咨询，发布仍需当前用户明确命令。
- `BriefReport-TECH050中文收口合同-202608132155.md`：TECH-050 中文任务收口简报合同、模板、敏感信息扫描和 QA；它只规范每批交接，不替代七份进度报告和三份日志，未发布。
- `模板-任务收口简报.md`：后续主线批次可复制的中文简报模板。
- `VerticalSlice-TECH051纵切完成定义-202608132205.md`：十项体验纵切门槛、四级证据和禁止伪完成合同；只改治理，不发布。
- `ADR-TECH039架构决策治理-202608132230.md`：ADR 目录、模板、状态/证据/回滚和敏感信息边界；没有替用户做具体生产架构选择。
- `BugIntake-TECH041缺陷回归闭环-202608132300.md`：脱敏、分级、复现、修复、回归和关闭的 Bug Intake 合同；未改变线上。
- `Performance-TECH033性能预算治理-202608132330.md`：Shell/Game Stage/GSAP/素材/列表性能预算、Manifest 与真实设备证据边界；不宣称真机 FPS。
- `AssetLibrary-TECH031双层事实源-202608140000.md`：catalog 治理索引与 Manifest 运行时事实分层、source/reference-only 隔离和本地回滚；未上传素材。

- `DirectMessage-DesignSystem-P1本地实现收口-202608121327.md`：全局私信会话/线程信息层级、发送状态、手机安全区和共享 GSAP Surface Motion 本地纵切；完整最终数字待本批主入口全链覆盖，未发布。
- `requirements/active/control-plane-reset-p0-20260812/`：两份新总指挥报告的执行侧路由、242 项单一归类、三条共享 Gate、TECH-027 当前状态修正与语义 QA；本地未发布。
- `GomokuGhost3D-P0本地实现收口-202608120655.md`：TECH-049 的 default-off Gomoku Three r185/GSAP 3.15 程序化纵切、首帧 ready、Camera/落子 timeline、Raycast、fallback、SW lazy-cache、78+55+41 条专项与完整回归；2026-08-14 已补单一 Chromium 的部分可见证据，跨设备/性能/正式美术 Gate 仍未完成，本地未发布。
- `GomokuGhost3D-单浏览器可见复核-202608140900.md`：默认关闭回退、临时 BALANCED Three 预览、Raycast 落子、AI 回合和 reduced-motion 的单浏览器证据；验证后已恢复默认关闭。
- `Ghost3D-Foundation-P0本地收口-202608120529.md`：历史前置 Foundation 批次，记录 narrow seam、inert build 注册、三轮 reviewer 修正与 41 条本地断言；其中“下一步才是 Gomoku”已由上方后续纵切取代，本报告仍保留当时事实。
- `六款游戏局内差距重排审计-202608111303.md`：纠正线上/本地/默认关闭/未实现四类状态，并冻结五子棋 + Tetris Wave B 下一主线。
- `PlaylineCommunity-P0本地收口-202608111303.md`：四区 Playline、全局好友私信弹层、四类权威分享、主审修正、完整回归和生产默认关闭边界。

- `测试管理员P0安全账号本地收口-202608110004.md`：环境精确绑定、虚拟无限 G Coins/MAX、当前目录全拥有、公开/社交/正式经济/Replay/AI/Analytics 隔离，以及离房旧 room_update 竞态修复；完整测试和三轮 E2E 通过，凭证不入仓库。
- `UIRepair-P0.1本地实现简报-202608100315.md`：头像/头像框/特效统一、商城真实身份组合、动态背景播放/暂停与生命周期；1280×720 双主题三语实测，Header/Modal 层级缺陷已转入 P0.2；未发布。
- `SocialMatch-P0本地验收收口-202608100049.md`：局内玩家身份、Emoji/快捷语、目标投掷、气泡、公开 Profile、安全边界、四档浏览器和完整测试；未发布。
- `UIRepair-P0.2本地验收简报-202608100426.md`：Room Launchpad、Lobby 权威状态、赛事可见性与身份切换修复；四档双主题三语和完整测试；未发布。
- `TankControls-P0本地验收简报-202608100512.md`：八扇区摇杆、D-pad、独立开火、输入释放、联机 E2E 与完整测试；浏览器 localhost 权限阻塞，未发布。
- `TankArt-P1源稿与素材库收口简报-202608100542.md`：Tank Art P1 两版 gpt-image-2 源稿、逐字 provenance、素材库 reference-only 登记与审批边界；生产 manifest 未变，未发布。
- `SocialMatch-会话能力复核修正-202608100620.md`：确认同一 WebSocket 会话失效/注销/房间重置后保留局内表达 capability；源码、联机回归和双构建通过，localhost 浏览器权限闸门未绕过。
- `PlayerCharacter-P0本地实现收口-202608100706.md`：独立玩家虚拟形象公开合同、服务端安全投影、客户端只读缓存、Social Match Seat 合同同步与完整回归；未发布。
- `ART036-角色与大富翁美术源稿收口-202608100726.md`：最高质量 gpt-image-2 角色/实体棋盘方向板、逐字 provenance、素材库 G-14/G-15 reference-only 登记与审批边界；未发布。
- `PlayerCharacter-ECO029经济合同收口-202608100734.md`：角色经济纯适配器、默认空目录、owned/equipped/requestId/隐私合同与 8 组专项 QA；正式 Supabase/RPC/商城未启用。
- `UIRepair-P0.5动态背景预览状态收口-202608101010.md`：动态背景 poster/animated/static fallback、播放状态订阅、reduced-motion/observer/visibility cleanup 与动态 VM 回归；本地未发布。
- `UIRepair-P0.6访客持久化动作提示收口-202608101027.md`：访客只读商城、购买/好友/Block/Report/主动邀请双层阻断、三语言提示与 no-send VM 回归；本地未发布。
- `UIRepair-P0.7公开Profile权威加载态收口-202608101040.md`：排行榜缓存缺失时的 profile_get、可取消三语 loading、null/成功/迟到响应处理与专项回归；本地未发布。
- `UIRepair-P0.8商城密度试穿层级收口-202608101051.md`：桌面 1080px、268–320px 真实试穿、144px 商品网格、Premium Background 16:9 poster、动态/静态标签、手机双列/44px；localhost 可见复核受权限阻断，本地未发布。
- `UIRepair-P0.9玩家私聊表现层收口-202608101108.md`：会话刷新/连接态、未读、历史加载/日期、旧页滚动锚点、断线 pending 清理、移动安全区与 enterkeyhint；direct-chat-v1 未改变，本地未发布。
- `SocialMatch-P1房间自由文本聊天收口-202608101147.md`：match-chat-v1 服务端权威、净化/幂等/频控/Block/观众延迟、局内历史/未读/气泡/举报/静音、草稿保留与完整回归；本地未发布。
- `HomeEngagement-P0首页引导复玩入口收口-202608101214.md`：首页三步引导、既有档案推荐、level/streak 目标、访客安全入口、游戏卡焦点和动态 VM 回归；本地未发布。
- `TabletopPresentation-M1第一纵切收口-202608101256.md`、`TabletopPresentation-M1Action动作表现收口-202608101310.md`、`TabletopPresentation-M1镜头排名台收口-202608101331.md`：本地近端视角、墨线/路径动作、镜头与 2/3/4 人排名台；本地未发布。
- `ProgressionIdentity-P1六款胜场称号收口-202608101356.md`：六款 × 五档权威胜场称号、三语言、本人/公开 Profile、异常输入与伪造防护；本地未发布。
- `ProfileJourney-P1个人主页目标卡收口-202608101417.md`：最近称号、成就进度、收藏规模三张只读目标卡及路由动作；好友比较/稀有度/旧弹层 a11y 继续独立排队；本地未发布。
- `ProfileCompare-P1正式好友战绩比较收口-202608101450.md`：正式好友/双向 Block/窄化投影、双列比较弹层、三账号在线权限和断线生命周期收口；下一主线为旧 Profile 弹层 a11y，本地未发布。
- `ProfileModalA11y-P1旧弹层收口-202608101533.md`：Profile 编辑器/成就弹层的统一 dialog、焦点、关闭、滚动锁和手机宽度收口；下一主线为收藏稀有度目录，本地未发布。
- `CollectionRarity-P1不可变目录收口-202608101559.md`：150 项显式稀有度目录、本人 Profile 分布和商城三语标签收口；为首页安全聚合提供只读基础，本地未发布。
- `HomeEngagement-P1社交收藏脉冲收口-202608101627.md`：正式账号-only 的在线好友数/本人收藏/既有成长方向脉冲、Profile/Chat/Shop 复用、每账号固定本地日期关闭值与有界存储主审修正；无服务端或经济变化，本地未发布。
- `HomeIdentity-P1当前身份条收口-202608101710.md`：既有首页脉冲内的正式账号 56px 头像组合、raw 昵称、本地化等级、收藏 X/Y 与既有 Profile/Shop 入口；访客私有字段隔离、catalog 降级、三语/响应式/完整回归，本地未发布。
- `HomeActiveMatchReturn-P0当前对局返回收口-202608101728.md`：同实例仍有效真人联机 Game Stage 的返回入口、stale match/结算/过期 fail-closed 生命周期、零协议/持久化/奖励副作用与完整回归；不代表跨设备/跨重启恢复，本地未发布。
- `GCoins-Naming-Unified-P0收口-202608101827.md`：G Coins 正式品牌名、统一货币显示 seam、三语言法律说明、source-only 原创图标 provenance、专项/完整回归与当前所有者清除边界；本地未发布。
- `ShopPurchaseFeedback-P0购买状态收口-202608101906.md`：正式账号商城 pending/success/error/timeout、requestId/账号/商品关联、重复/迟到/关闭/断线/注销安全边界、Security/Supabase/完整回归；本地未发布。
- `HonruEmoji-P0源稿与合同收口-202608110213.md`：十枚 source-only Honru Emoji、四档派生、atlas/poster、逐枚 provenance、素材库 G-17–G-27 与跨层合同；该报告的人工/IP/Golden Set 与 runtime 门禁为 historical-as-of。当前 `P-HONRU-EMOJI-V1` 已取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并可逆 default-on 接入既有局内表达，Direct Chat/match-chat 仍为纯文字，本地未发布。

- `GameStageWaveB-四款与GSAP治理本地收口-202608111536.md`：四款 Game Stage Wave B、Game Shell ambient 暂停、GSAP 八 skill 治理、完整回归与未发布外部门禁。
- `UI-Motion-Closure-P1本地实现收口-202608121114.md`：四区同步路由提交、GSAP 3.15 DOM island、有限分层进入、generation/cleanup/reduced-motion/PWA 合同、完整回归与未发布可见门禁。
- `Identity-Avatar-Background-P1本地实现收口-202608121205.md`：统一 Avatar/Frame/Effect/NameFx 深模块、Seat/Lobby/邀请/DM/Playline 身份覆盖、动态背景与 Honru source-only 门禁、完整回归与未发布外部门禁。
- `ThemeContrast-DesignSystem-P1本地实现收口-202608121640.md`：light/dark 语义色层、WCAG 数值合同、焦点/disabled/Toast/Logo、Premium Background textTone 与 Game Stage 主题独立；外部可见矩阵仍未执行，未发布。
- `浏览器连接器与Supabase真实验收解除手册-202608111610.md`：本机授权清理、真实凭证/工具准备、备份迁移、RLS/并发、隔离恢复和非破坏回滚操作顺序。
- `TECH027-最新单浏览器可见矩阵-202608140615.md`：最新 localhost 单一 Chromium 五档 viewport、四区/弹层/六 Game Stage、三语/双主题/CDP reduced-motion 可见证据，以及三处响应式修复和外部门禁边界。
- `Supabase-DATA生产门禁只读预检-202608140702.md`：本机凭证存在性、PostgreSQL 工具、零连接 dry-run、同 project-ref 恢复隔离修复与 `LOCAL_STATIC_OR_FAKE_ONLY`/生产阻塞边界。

## 历史归档

已结束的一次性报告和旧日期进度快照已移动到 `历史归档/`，内容没有删除：

- `历史归档/2026-08-08/`
- `历史归档/2026-08-09/`

归档规则与清单见 `历史归档/README.md`。旧日期的七份生成报告保持同目录成组归档，因此它们之间的相对链接仍然有效。

## 命名与更新规则

- 一次性报告：`主题名-YYYYMMDDHHmm.md`。
- 生成进度报告：`主题进度报告-YYYYMMDD.md`。
- 每次代码或文档批次完成后，先更新台账、重新生成七份进度报告，再更新根目录 `LOG-新增.md`、`LOG-修改.md`、`LOG-删除.md`。
- 未经用户当前任务明确要求，不提交、不推送、不部署。
