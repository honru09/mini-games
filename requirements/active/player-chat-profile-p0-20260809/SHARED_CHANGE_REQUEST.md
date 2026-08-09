# Shared Change Request — direct-chat-v1 + Profile P0

状态：`APPROVED_BY_MASTER`

## 目的

成对修改 WebSocket 服务端/客户端，引入好友私聊；增量修改 Supabase schema；重构 Chat route，并在不改变权威数据的前提下升级 Own Profile。

## 共享文件与影响

- `server/index.js`：数据库结构、持久化、聊天权限/频控/幂等/dispatcher/capability。
- `public/src/online/03-websocket.js`：聊天状态、发送/历史/已读 API、消息消费者、好友/Profile 入口。
- `supabase/schema.sql`：`direct_messages`、`direct_message_reads`、索引、RLS/revoke。
- `public/index-template.html`：Chat 玩家消息/Honru 子页和 Profile 容器/CSS。
- `public/src/core/02-app-shell.js`：二级路由、Chat UI 生命周期、Honru 入口。
- `public/src/shop/05-profile.js`：Own Profile 信息架构与关系动作复用。
- `public/locales/*.json`：三语同构文案。
- `package.json`：专项测试注册。
- `public/index.html`：仅由 build 生成。

## 兼容与回滚

- 新消息都带 `direct-chat-v1` capability；旧客户端忽略，不改变现有 Social/Honru/房间消息。
- 新 schema 只新增表和索引，不删除旧数据。
- 回滚时隐藏玩家聊天 Tab、停止 chat dispatcher，Honru 和旧 Profile 仍可用。

## 安全验收

- 拒绝伪造 sender、非好友、访客、Block、跨会话读取、超长/空文本、非法/冲突 clientMessageId 和频控绕过。
- 消息正文只能以纯文本进入参与者 payload，不进入公共 Profile、Leaderboard、Replay、Analytics 或普通日志。
- 运行聊天专项、security、reconnect、social、schema、adapter、i18n、DOM、quality gates 与完整测试。
