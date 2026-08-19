# Art Approval Matrix 美术候选治理收口（2026-08-14 08:20）

## 一句话结论

状态：`LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`。本批把现有美术候选的审批状态、来源边界和运行时隔离统一成可检查的矩阵；`GATE-ART-GOLDEN-SET` 仍为 `BLOCKED`，没有把任何未审批图片上线或接入产品。

## 做了什么

- 新增统一审批矩阵，区分既有 fallback、仅源稿候选、默认关闭技术预览和外部仅参考素材四种状态。
- 固定人工清稿、Reviewer A、独立 Reviewer B、IP Similarity Review、用户 Golden Set、运行时/设备验收的先后顺序。
- 新增自动回归，防止未审批 Emoji、Tank 拒绝稿、Honru/角色/大富翁候选和外部素材进入运行时 Manifest、聊天协议或默认商城。
- 将两处外部素材目录继续冻结为 `reference-only / blocked-license`；只保留目录、哈希和审计事实，不复制、不解压、不上传。

## 用户现在能看到什么

- 用户暂时看不到网页或游戏画面变化。
- 后续挑选、清稿和接入美术时，可以准确知道每个候选是否只是草稿、技术预览、旧回退或仅作参考，不会因“技术可用”误变成默认上线。

## 还没做什么

- `NOT_EXECUTED`：人工可编辑清稿、小尺寸可读性检查、独立 Reviewer B、IP Similarity Review、用户 Golden Set 签字。
- `NOT_EXECUTED`：第二浏览器、Android、iPhone、Tablet、双主题、三语言、reduced-motion、性能与解码的候选级真实美术矩阵。
- `NOT_EXECUTED`：任何候选的运行时派生、Manifest 接入、商城默认项或线上发布。

## 验证

- `node qa/art-approval-matrix-contract.js`：`PASS`。
- `node qa/asset-library-governance.js`、`node scripts/asset-library-audit.js`：`PASS`。
- `node scripts/validate-project-state.js`、`npm run reports:progress`、`node qa/progress-ledger.js`、`node qa/mainline-control-plane.js`、`npm run quality:gates`、`npm test`（153.6 秒）、`git diff --check`：`PASS`。
- 双构建：`1,362,068 characters / 1,376,602 bytes / SHA-256 BFBD2109B77B1F4C5E070DAB6B98C806E25AD621ACBE3E2E83AD5C5FB7130CAE`，两次一致。

## 风险与下一步

- 风险：自动化只能证明隔离和文档一致，不能替代人工美术、IP 或真机可见判断；外部素材也没有授权结论。
- 下一步：继续 `CLOSE` 主线，优先复核默认关闭的 Gomoku Ghost3D 程序化纵切在当前本地构建中的可见、输入、fallback 和 reduced-motion 边界；正式美术仍须等待 Golden Set Gate。

## 发布状态

- `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`
- 未提交、未推送、未触发 GitHub Pages 或 Render。

## 追溯入口

- active task：`requirements/active/art-approval-matrix-p1-20260814/`
- 需求 ID：`TECH-031`、`ART-028`、`ART-030`
- 详细证据/报告：`requirements/ART_APPROVAL_MATRIX.md`、`qa/art-approval-matrix-contract.js`、`asset-library/catalog.json`、`public/assets/manifests/asset_manifest.json`
