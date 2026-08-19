# Auth/Profile 深模块合同

## 外部 Interface

`createAuthProfileBoundary(options) -> { session(command), profile(command) }`

### `session(command)`

允许动作固定为：

- `normalize`：规范化/迁移 token record，裁剪 TTL 与最多五条。
- `issue`：为给定 user 签发随机 token，返回 `{ token, tokenHash }`，并更新该 user 的 token records。
- `authenticate`：按 `uid + token` 验证，返回已验证 user 与 tokenHash。
- `verify_token` / `verify_hash`：验证给定 user 的明文 token 或 tokenHash。
- `resolve_token`：跨 Adapter 用户集合解析 Bearer token。
- `hash_token`：只为现有 `hello` 身份切换比较返回稳定 tokenHash。
- `revoke`：只移除给定 user 的当前 tokenHash。

所有动作只返回分类化结果，不返回密码、PIN、passwordHash 或 token record 内部解析结构。`clock.now` 必须显式注入；TTL 不读取进程全局时间。

### `profile(command)`

允许动作固定为：

- `private`：本人完整 Profile 投影，继续应用 Reward/Progression 派生和 Test Admin 虚拟档案。
- `public`：公开投影；剥离 owned、任务、认证、签到、私有 Presence 设置等字段，并隐藏 Test Admin。
- `read`：按 `targetUid + viewerUid + viewerTokenHash` 自动裁决本人私有或公开投影。
- `compare_projection`：正式账号的窄比较投影。
- `compare`：再次执行现有好友/Block 权限回调后返回 self/friend 窄投影。
- `can_compare`：只返回权限布尔值。
- `update`：只应用既有 Profile 可编辑字段白名单，并返回更新后的本人投影。

## Adapter Seam

两个 Adapter 均满足 `get(uid) / list() / put(user) / remove(uid)`：

- JSON/runtime Adapter：连接当前 `db.users` 可变运行时；JSON `saveDB()` 与 Supabase queue 仍由原调用点按原时机执行。
- in-memory Adapter：深拷贝初始账号并隔离状态，只用于边界合同与并发/clock 测试，不冒充生产持久化。

## Authority 与兼容

- Wire Authority 仍在 `Session.handleMessage()` 与现有 HTTP caller；Module 不发送 socket/HTTP 响应。
- Credential Authority 仍在 `server/auth-credentials.js`；Module 不接触明文密码或 PIN。
- Social Compare Authority 由现有 friendship/Block 回调提供；Module 必须在每次 compare 时重新调用。
- Reward/Economy 字段只读投影；Module 不计算、不修改权威成长与货币。
- Runtime Adapter 不改变 JSON/Supabase schema、队列或回滚。

## 失败与回滚

- 未知 action、无效 Adapter、无 clock、无 user/uid 返回稳定失败或构造时抛稳定 `TypeError`，不得泄漏 token。
- Adapter lookup 异常 fail closed；认证失败不得返回 user。
- 删除 import、Adapter 初始化与兼容 wrapper 后可恢复原内联 token/Profile helper；无需迁移或删除任何用户数据。
