# Honru Runtime Integration P2：平台与六游戏共享局内反馈

## Goal

依据《Mini Games Platform 全项目美术风格统一与深度重制执行报告》的 Golden Set→平台→六游戏顺序，把 Honru 表情状态素材接入一个可回滚的共享运行时预览，同时修复登录页黑夜主题 Logo 对比度问题。先证明共享组件、默认关闭、主题/i18n、reduced-motion、失败回退和游戏规则隔离，再扩大到各游戏专属表情与动画。

## IN

- 登录前 Ghost Game Logo 在 `light/dark` 下均保持可见，外部 SVG 使用显式主题 filter；增加静态契约测试。
- 将 Honru 九状态三色平涂图转为 `public/assets/brand/honru/states-v1/*.webp` 本地运行时预览，加入 Manifest 稳定 ID、hash、fallback、字节预算和双闸门。
- 新增共享状态解析/展示：状态 ID 仅为 `idle/thinking/surprised/win/lose/recover/waiting-invite/check-in/playful`；游戏反馈从既有 `playFeedback()` 触发，不改变规则、快照、AI、联机协议或奖励。
- 在 `board-area` 内显示轻量 Honru 角落反应，覆盖六款游戏共用路径；当前默认关闭，显式双旗标才启用，资源失败回退现有 v1 SVG/不显示。
- 接入平台签到/聊天/邀请/等待/结算的状态映射合同和默认关闭 CSS/DOM 预备，不新增服务端消息。
- 继续沿用报告的统一 Ink/Paper/Cream、圆角厚线、左上光/右下接触影、短促可打断动效和 reduced-motion 静态替代。

## OUT

- 不在本批默认打开新状态，不宣称人工风格/IP或生产就绪通过。
- 不修改六款游戏规则、Canvas 坐标、AI 候选/学习、WebSocket 消息、Supabase、Reward、商城 owned/equipped 或 i18n 词典结构。
- 不批量翻新 48 Avatar、Legacy Avatar、完整六游戏棋盘/棋子、Spine/AE/GLB 或外部素材库上传。
- 不删除旧素材；所有旧 ID、v1 SVG、P1 Gomoku、Tetris 风格和 CSS/Canvas fallback 保留。

## Non-negotiable

- 两个本地旗标均严格等于字符串 `1` 才允许 Honru 状态预览；缺失、异常、任一非 `1` 均关闭。
- 状态字段只存在表现层 DOM/CSS，不进入游戏状态、序列化快照、回放 moveLog、联机协议、AI 学习和奖励结算。
- `prefers-reduced-motion`、页面隐藏、游戏销毁、资源 404/decode 失败都必须静态/安全回退且不阻塞输入。
- 黑夜模式不得出现黑色 Logo 融入星空；Logo 与文字对比度必须通过静态审计。

## Known Existing Behavior

- `public/assets/brand/honru-mascot-v1.svg` 是当前线上唯一默认 Honru；P1 Sticker Gomoku 双闸门默认关闭。
- 九状态素材已在 `art-source/` 完成自动审计并提交；本任务首次将其转为本地预览运行时副本，但仍以 default-off 为边界。
- 当前质量门禁和完整 `npm test` 已通过；真实设备、Supabase、网络整形仍是 Release Candidate 阻塞项。

## Expected UX

- 登录页切到黑夜后 Logo 清楚可见；语言切换不闪烁、不丢失主题。
- 游戏操作时，Honru 只在关键反馈短暂出现，体量不遮挡棋盘/控制，不常驻抢焦点；胜负/思考/等待等状态一眼可读。
- 关闭旗标或加载失败时，游戏与旧视觉完全可玩，用户看不到裸 asset ID 或错误弹层。
