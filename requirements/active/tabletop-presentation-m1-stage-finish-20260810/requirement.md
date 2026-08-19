# Tabletop Presentation M1 Stage Finish：镜头入场与飞行棋排名台

状态：`IMPLEMENTED_LOCAL_PENDING_EXTERNAL_VISUAL`
时间：2026-08-10（Asia/Tokyo）

## Goal

补齐 Tabletop M1 当前可由代码原生实现的局内收尾：五子棋/飞行棋开局镜头入场，以及飞行棋按真实 2/3/4 人 placement 展示排名台。

## IN

- 五子棋/飞行棋局内棋盘 520ms 低干扰透视入场，reduced-motion 完全关闭。
- Shared Victory Overlay 可选 `podium`，使用命名 `<ol>`、稳定名次顺序、原文安全名字和 44px 排名行。
- 飞行棋从 `getMatchStats().placement` 生成 2/3/4 人排名，不改变服务端结果、奖励和规则。
- 三语言 `victory_podium_label` / `victory_podium_rank`。

## OUT

- 不修改服务器、规则、协议、AI、Replay、奖励、数据库或未审批素材。
- 不做正式 3D 相机、图片领奖台、最终材质和角色动画；这些继续受美术/设备审批门禁约束。

## 验收

- `node qa/tabletop-perspective-contract.js`、`npm run test:i18n`、`node qa/overlay-dialog-accessibility.js`、`node qa/gameplay-upgrade.js`、`node qa/dom-smoke.js` 全部通过。
- 首次完整 `npm test` 在 180 秒工具上限时仍运行到联机 E2E，无断言失败；提高到 300 秒后完整 `npm test` 118 秒 ALL_PASS。
- 双构建一致：934153 characters；物理 948243 bytes；SHA-256 `7FE8BC67E7D8E4B2C4356EB655C569E746787C851525CA30ACE4CAA7917C2FF6`。
- localhost 浏览器仍被保存权限阻断；第二浏览器、真机、真实网络和可见 reduced-motion 未执行。
