# Shared Change Request：Profile Modal A11y P1

请求主负责人批准以下两处 canonical UI source 的最小改动；它们是需求指明的函数真实定义位置，但不在初始窄范围内。

| 文件 | 函数 | 所需变更 |
| --- | --- | --- |
| `public/src/ui/07-roster.js` | `openProfileEditor()` | 使用 `setupAccessibleOverlayDialog()`、以昵称 input 为初始焦点、owner 滚动锁和幂等 cleanup 替换直接 `bd.remove()`。 |
| `public/src/core/04-social.js` | `openAchievementsModal()` | 使用同一 helper、以关闭按钮为初始焦点、owner 滚动锁和幂等 cleanup 替换直接 `bd.remove()`。 |

## 兼容策略

- 保持全部资料字段、成就计算、保存/取消行为和本地化 key 不变。
- helper 不存在时保留原有背景点击 fallback；正常运行时 helper 管理 Escape、背景、Tab 和焦点恢复。
- 关闭资源回收函数只释放当前 backdrop 的滚动锁，并对重复调用返回 false，避免迟到事件二次清理。
- `public/index-template.html` 只添加局部 CSS：两类卡片的 44px 控件、`100dvh` 内部滚动与 <=640px 布局。
- `package.json` 只把专项追加到 pretest 的 Profile/Social 回归之前。

## 验收与回滚

- 先前红灯：`node qa/profile-modal-a11y-contract.js` 17 个预期失败。
- 绿灯：专项、`npm run test:i18n`、`node qa/dom-smoke.js`、`node qa/ui-profile-social-contract.js`。
- 回滚仅删除两处 helper 接入和 modal 局部 CSS；不含协议、服务端、持久化或数据迁移。
