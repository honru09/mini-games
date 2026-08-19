# G Coins Candidate B 所有者清除记录（2026-08-16）

状态：`OWNER_AUTHORIZED_ART_CLEARANCE`（本地可逆 runtime 候选，未发布）

## 清除范围

- 稳定 runtime ID：`P-GCOINS-ICON-V1`，`artwork_version: 1`。
- 源候选 ID：`ART-026-GCOINS-P1-CANDIDATE-B`；源稿仍保留在 `art-source/`，原始 SHA-256 为 `6a99bea413410f62520a2abe16ce3ab341c9e0337bd21a383350fc9f578dd04a`。
- Alpha 派生 SHA-256：`d62909d4827d427d5e499299fb2a7e839866a3ddc9e7b701d53c3e1cc542854c`。
- 运行时只使用现有 Candidate B 派生文件的原样副本，没有生成、重绘、裁切、换色或重新采样图片。
- 视觉方向遵循用户确认的 `M0 North Star`；Candidate B 的六角币形、幽灵火焰轮廓、左 D-pad 与右四按钮在 44px 派生上仍可辨。

## 机器与可见风险审查

- Alpha/技术：四角透明、1254² RGBA、非零 Alpha 覆盖率 `0.426914`、完全不透明覆盖率 `0.424913`、部分透明像素 `3147`、绿色主导污染 `0`、Alpha bbox `[194,129,1061,1124]`。
- 小尺寸：44/64/96/192 派生分别保持正方形 RGBA；既有 light/dark/checker 审查板可见检查通过，44px 仍能分辨外轮廓、D-pad 和四按钮。
- 机器技术/视觉/相似风险审查结果：通过内部技术准入。有限金属高光和“火焰 + 六角徽章”属于记录中的中等风格/相似风险，未被冒充为人工清稿或法律结论；后续可由更高质量清稿候选替换，当前 runtime 可一键回滚。
- `blocked-license` 与 `EXTERNAL_REFERENCE_ONLY` 素材没有作为输入、派生或运行时文件；外部素材永久隔离。

## 运行时完整性与回滚

运行时派生文件均在 `public/assets/ui/currency/gcoins-v1/`，逐文件 SHA-256 如下：

| 文件 | SHA-256 |
| --- | --- |
| `public/assets/ui/currency/gcoins-v1/gcoins-icon-44-v1.png` | `a4c2be71b239faeb90a298811942c72f68a8ab58de8d4ace8a6cfecbb8a9309e` |
| `public/assets/ui/currency/gcoins-v1/gcoins-icon-64-v1.png` | `02af42f61f99e626747e35cda5198aabe0a4714cb6da42f84fc2c11da98fb648` |
| `public/assets/ui/currency/gcoins-v1/gcoins-icon-96-v1.png` | `5f40724c81fef77ea067f48cdab5650231f701fc63f23c31e76d41ed7538fc25` |
| `public/assets/ui/currency/gcoins-v1/gcoins-icon-192-v1.png` | `aac1ddc47eb931a612e1ef9acf97d1215ebbdb591e818ca0cfdc33b15d40f421` |

- Manifest 条目 `P-GCOINS-ICON-V1` 绑定上述版本、来源、逐文件完整性、预算和 provenance；唯一显示 seam 仍为 `currencyIcon()` / `currencyAmountNode()`。
- feature flag：`mg_art_gcoins_p1_v1`，`operator: all`、`enabled_value: 1`、`default_enabled: true`。删除或设置为 `0` 时立即回到 `P-003`。
- 失败链（fallback）：Manifest/路径/版本/解码或运行时加载失败 → `P-003` (`public/assets/ui/currency_cash.svg`) → 历史 `💵`；不触碰金额、价格、奖励、协议、Supabase 或 Test Admin 权限。
- 回滚方式：将 `localStorage.mg_art_gcoins_p1_v1` 设为 `0`（或移除 Manifest/runtime 条目并保留 P-003），刷新后所有金额继续由既有 P-003 seam 渲染。回滚不删除源候选或经济数据。

## 可选咨询与发布边界

本族可选咨询标记为 `OPTIONAL_ADVISORY_EVIDENCE`，不构成开发准入或发布结论。

- 人工清稿：`NOT_EXECUTED`。
- 独立自然人 Reviewer B：`NOT_EXECUTED`。
- IP Similarity Review / 法律意见：`NOT_EXECUTED`。
- 用户 Golden Set：`NOT_EXECUTED`。
- 第二浏览器、物理设备、真实网络、读屏设备和低端性能：`NOT_EXECUTED`，属于发布证据待决，不阻塞本地开发。
- 本记录不构成上述可选咨询的 PASS，也不触发 commit、push、Pages、Render 或生产发布；发布仍需当前用户明确命令。
