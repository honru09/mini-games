# Tank Controls P0 验收

## 自动化

- [x] 专项 QA 验证八方向扇区、死区、摇杆跟手、Pointer Capture、离界/取消/失焦/隐藏/销毁释放。
- [x] 专项 QA 验证移动与开火独立、按住连发/点击单发无重复、D-pad/键盘降级与三语 aria 文案。
- [x] 专项 QA 验证 relay/authority 仍只发送旧字段与单调 seq；观众、回放、结束状态不发送。
- [x] `tank-authority`、`gameplay-upgrade`、i18n、DOM、响应式、Immersive Shell、联机 E2E、Quality Gates、完整 `npm test` 通过。
- [x] 双构建产物字节一致，`git diff --check` 通过。

## 浏览器

- [ ] 本地 in-app Chromium：1440×900、1024×768、390×844、844×390；light/dark；zh-CN/en-US/uk-UA；控制台无新增 error/warn、无横向溢出（当前 localhost 访问被浏览器已保存权限拦截）。
- [ ] 可见验证：移动摇杆八方向/回中、移动+开火多指、滑出与切后台停下、键盘按住/失焦停下、D-pad 可聚焦（当前浏览器权限阻塞，VM/自动化已覆盖交互语义）。

## 边界

- [ ] 未改服务端 Authority、协议、规则、奖励、Replay、AI、Supabase、商城、社交或美术资产。
- [ ] 未提交、推送或部署；真实 Android/iPhone/Tablet、第二桌面浏览器与真实网络整形保留 `NOT_EXECUTED`。
