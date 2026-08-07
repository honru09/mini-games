# playroom-release

## Release Gate

按 `requirements/QUALITY_GATES.json` 顺序运行 Syntax、Static、Gameplay、Protocol、Security、Reconnect、DOM、E2E、
Visual Smoke、Build Drift、Docs/Assets/Status Sync。

## 完成声明

必须列出 commit、changed files、每个 gate 的证据、Visual/Manual QA、NOT_EXECUTED、known issues、回滚提交和线上 URL。
`npm test` 通过仍不等于真实设备或真实 Supabase 通过。

## 发布安全

先审计 staged diff 和 secret，再 commit/push；Render key 只通过环境变量注入；发布失败保留旧 live deploy 并记录状态。
