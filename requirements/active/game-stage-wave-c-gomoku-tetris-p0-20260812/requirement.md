# Game Stage Wave C：五子棋 + 俄罗斯方块 P0

状态：`REQUIREMENT_FROZEN`

## Goal

在既有 Wave B 密度与稳定 DOM 基线上，为五子棋和俄罗斯方块补齐可处置的局内过程链，使六款游戏都具有明确的行动、反馈、结算过程，而不是只显示一个棋盘或主井。

## IN

- 五子棋 `turn → aim/select → place → impact → line/check → terminal` 纯表现链。
- Tetris `spawn → fall/move/rotate → lock → line-clear → combo/B2B/T-Spin/perfect-clear/garbage → terminal` 纯表现链。
- 桌面、平板、390×844、844×390 的 Arena 满幅密度。
- AI、联机、观众、authority restore/reconnect、reset/destroy、reduced-motion 和迟到 timer/snapshot。
- 专项 QA、正式测试链、需求台账、分类报告和中文日志。

## OUT

- 服务端、WebSocket、规则核心、AI 强度、奖励、Replay、商城、Supabase 或协议变化。
- 未审批图片、Honru Emoji、Sticker、G Coins 或 Avatar 候选进入 runtime。
- 以页面滚动驱动局内输入，或用不可清理动效阻塞 Replay。
- commit、push、Pages 或 Render 部署。

## Non-negotiable

- 过程状态不得进入规则 snapshot、serialized state 或 wire payload。
- 终局状态不得被迟到 authority snapshot、clock、AI 或 quiet timer 降级。
- reset、restore、reconnect 与 destroy 必须使旧 epoch/revision 的异步表现失效。
- reduced-motion 直接进入可理解的稳定状态；所有输入仍保持键盘、触控和 44px 合同。
- GSAP 只允许 transform/autoAlpha、可 kill 的 Core/Timeline；禁止 ScrollTrigger 驱动局内状态。

## Expected UX

- 五子棋玩家能立刻读出当前行动、落子、冲击、连线与终局阶段。
- Tetris 玩家能立刻读出方块生成、操控、锁定、消行、战斗加成与终局阶段。
- 过程轨与 Arena 构成一个完整游戏舞台，不挤压 Seat Rail、Command Slot、聊天/表达和 Overlay。

