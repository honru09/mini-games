# Ghost Game 素材库双层事实源合同

Ghost Game 的素材事实分为两层：

- `asset-library/catalog.json` 是来源/许可/作者/哈希/尺寸/Prompt/审批/远端对象键的治理索引，母图在 `art-source/`。
- `public/assets/manifests/asset_manifest.json` 是运行时唯一事实，只能引用已经允许进入 runtime 的 `integrated*` 资产和安全路径。

## 状态边界

`reference-only` / `blocked-license` 只能留在 source/preview/reference 目录，不能进入生产 Manifest、商城默认项或运行时开关；`integrated-local-only` 才能通过本地 runtime 交叉校验。没有 Provider、桶、CORS、生命周期、备份和凭证合同前，`remoteObjectKey` 必须为 `null`，storage 保持 `local-only`。

## 每项必填审计

资产必须有稳定 ID、分类、来源路径、source/preview SHA-256、尺寸、作者、许可、状态、runtimePaths、Prompt/模型（生成素材）和远端对象键字段。集合还必须独立记录 catalog/许可证文件哈希；不得用 hashPath 替代真实 catalogPath。

## 变更与回滚

新增或替换素材先更新治理索引和 provenance，再生成/校验 Manifest；任何文件缺失、哈希漂移、路径越界、许可不明、机器风险审查失败或尚未取得逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE` 时回退到旧 runtime/fallback。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 是可选咨询，缺失不得阻塞原创资产清除或 runtime；`blocked-license / EXTERNAL_REFERENCE_ONLY` 可按用户授权的受控全信息 reference lane 进入任务相关 Skill，逐输入登记路径、hash、provider、model、taskId、transmissionScope，但不得直接进入 runtime。远端对象存储的真实生产证据保持 `RELEASE_EVIDENCE_PENDING`，不阻塞本地合同、可逆预览或回滚准备。
