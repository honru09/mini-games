# Home Active Match Return P0 Recon

- 现有 `setAppRoute()` 先调用 `showHub()`；`showHub()` 在 `online.game/currentGame/currentGameId` 一致时保留当前游戏实例。
- `showGame(id)` 已有同实例 fast path，可恢复 Game Stage 显示而不重建游戏。
- 服务端异常断线恢复仍由 `uid + session token hash`、60 秒窗口、`rejoined` 和快照/moveLog 决定；本任务不创建 resume 请求或持久化。
- 客户端 `online.resume` 只是内存提示，不是凭证，不可宣传成跨设备、跨进程或跨重启恢复。

可写：Home Shell、模板、三语、`showHub()` 的 Home 重渲染钩子、专项 QA、package、构建产物。禁止修改服务器、协议、规则、奖励、AI、Replay、Supabase 与美术。
