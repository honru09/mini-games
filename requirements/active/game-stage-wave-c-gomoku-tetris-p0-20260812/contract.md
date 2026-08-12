# Wave C 五子棋 / Tetris 冻结合同

## Authority

- 五子棋继续使用既有 15×15 坐标、客户端规则与稳定快照。
- Tetris 继续使用既有 18×10 井、`tetris-rule-v3`、单写者与兼容回退。
- 所有 Wave C 状态均为 disposable presentation state，不参与胜负、计分、AI、协议或 Replay。

## Lifecycle

- 每个实例拥有独立 epoch/revision/timer 集；禁止跨实例共享可变过程状态。
- reset/restore/reconnect/destroy 清理所有 timer/tween，并拒绝迟到回调。
- terminal 为单调高优先级状态；迟到 snapshot 不得回退为普通行动阶段。
- `whenIdle()` 与 Replay 不等待装饰性过程 timer。

## Motion and layout

- 只动画 transform/autoAlpha，分步序列优先使用可清理 timeline；不得动画布局尺寸驱动核心玩法。
- reduced-motion 立即抵达稳定态，过程仍用文字、层级和静态强调可理解。
- 不使用 ScrollTrigger；离开 Game Shell 后不得继续后台动画。
- 全端 Arena、过程轨、HUD 和 44px 控件不得互相遮挡或造成 document 横向滚动。

## Failure and rollback

- 复用现有 Wave B/Wave A feature flag 与程序化 fallback，不新增网络发布顺序依赖。
- 动效不可用、localStorage 异常或表现初始化失败时，规则与输入仍可完整游玩。

