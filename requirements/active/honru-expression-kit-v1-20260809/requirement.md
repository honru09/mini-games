# Honru Expression Kit v1：鬼精灵状态素材批次

## Goal

以已冻结的 Honru v2 三色平涂候选为唯一身份参考，建立一批可复用的原创状态素材，覆盖平台助手、签到、聊天、邀请/等待与六款游戏局内反馈的共同情绪基础。素材先保持 source-only/reference-only，完成技术审计、来源记录与尺寸派生后，再进入默认关闭的运行时技术纵切。

## IN

- `idle`、`thinking`、`surprised`、`win`、`lose`、`recover`、`waiting-invite`、`check-in`、`playful` 九个状态。
- 每个状态使用内置 ImageGen 生成纯色键源，再按项目 ImageGen helper 做 Alpha 提取和 Ink/Paper/Cream 三色归并。
- 每个状态保存 prompt、来源、任务 ID、模型标识、尺寸、SHA-256、Alpha/色键审计与 192/96/64/44px 派生图。
- 新建 `art-source/brand/ghost-game/honru/states-v1/` 版本化目录；新增素材库 `reference-only` 条目。
- 设计语法固定为：幽灵与手柄同体、左十字眼、右四圆眼、粗圆 Ink 轮廓、两级平涂、无文字/道具/第三方角色。
- 预备一个独立、默认关闭的 `mg_art_honru_states_v1` 旗标和状态映射合同；先不进入线上 Manifest。

## OUT

- 不覆盖或替换 Honru v1/v2 母图，不进入 `public/`、商城、账号、奖励、AI 状态、WebSocket 快照或协议。
- 不生成复杂逐帧动画、Live2D、骨骼、音频或商业 IP 仿作；动效只记录后续实现建议。
- 不把自动审计结果写成人工风格/IP 通过，不宣称 production-ready。
- 本批不修改六款游戏规则代码；局内出现的接入另建默认关闭技术纵切任务。

## Non-negotiable

- 角色身份锚点不能被状态改变；只允许眼口、手势、火苗波峰与少量姿态变化。
- 仅 Ink `#211923`、Paper `#FFF9F2`、Cream `#F3E5C4` 三色及透明；纯色键背景不得进入主体。
- 无皇冠、武器、服饰、徽章、文字、伪文字、投影、复杂渐变、粒子或水印。
- 资产失败或开关关闭时必须保持现有 Honru v1/程序化 fallback，无空白、无输入阻塞。
- 任何进入运行时的后续代码必须与游戏规则/协议/奖励字段隔离，并可单开关回滚。

## Known Existing Behavior

- `public/assets/brand/honru-mascot-v1.svg` 是当前唯一线上运行时身份资产。
- `art-source/brand/ghost-game/honru/v2/honru-character-master-v2-flat-transparent-draft-v1.png` 是本批唯一角色参考。
- 线上 Manifest 不含本批状态素材；P1 Gomoku Sticker 仍默认关闭。
- 项目自动化质量门禁已通过，但真实设备、Supabase 和网络整形尚未执行。

## Expected UX

- 44–64px 可读出“幽灵手柄”和主要情绪；大图有清晰、可爱、简洁的表情与手势。
- 状态在首页助手、聊天、签到、邀请/等待、结算和游戏关键反馈中保持同一身份语法。
- Light/Dark 与三语言不烘焙文字进图片；素材只承载情绪，文字由 i18n 层提供。
