# Honru Emoji Runtime P0 合同

本合同冻结 `ART-024 / ART-025 / SOC-017 / GAME-023` 的跨层接口。它是后续实现的输入，不是实现证据；在人工审查和用户发布授权前，所有新图与新旗标均保持 `reference-only / default-off`。

## 1. 共享目录与稳定目录事实源

### 1.1 目录布局（本任务不创建）

```text
art-source/brand/ghost-game/honru/emoji-v1/
├── chroma/                 # 每枚 1254×1254，纯 #00ff00 色键源
├── alpha/                  # 每枚 RGBA 原始 Alpha
├── flat/                   # 每枚 Ink/Paper/Cream 三色平涂候选
├── derived/                # 每枚 192/96/64/44px 透明派生图
├── atlas/                  # 审查用/运行时候选 atlas
├── poster/                 # 人工 Golden Set poster/contact sheet
├── PROMPT_AND_PROVENANCE.md
├── TECHNICAL_REVIEW.md
├── IP_REVIEW_Reviewer_A.md
├── IP_REVIEW_Reviewer_B.md
└── GOLDEN_SET_DECISION.md

public/assets/brand/honru/emoji-v1/
└── honru-emoji-atlas-v1.webp  # 只有通过审批后才允许出现；非本任务产物
```

`states-v1/`、`v2/`、当前线上 `public/assets/brand/honru-mascot-v1.svg` 是独立资产族，不得把 Emoji 文件放入其中。`asset-library/catalog.json` 是来源/许可/哈希 sidecar；`public/assets/manifests/asset_manifest.json` 才是未来运行时的机器事实源，二者不能互相取代。

### 1.2 目录数据模型

未来通过人工闸门后的 Manifest `P-HONRU-EMOJI-V1` 条目至少包含以下字段（字段名可由 Manifest schema 统一，但语义不可删）。在审批前，Catalog 只能登记 `reference-only` 且所有 `runtimePaths` 必须留在 `art-source/`；不得创建下面的 public 运行时条目。

```json
{
  "asset_id": "P-HONRU-EMOJI-V1",
  "runtime_id": "honru",
  "artwork_version": 1,
  "status": "ready",
  "runtime_path": "public/assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp",
  "atlas": { "width": 1024, "height": 768, "columns": 4, "rows": 3, "cell": 256 },
  "poster": "public/assets/brand/honru/emoji-v1/honru-emoji-poster-v1.webp",
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
    "emoji_wave": "👋", "emoji_thumbsup": "👍", "emoji_cheer": "🎉", "emoji_wow": "😮", "emoji_oops": "😅",
    "emoji_cry": "😭", "emoji_angry": "😠", "emoji_sly": "😏", "emoji_heart": "❤️", "emoji_game": "🎮"
  },
  "fallback_asset_id": null,
  "fallback": "per-id Unicode glyph, then localized readable text",
  "feature_flags": {
    "operator": "all",
    "enabled_value": "1",
    "default_enabled": false,
    "ids": ["mg_art_honru_emoji_v1", "mg_art_honru_emoji_throw_v1"]
  },
  "license": "project-owned-ai-generated",
  "remoteObjectKey": null
}
```

`cells` 必须按上表 row-major 顺序冻结；atlas 最后两个 cell 必须完全透明。聊天和局内只读 `emojiId` → `cells[emojiId]`/`fallback_glyphs[emojiId]`，不得各自维护第二套 ID 或按用户语言改变 cell。

## 2. 图像技术合同

### 2.1 Alpha、调色板和来源

- 色键源、Alpha、三色平涂母图均为正方形 `1254×1254`（与现有 Honru v2/Expression Kit 的生成基线一致）；四角 Alpha 必须为 `0`。
- 色键源只能使用均匀 `#00ff00` 背景；移除后可见像素只允许 Ink `#211923`、Paper `#FFF9F2`、Cream `#F3E5C4`，以及透明。边缘不可有可见绿色污染。
- 生产 Prompt 不得包含第三方游戏/角色/艺术家名字；不能上传、描摹、裁切或修改第三方素材。每枚 Emoji 必须保留幽灵/手柄同体、左十字眼、右四圆眼，并以独立的姿态、嘴形或手势形成可辨识差异。
- `alpha/` 是审计中间件，`flat/` 是首选人工清稿候选；错误抠图、16 位色距溢出或带水印/伪文字的文件不得登记为正样本。

### 2.2 派生尺寸、atlas、poster 与预算

| 层 | 尺寸/格式 | 用途 | 强制预算/限制 |
|---|---|---|---|
| source/chroma/alpha/flat | 每枚 `1254×1254` PNG/RGBA | 来源、清稿、审计 | 不进入首屏或生产 Manifest |
| derived | 每枚 `192/96/64/44px` 透明 PNG | 盲测、a11y、fallback 预览 | 44px 保留轮廓和双控制器眼；64px 一秒语义盲测 ≥4/5 |
| runtime atlas | `1024×768` 静态 Alpha WebP，4×3、每格 `256×256` | 聊天/局内共同运行时资源 | ≤ `1 MiB`；不得 animated、不得含文字；按需加载，不首屏预载 |
| review poster | `640×360` WebP/PNG，5×2、每格 `128×128`，居中留透明/Paper 安全边 | 人工 Golden Set 与浏览器 poster | ≤ `180 KiB`；不作为协议或 UI 文本来源 |

Atlas 每个 cell 的主体至少保留 8% 安全边，96px 以下删除非语义材质线。运行时只解码一个 atlas；若浏览器无法安全裁切/解码，立即走 Unicode fallback，不为单枚 Emoji 追加未登记远程请求。移动端新增解码工作集目标 ≤4 MiB，不能侵蚀 Art Bible 的 ≤80 MiB 总工作集目标。

## 3. Feature flag、Manifest 和失败回退

### 3.1 双闸门

- 总闸门：`mg_art_honru_emoji_v1`。
- 投掷/轨迹分闸门：`mg_art_honru_emoji_throw_v1`。
- 只有两个 localStorage 值都严格等于字符串 `"1"` 才可读取 atlas；缺失、`true`、数字 `1`、其他字符串、异常读取、Manifest 缺项均解释为关闭。
- 这两个旗标与既有 `mg_art_honru_states_v1`、`mg_art_honru_game_reactions_v1` 完全独立；不得用“非 0 即开”或旧旗标旁路。

### 3.2 回退优先级

1. 获批且通过解码/路径/尺寸校验的 `P-HONRU-EMOJI-V1` atlas cell。
2. 既有 `MATCH_EXPRESSION_EMOJI_FALLBACK` 的 Unicode glyph（按 `emojiId` 精确映射）。
3. 同一语义的本地化可读文字/`aria-label`；若字体没有 glyph，保留文字和操作，不显示裸 `emojiId`。

Emoji 失败不应回退到九状态 Honru 图以冒充语义；`P-002-HONRU-MASCOT-V1` 只保留给 Honru 状态/品牌反应。任何回退都不改变服务端事件、Block、频控或局面。

## 4. 聊天与局内共用消费合同

### 4.1 共用目录

- 两个表面都消费同一个 `emojiId`、同一个 semantic key、同一个 atlas cell 和同一个 Unicode fallback；禁止在 Chat 或 Game Stage 复制一份映射。
- 客户端发送的仍是稳定 ID/既有文字字段，不发送图片 bytes、data URL、HTML、SVG、CSS 或 vendor-specific glyph。
- 资源是表现层缓存，不进入消息正文、日志、Replay、moveLog、奖励、AI 学习、Analytics、Profile、数据库或 localStorage。
- 名称/正文继续走 raw `textContent`；系统标题、错误和 `aria-label` 走三语 i18n。图片本身不烘焙文字。

### 4.2 现有协议兼容边界

- 局内选择继续使用既有 `match-expression-v1`：`match_expression(matchId,eventId,kind:'emoji',expressionId,targetSeat?)`。不新增 `assetId`、`atlasCell` 或图像 URL 字段。
- `match-chat-v1` 和 `direct-chat-v1` 当前是服务端权威纯文字合同。Emoji Chat picker/inline token 若要真正发送到这两个表面，必须另立版本化协议和安全/持久化审查；本合同只冻结共享目录，不授权偷偷扩展现有 `text` 字段。
- 在该适配器尚未实现前，聊天 UI 继续文字/Unicode 行为是已知缺口；不得把局内表现的通过写成聊天已接入。

## 5. 局内目标席位投掷与表现

### 5.1 事件与位置

- `targetSeat` 缺省/null：Emoji 气泡归发送者席位；指定有效 AI/真人席位：视觉飞行从发送者 Seat 中心到目标 Seat 中心，落点气泡归目标席位。
- `quick_*` 始终停留在发送者席位，不生成飞行轨迹。
- 轨迹只使用屏幕坐标/DOM rect 和 `game-stage-overlay`；不得读取/写入规则坐标、棋盘数组、权威快照或移动日志。Overlay 保持 `pointer-events:none`，不拦截游戏输入。
- 当前已验收的默认程序化轨迹是约 `720ms`；获批 ART-025 素材必须保持 `520–720ms` 的可打断窗口、单次落点，不得连续粒子或无限循环。头像旁气泡保留约 `2.6–2.7s`，每席最多可见三条。
- 重排席位、换局、离开、结束、重连到新 `matchId` 时，所有轨迹、气泡、目标和 timer 必须以 `matchId + eventId` 失效并清理；迟到 decode/动画回调不得复活旧节点。

### 5.2 reduced-motion、页面隐藏和本地静音

- `prefers-reduced-motion: reduce`：取消飞行、弹跳、缩放和入场动画；保留静态 Emoji/文字气泡、语义 `role=status`/`aria-label` 和清晰目标关系。
- 页面隐藏、不可见/离屏或解码失败：不启动新动画；可保留静态 fallback，恢复可见后不补发过期事件。
- 局内表达静音继续由 `mg_match_expression_muted` 控制；房间文字静音继续由 `mg_match_chat_muted` 控制。静音是当前接收端的本地表现选择，不是 Block、举报或服务端撤回；发送者仍可发送，服务器仍执行安全检查。
- 若未来 Chat picker 需要静音，必须使用独立 surface key，不得把私聊/房聊/局内表达绑定为不可分别恢复的全局静音。

## 6. 权限、安全、频控和数据边界

以下沿用并冻结现有 Social Match 合同，Emoji 资源不能弱化它：

| 边界 | 强制规则 |
|---|---|
| 身份 | 只有有效 session 的正式真人席位可发送；`senderUid/player/createdAt/protocol` 由服务端签发。访客、AI、观众、无效席位不可发送。 |
| Match | 必须是 active match 且 `matchId` 精确匹配；settled/new match/错误 room 拒绝。 |
| 幂等 | `(senderUid,eventId)` 单局有界幂等；重复只 `replayed:true` 回执，不重复广播；服务端保留上限 300。 |
| 频控 | 同一账号 10 秒最多 4 条、60 秒最多 12 条、单局最多 80 条；客户端约 900ms 冷却只为体验，不是安全边界。 |
| 目标/Block | 定向真人在发送时执行双向 Block；广播给每个接收会话前重新校验 token 与双向 Block；延迟观众 timer 发送前再次校验。任一方向 Block 时目标完全不可见。 |
| 观众 | 观众只读，使用既有 `spectatorDelayMs`；可看符合延迟的 fallback/批准资产，但永远不能投掷、选目标或绕过历史延迟。 |
| 聊天 | `match-chat-v1` 文字仍限 160 Unicode/640 UTF-8/4 行、最近 50 条内存、同样的 Block/观众/频控；Emoji 目录不能把正文变成持久图片消息。 |
| 举报 | 只提交已批准的 `matchId + eventId/messageId` 上下文；不复制位图、正文或个人经济字段。 |
| 数据 | 不写规则快照、moveLog、Replay、Reward、AI、Analytics、Supabase、数据库、localStorage（静音 key 除外）。 |

## 7. IP、风格和审批闸门

每枚 Emoji 必须有独立 Prompt、任务 ID、来源输入、模型、人工改动、原图/Alpha/flat/derived/atlas/poster hash、许可和作者记录。允许的身份参考只有项目自有 Honru v2 候选与 Art Bible 的高层语法；不得输入第三方角色、商业游戏截图、已有 vendor emoji artwork 或在世艺术家风格名。

必须满足：

- 无文字、伪文字、Logo、水印、皇冠、服饰组合、武器、徽记、独立手柄、第三方角色、商业表情帧或可识别商业构图。
- 身体轮廓仍读为幽灵/手柄同体；左眼十字、右眼四圆键、三段圆润火苗不被情绪遮掉。
- 每枚至少有一个有设计目的的非对称手势/嘴形/姿态；不以简单换色或 vendor glyph 描摹充数。
- 200% 放大无断裂轮廓、错误手指、伪文字、绿色污染、遮挡和光向冲突；44px/64px 盲测通过 Art Bible 门槛。

顺序闸门：人工清稿 → Reviewer A 技术/风格记录 → 独立 Reviewer B IP Similarity Review → 用户 Golden Set 决议 → Integration/Performance/A11y/真机与 reduced-motion → 用户明确发布。任何自动 QA 通过都不能替代 Reviewer B、法律意见或用户决议。

## 8. 可测试验收矩阵

| ID | 验收断言 | 证据/测试建议 | 本审计状态 |
|---|---|---|---|
| E01 | 十个 ID 与 semantic/fallback 表完全同构，无新增/重命名 | `qa/honru-emoji-contract.js` + `qa/social-match-contract.js` | 现有十 ID 已 PASS；原创目录未执行 |
| E02 | Chat 与 Game Stage 只消费同一目录/同一 cell，wire 不含资产字段 | 静态扫描 catalog、app-shell、chat adapter、协议样例 | 缺共享 Emoji adapter |
| E03 | 每枚 source/alpha/flat 为 1254² RGBA；四角透明、绿色污染 0、仅三色 | `scripts/asset-library-audit.js` + 新 Alpha 读取器 | 未生成素材 |
| E04 | derived 192/96/64/44 全部存在；44px 身份可读、64px 语义盲测 | Image metadata + 人工 contact sheet | 未执行 |
| E05 | atlas 1024×768、4×3/256 cell、最后两格全透明、≤1MiB、非动画 | 新 `qa/honru-emoji-contract.js` | 无 Manifest/atlas |
| E06 | poster 640×360、5×2、≤180KiB、无文字/水印 | 新资产 QA + Golden Set packet | 无 poster |
| E07 | Manifest/Catalog ID、路径、hash、fallback、flags 同构；reference-only 不指向 public | `asset-library-audit` / `qa/asset-manifest-v2` 扩展 | 现有九状态 PASS；Emoji 缺项 |
| E08 | 两个新 flag 仅字符串 `"1"` 同时开启；缺失/异常 fail-closed | flag matrix unit test | 未实现 |
| E09 | 404/decode/atlas cell 错误回 Unicode/可读文字；不空白、不阻塞输入 | browser/DOM failure harness | 既有状态 fallback PASS；Emoji 未接入 |
| E10 | 目标 Emoji 从 sender 到 target，quick 留在 sender；无规则字段副作用 | Social Match online + DOM geometry harness | 现有程序化轨迹 PASS；获批素材未接入 |
| E11 | reduced-motion/hidden/offscreen 取消动画，不补发过期事件 | browser emulation + lifecycle harness | 自动 CSS guard PASS；可见设备未执行 |
| E12 | 本地 mute 只影响当前表现且各 surface 独立 | DOM/localStorage matrix | 现有表达/房聊 key PASS；Chat Emoji key 未实现 |
| E13 | 4/10s、12/60s、80/match、300 idempotency 与 ack-only replay | `qa/social-match-contract.js` + `qa/social-match-online.js` | 静态合同 PASS；本审计未重跑 online |
| E14 | Block 在目标与每个接收者/延迟 timer 重校验；观众只读且遵守 delay | Social Match online/security/reconnect | 静态合同 PASS；外部设备未执行 |
| E15 | Emoji 不进入 moveLog/Replay/Reward/AI/Analytics/DB/localStorage | source boundary scan + online replay/result tests | 现有表达/房聊 PASS |
| E16 | 三语 system labels、raw names/text、ARIA label、44px controls | `npm run test:i18n`, `qa/dom-smoke.js`, a11y harness | 现有表达/房聊 PASS；Emoji art alt 未实现 |
| E17 | 离开/结束/重开/重连/new match 清理 atlas crop、bubble、timer、draft | lifecycle QA | 现有清理 PASS；新 atlas adapter 未实现 |
| E18 | 首屏不预载；atlas/解码内存在预算内；≤3 flashes/s | network/perf/real-device evidence | 未执行 |
| E19 | Prompt/provenance、Alpha、人工清稿、Reviewer B、IP、Golden Set 全部签字 | review packet + hashes | 全部未执行 |
| E20 | 双旗标默认关闭、可单开关回滚；构建 drift=0；无部署声明 | `npm run quality:gates`, `npm test`, double build | 本任务不施工 |

## 9. 回滚

开发期删除新 Emoji 目录、Catalog sidecar 和任何 `P-HONRU-EMOJI-V1` 预览条目即可回滚；运行时把任一新 flag 设为非 `"1"` 即回到既有 Unicode fallback。不得删除/改写 `P-002-HONRU-MASCOT-V1`、九状态 `P-HONRU-STATES-V1`、`match-expression-v1` 或 `match-chat-v1`。
