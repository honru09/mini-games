# Honru Pixel Avatar v3 · Reviewer A 技术审查

结论：`SOURCE_ONLY / TECHNICALLY_CANDIDATE / NOT_RUNTIME_APPROVED`

## 通过项

- 四个角色母图和 Alpha 候选均为 1254×1254；Alpha 候选为 8-bit RGBA，四角透明，适合作为后续清稿输入。
- explorer/night-cadet/stargazer 的 `alpha-v2` 关闭了会污染暖色配饰的洋红 despill；builder 使用修复后的 `source-v2`，`alpha-v9` 为当前领先去背景候选。
- 眼睛符号、Ghost Game 控制器身体、黑白高对比和像素网格在原图中可辨识；当前不依赖远程 URL、不写入 runtime manifest。
- `v1`、builder `v3`–`v7` 等中间候选均留在 source tree，QA 只允许明确的领先候选通过，避免目录扫描误选。

## 保留风险

- 仍存在像素边缘的奶油色 sticker halo、局部细小毛刺和缩小后可读性风险；静态 Alpha 合同不能替代人工清稿。
- Alpha 候选尚未经过 44/64/96/192px 真机对比，也未检查所有主题背景上的边缘对比。
- 四款候选目前主要依赖围巾颜色与小配饰区分，缩小后轮廓差异可能不足；Golden Set 前需要增加剪影层级的差异化审查，不能只看 1254px 母图。
- 生成模型输出的像素网格是否完全符合最终 Art Bible 需要人工逐点确认；不能把“技术合格”写成“美术完成”。

## 门禁

Reviewer B、IP Review、Golden Set 用户决议、正式 artworkVersion、Manifest/Catalog 接入和默认开启均保持 `NOT_EXECUTED`。回滚点是继续使用现有代码原生/线上 fallback，不删除任何历史 Avatar ID。
