# P0-11 合同冻结

`P-AVATAR-FRAME-EFFECT-V1` 的资产解析器是 presentation-only。客户端只能请求 allowlist 内的 kind/id/size/mode；Manifest、feature flag、source ID、clearance record 或路径任一不匹配时返回空字符串并保留 CSS fallback。所有装饰图 `aria-hidden`，不进入 wire、localStorage、Replay、Analytics、AI、Reward 或数据库。

本批同时在既有 `effects` 商品分类追加稳定 ID 5–8；价格仅存在于客户端展示目录和服务端 `SHOP_PRICES`，购买仍复用既有 `purchase`、服务端扣款、owned、requestId 与 Supabase JSON 字段，不新增协议或数据库列。客户端目录与服务端价格必须由 `qa/shop-contract.js` 对 1–8 全量比对。
