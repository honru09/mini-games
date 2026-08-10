# Test Admin P0

状态：`REQUIREMENT_FROZEN`

## Goal

提供一个由服务端环境变量唯一绑定的永久测试管理员账号。它使用正常用户名/密码认证，但对当前商城与游戏外观拥有虚拟的无限 G Coins、最高测试等级和完整目录权益，并仅获得明确列出的测试能力；它不成为正式玩家数据的一部分。

## IN

- 新建独立 `server/test-admin.js`：配置验证、启动期引导、固定能力白名单、虚拟档案/目录权益和隔离判定。
- 由主负责人把模块最小接入认证启动、私有档案、商城、房间/人机结算、社交、排行榜、Presence、Replay、AI 学习、Analytics/outbox 与赛事管理员入口。
- 使用 `TEST_ADMIN_ENABLED`、`TEST_ADMIN_UID`、`TEST_ADMIN_USERNAME`、`TEST_ADMIN_PASSWORD` 四个环境变量；不在仓库、测试输出或日志中保存实际密码。
- 新增纯合同测试，覆盖配置、能力白名单、虚拟目录、公开隔离和拒绝路径。
- 为 Render 环境变量写入流程提供主负责人集成说明。

## OUT

- 不给普通账号增加任意管理员字段、客户端开关、URL 参数或本地存储提权路径。
- 不修改奖励数值、商城价格、游戏规则、协议、Supabase Schema/RLS、前端 UI 或未审批美术。
- 不给测试账号授予数据库 SQL、Metrics Bearer、Render API、任意用户编辑或“万能”通配能力。
- 不提交、推送或部署；部署由主负责人在完整审核后执行。

## Non-negotiable

- `TEST_ADMIN_ENABLED=1` 且四项配置任一缺失/无效/冲突时，服务端必须在接受 WebSocket 前 fail-closed；错误文本不得回显 UID、用户名或密码。
- 身份只可由服务端配置中的 UID 精确匹配；用户名、前端声明、profile mutation、token payload、localStorage 或已有 `TOURNAMENT_ADMIN_UIDS` 都不能自行获得测试权限。
- 测试管理员的无限余额、最高等级和商品拥有是**虚拟投影**，不得写入正式奖励、经济流水、Supabase outbox、AI 学习、Replay、Analytics 或排行榜。
- 测试管理员必须与普通正式对局隔离：普通账号不能加入其房间、不能邀请/观战其房间；测试管理员也不能作为正式赛事参赛者与普通账号混合。
- 未来新权益只能通过本模块的固定能力/目录接口显式接入；不得为“以后都有”保留 wildcard 权限。

## Known Existing Behavior

- 用户名密码采用随机盐 scrypt；创建账号的唯一入口在 `handleCredentialMessage`。
- `profileObj` 目前同时为本人和公共档案提供基础数据；`leaderboardPayload`、`lobbyPayload`、Social Graph、Direct Chat、奖励、Replay 和 AI 学习各自直接消费 `db.users`。
- 商城目录由 `SHOP_PRICES`、`GAME_COSMETIC_CATALOG` 和 `normalizeOwned` 定义；当前所有权是可持久化字段。
- `TOURNAMENT_ADMIN_UIDS` 只提供赛事恢复权限，既有 `TournamentGuard.create()` 要求 owner 是参与者。

## Expected UX

- 运维人员在服务器环境中设置四项变量后，使用该用户名和密码像普通账号一样登录；不需要在浏览器输任何管理员密钥。
- 测试账号本人可见其虚拟 G Coins、最高测试等级和全部当前商城/游戏外观；购买不会扣款或写经济流水。
- 测试账号不出现在排行榜、公共档案、Presence、公共大厅、好友或私聊中。其对局为仅测试账号与 AI/未来测试账号的沙盒对局。
- 赛事恢复等控制平面能力仅在服务端授权，普通用户仍保持原有权限边界。
