# P0-11 图像 Skill 路由

资产族：P-AVATAR-FRAME-EFFECT-V1
路由日期：2026-08-19
任务 ID：p0-11-avatar-frame-effect-v1-20260819

| Skill 入口 | 状态 | 用途/理由 |
|---|---|---|
| imagegen | NOT_APPLICABLE | 头像框/效果是现有 SVG/vector-native 系统的延展，确定性原生输出可保持像素级一致与可回滚。 |
| ai-image-generation | UNAVAILABLE_EXTERNAL_CREDENTIAL | Inference.sh 未配置凭证；未登录、付费或上传。 |
| gpt-image | APPLIED | 输入为项目自有 M0 North Star 哈希与 P0-11 用途/尺寸/保护区约束；按 GPT Image 2 五槽结构整理到 PROMPT_AND_PROVENANCE.md，输出由 deterministic SVG + Sharp 实现，未调用 API。 |
| image | APPLIED | 输入同上；使用 CC-BY-4.0 Visual Skills 的 models/gpt-image/golden-rules/creative-direction 对构图、材质、对比度和小尺寸可读性复核，输出为视觉规格与 MACHINE_VISUAL_REVIEW.md。 |
| happy-image-gen | UNAVAILABLE_EXTERNAL_CREDENTIAL | 未配置供应商凭证；未运行多供应商 CLI。 |
| html-to-image | NOT_APPLICABLE | 输出为透明身份原子，不是精确文字/UI mockup。 |
| website-screenshot | NOT_APPLICABLE | 生成阶段不摄取网页；可见证据由设备 Gate 单独记录。 |
| code-to-image | NOT_APPLICABLE | 不是文档代码视觉。 |
| og-image | NOT_APPLICABLE | 不是 OG/分享卡。 |

image 技能归属：Prompt guidance adapted under CC-BY-4.0, Serge Shima / smixs visual-skills (https://github.com/smixs/visual-skills).

外部库存：仅保留 asset-library/external-source-register-20260813.json 的语义库存上下文；本批未向任何 Skill 传输外部 Q UI/PSD/AI/EPS/RPG 文件、预览、像素、图层或向量对象。
