# 简易报告历史归档

本目录保存已经结束、被新进度快照替代或只具有历史追溯价值的一次性报告。归档不是删除；原始内容、文件时间后缀和发布证据均保留。

## 目录

- `2026-08-08/`：旧交接、Gameplay Upgrade、视觉商城与 Sticker M0 等一次性报告。
- `2026-08-09/`：Ghost Game、Honru、Production Readiness、Game Stage、私聊/Profile、Immersive Game Shell 等收口报告，以及 2026-08-09 的七份进度快照。

## 规则

- 当前总进度、六分类最新快照和最新本地收口保留在 `简易报告/` 一级目录。
- 同一天的七份生成报告必须成组移动，避免相对链接断裂。
- 被 `sourceCatalog` 或其他文档引用的文件移动后，必须同步新路径并运行 `npm run test:progress-ledger`。
- 不删除历史报告；后续需要恢复时可按日期目录原路移回。
