# P2-10 Skill Routing

依照 `requirements/ART_GENERATION_SKILL_PIPELINE.md`，本批九个图像入口逐项登记：

- `imagegen`: `NOT_APPLICABLE` — 最终 Runtime 是精确排版的 DOM/CSS 叠层，不需要新 raster 插画。
- `ai-image-generation`: `NOT_APPLICABLE` — 不需要外部多模型候选或供应商任务。
- `gpt-image`: `NOT_APPLICABLE` — 不生成文字型 raster，避免赛事信息失真。
- `image`: `APPLIED` — 用于转播信息层级、Ghost signal、视线顺序和小屏事实密度审查；
  保留 Serge Shima / `github.com/smixs/visual-skills` 的 CC-BY-4.0 attribution。
- `happy-image-gen`: `NOT_APPLICABLE` — 不需要多供应商图像生成。
- `html-to-image`: `APPLIED` — 使用本地 HTML/CSS 精确排版并形成确定性 Review 页面。
- `website-screenshot`: `NOT_APPLICABLE` — 外部截图 API 无法读取 localhost；可见证据由已连接的
  Codex 本地 Browser 直接采集，不冒充该 Skill 调用。
- `code-to-image`: `NOT_APPLICABLE` — 不生成代码传播图。
- `og-image`: `NOT_APPLICABLE` — 本单元不是外部分享卡，P2-09 已单独覆盖 OG。

外部参考输入与第三方传输均为 0；没有读取或传输 blocked-license 文件。浏览器输入只含
项目自有的虚构赛事展示字符串，不含账号、UID、聊天、凭证、生产数据或真实比赛快照。
