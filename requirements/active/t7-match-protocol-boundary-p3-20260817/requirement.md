# T7 Match Protocol Boundary P3

状态：`REQUIREMENT_FROZEN / VERIFIED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

## Goal

把 Tetris、Xiangqi、Monopoly v2 Rule Authority 的客户端动作与服务器计时 transition 收敛到一个可替换、可回归的深模块 seam；保留现有 WebSocket wire、规则 Authority、奖励、Replay、Chat/Playline、Supabase 与旧协议回退行为。

## IN

- `MatchProtocolBoundary` 的 `command(input)` 与 `transition(input)` Interface（内部兼容非枚举 `action`/`advance` 别名）。
- matchId、generation/epoch、authority match、成员/session、sequence duplicate/stale 与 event revision fences。
- metric、turn、audit、broadcast、terminal settle/stop 的固定 effect ordering、幂等终局与分类错误。
- JSON runtime、isolated memory/runtime Adapter 的 detached `load/save/commit` 合同与有界本地 journal。
- Authority/Adapter/本地写入失败时的 room、Authority checkpoint 与 Adapter state 回滚。
- `server/index.js` 真人、AI v2 action 和三套 v2 timer transition 接线；legacy inline fallback。

## OUT

- 不改变 Tetris/Xiangqi/Monopoly 规则算法、协议字段、客户端 wire、Reward/Economy、Replay、AI 学习、Chat/Playline、社交、Supabase schema/RLS/RPC 或生产 Cluster。
- 不把本地 Adapter、journal 或自动化回归描述为 durable recovery、防作弊、跨设备或生产证据。
- 不执行 commit、push、Pages/Render 发布或生产数据写入。

## Non-negotiable

- Rule Authority 仍是合法动作、局面、revision、终局与结果的唯一 owner。
- 错误回执只使用稳定 code/reason；不得泄漏 token、secret、password、stack 或底层异常正文。
- 旧 capability/旧协议/缺少 v2 Authority 时继续走原兼容路径。
- Adapter effect 失败不得消耗客户端 seq、推进 Authority revision 或重复广播终局。
