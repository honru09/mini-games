# Theme Contrast Design System P1 本地实现收口

时间：2026-08-12 16:40（Asia/Tokyo）

## 已完成

- 平台运行时 CSS 主题收敛为 `light/dark`；旧存储主题继续迁移，未知值安全回到 light。游戏 Cosmetic 中名为 `cyber` 的皮肤没有被误删。
- 新增可计算的 surface、text、accent、border、focus、disabled、status、icon、overlay、glass 与 toast 语义令牌；代表性实色文字达到 4.5:1，焦点和边界达到 3:1。
- Button、Input、Dialog、Toast、Header/Nav、Auth、Shop、DM、Profile、Room 共用语义层；disabled 不再只靠 opacity，焦点不再只靠透明光晕。
- 登录 Logo 明确 light 原色、dark 反白，PWA 顶栏跟随场景色。
- Premium Background 使用自己的 light/dark textTone；Game Stage Ink/Cream 不随平台主题重绘。

## 主负责人审核纠正

- 删除的只是旧 `html[data-theme]` 主题选择器，保留飞行棋/Tank 等 `cyber` 商品与皮肤选择器。
- 修正未知主题值被一律判成 dark 的旧行为。
- 将玻璃卡片实际使用的共享边界 token 也纳入 3:1 数值合同。
- 终审发现测试一度放宽 Game Stage dark 覆盖，已恢复严格合同并删除该平台主题改色。
- 自动化只能证明不透明 token 与静态结构；玻璃、渐变和图片背景的真实可见对比仍不冒充通过。

## 验证

- `npm run test:theme-contrast`、三语、DOM、响应式、Ghost Shell、Premium Background、Game Stage 与 Tabletop Runtime 均通过。
- `npm run quality:gates` 全部通过。
- Game Stage 独立性修正后的完整 `npm test` 已通过，耗时 189.0 秒；此前的一次性 Windows 临时文件锁未复现。
- `npm run quality:gates` 已通过；两次确定性构建一致：1,333,571 characters / 1,348,120 bytes / SHA-256 `ED29E547F6D6E4475D21414E0979479DB619AA019FC4952AD484D8668008CC66`。
- Terra Max（`gpt-5.6-terra`, `max`）独立终审重试因 429 超过重试限制，未形成可采纳结论；主负责人已完成代码、边界和全链审核，未将 reviewer limit 写成审查通过。

## 尚未完成的外部门禁

- 真实浏览器的 light/dark × 三语可见矩阵、半透明玻璃/渐变/图片背景实际计算对比。
- forced-colors/high-contrast、visible reduced-motion、第二浏览器、Android/iPhone/Tablet、真实网络与低端 FPS。
- 未 commit、push 或部署；线上仍是 `da3d05c`。
