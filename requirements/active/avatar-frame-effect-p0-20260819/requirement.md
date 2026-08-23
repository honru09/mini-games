# P0-11 Avatar Frame / Effect 本地实现

## IN

- 8 个头像框与 8 个头像效果的 Ghost-native 透明原子。
- 44/64/96/192 尺寸、static/dynamic/high-contrast 变体。
- 统一身份节点、商城试穿、Profile、Seat、DM、Playline 消费；动态/静态/reduced-motion/fallback。
- 在既有 `effects` 商品分类内追加稳定 ID 5–8，并继续由服务端价格、扣款、owned 与 requestId 权威处理。
- Manifest/Catalog、Skill Routing、provenance、机器技术审查、日志和进度报告。

## OUT

- 不改变 owned/购买协议与权威算法、奖励、数据库结构、游戏规则或 AI；仅扩展四个服务端权威商品目录项。
- 不把人工清稿、Reviewer B、IP/法律或真机证据伪造成完成；不部署线上。

## 完成定义

稳定 ID/SHA、Alpha/尺寸/预算、allowlist resolver、CSS fallback、reduced-motion/forced-colors、三语商品名、专项 QA 与构建检查全部通过。
