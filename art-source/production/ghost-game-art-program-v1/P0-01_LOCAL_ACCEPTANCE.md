# P0-01 本地实现与验收记录

状态：`IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`

日期：2026-08-17（Asia/Tokyo）  
生产单元：`P0-01 认证页主视觉与启动 Loading`

## 已实现

- 5 个稳定 Runtime Asset ID、48 个 runtime variants。
- Light/Dark × Desktop/Mobile Auth 背景；8 个 Auth Honru 场景；2 个 Boot Honru 场景；6 枚状态 SVG；Light/Dark Splash；192/512 Maskable PNG。
- Auth、Boot、First Start、状态图标、Web App Manifest 与 Service Worker 本地接入。
- Auth/Boot 四个浏览器内资产族使用双级 default-on flag、Manifest allowlist、来源 ID/clearance record 校验、decode-before-activate、迟到结果隔离和既有资产 fallback。
- PWA 安装面使用静态 Web App Manifest；实际回滚是恢复既有 any-purpose icon 路径和 HTML/CSS 启动壳，不冒充 localStorage flag 能改变已安装系统图标。
- 外部 Q 版 UI/PSD/AI/RPG 保持 `EXTERNAL_REFERENCE_ONLY / blocked-license`，没有作为图像、脚本或 runtime 输入。

## 机器与本地合同结果

以下命令均为 PASS：

- `npm run test:auth-art`
- `node scripts/asset-library-audit.js`
- `node qa/asset-library-governance.js`
- `node qa/art-approval-matrix-contract.js`
- `node qa/external-asset-register-contract.js`
- `node qa/asset-manifest-v2.js`
- `node qa/pwa-offline-i18n.js`
- `node qa/dom-smoke.js`
- `node qa/bootstrap-shell-lifecycle.js`
- `node qa/forced-colors-auth-contract.js`
- `npm run test:i18n`

专项 QA 实际解析 VP8/VP8L/VP8X、PNG palette+tRNS/Alpha、SVG 活动内容、Maskable 全画布不透明和中心 80% 安全圈，并检查 CSS 使用已定义的 `--ghost-scene`，防止背景文件已加载但 computed `background-image` 仍为 `none` 的回归。

## 当前确定性构建

- `public/index.html`：1,982,386 characters / 1,997,009 bytes。
- SHA-256：`2C8D4F8B28255C15358C81122DFF9BE0479A0FD4DF3A75F8EAAB02A2CD95F1F1`。
- Runtime Manifest：24 个资产，SHA-256 `560FFEAF024FE9C426DCEC6E05B93AFADB27321FE097966C2CBCA3D8749400F9`。
- Governance Catalog：42 个资产，其中 15 个 `integrated-local-only`、27 个 `reference-only`；SHA-256 `94324FF950A7208C8CB8D7DDE8FD8B2187D6B9BA3D389F1AE5998308E5608E33`。

## 可见证据边界

独立审查在修复前的本地 Chromium 中发现过真实缺陷：Auth 页面虽已进入 `auth-art-ready` 且 CSS var 指向正确 WebP，但未定义的 `--bg-primary` 令 computed `background-image` 为 `none`。该根因已改为项目已定义的 `--ghost-scene`，并加入专项回归。

修复后的浏览器复验未执行：Codex Browser 连接器连续两次在初始化前返回 `failed to write kernel assets: 系统找不到指定的路径 (os error 3)`。因此本记录不声称修复后截图、第二浏览器、真机、真实网络或跨平台 PWA 裁切已经完成。按照 `GATE-DEVICE-BROWSER-NETWORK`，这不阻塞后续可验证开发，但发布状态继续为 `RELEASE_EVIDENCE_PENDING`。

未执行 commit、push、Pages、Render、生产数据写入或发布。
