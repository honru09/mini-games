# P0-04 Modal Header Illustration v1 — Prompt 与来源

生产单元：`P0-04`  
稳定 Runtime family：`P-MODAL-ILLUSTRATION-V1`  
源 ID：`ART-MODAL-ILLUSTRATION-V1`  
Artwork version：`1`

27 个通用弹窗/状态语义使用项目自有的无文字透明几何母图：认证入口、旧账号迁移、房间创建/加入、邀请、等待、房主转移、重连、房间关闭、规则、新手教程、退出确认、胜利、失败/平局、奖励、升级、成就、Profile 等待/比较、商城购买、余额不足、安全保护、连接失败、Playline 空态、私信空态、赛事和 Replay。

```text
Use case: stylized-concept
Asset type: transparent modal header illustration
Primary request: original no-text semantic illustration for Ghost Game modal/state copy
Scene/backdrop: transparent canvas with a compact centered symbol or object
Subject: one semantic gesture/object, no characters or external composition
Style/medium: deterministic flat SVG geometry with Ink outline, Paper fill and semantic tone color
Composition/framing: 512x512 source; 160/240/320 square runtime; generous safe margin
Lighting/mood: neutral, success, warning or error tone without embedding state text
Text (verbatim): none
Constraints: project-owned geometry only; no logos, trademarks, watermark, external reference pixels or baked copy; HTML/i18n remains authoritative
Avoid: copied Q-style UI/PSD/AI/RPG layers, dense details, tiny text and modal-specific business facts
```

运行时只在表现层通过语义 ID 解析；失败时回退同族 neutral 变体，再回到原有 CSS/HTML/Unicode。

