# P2-01 机器技术审查（Reviewer A）

结论：`TECHNICAL_PASS / LOCAL_ONLY`

- 4 个源母板均有稳定路径、SHA-256、尺寸、字节与项目许可记录。
- 20 个 Runtime WebP：desktop 1920×1080、mobile 900×1200、poster/mini 640×360、animated 720×405。
- 8 个目录项使用 32–39 稳定 ID；静态 24 G Coins、动态 32 G Coins，服务端价格继续权威。
- 总 Runtime 2,022,638 bytes，低于 10 MiB 家族预算；每个 poster 低于 180 KiB，每个 animated 低于 1.5 MiB。
- 动态背景复用现有 preload、visibility、IntersectionObserver、reduced-motion、失败回退与 release 清理链。
- Feature flag：`mg_art_seasonal_backgrounds_v1`，default-on，精确值 `0` 回滚。
- Fallback：seasonal animated → same-season desktop → 原 Premium Background → CSS theme surface。
- 未新增计时器、协议、赛季状态、Remote Config、奖励、社交排名或 Supabase 字段。
- 人工清稿、自然人 Reviewer B、IP/法律意见、第二浏览器与真机为未执行的可选/外部证据，不冒充 PASS。

