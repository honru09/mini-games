# P1-04 Xiangqi Final Art v1 所有者授权与资产清除记录

结论：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_VISIBLE_VERIFIED / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`

- **家族标识**: `G-16-XIANGQI-FINAL-ART-V1`
- **生产单元**: `P1-04`
- **源资产标识**: `ART-040-XIANGQI-FINAL-ART-V1`
- **资产授权模式**: 全部 25 个 SVG 矢量母版与 50 个 WebP 变体均为项目内自主实现，不包含任何外部未授权受限素材。
- **清除边界**:
  1. 绝不覆盖 ImageGen source-only PNG，保持原始参考历史记录；
  2. 运行时完全由确定性 SVG + Sharp 转换为 WebP，严格隔离 `EXTERNAL_REFERENCE_ONLY / blocked-license` 外部素材；
  3. `mg_art_xiangqi_final_v1` 开关默认启用，支持运行时一键回退到 CSS/DOM 棋盘与 Canvas 棋子兜底；
  4. 象棋权威规则、XiangqiRules v2 状态机、时钟控制、着法验证、将死裁决、Replay、奖励与联机同步逻辑与表现层完全解耦，不受美术装配影响。
- **证据状态**:
  - `OPTIONAL_ADVISORY_EVIDENCE`: 本地单浏览器与自动化门禁验证通过。
  - 未执行：跨多浏览器真机、生产环境 Supabase 部署与商业化发布。
