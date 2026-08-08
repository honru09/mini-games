# Change Request：六主题收敛为昼夜双主题

日期：2026-08-09（Asia/Tokyo）

## 原因

Ghost Game P0 已冻结运行时主题为 `light|dark`。继续让 Golden Set M0 以六主题作为验收矩阵，会同时制造文档漂移、不可执行的 QA 和未来美术返工。

## 变更

- `design-tokens.v1.json` 的主题键收敛为 `light` 与 `dark`。
- Art Bible、需求、验收、计划、执行状态与 IP Review 模板改为“双主题 × 三语言 × 五宽度”。
- 旧 `midnight/ocean/forest/cyber/sakura` 仍由平台兼容映射读取，但不再是 Golden Set 的运行时产出或验收维度。
- 商品背景、游戏皮肤与玩家身份色不是平台主题，不因本变更删除或重编号。

## 不变项

- Ink、轮廓、比例、材质、光向、组件结构、规则坐标、commerceId、owned/equipped 与 artworkVersion 契约不变。
- M0 仍等待人工 Art Bible、双人 IP Review、运行时 feature flag 集成和真实设备验收。

## 验收与回滚

- `node qa/sticker-art-contract.js` 必须验证恰好存在 `light|dark`。
- 完整 `npm test` 不得出现主题或资产合同回归。
- 若回滚 Ghost Game 双主题，需同时回滚本 Change Request、平台 THEME_LIST 与全部主题 QA；禁止只恢复文档中的六主题文字。
