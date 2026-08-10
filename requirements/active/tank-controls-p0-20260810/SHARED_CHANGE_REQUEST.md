# Shared Change Request

## 范围

Tank Controls P0 只在客户端 Tank 插件、Game Stage 样式、三语辅助文案和专项 QA 内工作。`server/index.js`、`server/gameplay/tank-sim.js`、WebSocket 消息、`shared/**`、`supabase/**`、奖励和账号数据不改。

## 兼容说明

- 摇杆的角度/力度只在客户端转换为既有 `up/right/down/left/fire` 布尔对象；不把坐标、角度、力度写入快照或协议。
- 既有 `tank-host-relay-v1` 与 `tank-authority-v1` 的 `seq`、`matchId`、`clientTick` 和服务端身份校验保持不变。
- 生成的 `public/index.html` 只由 Master 运行 `scripts/build.js` 写入。

## 集成与验收

Terra Max 只编辑 ownership 中的客户端/QA 文件；Master 审核差异后负责生成物、台账、状态报告和三份中文日志。由于新控制区不再只有两个子节点，Master 同步调整 `qa/e2e-online.js` 直接定位 `.tank-joystick/.tank-fire`，不改变线上协议。必须通过 `qa/tank-controls.js`、既有 Tank/Gameplay/DOM/i18n/响应式/联机回归、Quality Gates 与完整 `npm test` 后，才可将任务标为本地验收完成。
