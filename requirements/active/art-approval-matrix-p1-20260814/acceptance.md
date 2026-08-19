# Art Approval Matrix P1 验收

> **Historical policy note（historical-as-of，2026-08-16）：** 本文中的旧 `BLOCKED`、人工美术、Reviewer B、IP/法律与逐资产 Golden Set 表述仅代表本文形成时的历史快照，不覆盖当前权威政策。原创 Ghost-native 资产满足 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可进行可逆 `default-on` runtime 接入；人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE`，未执行时须如实保留且不得冒充 `PASS`。设备/第二浏览器/真实网络与 Supabase Gate 当前为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁止复制、派生、作为生成输入、接入 runtime 或发布。任何接入结论均不授权发布，commit、push、Pages、Render 或生产发布仍须当前用户明确命令。

| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| TECH-031 | COMPLETED_LOCAL | `requirements/ART_APPROVAL_MATRIX.md`、`qa/art-approval-matrix-contract.js` | 增加审批可追溯，不改变双层事实源。 |
| ART-028 | COMPLETED_LOCAL | `requirements/ART_APPROVAL_MATRIX.md`、`qa/art-approval-matrix-contract.js` | 外部与内部候选状态统一，仍不授予授权。 |
| ART-030 | COMPLETED_LOCAL | `requirements/ART_APPROVAL_MATRIX.md`、`qa/art-approval-matrix-contract.js` | 明确 source/runtime/preview 的审批边界，未产生派生物。 |
| GATE-ART-GOLDEN-SET | OPEN_BY_OWNER_AUTHORIZATION | `requirements/MAINLINE_CONTROL_ROUTING.json` | 原创资产逐族完成 OWNER_AUTHORIZED_ART_CLEARANCE 后可逆接入；人工/IP/Golden Set 为可选咨询。 |

## Known Issues

- 人工清稿、Reviewer B、IP Similarity Review 与用户 Golden Set 仍为未执行的可选咨询；真实设备矩阵仍为发布证据待决。
- 既有默认关闭技术预览是明确例外，不可写为默认开启美术审批。

## Final Local Verification

- [x] 审批矩阵、Catalog、运行时 Manifest 和外部来源登记已由 `qa/art-approval-matrix-contract.js` 交叉检查；未审批 Emoji、Tank 拒绝稿、source-only 候选和外部素材均不能被误接入。
- [x] 原创 14 族在 G Coins P1 加入后为 247/247 文件并按全文件哈希固定；212 PNG 进入逐族接触表、2 SVG 以哈希及同族可见 PNG 复核，32 Markdown 与 1 HTML 全文读取。该证据不冒充人工清稿或 Golden Set。
- [x] `PROJECT_STATUS.json`、原子需求台账、生成进度报告、中文简报和三份根日志同步记录真实本地边界。
- [x] 状态、进度、主线、质量、完整回归和构建漂移检查均已通过；本批为 `COMPLETED_LOCAL_POLICY_RECONCILED`，共享 Art Gate 为 `OPEN_BY_OWNER_AUTHORIZATION`，但不自动清除具体候选或授权发布。
- [x] 未提交、未推送、未触发 GitHub Pages 或 Render；没有更改 `public/assets`、Manifest、运行时代码或外部素材本体。

## Rollback

删除本批治理文档/QA/简报和相应日志记录；不删除候选、fallback、Catalog 或 Manifest。
