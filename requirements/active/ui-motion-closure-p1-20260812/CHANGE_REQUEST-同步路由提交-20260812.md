# Change Request｜同步路由提交

状态：`APPROVED_BY_MASTER / REQUIREMENT_REFROZEN`

## 发现

初版合同允许 runtime 已就绪后先执行 120ms exit，再调用 route `commit()`。主负责人集成审查发现，现有调用者会在 `setAppRoute('games')` 后的下一帧把键盘焦点放到目标游戏卡；延迟提交会让目标页当时仍为 hidden/inert，导致显式焦点语义失效。它也使一个原本同步的高扇出函数变成隐式延迟状态，增加快速点击、hash back/forward 和 Playline/Profile 刷新的兼容风险。

## 决议

- `setAppRoute()` 的业务 commit 在每次调用内同步、至多一次完成；Motion Runtime 永远不能延迟 hash、aria、render、连接或目标焦点可用性。
- runtime 已就绪时，在同步 commit 后只编排目标页的 L2 分层进入；没有旧页退出或不可交互等待期。
- 第一次需要动效但 runtime 尚未加载时，同步提交并仅 lazy-load 供下一次路由使用，不在模块迟到后重放进入，避免已显示页面闪一下再动画。
- timeline labels 改为 `committed / enter / settled`，完整窗口 `<=360ms`；转场期间目标页仍可点击、可聚焦。

## 不变边界

generation last-wins、单 loader promise、失败 sticky fallback、kill/revert、hidden/aria-hidden/inert、reduced-motion、document hidden、Game Shell active、无 ScrollTrigger、无布局属性动画、无服务端/协议/数据变化全部不变。

## 回归

专项必须断言 commit 同步、旧 handle 不杀新 timeline、首次 loader 不重放、进入期间不禁用目标页指针，以及现有显式 requestAnimationFrame focus 模式不因 route delay 失效。
