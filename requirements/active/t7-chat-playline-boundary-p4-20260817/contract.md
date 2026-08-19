# Chat/Playline 深模块合同（P0）

## Interface

```js
const boundary = createChatPlaylineBoundary({
  adapter,
  now,
  resolvePeer,
  isFriend,
  isBlockedBetween,
  publicPeer,
  playline,
});

await boundary.chat({ action: 'chat_send', actor, peerUid, clientMessageId, text });
await boundary.playline({ action: 'playline_publish', actor, ...intent });
```

外部只学习两个方法：`chat(command)` 与 `playline(command)`。两者返回 Promise，结果只含稳定分类 `reason`、公共消息/动态和必要的游标字段；异常文本不会跨 seam 泄漏。

`chat` 支持 `list/state`、`history`、`send`、`read`（也接受带 `chat_` 前缀的旧动作名）。`playline` 只委托 `list`、`publish`、`remove`、`report`（`resolveReportTarget`），未知动作 fail-closed。

## Adapter

- `createMemoryChatPlaylineAdapter(initial)`：复制 state，供合同和隔离 lane 使用。
- `createJsonRuntimeChatPlaylineAdapter({read, write|commit, shape})`：可读取 canonical `{messages, reads, nextSeq}`，也可用 `shape: 'legacy'` 映射现有 `{chatMessages, chatReads, nextChatSeq}`。
- Adapter 的 `load`/`save`/`commit` 都以 detached plain state 交换；故障只返回 `server_unavailable`，不把内部异常写入结果。
- Playline 的持久化仍由注入的既有 Playline Module/store 负责；本 seam 不复制其内容/游标算法。

## Ownership

| 责任 | Chat/Playline Module | 现有 caller / Adapter |
| --- | --- | --- |
| actor/guest/admin admission | 负责 | 提供 actor 与可选 validator |
| 文本净化、长度、幂等、分页、已读单调性 | 负责 | 不重复实现 |
| 好友/Block 与公开身份 | 调用注入 policy，异常拒绝 | 提供 canonical resolver |
| seq、messageId、时间 | 生成/验证 | 可注入 clock/id factory |
| 状态保存/原子提交 | 通过 Adapter seam | JSON/未来数据库 Adapter |
| WebSocket wire、广播、session 生命周期 | 不负责 | `server/index.js` |
| Playline canonical content、feature flag、引用解析 | 既有 `server/playline.js` | 通过 `playline` 注入 |

## 不变量

- 不接受缺失/畸形 UID、未知 peer、自身 peer、访客或被隔离账号。
- 已识别 Test Admin peer 的 history/send/read 必须返回稳定 `test_admin_isolated`，不能被统一降级为 `invalid_target`；list 仍静默排除其历史与未读。
- 双向 Block 阻断读/写/列表可见性；好友或已有会话才可读历史。
- 消息正文只作为纯文本返回；消息对象不含 `clientMessageId`、凭证或经济/奖励字段。
- 相同 `(senderUid, clientMessageId)` 同正文只回放原消息，不产生第二 seq；正文不同返回 `idempotency_conflict`。
- 已读只接受本人真实收到的消息 seq，且不可回退。
- Adapter/clock/policy 异常统一 fail-closed；不会部分确认发送。

## 兼容与证据

现有 wire 名称和字段由 caller 负责映射，本 Module 不改协议版本。当前仅有本地 Node 合同证据；未接线前不把该合同描述为线上替换或生产持久化。
