# UI Repair P0.2 Contract

## Layering

- `.modal-backdrop` 必须高于 `.app-header` 与 `.mobile-app-nav`；`#toast-wrap` 必须高于 Modal。
- 登录页与独立安全边界的高层级不降低；游戏 active 时既有 Header/Nav 隐藏逻辑保持。

## Room Launchpad

- `openRoomSetup(preselectedGame, trigger)` 单例；通用入口没有游戏时禁止提交并给本地化错误。
- 容量候选与选择值始终落在 `GAMES[selected].min..max`；改变游戏时立即纠正。
- 创建消息仍只发送既有设置字段；选中游戏写入 `online.pendingGame`，由既有创建成功流程发送 `select_game`。
- 私密码 `<form>` 使用标签、格式提示、Enter 提交和服务端最终裁决。
- close 路径统一释放 scroll lock、dialog 生命周期与焦点。

## Lobby

- `r.canJoin === true` 才显示可用 Join；`r.canSpectate === true` 才显示可用 Spectate。
- 不能根据人数、playing 或本地角色猜测服务端权限。
- 玩家/房主用户文本保持 raw；Profile 入口为真实 button。

## Tournament UI

- `tournamentUiAvailable()` 只依赖 `online.isAdmin === true`；不得读取 localStorage、URL 参数或客户端开关提权。
- 普通用户不渲染创建/打开按钮；`tournament_state` 只缓存，不自动打开。
- `openTournamentCreate()` / `renderTournamentState()` 自身再次检查；账号变更或非管理员 hello 后清理旧赛事弹层。
- 服务端协议与权限保持不变，文档明确这是产品可见性裁决。

## Brand Copy

- 主品牌文案强调快速开局、玩家相遇和持续成长，不承诺未实现能力。
- `home_six_games`、六款战绩和具体游戏事实不删除。

