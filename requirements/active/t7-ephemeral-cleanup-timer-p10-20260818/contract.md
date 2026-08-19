# Ephemeral Cleanup Timer P10 合同

## Seam

每个 UID 只允许一个 `ephemeral-cleanup:<uid>` owner lease；`cancelEphemeralCleanup(uid)` 先从 Map 脱离，再调用 lease.cancel，兼容旧 native handle 仅作为回滚分支。

## 不变量

1. 清理回调只删除无活动会话、无房间/观战席位的临时用户。
2. lease 调度失败只记录分类运维错误，不把原始异常带入 wire。
3. 访客重新认证会取消待清理 lease；重复取消安全幂等。
4. 访客数据不会进入排行榜、持久社交或正式奖励路径。
5. 真实设备、网络、Supabase 与发布证据不由本地测试推导。
