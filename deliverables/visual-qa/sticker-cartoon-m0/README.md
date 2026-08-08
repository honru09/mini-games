# Sticker Cartoon M0 Visual QA

当前状态：`DRAFT_EVIDENCE_AVAILABLE / HUMAN_REVIEW_REQUIRED`。

已生成并保留：Teacher 八状态透明母图、四 Avatar 透明母图、Core UI HTML/CSS 状态板、五子棋精确 15×15 SVG 纵切、飞行棋 52 格/每方四机/四剪影 SVG 纵切，以及 96/64/44px、灰度和黑色剪影审查件。生成式五子棋/飞行棋 v1 因规则错误仅作失败证据，不在 Source Manifest 当前源路径中。

当前自动合同：`npm run test:sticker-art` 通过；所有 feature flag 仍默认关闭，`runtime.paths=[]`。这些证据只证明 Draft 源、规则规格与 provenance 完整，不等于 Golden Set 通过。

目录：

- `golden-set-drafts/`：本机预览副本（已 gitignore，不作为唯一交付）；可提交的唯一母图与 poster 均在 `art-source/`。
- `derived/`：小尺寸、灰度与剪影审查件。
- 逐资产 IP Review 位于各资产源目录，当前统一为 `PENDING`。

后续仍必须完成并保留：

- 六主题 × 中文/英文/乌克兰语。
- 360 / 390 / 768 / 1024 / 1440。
- 24 / 32 / 48 / 192 / 512px 补充 Contact Sheet、对比度、色觉模拟与真实五人盲测。
- Teacher/Avatar 人工闭线、形体与两级明暗归并；Teacher Facial Kit 独立层。
- reduced-motion、离屏暂停、资源失败、0.25× 慢放、字节/解码内存预算。
- 两名人工评审逐资产 IP Similarity Review 与最终人工 Golden Set 决议。
- 运行时集成后六主题 × 三语言 × 360/390/768/1024/1440 全矩阵。

真实 Android、iPhone、Tablet、第二桌面浏览器仍未执行，不得用桌面截图替代。
