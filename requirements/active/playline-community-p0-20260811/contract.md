# Playline Community P0 冻结合同

## External Interface

- Server Module：`list(actor, query)`、`publish(actor, intent)`、`remove(actor, input)`、`resolveReportTarget(actor, postId)`。
- Client Module：`Playline.open/publish/prefill/accept/reset`。
- DM Presenter：`DirectMessage.open/close/accept/reset`，底层仍为 `direct-chat-v1`。

## Wire

- C→S：`playline_list`、`playline_publish`、`playline_remove`。
- S→C：`playline_state`、`playline_publish_ok`、`playline_remove_ok`、`playline_invalidated`、`playline_error`。
- capability：`playline-v1`；默认关闭。

## 内容与顺序

- 正文 NFC、CRLF→LF、危险控制符/Bidi override 清理；1–280 Unicode code points、最多 4 行、UTF-8 ≤1200 bytes。
- `clientPostId` 在作者维度幂等；相同规范化意图回放，冲突返回 `idempotency_conflict`。
- 列表默认 20、最大 30；服务端签名 opaque keyset cursor；读者只得到 viewer-specific projection。
- 发布频控 3/10 分钟、15/24 小时；列表 60/分钟；活动动态保留 90 天，删除为幂等 tombstone。
- All/Friends 每次读取都重新验证关系与 Block；页面不返回总量或内部 seq。

## 回滚

- `ENABLE_PLAYLINE_V1=0` 不协商 capability，禁用发布/读取；Direct Chat 仍通过全局 dialog 工作。
- 可见导航保留安全 empty/beta state；旧服务器下前端不得发送未知消息。
- JSON/Supabase 数据与 tombstone 保留，不做破坏删除。
