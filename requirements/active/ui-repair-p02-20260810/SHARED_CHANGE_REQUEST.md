# Shared Change Request

## `public/src/online/03-websocket.js`

这是 `HIGH_RISK_FILES.md` 标记的共享协议消费者；本请求**不改变**服务端、WebSocket 消息类型、`create` payload、赛事引擎或权限协议。

### 已由主负责人集成的范围

1. 新增纯客户端 `tournamentUiAvailable()`，唯一依据服务端 `hello_ack.admin` 写入的 `online.isAdmin`。普通用户不得通过 localStorage、URL 或前端 flag 获得入口。
2. `renderRoomPanel()` 中的“创建赛事”和“打开赛事”按钮都以该 helper 防御；`openTournamentCreate()`、`renderTournamentState()` 自身开头也防御返回。
3. 收到 `tournament_state` 时始终缓存 `online.tournamentState`，但只在 `tournamentUiAvailable()` 时调用 `renderTournamentState()`；非管理员 `hello_ack` 后调用 `closeTournamentStateModal()` 清除旧状态/创建弹层，避免账号切换残留。
4. `renderLobby()` 只使用服务端明确下发的 `r.canJoin === true` / `r.canSpectate === true` 决定动作；显示等待/进行中、真人/AI、观战可用性。房主资料入口为真正的 `<button>`，昵称继续以 `elRaw(... r.hostName ...)` 渲染。
5. `resetState()` 清除管理员态、赛事缓存和待选游戏房间绑定，并关闭遗留赛事弹层；避免登出、换号或断线后把管理员 UI 留给普通账号。
6. `pendingGame` 绑定到服务端 `created.room`，并只在相同 room 的 `room_update` 中消费；已有玩家房间点击创建会清理待选状态并停止第二次创建，观战者仍沿用服务端离开观战后建房流程。
7. Lobby 同时排除当前玩家房与当前观战房，避免再次显示无效的自身观战入口。

### 兼容与回滚

- 建房流程保持 `online.pendingGame → create({capacity, visibility, allowSpectators}) → room_update → select_game`；没有向 `create` payload 新增 `game`。
- 赛事服务端广播、自动建房、受控管理员能力和专项 QA 均保留。此次是普通 UI 默认隐藏，不是服务端权限撤销。
- 回滚只撤销客户端展示分支，不触及赛事数据或消息协议。

### 验收

- `node qa/ui-room-lobby-contract.js`
- `node qa/tournament.js`
- `node --experimental-websocket qa/tournament-auto-online.js`
- `node --experimental-websocket qa/room-seats.js`
- `node qa/dom-smoke.js`
- `npm run test:i18n`

## `public/index.html`

仅由主负责人通过 `node scripts/build.js` 生成，不允许手工编辑。

## 台账与状态文档

实现、专项与浏览器证据通过后由主负责人更新台账、PROJECT_STATUS、七份进度报告与三份中文日志。
