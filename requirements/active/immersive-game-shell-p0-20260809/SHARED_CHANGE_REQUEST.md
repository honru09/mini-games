# Shared Change Request — Immersive Game Shell P0

状态：`APPROVED_FOR_MASTER_INTEGRATION`

## 共享文件

- `public/index-template.html`：增加稳定插槽、fixed viewport/safe-area/响应式 CSS。
- `public/src/core/01-utils.js`：Rules、Victory Overlay 与 Reward Breakdown 统一 dialog 语义、初始焦点、Tab 循环、Esc/背景关闭与焦点恢复。
- `public/src/core/02-app-shell.js`：新增纯浏览器 Shell 生命周期与输入边界。
- `public/src/ui/07-roster.js`：showGame/showHub 进入退出钩子。
- `package.json`：登记专项测试；`public/index.html` 仅由 build 生成。

## 影响消费者

- 六款游戏继续使用相同 `board-area` / `game-extra`。
- DOM/Stage/响应式/联机 E2E 继续使用相同按钮与容器 ID。
- Rules/Result/Auth Modal 位于 Stage stacking context 之上并获得输入让行。
- 人工浏览器验收发现 Rules Modal 初始焦点留在背景按钮，已由 Master 按本 Change Request 扩展修复并补专项合同。
- Terra Max 首轮终审发现 Victory/Reward 两条真实结算路径未复用该合同；Master 补统一 helper 后，二轮终审又发现 Rules 缺 Tab 闭环及 Victory 重复/外部移除监听残留。最终修为单实例、幂等清理，并以 22 项动态 QA 覆盖；旧实现无写入回放真实失败 5 项。

## 兼容与失败策略

- 不新增网络消息、不修改 Authority、Replay、Reward 或持久化。
- 缺少可选 Focus/CustomEvent/scroll API 时静默降级到 CSS 锁，不阻塞开局。
- 重复进入/退出幂等，所有监听可移除；失败时可整批删除控制器与 fixed CSS 回到 Wave A 页面布局。

## 验证

- 新建 `qa/immersive-game-shell.js`，并运行 Game Stage、响应式、DOM、i18n、E2E、Quality Gates、完整 `npm test` 和本地浏览器矩阵。
