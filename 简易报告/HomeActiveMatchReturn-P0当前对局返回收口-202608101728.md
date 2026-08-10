# Home Active Match Return P0 当前对局返回收口｜2026-08-10 17:28

## 完成结果

首页现在可在严格条件下显示“返回当前对局”：WebSocket 已连接和认证、非观众、存在 room/game/matchId、当前仍是同一个游戏实例、本人仍是真人席位、没有 replay/reconnect 且该 match 尚未结算。

点击会再次校验 matchId，然后只调用既有 `showGame()` fast path。不会重新建局、发 WebSocket 消息、写 localStorage、改变结算/奖励/Replay、触碰服务器协议、规则、AI、Supabase 或素材。

结算、离房、过期、reset、replay/reconnect、异常 seat 和旧 click 全部隐藏或 no-op。文案不显示 room code、matchId、token、对手昵称或经济字段，也不承诺跨设备、跨重启、跨实例或持久恢复。

## 主审修正

首次专项组合运行发现旧 Home P0 VM 只加载 `renderGhostHome()` 片段，没有加载新 helper，产生 `ReferenceError`。主负责人为调用增加 `typeof renderHomeActiveMatchReturn === 'function'` 守卫；运行时完整构建仍执行新 helper，而旧隔离合同安全退化。修正后 Home P0/P1/Identity 与 Active Return 专项均通过。

## 验证

- Active Return 专项、Home P0/P1/Identity、三语、DOM、响应式、Ghost Shell：通过。
- 完整 `npm test`：通过，199.8 秒；其中重连、安全与 E2E 全部通过。
- 双构建一致：974130 characters / 988467 physical bytes；SHA-256 `8ECE8C16D5AE051DE59A31D9FA14949FF607675504059BC26BD050BE505F81E8`。

## 边界

这只是同一浏览器内存中仍有效 Game Stage 的返回入口。服务端 durable recovery、跨设备/跨进程/跨重启恢复仍未建立。localhost 可见复核、第二浏览器、真机、真实网络和 visible reduced-motion 仍未执行。本批未提交、未推送、未部署。
