# Game Stage Wave B：五子棋与俄罗斯方块本地实现（2026-08-11 13:56）

## 这次做了什么

- 五子棋增加独立的 Wave B Arena、棋盘框、当前状态和最后落子坐标层，不改 15×15 坐标、点击、AI、联机或胜负。
- 俄罗斯方块把主井、Hold、Next、Incoming、对手井、战斗 HUD 和七项控制拆成稳定节点，解决旧版文字堆叠和缺少布局控制的问题。
- 共享样式按五子棋/Tetris 单独作用，覆盖桌面、平板、390px 竖屏与低高度横屏；七项控制保持至少 44px。
- 总开关 `mg_art_game_stage_wave_b_v1` 默认启用，只有精确 `'0'` 回退原 Wave A；storage 读取失败安全回退 Wave A。

## 主负责人审核纠正

- Terra 五子棋最初把未知 flag 也回退，Tetris 最初在 storage 异常时继续启用；已统一为“仅 `'0'` 回退，storage 异常 fail-closed”。
- 共享 CSS 最初有两条会在 Wave A 回滚时继续改变 Arena/指令栏的选择器；已改为只在 Wave B class/`:has()` 出现时生效。
- 新增共享布局 QA，并把三项 Wave B 测试加入完整 `npm test`，避免未来遗漏。

## 测试

- Wave B 五子棋、Tetris、共享布局专项：通过。
- Game Stage、Immersive Shell、Tabletop、Tetris Rule Core / Battle Protocol：通过。
- 三语言 1605 个同构 key、DOM 冒烟：通过。
- `npm run quality:gates`：通过。
- 完整 `npm test`：通过，154 秒。
- 双构建一致：1,116,957 bytes；SHA-256 `15D803ABFF1AEB87A970DADADCD7302C8BC87B3C7DAC63625A7001DF3A0BC67A`。

## 还没完成

- in-app 浏览器连接器能控制旧本地标签，但标签始终返回旧缓存构建，无法保存最新 Wave B 可见截图；因此本项状态是 `implemented`，不是可见 `verified`。
- 第二桌面浏览器、Android、iPhone、真实 Tablet、真实网络整形、浏览器 reduced-motion 可见复核未执行。
- Honru Emoji、Sticker、六款最终位图仍未经过人工清稿、Reviewer B、IP Review 和 Golden Set，不进入 runtime。

## 发布状态

未提交、未推送、未部署；线上仍为 `da3d05c`。
