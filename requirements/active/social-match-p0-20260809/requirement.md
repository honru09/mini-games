# Social Match P0 需求冻结

状态：`REQUIREMENT_FROZEN`

时间：2026-08-09 22:08（Asia/Tokyo）

## Goal

在已验收的沉浸式 Game Shell 内建立统一玩家身份与安全的局内表达闭环：玩家可从 Seat 打开公开个人页、选择预设 Emoji/快捷语并向指定玩家表达；服务端权威签发发送者、频控、幂等和 Block 过滤，客户端提供静音、队列、reduced-motion 与全端布局。

## IN

- `SOC-001 / SOC-013 / SOC-014 / SOC-015 / SOC-016 / SOC-018 / SOC-030`。
- `GAME-022 / GAME-023 / GAME-024 / GAME-025` 的 P0 子集。
- Seat 公开身份扩充为 Avatar、名字、头像框、头像特效、闪名、语言；不包含 owned、余额、用户名、token 或购买记录。
- 点击真人 Seat 的头像/名字打开现有公开 Profile 小窗，并复用好友、私聊、屏蔽、举报动作。
- `match-expression-v1`：10 个稳定 Emoji 语义 ID、6 个稳定快捷语 ID、可选目标席位、发送幂等、频控、Block、观众只读、错误码和客户端静音。
- Command Slot 内表达选择盘；Seat 旁气泡；Overlay Slot 内目标投掷轨迹；最多三条可见队列，自动清理。
- Light/Dark、zh-CN/en-US/uk-UA、桌面/平板/手机横竖屏、reduced-motion 和资源失败 fallback。

## OUT

- 不默认开启尚未取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 的 Honru 图片；`ART-024 / ART-025 / SOC-017` 可按后续 Art M1 自动推进机器审查、Manifest、fallback、feature flag 与回滚，人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 仅为可选咨询。
- 不开放任意用户输入的局内自由文本；本批仅使用服务端白名单快捷语 ID，房间聊天 `SOC-019` 保持 P1。
- 不写 Direct Chat 历史、数据库、Supabase、Replay、moveLog、奖励、AI 学习、Analytics 或经济流水。
- 不修改六款规则、游戏文件、共享 Rule Core、Authority、Tetris、赛事、奖励、商城定价、PWA、部署与生产凭证。
- 不提交、不推送、不触发 GitHub Pages 或 Render；默认终点为本地验收等待用户发布指令。

## Non-negotiable

- senderUid/player/createdAt 只能由服务端从有效 session 与房间席位派生；客户端字段不得覆盖。
- 只有已开始且 matchId 精确匹配的真人玩家可发送；AI、观众、无房间、过期 match、未持久账号均不得发送。
- `eventId` 按账号 × match 幂等；重复请求只回执不重播。
- 目标玩家与发送者任一方向 Block 时拒绝定向表达；向其他客户端广播前按接收者重新执行 Block 过滤。
- 表达不进入规则快照、重连 moveLog、Replay、奖励、学习或持久库；刷新/重连不补历史表达。
- 频控至少覆盖 10 秒、60 秒和单局总量；客户端冷却只用于体验，服务端仍是权威。
- 所有新增用户可见文字同步三份 locale；用户昵称继续 `data-i18n-raw`。
- 未审批美术只使用稳定语义 ID + 程序化/Unicode fallback；后续换图不得改协议或存量 ID。

## Known Existing Behavior

- Game Shell 已冻结 `header / seats / arena / command / overlay`，页面滚动锁与内部滚动已验收。
- Seat v2 已有真人/AI/空席、READY、房主、离线、观众和公开 uid/avatar/name，但缺 frame/effect/nameFx/lang 与点击身份入口。
- 公开 Profile、好友关系、Block、Report、Direct Chat 均已有服务端安全边界和 UI；现有 `openProfileModal()` 对非缓存玩家不会主动拉取服务端完整公开档案。
- `game-stage-overlay` 当前 `pointer-events:none` 且为空；可承载纯表现轨迹，不得接收交互。
- 当前没有 match expression 消息、能力声明、重连/回放规则或专项 QA。

## Expected UX

- 玩家进入对局即可看见完整身份组合；点击真人头像或名字打开轻量公开 Profile，小窗中的按钮状态与当前好友/Block 关系一致。
- Command Slot 显示一个紧凑“表达”入口；展开后可在 Emoji 与快捷语之间切换、选择目标或全场，并可一键静音局内表达。
- 发送后 Emoji 从本人 Seat 向目标 Seat 平滑移动，并在头像旁弹出；快捷语只在发送者头像旁显示，不能遮挡 Arena 或主操作。
- 每名玩家最多排队三条，连续表达有明确冷却；被 Block、被静音、过期、非法或频控时不污染游戏状态。
- reduced-motion 下取消抛物线与弹跳，只保留短暂静态气泡和可读状态。
