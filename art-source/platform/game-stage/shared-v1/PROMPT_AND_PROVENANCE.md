# P0-03 Shared Game Stage Art v1 — Prompt 与来源

生产单元：`P0-03`  
稳定 Runtime family：`P-GAME-STAGE-SHARED-ART-V1`  
源 ID：`ART-GAME-STAGE-SHARED-ART-V1`  
Artwork version：`1`

本批是 Ghost-native 的统一 Pocket Tabletop 舞台包：Paper/Cream 台面、Ink 厚边、四角状态灯和九个无文字语义事件 VFX。仅由项目自有 SVG 几何确定性派生 WebP；不读取、复制、描摹、裁切、换色或作为生成输入使用外部 Q 版 UI/PSD/AI/RPG 素材。

```text
Use case: stylized-concept
Asset type: shared game-stage surface, frame and semantic event VFX
Primary request: original Pocket Tabletop shell for six Ghost Game stages
Scene/backdrop: Cream/Paper tabletop with Ink border and restrained signal lights
Subject: surface, frame and nine abstract event marks; no characters or baked copy
Style/medium: deterministic flat SVG geometry to WebP runtime
Composition/framing: 1280x720 surface/frame; 256x256 transparent event atoms
Lighting/mood: warm tactile tabletop, clear status emphasis, short-lived event focus
Color palette: Ink #211923, Paper #FFF9F2, Cream #F3E5C4, Teal, Blue, Purple, Green, Gold, Coral
Text (verbatim): none
Constraints: project-owned geometry only; no logos, trademarks, watermark, baked labels or gameplay facts; 2D fallback remains authoritative
Avoid: external reference pixels, traced characters, noisy permanent particles and any rule/protocol/reward coupling
```

`stage_enter`、`ready`、`turn_start`、`accepted_move`、`capture`、`warning`、`reconnect`、`terminal`、`reward` 由 Presentation/Motion Adapter 消费；规则、Authority、协议、Replay、奖励与经济只产生语义状态，不读取图像。

