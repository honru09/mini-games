# UI Repair P0.2 本地浏览器验收证据

时间：2026-08-10 03:44–04:16（Asia/Tokyo）

环境：本地 `127.0.0.1:8099`、Codex in-app Chromium。为避免该来源已保存的 Render 地址污染本地验收，测试构建临时采用 localhost 同源优先；验收后源码已恢复并重新构建。两个一次性访客均已显式退出删除，本地服务和浏览器测试标签均已关闭。

## 已验证

- 层级计算值：Header `120`、Modal `900`、Auth `11000`、Toast `12000`；商城与设置关闭按钮可点击，弹层无 Header 截获。
- 黑夜登录页 Ghost Game Logo 可见，计算样式为 `brightness(0) invert(1)`；认证层覆盖全视口，App 带 `inert` 与 `aria-hidden=true`。
- Room Launchpad 通用入口先选游戏；Ludo 容量自动给出 2/3/4；房间码输入框实测 44px。
- 输入 `IL01AB` 后统一校验净化为 `AB`，设置 `aria-invalid=true` 并显示乌克兰语错误；浏览器原生 pattern 先于 submit 阻断的问题已通过 `form.noValidate=true` 修复。
- 创建 Ludo 房间成功，服务端返回 6 位无歧义房间码 `PUCDFM`，房间保持 Ludo；在已有房间尝试创建 Gomoku 时保留原房/原游戏并显示“已在房间”。
- 第二标签创建等待中的 Gomoku 房 `5SY9T5`：主标签显示等待、1 真人/0 AI、Join/Spectate、44×44 房主资料按钮；加入 AI 并开始后显示进行中、1 真人/1 AI、仅 Spectate。
- 主标签离开原房后观战第二房；Lobby 立即隐藏当前观战房，Room Panel 显示只读观众状态。两侧退出后房间和访客均清理。
- 普通访客房间按钮中没有 Tournament 创建/打开，赛事弹层数量为 0。
- Light/Dark 及 zh-CN/en-US/uk-UA 连续切换：标题分别为 `Ghost Game · 随时开局，一起成长`、`Ghost Game · Play now. Grow together.`、`Ghost Game · Грайте зараз. Зростайте разом.`；可见区域无裸 key。
- 真实视口：1440×900、1024×768、390×844、844×390；全部 `overflowX=0`，房间码输入为 44px，手机使用底部导航，桌面/平板使用顶部导航；低高横屏和手机弹层通过内部滚动到达取消按钮。
- 两个标签控制台 `error/warn` 均为 0。

## 自动化交叉证据

- `node qa/ui-room-lobby-contract.js`
- `npm run test:i18n`
- `node qa/ui-responsive-contract.js`
- `node qa/dom-smoke.js`
- `node qa/ghost-shell-contract.js`
- `node --experimental-websocket qa/ghost-auth-online.js`
- `node --experimental-websocket qa/room-seats.js`
- `node --experimental-websocket qa/tournament-auto-online.js`
- `node --experimental-websocket qa/e2e-online.js`
- `npm run quality:gates`
- `npm test`（104.4 秒，全部通过）
- 双构建 SHA-256：`18E23C35A7FB37F705F69238269680DE4D806BA01891F56862F538C399308779`

## 未执行

- Browser reduced-motion 媒体模拟（当前浏览器控制面没有该能力）。
- 独立第二桌面浏览器、Android、iPhone、Tablet、真实网络整形。
- Commit、push、GitHub Pages、Render 部署。
