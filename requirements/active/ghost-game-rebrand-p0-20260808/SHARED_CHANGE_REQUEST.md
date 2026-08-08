# Shared Change Request

## Scope

Ghost Game P0 需要由 Master 集成认证、Supabase、WebSocket 客户端、i18n、应用外壳、模板、构建与项目状态。

## Shared fields and messages

- Profile 新增私有字段：`username`、`username_normalized`、`password_hash`、`auth_version`；公开 profile 只允许返回展示用户名（若产品需要），绝不返回 normalized/hash。
- 新消息：`username_check`、`username_status`、`legacy_bind`、`guest_login`、`guest_logged_in`。
- 新 HTTP：`POST /api/companion`。

## Consumers

- `server/index.js`、`supabase/schema.sql`、`public/src/online/03-websocket.js`、认证 UI、三份 locale、security/supabase/e2e QA。

## Compatibility

- 既有 `{pin}` 注册/登录和 token 认证保留；新增字段全部 nullable；旧主题 ID 读取后映射到 dark；游戏/奖励/商品/外观 ID 不变。

## Security

- 随机盐慢哈希；用户名唯一与频控服务端权威；访客不持久；Companion 复用 Bearer/Origin/速率/并发/超时边界；不记录敏感正文。

## Rollback

- 新 UI/Companion 可独立关闭；数据库新增列保持 nullable；回滚代码后旧 PIN/token 仍可工作；`76262bd` 为发布前基线。

## Required evidence

- 旧/新认证、用户名并发、访客清理、Companion 安全、i18n、DOM、Supabase fake adapter/schema、完整质量门与浏览器矩阵。
