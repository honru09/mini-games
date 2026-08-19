# Home Active Match Return P0 验收

当前状态：`LOCAL_VERIFIED`

- [x] 只在同实例、已认证、未结算的真人联机对局显示。
- [x] 观众、等待房、AI solo、replay/reconnect、结算、过期、异常 seat 与 stale click 安全隐藏/no-op。
- [x] 点击只调用既有 `showGame()` fast path，零服务器消息、零持久化、零重建/结算副作用。
- [x] result/leave/expired/reset 后由 `showHub()` 触发 Home 重渲染。
- [x] 三语、44px、手机单列、无新增动画；文案不承诺跨设备/跨重启恢复。
- [x] 专项、Home P0/P1/Identity、i18n、DOM、responsive、Ghost Shell、完整 `npm test` 通过。
- [x] 双构建一致：974130 characters / 988467 bytes / SHA-256 `8ECE8C16D5AE051DE59A31D9FA14949FF607675504059BC26BD050BE505F81E8`。
- [ ] 未提交、未推送、未部署。

外部浏览器、真机、真实网络与 visible reduced-motion 仍未执行。
