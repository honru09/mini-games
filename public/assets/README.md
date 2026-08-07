# Mini Games 运行时美术资源

本目录是白皮书与《美术资源制作清单》的工程落点。`manifests/asset_manifest.json` 是当前权威索引；运行时路径使用相对地址，兼容 GitHub Pages 子目录部署。

- `brand/`：Playroom 品牌标志与字标。
- `ui/`：平台公共 UI 资源，首批接入虚拟现金 SVG。
- `ui/game_covers/`：已接入五子棋与俄罗斯方块 640×360 / 320×180 响应式封面。
- `board/gomoku/`：五子棋木纹底材；15×15 网格、星位、棋子和命中区仍由 Canvas 绘制。
- `board/tetris/`：俄罗斯方块玻璃井底材；10×18 网格、方块和状态仍由 DOM/CSS 绘制。
- `manifests/`：稳定 asset ID、6 款游戏 runtime ID、状态、fallback 和 a11y 说明。

任何新资源必须保留 CSS/Canvas/DOM Emoji/WebAudio fallback，并在资源、源码、manifest 和 QA 同一批提交。

P0 纵切默认开启，可用以下本地 feature flag 独立回滚并刷新页面：

- `localStorage.setItem('mg_art_gomoku_v1', '0')`
- `localStorage.setItem('mg_art_tetris_v1', '0')`

删除对应 key 或设为非 `0` 即恢复。关闭 flag 只影响绘制层，不改变规则、快照、联机消息或结算。
