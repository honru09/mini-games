# Profile Compare P1：正式好友窄化战绩比较

状态：`IMPLEMENTED_LOCAL`
时间：2026-08-10（Asia/Tokyo）

## Goal

为正式好友提供双列战绩比较，同时保证公开 Profile 不被扩成私有数据通道。

## IN

- `profile_compare/profile_compare_data/profile_compare_error` 成对消息。
- 仅正式账号、当前好友、双方未屏蔽；异步回执绑定 requestId + targetUid。
- 窄化投影：公开身份、等级、总局数、总胜场、六款胜场/称号、成就数量。
- Profile 好友弹层入口、加载/取消/迟到响应、三语、a11y、手机单列。

## OUT

- 禁止余额、owned、价格、购买记录、任务、回放、最近对手、在线偏好、账号凭据进入比较。
- 不修改 Reward、胜场写入、商城、Supabase、规则、AI、Replay 或美术。
- 不提交、不推送、不部署。

## Acceptance

- `node qa/profile-compare-contract.js`：通过。
- `node --experimental-websocket qa/profile-compare-online.js`：三账号权限、好友、Block、窄化投影和畸形 requestId 全通过。
- `npm run test:i18n`、`node qa/dom-smoke.js`、`node qa/ui-profile-social-contract.js`：通过。
- 完整 `npm test`：118.1 秒通过。
- 双构建一致：951578 characters / 965692 physical bytes / SHA-256 `5528D0C6A15C42D096E92B2BA8A7454C1C9332FA414A52497312325496776934`。
- 未执行第二浏览器、Android/iPhone/Tablet、真实网络和线上发布。
