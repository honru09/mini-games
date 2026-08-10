# Player Character P0 — 独立玩家虚拟形象公开合同

状态：`REQUIREMENT_FROZEN`

时间：2026-08-10（Asia/Tokyo）

## Goal

建立独立于 Honru、Logo、头像、头像框、背景和闪名的玩家虚拟形象合同。P0 只交付稳定、可迁移、可回退且不泄露私有经济信息的服务端白名单公开投影，为后续大富翁行走纵切、坦克基地和棋盘指挥官表现提供唯一消费接口。

对应台账：`SOC-031`。后续依赖顺序：`SOC-031 → ECO-029 / ART-036 → UI-037 / GAME-045`。

## IN

- 新建纯计算深模块，集中维护 schema version、角色/装备 slot、白名单、默认值、规范化和公开投影。
- 账号档案持久结构可保存服务端规范化的 `playerCharacter`；旧档案无字段时无损补默认值。
- 本人完整档案和公开 Profile 只返回当前装备的稳定 ID；房间公开 Seat 可携带同一安全投影供后续游戏表现消费。
- 客户端只缓存、转发和读取公开投影；没有审批资源时使用程序化/确定性 fallback。
- 三语言只在未来出现可见文字时新增，本阶段 ID 不直接显示给玩家。

## OUT

- 不制作或接入角色位图、3D/GLB、服装素材、商城商品、价格、购买/owned/equip mutation。
- 不修改大富翁规则、位置、骰子、拍卖、奖励、Replay、AI、碰撞或服务端动作协议。
- 不把 Honru 当玩家虚拟形象，不把头像 ID 当角色 ID，不广播 owned、余额、价格、购买历史或 session 信息。
- 不提交、不推送、不部署；不宣称 ART-036、ECO-029、UI-037 或 GAME-045 已完成。

## Non-negotiable

- 服务端是公开投影的唯一权威；客户端不能用 Profile mutation 免费伪造未授权装备。
- 外部接口保持小：`normalizeStored()`、`publicPresentation()` 与固定目录常量；迁移、白名单、去私有字段和 fallback 隐藏在模块内。
- `schemaVersion` 与 slot 名稳定；未知版本、未知 ID、畸形对象和污染属性均回退默认值。
- 所有公开消费者只能收到白名单 ID；永不收到 owned、coins、xp、price、purchaseRequests、token/password/PIN。
- 旧账号、访客、AI、观众和断线重连均有确定性 fallback；本阶段不改变权限或游戏结果。

## Known Existing Behavior

- Seat/Profile 已公开 Avatar/Frame/Effect/NameFx/Lang 和六款 `gameCosmetics` ID，并隔离私有经济字段。
- 大富翁当前用 `car/character` Emoji 棋子、`visualPos` 逐格移动和 reduced-motion 直接落点；联机 v2 位置由服务端 Rule Core 权威。
- 目前没有独立玩家虚拟形象 schema、公开合同或美术资源。

## Expected UX

本阶段不会用一个图标冒充完成。用户可见的大富翁角色行走留给后续独立纵切；P0 完成后，所有消费者能从同一安全接口获取同一角色和装备 ID，即使资产缺失也能稳定回退，不会因登录、重连、观战或旧档案出现不同身份。
