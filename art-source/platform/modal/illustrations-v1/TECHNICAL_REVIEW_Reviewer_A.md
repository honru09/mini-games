# P0-04 Modal Header Illustration v1 — 机器技术审查（Reviewer A）

状态：`TECHNICAL_PASS / OWNER_AUTHORIZED_ART_CLEARANCE_CANDIDATE`

- 27 个 512×512 SVG source masters。
- 324 个 WebP Runtime（27 semantics × 4 tones × 3 sizes：160/240/320）。
- 4 张 tone contact sheets。
- Runtime 总计 `2,112,306` bytes，预算 `8,388,608` bytes，约 `25.18%`。
- 所有 Runtime 透明 Alpha；无文字、无外部引用、无动态 GIF/视频。
- Manifest 绑定 `mg_art_modal_illustration_v1`、source ID、clearance record、allowlist、SHA/bytes 与 static/HTML fallback。
- `mountModalIllustration()` 在 `showModal()` 创建时按语义解析，加载/解码失败不阻塞弹窗，销毁后不激活迟到结果。

本记录只覆盖机器技术、路径、尺寸、Alpha、预算、Manifest 与生命周期，不冒充人工清稿、Reviewer B、IP/法律、Golden Set、真机或发布证据。

