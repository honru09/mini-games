# P0-03 Shared Game Stage Art v1 — 机器技术审查（Reviewer A）

状态：`TECHNICAL_PASS / OWNER_AUTHORIZED_ART_CLEARANCE_CANDIDATE`

- 11 个 SVG source masters：surface、frame 与 9 个事件原子。
- 22 个 WebP Runtime：每个原子均有正常与 `-static` 变体。
- Runtime 总计 `165,048` bytes，预算 `2,097,152` bytes，约 `7.87%`。
- surface/static 为不透明 WebP；frame 与全部事件为真实 Alpha WebP。
- 1 张 960×720 接触表；复合板只作审查，不冒充 Runtime atom。
- Manifest 绑定单一 `mg_art_game_stage_shared_v1` flag、source ID、clearance record、路径 allowlist、bytes/SHA 与 fallback。
- `refreshGameStageArt()` 在舞台激活时 decode-before-activate；`emitGameStageVisualEvent()` 对迟到结果、加载失败、reduced-motion 与销毁有 fail-closed 回退。

专项自动化应覆盖：22 条路径、SHA、bytes、尺寸、Alpha、Manifest、9 个事件名、舞台 surface/frame CSS var、VFX overlay、语义事件映射、清理和 reduced-motion。真实浏览器/设备证据仍独立保持 `NOT_EXECUTED` / `RELEASE_EVIDENCE_PENDING`。

本记录不冒充人工清稿、Reviewer B、IP/法律意见、Golden Set 或发布批准。

