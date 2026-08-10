# Tabletop Presentation M1 镜头入场与排名台收口（2026-08-10 13:31）

## 做了什么

- 五子棋和飞行棋棋盘进入局内时有 520ms 轻透视入场；减少动态效果时完全关闭。
- 飞行棋结算根据真实 `placement` 显示 2/3/4 人排名台，不再只显示赢家。
- 排名台是命名有序列表，按数字名次排序，支持三语言、原文安全名字、44px 行高，并复用现有 Victory 焦点/Esc/背景关闭逻辑。

## 验收

- Tabletop、i18n、Victory 动态弹层、Gameplay、DOM 专项全部通过。
- 第一次 `npm test` 仅因 180 秒工具上限被终止，终止前无断言失败；300 秒上限重跑后 118 秒 ALL_PASS。
- 双构建一致：934153 characters、948243 physical bytes、SHA-256 `7FE8BC67E7D8E4B2C4356EB655C569E746787C851525CA30ACE4CAA7917C2FF6`。

## 仍未完成

正式材质图片、角色动画、图片领奖台和高阶镜头仍受人工/IP/Golden Set 与真机门禁约束；localhost 可见复核仍被机器保存权限阻断。未提交、未推送、未部署。
