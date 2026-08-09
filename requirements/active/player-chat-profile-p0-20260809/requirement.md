# 玩家私聊与个人主页深度优化 P0

状态：`FROZEN`

## Goal

在不破坏既有 Social Graph、Honru、六款游戏、奖励、账号与商城的前提下，先交付正式玩家之间可持久、可重连、可审计边界清晰的一对一好友私聊，再将个人主页升级为以身份、成长、战绩、成就、社交和装扮为主线的产品级页面。

## IN

- Chat 路由默认进入“玩家消息”，Honru 保留为 Chat 内独立子页。
- 正式账号之间的一对一好友私聊：会话列表、历史分页、离线留言、未读、已读、发送幂等、多会话同步与重连恢复。
- 服务端权威签发消息 ID、会话 ID、序号、时间和发送者；客户端只提交目标、正文和 `clientMessageId`。
- 好友关系、双向 Block、访客、输入长度、频控、跨会话读取和伪造身份的服务端拒绝。
- 本地 JSON 有界持久化；Supabase 增加消息与已读表、索引、RLS/revoke，并保留程序化本地回退。
- Desktop/Tablet 双栏、Mobile 会话列表/线程主从切换；断线、空列表、无好友、关系失效和访客均有明确状态。
- 从好友列表、好友公开档案进入会话；离线好友允许留言。
- 个人主页深度优化：身份 Hero、等级与 XP、总战绩、六游戏战绩、连胜、成就、精选展示、装扮、好友/最近一起玩、每日任务和 Replay 快捷入口。
- 三语言、昼夜主题、44px 触控、键盘操作、原文隔离、reduced-motion、响应式自动化与视觉证据。

## OUT

- P0 不做群聊、房间频道、语音、图片、文件、富文本、端到端加密、消息编辑、消息删除、全文搜索或跨平台推送通知。
- P0 不允许陌生人私信；解除好友后历史只读，不能继续发送。
- P0 不把 Honru 对话与玩家私聊混为同一种数据，也不持久化 Honru 原文。
- P0 不新增或伪造 MMR、段位、在线时长、历史最高排名等不存在的权威数据。
- 不把自动化测试当作真实 Supabase、真实设备、第二浏览器或人工视觉验收。
- 本任务不批量生成新美术；复用已冻结的 Ghost Game/Honru 和装扮资产及 fallback。

## Non-negotiable

- `server/index.js`、`public/src/online/03-websocket.js`、`supabase/schema.sql` 与 `public/index.html` 按 HIGH_RISK 流程由 Master 成对集成；生成产物只由 `scripts/build.js` 更新。
- 消息正文是用户原文：纯文本渲染，不使用 `innerHTML`，不进入普通日志、Analytics、Profile、排行榜、Replay 或公开 payload。
- 服务端从已认证 session 推导 sender；会话 ID 只由双方 UID 排序推导；目标必须存在、非访客且当前或历史参与关系合法。
- 正式发送仅限当前好友且双方无 Block；解除好友后仅参与者可读取既有历史，任一方向 Block 后读取和发送均拒绝。
- 访客不能使用玩家私聊或持久消息，但仍可使用 Honru 离线/在线能力。
- 单条正文去除 NUL、统一换行、首尾裁剪后为 1–500 Unicode 字符；稳定限频、幂等和有界留存必须同时具备。
- `clientMessageId` 在发送者维度唯一；同 ID 同内容返回原消息，同 ID 不同内容拒绝 `idempotency_conflict`。
- 三份 locale key 完全同构；昵称、消息正文和用户签名必须标记 `data-i18n-raw`。
- 个人购买背景不随昼夜主题变化；所有统计只读既有服务端字段，分母为 0 时胜率显示 `—`。
- 真实 Supabase、实机、真实网络整形与线上发布未完成前保持 `BLOCKED/NOT_EXECUTED`，不得声称 production-ready。

## Known Existing Behavior

- `#/chat` 当前只有 Honru Companion，没有玩家消息协议、消息存储、会话、未读或已读。
- Social Graph v1 已有好友、请求、Block、举报与 Presence，协议文档明确不含聊天。
- Profile 路由当前只展示头像 Hero、金币/局数/胜场和少量入口，已有 `level/xp/streak/bestStreak/wins/played/achievements/dailyTasks/playmates/showcase/cosmetics` 未形成清晰信息架构。
- Render 文件系统不应被视为生产级永久存储；Supabase 未提供真实凭证时只能验证 schema 与 fake adapter。

## Expected UX

- 进入 Chat 首先看到好友会话；Honru 通过明确的二级 Tab 单独进入，首页/悬浮 Honru 入口直接定位该子页。
- 桌面和平板左侧浏览会话、右侧阅读与输入；手机先显示会话列表，进入线程后有返回按钮，输入区位于底部导航和安全区之上。
- 会话行展示头像、昵称、可理解的在线状态、最后消息、时间和未读徽标；消息气泡保留原文并能辨认发送方和状态。
- Enter 发送、Shift+Enter 换行；输入自动增高且不遮挡历史；离线时保留当前输入但禁止发送。
- Profile 首屏能立即看懂“是谁、成长到哪里、擅长什么、最近可做什么”，细节区按战绩、成就、装扮、社交和任务分组，手机单列、桌面分区。
