# G Coins P1 Candidate B 技术审查（Reviewer A）

结论：`TECHNICAL_CANDIDATE / SOURCE_ONLY (原始源稿) / RUNTIME_DERIVATIVE_OWNER_CLEARED`

Reviewer A 是机器技术审查，不是独立自然人 Reviewer B，也不代表人工清稿、IP Similarity Review 或用户 Golden Set。

## 选择理由

- A：Honru 识别强，但角色徽章感重、层级偏多。
- B：六角币形明确，中心 Honru 头部只保留一枚 D-pad 与四枚按钮，44/64/96/192px 均保持可辨；选为本批技术首选。
- C：轮廓最简，但更像手柄 App 图标，货币与收藏感不足。

## Alpha 技术结果

- Alpha 文件：`alpha/gcoins-p1-candidate-b-alpha.png`
- 尺寸/模式：1254×1254 RGBA
- 四角 Alpha：`0 / 0 / 0 / 0`
- 非零 Alpha 覆盖率：`0.426914`
- 完全不透明覆盖率：`0.424913`
- 部分透明像素：`3,147`
- 可见前景绿色主导污染像素：`0`
- Alpha bbox（阈值 > 8）：`[194,129,1061,1124]`
- 小尺寸：192/96/64/44px 均已生成并在 light、dark、checker 三种底色上复核。

## 未通过的人工 Gate

- 人工可编辑矢量/分层清稿：`NOT_EXECUTED`
- 独立自然人 Reviewer B：`NOT_EXECUTED`
- IP Similarity Review：`NOT_EXECUTED`
- 用户 Golden Set：`NOT_EXECUTED`
- 第二浏览器、Android、iPhone、Tablet 与真实低端解码/性能：`NOT_EXECUTED`

## 风险

- 当前仍带有限的生成式金属高光；这是已记录的中等风格风险，不阻止本地可逆 runtime 候选。更高质量正式稿仍可由后续人工清稿或新候选替换。
- “火焰 + 六角游戏徽章”属于常见图形语汇，必须做独立七维 IP 相似性审查，不能由机器技术检查替代。
- 本批派生 PNG 已以原样副本进入本地 `P-GCOINS-ICON-V1` runtime 候选；Manifest/feature flag/回滚保持严格，加载失败继续使用 `P-003` 与历史 `💵` fallback。该本地接入不等于第二浏览器、真机、真实网络或生产发布证据。

## 所有者清除引用

`requirements/active/gcoins-source-redesign-p1-20260814/OWNER_AUTHORIZED_ART_CLEARANCE-20260816.md` 记录稳定 ID、逐文件 SHA-256、机器技术/视觉/相似风险、回滚和未执行的 `OPTIONAL_ADVISORY_EVIDENCE`。
