# P0-08 Honru Context Reactions v1 — Skill routing

资产族：`P-HONRU-CONTEXT-REACTIONS-V1`  
本轮决策：沿用用户确认的旧 Honru 形象，仅将两侧人类式拳手替换为连续单团 Q 版幽灵手；头顶火焰、配色、红晕、眼睛、双脚、构图均保持不变。  
记录状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_RUNTIME_DEFAULT_ON / NOT_RELEASED`

| Skill 入口 | 状态 | 本轮用途与证据边界 |
|---|---|---|
| `imagegen` | `APPLIED` | 使用内置图像编辑完成局部手部替换并冻结正式母图；后续 32 个语义派生因平台额度耗尽，改由母图的确定性项目内合成完成，不把失败候选当作正式资产。 |
| `ai-image-generation` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | `belt` 与 Inference.sh 凭证未配置；未调用、未伪造多模型结果。 |
| `gpt-image` | `APPLIED` | 使用其 Gallery/Craft 的 illustration、identity-preservation、surgical-edit 提示词结构；本机 `OPENAI_API_KEY` 与 CLI 不可用，因此未调用外部端点。 |
| `image` | `APPLIED` | 使用其角色一致性、prompt framework、negative-prior 和小尺寸可读性方法；保留 CC-BY-4.0 attribution 要求。 |
| `happy-image-gen` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 未发现 EXTEND.md 或可用供应商凭证；不自动创建配置、不切换付费供应商。 |
| `html-to-image` | `NOT_APPLICABLE` | 本批是角色位图局部编辑，不是精确排版、UI mockup 或文字卡片。 |
| `website-screenshot` | `NOT_APPLICABLE` | 生成阶段不需要网页截图；运行时可见证据另按本地浏览器 Gate 记录。 |
| `code-to-image` | `NOT_APPLICABLE` | 不生产代码展示图。 |
| `og-image` | `NOT_APPLICABLE` | 不生产 OG/社交分享卡。 |

## Additional system route

`asset-gen`：`UNAVAILABLE_EXTERNAL_CREDENTIAL`。系统 Skill 需要 Gemini/Grok 付费 API；本机 `GEMINI_API_KEY`、`XAI_API_KEY`、`ASSET_GEN_API_KEY` 均未配置。本轮不触发付费调用；母图之后的派生使用本地确定性 Sharp 合成。

## Reference and license boundary

- 当前编辑输入是用户明确提供的本地参考图与项目已有 Honru 资产；没有读取或上传未授权的第三方 blocked-license 像素/图层。
- 外部素材库存仍通过受控全信息 reference lane 对 Skill 可发现；若未来本资产族选择其中任务相关文件，必须逐输入记录 `sourcePath/sourceSha256/provider/model/taskId/transmissionScope`，且输出保持 `SOURCE_ONLY_EXTERNAL_INFLUENCED / SIMILARITY_REVIEW_REQUIRED`。
- 本轮输出不改变任何外部许可状态，不直接复制外部像素，不进入 runtime Manifest，直到完成机器 Alpha/污染/尺寸/相似风险、fallback、flag 和回滚审查。
