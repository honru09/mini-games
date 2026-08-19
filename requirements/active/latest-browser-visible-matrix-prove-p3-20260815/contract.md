# P3 可见证据合同

## Authority

- 构建事实：磁盘 `public/index.html` 的 SHA-256、characters、bytes。
- 可见事实：当前 Codex in-app Chromium 的实际 DOM、布局计算、交互结果和 console。
- 状态事实：`requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 与 `requirements/MAINLINE_CONTROL_ROUTING.json`。

## Evidence schema

P3 full-source evidence 与 current wrapper 必须至少包含：

- full-source 使用 `claim=current_build_single_browser_visible_matrix`，wrapper 使用 `claim=current_build_single_browser_partial`；
- `build` 精确哈希/characters/bytes，`fullRouteMatrixCurrentBuild=true`；
- `environment.browserCount=1` 与 `deviceEvidenceKind=CSS viewport emulation only`；
- 五个唯一 viewport，每个含四个唯一 route 与 overflow/rawKey/scroll/nav 结果；
- Shop、DM、Achievement、Room Lobby；
- 六款唯一游戏，每款 `stage/arena/command/back=true`；
- 三语、双主题、reduced-motion、forced-colors 和 console；
- `notGranted` 完整保留第二浏览器、真机、真实网络、双正式好友、真实性能、生产与发布。

## Failure behavior

- 当前哈希不一致、会话失效、浏览器断开、任一必需路线/游戏未完成、console P0/P1 或模拟状态无法复位时，P3 不得宣称 current complete。
- 可复现产品缺陷归回原 Requirement；先建立最小反馈环和回归，再重新采集，不覆盖失败证据。
- Browser 只有一个时不得用第二标签冒充第二浏览器。

## Cleanup and rollback

- 结束时 reset viewport、reduced-motion 与 forced-colors 模拟，退出任何 Game Stage，关闭测试弹层，并把用户标签页留在安全平台页面。
- 回滚 P3 只删除 P3 证据/索引并恢复 P2 historical-as-of 指针；不触碰用户账号、运行时、历史 P2 证据或线上环境。
