# Shop Purchase Feedback P0 合同

## 状态机

```text
idle -> pending(requestId, uid, category, itemId)
pending -> success | error | cancelled
success/error/cancelled -> idle
```

- `pending` 是客户端视图状态，不是经济事实。
- 只有服务端 `purchase_ok` 的档案能改变余额/owned；本地按钮不得预扣或预发商品。
- `purchase_error` 必须按 reason 本地化，不展示原始未知中文。
- 任何响应若不匹配当前 requestId/账号/商品，只允许保留既有全局安全处理，不得覆盖当前商城 live region 或重新启用错误按钮。

## 生命周期

- 商城关闭：清除 UI 引用、timer 和 pending 展示；不撤销已发送请求。
- 真实断线 / logout / account switch：清除 pending 展示；后续档案仍由现有会话鉴权保护。
- 8 秒超时只解除界面卡死并提示连接状态，不宣称购买失败；服务端幂等 `requestId` 仍是权威。

## 回滚

删除本地状态控制器后可回退到既有 toast + 8 秒按钮恢复；服务器协议、价格和幂等不受影响。
