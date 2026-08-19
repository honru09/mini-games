# P0-02 Platform Scenes v1 — Prompt 与来源

生产单元：`P0-02`  
稳定 Runtime family：`P-PLATFORM-SCENES-V1`  
来源母族：`ART-PLATFORM-SCENES-V1`  
Artwork version：`1`

## 视觉 North Star

本族只遵循项目所有者已确认的 M0 North Star：Ghost Game 的浅色云海、深色星场、玻璃与微光，以及 Ink / Paper / Cream 的 Pocket Tabletop 线条、厚边和软阴影。该方向是项目自有视觉约束，不是任何外部 Q 版 UI、PSD、AI 或 RPG 素材的像素、图层、构图或角色来源。

## 生成与派生方式

本批使用项目自有、确定性的 SVG 几何母层，由 `scripts/generate-platform-scenes-v1.js` 派生 WebP。没有读取、导入、复制、描摹、换色、裁切或作为生成输入使用任何 `EXTERNAL_REFERENCE_ONLY / blocked-license` 文件；也没有通过外部素材恢复任何不可追溯 Prompt。

生成器：`scripts/generate-platform-scenes-v1.js`  
生成命令：`node scripts/generate-platform-scenes-v1.js`  
详细逐文件 SHA、bytes、尺寸、Alpha 与角色见同目录 `asset-family-manifest-v1.json`。

## Prompt 规范（确定性绘制 brief）

```text
Use case: stylized-concept
Asset type: layered platform atmosphere for a web game shell
Primary request: original Ghost Game route atmosphere for Home, Games, Room, and Playline
Scene/backdrop: project-owned cloud/sky or deep-space field with a quiet tabletop signal layer
Subject: route-specific abstract tokens, cards, room seats, or social signal nodes; no characters or copy are required
Style/medium: deterministic flat SVG geometry with thick Ink outlines, Paper/Cream surfaces, soft layered depth
Composition/framing: independent 1920x1080 desktop and 900x1200 mobile compositions; preserve a readable HTML safe area
Lighting/mood: light is airy and calm; dark is deep-space and low-glare; route motion stays subtle
Color palette: Ink #211923, Paper #FFF9F2, Cream #F3E5C4, Teal #39B9B2, Blue #508BF0, Purple #8656CF, Gold #F1B640, project night tokens
Materials/textures: simple paper, glass, signal paths, cards, tokens, and soft ground shapes; no baked labels
Text (verbatim): none
Constraints: original project-owned geometry only; far layer opaque; mid/foreground layers alpha-capable; no text, logos, trademarks, watermarks, or external references; desktop/mobile must remain independently readable
Avoid: external Q-style UI/PSD/AI/RPG pixels, copied compositions, traced characters, crowded motion, and gameplay facts in background art
```

## 资产分层

- `far`：不透明环境底层，始终可独立显示。
- `mid`：路由主题对象和信号层，保留真实 Alpha，可轻微 transform 漂移。
- `foreground`：近景装饰与舞台边缘，保留真实 Alpha，可轻微 transform 漂移。
- `static`：far + mid + foreground 的同尺寸合成，作为 reduced-motion 与运行时失败的同族回退。
- `poster` / `mini`：640×360 低带宽预览；`saveData` 时只取 poster。

所有文字、路由标题、房间事实、玩家身份、游戏状态和无障碍说明继续由 HTML / i18n 提供；背景层 `aria-hidden`。

## 许可与隔离

许可：`project-owned-deterministic-vector`。外部素材台账仍为 `EXTERNAL_REFERENCE_ONLY / blocked-license`，不在本批来源链内，不进入 Runtime Manifest，也不构成相似性输入。

