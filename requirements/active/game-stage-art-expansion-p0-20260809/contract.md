# Game Stage + Tabletop Art Wave A Contract

状态：`FROZEN`

## Presentation authority

- Game Stage 是纯呈现消费者；在线席位真相源保持 `online.roomInfo.seats`，本地/AI 局使用当前实例既有玩家数量和标签。
- 不新增 WebSocket message、server field、profile field 或 snapshot field。
- `renderGameStage()` 可以被 `showGame()`、`room_update`、`host_changed`、`peer_status`、`rejoined` 后的既有客户端刷新路径调用；重复调用必须幂等，不重复创建 DOM ID 或事件监听。

## Stage structure

```text
#screen-game.game-stage
├─ #game-stage-header
├─ #game-stage-seats
├─ #game-stage-main
│  ├─ #board-area
│  └─ #game-stage-command
│     ├─ #status-bar
│     ├─ #online-banner
│     └─ #game-extra
└─ existing host/return/rules controls
```

- Tank/Tetris 使用 Arena-first 宽布局；棋盘类可在桌面显示侧栏，手机统一单列。
- Seat key 使用 seat/player index；昵称和用户文本只用 `textContent` / `data-i18n-raw`。
- 当前行动者、本人、Host、AI、READY、offline、spectator 使用稳定 class/data 属性，不把视觉状态写进游戏快照。

## Art runtime

- 总开关：`mg_art_tabletop_wave_a`；仅严格值 `'0'` 关闭，缺失/异常/其他值均默认开启。
- `tabletopArtEnabled()`、`markTabletopSurface()` 和样式注入是纯表现辅助，不持久化游戏状态。
- Wave A 不加载未审批 M0/P1/Honru Draft；既有资源失败与总开关关闭时回退当前 CSS/Canvas/DOM。
- Motion 仅 L0–L2；不新增常驻 `requestAnimationFrame` 或游戏计时器，遵守 reduced-motion。

## Coverage score

| Area | Weight | Wave A required |
|---|---:|---:|
| 六款大厅入口构图 | 12 | 0（保留现状，Wave B） |
| 共用 Game Stage / Seat / Status / Command | 16 | 16 |
| 六款棋盘/战场/井底材 | 18 | 18 |
| 六款核心棋子/单位/方块 | 18 | 18 |
| 六款关键动作状态 | 18 | 0（Wave B） |
| 六款控制/结算/观战精细美术 | 18 | 0（Wave B） |
| **Wave A total** | **100** | **52** |

只有默认可见、运行时已接入且测试通过的表现计分；source-only、默认关闭和报告截图不得计分。

## Honru UI removal

- 删除 `#chat-tab-honru`、`#honru-chat-view`、`#companion-form`、`#companion-input`、快捷问题、`#honru-dock`、`#btn-home-honru`。
- `#/chat?view=honru` 与未知 Chat view 归一到玩家消息，不发送 companion 请求。
- 删除前端 companion 对话历史、欢迎语、发送和事件绑定；保留签到协议、品牌资产和局内反应函数。
- 后端 `/api/companion`、净化和安全测试本轮保留为兼容边界，前端无可达入口。

## Failure / rollback

- 视觉异常：设置 `mg_art_tabletop_wave_a=0` 回退旧六款表现，不改变规则或在线房间。
- Stage 渲染异常：保持原 `player-bar/status-bar/board-area/game-extra` 可操作结构，不阻塞输入。
- Honru Chat 删除回滚只恢复前端入口；玩家私聊与签到数据不迁移、不删除。
- 整体回滚点：`2d91254c3bf82efb7033452b4c80cc044799e7e2`。
