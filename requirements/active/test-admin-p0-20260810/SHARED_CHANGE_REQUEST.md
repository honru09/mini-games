# Shared Change Request — Test Admin P0

本请求由 `server/test-admin.js` 和 `qa/test-admin-*.js` 支持。以下文件是 HIGH/shared，必须由 Master 集成；子任务没有直接编辑它们。

## 1. `server/index.js` — required minimal integration

### 1.1 Startup and identity

1. 在认证依赖旁加载：

   ```js
   const TestAdmin = require('./test-admin');
   const testAdmin = TestAdmin.createTestAdminPolicy(process.env);
   if (testAdmin.fatal) throw new Error(TestAdmin.TEST_ADMIN_REASON);
   ```

   不记录任何环境值。`TEST_ADMIN_ENABLED=1` 的不完整配置必须在 `server.listen()` 之前失败；关闭状态不得改变既有服务行为。

2. 在 `sbLoadProfiles()` 完成、`clusterCoordinator.start()` 和 `server.listen()` 之前调用：

   ```js
   const boot = await testAdmin.bootstrap({
     users: db.users,
     createStarterUser: starterUser,
     persist: () => saveDB(),
   });
   if (!boot.ok) throw new Error(TestAdmin.TEST_ADMIN_REASON);
   const adminUser = db.users[testAdmin.uid];
   if (boot.created) await sbCreateProfile(adminUser);
   else if (boot.passwordUpdated) await sbSyncAuthProfile(adminUser);
   ```

   错误日志只能使用稳定 reason，绝不包含 `TEST_ADMIN_PASSWORD`、UID 或用户名。

3. 将既有 `isTournamentAdmin(uid)` 窄化扩展为：

   ```js
   return testAdmin.hasCapability(uid, 'tournament_recover') || TOURNAMENT_ADMIN_UIDS.has(String(uid));
   ```

   不能把客户端 `capabilities`、`hello` payload、profile 字段或 localStorage 作为权限来源。

### 1.2 Private virtual projection / public removal

1. 在 `profileObj()` 创建完普通对象后调用：

   ```js
   return testAdmin.virtualProfile(profile, {
     shopPrices: SHOP_PRICES,
     xpForLevel,
     levelProgress,
   });
   ```

2. `publicProfileObj()`、`profile_get` 的非本人路径、`socialPublicEntry()` 与 `profileCompareAllowed()` 必须在任一目标为 `testAdmin.shouldHidePublicUid(uid)` 时返回 `null` / `false`。避免把一个空对象误当公共档案。

3. `leaderboardPayload()` 在 map 前过滤测试 UID，`total` 同样排除；`publicPresence()` 对测试 UID 返回 `offline`。不向普通客户端广播测试昵称、头像、余额、等级、资产、登录状态或房间。

### 1.3 Social and direct chat

1. `socialPublicEntry`、`socialState`、`socialFriendship`、`socialPendingRequest` 与 `socialAllowedBetween` 都要过滤历史测试 UID 边；这使旧脏数据也不可见。
2. 在 `socialSendRequest`、`socialFriendRequestAction`、`socialRemoveFriend`、`socialBlock`、`socialUnblock`、`socialReport` 各个 mutation 前调用 `testAdmin.socialAccess(aUid,bUid)`；失败返回 `social_error.payload.reason='test_admin_isolated'`，不得产生部分请求/好友/Block/举报写入。
3. `chatUser` 拒绝测试账号；`handleChatHistory`、`handleChatSend`、`handleChatRead` 在检查 peer 后调用同一 `socialAccess`，普通账号面对测试 UID 返回 `chat_error.payload.reason='test_admin_isolated'`。`chatState`、历史加载和 Cluster event 路径过滤历史记录。

### 1.4 Room, invite, spectator and lobby isolation

1. `create` 前调用 `testAdmin.roomAccess({actorUid:this.uid, participantUids:[]})`。测试账号创建的 room 必须写入 `testAdminSandbox:true`，强制 `visibility:'private'` 和 `allowSpectators:false`，忽略客户端要求。
2. `joinRoom()` 在所有 mutation 前调用：

   ```js
   testAdmin.roomAccess({
     actorUid:this.uid,
     participantUids:[...r.clients.keys()].map(s => s.uid),
     roomTestOnly:r.testAdminSandbox === true,
   });
   ```

   拒绝统一为 `error.reason='test_admin_isolated'`。普通用户和测试账号无论加入方向都不能混合；同样规则应覆盖 `quick_join` 的候选、`invite`/`invite_accept`。

3. `spectate` 与 `spectate_join` 在读取 target 后调用 `roomAccess(... spectator:true)`；测试沙盒永远不允许观战，reason 为 `test_admin_isolated`。
4. `lobbyPayload()` 跳过 `r.testAdminSandbox`；`roomPayload()` 只会发给沙盒内部成员。保留 private room 的既有普通行为。

### 1.5 Shop / profile settings

1. `purchase` 在完成现有 category/id/price 服务器校验后、任何 `purchaseRequests`、RPC、余额、owned、ledger 或 `saveDB()` mutation 前，如果 `testAdmin.hasCapability(u.uid,'test_admin_all_catalog_items')`：
   - 对合法当前 `SHOP_PRICES` 商品发 `purchase_ok`；
   - 回显现有 `category/id/requestId`；
   - 返回 owner-only virtual profile；
   - 不写 purchase request、owned、余额、ledger、Supabase、outbox 或 Analytics。
2. 无效 ID 必须继续 `product_not_found`，不能因测试身份接受任意数字。
3. `ownsItem` / `normalizeGameCosmetics` 的读取路径对测试 UID 调用 `testAdmin.allOwnedFromCatalog` 或等价的已验证目录判断，以便可装备当前所有商城/游戏外观。保留普通用户已有 owned 检查。
4. 私人外观/语言等可编辑设置可继续使用普通账户持久化；金币、XP、胜场、商城 owned 与任何权限字段仍不可由 `profile` mutation 写入。

### 1.6 No formal data side effects

1. 对 `r.testAdminSandbox === true` 在 `startRoomMatch` / `restart` 跳过 `match_started` analytics；`settleRoomResult` 最开始走独立零持久路径：
   - 标记本局 settled、停止计时器、发送 `result_ok` 和 `testAdmin.sandboxReward(...)`；
   - 可广播短生命周期 `match_result` 供 UI 收尾；
   - 不调用 `applyResolvedProgress`、`recordServerPlaymate`、`recordAnalytics`、`saveReplayForRoom`、`reportTournamentRoomResult`、`syncRewardRow`、`syncAILearningResult`、`saveDB` 或 `broadcastLeaderboard`。
2. `beginSoloMatch` 为测试账号标记 `testAdminSandbox`，跳过 `match_started` analytics；`settleSoloMatch` 在票据验证后发同样 sandbox reward，并跳过进度、AI 学习、rate、Analytics、save、outbox、leaderboard。
3. 在 `applyResolvedProgress`、`syncRewardRow`、`recordEconomyChange`、`recordAnalytics`、`saveReplayForRoom`、`recordServerPlaymate` 与持久 outbox 的入口加防御性测试 UID early return/过滤，避免未来调用点漏网。`saveDB()` 也应剔除任何遗留测试 UID 的 history/reward/economy/events/replays/AI/outbox/social/chat 数据；只可保存管理员正常 credential/settings profile。
4. `daily_task_claim`、`companion_checkin` 等可能写入成长状态的入口对测试账号返回无副作用 sandbox/no-op 回执；不要调用 ledger、奖励或远端同步。

### 1.7 Tournament control plane without player mixing

1. 测试管理员的 `tournament_create` 通过 `testAdmin.tournamentCreateAccess(this.uid, ids)` 才可调用 external-owner 模式；participant IDs 不得含测试 UID，必须仍经过存在性、去重、人数和游戏白名单校验。
2. `tournament_create` 不得把测试管理员加入 `TournamentOrchestrator.participants`，但 `entry.ownerUid` 保持测试 UID。
3. `broadcastTournament()` 接收者集合必须包含 owner UID **及** participants；`tournament_get/start/next` 的访问判断允许 `entry.ownerUid`，而 consent/forfeit 继续只限真正 participant。
4. 现有管理员恢复必须继续要求明确 `targetUid`；测试管理员只能作为控制面，不能对房间绕过规则、奖励或玩家身份。

## 2. `server/gameplay/guards/index.js` — narrow external owner compatibility

`TournamentGuard.create()` 保留默认现有契约。仅当服务端传入 `allowExternalOwner:true` 时：

- owner 可以不在 participants；不能同时作为 participant。
- participants 仍为 3–max、唯一、白名单、全员 consent；external owner 不自动写入 consent。
- `entry.ownerUid` 继续是控制面；`registerPairing`、`bindMatch` 和结果验证只允许 participants 的真实桌位。
- 来自网络 payload 的 `allowExternalOwner` 必须被忽略；只有 `server/index.js` 在 `testAdmin.tournamentCreateAccess().ok` 时构造。

补充 `qa/tournament-recovery-online.js` 或 `qa/test-admin-online.js` 的正常 admin 兼容回归。

## 3. `scripts/render-env.js` and `render.yaml`

1. `render-env.js` 白名单增加四个变量，且只有 `TEST_ADMIN_ENABLED=1` 时允许同时写入 UID/USERNAME/PASSWORD；部分给出或非法启用值立即报不含秘密的错误。
2. 输出只打印环境变量名称与 HTTP 状态，不打印值。
3. `render.yaml` 只声明 `sync:false` 变量，尤其 `TEST_ADMIN_PASSWORD` 不能有默认值、示例值或 Git 追踪明文。

## 4. QA / release integration

- 把 `node qa/test-admin-contract.js` 与 `node --experimental-websocket qa/test-admin-online.js` 纳入适当的质量链。
- 必跑：`node --experimental-websocket qa/test-admin-online.js`、`node --experimental-websocket qa/security-online.js`、`node --experimental-websocket qa/tournament-recovery-online.js`、`node --experimental-websocket qa/e2e-online.js`，以及完整 `npm test`。
- 发布前核对日志、进度台账、环境变量写入结果和线上登录/隔离冒烟；不得在报告或控制台复制密码。

## Rollback

设 `TEST_ADMIN_ENABLED=0` 并重启。由于合约禁止正式经济、奖励、社交、Replay、AI、Analytics 与 outbox 写入，不需要数据回滚。
