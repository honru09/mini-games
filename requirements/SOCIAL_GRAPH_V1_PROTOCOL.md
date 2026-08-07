# Playroom Social Graph v1 协议与安全边界

**版本：1.0**  
**日期：2026-08-07**  
**范围：Friend Request / Friendship / Block / Report / Presence Privacy**

## 1. 设计原则

- 关系、屏蔽与举报均由服务端权威维护；客户端只提交意图，不能自报关系状态。
- Friend、Block、Report 同一阶段上线。Block 必须立即阻断继续骚扰，Report 只进入人工核查，不自动处罚。
- Presence 由服务端根据连接、房间状态和隐私偏好计算；隐身不能通过排行榜、玩家列表或房间大厅旁路泄露。
- v1 不包含聊天、Feed、公会、推荐算法、自动处罚或未成年人社交扩展。

## 2. WebSocket 消息

所有消息使用现有 `/ws` JSON 信封，并要求已认证 session。

| 方向 | type | payload | 结果 |
|---|---|---|---|
| C→S | `social_get` | 无 | 返回本人 `social_state` |
| C→S | `friend_request` | `{ toUid }` | 新建请求或返回幂等成功 |
| C→S | `friend_request_action` | `{ action, requestId }` | `accept / decline / cancel` |
| C→S | `friend_remove` | `{ uid }` | 删除双方唯一好友关系 |
| C→S | `block` | `{ uid }` | 建立单向屏蔽并解除好友/待处理请求 |
| C→S | `unblock` | `{ uid }` | 解除本人创建的屏蔽 |
| C→S | `report` | `{ targetUid, reason, contextType, contextId, matchId?, recentEventIds? }` | 创建 Moderation Intake |
| S→C | `social_state` | 见下节 | 本人的关系快照 |
| S→C | `social_ok` | `{ action, ... }` | 成功或幂等成功 |
| S→C | `social_error` | `{ msg, payload.reason }` | 权限、限频、屏蔽或参数拒绝 |

`social_state` 固定结构：

```json
{
  "version": "1.0",
  "friends": [],
  "incoming": [],
  "outgoing": [],
  "blocked": [],
  "counts": {
    "friends": 0,
    "incoming": 0,
    "outgoing": 0,
    "blocked": 0
  }
}
```

`incoming` / `outgoing` 项只包含请求 ID、创建时间和经过公开字段过滤的目标用户。`blocked` 是本人私有列表，不进入排行榜或其他用户的公开档案。

## 3. 状态机与幂等

```text
none ── friend_request ──> pending
pending ── accept ───────> friends
pending ── decline ──────> none
pending ── cancel ───────> none
friends ── friend_remove > none
any ── block ────────────> blocked（同时解除 friendship 和 pending request）
blocked ── unblock ──────> none
```

- 同方向重复请求返回同一 `requestId` 的 `idempotent`，不创建重复行。
- 双方只有一条规范化好友关系；`a_uid < b_uid` 的唯一约束防止反向重复。
- 已存在反向请求时，不自动建立好友，提示用户在 Incoming Request 中接受。
- Report 在短窗口内按举报人、目标和上下文幂等，重复提交返回原 `reportId`。

## 4. Block 强制规则

任一方向存在 Block 时，服务端必须阻止：

- 新好友请求。
- 房间邀请。
- 公开 Lobby 中发现对方所在房间。
- 使用房间码或 Direct Join helper 加入对方房间。

客户端隐藏按钮只是体验优化，不能替代服务端检查。

## 5. Report 最小证据

- `reason` 只能为 `harassment / inappropriate_name / cheating / spam / other`。
- `contextType` 仅允许已知的 profile / room / match 上下文；`recentEventIds` 数量和长度受限。
- 服务端保存目标当时的 `uid / name / avatar / signature` 显示快照，文本先过滤 HTML、控制字符和超长内容。
- 举报记录状态初始为 `open`；本阶段不实现自动封禁、举报人可见的处罚结果或内容审核后台。

## 6. Presence Privacy

- `presencePreference`：`joinable / busy / invisible`。
- `presenceVisibility`：`everyone / friends / nobody`。
- 服务端公开值只允许 `joinable / busy / in_game / offline`。
- invisible 或不可见用户对无权限查看者统一返回 `offline`，公开排行榜、玩家列表、好友状态和房间大厅必须使用同一计算函数。

## 7. Supabase 映射

| 表 | 用途 | 关键约束 |
|---|---|---|
| `friend_requests` | 请求历史 | pending 方向唯一、身份外键、状态枚举 |
| `friendships` | 双向好友关系 | 规范化用户对唯一 |
| `blocks` | 单向屏蔽 | blocker + blocked 唯一，禁止自屏蔽 |
| `reports` | Moderation Intake | 固定原因、最小上下文、目标显示快照 |

四表均启用 RLS，且不向 `anon` / `authenticated` 授权；当前浏览器不直连 Supabase，只有服务端 `service_role` 可访问。真实 Staging 的 RLS、迁移、并发和备份/恢复仍需在提供凭证后验收。

## 8. UI 约束

- Lobby Social Rail 固定为 Friends / Online / Recent 三 Tab。
- Incoming Request 必须显示接受和忽略；Outgoing 显示已申请或取消入口。
- 好友与房间成员操作菜单必须保留 Remove / Block / Report。
- Block 和 Report 是安全操作，不能仅靠 Emoji 表意；统一使用 Vendor SVG、文字和可访问名称。

## 9. 自动化验收

`node --experimental-websocket qa/social-graph.js` 覆盖：

- send / duplicate / accept / decline / cancel / remove。
- block、blocked request、公开房隐藏、直加入和邀请绕过。
- report、重复举报幂等、目标显示快照与 HTML 过滤。
- invisible 好友对普通用户显示离线。

本地测试通过不等于 `STAGING_VERIFIED` 或 `PRODUCTION_READY`。
