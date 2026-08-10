# Tabletop Presentation M1 Action Presentation 冻结合同

1. 动画/反馈只能消费已经接受的标准逻辑动作；不得改变 `snapshot`、`serialize`、`sendMove`、Replay 或结果结算。
2. 五子棋冲击必须有 reduced-motion 静态降级，且定时器在重开、恢复、离开和 destroy 后不可回调旧实例。
3. 飞行棋移动表现使用标准 `movementPath`，起飞/碰撞/到达表现不改 52 格规则和 pid；视角只改变 `tokenPoint` 的几何位置。
4. 表现失败或环境不支持时保持程序化 fallback；不读取未审批素材，不阻塞玩家输入或回合。
