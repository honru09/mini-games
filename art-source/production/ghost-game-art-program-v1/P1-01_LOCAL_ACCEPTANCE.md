# P1-01 Monopoly Final Art v1 — 本地收口记录

日期：2026-08-21
状态：`IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`

## 已交付

- 23 个 source masters、46 个 WebP runtime variants（含 reduced-motion 静态变体）。
- 3 层棋盘、9 个建筑/道具原子、9 个语义 VFX、桌面/移动镜头资产。
- `resolveMonopolyFinalArtUrl()` 严格 Manifest/feature flag/fallback；Monopoly 只在表现层消费。
- 局内落点、机会、购买、支付/税、拍卖、结算反馈接入语义 VFX；DOM 仍承载标签、数值、产权与可访问文本。
- 受控色键派生后的洋红接触影中性化；Alpha/边缘/尺寸/字节/SHA 均写入 Manifest 并由专项 QA 校验。
- 修复局内响应式布局：桌面使用右侧 Command Rail，平板竖屏使用底部 HUD，手机/矮横屏显式区分 dice/actions/money/state/meta；棋盘成为 Arena 主视觉，避免隐式网格、重复信息所有权和命令叠压。
- 当前单一 Codex Chromium 五视口可见复核通过：1280×720、1024×768、768×1024、390×844、844×390；三层 decode、26 个语义棋盘节点、无横溢出、可见按钮均至少 44px。

## 未声称

第二浏览器、Android/iPhone/Tablet、真实网络、低端 FPS/GPU/热量、Supabase、人工清稿、Reviewer B、IP/法律、Golden Set、commit/push/Pages/Render/生产发布仍未执行。

## 回滚

将 `mg_art_monopoly_final_v1` 设为 `0`，或在 Manifest/fetch/decode 任一环节失败，即回退到原 Monopoly DOM/CSS/Canvas + P0-10 角色层。
