# Honru Runtime Integration P2 合同

## Flags

- 总闸门：`mg_art_honru_states_v1`。
- 游戏挂载分闸门：`mg_art_honru_game_reactions_v1`。
- 仅当两个 localStorage 值都严格为字符串 `1` 时启用；默认均不存在。

## Manifest and assets

- `P-HONRU-STATES-V1` 是唯一运行时资产组，九状态使用稳定 state ID 和版本化 WebP 路径。
- 旧 `P-002-HONRU-MASCOT-V1` 继续作为 fallback；状态资源失败、解码失败或旗标关闭时回退 v1/不渲染。
- 首次运行时只加载当前状态；不得预加载整组九状态或其他游戏高分辨率资源。

## Presentation API

```text
honruStatesEnabled() -> boolean
honruStatePath(stateId) -> versioned path | null
triggerHonruGameReaction(kind, context?) -> void
```

允许的状态映射：`tap/move/place/capture/score/win/lose/think/waiting/invite/check-in` → 九个状态 ID。`context` 只能是表现元数据，不得写入规则/协议/奖励。

## Lifecycle and failure

- 反应节点只能挂在 `board-area` 表现层；`destroy`、换局、离开游戏时清理节点和计时器。
- 不使用持续 Canvas 循环；静态 PNG/WebP + CSS/WAAPI，reduced-motion 时取消动画。
- 错误、异常存储、不可见页面或不支持图片时保持旧游戏表现并静默回退。

## Rollback

- 删除任一旗标或设置为 `0` 即回到当前线上表现。
- 删除 `P-HONRU-STATES-V1` Manifest 条目与 public 预览目录即可回滚；不触碰 v1/v2 母图。
