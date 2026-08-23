# Profile Adaptive Hero P2-12 本地收口简报（2026-08-22 17:55）

## 一句话结论

P2-12 已完成本地表现层：Profile Hero 会根据玩家既有 `played/wins` 聚合突出常玩游戏，叠加原创 Ghost-native observatory 主视觉与四个确定性 WebP 派生，并复用游戏图标、Premium Background、Player Character 与身份资产；没有新增经济、协议或持久化事实。

## 做了什么

- 用 `played × 2 + wins × 3` 选出主游戏，平分按胜场、局数和冻结游戏顺序稳定裁决。
- Hero 右上角展示主游戏图标，身份区展示本地化“常玩焦点”、主场名和局数/胜场摘要。
- 六款游戏拥有独立色调 token；无历史记录显示三语空态。
- 生成一张原创 Profile Hero 主视觉，并确定性派生 desktop/mobile/poster/static 四个 WebP；复用已有资产与回退链。reduced-motion、forced-colors、移动窄屏和 44px 原有操作保持。

## 用户现在能看到什么

登录后进入 Profile，玩家有历史局数时，Hero 会自动突出最常玩的游戏；点击原有编辑/商城按钮不受影响。新账号会看到引导空态，开始游戏后自动出现主场焦点。

## 还没做什么

第二浏览器、Android/iPhone/Tablet 真机、真实网络、低端性能、生产 Supabase 和线上发布仍未执行；P2-07 GLB Character Prop Expansion 继续冻结。

## 验证

`npm run test:profile-adaptive-hero`、`npm run test:i18n`、Profile/Responsive 合同、`npm run quality:gates`、完整 `npm test` 与 `node scripts/build.js --check` 已通过。最终构建为 `2,154,257 characters / 2,169,019 bytes / SHA-256 07A04A98B01E650A1BE1FD3A2898A31DA94C1FECA05E3D3B748AD9DC24854861`。

## 风险与下一步

当前可见证据仍主要是本地机器合同，需在 PROVE 阶段补第二浏览器、真机和真实网络。下一主线是外部证据准备，不恢复旧 Three/Ghost3D 或 P2-07。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`；未 commit、push、GitHub Pages、Render 或生产数据写入。

## 追溯入口

`art-source/platform/profile-adaptive-hero-v1/`、`art-source/production/ghost-game-art-program-v1/P2-12_LOCAL_ACCEPTANCE.md`、`public/src/core/02-app-shell.js`、`public/src/core/06-assets.js`、`qa/profile-adaptive-hero-v1.js`。
