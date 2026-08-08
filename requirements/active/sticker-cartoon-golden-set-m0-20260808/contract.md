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

## Review gates

- Art Bible Review → Golden Set Style Review → IP Similarity Review → Integration/Performance/A11y → Feature Flag Release。
- 任一 Gate 失败都回到上一阶段，不扩大批量生产范围。
