# Tabletop Presentation M1：五子棋/飞行棋本地近端视角

状态：`IMPLEMENTED_LOCAL_PENDING_EXTERNAL_VISUAL`
时间：2026-08-10（Asia/Tokyo）

## Goal

建立唯一、可逆的代码原生本地视角变换：联机玩家在自己的客户端看到本人位于近端，逻辑坐标、协议、输入、Replay、快照、规则和胜负保持标准坐标。

## IN

- 纯表现 `TabletopPerspective` 模块：方格半转、圆桌四分之一转、可逆与安全 fallback。
- 五子棋：第二席客户端显示 180° 本地视角，指针输入逆变换回标准 `row/col`。
- 飞行棋：按本人逻辑阵营把基地/轨道/终点/移动动画旋转到统一近端，2/3/4 人均保持标准 token 状态。
- 观众保持标准公共视角；本地/AI 旧路径保持兼容。
- 专项、现有 Tabletop/AI/联机/E2E/快照回归。

## 本地验收结果

- 五子棋第二席使用 180° 近端视角；绘制、最后一步、胜利线、幽灵落子和指针输入均完成视图/逻辑坐标隔离。
- 飞行棋按当前真人席位的逻辑阵营旋转基地、轨道、终点和移动位置；2/3/4 人状态、标准 pid 和观众公共视角保持不变。
- `node qa/tabletop-perspective-contract.js`、`node qa/tabletop-art-runtime.js`、`node qa/ai-games.js`、`node qa/gameplay-upgrade.js`、`node --experimental-websocket qa/e2e-online.js` 和完整 `npm test` 均通过。
- 主负责人修正了 E2E 屏幕坐标尺寸/本地视角映射，并修正越界指针被夹到棋盘边缘的输入边界。
- 当前构建：930449 characters；`public/index.html` 物理 944539 bytes；SHA-256 `CCA3CAB3193F2A75922B78D6A626716FFA92B012C063A68F4D5D489815F0D301`；连续双构建一致。
- 本地浏览器复核尝试被机器保存的 localhost 权限拦截，未以替代方式绕过；第二浏览器、真机、真实网络和可见 reduced-motion 仍属于外部闸门。

## OUT

- 不改五子棋/飞行棋规则、AI 候选、服务端协议、moveLog、Replay、Reward、数据库或素材。
- 本纵切不生成镜头位图、角色动画、红框替代冲击素材或领奖台；这些留给后续 M1 表现批次。
- 不提交、不推送、不部署。
