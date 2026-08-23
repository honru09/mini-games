# SKILL_ROUTING.md — Xiangqi Final Art v1 (P1-04 / G-16-XIANGQI-FINAL-ART-V1)

## 1. 资产族信息

| 字段 | 详情 |
| :--- | :--- |
| **Family ID** | `G-16-XIANGQI-FINAL-ART-V1` |
| **Source ID** | `ART-040-XIANGQI-FINAL-ART-V1` |
| **主线顺序** | P1-04（排序 16 / 33） |
| **适用范围** | 中国象棋（Xiangqi）全套 2.5D 棋盘、14 款棋子、6 类语义反馈特效与 2 组相机预设 |
| **生成架构** | 确定性 SVG 矢量生成 + Sharp WebP 派生（effort=3），纯本地封闭运行 |

---

## 2. 9 大图像 Skill 入口路由表

| Skill 名称 | 路由结果 | 判定理由 |
| :--- | :--- | :--- |
| `midjourney` | `NOT_APPLICABLE` | 几何、棋子文字与棋盘网格必须保持 100% 规则对齐与亚像素精确性，外部扩散模型无法保证规则严密性。 |
| `dalle3` | `NOT_APPLICABLE` | 同上，纯代码矢量化保障跨平台确定性与极低体积预算。 |
| `stable_diffusion` | `NOT_APPLICABLE` | 无需本地扩散模型权重，使用轻量程序化矢量母版。 |
| `photoshop_scripting` | `NOT_APPLICABLE` | 全流程使用 Node.js + Sharp 原生管线，无需外部 GUI 依赖。 |
| `svg_vector_pipeline` | `APPLIED` | 采用确定性 SVG 矢量架构生成 25 款母版，包含多层图层、倒角、书法字形与光影结构。 |
| `sharp_raster_pipeline`| `APPLIED` | 使用 Sharp（effort=3, lossless=false, quality=86）进行确定性 WebP 派生与缩略图接触表拼版。 |
| `canvas_procedural` | `APPLIED` | 运行时提供 100% 同构的 Canvas 静态与动态降级回退机制。 |
| `external_reference_lane`| `NOT_APPLICABLE` | 所有字形、棋盘与特效均为纯代码原创设计，隔离 `EXTERNAL_REFERENCE_ONLY / blocked-license` 外部素材。 |
| `asset_catalog_lock` | `APPLIED` | 严格遵守 `remoteObjectKey: null` 与 SHA-256 治理约束。 |

---

## 3. 输入哈希与许可隔离

- **许可状态**：`OWNER_AUTHORIZED_ART_CLEARANCE`（原创程序化资产）
- **外部依赖**：0 外部图像依赖，0 外部网络调用，绝无 `blocked-license` 外部像素进入运行时
- **运行环境**：Node.js + Sharp + Vanilla DOM/Canvas
