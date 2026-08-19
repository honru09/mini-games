# External Assets Audit P1（2026-08-13）

## 目标

对用户指定的角色动画包和 Q 版 UI 分层包完成可审计的目录级深度分析，形成 source/reference-only 使用规划；不将未授权外部素材接入 Ghost Game 运行时。

## IN

- ZIP/PNG/SCML/PSD/AI/EPS/JPG/PNG 的数量、体积、目录、动作族、预览配对、分层/对象结构和可用性边界。
- 角色动作语义与 UI 组件结构的 Ghost-native 重绘规划。
- 素材来源、许可状态、content hash 限制、回滚与下一步 Gate。

## OUT

- 解压、复制或上传外部素材。
- 直接接入 `public/assets`、`asset_manifest.json`、商城、头像、局内默认表现或线上部署。
- 通过文件名、预览或 License.txt 推断授权。

## 约束

- 外部素材默认 `reference-only / blocked-license`。
- Ghost Game 正式风格仍由 Logo/Honru、黑白极简、毛玻璃双主题和 Game Stage Cream/Ink 决定。
- 图片生成继续使用最高质量模型；本批不生成新图片。

## 追溯

- 登记：`asset-library/external-source-register-20260813.json`
- 原子需求：`ART-028`、`ART-030`，关联 `UI-021`、`UI-027`、`UI-028`。
- 共享 Gate：`GATE-ART-GOLDEN-SET`。
