# TECH-031 素材库双层事实源简报（2026-08-14 00:00）

## 一句话结论

TECH-031 已完成本地素材治理收口：catalog 负责来源/许可/哈希/审批，Manifest 负责运行时唯一事实；reference-only 素材不会误进入网站，远端对象存储仍未开启。

## 做了什么

- 新增 `requirements/ASSET_LIBRARY_GOVERNANCE.md`，明确 catalog、Manifest、source-only/reference-only/integrated、remoteObjectKey 和回滚边界。
- 新增 `qa/asset-library-governance.js` / `npm run test:asset-library-governance`，复用现有 `scripts/asset-library-audit.js` 检查 34 个 catalog 资产、路径、状态和运行时交叉关系。
- TECH-031 更新为 `implemented`，同步 active task、状态、七份进度报告、简报和三份日志。

## 用户现在能看到什么

- 这次没有新增网页或游戏功能，也没有生成/上传图片。
- 已通过人工审批前的 Honru/Emoji/Avatar/游戏候选继续留在 `art-source` 的 reference-only/source-only 区域，不会进入默认运行时或商城。

## 还没做什么

- `NOT_EXECUTED`：远端对象存储 Provider、CORS、生命周期、备份、成本和真实上传；人工清稿、Reviewer B、IP Review、Golden Set。
- `BLOCKED`：真实 Supabase、设备、网络和生产发布 Gate 仍保持阻塞。
- 本批没有修改 Manifest、运行时图片、规则、协议、经济或数据库。

## 验证

- `npm run test:asset-library-governance`：PASS（治理专项 + `ASSET_LIBRARY_AUDIT_ALL_PASS`，34 个 catalog 资产）。
- `npm run reports:progress` / `node qa/progress-ledger.js` / `node qa/mainline-control-plane.js`：PASS。
- `npm run quality:gates`：PASS（含素材、性能、Bug Intake、ADR、简报和纵切合同 Gate）。
- 完整 `npm test`：PASS（146.8 秒）。
- `git diff --check`：PASS。
- `node scripts/build.js`：PASS；`public/index.html` 1,353,257 字符 / 1,367,874 字节，SHA-256 `2E466A3B59CEC8B7B1323DC6FD61375395E2497BE8C837C0D01A789D02731E93`。

## 风险与下一步

- 风险：本地 catalog/Manifest 不能替代远端对象存储的访问、备份和成本验收，也不能替代人工 Golden Set。
- 下一步：继续 CLOSE 的具体视觉/交互项；进入 DATA/ART Gate 后再决定是否远端存储或启用候选。

## 发布状态

- `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`
- 未提交、未推送、未触发 GitHub Pages 或 Render；线上保持 `bd49e6d` / `da3d05c` 基线。

## 追溯入口

- 需求：`TECH-031`。
- 合同：`requirements/ASSET_LIBRARY_GOVERNANCE.md`。
- QA：`qa/asset-library-governance.js`、`scripts/asset-library-audit.js`、`npm run test:asset-library-governance`。
- active task：`requirements/active/asset-library-governance-p1-20260813/`。
