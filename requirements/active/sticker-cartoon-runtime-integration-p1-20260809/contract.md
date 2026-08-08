# P1 运行时契约

## Feature flags

- 总闸门：`mg_art_sticker_m0_v1`。
- 分闸门：`mg_art_gomoku_sticker_v1`。
- 唯一启用条件：两个 localStorage 值都严格等于字符串 `1`。
- 默认、缺失、`0`、损坏值或异常读取全部解释为关闭；禁止沿用旧旗标“非 0 即开”的语义。

## Asset authority

- `public/assets/manifests/asset_manifest.json` 是唯一运行时机器事实源。
- `art-source/style/golden-set-source-manifest-v2.json` 继续作为来源/provenance sidecar；它不替代运行时 manifest。
- P1 资产使用新的稳定 asset ID 和版本化路径，不覆盖 `G-02-BOARD-SURFACE` 或任何 M0 Draft 源。

## Rule authority

- `public/src/games/gomoku.js` 的 15×15 数组、点击到交点映射、合法性、五连判定、AI 调度、结果和联机数据是规则真相。
- 新资产与开关只能改变绘制参数或装饰层，不得进入状态、快照、候选、消息或结算。

## Failure behavior

- Manifest 缺项、资源 404、SVG 解码失败、开关读取异常或主题切换异常时，回退既有 `mg_art_gomoku_v1`；该旧旗标关闭时再回退程序化 Canvas。
- 失败不得阻塞 `init`、点击、重开、AI 或联机；不得显示裸 asset ID 或报错弹层。
- reduced-motion、页面隐藏和离屏继续使用同一静态底材；不得添加持续 Canvas 循环、计时器或动画资源，P1 只在既有重绘时更新。

## Compatibility

- 不新增/修改 WebSocket 字段、服务端消息、Supabase 列、商城 ID、owned/equipped、Reward 或 Replay 字段。
- 旧账号与旧 localStorage 值可继续使用；仅显式双 `1` 进入 P1。
- `public/index.html` 由构建生成，并与源码保持 drift=0。

## Rollback

- 运行时：任一 P1 开关设为 `0` 或删除即可回到当前表现。
- 代码：回滚 P1 提交；Ghost Game 发布提交 `aac40da` 与 M0 Draft 提交 `76262bd` 均保留。
