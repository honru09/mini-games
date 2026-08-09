# Game Stage 与 Tabletop Wave A 线上发布收口

时间：2026-08-09 19:05（Asia/Tokyo）

## 结论

六款统一 Game Stage 与默认可见 Pocket Tabletop Wave A 已发布。功能提交为 `7fc6601e43df912a596dba671c9edcd8bfccf6a7`；Render 为 `live`，GitHub Pages workflow 成功，HTTP、WebSocket 和线上浏览器抽查全部通过。当前阶段是“Wave A 已发布、外部生产与人工美术闸门待完成”，不能描述为 `PRODUCTION_READY`。

## 已上线

- 六款统一 Header、真实 Seat Rail、Arena、Command Tray。
- `52/100` 默认可见代码原生美术覆盖；严格 `mg_art_tabletop_wave_a='0'` 可回退。
- 房主、本人、AI、READY、offline、current、bankrupt、spectator 状态。
- Tetris 手机单列预览、Arena 无内部横溢、七项操作至少 `44×44px`。
- Honru 助手 Chat、Dock、表单、快捷问题、对话历史与孤立死 CSS 已删除；玩家私聊、签到、品牌资产、后端兼容和默认关闭局内反应保留。
- 个人主页元叙事文案已移除，保留简洁“主页”标题。

## 主负责人审核与纠正

- 修正 `activeIdx=null` 误标 0 号当前回合、UID/席位重排误标、Host/offline 刷新顺序、WebView `style.setProperty` 兼容和字面量 `false` 泄漏。
- 修正 Tetris `390px` 内部横滚与触控尺寸。
- 最终审查又删除无 DOM 消费者的 `chat-view-tabs`、`companion-*` 与 `honru-dock` 响应式死样式，重建生成物并重跑全套回归。

## 验证与上线

- 主负责人：`npm run quality:gates` PASS（13.4 秒）；完整 `npm test` PASS（108.3 秒）。
- 独立 Terra Max：完整 `npm test` PASS（144.5 秒），`git diff --check` 与构建双 SHA 一致。
- Render：`dep-d9s4u0v40ujc73cka1tg`，精确功能 SHA，状态 `live`。
- GitHub Pages：[workflow 31307142193](https://github.com/honru09/mini-games/actions/runs/31307142193) 成功。
- Pages/Render：HTTP 200，Stage/Runtime 标记存在，Honru Chat/Form DOM 不存在；两端内容一致，规范化 SHA-256 为 `0db35a5aa57605c2e61ea03be83ce38edc77a4930426b02f03ffdf6f15b8e770`。
- WebSocket：双人建房/READY/落子同步、4 人房三人不满开局/结算/结束本局均 PASS。
- 线上 Chromium `1280×720`：登录前 Page、一次性访客、六游戏、AI 五子棋 Stage/Wave A、无横溢、0 console warning/error。

## 尚未执行

1. 真实 Supabase 迁移、RLS、并发、加密备份、隔离恢复与非破坏回滚。
2. 第二桌面浏览器、Android/iPhone/Tablet 真机与真实网络整形。
3. Sticker/Honru 人工清稿、Reviewer B、IP Review、Golden Set 与默认开启审批。
4. 真实多实例 Reward/AI/Chat fencing 与外部遥测接收端。

以上外部闸门完成前，总 Release Candidate 继续保持 `BLOCKED_EXTERNAL`。
