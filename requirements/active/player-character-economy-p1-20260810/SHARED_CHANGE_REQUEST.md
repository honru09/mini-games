# Shared Change Request — ECO-029

## Requested future Master changes

本批不直接修改高风险共享文件。若要把角色商品从合同推进到正式购买，Master 需另行评审并实现：

1. `server/index.js`：引入纯适配器，注册 `player_character` 商品目录，保证价格只来自服务端，购买成功后才把已拥有 commerceId 映射到 `playerCharacter.slots`。
2. `supabase/schema.sql`：扩展 `apply_purchase_v1` 的 category/expected-price 白名单，或建立等价版本化 RPC；保留账号锁、requestId 幂等和经济流水。此项违反当前 ECO-029 子批的“不改 schema”边界，不能由本任务偷偷完成。
3. `qa/security-online.js`、`qa/supabase-adapter.js`、`qa/game-cosmetic-profile.js`：增加价格伪造、访客、旧账号、并发、重复 requestId、公开字段隔离和跨实例回归。

## Why integration is blocked

当前 Supabase RPC 只识别 `avatars/frames/effects/backgrounds/game_cosmetics`，且 `normalizeOwned()` 会丢弃未知类别。把角色商品借道既有类别会让商品语义与旧客户端冲突，也无法保证远端价格一致；本批因此只交付纯合同和默认关闭的目录。

## Consumer / impact

- Consumers after approval: Profile/Seat public projection and future GAME-045 presentation only.
- Never consumers: shared rules, Authority, reward resolver, AI learning, Replay, analytics, UI assets.
- Compatibility: no message/schema changes in this batch; existing profiles remain byte-compatible.

## Test and rollback

- Current evidence: `qa/player-character-economy-contract.js` (pure); `node --check`.
- Future integration must pass security, Supabase adapter/schema, reconnect and E2E suites before enabling any catalog item.
- Rollback is catalog-off / remove adapter; no existing asset or economy data migration is required for this contract-only batch.

