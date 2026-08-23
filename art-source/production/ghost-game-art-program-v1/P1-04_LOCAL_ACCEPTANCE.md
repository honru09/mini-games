# P1-04 Xiangqi Final Art v1 本地集成与验收记录

## 1. 生产单元概况

- **单元编号**: `P1-04`
- **资产族 ID**: `G-16-XIANGQI-FINAL-ART-V1`
- **源资产 ID**: `ART-040-XIANGQI-FINAL-ART-V1`
- **功能开关**: `mg_art_xiangqi_final_v1`
- **最终状态**: `implemented_owner_cleared_release_evidence_pending`
- **交付内容**:
  - 25 个 SVG 矢量母版（3 层棋盘 + 14 款棋子 [7 红 + 7 黑] + 6 类语义特效 + 2 组相机预设）
  - 50 个 WebP 运行时变体（25 个标准版 + 25 个静态版），总字节数 870,410 bytes（~850 KiB，远低于 6 MiB 预算）
  - 1 张 5x5 接触表评审图 (`review/xiangqi-final-runtime-contact-sheet-v1.png`)
  - 纯净 2.5D 原生渲染运行环境，完全移除所有已退役 `ghost3d` 依赖

## 2. 自动化验收证据

- `node scripts/generate-xiangqi-final-runtime-v1.js`: `XIANGQI_FINAL_ART_GENERATION_SUCCESS`
- `node qa/xiangqi-final-art-contract.js`: `XIANGQI_FINAL_ART_CONTRACT_ALL_PASS`
- `npm run test:art-approval-matrix`: `PASS`
- `npm run test:asset-library`: `PASS`
- `npm run test:external-asset-register`: `PASS`

## 3. 架构与合规确认

1. **纯净 2.5D**: 彻底清理了 `public/src/games/xiangqi.js` 中的 700+ 行 `ghost3d` 残留代码；
2. **所有者授权**: 资产完全由项目内确定性代码与 Sharp 离线生成，零外部受限许可像素进入运行时；
3. **安全降级**: 默认启用 `mg_art_xiangqi_final_v1`，在图像加载失败或被关闭时无缝回退至 Canvas / Tabletop 原生绘制；
4. **规则与表现解耦**: XiangqiRules v2 状态机、时钟控制、将死判定与联机同步逻辑维持独立。

## 4. 2026-08-22 接管修复

- 修复初始化函数从未调用、棋盘 URL 从未绘制、Manifest VFX 角色与运行时 allowlist 不一致导致整族永久 fallback 的问题。
- 当前 `7BCA9218…F41DF2` 构建已在单一 Chromium 的 1280×720、390×844 与 visible reduced-motion 中确认 `xiangqi-final-art-v1` 为 `active`，棋盘三层与 14 类棋子进入 Canvas，横向溢出与 console warn/error 均为 0。
- 证据：`requirements/active/visual-25d-repush-p0-20260819/evidence/current-build-tetris-xiangqi-final-art-20260822.json`。第二浏览器、物理真机、真实网络和低端性能仍是发布证据待决。
