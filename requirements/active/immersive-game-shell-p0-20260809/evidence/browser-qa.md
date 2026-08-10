# Immersive Game Shell P0 浏览器验收证据

- 日期：2026-08-09
- 环境：Codex In-app Browser，本地 `http://127.0.0.1:8099/`
- 账号：一次性访客
- 游戏：五子棋、俄罗斯方块

## 四档视口

| 视口 | 游戏 / 主题 | 结果 |
|---|---|---|
| 1440×900 | 五子棋 / Light | Shell `0,0,1440,900`；文档宽度 1440；Wheel、Space、方向键后 `scrollY=0`；五个稳定插槽齐全 |
| 1024×768 | Tetris / Dark | Shell `0,0,1024,768`；双列 `638.953px 340px`；七项操作均高 44px；Arena 独立滚动 |
| 390×844 | Tetris / Dark | Shell `0,0,390,844`；单列；文档宽度 390；七项操作均不低于 44px；Arena `scrollTop=260` 时页面仍为 0 |
| 844×390 | Tetris / Light | Shell `0,0,844,390`；紧凑双列 `540px 280px`；Command `scrollTop=55` 时页面仍为 0；无横向页面溢出 |

## 交互与可访问性

- 进入前 Hub 为 `scrollY=483`，退出后恢复为 483，并聚焦对应 `data-game-id="gomoku"` 游戏卡片。
- Shell 末项按 Tab 循环到 `#btn-back`，未停止游戏键盘事件传播。
- 规则弹层打开后焦点落到“确定”，容器为 `role="dialog" aria-modal="true"`；Esc 关闭后焦点恢复到 `#btn-rules`。
- Light / Dark 均实测；zh-CN → en-US → uk-UA → zh-CN 连续切换无裸 key。英文、乌克兰语可见中文仅为语言选择器自身“中文”标签。
- 浏览器控制台 `error/warn`：0。
- 临时 viewport override 已在验收后 reset。

## 截图

- `desktop-1440x900-gomoku-light.png`
- `tablet-1024x768-tetris-dark.png`
- `mobile-390x844-tetris-dark.png`
- `landscape-844x390-tetris.png`

## 明确未执行

- 第二浏览器、Android / iPhone / Tablet 真机：NOT_EXECUTED。
- 真实网络整形：NOT_EXECUTED。
- 浏览器 reduced-motion 媒体模拟：当前浏览器能力未提供；CSS 合同和自动化回归已覆盖，但不冒充真机/浏览器人工验收。
