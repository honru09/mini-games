# Change Request：窄屏游戏顶栏

## 触发证据

- P1 浏览器预览在 390px 视口发现“返回 / 游戏标题 / 规则 / 新一局”同排拥挤并发生文字重叠。
- 五子棋棋盘本身宽 370px、页面 `scrollWidth=390`，问题限定在共享游戏顶栏，不属于棋盘坐标或规则层。

## 冻结范围

- 修改 `public/index-template.html` 的 `@media (max-width:480px)` 游戏顶栏样式。
- 修改 `qa/ui-responsive-contract.js`，锁定两行网格、标题截断和操作按钮等分。
- 通过 `scripts/build.js` 同步生成 `public/index.html`。

## 设计合同

- 第一行仅放返回按钮与可省略标题；第二行放全部可见操作按钮。
- 标题必须 `min-width:0`、单行省略，不得覆盖返回按钮。
- 操作区占满宽度；按钮等分、可收缩，并继续受全局 44px 触控目标合同保护。
- 仅作用于 `<=480px`；不改按钮 DOM、事件、文案、游戏状态、协议或 `>=481px` 布局。

## 验证与回滚

- 自动化：`node qa/ui-responsive-contract.js`、`node qa/dom-smoke.js`、质量门禁与完整测试。
- 浏览器：360/390px 覆盖 zh-CN/en-US/uk-UA 与 Light/Dark，检查重叠、横向溢出和按钮可见性。
- 回滚：删除该手机媒体查询增补及对应合同断言；P1 美术开关仍保持默认关闭。
