# playroom-doc-sync

## 原则

代码、测试和线上事实优先于白皮书旧描述。先读取实现与证据，再更新 README、AGENTS、WHITEPAPER、requirements、
实施报告和 `PROJECT_STATUS.json`。

## 状态词

统一使用 `planned`、`partial`、`implemented`、`verified`、`production-ready`、`not_executed`、`blocked`。
真实设备/真实 Supabase 未执行时，必须保留 `not_executed`，Release Candidate 可因此为 `blocked`。

## 验收

文档事实变更必须同步三份中文日志；不要为了让文档“看起来完成”而修改代码状态或隐藏已知限制。
