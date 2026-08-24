# PROVE P5 证据合同

- 任何 `currency=current` 的可见证据必须同时匹配 `build.sha256/bytes` 和完整 `presentationIdentity`。
- `presentationIdentity` 必须包含表现 fileCount/bytes/SHA、布局 fileCount/bytes/SHA 与 cacheVersion。
- 模板中的所有场景初始状态固定为 `NOT_EXECUTED`；只有真实浏览器执行后才能逐项改为 `PASS/FAIL`。
- 单一 Chromium 不授予第二浏览器、物理设备、真实网络、低端性能、Supabase 或发布结论。
- 构建或任一 CSS/cache 身份变化后，旧证据自动降为 `historical-as-of`。

