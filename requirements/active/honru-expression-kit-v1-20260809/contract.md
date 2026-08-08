# Honru Expression Kit v1 资产与接入合同

## Identity

- 状态 ID 只能来自：`idle`、`thinking`、`surprised`、`win`、`lose`、`recover`、`waiting-invite`、`check-in`、`playful`。
- 所有状态必须保留幽灵/手柄同体、左十字眼、右四圆眼三项识别点。

## Source and authority

- 母图 authority：`art-source/brand/ghost-game/honru/v2/honru-character-master-v2-flat-transparent-draft-v1.png`。
- 状态源、Alpha、派生图和 provenance 只存 `art-source/brand/ghost-game/honru/states-v1/`。
- `asset-library/catalog.json` 仅记录来源与审计，不产生 runtime authority；本批状态为 `reference-only`，`remoteObjectKey=null`。
- 未来运行时若启用，必须由独立 Manifest 条目和 `mg_art_honru_states_v1` 旗标解析，默认关闭。

## Technical invariants

- ImageGen built-in → 均匀 `#00ff00` 色键 → 官方 `remove_chroma_key.py` → RGBA Alpha → 三色归并。
- Alpha 必须四角透明、无可见绿色污染；派生图尺寸为 192/96/64/44px。
- 资产不得写入游戏状态、联机协议、AI 学习、奖励结算、商城 owned/equipped 或 i18n 文案。

## Failure and rollback

- 生成/Alpha/审计失败：保留源和失败证据，状态不登记为可用；运行时只回退 v1/程序化占位。
- 任一旗标缺失、非字符串 `1`、资源 404/解码失败、销毁后异步回调，均必须安全关闭并回退。
- 删除本任务目录与 source-only Catalog 条目即可完整回滚；不影响 v1/v2 母图。
