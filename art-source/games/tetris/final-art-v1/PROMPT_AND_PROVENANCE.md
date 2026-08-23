# P1-03 Tetris Final Art v1 提示词与资产来源记录 (PROMPT_AND_PROVENANCE.md)

## 1. 资产族定义

- **Family ID**: `G-11-TETRIS-FINAL-ART-V1`
- **Source Asset ID**: `ART-037-TETRIS-FINAL-ART-V1`
- **生产单元**: `P1-03`
- **许可策略**: `project-owned-deterministic-svg-sharp`
- **运行策略**: `Vanilla DOM + CSS + Canvas + GSAP 2.5D; no GLB/Three dependency`
- **Feature Flag**: `mg_art_tetris_final_v1` (默认开启，支持可逆回退)

## 2. 视觉规范与调色板

采用 Ghost Game Tabletop Cream / Ink 2.5D 设计系统：
- **纸张底色**: `#FFF9F2` (paper)
- **米黄基调**: `#F3E5C4` (cream)
- **墨黑描边**: `#211923` (ink)
- **阴影暗部**: `#D6C19A` (shade)
- **方块色系**:
  - `I` 方块: `#5EAAA2` (teal / cyan)
  - `O` 方块: `#E8B654` (amber / yellow)
  - `T` 方块: `#9A7BB5` (purple)
  - `S` 方块: `#72C4A2` (mint / green)
  - `Z` 方块: `#D96B59` (coral / red)
  - `J` 方块: `#7596B2` (blue)
  - `L` 方块: `#E6864C` (orange)
  - `Garbage` 垃圾行: `#34363B` (steel / slate)
  - `Ghost` 幽灵块: 半透明带虚线边框

## 3. 资产构成 (25 Source Masters / 50 Runtime Variants)

### 3.1 三层舞台 (Board Layers, 1056×720)
1. `board-background`: 日式纸质纹理背景，带浅色坐标网格与几何装饰。
2. `board-midground`: 主操作井与对手迷你井底衬、Hold / Next 队列托盘。
3. `board-foreground`: 主井外沿浮雕边框、顶部警告槽与光影层。

### 3.2 方块原子与框架 (Object Atoms, 512×512, transparent)
- `object-block-i`, `object-block-o`, `object-block-t`, `object-block-s`, `object-block-z`, `object-block-j`, `object-block-l`
- `object-block-ghost`: 幽灵落点投影块
- `object-block-garbage`: 带有工业斜纹与重质阴影的垃圾方块
- `object-well-frame`: 主井 10×18 物理边界边框
- `object-next-frame`: Next 队列外框
- `object-hold-frame`: Hold 暂存外框

### 3.3 语义特效 (Semantic VFX, 512×512, transparent)
- `vfx-line-clear`: 消行爆炸光斩
- `vfx-hard-drop`: 急坠硬降冲击光波与地面扬尘
- `vfx-t-spin`: T-Spin 旋转旋涡流光
- `vfx-b2b`: Back-to-Back 黄金连击徽印
- `vfx-combo`: 连击火花星爆
- `vfx-perfect-clear`: 全清黄金光芒与徽标
- `vfx-incoming-garbage`: 垃圾行上涨预警红光槽
- `vfx-ko`: KO 淘汰漫画冲击爆破

### 3.4 镜头预设 (Camera Roles)
- `camera-desktop`: 1280×720 宽屏居中
- `camera-mobile`: 720×960 竖屏紧凑

## 4. 来源与透明度守卫

- 所有运行时资产由 SVG 矢量生成，保持纯净 Alpha 通道。
- 任何没有真实透明度的外部概念图片均标记为 `rejected for runtime`，确保不会污染运行时渲染层。
