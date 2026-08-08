# Ghost Game 品牌资产 v1

本目录保存 Ghost Game 的可追溯母版与 Honru 概念候选。临时品牌名固定为 `Ghost Game`，角色名固定为 `Honru`。

## 目录与状态

- `source/ghost-game-mark-master-v1.svg`：原创单色几何图形母版，允许进入 P0 运行时。
- `source/ghost-game-wordmark-master-v1.svg`：无字体依赖的线性字标母版，允许进入 P0 运行时。
- `honru/honru-mascot-master-v1.svg`：从空白路径确定性绘制的正式 Honru P0 母版，允许进入运行时。
- `honru/honru-generated-candidate-v1.png`：项目自有生成式概念候选，仅供后续人工清稿；禁止直接接入运行时。
- `honru/rejected/honru-clean-alpha-rejected-v1.png`：失败的自动透明清理结果；白色本体被错误删除，永久拒绝接入运行时。
- `PROMPT_AND_PROVENANCE_v1.md`：设计提示、来源、哈希与许可边界。
- `IP_REVIEW_v1.md`：相似性与运行时准入审查。

运行时副本：

- `public/assets/brand/ghost-game-mark.svg`
- `public/assets/brand/ghost-game-wordmark.svg`
- `public/assets/brand/honru-mascot-v1.svg`

以上三项已由主任务登记到 `asset_manifest.json` 并完成页面集成；生成式 PNG 与失败清理 PNG 均不在 `public/`。

## 设计约束

- 幽灵身体与手柄轮廓是同一个闭合几何形，不叠加独立手柄道具。
- 左眼为十字键负形，右眼为四枚圆点负形；不依赖颜色区分。
- 仅使用 `currentColor`，默认可呈现黑色；置于深色背景时以行内 SVG / `object` 的颜色上下文切换为白色。
- Mark 的母版坐标为 64×64；24px 使用时仍保留十字键、四点与双手柄抓握轮廓。
- 无渐变、滤镜、位图纹理、文字字体、第三方徽记或品牌构图。

## 小尺寸规则

- 16–31px：只使用 Mark，不使用完整 Wordmark。
- 24px：最小推荐尺寸；不得增加描边、阴影或压缩负形。
- 32px 以上：可使用 Mark；完整 Wordmark 推荐高度不低于 24px。
- 安全区：至少保留 Mark 宽度的 `1/8`。

## 反转示例

```html
<!-- 应用组件内联同一份母版 mask/path，只改变根 SVG 的 color。 -->
<svg class="ghost-game-mark" style="color:#000" aria-label="Ghost Game">…母版内容…</svg>
<svg class="ghost-game-mark" style="color:#fff" aria-label="Ghost Game">…同一母版内容…</svg>
```

外链 `<img>` 不继承页面 `color`；若页面需要由主题直接驱动 `currentColor`，应内联 SVG 或通过受控组件注入母版。禁止为反转生成未经登记的临时位图副本。
