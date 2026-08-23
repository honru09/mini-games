# P2-02 / P-HONRU-SEASONAL-V1 冻结合同

状态：`QUEUED_CONTRACT_FROZEN / LOCAL_ONLY / NOT_RELEASED`  
日期：2026-08-22

## IN

- 只使用最新版项目自有身份锚 `context-reactions-v1/source/honru-hand-corrected-master-v1.png`。
- 四个文化中性 edition：`spring-bloom / summer-cloud / autumn-leaf / winter-star`。
- 每个 edition 一张透明角色源母版；确定性派生 `hero-320 / reaction-160 / mini-96 / celebration-320`，共 16 个 Runtime WebP。
- 当前 build-time `activeEdition = summer-cloud`；只有 `idle / ready / celebration` 可使用限定表现，其他语义状态继续使用基础 Honru Context。
- 单一 flag `mg_art_honru_seasonal_v1`；缺失或精确 `1` 开启，精确 `0`、非法值、storage/Manifest/decode 失败均回退。
- Runtime 总预算 2 MiB，单 edition 解析与加载预算 512 KiB。

## 身份锁

- 三段火焰头型、奶白主体、深墨粗圆轮廓、淡腮红、小弧微笑保持不变。
- 左眼固定十字方向键，右眼固定恰好四个圆键，位置不可交换或遮挡。
- 保持手柄/幽灵同体、中央腿间负形、双脚和正面比例。
- 双手必须是单团圆润 Q 版幽灵手；禁止手指、拇指、手掌、指节、指甲、指缝和拳头结构。
- 透明背景、无文字、无 Logo、无水印；季节差异只来自近身配件、姿态和有限外围装饰，不重染主体。

## OUT

- 不实现日期、时区、节日时钟、LiveOps、Remote Config、自动过期或玩家选择器。
- 不实现 Battle Pass、活动任务、奖励、排行榜、购买、owned、限时价格或新持久字段。
- 不改 Cursor、Edge role、Emoji、Quick、投掷 wire、Direct Chat、Match Chat、Rule、Authority、Reward、Replay、AI、Analytics、Supabase。
- 不新增 Emoji/Context/协议 ID，不生成 P2-03 贴纸册，不使用 Three/GLB。
- 不使用任何外部 blocked-license 素材、商业角色、商业游戏风格捷径或在世艺术家名称。

## 回退

`P-HONRU-SEASONAL-V1 → P-HONRU-CONTEXT-REACTIONS-V1 → P-HONRU-STATES-V1 → P-002-HONRU-MASCOT-V1 SVG → 不渲染装饰节点`。

reduced-motion 使用静态派生；forced-colors 跳过限定覆盖。限定图只替换现有图片 source，不新增 DOM、监听器、Timer 或 GSAP Adapter。
