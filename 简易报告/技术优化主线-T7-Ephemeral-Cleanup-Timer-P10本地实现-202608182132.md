# 技术优化主线 T7 Ephemeral Cleanup Timer P10 本地实现

## 一句话结论

P10 已把访客临时账号的延迟清理迁移到按 UID 隔离的 `ServerClockTimer` lease，并通过账号、连接恢复、Timer Audit、统一质量门禁与完整联机 E2E；独立 3D 窗口完成正式目录写入后，已接纳其最新构建并完成全链。

## 做了什么

- 新增 `ephemeral-cleanup:<uid>` 一次性 owner lease。
- 统一访客重新认证、清理完成和显式删除的幂等取消入口。
- 调度失败只写分类运维错误；访客删除字段、重连窗口、协议和持久化策略保持不变。
- Timer Audit 禁止该路径重新直接持有原生 timeout。

## 用户现在能看到什么

没有新增页面或玩法；访客退出、重连与临时数据清理行为保持原样，服务端计时生命周期更集中。

## 还没做什么

- 并行 3D/前端窗口完成正式目录写入后，统一 Quality Gates、完整 `npm test` 与确定性构建检查已通过。
- heartbeat、reconnect grace、Chat/Expression delay、Reward/AI outbox、gameplay tick 与 transport deadline 尚未迁移。
- 未执行第二浏览器、真机、真实网络、真实 Supabase 或本窗口部署。

## 验证

- `node --check server/index.js`：通过。
- `node qa/timer-audit.js`：`TIMER_AUDIT_ALL_PASS`。
- `node --experimental-websocket qa/ghost-auth-online.js`：14/14，通过。
- `node qa/connection-route-resilience.js`：全部通过。
- `node --experimental-websocket qa/e2e-online.js`：`E2E_ALL_PASS`。
- `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`。
- `npm test`：退出码 0，完整 pretest/test/posttest 链通过。
- `node scripts/build.js --check`：`2077538` characters / `2092161` UTF-8 bytes / SHA-256 `82D85384C5AF1061B3B60E5BB197E9F75A9A57FCD10DD30096E2C88C248FE90E`。
- `git diff --check`：通过。

## 风险与下一步

P10 已完成统一的本地验证，下一批继续选择不碰前端的低风险生命周期 owner；线上发布仍需用户当前明确命令。

## 发布状态

`VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。本窗口未提交、未推送、未部署。

## 追溯入口

- `requirements/active/t7-ephemeral-cleanup-timer-p10-20260818/`
- `server/index.js`
- `qa/timer-audit.js`
- `qa/ghost-auth-online.js`
- `qa/connection-route-resilience.js`
- `qa/e2e-online.js`
