# Game Stage 交互目标与 Tank 控制布局收口

时间：2026-08-24 01:05（Asia/Tokyo）  
状态：`MACHINE_VERIFIED_LOCAL / BROWSER_NOT_EXECUTED / LOCAL_ONLY / NOT_RELEASED`

## 本批结果

- Game Stage 顶栏、玩家头像/名称、局内表情、房聊与举报入口统一到至少 44×44px。
- Header、Seat Rail、身份徽章、窄表达工具栏同步调整；短横屏 3–5 人席位改为固定宽度横滚与 scroll snap，避免压缩、裁切和按钮重叠。
- Tank 摇杆与 D-pad 保持互斥，外层 Grid 由 `tank-controls.css` 单一拥有；按住移动控件切换模式会先提交 neutral，避免坦克继续移动。
- 浏览器证据不再只比较 HTML SHA；现在同时匹配 15 个表现模块、布局模块和 Service Worker cache generation，CSS 改变后旧截图会自动降为 historical-as-of。
- T7 P15–P21 既有成果完整保留，未修改 Rule、Authority、Protocol、Reward、Replay、AI、Supabase 或生产配置。

## 审核与纠正

- Tank 审计指出旧高特异性三栏 `stick dpad fire` 会覆盖新布局；已删除冲突布局声明并补单 owner 合同。
- UI/证据审计指出外链 CSS 改动不会改变 HTML SHA；已新增 `presentation-identity` 深模块并把证据判定升级为 HTML + Presentation + Layout + Cache 四重身份。
- 短横屏审计指出 3–5 人 Seat Rail 会被均分压缩；已改为可访问横滚布局并补防回归断言。
- 主负责人复核后修正三个治理失败：未登记模块路径、旧浏览器证据误标当前、T7 验收仍绑定 P12/旧构建。

## 验证

- `npm run quality:gates`：PASS，退出码 0。
- `npm test`：PASS，退出码 0。
- `node scripts/build.js --check`：PASS。
- `git diff --check`：PASS；只有 Git 行尾格式提示，无空白错误。
- 当前构建：1,808,637 characters / 1,822,490 bytes / SHA-256 `8E20C9F4A10F10A97931185742A13974C019F8FCFCD3D20AA3A34FA2FF0B5661`。
- 表现身份：`7477EE0D…CCD92DF`；布局身份：`408AC7B5…A356159`；缓存：`ghost-game-shell-v21-20260824`。

## 当前进度与下一主线

| 方向 | 本地实现 | 最终闭环 |
| --- | ---: | ---: |
| 美术与品牌 | 68.1% | 56.3% |
| 界面与交互 | 82.9% | 72.9% |
| 游戏与局内体验 | 73.1% | 68.6% |
| 社交与玩家关系 | 60.6% | 60.3% |
| 经济成长与商业化 | 75.9% | 71.7% |
| 技术数据 AI 与跨平台 | 68.5% | 62.8% |
| 整体 | 71.5% | 65.4% |

本批 `CLOSE` 机器收口完成后进入 `PROVE` 准备。当前浏览器连接器仍被本机 kernel assets 路径错误阻断，所以当前构建真实浏览器矩阵、第二浏览器、真机、真实网络和低端性能保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`；没有用静态测试冒充可见证据，也没有执行部署。

