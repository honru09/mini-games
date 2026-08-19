# Social Match P0 验收

## 协议与安全

- [x] capability 与三对消息在服务端/客户端/README/协议注册表成对登记。
- [x] capability 属于 WebSocket 连接级协商状态；同一连接内会话失效、注销、退出房间或重置对局不会清空 `match-expression-v1`，只有真实断开才清空。
- [x] 服务端权威 sender/player/time；伪造身份、错误 match、非法 ID/目标被拒绝。
- [x] eventId 幂等、10 秒/60 秒/单局频控均有动态回归。
- [x] Block 对目标和每个接收者生效；观众、访客、AI 不可发送。
- [x] 表达不进入 moveLog、Replay、规则、奖励、学习、数据库或 Analytics。

## UI 与可访问性

- [x] Seat 使用公开 Avatar/Frame/Effect/NameFx/Lang，未暴露私有经济字段。
- [x] 真人 Seat 身份可打开服务端公开 Profile；好友/私聊/屏蔽/举报状态正确。
- [x] Command 内 Emoji/快捷语/目标/静音入口不遮挡游戏操作。
- [x] Seat 气泡每人最多三条，动画和计时器在退出/重开/销毁时清理。
- [x] reduced-motion 使用静态气泡；三语言无裸 key；昵称不被翻译。
- [x] 1440×900、1024×768、390×844、844×390 无关键遮挡或页面滚动回归。

## 回归与边界

- [x] Game Stage、Immersive Shell、DOM、i18n、Social、Chat、Security、Reconnect、E2E 全部通过。
- [x] `npm run quality:gates`、完整 `npm test`、双构建 hash 与 progress ledger 通过。
- [x] ART-024/025/SOC-017、自由文本房间聊天、真实 Supabase/真机/真实网络保持未执行或既有状态。
- [x] 未 commit、未 push、未部署。

## 本地证据

- `node qa/social-match-contract.js`：ALL_PASS。
- `node --experimental-websocket qa/social-match-online.js`：ALL_PASS。
- 会话失效后能力保持的源码回归：`qa/social-match-contract.js` 通过；双次 `node scripts/build.js` SHA-256 均为 `A0F8D8139D8884F4F6D394F308778B249321D0D6E762891DC90FDEF04709A95B`。
- `npm test`：ALL_PASS（完整主链）。
- `npm run quality:gates`、`npm run test:progress-ledger`、`git diff --check`：通过。
- 双次 `node scripts/build.js` 产物 SHA-256 一致：`030CFDFE60A6ED8345EE6B326B564AE192D0C852DE1C6AA065B47200D14F2394`。
- 本地 in-app 浏览器对局态：1440×900、1024×768、390×844、844×390；`#screen-game` 覆盖完整视口，页面 `overflow:hidden` 且表达盘/气泡可用。
- 会话失效后的本地浏览器复核：当前 in-app Browser 对 `http://127.0.0.1:8080` 有用户保存的权限阻断，未绕过；该项保留为外部浏览器闸门，不能用自动化测试冒充。
