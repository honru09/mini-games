# Game Stage 与 Tabletop Wave A 发布前收口

时间：2026-08-09 18:35（Asia/Tokyo）

## 完成

- 六款游戏进入统一 Ghost Game 对局舞台：Header、真实 Seat Rail、Arena、Command Tray。
- 默认可见 code-native Pocket Tabletop Wave A 覆盖 `52/100`：六款底材和核心实体全部接入；`mg_art_tabletop_wave_a='0'` 可回退旧表现。
- 五子棋、飞行棋、大富翁、坦克、俄罗斯方块、象棋保持原规则、坐标、快照、AI、奖励与联机协议。
- Chat 只保留玩家私聊；Honru 助手聊天页、入口、Dock 与表单已移除。签到、品牌资产、后端安全兼容和默认关闭局内反应保留。
- 个人主页删除元叙事说明，保留简洁“主页”标题。
- Tetris 390px 改为单列预览、Arena 无内部横溢、七项操作至少 44px。

## 主负责人审核纠正

- `activeIdx=null` 不再误标 0 号为当前回合。
- 本人席位改为 UID 优先；房主/掉线先合并事件字段，席位重排等待权威 `room_update`。
- 修复 DOM/WebView 无 `style.setProperty()` 的兼容回退。
- 修复席位卡显示字面量 `false`。
- 更新 DOM 测试为“Wave A 默认 + 严格 0 旧表现回滚”，没有删除 M0 异常/解码/撤旗测试。

## 验证

- Terra Max：`npm run quality:gates` 11.351 秒，全通过。
- Terra Max：完整 `npm test` 130.370 秒，全通过。
- 构建前后 `public/index.html` SHA-256 一致。
- 本地 in-app Chromium：桌面/390px、light/dark、五子棋/Tetris、Profile/玩家 Chat、0 console warning/error。

## 仍未执行

- 第二桌面浏览器与 Android/iPhone/Tablet 真机。
- 真实网络整形、真实 Supabase 与多实例验收。
- Sticker/Honru Reviewer B、IP Review、Golden Set 人工签字。

当前状态：`VERIFIED_RELEASE_PENDING`。线上推送与 Render/Pages 验收完成后再更新为已发布。
