# P2-11 Local Acceptance

- Unit: `P2-11 / P-SHOP-LIMITED-SETS-V1`
- State: `implemented_owner_cleared_release_evidence_pending`
- Runtime: 商城新增四季 Ghost-native 策展卡（春日信号、夏潮航线、秋灯典藏、冬夜观测），每套只引用既有头像、头像框、效果与背景单品 ID；显示精确 `N/4` owned 进度、只读组合预览，并可跳转既有单品 Tab。
- Art: 使用原创 GPT Image 2 / Codex imagegen 主视觉 `seasonal-vault-hero-master-v1.png`，以 Sharp 确定性派生桌面、移动和 poster WebP；Manifest、SHA、尺寸、bytes、feature flag、fallback 与回滚链已登记。外部 Q 版/PSD/RPG 库仅作为 `EXTERNAL_REFERENCE_ONLY / blocked-license` 库存上下文，未传输像素/图层，未进入 Runtime。
- Economy boundary: “限定”只表示本地视觉策展，不表示真实限时销售。没有套装 SKU、`bundle/purchase_set`、套装价格、折扣、库存、倒计时、Remote Config、Battle Pass、新 owned 或自动批量购买/装备；四件单品仍逐件走既有购买路径。
- Shared repair: 发现服务端 `SHOP_PRICES` 与 Supabase `apply_purchase_v1` 白名单漂移后，已补齐 111 项目录同构、保留服务端权威价格，并为异步同步失败增加稳定 `purchase_sync_failed` 回执；没有新增 P2-11 经济事实。
- UX/i18n: 三语标题、免责声明、四季名称、浏览入口与 owned 进度；双主题、窄屏 44px、reduced-motion、decode/Manifest/flag 失败均回退既有商城与代码原生色块。
- Machine evidence: `npm run test:shop-limited-sets`、`node qa/shop-contract.js`、`node qa/shop-purchase-feedback-contract.js`、`node qa/ui-shop-layout-contract.js`、`node qa/shop-language-refresh-contract.js`、`node qa/supabase-schema.js`、`node qa/shop-supabase-catalog-parity.js`、`node qa/code-health-sweep.js`、`npm run test:i18n`、`node scripts/build.js --check`。
- Local visible evidence: 同一 Codex In-app Chromium 已在桌面默认视口检查 4 张陈列卡、poster decode、组合预览与单品入口，并在 390×844 检查双列卡片、4×171px 宽度、零横向溢出与 44px 操作；证据见 `P2-11_BROWSER_VISIBLE_ACCEPTANCE.json` 与 `shop-limited-sets-browser-390x844.png`。
- Build: `public/index.html` 2,143,263 characters / 2,158,021 bytes / SHA-256 `438BFFCDF8D04FA34BEC717596CCF4DA68CC6372D900BA0342C0944CBA09F8DF`；此前中间构建身份不得作为当前证据。
- `NOT_EXECUTED`: 当前构建商城完整浏览器矩阵、第二桌面浏览器、物理 Android/iPhone/Tablet、真实网络整形、低端 FPS/GPU/热量、真实 Supabase 生产迁移/并发/备份/恢复，以及 commit/push/Pages/Render。
- Next: `P2-12 / P-PROFILE-ADAPTIVE-HERO-V1`；P2-07 仍为冻结的可选实验。
