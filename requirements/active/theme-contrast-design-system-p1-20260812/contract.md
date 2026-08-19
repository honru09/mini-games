# Theme Contrast Design System P1 冻结合同

> 时间：2026-08-12（Asia/Tokyo）  
> 主需求：`UI-007`  
> 状态：`COMPLETED_LOCAL_PENDING_EXTERNAL_GATES / LOCAL_ONLY`

## IN

- 只治理平台外壳的 `light / dark` 双主题 token 与组件语义：主/次文字、玻璃表面、边框、按钮、输入、焦点、disabled、状态色、图标和遮罩。
- 为 token 及代表性组件建立可执行的双主题对比合同；普通文字目标至少 WCAG AA 4.5:1，大字号/粗体至少 3:1，焦点与非文本边界至少 3:1。
- 清理仍把 `ocean / forest / cyber / sakura / midnight` 当运行时主题的旧选择器；旧存储值继续只通过 `normalizeTheme()` 映射为 light/dark。
- 登录、Header、Home、Games/Lobby、Playline/Direct Message、Profile、Shop、Dialog/Toast 使用同一语义 token，不以页面级硬编码补丁重复解决。
- Profile Premium Background 和 Game Stage 自有 Ink/Cream 舞台继续保持主题独立；只校验其遮罩/文字合同，不把平台主题色烘焙进个人背景或局内舞台。

## OUT

- 不修改游戏规则、Authority、协议、Replay、Reward、AI、经济、Supabase 或持久数据。
- 不接入或重绘 UI-037/ART-036/GAME-045、Honru、Emoji、G Coins 或其他未审批美术。
- 不新增主题，不恢复旧六主题，不改 Premium Background 商品 ID/素材，也不扩张 GSAP/Three runtime。
- 不用静态 CSS/VM 合同冒充最新浏览器、第二浏览器、真机或人工视觉验收。
- 不提交、不推送、不部署。

## Ownership

- 主负责人串行：`public/index-template.html`、`public/src/core/01-utils.js`、`package.json`、`scripts/quality-gates.js`、生成产物、台账/状态/报告/日志。
- Terra Max 仅做只读勘察与独立审查，不与主负责人同时修改热文件。

## 验收 seam

- `qa/theme-contrast-design-system.js`：双主题唯一运行时、token 完整性、数值对比、代表性组件 token 化、焦点/disabled、主题独立区域与旧主题清理。
- `npm run test:i18n`、`node qa/dom-smoke.js`、`node qa/ghost-shell-contract.js`、`node qa/ui-responsive-contract.js`、`npm run quality:gates`、`npm test`。
- 两次构建字符数、物理字节与 SHA-256 一致。

## 外部门禁

- 最新浏览器可见 light/dark/三语矩阵、第二浏览器、Android/iPhone/Tablet、真实网络、visible reduced-motion、forced-colors/high-contrast 和低端性能为 `NOT_EXECUTED`，必须继续归入 `GATE-DEVICE-BROWSER-NETWORK`。
- 线上保持 `da3d05c`。

## 本地收口事实

- `light/dark` 现统一声明实色 surface/text/accent/border/focus/disabled/status/icon/overlay/glass/toast 语义令牌；代表性实色组合通过 WCAG 数值合同。
- 旧 `midnight/ocean/forest/cyber/sakura` 运行时 CSS 选择器已清零；`normalizeTheme()` 继续迁移旧存储值，未知值安全回到 `light`。游戏 Cosmetic 中名为 `cyber` 的皮肤完整保留。
- Button/Input/Dialog/Toast/Header/Nav/Auth/Shop/DM/Profile/Room 共用主题令牌；焦点与 disabled 不再只依赖透明光晕或 opacity。
- 登录 Logo 显式 light 原色/dark 反白，PWA browser chrome 与 Ghost 场景色同步。Premium Background 使用 `premium-bg-light/dark` textTone；Game Stage Ink/Cream 不再随平台主题重绘。
- `qa/theme-contrast-design-system.js` 已进入 pretest、完整 test 与 Fast Quality Gates。自动化、三语、DOM、响应式、完整 `npm test` 与双构建通过，但不替代下列外部门禁。
