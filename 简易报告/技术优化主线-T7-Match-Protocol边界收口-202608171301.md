# 技术优化主线 T7 Match Protocol 边界收口

时间：2026-08-17 13:01（Asia/Tokyo）  
状态：`LOCAL_IMPLEMENTED / VERIFIED_LOCAL / PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## 一句话结论

（历史快照）Match Protocol 已成为 T7 第四个本地验证的 Server Boundary：Tetris、Xiangqi、Monopoly 的 action/transition 统一经过 `command` / `transition` seam，21/21 边界断言通过，Rule Authority、既有 wire、Reward、Replay 与 Supabase schema 保持原 ownership。随后 Chat/Playline 与 Reward/Economy outbox 已完成本地窄纵切；T7 总体仍为 `partial`，Node 子进程 fresh-child wall-clock/module-cache/env 窄合同已由 `IsolatedNodeProcess` 双 lane probe 补齐，但 Reward 数值/profile projection、server 全局 clock/Timer 虚拟化与外部设备、真实网络、真实 Supabase、多实例和发布均未执行。

## 主线切换进度

以下百分比来自 242 项原子需求的当前权重快照，只表示治理进度，不替代真实浏览器、真机、生产数据或发布证据。

| 方向 | 本地实现进度 | 最终闭环进度 |
| --- | ---: | ---: |
| 美术与品牌 | 47.2% | 42.6% |
| 界面与交互 | 75.0% | 67.8% |
| 游戏与局内体验 | 71.2% | 67.7% |
| 社交与玩家关系 | 60.6% | 60.3% |
| 经济成长与商业化 | 75.9% | 71.7% |
| 技术数据 AI 与跨平台 | 68.5% | 62.8% |
| **整体** | **66.7%** | **62.4%** |

## 做了什么

- 新增 `server/boundaries/match-protocol.js` 深模块，固定 `command(input)` / `transition(input)` Interface，集中 Tetris/Xiangqi/Monopoly v2 action 与 timer transition 的 dispatch；Rule Authority 仍是合法性、局面和结果的唯一 owner。
- 提供 JSON runtime 与 isolated memory/runtime Adapter，共享 detached `load/save/commit` 状态合同；有界 journal 只用于本地提交审计，不新增玩家持久字段、Supabase 表或经济事实。
- 在 Authority 调用前执行 room/session/member、`matchId`、generation/epoch、authority match、player sequence/duplicate/stale 与 event revision fences；错误按稳定分类回执，过滤底层异常、token、secret 和 stack 文本。
- 固定 effect ordering：metric → turn/audit → broadcast → terminal settle/stop。终局具幂等保护；Adapter callback、Authority 或本地状态写入失败时恢复 room 与 Authority checkpoint/本地 state 并 fail-closed；非法终局席位序列在副作用前拒绝，迟到 Xiangqi timeout 不重复广播。
- `server/index.js` 将三套真人、AI v2 action 与计时 transition 接入同一 seam；旧 capability、缺 Authority 或滚动实例不满足新字段时保留旧 inline fallback，兼容边界不扩大。
- 同步 ADR、T7 主线 acceptance/plan/contract、PROJECT_STATUS、既有 TECH-039/040/052 台账、Room/Presence active 文档的边界外后续状态，以及三份根日志和简易报告入口。

## 用户现在能看到什么

- 没有新增页面、按钮、游戏、素材、货币或社交能力；这是一项服务端边界整理，玩家看到的 Tetris/Xiangqi/Monopoly v2 行为和既有 wire 保持兼容。
- 重复、过期或跨局的 action/transition 在服务端被稳定拒绝，异常终局不会重复结算或广播；这些是可靠性变化，不是新的产品入口。
- Match Protocol 不把本地 Adapter、fence 或 journal 暴露给客户端，也不改变 Reward、Replay、Supabase 或前端状态所有权。

## 还没做什么

- Chat/Playline、Reward/Economy ownership 仍未迁移；server 全局 clock/Timer 虚拟化仍未完成。Node 子进程 fresh-child wall-clock/module-cache/env 隔离已由 `server/testing/isolated-node-process.js`、`server/testing/node-process-isolation-probe.js` 与 `npm run test:node-process-isolation` 本地验证。
- 第二桌面浏览器、物理 Android/iPhone/Tablet、真实网络延迟/抖动/丢包整形、真实 Supabase 迁移/RLS/备份/恢复/回滚、多实例一致性和线上生产验证均为 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。
- 人工清稿、独立 Reviewer B、IP/法律意见和逐资产 Golden Set 没有在本批执行，也不写成 PASS；外部 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材仍禁止进入 runtime。

## 验证

- `node qa/match-protocol-boundary.js`：通过，21/21。
- `npm run test:match-protocol-boundary`：通过，含 `node --check server/boundaries/match-protocol.js` 与 21 项专项断言。
- `npm run test:technical-optimization-t7`：通过，既有 Metrics/Auth/Profile/Room/Presence 与隔离 lane 回归保持通过。
- `node --experimental-websocket qa/rule-authority-online.js`、`node --experimental-websocket qa/reconnect-online.js`、`node --experimental-websocket qa/e2e-online.js`、`node --experimental-websocket qa/security-online.js`、`node --experimental-websocket qa/tournament-auto-online.js`、`node --experimental-websocket qa/tetris-protocol-fallback-online.js`、`node qa/rule-authority.js`、`node qa/network-chaos.js`、`node qa/timer-audit.js`、`node qa/protocol-version.js`：实现批次回归通过。
- 完整 `npm test`：2026-08-17 退出码 0（当前构建 `public/index.html` SHA-256 `324922B8E8275D599B4D15FF83C1665C83155E4496BC9B9E3A4AE0A0C5B478E6`，1,880,837 bytes）；`npm run quality:gates`、`node qa/progress-ledger.js`、`node qa/technical-optimization-mainline-contract.js`、`node qa/brief-report-contract.js`、`node qa/adr-contract.js` 均通过。
- Room/Presence 43 项和赛事原子在线 17 项继续由其独立 active task 负责；本报告不把这些断言归入 Match Protocol。

## 风险与下一步

- 当前 Match Protocol JSON Adapter 仍是单进程内存 callback；journal、快照回滚和 fence state 不等于 durable recovery、Supabase 事务或多实例 fencing。
- 旧 inline fallback 保证滚动兼容，但也意味着本地 21/21 合同不能被描述为生产防作弊、跨设备或真实网络证明。
- 下一主线按既有台账进入 Chat/Playline，再进入 Reward/Economy；每类单独冻结 Interface、Adapter、wire、持久化、回滚和专项证据，继续保持 T7 `partial`。

## 发布状态

`LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND / LOCAL_ONLY / NOT_RELEASED`。本批没有 commit、push、GitHub Pages、Render、Supabase 生产写入或多实例启用；只有收到用户当前明确发布命令才执行。

## 追溯入口

- `server/boundaries/match-protocol.js`
- `server/index.js`
- `qa/match-protocol-boundary.js`
- `requirements/ADR/003-server-boundary-adapters-metrics.md`
- `requirements/active/technical-optimization-mainline-p0-20260816/acceptance.md`
- `requirements/active/technical-optimization-mainline-p0-20260816/plan.json`
- `requirements/active/technical-optimization-mainline-p0-20260816/contract.md`
- `requirements/active/t7-room-presence-boundary-p2-20260817/`
- `PROJECT_STATUS.json`
- `requirements/PRODUCT_REQUIREMENTS_LEDGER.json`（TECH-039 / TECH-040 / TECH-052）
