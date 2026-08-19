# Honru Emoji Runtime P0 合同

状态：`LOCAL_IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / REVERSIBLE_DEFAULT_ON / RELEASE_EVIDENCE_PENDING / NOT_RELEASED`

本合同冻结 `ART-024 / ART-025 / SOC-017 / GAME-023` 的跨层接口，并以 2026-08-16 的本地 runtime 为当前实现事实。`P-HONRU-EMOJI-V1` 已取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，选择器、头像气泡与定向投掷已进入可逆 default-on runtime；这不扩展 Chat 图片协议、不新增规则或权威，也不代表已发布。人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 只属于 `OPTIONAL_ADVISORY_EVIDENCE`。

## 1. 共享目录与机器事实源

### 1.1 已落盘目录

```text
art-source/brand/ghost-game/honru/emoji-v1/
├── chroma/                 # 每枚 1254×1254 色键源
├── alpha/                  # 每枚 1254×1254 RGBA Alpha
├── flat/                   # Ink/Paper/Cream 平涂候选
├── derived/                # 每枚 192/96/64/44px 透明派生图
├── atlas/                  # 1024×768 审计源 atlas
├── poster/                 # 640×360 poster 与 44px strip
├── PROMPT_AND_PROVENANCE.md
├── TECHNICAL_REVIEW_Reviewer_A.md
├── IP_REVIEW_Reviewer_B_PENDING.md
└── GOLDEN_SET_DECISION_PENDING.md

public/assets/brand/honru/emoji-v1/
├── honru-emoji-atlas-v1.webp
└── honru-emoji-poster-v1.webp
```

`states-v1/`、Honru v2 和 `public/assets/brand/honru-mascot-v1.svg` 是独立资产族，不得与 Emoji 混放或互相冒充 fallback。`asset-library/catalog.json` 中 G-17–G-27 是来源、许可、Prompt 和 hash 的 `reference-only` sidecar；另有 `P-HONRU-EMOJI-V1` 的 `integrated-local-only` runtime 投影，明确关联 public atlas/poster，但不取代 Manifest。`public/assets/manifests/asset_manifest.json` 仍是运行时唯一机器事实源。

### 1.2 当前 Manifest 数据模型

当前 `P-HONRU-EMOJI-V1` 条目必须保持以下核心语义。示例反映 2026-08-16 的 owner-cleared default-on 状态：

```json
{
  "asset_id": "P-HONRU-EMOJI-V1",
  "runtime_id": "honru",
  "artwork_version": 1,
  "status": "ready",
  "clearance": "OWNER_AUTHORIZED_ART_CLEARANCE",
  "runtime_path": "public/assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp",
  "poster": "public/assets/brand/honru/emoji-v1/honru-emoji-poster-v1.webp",
  "actual_bytes": 369460,
  "byte_budget": 1232896,
  "atlas": { "width": 1024, "height": 768, "columns": 4, "rows": 3, "cell": 256 },
  "cells": {
    "emoji_wave":       { "x": 0,   "y": 0,   "w": 256, "h": 256 },
    "emoji_thumbsup":   { "x": 256, "y": 0,   "w": 256, "h": 256 },
    "emoji_cheer":      { "x": 512, "y": 0,   "w": 256, "h": 256 },
    "emoji_wow":        { "x": 768, "y": 0,   "w": 256, "h": 256 },
    "emoji_oops":       { "x": 0,   "y": 256, "w": 256, "h": 256 },
    "emoji_cry":        { "x": 256, "y": 256, "w": 256, "h": 256 },
    "emoji_angry":      { "x": 512, "y": 256, "w": 256, "h": 256 },
    "emoji_sly":        { "x": 768, "y": 256, "w": 256, "h": 256 },
    "emoji_heart":      { "x": 0,   "y": 512, "w": 256, "h": 256 },
    "emoji_game":       { "x": 256, "y": 512, "w": 256, "h": 256 }
  },
  "fallback_glyphs": {
    "emoji_wave": "👋",
    "emoji_thumbsup": "👍",
    "emoji_cheer": "🎉",
    "emoji_wow": "😮",
    "emoji_oops": "😅",
    "emoji_cry": "😭",
    "emoji_angry": "😠",
    "emoji_sly": "😏",
    "emoji_heart": "❤️",
    "emoji_game": "🎮"
  },
  "fallback": "per-id Unicode glyph, then localized readable text",
  "integrity": "sha256:63108f289eab68f096cae59e2c32623e9e09b67fbebebb3383cc317494530d6a",
  "poster_integrity": "sha256:ec4b5a263839367a6ddcb9ced1b1b58fa2cbd24b0812b290be17eb7da84b9e35",
  "clearance_record": "requirements/active/honru-emoji-runtime-p0-20260811/OWNER_AUTHORIZED_ART_CLEARANCE.md",
  "feature_flags": {
    "operator": "all",
    "enabled_value": "1",
    "default_enabled": true,
    "ids": ["mg_art_honru_emoji_v1", "mg_art_honru_emoji_throw_v1"]
  },
  "license": "project-owned-ai-generated"
}
```

`cells` 按 row-major 顺序冻结，最后两个 256×256 cell 必须完全透明。表现层只读 `emojiId → cells[emojiId] / fallback_glyphs[emojiId]`；不得维护第二套 ID、按语言改变 cell 或把图片路径写入协议。

## 2. 图像技术合同

### 2.1 Alpha、调色板与来源

- 十枚 Alpha 均为 `1254×1254`、8-bit RGBA、四角透明；可见绿色污染计数为 0。192/96/64/44px 透明派生均已落盘。
- 身份锚点必须保留“幽灵与手柄同体、左十字眼、右四圆眼”；情绪只通过姿态、嘴形、手势与通用符号表达。
- 生产 Prompt 不含第三方游戏、角色、艺术家、商业截图或品牌名；生成输入只允许项目自有 Honru 资产。外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材不得复制、裁切、描摹、换色、作为生成输入、接入 runtime 或发布。
- `alpha/`、`flat/` 和四档 PNG 是来源、机器审计与可选咨询材料，不进入生产 Manifest；生产消费者只读取版本化本地 WebP atlas。

### 2.2 派生、atlas、poster 与预算

| 层 | 当前尺寸/格式 | 当前用途 | 合同与事实 |
|---|---|---|---|
| source/chroma/alpha/flat | 每枚 `1254×1254` PNG/RGBA | 来源、审计、可选清稿 | 不进入首屏或协议 |
| derived | 每枚 `192/96/64/44px` 透明 PNG | 小尺寸技术检查 | 44px 仍须保留 Honru 身份锚点 |
| runtime atlas | `1024×768` 静态 Alpha WebP，4×3、每格 `256×256` | 当前选择器、气泡、定向投掷 | 302,314 bytes，≤1 MiB；按需加载，不首屏预载 |
| runtime/review poster | `640×360` 单帧 WebP | Manifest/审查展示 | 67,146 bytes，≤180 KiB；不是协议或 UI 文本来源 |

atlas 与 poster 合计 369,460 bytes，低于 1,232,896 bytes 组合预算。运行时只解码 atlas；无法安全读取 Manifest、裁切 cell 或解码时立即回到 Unicode/文字，不为单枚 Emoji 发出远程请求。

## 3. Feature flag、Manifest 校验与失败回退

### 3.1 可逆 default-on 双开关

- 总开关：`mg_art_honru_emoji_v1`。值缺失或严格等于字符串 `"1"` 时开启；任意其他值关闭所有 Honru Emoji 图片，选择器、气泡与投掷回到 Unicode/文字。
- 投掷开关：`mg_art_honru_emoji_throw_v1`。值缺失或严格等于字符串 `"1"` 时允许定向投掷图片；任意其他值只关闭投掷图片/飞行节点，选择器和头像旁静态 Emoji 仍由总开关控制。
- `localStorage` 读取异常时图片路径 fail-closed；不会阻塞表达按钮或更改服务端事件。
- 两个开关与 `mg_art_honru_states_v1`、`mg_art_honru_game_reactions_v1` 独立；不能借旧旗标旁路。

### 3.2 Resolver allowlist

`resolveHonruEmojiCell(expressionId, forThrow)` 只有在以下条件全部满足时返回冻结 cell：稳定 ID 属于十项 allowlist；对应开关开启；Manifest `runtime_id/status/clearance/path/default_enabled/flags` 精确匹配；atlas 几何为 1024×768、4×3、256px；cell 是整数且不越界。任何异常都返回 `null` 并清除 Manifest promise 以允许后续安全重试。

### 3.3 回退优先级

1. 通过 allowlist、Manifest、clearance、几何与 decode 校验的 atlas cell。
2. `MATCH_EXPRESSION_EMOJI_FALLBACK` 中按同一 `emojiId` 精确映射的 Unicode glyph。
3. 本地化可读文字/`aria-label`；不得显示裸 ID，也不得让图片失败阻断输入。

Emoji 失败不能回退到九状态 Honru 图冒充语义。任何回退都不改变服务端身份、目标、Block、频控、观众延迟、幂等或局面。

## 4. 当前消费者与 Chat 边界

### 4.1 已实现的局内消费者

- `match-expression-v1` 仍传 `kind:'emoji' + expressionId + targetSeat?`；客户端用 `expressionId` 在本地解析同一 atlas cell。
- 选择器按钮、头像旁 Emoji 气泡与定向投掷节点共用 `resolveHonruEmojiCell()` 和 `MATCH_EXPRESSION_EMOJI_FALLBACK`，没有第二份稳定 ID 映射。
- atlas sprite 是装饰层，父按钮/气泡继续提供本地化 `aria-label`/`role=status`。资源内不烘焙文字，玩家名字和聊天正文继续使用 raw `textContent`。
- 客户端不发送图片 bytes、data URL、HTML、SVG、CSS、atlas cell、asset ID 或图片 URL。
- 资源不进入消息正文、日志、Replay、moveLog、奖励、AI 学习、Analytics、Profile、数据库或 localStorage。

### 4.2 未实现的 Chat 图片协议

- `match-chat-v1` 和 `direct-chat-v1` 当前是服务端权威纯文字合同；两者仍只净化、发送和持久/暂存 `text`。
- 当前 atlas 接入没有 Chat Emoji picker、inline token、图片消息、asset 字段或二进制消息。`SOC-017` 必须保持 `partial`。
- 若未来让 Chat 真正发送 Emoji token/图片，必须另立版本化协议、权限、Block、净化、持久化、兼容、a11y 和回滚审查；本合同不授权偷偷扩展现有 `text` 字段。
- “局内选择器/头像气泡/投掷已实现”不得改写为 “Direct Chat 或 Match Chat 图片消息已实现”。

## 5. ART-025 与定向投掷表现

### 5.1 当前实现事实

- `targetSeat` 缺省/null 时，Emoji 气泡归发送者席位；指定有效目标时，现有程序化轨迹从发送者 Seat DOM rect 中心飞向目标 Seat DOM rect 中心，落点气泡归目标席位。
- 当前 owner-cleared atlas sprite 已放入这条约 720ms 的既有 DOM/CSS 轨迹和头像气泡。它替换 Unicode 视觉，不新增轨迹权威、命中判定、规则坐标、协议字段或服务器动作。
- `quick_*` 表达仍停留在发送者席位，不生成图片飞行轨迹。
- `ART-025` 继续是 `planned`：其剩余产品范围只是更精细、有限且可打断的投掷/命中/弹出表现素材。不得把 atlas 已用于程序化轨迹误写成该独立素材包全部完成。

### 5.2 生命周期与 reduced-motion

- `game-stage-overlay` 保持 inert / `pointer-events:none`；轨迹不能拦截棋盘或 HUD 输入。
- 每条飞行约 720ms；头像旁气泡约 2.6–2.7s，每席最多三条。不得加入无限循环或持续粒子。
- `prefers-reduced-motion: reduce` 取消飞行；静态 Emoji/Unicode/文字气泡和可读目标语义仍保留。
- 换局、离开、结束、真实断开、新 `matchId`、静音或清理时 kill timer/flight/bubble；迟到 Manifest/decode 回调必须检查节点连接和当前 match，不能复活旧表现。
- `mg_match_expression_muted` 只静音局内表达接收表现；`mg_match_chat_muted` 只静音房间文字气泡。静音不是 Block、撤回或服务器权限。

## 6. 权限、安全、频控和数据边界

图片层不得弱化既有 Social Match 合同：

| 边界 | 强制规则 |
|---|---|
| 身份 | 只有有效 session 的正式真人席位可发送；`senderUid/player/createdAt/protocol` 由服务端签发。访客、AI、观众、无效席位不能发送。 |
| Match | 必须是 active match 且 `matchId` 精确匹配；settled/new match/错误 room 拒绝。 |
| 幂等 | `(senderUid,eventId)` 单局有界幂等；重复只回幂等确认，不重复广播；服务端上限 300。 |
| 频控 | 同账号 10 秒最多 4 条、60 秒最多 12 条、单局最多 80 条；客户端约 900ms 冷却不是安全边界。 |
| 目标/Block | 定向真人发送时执行双向 Block；每个接收会话与延迟观众 timer 发送前重新校验 token/Block。 |
| 观众 | 观众只读并遵守既有 `spectatorDelayMs`；不能投掷、选目标或绕过延迟。 |
| Chat | `match-chat-v1` 继续限制 160 Unicode/640 UTF-8/4 行与最近 50 条内存；Emoji atlas 不能把正文变成图片消息。 |
| 举报 | 只提交批准的 `matchId + eventId/messageId` 上下文；不复制位图、正文或个人经济字段。 |
| 数据 | 不写 Rule/Authority、snapshot、moveLog、Replay、Reward、AI、Analytics、Supabase、数据库或用户经济状态。 |

## 7. 所有者清除、可选咨询与外部 Gate

- 当前资产族的稳定 ID、版本、源/runtime SHA-256、provenance、机器 Alpha/污染/尺寸/小尺寸可读性/相似风险审查、Manifest、fallback、双开关和回滚已经形成 `OWNER_AUTHORIZED_ART_CLEARANCE`。
- 人工清稿、独立自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`。它们可以提出风险与返工建议，但不是开发、runtime 或未来发布候选的前置，也不得伪造成 PASS/签字/法律结论。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端性能和线上当前构建是 `EXTERNAL_ENVIRONMENT_REQUIRED / RELEASE_EVIDENCE_PENDING`；缺失不阻塞本地开发，但禁止跨设备或生产验证声明。
- 外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 永远没有所有者清除例外。
- 当前状态保持 `LOCAL_ONLY / NOT_RELEASED`；commit、push、Pages、Render 或生产数据操作仍只接受用户当前明确命令。

## 8. 可测试验收矩阵

| ID | 验收断言 | 当前事实 |
|---|---|---|
| E01 | 十个 ID、顺序、semantic 与 fallback 同构，无新增/重命名 | 自动合同覆盖，当前通过 |
| E02 | Manifest 只登记本地 atlas/poster，cell/path/hash/clearance/budget 精确 | 已实现；`P-HONRU-EMOJI-V1` 为 `ready` |
| E03 | 十枚 1254² RGBA Alpha、透明角、绿色污染 0、四档派生齐全 | 已有机器证据 |
| E04 | atlas 1024×768、4×3/256、末两格透明；poster 640×360 | 已实现并固定 SHA/bytes |
| E05 | default-on 总开关与独立投掷 kill switch 可逆，storage 异常 fail-closed | `qa/honru-emoji-runtime.js` 覆盖 |
| E06 | 未知 ID、路径逃逸、错误 clearance、越界 cell、decode 失败回 fallback | 专项合同/运行时覆盖 |
| E07 | 选择器、头像气泡与投掷共用同一 resolver；首屏不预载 | 已实现；atlas 可见时按需加载 |
| E08 | 图片不增加 wire 字段，不改变身份/Block/频控/观众/幂等 | 复用现有 `match-expression-v1` |
| E09 | `targetSeat` 图片沿既有程序化轨迹；quick 不飞；无规则副作用 | 已实现；ART-025 精细素材仍 planned |
| E10 | reduced-motion、静音、换局/离开/重连/迟到 decode 清理 | 自动合同已覆盖；外部设备可见证据待补 |
| E11 | Direct Chat 与 match-chat-v1 仍纯文字，未偷扩 `text` | 当前边界；`SOC-017 = partial` |
| E12 | 图片不进入消息、日志、Replay、Reward、AI、Analytics、DB/localStorage | 静态边界覆盖 |
| E13 | a11y 使用父控件本地化 label，失败保留 Unicode/文字 | 已实现；真实读屏设备证据待补 |
| E14 | 可选人工/IP/Golden Set 状态如实，外部受限素材永久隔离 | clearance/policy 合同覆盖 |
| E15 | 当前本地实现未发布；设备/网络只保留发布证据待决 | `NOT_RELEASED / RELEASE_EVIDENCE_PENDING` |

## 9. 回滚

- 将 `mg_art_honru_emoji_v1` 设为任意非字符串 `"1"` 值：所有 Honru Emoji 图片立即回到 per-ID Unicode/文字，既有 `match-expression-v1` 继续可用。
- 只将 `mg_art_honru_emoji_throw_v1` 设为任意非字符串 `"1"` 值：关闭定向投掷图片/飞行表现，保留选择器和头像旁静态 atlas Emoji。
- Manifest/path/clearance/几何/decode 任一失败自动执行同等 fail-closed 回退。
- 回滚不得删除或改写 `P-002-HONRU-MASCOT-V1`、`P-HONRU-STATES-V1`、十个稳定 ID、`match-expression-v1`、`direct-chat-v1` 或 `match-chat-v1`；没有服务器或数据库回滚步骤，因为本批没有新增权威、协议或持久化字段。
