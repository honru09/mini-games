# P0-02 本地核销 — Platform Scenes v1

状态：`IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`

## 本地实现结果

- Runtime family：`P-PLATFORM-SCENES-V1`
- Runtime variants：80
- Source masters：48
- Review boards：4
- Runtime bytes：1,259,316 / 4,194,304（约 30.03%）
- 机器技术证据：100%
- 本地代码接入：100%
- 修复后浏览器可见证据：0%（`NOT_EXECUTED`；连接器曾报 kernel asset 写入错误）
- 真机 / 第二浏览器 / 真实网络：0%（共享 Gate 保持 `RELEASE_EVIDENCE_PENDING`）
- 发布：0%（没有用户当前发布命令）

## 已接入

- `public/src/core/06-assets.js`：Manifest allowlist、五个独立 flag、路由/主题/视口选择、poster/static fallback。
- `public/src/core/02-app-shell.js`：三层 decode-before-activate、迟到结果隔离、visibility pause、Game Stage pause、save-data/reduced-motion 分流。
- `public/src/core/01-utils.js`：主题切换刷新场景。
- `public/src/ui/07-roster.js`：Games Library / Room route 选择。
- `public/index-template.html`：far / mid / foreground 图层、层级、动效、forced-colors 与 reduced-motion CSS。
- `public/assets/manifests/asset_manifest.json`：Runtime allowlist 与 owner clearance 条目。

## 证据

- `art-source/platform/scenes/signal-worlds-v1/asset-family-manifest-v1.json`
- `art-source/platform/scenes/signal-worlds-v1/PROMPT_AND_PROVENANCE.md`
- `art-source/platform/scenes/signal-worlds-v1/TECHNICAL_REVIEW_Reviewer_A.md`
- `art-source/platform/scenes/signal-worlds-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md`
- `qa/platform-scenes-contract.js`

专项命令：`npm run test:platform-scenes`。

