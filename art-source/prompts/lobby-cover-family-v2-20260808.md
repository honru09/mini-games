# Playroom 六款大厅封面统一风格 Prompt（2026-08-08）

## 生成与版权说明

- 工具：Codex 内置 `imagegen`（运行时托管模型，未在调用中指定模型名）。
- 来源类型：原创生成；未输入、复制或描摹第三方游戏资产。
- 许可标记：`project-owned-ai-generated`，实际使用同时受生成服务适用条款约束。
- 统一规格：软 3D 竞技玩具模型、暗色棚拍背景、左上 45° 主光、16:9 安全裁切、无文字/Logo/水印。
- 运行时：640×360 WebP；低带宽/窄屏：320×180 WebP；所有卡片保留 Emoji fallback。
- 本批只完成大厅封面，不代表飞行棋、大富翁、坦克和象棋的完整局内美术包。

## 最终采用 Prompt

### 五子棋（v2 风格升级）

> A clean floating warm-wood five-in-a-row arena with an orderly 15-by-15 intersection grid and a sparse, believable mid-game position using only glossy black and warm-ivory stones. Every stone is fully opaque, identical in size, physically separate, and centered on a grid intersection; one ivory stone is suspended above an empty intersection. Premium handcrafted soft-3D toy-model render, tactile lacquered resin and stylized wood, deep indigo studio background, upper-left 45-degree warm key light and cool rim light, 16:9, readable at 320×180. No transparent, partial, merged, deformed or overlapping stones; no text, labels, Chinese characters, logo, watermark, people, hands or room clutter.

定向修正：移除中心棋子之间的浅色半透明污迹，仅重建干净木质网格；不增删棋子。

### 飞行棋

> A premium original soft-3D tabletop diorama showing four red, blue, yellow and green toy aircraft racing from corner hangars toward a central runway, with one white dice in mid-bounce. Floating tabletop arena, deep navy-to-violet studio background, tactile painted resin and rounded edges, upper-left 45-degree light, warm rim light, bold silhouettes, 16:9 and readable at 320×180. No people, text, letters, numbers, logos, watermarks, brand characters or copied composition.

### 迷你大富翁

> A premium original soft-3D tabletop city diorama around a compact square property track, with a small red toy roadster, original miniature houses and hotels, one white dice in motion and plain unmarked gold coins. Deep teal-to-indigo studio background, handcrafted resin and painted wood, upper-left 45-degree key light, warm windows, cool rim light, 16:9. All tiles and coins must be completely unmarked; no text, letters, numbers, currency symbols, logos, watermark or branded board layout.

定向修正：清除棋格与硬币上的全部伪文字/雕刻，保持建筑、车辆、骰子、镜头和灯光不变。

### 坦克大战

> A premium original soft-3D toy battlefield diorama with one cobalt-blue and one warm-red tank maneuvering through a compact maze of chunky brick walls and steel blocks, one restrained shell streak and spark impact, and a protected geometric base. Floating modular arena, charcoal-to-forest studio background, high three-quarter top-down view, upper-left warm key light, friendly competitive tone, 16:9. No people, faces, text, numbers, emblems, real military insignia, gore, logo, watermark, excessive smoke or impossible tank parts.

### 俄罗斯方块（v2 风格升级）

> A polished soft-3D floating falling-block arena: a chunky transparent acrylic well on a compact dark toy platform, neatly stacked rounded translucent block clusters in six saturated colors, and one cyan T-shaped four-cube cluster descending above a valid gap. Premium handcrafted acrylic and resin, deep navy-to-indigo studio background, upper-left 45-degree warm key light and cool cyan rim, restrained geometric particles, centered 16:9 composition readable at 320×180. Exact cube geometry; no malformed, merged or loose blocks, text, score, logo, watermark, people or room clutter.

### 象棋

> A premium original soft-3D Chinese-chess tabletop diorama showing a tense late-game position on a river-separated grid with palace diagonals, using opposing round red and deep-teal lacquered wooden pieces. Pieces are completely blank and identified only by color, size and raised outer rings. Warm walnut board, dark studio tabletop, upper-left lantern key light, cool rim, 16:9. Absolutely no Chinese characters, pseudo-characters, calligraphy, text, letters, numbers, symbols, logo, watermark, copied board art or human figures.

## 文件映射

- 五子棋：`art-source/games/gomoku/mg_gomoku_cover_source_v02.png`
- 飞行棋：`art-source/games/ludo/mg_ludo_cover_source_v01.png`
- 迷你大富翁：`art-source/games/monopoly/mg_monopoly_cover_source_v01.png`
- 坦克大战：`art-source/games/tank/mg_tank_cover_source_v01.png`
- 俄罗斯方块：`art-source/games/tetris/mg_tetris_cover_source_v02.png`
- 象棋：`art-source/games/xiangqi/mg_xiangqi_cover_source_v01.png`

被拒绝的生成版本未进入仓库：五子棋首轮存在棋子重叠/半透明异常；大富翁首轮存在伪文字雕刻。
