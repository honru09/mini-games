# M0 视觉与运行时契约

## Stable IDs

- `commerceId`、`runtimeId`、owned、equipped 与服务端价格保持不变。
- `artworkVersion` 独立递增；允许通过 feature flag 回滚到 legacy/soft-3d fallback。

## Authority

- 游戏规则、坐标、命中、结算、奖励和联机状态由现有规则层/服务端决定。
- Asset Manifest 负责运行时路径、variant、fallback、load 和完整性；Asset Library 只记录 provenance/license/source，不覆盖运行时真相。

## Failure behavior

- 图片、动画、字体或可选运行库加载失败时回退到现有 Canvas/CSS/DOM/Emoji，仍能开始和完成对局。
- reduced-motion、低性能或页面离屏时使用 poster/静态状态，不阻塞输入。

## Compatibility

- Avatar `0–55` 与 `100–147`、Premium Background `20–31` 及六款游戏 runtime ID 不变。
- 视觉切换不改变 WebSocket 消息、resultId、matchId、奖励幂等、重连或 Supabase schema。

## Owner clearance and optional review

- M0 North Star → 稳定 ID/版本/SHA/provenance → 机器技术/视觉/相似风险审查 → Integration/Performance/A11y → fallback/feature flag/回滚 → `OWNER_AUTHORIZED_ART_CLEARANCE`。
- 人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 为 `OPTIONAL_ADVISORY_EVIDENCE`，可提出返工或风险但不阻塞原创资产开发；任何未执行咨询都不得伪造 PASS。
- 任一机器必备项或所有者清除失败都回到上一阶段，不扩大批量生产范围；`blocked-license / EXTERNAL_REFERENCE_ONLY` 永不进入此轨道。

## Golden Set frozen selection

- Persona：`teacher`，固定 `idle / think / confident / surprised / win / lose / taunt / recover` 八状态。
- Avatar：`commerceId 100 / 117 / 124 / 141`，分别验证人类、无脸场景、动物和机械非人兼容形态；只递增 `artworkVersion`。
- UI：Button / Card / Modal / Room Seat / Shop Card / Avatar / Badge / Toast 全状态。
- 游戏：五子棋与飞行棋的棋盘、棋子、状态、动效、结算完整纵切。

## Rollback flags

- 总闸门：`mg_art_sticker_m0_v1`。
- 分闸门：`mg_ui_sticker_v1`、`mg_persona_sticker_v1`、`mg_avatar_golden_v1`、`mg_art_gomoku_sticker_v1`、`mg_art_ludo_sticker_v1`。
- 每个具体候选取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 前保持 `defaultEnabled=false`；取得清除后可作为可逆 default-on 候选，所有旗标仍必须支持一键关闭并完整回退现有 soft-3D / CSS / Canvas / DOM / Emoji。任何发布仍需用户当前明确命令。
