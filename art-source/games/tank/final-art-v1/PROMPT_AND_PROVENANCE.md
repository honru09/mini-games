# P1-02 Tank Final Art v1 — Prompt 与 Provenance

状态：`SOURCE_COMPLETE / RUNTIME_DERIVED / LOCAL_ONLY / NOT_RELEASED`

## 目标

为 Ghost Game 的 Tank 舞台建立原创 2.5D 美术：竞技场远/中/前三层、四套坦克、砖墙/钢墙/掩体/出生垫、炮弹/炮口/接触影/护盾、八个语义 VFX 与 desktop/mobile 构图预设。HP、倒计时、分数、控制、身份和所有规则数据继续由实时 DOM/协议拥有，不烘焙文字或状态。

## 图像 Skill 生成合同

- 方向：手绘纸艺与厚描边的 Ghost-native 战术玩具场，Ink/Cream 为骨架，Teal/Coral/Blue 只作队伍和反馈区分。
- 构图：俯视 2.5D，中央战斗区清晰，边缘装饰不遮挡 15×13 / 17×13 实时网格。
- 原子：单一对象、无遮挡、同一光向、足够留白、小尺寸可读。
- VFX：一图一义；开火、炮弹、跳弹、命中、爆炸、击毁、护盾、终局不得互相混淆。
- 禁止：文字、数字、UI 数据、真实武器品牌、第三方角色、外部轮廓/配色/像素/图层复刻。

## Source-only ImageGen 输出

| 文件 | ImageGen task | 尺寸 | Bytes | SHA-256 | 处置 |
| --- | --- | ---: | ---: | --- | --- |
| `tank-arena-source-v1.png` | `exec-6a8b39d5-b92c-4cc8-891d-ceadc8577b2c` | 1672×941 RGB | 2,367,234 | `0FCBE1B10F816BE63C617A7BFBFDC1267CEFF0706FFE09D14A248AC295C94854` | source direction only |
| `tank-object-atoms-source-v1.png` | `exec-8b47010a-6767-4e35-9c16-05e79a3cffd4` | 1448×1086 RGB | 1,858,807 | `F305B88F8281814F29C86E976A6EDA10C08EAA4EA52A0C432FC4C62908C4C302` | baked checkerboard; rejected for runtime |
| `tank-semantic-vfx-source-v1.png` | `exec-36036963-4910-4c6b-b37c-e7396653623a` | 1536×1024 RGB | 1,643,153 | `FC077BD23197B1EABA186706491E2A85712ED87515CD2B6D72DBCFBF844C6E28` | baked checkerboard; rejected for runtime |
| `tank-object-atoms-chroma-source-v1.png` | `exec-373f37e6-bcf8-44cf-a680-7165fdabc3f8` | 1448×1086 RGB | 1,896,254 | `79A6972B35A64E04C6586494A3EB788D3D5EE99E6D479EE6309E2E95042E241B` | silhouette/segmentation reference only |
| `tank-semantic-vfx-chroma-source-v1.png` | `exec-d82419ad-b378-4614-97d1-e48d02b75be9` | 1536×1024 RGB | 1,734,234 | `7C6526C82993449F0DD220E408C5FA0EE01B5F92A26B937AD7536EE3AC132533` | silhouette/segmentation reference only |

两张“透明原子板”和两张 chroma 修订图都没有真实 Alpha，全部保留为 source-only 证据；没有从这些 PNG 裁切像素进入 `public/assets`。

## 运行时派生

`scripts/generate-tank-final-runtime-v1.js` 从零绘制 25 个项目自有 SVG 母版，再以本地 Sharp 确定性派生 50 个 WebP。运行时许可为 `project-owned-deterministic-svg-sharp`，字节、SHA、Alpha、尺寸、角色与 fallback 以 `asset-family-manifest-v1.json` 为准。

## 外部参考

外部输入为 `EXTERNAL_REFERENCE_ONLY / blocked-license`。本批按用户授权的受控全信息 reference lane 向已授权 ImageGen 提供两个任务相关预览；路径、输入 SHA、provider、model、taskId、时间和 transmission scope 全量记录在 `EXTERNAL_REFERENCE_TRANSMISSION.json`。它们只贡献“爆炸状态覆盖”和“小尺寸 HUD 单义可读”语义，不提高许可，不进入 runtime。

## 可复现入口

```powershell
$env:NODE_PATH='C:\Users\wangxr\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node scripts/generate-tank-final-runtime-v1.js
```

最终运行时仍需同时满足 Manifest、`mg_art_tank_final_v1`、完整 decode、节点生命周期和专项合同；任一步失败即回到现有 Tank CSS/DOM/Canvas/Emoji。
