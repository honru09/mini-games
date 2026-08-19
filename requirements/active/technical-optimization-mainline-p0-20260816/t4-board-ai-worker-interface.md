# T4 Board AI Worker 深模块 Interface

状态：`FROZEN_FOR_IMPLEMENTATION / LOCAL_ONLY / NOT_RELEASED`

## Module 与 Seam

`BoardAIWorkerBroker` 是 Xiangqi/Gomoku 调度器与本地搜索之间的唯一外部 seam。调用方只提交 AI-only canonical position 与主线程已经生成的合法候选 ID；Worker 生命周期、消息协议、generation、超时、取消、置换表、开局库、Adapter 健康和同步 fallback 全部隐藏在 Implementation 内。

该 Module 当前只允许 `xiangqi` 与 `gomoku`；不得提供任意游戏/算法注册入口，也不得进入 Rule、Authority、Protocol、Reward、Replay、Social、Persistence、Analytics 或服务端 AI 学习。

## 最小 Interface

```js
const broker = BoardAIWorkerBroker.create({
  enabled,
  workerOptIn,
  workerFactory,
  syncAdapter,
  timeoutGraceMs,
});

const result = await broker.request({
  requestId,
  gameId,
  rulesVersion,
  solverVersion,
  identity,
  matchGeneration,
  turn,
  positionHash,
  position,
  legalCandidates,
  difficulty,
  budgetMs,
});

broker.cancel(requestId);
broker.dispose();
```

实例只暴露 `request / cancel / dispose`。`request()` 永远 resolve 固定 Outcome，不把 Worker/Adapter 异常变成未处理 rejection。成功只返回原候选集合中的 ID 与有限数值评分；不返回动作对象、棋子对象、执行器、完整局面或 DOM 引用。

## 固定不变量

- `boardAIWorkerV1 !== true` 时不创建 Worker，调用方沿用当前同步 AI。
- 每个游戏实例最多一个 active ticket；并发新请求返回 `busy`，调用方在 reset/restore/换局时先按 `requestId` 取消旧请求。
- 身份精确绑定 `requestId + matchGeneration + gameId + rulesVersion + solverVersion + turn + positionHash`；`identity` 只进入请求校验和 TT 分区，不由 Worker 结果回显。
- 迟到、重复、乱序、跨 generation/hash/version、未知候选、非有限 score 与多余危险字段全部 fail-closed。
- Worker 只返回 `ranked:[{id,score}]`；主线程必须重新映射 ID，并再次调用现有 `doMove/applyMove` 合法性 Gate。
- cancel、重开、恢复、撤回、离房、切账号和 destroy 都让旧 ticket 失效；dispose 必须清 timer、Worker、pending、TT 与 book session。
- Worker、同步 Adapter 和开局库不接收 UID、token、聊天正文、奖励、Replay、原始键鼠/触控轨迹或任意网络地址。
- 困难档 DeepSeek、个人学习候选与 `confirmAIReady()` 保持现有 seam；只有实际合法落子成功后才能确认经验。

## Adapter 与预算

- Production Worker Adapter：固定同源 `workers/board-ai-worker-v1.js`，只在明确 AI 回合 lazy 创建；协议固定为 `BOARD_AI_SEARCH_V1 / BOARD_AI_CANCEL_V1 / BOARD_AI_RESULT_V1`。error、messageerror、超时或协议错误终止当前 Worker，并只允许一次同步 fallback。
- Synchronous Adapter：使用同一纯搜索 Kernel；Worker 缺失、CSP/加载失败、崩溃或超时时保持确定性 fallback，不随机送子。
- 候选最多 200，Worker 返回最多 40；单 broker 只有一个 active 请求；`budgetMs` 有固定上下界，Worker 超时后只允许一次同步 fallback。同步 fallback 仍受 Kernel 自身的同一 `budgetMs` 检查，但不是跨 Worker 与 fallback 共用的绝对墙钟截止时间。
- TT 以 game/rules/solver/book/match scope/position hash/turn/depth 分区，硬上限 4096 entries，LRU 淘汰；不得持久化。
- 开局库带 `bookVersion + rulesVersion + solverVersion`，命中 ID 不在当前合法候选时必须忽略并进入搜索。

## 调用方

- Xiangqi 先接：canonical 10×9 board/current/lastMove/moveCount；ID 使用 `fromRow,fromCol>toRow,toCol`。`aiEpoch + requestStateKey + doMove()` 继续作为主线程生命周期与合法性 Gate。
- Gomoku 后接：canonical 15×15 board string/current/last/history length；ID 使用 `row,col`。`aiEpoch + stateKey + grid empty + applyMove()` 继续作为最终 Gate。
- 第一纵切仅限本地 AI；online/spectator/非 AI 回合不启动 Worker，不改任何联机 Authority 或 wire。

## 回滚与验收

- 删除/关闭 Broker 后，Xiangqi/Gomoku 当前同步搜索、三档难度、DeepSeek 合法候选裁决与学习路径原样保留。
- 必须覆盖 default-off、Worker/Sync parity、唯一成五、唯一封堵、象棋合法高价值吃子、将帅照面非法候选、cancel/supersede/timeout/crash/late/duplicate/schema、TT/book 上界、隐私、reset/restore/destroy 和 deterministic build。
- 本地机器证据只能把 T4 提升为 `implemented`；第二浏览器、真机、真实网络、Supabase、人工美术和发布 Gate 不因本 Module 解除。
