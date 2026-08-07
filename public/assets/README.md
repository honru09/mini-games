# Mini Games 运行时美术资源

本目录是白皮书与《美术资源制作清单》的工程落点。`manifests/asset_manifest.json` 是稳定 Asset ID、运行时路径、fallback、a11y、来源和许可证的唯一索引；所有运行时路径使用相对地址，兼容 GitHub Pages 子目录部署。

## 目录

- `brand/`：Playroom 品牌标志与字标。
- `ui/`：平台公共 UI 资源与虚拟现金 SVG。
- `ui/game_covers/`：五子棋、俄罗斯方块 640×360 / 320×180 响应式封面。
- `avatars/v2/`：六主题 48 款头像及 `avatar_catalog_v2.json`；64/128/256 Poster 与 12 款 Animated WebP。
- `backgrounds/v1/`：六主题 12 款 Premium Background 及 `background_catalog_v1.json`；每主题包含 Desktop、Poster、Mobile、Mini、Animated 与 Static Fallback。
- `icons/ui/`：Lucide 1.27.0 Vendor SVG 子集；`SOURCE.md`、`LICENSE` 保留来源、包完整性和 ISC/MIT 许可。
- `board/gomoku/`：五子棋木纹底材；15×15 网格、星位、棋子和命中区仍由 Canvas 绘制。
- `board/tetris/`：俄罗斯方块玻璃井底材；10×18 网格、方块和状态仍由 DOM/CSS 绘制。
- `manifests/`：当前权威资产清单。

## 加载与性能规则

- Lobby Initial 不预载 Premium Animated Background、全部头像大图或商城动画。
- 普通列表头像只加载 64 Poster；Mini/Full Profile 和主动商城试用才允许动态头像。
- Premium Background Poster 必须 ≤180 KB，Animated WebP 必须 ≤1.5 MB；当前 `qa/asset-manifest-v2.js` 检查实际大小、尺寸、路径与帧格式。
- 动态背景同一时间只允许一个可见 Profile 或一个明确商城预览播放；离屏、页面隐藏、`prefers-reduced-motion`、网络或解码失败都回退 `staticFallback`。
- 图标通过 `public/src/core/06-assets.js` 的 `icon(name,size,label?)` 白名单加载。装饰 SVG 使用 `aria-hidden`；icon-only 按钮必须由调用方提供 `aria-label`。
- 新平台操作使用统一 SVG；游戏娱乐 Emoji 可以保留，但不能替代关键操作的可访问名称。

## 兼容与回退

任何新资源必须保留 CSS / Canvas / DOM Emoji / WebAudio fallback，并在资源、源码、manifest 和 QA 同一批提交。头像旧 ID `0–55` 保留历史读取/装备兼容，不进入新注册或新商城目录。

P0 游戏纵切默认开启，可用以下本地 feature flag 独立回滚并刷新页面：

- `localStorage.setItem('mg_art_gomoku_v1', '0')`
- `localStorage.setItem('mg_art_tetris_v1', '0')`

删除对应 key 或设为非 `0` 即恢复。关闭 flag 只影响绘制层，不改变规则、快照、联机消息或结算。

## 资源复现与验收

- 母图与 Prompt：`art-source/`。
- Premium Background 构建：`scripts/build-premium-backgrounds.py`。
- 资产回归：`node qa/asset-manifest-v2.js`。
- 图标回归：`node qa/icon-system.js`。
- 浏览器证据：`deliverables/visual-qa/`，包含 1440/1024/768/390/360、六主题、房间 Seat、Social 与 Premium Preview。
