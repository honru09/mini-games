# ECO-029 — Player Character Economy P1

状态：`REQUIREMENT_FROZEN`

时间：2026-08-10（Asia/Tokyo）

前置：`ECO-007`、`ECO-008`、`ECO-009`、`ECO-025`、`SOC-031`

## Goal

冻结一个小而深的服务端角色经济边界：角色服装/外观是可收藏、可装备、可公开展示的 presentation 数据，不能改变胜负、规则、AI、奖励、Replay 或排行榜。接口沿用现有 `commerceId`、服务端价格、`owned`、`equipped` 和 `requestId` 语义；客户端永远不能旁路写资产。

对应台账：`ECO-029`。本批为 **contract-first / local-only**：先冻结白名单、失败语义和未来集成 seam，再决定是否接入正式购买事务。

## IN

- 冻结 `player-character-economy-v1` 的私有状态形状、slot 白名单、非 Pay-to-Win 不变量和只读公开投影。
- 新建纯服务端模块，集中处理角色 commerce ID 目录、owned/equipped 规范化、requestId 形状校验、重复请求分类和公开投影；模块不计算价格、不扣币、不写数据库。
- 为旧账号、缺字段、未知/过期 ID、访客、污染对象、并发调用和重复 requestId 定义确定性 fallback。
- 保留已有 `player-character-v1` 公开字段与 `server/player-character.js` 默认值；没有经审批的角色资源时不激活新商品。
- 增加 `qa/player-character-economy-contract.js` 纯合同回归，验证模块边界和未来接入所需的注入 seam。
- 为 Master 提供 `SHARED_CHANGE_REQUEST.md`，说明正式购买/装备接入为什么需要后续 RPC/catalog parity 评审。

## OUT

- 不修改 `server/index.js`、`supabase/schema.sql`、Supabase RPC、`server/reward-engine.js` 或任何生产部署配置。
- 不新增商城 UI、三语言文案、图片、`art-source/`、`public/assets/`、运行时 Manifest、Monopoly 表现或六款游戏规则。
- 不把角色商品塞入 `avatars` 或 `game_cosmetics` 以绕过类别白名单；不复制价格表，不在纯模块中计算或预测扣款。
- 不接受客户端 `owned`、coins、price、equipped、playerCharacter 或 purchase history 作为权威写入。
- 不宣称正式购买、装备事务、真实 Supabase 并发/RLS、ART-036、美术审批或 GAME-045 已完成。
- 不 commit、push、Pages/Render 发布或部署。

## Non-negotiable

1. **Authority**：服务端现有商城/RPC 是价格、余额、owned 和 requestId 的唯一权威；本模块只能消费已确认的服务端结果，不能生成购买成功。
2. **Presentation only**：角色 slot 只影响公开外观投影。任何角色字段都不得进入规则状态、合法动作、胜负、奖励、AI 学习、Replay 或 Analytics。
3. **Stable IDs**：`player-character-v1` 的 schema、slot 名和 fallback 不变；未来商品必须使用整数 `commerceId`，并由服务端目录注册后才可见。当前没有可激活的角色商品目录。
4. **Privacy**：公开投影只含 `schemaVersion/characterId/slots`；不含 owned、coins、price、requestId、purchase history、token、PIN、密码或内部目录状态。
5. **Safe fallback**：未知 schema/ID、旧账号、访客、数组、原型污染键、超长值、未拥有装备、冲突/重复请求都回到独立的新默认对象，不抛异常、不修改输入。
6. **Idempotency seam**：requestId 继续使用现有正则 `^[A-Za-z][A-Za-z0-9_-]{7,120}$` 与最多 100 条有界历史；真正的原子扣款仍必须由既有购买 RPC 完成。
7. **Concurrency**：纯模块函数必须无共享可变状态、每次返回新对象；并发序列化、余额锁和远端幂等留给 Master 的服务端/RPC 集成。

## Known Existing Behavior / Blocker

- 当前 `server/index.js` 的 `SHOP_PRICES` 与本地购买路径已有价格/owned/requestId 权威。
- Supabase `apply_purchase_v1` 在 `supabase/schema.sql` 内硬编码四类基础商品和 `game_cosmetics` 的价格/类别；没有 `player_character` 分支，也没有角色专用列/RPC。
- `normalizeOwned()` 只保留现有五个数组键，普通 `profile` 也不会接受角色经济字段；P0 的 `player-character-v1` 目前只提供固定默认角色和只读投影。
- 因此本批可以安全交付纯合同/纯测试，但不能在不改 schema/RPC 或把角色商品错误归类的前提下宣称正式购买已接通。

## Completion Definition

- `requirements/active/player-character-economy-p1-20260810/` 六份执行文件齐全，状态和未执行边界一致。
- 纯模块与专项 QA 全部通过；无美术、规则、UI、Supabase schema 或部署差异。
- 正式购买/装备接入保持 `NOT_EXECUTED`，直到 Master 单独批准 catalog + RPC parity 变更。

