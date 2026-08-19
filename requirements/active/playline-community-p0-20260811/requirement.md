# Playline Community P0 需求

状态：本地开发中；生产默认关闭；禁止以本地 JSON/fake Supabase 证据替代真实生产门禁。

## 目标

把四区外壳调整为 Home / Games / Playline / Profile；既有一对一 Direct Chat 从独立 Page 收进全局消息 dialog。Playline 提供 `All / Friends` 时间流、受限文本动态，以及可信游戏、正式结算和权威记录分享，形成“游戏 → 结算/记录 → 分享 → Playline → 公开资料/好友私信”的闭环。

## IN

- `#/playline` 取代可见 Chat 主区；旧 `#/chat*` 安全规范到 Playline 并打开收件箱。
- 全局 DM dialog 复用 `direct-chat-v1` 的唯一状态、历史、未读、草稿、Block 与好友权限。
- `text / game_share / result_share / record_share` 四种不可混合动态。
- All/Friends 动态可见性、双向 Block、当前好友关系、幂等、频控、分页、删除和举报目标由服务端权威裁决。
- 服务器签发作者、ID、时间、排序和引用快照；客户端只能提交意图。
- 手机/平板/桌面、双主题、三语言、键盘/触控、reduced-motion 与可访问 dialog。
- JSON 单实例 Adapter、Supabase RPC Adapter 合同、专项与完整回归。

## OUT

- 评论、回复树、点赞、转发、关注、话题、群聊、媒体、链接预览、陌生人私信。
- 未审批 Honru Emoji runtime；本批不新增图片生成。
- 公开 All 的生产开放、自动审核、处罚申诉、未成年人/区域策略。
- 真实 Supabase 迁移/RLS/并发/加密备份/隔离恢复/回滚，以及多实例 PubSub。

## 安全冻结

- 生产 capability 必须由 `ENABLE_PLAYLINE_V1=1` 显式开启，默认关闭。
- 未登录、guest、test-admin 不得读取或写入玩家 UGC；测试管理员内容永不进入公共社区。
- 文本只按纯文本渲染，不进入日志、Analytics、Replay、Reward 或 AI learning。
- `result_share` 只引用本人正式、有效、非争议/AFK/测试沙盒结算；`record_share` 由服务端从权威档案派生。
- Public All 在内容治理、真实生产持久化和人工门禁完成前只能本地验收。
