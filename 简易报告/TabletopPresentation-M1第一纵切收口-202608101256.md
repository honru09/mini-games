# Tabletop Presentation M1 第一纵切收口（2026-08-10 12:56）

## 做了什么

完成五子棋/飞行棋的代码原生本地近端视角：五子棋第二席 180° 视角，飞行棋按当前阵营旋转到统一近端；协议、规则、快照、Replay、奖励和 AI 仍使用标准逻辑坐标。

## 验收

- 专项：`tabletop-perspective-contract`、`tabletop-art-runtime`、`ai-games`、`gameplay-upgrade` 全部通过。
- 联机：`qa/e2e-online.js` 修正后连续默认参数通过，包含三人离房压紧、新局五子棋九步同步、结算和房主转移。
- 全链：`npm test` 通过；双构建输出 930449 characters，物理文件 944539 bytes，SHA-256 `CCA3CAB3193F2A75922B78D6A626716FFA92B012C063A68F4D5D489815F0D301` 一致。

## 主审核修正

测试驱动原先把逻辑坐标直接当屏幕坐标，第二席旋转视角下误点了另一格；已改为按 `data-view-quarter-turns` 映射。另修正棋盘外坐标被视角函数夹到边缘的问题，并增加非整数/越界拒绝断言。

## 未完成与下一步

本批只完成视角纵切；镜头入场、棋子/飞机移动动作、墨线冲击、2/3/4 人领奖台属于下一批独立 Action Presentation。localhost 浏览器因保存权限无法访问，第二浏览器、真机、真实网络和人工美术审批仍未执行。未提交、未推送、未部署。
