# 外部角色与 Q 版 UI 参考审计简报（2026-08-13 22:55）

## 一句话结论

两处素材已完成深度目录与预览审计，并纳入外部 reference-only 素材登记；它们可以帮助 Ghost Game 学习动作覆盖和 UI 结构，但未确认授权、未读取 PSD/AI 深层图层、未接入网站。

## 做了什么

- 审计 64 个角色 ZIP：共 48,281 个内部条目、44,145 帧 PNG、约 5.09 GiB，归纳 Idle、Walk、Run、Attack、Hurt、Death、Greeting、Communication、Taunt、Joy 等动作族。
- 审计 708 个 Q 版 UI 文件：263 PSD、91 AI、205 JPG、149 PNG、约 12.19 GiB；确认 354 份源稿有同名预览，并按界面、弹窗、元素、AI 格式分类。
- 生成七张接触表并人工查看 64/64 张角色总览和 354/354 张 UI 预览；为 836 个外部文件 / 18,567,721,249 bytes 生成逐文件 SHA-256，aggregate 为 `a7151ed3c6b32fd1306962accd42f8f838a8e5b8d1ea54f4fc4a56397842298f`。
- 读取并哈希 64 个 ZIP 中的 256 份 License/README 文本；主要指向 CraftPix 许可页与预览字体页，因此保留人工授权核验，不自动判定可商用。
- 新增 `asset-library/external-source-register-20260813.json`，冻结 reference-only、授权未确认、未复制/未解压/未上传和 Ghost-native 原创重绘边界。
- 建立 `requirements/active/external-assets-audit-p1-20260813/` 与 `qa/external-asset-register-contract.js`，关联 ART-028、ART-030 和 UI-021/UI-027/UI-028。

## 用户现在能看到什么

- 网站和六款游戏本轮没有新增外部图片，也没有 UI 被无脑覆盖。
- 素材已经形成可追溯的学习规划：优先借鉴按钮层级、弹窗结构、奖励/成就卡、进度反馈、局内 HUD 与角色动作分镜，再以 Ghost Game 自有品牌重绘。

## 还没做什么

- `NOT_EXECUTED`：PSD/AI/EPS 图层、字体和嵌入对象解析；逐文件 content SHA-256；第三方授权核验；人工清稿、Reviewer B、IP Review、Golden Set。
- `NOT_EXECUTED`：运行时派生、Manifest、商城、头像、局内默认表现、真机/主题/reduced-motion/性能矩阵和线上发布。
- 这不是“已读取所有 PSD/AI 图层”或“可以商用”的结论；只证明目录结构、动作语义、全部渲染预览和输入版本已分析/固定。

## 验证

- `node qa/external-asset-register-contract.js`：PASS（10 项登记与隔离断言）。
- 角色 ZIP/PNG header 扫描：PASS（64 ZIP / 44,145 PNG 帧）。
- UI 源稿/预览配对与尺寸扫描：PASS（708 文件 / 354 同名源稿预览对）。
- `npm run test:asset-library-governance`：PASS；`npm run quality:gates`：PASS。
- 完整 `npm test`：PASS（232.4 秒）；`git diff --check`：PASS。
- 构建保持 1,353,257 字符 / 1,367,874 字节 / SHA-256 `2E466A3B59CEC8B7B1323DC6FD61375395E2497BE8C837C0D01A789D02731E93`。

## 风险与下一步

- 最大风险是授权和风格污染；因此素材只能作为通用结构参考，不能直接使用、裁切、描摹或换色发布。
- 下一步继续 CLOSE 主线，用 Ghost-native 组件合同选择性优化商城/奖励/HUD；正式图片仍等待 `GATE-ART-GOLDEN-SET`。

## 发布状态

- `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`
- 未提交、未推送、未触发 GitHub Pages 或 Render；线上保持 `bd49e6d` / `da3d05c`。

## 追溯入口

- 原子需求：`ART-028`、`ART-030`；关联 `UI-021`、`UI-027`、`UI-028`。
- 登记：`asset-library/external-source-register-20260813.json`。
- active task：`requirements/active/external-assets-audit-p1-20260813/`。
- QA：`qa/external-asset-register-contract.js`。

## 继续执行下一个主线

外部素材审计收口后，继续 `CLOSE` 的 Ghost-native UI/Game Stage 表现收口；不跨越设备、Supabase 或 Golden Set 外部门禁。
