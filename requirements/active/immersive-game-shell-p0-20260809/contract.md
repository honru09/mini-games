# 沉浸式 Game Shell P0 合同

状态：`FROZEN`

## DOM 与稳定插槽

| 插槽 | 现有节点 | 合同 |
| --- | --- | --- |
| `header` | `#game-stage-header` | 返回、模式、标题、结束、规则、重开；全部在 Shell 内 |
| `seats` | `#game-stage-seats` | 权威 Seat Rail 与观众计数；可横向内部滚动 |
| `arena` | `#board-area` | 六款现有根容器；只允许表现层布局变化 |
| `command` | `#game-stage-command` | 状态、在线提示和 `#game-extra` 操作容器 |
| `overlay` | `#game-stage-overlay` | 空的 pointer-events:none 扩展层；本轮不挂业务内容 |

每个节点增加唯一 `data-game-shell-slot`，Arena、Seat Rail、Command 增加 `data-game-scroll-region`。既有 ID 不改名、不复制。

## 生命周期

- `enterImmersiveGameShell(gameId)`：幂等进入；保存一次 `scrollX/scrollY` 与有效活动焦点；给 `html/body` 加 `game-active`；设置 Stage `aria-hidden=false`、`data-shell-active=true`；安装一次输入监听；聚焦 Stage；发出 `ghostgame:shellchange`。
- `exitImmersiveGameShell()`：幂等退出；移除监听与 class；设置 Stage `aria-hidden=true`、删除活动标记；下一帧恢复滚动与仍连接的焦点；入口弹层已卸载或焦点退化为 body 时回退到同 `gameId` 的大厅游戏卡；发出 `ghostgame:shellchange`。
- `showGame()` 的重入分支和新建实例分支都必须调用 enter；`showHub()` 与认证强制退出必须调用 exit。
- 内部事件 detail 只能为 `{active:boolean, gameId:string|null}`，不得包含账号、token、房间正文、规则状态或奖励。

## 输入策略

| 输入 | Shell 内 | 显式内部滚动区 | 外部 Modal / 表单 |
| --- | --- | --- | --- |
| Wheel | 阻止页面默认滚动 | 允许该区域滚动，滚动链由 CSS contain 截止 | 让行 |
| Touch move | 阻止页面默认滚动 | 允许该区域 pan，事件继续传播 | 让行 |
| Space/Arrow/Page/Home/End | 阻止页面默认滚动，事件继续传播给游戏 | 同左 | input/textarea/select/contenteditable 与外部 Modal 让行 |
| Tab | 在 Shell 可聚焦元素首尾循环 | 同左 | 外部 Modal 让行 |
| Pointer/click | 不拦截 | 不拦截 | 不拦截 |

监听必须使用可移除的稳定函数引用；Wheel/Touch 使用 `{passive:false}`，禁止 `stopPropagation()`。

## 布局

- Stage fixed 到视口，低于 `.modal-backdrop` 的 stacking context，高于平台 Header/Nav。
- Desktop：`header / seats / (arena + command)`，Command 宽度受令牌限制并内部滚动。
- Tablet：保持双列但压缩 Command；`<=720px` 切为 `arena / command` 两行。
- Mobile：Header 与 Seat 紧凑，Seat 横向滚动，Command 最大高度受 `dvh` 限制，文档本身不可滚。
- `max-height:600px` 横屏：恢复紧凑双列，降低非关键间距但不隐藏返回、状态或操作。
- 使用 `env(safe-area-inset-*)`；`100vh` 为 fallback，`100dvh` 为主值。

## Authority 与失败行为

- Shell 是纯表现与浏览器输入边界，不读取/写入 WebSocket 消息、规则快照、Replay、奖励或数据库。
- 若 Focus/CustomEvent/scrollTo/closest 等浏览器能力缺失，Shell 仍显示并使用 CSS 锁；函数返回布尔值，不抛出阻塞开局的异常。
- 外部 Modal 存在时输入与焦点逻辑让行，Modal 关闭后无需重装 Shell。
- Rules、Victory Overlay 与 Reward Breakdown 必须使用命名 dialog、初始焦点、Tab 首尾循环、Esc/背景/主按钮统一关闭和原焦点恢复；替换旧 Reward Overlay 时先走同一清理路径，禁止遗留 document keydown listener。
- 退出恢复目标已卸载或退化为 body 时恢复滚动并优先聚焦同 `gameId` 的大厅游戏卡；卡片也不存在时不强行聚焦无效节点。

## Change Request

Emoji、玩家主页、文字气泡、Match Event、局内聊天或新 HUD 只能使用已冻结插槽，新增交互/协议前必须创建独立 active task；不得直接扩展本合同的消息或 Authority。
