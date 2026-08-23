# P0-12 技术审查

- 6 款游戏 × icon 44/64/96 + cover crop/theme icon/selected object；12 个 marker × 24/32/44。
- 36 个 SVG 源稿、72 个透明/卡片 WebP runtime 变体、4 张生成检查板。
- Runtime 总字节 142914 / 1048576：PASS。
- 所有 runtime path、SHA-256、bytes、尺寸、Alpha、Manifest、Catalog、feature flag 与 fallback 由同一确定性脚本生成。
- 生成目录使用资产族独占锁；全局 Manifest/Catalog 读改写使用跨资产族共享注册表锁，防止并行窗口丢失条目。
