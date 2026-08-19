# Code Health / Health Sweep P1

本地完成：`npm run test:health` 统一覆盖 QA/脚本入口、四个线上运维工具 allowlist、Manifest integrated 路径、Feature Flag 消费者、发布临时 helper、需求治理状态，以及原先未注册的持久化/AI 强化与社交 Guard QA。

本轮确认并清理：被当前 `qa/theme-contrast-design-system.js` 取代、要求旧设计令牌且未被任何入口引用的重复 Theme Contrast 合同；只服务一次隔离发布、含固定历史提交文案的 `scripts/publish-isolated.js`；Manifest 内无运行时消费者的 `mg_companion_honru_v1` 陈旧字段。正式 Honru SVG 与 fallback 均保留。

持续边界：本能力是治理 Gate，不代表以后无需继续 Health Sweep。未修改游戏规则、协议、奖励、Supabase、未审批美术 runtime，也未执行提交、推送或线上部署。
