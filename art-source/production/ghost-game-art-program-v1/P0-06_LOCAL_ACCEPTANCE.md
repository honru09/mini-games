# P0-06 本地核销 — Gomoku Final Art v1

状态：`IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`

- `18` source masters：4 board / 5 piece / 7 VFX / 2 camera。
- `36` runtime variants：normal + static；`477,912` bytes，预算 `4 MiB` 内。
- 已接入：独立 Manifest resolver、board CSS material、5 套实际 piece image lazy decode（Canvas fallback 保留）、7 个语义 VFX overlay、desktop/mobile camera family、reduced-motion static 路径、feature flag 与销毁清理。
- 已保护：规则、合法落子、snapshot、Replay、Ghost3D authority、AI、奖励、协议与社交状态不读图；加载/解码/Manifest/flag/late-result 失败回退既有 Wave A/M0/Canvas/CSS/程序化 Ghost3D。
- 机器源/Runtime/SHA/尺寸/Alpha/预算与接触表证据：同目录 `asset-family-manifest-v1.json`、`TECHNICAL_REVIEW_Reviewer_A.md`、`OWNER_AUTHORIZED_ART_CLEARANCE.md`。
- 本地构建、专项 QA 与共享回归完成后，浏览器跨设备、第二浏览器、真机、真实网络、生产 Supabase 与发布仍保持 `RELEASE_EVIDENCE_PENDING`，不触发 commit/push/Pages/Render。

