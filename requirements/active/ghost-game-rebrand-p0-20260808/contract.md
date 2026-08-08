# Ghost Game P0 跨模块冻结合同

## 认证消息

- `username_check { username, requestId }` → `username_status { requestId, username, normalized, available, reason }`。
- `register` 新合同接受 `{ username, password, name?, avatar?, background?, lang? }`；成功仍返回既有 `registered`，新增 `authVersion:'username-password-v1'`。旧 `{ uid,pin,... }` 在兼容期继续接受。
- `login` 新合同接受 `{ username, password }`；成功仍返回既有 `logged_in`。旧 `{ pin }` 只用于迁移/兼容入口。
- `legacy_bind { pin, username, password }`：验证旧账号、绑定唯一用户名和密码、迁移慢哈希，签发 token；幂等条件为该账号已绑定同一 normalized username。
- `guest_login { name?, lang? }` → `guest_logged_in`；服务端生成 uid/token，`profile.ephemeral=true`、`expiresAt`，不持久化。
- 认证失败统一 `auth_error`，稳定 reason：`username_invalid`、`username_taken`、`user_not_found`、`invalid_credentials`、`password_invalid`、`password_mismatch`（仅客户端）、`login_rate_limited`、`legacy_pin_invalid`、`guest_unavailable`。

## Authority 与持久化

- 用户名唯一性、密码校验、访客生命周期只由服务端权威决定；客户端实时检查仅是提示，提交时必须再次校验。
- `username_normalized` 唯一；`password_hash` 使用版本化随机盐 scrypt；旧 `pin_hash` 保留到用户迁移完成后的兼容窗口，不在公开档案返回。
- 本地 `saveDB`、Supabase create/update、奖励/购买/AI 学习、社交写入必须跳过 `ephemeral=true`。
- 访客断线进入短重连 TTL；显式 `logout` 立即撤销 token、离房并删除内存档案。进程崩溃天然清空。

## Honru 对话

- HTTP `POST /api/companion`，Bearer token、Origin、正文上限、用户级限频与并发限制沿用 `/api/ai` 安全策略。
- 请求：`{ message, locale, context?:{ moodHint?, city?, requestKind? } }`，不接受客户端 system prompt 或 API Key。
- 响应：`{ reply, mood, sourceType, weather?, headlines? }`；`mood` 为白名单；外部信息不可用时 `sourceType:'offline'` 并明确退化。
- 默认不保存聊天原文；日志仅记录 requestId、uid 哈希、耗时、状态和错误类别。

## 导航与主题

- 稳定 route：`home|games|chat|profile`，URL hash 为 `#/<route>`；游戏内返回 `games`。
- 手机 `max-width:640px` 显示底栏；更宽的平板/桌面使用头部主导航。两者调用同一 `setAppRoute()`。
- 运行时主题仅 `light|dark`；旧 `ocean/forest/sakura` 映射为 `light`，旧 `midnight/cyber/dark` 映射为 `dark`，但不改动个人 `background` 商品 ID。
- 认证页与应用页共享场景层；reduced-motion 下停止星场/云海位移动画。

## 失败、幂等、重连

- `username_check` 失败不创建账号；并发注册由服务端唯一检查与数据库唯一索引裁决。
- 注册响应丢失时客户端通过已收到 token 或重新登录恢复，不自动重复生成 uid。
- Honru 超时、无 Key、限流、断网时返回本地安全短回复，不阻塞签到、导航和游戏。
- 访客不得进入会产生持久奖励或购买的路径；客户端提示，服务端再次拒绝。
