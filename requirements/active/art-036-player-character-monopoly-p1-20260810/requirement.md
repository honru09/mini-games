# ART-036 — 玩家角色与大富翁实体美术 P1

状态：`REQUIREMENT_FROZEN`
时间：2026-08-10（Asia/Tokyo）
前置：`SOC-031` 已本地实现；`ECO-029` 并行冻结中

## 目标

为 Ghost Game 的独立玩家虚拟形象和大富翁实体棋盘建立 source-only 美术批次。角色必须与 Honru/Logo/Avatar/Frame/Background/NameFx 分层，沿用 Pocket Tabletop Sticker Art Bible 的 Ink/Paper/Cream 语法，保留高对比、可读剪影和“无 AI 味”的机器视觉/技术审查，并为逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE` 准备可审计证据。

## 本批 IN

- 角色基础形象与大富翁表现方向板：角色站姿、行走四向/八向 pose 约束、实体格子、建筑/地标/机会卡/道具的低频材质方向。
- 使用最高质量内置 `gpt-image-2` 生成 source-only 候选；完整 Prompt、模型、任务、尺寸、哈希、许可、拒绝理由和 fallback provenance。
- 候选只进入 `art-source/` 与素材库 `reference-only`，不进入 `public/assets`、runtime manifest、商城或角色目录。
- 所有者清除记录、机器技术/视觉/相似风险审查和小尺寸 contact sheet；人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 模板仅作为可选风险咨询。

## 本批 OUT

- 不修改 `server/player-character.js` 的 schema/slot ID、六款规则、Monopoly Authority、UI-037、GAME-045、奖励、Replay、商城事务或 Supabase schema。
- 不把图片接入运行时、不打开任何 `mg_art_*` 旗标、不新增付费商品、不把 Honru 当玩家角色。
- 不复制第三方游戏/角色/徽记/构图；不使用第三方截图作为输入；不宣称已通过人工/IP 审批。

## 验收门槛

- 最高质量模型源稿与完整 provenance 存在；source/reference-only 路径和哈希审计通过。
- 角色轮廓在 512/256/128/96/64/48/44px 方向模板中保持可读；大富翁格子/建筑/道具不烘焙 UI 文字。
- 200% 审核清单覆盖手指、遮挡、断线、伪文字、材质串色、光向、非对称原创识别点；具体候选取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 前默认关闭，取得清除后可作为保留 kill switch/fallback 的可逆 default-on 候选。
- 原有六款游戏/规则快照、Player Character v1 合同、Social Match、三语和 fallback 回归不受影响。
