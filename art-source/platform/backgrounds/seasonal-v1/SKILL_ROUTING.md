# P2-01 图像 Skill 路由

资产族：`P-SEASONAL-BACKGROUNDS-V1`  
日期：2026-08-22  
边界：四季主题背景美术，不实现赛季时钟、Battle Pass、Remote Config、奖励或社交攀比。

| Skill 入口 | 状态 | 本批用途或不适用理由 |
|---|---|---|
| `imagegen` | `APPLIED` | 通过 Codex 内置 ImageGen 生成 spring/summer/autumn/winter 四张原创源母板；输入仅为两张项目自有 North Star。 |
| `ai-image-generation` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 工作站无 `belt`，未登录 inference.sh，未自动安装、登录或付费。 |
| `gpt-image` | `APPLIED` | 读取 Gallery Gaming/Isometric 与 craft，采用清晰游戏场景、物件密度和材质/光照/配色分离方法；未调用需 `OPENAI_API_KEY` 的 CLI。 |
| `image` | `APPLIED` | 使用 GPT Image 2 五槽语法、黄金规则、海报/插画与 creative-direction 约束提示词。Attribution: Serge Shima / smixs visual-skills, CC BY 4.0。 |
| `happy-image-gen` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 无 Bun、EXTEND.md 或任何已配置 provider key；未执行 setup、未创建配置、未付费。 |
| `html-to-image` | `NOT_APPLICABLE` | 本批是有机游戏场景背景，没有精确排版、数据或文字几何。 |
| `website-screenshot` | `NOT_APPLICABLE` | 源资产生成不需要远端网页截图；本地可见验收由已登录的项目浏览器链负责。 |
| `code-to-image` | `NOT_APPLICABLE` | 不是代码传播图片。 |
| `og-image` | `NOT_APPLICABLE` | 不是 OG/社交分享卡；P2-09 单独处理。 |

补充命中但不属于九入口：

- `asset-gen`：`UNAVAILABLE_EXTERNAL_CREDENTIAL / PAID_PROVIDER_NOT_AUTHORIZED`；其 Gemini/Grok/Tripo 路径会产生真实费用，本批没有追加付费调用授权。
- `fal-ai-media`：`UNAVAILABLE_EXTERNAL_CREDENTIAL`；未配置 fal.ai MCP/FAL_KEY。

最终生成路径：Codex 内置 ImageGen → 4 个项目 source PNG → `scripts/build-seasonal-backgrounds-v1.py` 确定性派生 20 个 WebP → 现有 Premium Background runtime。

