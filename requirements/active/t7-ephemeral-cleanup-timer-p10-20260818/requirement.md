# T7 Ephemeral Cleanup Timer P10

状态：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## Requirement 归属

本批是既有访客账号生命周期的 Shared Repair，复用 `TECH-039`、`TECH-040` 与 `TECH-052`，不新增玩家能力、协议、持久数据或 Requirement ID。

## 目标

把访客临时账号的延迟清理从原生 `setTimeout` 迁移到 `ServerClockTimer` 的按 UID owner lease，统一取消、重入和 server close 生命周期。

## 范围内

- `ephemeral-cleanup:<uid>` owner 的一次性 lease。
- 访客重新认证、清理完成和显式删除路径的幂等取消。
- 访客持久化安全边界、删除内容、重连窗口与现有数据过滤逻辑保持不变。

## 不在范围内

- 不迁移 heartbeat、正式账号 token TTL、reconnect grace、Chat/Expression delay、Reward/AI outbox、gameplay tick 或 transport deadline。
- 不改变账号协议、数据库 schema、奖励、前端、美术、音频、3D 或发布。

## 回滚

恢复访客 `setTimeout` 与 `clearTimeout` 兼容路径即可；保留 P6/P8/P9 Timer seam 和已有 fallback。
