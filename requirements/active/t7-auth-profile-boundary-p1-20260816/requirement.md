# T7 Auth/Profile Boundary P1

状态：`REQUIREMENT_FROZEN / LOCAL_ONLY / NOT_RELEASED`

## Goal

把 `server/index.js` 内跨用户名密码、旧 PIN、访客与 HTTP/WS 共用的会话 token 生命周期，以及本人/公开/好友比较 Profile 投影和可编辑字段白名单，收敛到一个可替换、可测试的深 Module；保持全部现有 wire、权限、持久化和产品行为兼容。

## IN

- `AuthProfileBoundary` 外部 Interface：`session(command)` 与 `profile(command)`。
- 会话 token 签发、最多五会话淘汰、TTL、旧裸 hash 迁移、明文 token/hash 验证、Bearer 解析、当前 token 撤销。
- Profile 私有投影、公开字段剥离、正式好友比较窄投影、本人编辑白名单。
- 现有 JSON/runtime Adapter 与隔离 in-memory Adapter。
- `server/index.js` 仅增加 import、Adapter 初始化、旧 helper 兼容 wrapper，以及 `hello/profile_get/profile_compare/profile/logout` 的窄调用接入。
- 显式注入 `clock.now`；不 monkey-patch `Date.now()`。

## OUT

- 不改变用户名/密码规则、scrypt 参数、旧 PIN 哈希或校验算法、注册/登录限频与错误文案。
- 不改变 WebSocket/HTTP 消息类型、字段、capability 或顺序。
- 不改变 Supabase schema、RLS、RPC、profile queue、JSON 文件结构或远端写入时机。
- 不改变 Reward、Economy、Social、Block/Friend Authority、Test Admin 权限、Replay、AI、Room/Presence 或前端。
- 不修改 package.json、台账、路由、PROJECT_STATUS、报告、三日志或发布状态。

## Non-negotiable

- 用户名密码仍只使用 `server/auth-credentials.js` 的随机盐 scrypt。
- 未知用户与畸形哈希的恒定工作量路径不变。
- `logout` 只撤销当前 token；其他有效会话继续有效。
- 每账号只保留最近五个未过期 token；旧裸 token hash 首次规范化后获得完整 TTL。
- public/compare Profile 不得包含 `owned`、余额以外的私有认证事实、用户名、authVersion、任务、签到或购买信息；Test Admin 继续完全隐藏。
- Profile mutation 不得写 coins、XP、level、wins、owned、purchase、auth token 或其他权威字段。

## Known Existing Behavior

- 用户名密码、旧 PIN、legacy bind 与 guest 均复用同一 token 数组。
- JSON runtime 使用 `db.users`；Supabase 仍由现有 `sbCreateProfile/sbSyncAuthProfile/sbSyncEditableProfile` 负责。
- `profile_get` 仅在 target UID 等于当前会话且 token hash 有效时返回私有投影，否则返回公开投影。
- Profile Compare 只允许正式好友且双向未 Block。

## Expected UX

无新增界面。注册、登录、旧账号迁移、访客登录、刷新恢复、退出、查看本人/他人档案与好友比较的消息和可见结果与当前版本完全一致。
