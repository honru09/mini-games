# Ghost Game 品牌资产审计证据

时间：2026-08-08 20:54 +09:00
范围：审计 Ghost Game 品牌母版、三个运行时 SVG 与 Honru 概念/拒绝源归档。

## 交付

- `public/assets/brand/ghost-game-mark.svg`：64×64 单色几何 Mark，`currentColor` 输出。
- `public/assets/brand/ghost-game-wordmark.svg`：410×64 无字体依赖几何 Wordmark，`currentColor` 输出。
- `public/assets/brand/honru-mascot-v1.svg`：确定性手工 SVG，当前唯一正式 Honru P0 运行时资产。
- `art-source/brand/ghost-game/source/*`：与运行时候选一一对应的母版。
- `art-source/brand/ghost-game/honru/honru-generated-candidate-v1.png`：仅源归档，不接入 public。
- `art-source/brand/ghost-game/honru/rejected/honru-clean-alpha-rejected-v1.png`：失败透明清理样本，永久拒绝接入。
- `art-source/brand/ghost-game/PROMPT_AND_PROVENANCE_v1.md`：Prompt、来源、哈希与已知缺陷。
- `art-source/brand/ghost-game/IP_REVIEW_v1.md`：Mark 准入与 Honru 禁止发布裁决。

## 合同检查

| 检查 | 结果 | 证据 |
|---|---|---|
| 幽灵身体即手柄 | PASS | Mark 只有一个闭合外轮廓；双握把直接属于身体 |
| 左眼十字键 | PASS | 透明负形路径 `M19 28...` |
| 右眼四圆点 | PASS | 四个半径 2 的透明负形圆 |
| 黑白极致对比 | PASS | 可见图形只使用 `currentColor`，控制器与笑脸使用透明负形 |
| 24px 可读设计 | PASS_STATIC | 64 单位母版在 24px 时，十字键约 4.5px、圆点直径约 1.5px，未引入细于 1px 的可见实线 |
| 黑白反转 | PASS_STATIC | SVG 中无硬编码可见填色；黑/白均由宿主 `color` 决定 |
| 无字体依赖 | PASS | Wordmark 由 SVG path 构成，无 `<text>`、外链字体或脚本 |
| 运行时隔离 | PASS | 只有确定性 Honru SVG 进入 manifest；两个 PNG 均只位于 `art-source` |
| 来源可追溯 | PASS | 生成任务 ID、源路径、SHA-256、尺寸、Alpha 状态均记录 |
| IP 准入 | CONDITIONAL | Mark 可进入 P0 集成；Honru 仍为 `DO_NOT_SHIP`，二审未执行 |

## 实测结果

- 四个 SVG（两个母版、两个运行时候选）均通过 PowerShell XML 解析。
- Mark 母版与运行时文件 SHA-256 均为 `df7d06e492b23cd35199596499550797bae828f30820e18a0f96745b5244b452`。
- Wordmark 母版与运行时文件 SHA-256 均为 `203d86fca82f1a86583fe200c8eb2b7ca72d47fe9a8d6bf1363db824945a669e`。
- Honru 确定性母版与运行时文件 SHA-256 均为 `42c6442efc3d86ef6d939d936bff3c83a59c46c63002fa817ea4551da3a2de64`。
- Honru 归档与原始生成文件 SHA-256 均为 `d1c9b2486e82bc5d7e94df90f1182e285e2f5b59ba788b9896a14bca112c1da9`。
- Microsoft Edge Headless 已分别以 500×500、820×128 渲染 Mark 与 Wordmark；没有 XML 解析错误、路径裁切或字体替换。
- 将 Mark 内联并设置 `color:#fff` 后，Microsoft Edge 在纯黑背景上正确渲染白色轮廓与黑色负形，实际反转通过。
- 500×500 Mark 渲染稿降采样至 24×24 后，十字键、四点眼、弧线嘴与双握把仍可辨认。
- 目标运行时 SVG 经定向文本检查，不含 `<text>`、渐变、滤镜、脚本或外部 HTTP 引用。

## 自检命令（完成时执行）

```powershell
[xml](Get-Content -Raw public/assets/brand/ghost-game-mark.svg)
[xml](Get-Content -Raw public/assets/brand/ghost-game-wordmark.svg)
rg -n "currentColor|<text|gradient|filter|script" public/assets/brand/ghost-game-*.svg
Get-FileHash -Algorithm SHA256 art-source/brand/ghost-game/honru/honru-generated-candidate-v1.png
git status --short -- art-source/brand/ghost-game public/assets/brand/ghost-game-mark.svg public/assets/brand/ghost-game-wordmark.svg requirements/active/ghost-game-rebrand-p0-20260808/evidence/brand-assets-audit.md
```

## 未执行

- 页面集成与 manifest 登记已由 Master 完成；确定性 Honru SVG 已在登录后首页、Chat 与助手浮层中通过深浅主题浏览器验收。
- 生成式 Honru 的人工清稿、动画分层与 Reviewer B 未执行；生成候选继续禁止发布。
