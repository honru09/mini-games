# P0-06 Gomoku Final Art v1 — 机器技术审查（Reviewer A）

状态：`TECHNICAL_PASS / OWNER_AUTHORIZED_ART_CLEARANCE_CANDIDATE`

- 覆盖 `4` 套棋盘（wood / stone / ink / grass）、`5` 套成对棋子材质、`7` 套无文字语义 VFX、`2` 套镜头板。
- `18` 个 source masters、`36` 个 WebP runtime variants、`1` 张 1200×900 review contact sheet；runtime 总计 `477,912` bytes / `4,194,304` bytes 预算（约 `11.40%`）。
- source master 尺寸：棋盘 1056×1056、棋子/VFX 512×512 Alpha、镜头 desktop 1280×720 / mobile 720×960；Runtime WebP 与 manifest 尺寸、SHA、bytes 三方一致。
- Alpha：12 个透明 source/runtime 族（5 piece + 7 VFX），4 棋盘和 2 镜头保持不透明；没有 `<image>`、外链、脚本、滤镜、文字或动画 SVG。
- mobile 镜头所有 path 在 720×960 viewBox 内；棋盘网格、星位、玩家和结果仍由现有 Canvas/DOM 绘制。
- runtime resolver 独立使用 `gomokuFinalArtManifestPromise`，严格校验 asset ID、runtime ID、version、clearance、source ID、clearance record、flag 与路径 allowlist；Manifest/flag/load/decode/late result 失败保持可逆 fallback。
- `drawGomokuFinalStone()` 只消费表现层材质；`showGomokuFinalVfx()` 只消费 `last / placement / line / draw / thinking / spectate / reconnect` 语义事件；不写入 rule、snapshot、Replay、Authority、AI、Reward、Protocol 或持久化字段。
- CSS/DOM 动效仅使用 transform/opacity、单节点、可清理 timer；`prefers-reduced-motion` 选择 static WebP 并禁用动画。

不声称人工清稿、独立 Reviewer B、IP/法律、逐资产 Golden Set、第二浏览器、真机、真实网络、生产 Supabase 或发布证据已完成。

