# Profile Modal A11y P1：旧编辑器与成就弹层

状态：`COMPLETED_LOCAL`
时间：2026-08-10（Asia/Tokyo）

## Goal

让旧的个人资料编辑器与成就弹层和已验收的覆盖层保持同一套可访问生命周期：命名 dialog、初始焦点、Tab 循环、Escape/背景关闭、幂等清理、滚动锁与发起控件焦点恢复。

## IN

- `openProfileEditor()`：资料输入框作为初始焦点；保存、取消、Escape 和背景均走同一关闭路径。
- `openAchievementsModal()`：关闭按钮作为初始焦点；Escape 和背景均走同一关闭路径。
- 复用既有 `setupAccessibleOverlayDialog()`、`acquireModalScrollLock()` 与 `releaseModalScrollLock()`。
- 编辑器/成就弹层的 44px 可点击目标、窄屏安全高度与内部滚动适配。
- 三语既有标题保持为 dialog label；不为无新增用户文案创建冗余词典 key。
- 浏览器无关专项动态合同、i18n、DOM、既有 Profile/Social 回归。

## OUT

- 不修改 WebSocket 协议、服务端、奖励、商城价格、Supabase、游戏、AI、Replay 或美术。
- 不改变资料字段、成就判定、个人资料公开投影或持久化。
- 不提交、不推送、不部署。

## Non-negotiable

- 关闭逻辑必须幂等：重复关闭、已移除节点上的迟到事件不能二次释放滚动锁或二次恢复焦点。
- 用户可通过 Escape、背景、显式取消/关闭退出；关闭后键盘焦点回到开启弹层的控件。
- 只改 canonical function source，禁止在无关模块复制函数或使用运行时猴子补丁遮掩源文件所有权。

## Known Existing Behavior

- 已有 `setupAccessibleOverlayDialog()` 已提供 `role=dialog`、`aria-modal`、初始焦点、Tab 循环、Escape、背景关闭、幂等 close 和焦点恢复。
- `openProfileEditor()` 位于 `public/src/ui/07-roster.js`，`openAchievementsModal()` 位于 `public/src/core/04-social.js`；主负责人已显式批准这两处 canonical source 的最小所有权例外。
- 两处现已接入统一 helper 和 owner 滚动锁，保留字段、成就计算和持久化语义；成就卡不再使用会压过手机 CSS 的内联桌面宽度。

## Expected UX

从个人档案点击“编辑档案”后，键盘立即落在昵称输入框；从任意入口打开成就后，键盘立即落在关闭按钮。两种弹层均可在手机上完整滚动，底部操作至少 44px，并且关闭后用户回到原来的入口位置。
