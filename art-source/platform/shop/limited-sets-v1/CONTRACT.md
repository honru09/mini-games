# P2-11 / P-SHOP-LIMITED-SETS-V1

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / IMPLEMENTED_LOCAL / RELEASE_EVIDENCE_PENDING`

本单元把既有商城单品组织成四套 Ghost-native 季节限定陈列：春日信号、夏潮航线、秋灯典藏、
冬夜观测。每套只组合已有头像、头像框、效果与背景 ID，提供组合预览、4 项收集进度和跳到
现有单品的入口。

## 权威边界

- 不创建 SKU、套装商品、价格、折扣、库存、倒计时、Remote Config、购买请求或 owned 字段。
- 本单元不拥有服务器价格、Reward、Economy、Profile、Supabase、协议或持久化；本批发现的既有
  `apply_purchase_v1` 白名单漂移已作为独立 Shared Repair 同步到服务端目录并加入全目录同构回归，
  不新增套装经济事实。
- “限定”只表示本地视觉策展系列，不表示限时销售、稀缺性或未来可用性承诺。
- 卡片 decode/Manifest/flag 失败时保留代码原生季节色块；整个模块失败或 flag 关闭时回到既有商城。
- Runtime 使用项目自有 GPT Image 2 原创 PNG 母版的确定性 Sharp WebP 派生；外部 blocked-license
  素材、像素、图层和导出物为 0。

## 回滚

设置 `mg_art_shop_limited_sets_v1=0` 即隐藏限定陈列，商城单品、价格、购买、装备和预览路径保持原样。
