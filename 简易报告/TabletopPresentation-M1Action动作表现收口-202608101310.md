# Tabletop Presentation M1 Action Presentation 动作表现收口（2026-08-10 13:10）

## 做了什么

五子棋最后一步不再使用红色方框，改为程序化墨线环与短促放射冲击；保留落子即时性，不阻塞回合。`prefers-reduced-motion` 下只保留静态强调，重开、恢复、离开和销毁会清理计时器。

飞行棋现有标准 `movementPath`、`tokenPoint`、飞行 token、起飞缩放、碰撞冲击和终点旗帜已纳入本批合同；它消费标准 pid/路径，并随本地视角几何显示，不改 52 格规则。

## 验收

- `node --check public/src/games/gomoku.js` 通过。
- `node qa/tabletop-perspective-contract.js` 通过（含墨线冲击、飞行路径、reduced-motion/越界静态合同）。
- `node qa/gameplay-upgrade.js` 通过。
- 完整 `npm test` 通过（117.8 秒）；联机 E2E、AI、规则、i18n、DOM 和质量闸门均未回归。
- 构建双次一致：932061 characters、946151 physical bytes、SHA-256 `6D196D68BA9F4B5910CDD262719879AB98271243825F601D3727B3CD0010FAAC`。

## 未完成与下一步

本批没有做镜头入场、2/3/4 人领奖台、最终材质/动作图片，也没有启用未审批美术。localhost 浏览器因保存权限无法访问，第二浏览器、Android/iPhone/Tablet、真实网络、可见 reduced-motion 和人工/IP/Golden Set 审批仍未执行。当前本地完成，不提交、不推送、不部署。
