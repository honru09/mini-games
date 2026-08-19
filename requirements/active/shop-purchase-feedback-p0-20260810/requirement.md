# Shop Purchase Feedback P0

## 目标

让正式账号在商城发起购买后明确看到“处理中 / 成功 / 失败”的可访问状态，防止重复点击，并确保迟到响应、换号和关闭商城不会污染下一次购买或新账号界面。

## 范围

- 只复用现有 `purchase` / `purchase_ok` / `purchase_error` 协议。
- Pending 与 `requestId + account.uid + category + item.id` 绑定；同一请求期间禁用重复购买。
- 商城提供 `aria-live` / `role=status|alert` 状态，成功/失败继续保留既有 toast。
- 成功后只使用服务端返回档案更新余额/owned；错误保持服务端稳定 reason 翻译。
- 关闭商城、真实断线、注销/换号时清除局部 pending，不修改服务器幂等记录。
- 访客继续只读，连接断开继续 fail-closed。

## 非范围

- 不改服务器价格、扣款、owned、Reward、Economy Ledger、Supabase RPC 或消息类型。
- 不改 G Coins 数值、商品 ID、稀有度、角色经济、游戏规则、AI、Replay 或美术审批。

## 验收

1. 快速双击只发送一次购买 mutation。
2. requestId 相同的响应只结束匹配中的状态；迟到/错误商品/旧账号响应不污染当前商城。
3. 三语言文案同构，状态可由读屏器感知，按钮保持 44px 和明确 disabled。
4. 旧商城价格/owned/访客合同、i18n、DOM、完整回归通过。
