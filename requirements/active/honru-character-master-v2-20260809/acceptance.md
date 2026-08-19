# Honru v2 验收标准

- 只包含一个完整 Honru，无额外角色、道具、Logo、文字、伪文字或水印。
- 幽灵身体与手柄握把是同一低频轮廓；顶部最多三段主要圆润火苗；手部结构清楚且不多指、不粘连。
- 左眼为清晰十字方向键，右眼为四个清晰圆键；友好小弧笑，不使用尖牙或复杂口腔。
- 仅使用 Ink/Paper/Cream 黑白体系与两级平涂；无 PBR、塑料高光、软 3D、写实火焰、Bloom、漂浮粒子或复杂纹理。
- 色键源背景完全均匀，Alpha 候选为 RGBA、四角透明、主体边缘无明显绿色污染。
- 192/96/64/44px 派生图可生成；64px 仍读出左右控制器眼和幽灵手柄剪影，44px 至少保留身份轮廓。
- Prompt、参考图角色、内置 ImageGen、追踪 ID、尺寸、SHA-256、许可和本地路径完整记录。
- 当前 v2 候选在未取得逐族 `OWNER_AUTHORIZED_ART_CLEARANCE` 时只登记为 `reference-only`，`runtimePaths` 不指向 `public/`；现有 v1 和运行时 Manifest hash 不变。补齐稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险、fallback、feature flag 与回滚并取得 clearance 后，可进入可逆 default-on runtime 候选。
- 技术自动化与所有者清除不得冒充人工/IP PASS。人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，缺失不得阻塞开发或 runtime。
- 外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁用；第二浏览器、真机、真实网络和生产证据保持 `RELEASE_EVIDENCE_PENDING`，发布仍须当前用户明确命令。

Historical-as-of（2026-08-09）：旧验收规定 Reviewer B 和用户预览决定前不得接入运行时。该 candidate-only/default-off 人工前置仅保留为审计历史，不覆盖 2026-08-16 owner-clearance 政策。
