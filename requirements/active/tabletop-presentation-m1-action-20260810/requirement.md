# Tabletop Presentation M1 Action Presentation：动作反馈纵切

状态：`IMPLEMENTED_LOCAL_PENDING_EXTERNAL_VISUAL`
时间：2026-08-10（Asia/Tokyo）

## Goal

让实体桌游局内的关键动作有明确、克制、可回退的反馈：五子棋落子使用短时墨线冲击，飞行棋沿标准移动路径展示移动/起飞/碰撞/到达；动作表现不延迟规则回合。

## IN

- 五子棋最后一步墨线环/放射冲击，替代 Sticker 模式红色方框。
- reduced-motion 静态强调；重开、恢复、离开和销毁清理计时器。
- 飞行棋现有标准 `movementPath`/`tokenPoint` 飞行 token、起飞缩放、碰撞冲击、终点旗帜纳入合同并确认使用本地视角几何。
- 三语、现有 Game Stage、视角变换和程序化 fallback 保持兼容。

## OUT

- 不生成或启用未审批图片，不修改规则、协议、Replay、奖励、AI、数据库、商城或外部部署。
- 不在本批扩展完整领奖台、摄像机入场或六款全部动作素材；后续另立纵切。

## 本地验收

- `node --check public/src/games/gomoku.js`
- `node qa/tabletop-perspective-contract.js`
- `node qa/gameplay-upgrade.js`
- `npm test`：通过（117.8 秒）
- 构建双次一致：932061 characters；物理 946151 bytes；SHA-256 `6D196D68BA9F4B5910CDD262719879AB98271243825F601D3727B3CD0010FAAC`。

localhost 可见浏览器受机器保存权限拦截；第二浏览器、真机、真实网络、可见 reduced-motion 和人工美术审批仍未执行。
