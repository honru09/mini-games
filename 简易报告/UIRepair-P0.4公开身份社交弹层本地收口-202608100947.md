# UI Repair P0.4：公开身份与社交弹层本地收口简易报告（2026-08-10 09:47）

## 做了什么

- 公开 Profile 的昵称、签名、性别自定义原文与系统状态/按钮文案分离：真实玩家文字走 `textContent + data-i18n-raw`，系统 fallback 保持三语言切换。
- 排行榜、玩家列表、社交列表、房主席位、邀请/举报/Block 弹层的玩家入口改为独立可聚焦按钮，避免包含 Invite 等操作的整行伪装成按钮。
- Profile、邀请、举报、社交动作、Blocked 用户弹层统一使用命名 dialog、初始焦点、Tab 循环、Esc/背景关闭、焦点恢复和 modal scroll-lock，关闭清理幂等。
- 个人编辑器背景色板改为 radio 按钮组，选择状态通过 `aria-checked` 同步；Chat 系统 fallback 不再被错误 raw 冻结。
- Lobby 合同测试同步到新的安全原文 helper；未修改社交协议、服务端权限、规则、奖励、经济或数据库。

## Terra Max 与主负责人审核

- Terra Max 负责 P0.4 边界审计、Profile/社交弹层实现和专项 VM 合同。
- 主负责人发现并修正：DOM 冒烟最小 document 对 `createTextNode` 的兼容问题、排行榜键盘入口、背景 radio 语义、Chat 系统 fallback raw 边界，以及一条仍期待旧 `elRaw` 形态的 Lobby 测试断言。

## 验证

- `npm run test:ui-profile-social`：`UI_PROFILE_SOCIAL_CONTRACT_ALL_PASS`。
- `node qa/ui-identity-preview-contract.js`、`node qa/player-chat-contract.js`、`node qa/profile-route-contract.js`、`node qa/ui-room-lobby-contract.js`、`node qa/social-match-contract.js`：全部通过。
- `npm run test:i18n`、`node qa/dom-smoke.js`、`npm run quality:gates`：全部通过。
- 最终 `npm test`：ALL_PASS，127.2 秒。
- 构建产物 `public/index.html`：912517 bytes；SHA-256 `581E760A92E5FC5046F4388C21C93C6552346E6471BDC71F972BB709CCC1F537`。
- 需求台账：233 项、7 份机器生成分类报告、60 个来源、235 条依赖边，全通过。

## 仍未完成

- 不在排行榜缓存中的公开 Profile 权威拉取/加载态仍留给下一批。
- 访客只读/禁止好友、邀请和商城 mutation 的 UI 提示仍留给下一批。
- 第二桌面浏览器、Android/iPhone/Tablet、真实网络整形、浏览器 reduced-motion 可见复核和真实 Supabase 仍是外部闸门。
- 未审批美术继续 `reference-only`，不进入 runtime。

## 发布状态

本批仅本地验收完成；未提交、未推送、未触发 GitHub Pages 或 Render。等待用户明确“输出线上 / 推送 / 部署”。

