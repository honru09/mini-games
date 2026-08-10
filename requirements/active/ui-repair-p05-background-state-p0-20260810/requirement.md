# UI Repair P0.5：动态背景预览状态一致性

## 目标

修复商城/个人背景的 animated WebP 失败回退和异步播放状态同步，使 poster/static fallback 永远可见，播放按钮与真实状态一致。

## IN

- `applyPremiumBackground` 的 animated 失败、poster/static fallback、observer、visibility、reduced-motion 和 cleanup。
- Shop 预览播放/暂停按钮的实时 aria/text/status 同步。
- 专项 QA、商城合同、三语/DOM/完整回归。

## OUT

- 不改商品价格、购买/装备 RPC、访客权限、Supabase、服务端、规则、AI 或美术审批。
- 不改 locale key，除非已有稳定文案不足且需最小同步。
- 不提交、不推送、不部署。

