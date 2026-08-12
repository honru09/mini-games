# Control Plane Reset P0：Ghost Game 主线分类与共享 Gate

状态：`REQUIREMENT_FROZEN`

## Goal

把 `PRODUCT_REQUIREMENTS_LEDGER.json` 的 242 项原子需求放进唯一可审计的主线路由：`NOW_CLOSURE`、`EXTERNAL_GATE`、`DEFERRED_MAINLINE`、`FUTURE_EXPANSION`。把高扇出外部依赖收敛为设备/浏览器/网络、Supabase 生产、人工美术 Golden Set 三条共享 Gate，并用语义 QA 阻止“静态实现被写成可见验证”或“历史报告覆盖当前状态”。

## IN

- 新总指挥入口与 2026-08-12 当前阶段顺序。
- `requirements/MAINLINE_CONTROL_ROUTING.json` 的四类路由、九阶段顺序和三条共享 Gate。
- 242 项唯一需求的单一路由覆盖、Gate 扇出计数和 TECH-027 当前 `Transport closed` 缺口。
- 七份 2026-08-12 自动生成进度报告的主线路由/Gate 视图。
- 控制平面语义 QA 与本地日志/状态证据。

## OUT

- 不新增玩家功能或 Requirement ID。
- 不改 Rule、Authority、Protocol、Replay、Reward、AI、Economy、Social 数据模型。
- 不解除真实设备、真实 Supabase 或人工美术 Gate。
- 不把 `npm`、DOM、静态合同或历史线上截图当成最新视觉/真机证据。
- 不 commit、push、触发 GitHub Pages 或 Render。

## Non-negotiable

- 原子需求仍只以 `PRODUCT_REQUIREMENTS_LEDGER.json` 为事实源；路由只是执行顺序。
- 每个 ID 必须且只能有一个主线路由。
- `EXTERNAL_GATE` 只能引用三条共享 Gate，不能按需求复制出第四条外部门禁。
- `FUTURE_EXPANSION` 不得隐藏 P0/P1 当前收口事项。
- `TECH-027` 的当前连接器失败保持 `partial`，修复并补最新可见证据后才能恢复 `verified`。

