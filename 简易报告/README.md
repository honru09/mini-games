# Ghost Game 简易报告入口

这里保留“当前要看”的简易报告。需求事实以 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 为准；进度报告由脚本生成，禁止直接手改。

## 当前总进度

- `项目总需求进度报告-20260812.md`：242 项唯一原子需求、六分类、47 个历史/当前请求覆盖组、72 个来源入口、129 个显式依赖节点/267 条依赖边，以及 146/32/48/16 四类主线路由和三条共享 Gate。
- `美术与品牌进度报告-20260812.md`
- `界面与交互进度报告-20260812.md`
- `游戏与局内体验进度报告-20260812.md`
- `社交与玩家关系进度报告-20260812.md`
- `经济成长与商业化进度报告-20260812.md`
- `技术数据AI与跨平台进度报告-20260812.md`

## 最新本地收口

- `DirectMessage-DesignSystem-P1本地实现收口-202608121327.md`：全局私信会话/线程信息层级、发送状态、手机安全区和共享 GSAP Surface Motion 本地纵切；完整最终数字待本批主入口全链覆盖，未发布。
- `requirements/active/control-plane-reset-p0-20260812/`：两份新总指挥报告的执行侧路由、242 项单一归类、三条共享 Gate、TECH-027 当前状态修正与语义 QA；本地未发布。
- `GomokuGhost3D-P0本地实现收口-202608120655.md`：TECH-049 的 default-off Gomoku Three r185/GSAP 3.15 程序化纵切、首帧 ready、Camera/落子 timeline、Raycast、fallback、SW lazy-cache、78+55+41 条专项与完整回归；浏览器连接器仍 `Transport closed`，不标视觉 verified，本地未发布。
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
- `GCoins-Naming-Unified-P0收口-202608101827.md`：G Coins 正式品牌名、统一货币显示 seam、三语言法律说明、source-only 原创图标 provenance、专项/完整回归与审批门禁；本地未发布。
- `ShopPurchaseFeedback-P0购买状态收口-202608101906.md`：正式账号商城 pending/success/error/timeout、requestId/账号/商品关联、重复/迟到/关闭/断线/注销安全边界、Security/Supabase/完整回归；本地未发布。
- `HonruEmoji-P0源稿与合同收口-202608110213.md`：十枚 source-only Honru Emoji、四档派生、atlas/poster、逐枚 provenance、素材库 G-17–G-27 与跨层合同；人工/IP/Golden Set 和 runtime/chat 接入仍保持门禁，本地未发布。

- `GameStageWaveB-四款与GSAP治理本地收口-202608111536.md`：四款 Game Stage Wave B、Game Shell ambient 暂停、GSAP 八 skill 治理、完整回归与未发布外部门禁。
- `UI-Motion-Closure-P1本地实现收口-202608121114.md`：四区同步路由提交、GSAP 3.15 DOM island、有限分层进入、generation/cleanup/reduced-motion/PWA 合同、完整回归与未发布可见门禁。
- `Identity-Avatar-Background-P1本地实现收口-202608121205.md`：统一 Avatar/Frame/Effect/NameFx 深模块、Seat/Lobby/邀请/DM/Playline 身份覆盖、动态背景与 Honru source-only 门禁、完整回归与未发布外部门禁。
- `ThemeContrast-DesignSystem-P1本地实现收口-202608121640.md`：light/dark 语义色层、WCAG 数值合同、焦点/disabled/Toast/Logo、Premium Background textTone 与 Game Stage 主题独立；外部可见矩阵仍未执行，未发布。
- `浏览器连接器与Supabase真实验收解除手册-202608111610.md`：本机授权清理、真实凭证/工具准备、备份迁移、RLS/并发、隔离恢复和非破坏回滚操作顺序。

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
