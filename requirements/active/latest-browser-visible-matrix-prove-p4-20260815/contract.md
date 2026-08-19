# P4 可见修复与证据合同

## Authority

- 路由：`setAppRoute()` 的同步 commit 与既有 GhostRouteMotion seam。
- Monopoly：既有 24 格规则状态与 DOM/Wave B fallback；表现可以降密度，事实和输入不可改。
- 数量语言：三份同构 locale 与统一 i18n helper；玩家昵称继续 raw。
- 可见事实：当前 in-app Chromium 的真实 DOM、截图、布局计算与 console。

## Repair contract

- Route reset 在已提交新路由后执行，并覆盖从深滚动页面切换、同路由重选、Route Motion 成功/降级；Game Stage 进入/退出的独立滚动保存恢复不变。
- Monopoly 小屏隐藏或缩写的可见副文案必须用 `aria-label/title/data-*` 保留完整格子事实；棋子、owner、当前格、骰子和可点击规则不变。
- uk-UA 通过 `Intl.PluralRules('uk-UA')` 等价规则选择 one/few/many/other；不得把乌克兰语规则硬编码进 Profile 页面。

## Evidence schema

- 最终证据 `claim=current_build_single_browser_visible_matrix_p4`，精确记录 build hash/characters/bytes。
- 五个唯一 viewport × 四个唯一路由，另含 deep-scroll route reset 场景。
- 四个共享表面、六款唯一 Stage、三语言、双主题、visible reduced-motion、forced-colors、console 与 cleanup。
- `notGranted` 保留第二浏览器、真机、真实网络、真实性能、Supabase、人工美术、生产与发布。

## Failure and rollback

- 任一 P0/P1 可见缺陷、模拟未清理、console warn/error 或构建/证据哈希漂移，P4 不得完成。
- 路由回滚只移除集中回顶 seam；Monopoly 回滚恢复原可见标签布局；语言回滚恢复旧 formatter/key，但保留本任务证据为失败记录。
