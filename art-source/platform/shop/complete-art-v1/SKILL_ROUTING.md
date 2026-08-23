# Skill Routing: Shop Complete Art v1 (P-SHOP-COMPLETE-ART-V1)

## 1. 资产族信息

- **资产族 ID**: `P-SHOP-COMPLETE-ART-V1`
- **Family Name**: Shop 商品、稀有度、预览地台和购买反馈
- **Source Identifier**: `ART-041-SHOP-COMPLETE-ART-V1`
- **Family Flag**: `mg_art_shop_complete_v1`
- **预算控制**: Runtime < 3.0 MiB, SVG Master 24, Runtime WebP 48

## 2. 九个已安装图像 Skill 入口路由结果

| Skill 入口 | 路由状态 | 评估理由与执行方式 |
| :--- | :--- | :--- |
| `midjourney` | `NOT_APPLICABLE` | 本资产族为 2.5D 商城 UI、稀有度边框、地台与购买动效，需矢量透明精确像素对齐与程序化 GSAP 契约，不适用扩散大模型。 |
| `dalle3` | `NOT_APPLICABLE` | 同上，属于平台矢量与 WebP 运行时素材。 |
| `stable-diffusion` | `NOT_APPLICABLE` | 同上。 |
| `generate_image` | `APPLIED` | 用于内部视觉草图验证与多尺寸 Review 接触表合成生成。 |
| `svg-vector-artist` | `APPLIED` | 核心入口：用于生成 24 个确定性、严谨透明、分层规范的 2.5D SVG 矢量母版（5 稀有度框 + 5 展台 + 6 分类图标 + 6 购买反馈 VFX + 2 相机预设）。 |
| `sharp-webp-pipeline` | `APPLIED` | 核心入口：批量编译 48 个 WebP 运行时变体（24 正常态 + 24 `-static` 静态/降级态），严格控制压缩率与 SHA-256 审计。 |
| `gsap-motion-designer` | `APPLIED` | 核心入口：编排商城购买爆花、解锁光芒与金币扣除反馈粒子。 |
| `canvas-procedural` | `APPLIED` | 用于离线无 WebGL 条件下的纯 CSS/Canvas 降级保底渲染。 |
| `external-ref-ingestion` | `NOT_APPLICABLE` | 本资产族为 100% 原创代码生成，无外部闭源资产依赖。 |

## 3. 许可与合规边界

- 所有运行时素材均为项目独创代码生成，许可为开源 MIT/项目专用。
- 严禁引入外部非授权第三方字体、商标或三方版权图像。
