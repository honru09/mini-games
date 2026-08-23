# P1-02 Tank Final Art v1 — Owner Authorized Art Clearance

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / IMPLEMENTED_LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`

## 清除范围

依据当前主线 `GATE-ART-GOLDEN-SET = OPEN_BY_OWNER_AUTHORIZATION`，下列项目自有运行时资产获得所有者授权清除：

- `G-12-TANK-FINAL-ART-V1` artwork version 1；
- 25 个确定性 SVG source masters；
- 50 个 Manifest-backed WebP variants；
- contact sheet、provenance、机器技术/视觉/相似风险证据；
- `mg_art_tank_final_v1` 可逆 default-on 本地接入。

授权只覆盖 `project-owned-deterministic-svg-sharp` 运行时族，不覆盖 ImageGen source-only PNG，也不改变任何外部文件的许可。

## 外部素材边界

外部 Q 版 UI/PSD/AI/RPG 相关输入继续是 `EXTERNAL_REFERENCE_ONLY / blocked-license`。它们可按用户授权的受控全信息 reference lane 提供给已授权 Skill，但不会因此变为项目自有、可发布或可直接运行的素材。完整输入与传输证据见 `EXTERNAL_REFERENCE_TRANSMISSION.json`。

## Runtime 条件

- Manifest、稳定 ID/version/SHA/bytes、清除记录、fallback 和 feature flag 必须同时成立。
- 所需资产必须完整 resolve 并 decode 后才激活；部分成功不得混用。
- 运行时只影响 Tank 的 DOM/CSS/Canvas 2.5D 表现，不改变规则、权威、协议、预测、奖励、经济或持久数据。
- `localStorage.mg_art_tank_final_v1 = '0'`、Manifest/网络/decode 失败或 destroy 均回退现有 CSS/DOM/Canvas/Emoji。
- 当前状态是 `LOCAL_ONLY_NOT_RELEASED`；未授权 commit、push、Pages、Render 或生产发布。

## 证据口径

人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 属于 `OPTIONAL_ADVISORY_EVIDENCE`，当前未执行，不阻塞本地开发与可逆 runtime，但不得伪造为已完成。第二浏览器、真机、真实网络和低端 FPS 仍是 `RELEASE_EVIDENCE_PENDING`。
