# Honru Expression Kit v1 验收标准

- 九个状态目录、命名、Prompt、来源、任务 ID、hash、尺寸和派生图一一对应。
- 每个 Alpha 为 RGBA、四角透明、无明显绿色污染；三色归并只使用 Ink/Paper/Cream。
- 44px 至少保留 Honru 轮廓与控制器双眼，64px 可读主要情绪；无文字、道具、水印或第三方角色痕迹。
- 素材库条目全部 `reference-only`，`remoteObjectKey=null`，路径只在 `art-source/`，不进入线上 Manifest。
- 运行时预备合同使用独立 flag，默认关闭；状态字段不进入规则快照、AI、联机协议、奖励、商城或账号。
- `node scripts/asset-library-audit.js`、`npm run validate:project`、`npm run quality:gates` 和完整 `npm test` 通过。
- 未完成人工风格/IP审查前，状态保持 `HUMAN_REVIEW_REQUIRED` / `DO_NOT_SHIP`。
