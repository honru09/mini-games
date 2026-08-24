# Game Stage 交互目标与 Tank 控制布局收口 P1 验收

状态：`MACHINE_VERIFIED_LOCAL / BROWSER_NOT_EXECUTED / LOCAL_ONLY / NOT_RELEASED`

## 已完成

- Game Stage 顶栏、Seat Rail、玩家头像/名称、局内表情、房聊与举报入口达到至少 44×44px。
- 手机与短横屏几何同步收口；短横屏 3–5 人 Seat Rail 使用固定席位宽度、横向滚动和 scroll snap，不以压缩裁切换取数字通过。
- Tank 外层 Grid 由 `public/styles/tank-controls.css` 单一拥有，摇杆与 D-pad 互斥；按住任一移动面切换模式时先提交 neutral。
- 浏览器证据 current 判定同时校验 HTML SHA/bytes、15 个表现模块身份、布局身份和 Service Worker cache generation。
- P15–P21 既有 T7 成果完整保留；Rule、Authority、Protocol、Reward、Replay、AI、Supabase 与生产配置未改变。

## 机器验证

- `npm run quality:gates`：PASS，退出码 0。
- `npm test`：PASS，退出码 0。
- `node scripts/build.js --check`：PASS。
- `git diff --check`：PASS；仅有 Git 的 LF→CRLF 工作区提示，无空白错误。
- 当前构建：1,808,637 characters / 1,822,490 bytes / SHA-256 `8E20C9F4A10F10A97931185742A13974C019F8FCFCD3D20AA3A34FA2FF0B5661`。

## 未执行

- 当前构建真实浏览器可见矩阵：连接器因本机 kernel assets 路径错误未能初始化，保持 `NOT_EXECUTED`。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络整形和低端性能：`RELEASE_EVIDENCE_PENDING`。
- 未 commit、push、GitHub Pages、Render 或生产数据写入。

