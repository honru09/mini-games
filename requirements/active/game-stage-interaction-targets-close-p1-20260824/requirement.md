# Game Stage 交互目标与 Tank 控制布局收口 P1

状态：`MACHINE_VERIFIED_LOCAL / BROWSER_NOT_EXECUTED / NOT_RELEASED`

## 原子需求

- UI-027
- UI-028
- UI-035
- GAME-044
- TECH-027
- TECH-049

本批是既有需求的 Acceptance Gap 与 Shared Repair，不创建新 Requirement ID。

## IN

- Game Stage 顶栏、头像、玩家名、局内表达、房聊及可举报气泡至少 44×44。
- 同步修正 Header、Seat Rail、身份徽章、窄工具栏与短横屏的容器几何，禁止用裁切换取 44px 数字。
- Tank 外层控制 Grid 只由 `public/styles/tank-controls.css` 拥有；摇杆与 D-pad 互斥，开火独立。
- 按住任一移动面切换模式时先提交 neutral；动态语言更新模式按钮的可访问名称。
- 浏览器证据 current 判定同时匹配 HTML、表现 CSS、布局 CSS 与 Service Worker cache generation。

## OUT

- 不修改游戏 Rule、Authority、Protocol、Reward、Replay、AI、数据库或生产配置。
- 不生成或替换美术资产。
- 不把静态/VM/机器回归冒充浏览器、第二浏览器、真机或真实网络可见验收。
- 不 commit、push、Pages、Render 或生产数据写入。

## 回滚

- CSS 回滚到本批前 22/34/40/42px 与多 owner 规则会重新引入已知缺陷，因此必须同时回滚专项 QA、SW cache generation 与证据身份合同。
- Tank 输入逻辑可单独回滚，但会重新暴露按住方向切换后未发送 neutral 的风险。
