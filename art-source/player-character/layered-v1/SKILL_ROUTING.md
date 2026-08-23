# P0-10 图像 Skill 路由

资产族：P-PLAYER-CHARACTER-LAYERED-V1  
路由日期：2026-08-19  
任务 ID：exec-11ea459c-d1aa-4a6a-b5d6-91ff4062146b

| Skill 入口 | 状态 | 用途/理由 |
|---|---|---|
| imagegen | APPLIED | 生成项目自有六姿态角色视觉锚点；输出落盘后做尺寸、模式与 Alpha 实测。 |
| ai-image-generation | UNAVAILABLE_EXTERNAL_CREDENTIAL | Inference.sh belt 未安装且没有配置凭证；未自动登录、付费或上传。 |
| gpt-image | APPLIED | 使用 GPT Image 2 五槽结构、角色一致性与 character-design gallery/craft 规则整理本批生产 Prompt；未调用 CLI/API。 |
| image | APPLIED | 使用 CC-BY-4.0 Visual Skills 的 models/gpt-image/golden-rules/characters/character-design/creative-direction/prompt-framework 进行构图、身份锁定与约束审查；归属见下文。 |
| happy-image-gen | UNAVAILABLE_EXTERNAL_CREDENTIAL | 没有 EXTEND.md、Bun 或可用供应商 API Key；未运行多供应商 CLI。 |
| html-to-image | NOT_APPLICABLE | 本批是透明角色图层与姿态原子，不是精确文字/UI mockup。 |
| website-screenshot | NOT_APPLICABLE | 生成阶段不摄取网页；浏览器可见证据属于独立设备 Gate。 |
| code-to-image | NOT_APPLICABLE | 不是文档代码视觉。 |
| og-image | NOT_APPLICABLE | 不是 OG/社交分享卡。 |

补充筛查：asset-gen 为付费 Gemini/Grok/Tripo API，ASSET_GEN_SKILL_DIR、RUNTIME_ASSET_DIR 与供应商凭证均未配置，本批不调用；fal-ai-media MCP/FAL_KEY 未配置，本批不调用。两者都没有被描述为生成成功。

image 技能归属：Prompt guidance adapted under CC-BY-4.0, Serge Shima / smixs visual-skills (https://github.com/smixs/visual-skills).

外部库存：已知 asset-library/external-source-register-20260813.json 的完整登记、836 文件 aggregate hash、动作/分层统计和 runtime 禁止边界；本批未向任何 Skill 传输外部 Q UI/PSD/AI/EPS/RPG 文件、预览、像素、图层或向量对象。
