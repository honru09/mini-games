# T7 Server Boundary Clock Injection P8

状态：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## Requirement 归属

本批是既有 Server 深模块与时间所有权的 Shared Repair，复用 `TECH-039`、`TECH-040` 与 `TECH-052`，不新增玩家能力、协议、持久数据或 Requirement ID。

## 目标

复用 P6 `ServerClockTimer` 的现有 `now()` Interface，把 Auth/Profile、Room/Presence、Match Protocol、Chat/Playline、Reward/Economy 与 Reward/Progression 六个既有 Boundary Module 在 `server/index.js` 中的显式 wall-clock 注入统一到单一 `serverNow` seam。

## 范围内

- 六个现有 Boundary 构造器只接收 `serverNow`，不直接学习 `Date.now()`。
- `qa/timer-audit.js` 对六个调用点与禁止 raw `Date.now` 回退做 fail-closed 静态合同。
- 复用各 Boundary 已有 Memory/JSON Adapter 单元与在线回归；不复制 Module 内部时钟测试。

## 不在范围内

- 不迁移 heartbeat、guest/reconnect、Room recovery、Tournament、spectator/chat/expression delay。
- 不迁移 Reward/AI outbox cadence、gameplay tick、Authority 默认时间或 transport deadline。
- 不改变 Reward 数值、资格、daily claim、Rule/Authority、协议、wire、数据库 schema、前端、美术、音频、3D 或发布。

## 回滚

六个构造器可分别恢复其原 `Date.now` closure；P6 Module、Boundary Module、用户数据、outbox 与数据库均无需删除或迁移。
