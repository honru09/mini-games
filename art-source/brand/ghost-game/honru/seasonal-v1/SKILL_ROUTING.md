# P2-02 图像 Skill 路由

资产族：`P-HONRU-SEASONAL-V1`  
日期：2026-08-22  
边界：项目自有 Honru 四季限定透明角色母版；不实现赛季或活动运营能力。

| Skill 入口 | 状态 | 本批用途或不适用理由 |
|---|---|---|
| `imagegen` | `APPLIED` | 通过 Codex 内置 ImageGen 对同一 owner-cleared Honru 身份锚完成四张独立色键身份保持编辑；任务标识、输出路径和确定性 Alpha 派生已记录。 |
| `ai-image-generation` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 工作站无 `belt`，未登录 inference.sh，未自动安装、登录或付费。 |
| `gpt-image` | `APPLIED` | 已读取 Character Design/Gaming Gallery 与 craft，采用明确画布、角色一致性、材质/光照/约束分区；未调用需 Key 的 CLI。 |
| `image` | `APPLIED` | 使用 GPT Image 2 五槽语法、identity preserve、角色连续性和具体视觉事实约束。Attribution: Serge Shima / smixs visual-skills, CC BY 4.0。 |
| `happy-image-gen` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 无 Bun、EXTEND.md 或已配置 provider key；未执行 setup、未付费。 |
| `html-to-image` | `NOT_APPLICABLE` | 本批是有机角色透明母版，不含精确文字或 UI 几何。 |
| `website-screenshot` | `NOT_APPLICABLE` | 源资产生成不依赖网页截图；运行时可见证据后续走项目浏览器链。 |
| `code-to-image` | `NOT_APPLICABLE` | 不是代码传播图片。 |
| `og-image` | `NOT_APPLICABLE` | 不是 OG/社交分享卡。 |

补充：`asset-gen` 与 `fal-ai-media` 需要未授权付费/外部凭证，本批不调用。最终路径为内置 ImageGen 四张项目源 PNG → 项目确定性派生 16 个透明 WebP → Manifest 严格 resolver。
