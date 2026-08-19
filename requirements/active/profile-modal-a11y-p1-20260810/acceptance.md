# Profile Modal A11y P1 验收

当前状态：`COMPLETED_LOCAL`，等待外部设备/浏览器闸门与发布指令。

- [x] 编辑器使用统一 dialog 生命周期；昵称输入框获得初始焦点。
- [x] 成就弹层使用统一 dialog 生命周期；关闭按钮获得初始焦点。
- [x] 两者都具备 role/aria-modal/命名、Tab 循环、Escape、背景关闭和焦点恢复。
- [x] 两者的资源清理幂等，滚动锁不会泄漏或重复释放。
- [x] 手机可滚动，关闭/保存/取消等操作目标至少 44px。
- [x] `node qa/profile-modal-a11y-contract.js`、i18n、DOM、Profile/Social 回归通过。
- [x] 未更改协议、服务端、奖励、商城价格、Supabase、游戏、AI、Replay、美术；未提交、未推送、未发布。
- [ ] 第二桌面浏览器、Android/iPhone/Tablet、真实网络和 in-app Browser 可见复核。

主负责人复核后增加“成就弹层不得用内联桌面宽度压过手机 CSS”断言，并确认 canonical source 已移除该内联宽度。完整 `npm test`：122.5 秒，exit 0。双构建：`public/index.html` 953847 characters / 967961 bytes，SHA-256 `B07BD0597D0B9834FB2C2C084ED7FD9AAE6ABC6B85D42766BE91DBFFA9C65B96`。
