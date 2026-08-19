# OWNER_AUTHORIZED_ART_CLEARANCE — Ghost-native Q UI v1

决议日期：2026-08-17  
状态：`OWNER_AUTHORIZED_ART_CLEARANCE / SOURCE_BOARD_CANDIDATE / LOCAL_ONLY / NOT_RELEASED`

## 清除范围

本次清除覆盖 `asset-family-manifest-v1.json` 中列出的 12 个项目自有 AI 生成 Ghost-native 源板及其稳定 SHA-256。它们由项目自有 M0 North Star 和 Ghost Game 视觉语法从零生成，不包含外部 Q 版 UI/PSD/AI/RPG 像素、图层、角色、字体或构图。

## 清除依据

- 用户已确认的 M0 North Star。
- 每个资产具有稳定 ID、版本、源文件、字节数和 SHA-256。
- Prompt、生成方式、输入边界和禁止项已记录。
- 机器技术检查已完成；RGB 源板边界和失败透明迭代已明确记录。
- 每个资产均有独立 feature flag、原有 fallback 和一键回滚边界。
- 新增游戏入口/roster、商城外观和 Ghost/Honru-adjacent 装饰源板已完成 RGB/Alpha 边界核验；最后一项只允许抽象情绪与动作装饰，不改变现有 Honru 角色资产的身份边界。
- 新增棋子/代币、社交反应和 Game Stage 背景表面源板已完成视觉抽查与 PNG 技术核验；棋子/代币板虽含 Alpha，但其 Alpha 覆盖全画布且不是透明切片，仍只保留源板候选身份。
- 外部素材仍保持 `EXTERNAL_REFERENCE_ONLY / blocked-license`；本决议不授予任何第三方素材许可。

## 允许范围

12 个源板可以进入后续 Ghost-native UI 运行时候选、组件重绘、透明派生和本地默认关闭预览。任何 default-on、公开 Manifest、Pages/Render 发布或生产数据操作，都需要单独完成对应技术、设备、发布和当前用户明确命令边界。

## 不宣称

本决议不宣称独立 Reviewer B、IP/法律结论、第三方外部授权、逐资产 Golden Set、第二浏览器、真机、真实网络、Supabase 或正式发布已完成。
