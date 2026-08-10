# Shop Purchase Feedback P0 本地收口（2026-08-10 19:06）

## 做了什么

- 商城正式账号购买现在有明确的处理中、成功、失败、超时状态；按钮使用 `aria-busy`，状态区使用 `aria-live` / `status` / `alert`。
- 同一时刻只发送一笔购买，快速双击不会重复 mutation。
- 服务端沿用 `purchase_ok/purchase_error`，只增加 `requestId/category/id` 回显；客户端再按账号与商品关联，错配、迟到、关闭商城、断线、注销/换号均不会污染下一笔状态。
- 8 秒超时只解除界面卡死，不宣称服务器已经失败；已发送请求仍使用原有 requestId 幂等。
- 价格、余额、owned、经济流水、Supabase RPC、Reward 和商品 ID 没有改变。

## 主审纠正

Terra Max 已按要求以 `reasoning_effort=max` 创建，但长时间没有交付可审阅文件，随后被中断。主负责人接管并补齐四个关键边界：全部成功/失败分支回显关联字段、账号/商品双绑定、关闭/断线/注销清理、旧 Shop VM 的真实 DOM 属性合同。

## 测试

- `node qa/shop-purchase-feedback-contract.js`：ALL_PASS
- `npm run test:i18n`：ALL_PASS（1485 keys）
- `node qa/dom-smoke.js`、`node qa/shop-contract.js`、`node qa/ui-shop-layout-contract.js`、`node qa/ui-guest-affordance-contract.js`：ALL_PASS
- `node --experimental-websocket qa/security-online.js`：ALL_PASS，真实购买成功回执关联 requestId/category/id
- `node --experimental-websocket qa/supabase-adapter.js`：ALL_PASS
- `node qa/progress-ledger.js`：ALL_PASS（233 项、7 份报告、62 个来源）
- `node scripts/quality-gates.js`：ALL_PASS
- 完整 `npm test`：ALL_PASS（122.3 秒）
- 连续双构建一致：980789 characters / 995152 bytes / SHA-256 `5ACF7F4769D9A1D1642DA736A0AE8210E19FD034FC9E93DAEDB19640644E30F6`

## 尚存门禁

仍需外部浏览器/真机/真实网络整形以及真实 Supabase 浏览器购买可见验收。滚动发布必须先部署后端关联字段，再发布前端；本批未提交、未推送、未部署。
