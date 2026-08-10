# 沉浸式 Game Shell P0 验收

## 自动化

- [x] `#screen-game` 具备五个唯一稳定插槽，既有关键 ID 不变。
- [x] active Shell 使用 fixed + `100dvh` + safe-area，不受 `#app` max-width/padding 影响。
- [x] html/body 文档滚动、overscroll 与 touch chaining 被锁；Seat/Arena/Command 内部滚动保留。
- [x] Scroll key 默认行为被阻止但事件不停止传播；表单和外部 Modal 让行。
- [x] Tab 在 Shell 内循环；进入保存一次焦点/滚动，退出幂等恢复。
- [x] showGame 两分支、showHub 和认证退出均成对调用生命周期。
- [x] 事件 detail 白名单仅含 active/gameId，Overlay 空且 pointer-events:none。
- [x] 手机单列、平板/桌面双列、低高度横屏紧凑双列，Tetris 七项按钮仍 ≥44px。
- [x] 规则、AI、联机协议、奖励、Replay、资产 flag 与 Wave A 回滚不变。

## 浏览器

- [x] Desktop 1440×900：Stage 完整覆盖视口，文档 scrollY 不变化，Command 可用。
- [x] Tablet 1024×768：Arena/Command 双列，无横向溢出。
- [x] Mobile 390×844：Arena 优先、Seat 横滑、Command 底部内部滚动、返回始终可见。
- [x] Mobile landscape 844×390：紧凑双列，主操作可达，无页面滚动。
- [x] Wheel、Space、方向键、PageUp/Down、Home/End 不移动页面；游戏键仍工作。
- [x] Rules Modal 可正常获得焦点；Esc/确认关闭后返回 Shell。
- [x] Victory Overlay 与 Reward Breakdown 使用统一命名 dialog，初始焦点、Tab 循环、Esc/背景/按钮关闭和焦点恢复通过动态 QA。
- [x] 退出后恢复进入前的 Hub scrollY 与有效焦点。
- [x] Light/Dark、zh-CN/en-US/uk-UA 的普通动效模式无关键遮挡或控制台错误。
- [ ] 浏览器 reduced-motion 媒体模拟：当前 Browser 能力未提供，保持 `NOT_EXECUTED`；CSS/自动化合同已通过。

## 边界

- [x] 真机 Android/iPhone/Tablet 与真实网络仍明确 `NOT_EXECUTED`。
- [x] 未生成图片、未开启冻结资产、未修改服务端/规则/协议/奖励。
- [x] 未 commit、push 或部署；本地终态为 `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`。

## 最终证据

- 浏览器四档与交互记录：`evidence/browser-qa.md`。
- 弹层动态合同：`qa/overlay-dialog-accessibility.js`，22 项通过；旧实现无写入回放真实失败 5 项。
- `npm run quality:gates`：通过。
- `npm test`：通过，189.2 秒。
- 两次构建 SHA-256 一致：`4236BF12F501470A9684F80F7DF810F3CC994899482BEC46011ACABE22BE02DD`。
