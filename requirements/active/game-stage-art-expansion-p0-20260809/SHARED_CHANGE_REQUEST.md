# Shared Change Request — Game Stage + Tabletop Art Wave A

状态：`IMPLEMENTED_AND_VERIFIED`

## Shared/high-risk files

- `scripts/build.js`：在六款游戏前加入 `games/00-tabletop-art-runtime.js`。
- `public/src/online/03-websocket.js`：在既有房间/席位状态刷新后幂等调用 `renderGameStage()`，不新增消息或字段。
- `public/index.html`：仅由构建生成。
- `package.json`：加入两项专项 QA 并纳入完整测试。

## Compatibility

- 新 Stage 与 Art Runtime 只消费现有 DOM/客户端状态；服务端协议、规则、奖励、Replay、商城和数据不变。
- 总开关严格 `'0'` 回退旧表现；异常默认 Wave A，不阻塞输入。
- Honru 前端聊天删除不删除 Direct Chat、签到协议、后端安全边界或局内反应。

## Required evidence

- `qa/game-stage-contract.js`、`qa/tabletop-art-runtime.js`。
- i18n、DOM、AI、Gameplay、Rule Authority、Chat、Reconnect、E2E。
- Quality Gates、完整 `npm test`、Build Drift。
- 浏览器不可用时明确 `NOT_EXECUTED`，不得用源码合同冒充视觉矩阵。

## Master 集成结果

- `peer_status` 与 `host_changed` 先合并消息中已有的在线/房主字段再刷新；`player_reassigned` 等待随后权威 `room_update`，避免旧 `seats` 瞬态误标。
- 本人席位优先匹配服务端 `seat.userId` 与当前 `account.uid`；仅双方 UID 都缺失的旧 payload 才回退 player index。
- 浏览器连接已恢复并完成本轮本地矩阵；真机、第二浏览器和真实网络整形仍明确未执行。
