# T7 Match Protocol 深模块合同

## Interface

```js
const boundary = createMatchProtocolBoundary({ adapter, now });
boundary.command({ type, room, session, player, payload });
boundary.transition({ type: `${game}_transition`, room, session, payload });
```

`command` 只处理 `tetris_action`、`xiangqi_action`、`monopoly_action`；`transition` 只处理对应三套 v2 Authority 的 `advance()`。未知消息返回冻结 `{ handled:false }`。

## Adapter

- JSON runtime Adapter：`read/write` 读取本进程边界 journal；由 `server/index.js` 注入发送、广播、指标、审计、结算和 timer stop 回调。
- isolated memory/runtime Adapter：同一 `load/save/commit` Interface，状态与输入对象脱离，供合同回归使用；不冒充生产持久化。
- `commit()` 预校验 effect vocabulary，按 `metric → turn/audit → broadcast → terminal settle/stop` 顺序执行；失败返回分类结果并恢复本地 persistence、room 与 Authority checkpoint。

## Fences and invariants

- payload `matchId` 必须等于 canonical room 与 Authority matchId。
- 可用时 generation/epoch、session/member、player slot、Authority sequence 与 event revision 必须单调且拒绝 stale/duplicate。
- terminal order 为 2–5 个唯一席位，非法 order 在任何终局副作用前 fail-closed。
- terminal 不得重复广播或结算；late timeout callback 不能绕过幂等保护。
- Authority/Adapter 异常只映射 `match_protocol_unavailable` 或稳定 `gameplay_error`，不回显异常文本。

## Ownership and rollback

- Module：fence、dispatch、effect ordering、checkpoint 与分类结果。
- Rule Authority：规则合法性、canonical state、revision、seq、transition 与结果。
- `server/index.js`：消息解析、wire、权限、广播实现、Reward/Replay/社交与 timer 生命周期。
- 回滚：移除 Match Protocol import/Adapter/wrapper 后恢复三套原 inline action/transition 路径；不删除用户数据、不改 wire 或规则。

## Evidence boundary

本地代码/合同/自动化只能证明 `VERIFIED_LOCAL`。第二浏览器、物理设备、真实网络、真实 Supabase/RLS/备份/恢复/多实例和生产发布仍为外部 Gate；人工美术/IP/Reviewer B/Golden Set 不属于本纵切。
