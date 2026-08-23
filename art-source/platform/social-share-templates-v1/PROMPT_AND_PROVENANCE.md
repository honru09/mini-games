# P2-09 Prompt and Provenance

## 视觉说明

在项目自有 Ghost Game M0 North Star 和 P1-06 原创卡底之上，构成一张精确的 1200×630
社交卡：左侧使用清晰的品牌、类型、游戏/纪录标题、结果或数值和一句短说明；右侧保留
Ghost signal / 手柄眼睛的留白识别区。深色 Ink 背景、Cream 文字、青色类型、金色或语义
结果色，保证 320px 缩放后仍能区分主标题和结果。

## 确定性派生

- 底图：复用 `P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1` 的
  `card-playline / card-result / card-record` WebP，不复制或重新生成像素。
- 文字：由 `GhostSocialShareTemplate` 使用 `textContent` 注入已本地化展示字符串。
- 样式：Vanilla DOM/CSS；无布局动画、无外部字体请求、无 Canvas 导出、无远端生成。
- Review：本地 HTML 页面经 Codex in-app Chromium 截取标准卡与三语 contact sheet。

没有图像生成 provider、model 或远端 taskId。所有输出均在本地 workspace 内确定性生成；
外部参考、玩家数据、凭证和生产数据均未进入输入。

