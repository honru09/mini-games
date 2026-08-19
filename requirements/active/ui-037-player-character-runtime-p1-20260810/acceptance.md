# UI-037 / GAME-045 Contract Acceptance

状态：`CONTRACT_ACCEPTED / CODE_FALLBACK_LOCAL_ONLY`

> 当前裁决（2026-08-17）：原创 Ghost-native `ART-036` 在完成稳定 ID/SHA/provenance、机器视觉/技术/相似风险审查、fallback、feature flag 与回滚并取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 后，可进入可逆 runtime 候选。人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，不阻塞开发或 runtime；第二浏览器、真机和真实网络只保留 `RELEASE_EVIDENCE_PENDING`。外部 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材仍永久禁用，发布仍需当前用户明确命令。

## 主负责人后续本地收口（不等同于正式角色 runtime）

- [x] `public/src/games/monopoly-character-presentation.js` 提供小 Interface `project(input)`，完成公开角色投影净化、权威/视觉位置选择、phase 状态、朝向、reduced-motion、重连/观战 snap 与固定 `code-fallback`。
- [x] `public/src/games/monopoly.js` 仅消费该投影并保留既有 `♟/🚗` marker；没有读取 `art-source/`、`asset-library/`、商城经济或规则写字段。
- [x] `qa/monopoly-character-presentation.js`、`qa/social-match-client-lifecycle.js` 通过；构建产物由 `scripts/build.js` 同步。
- [x] 现有根级 `transition` 已在客户端表现调用处显式转交；代码原生 Adapter 已完成 `matchId/revision/stateHash` 校验、连续合法 move、乱序/重连 snap、reduced-motion 与生命周期清理。
- [x] UI-037 全状态代码原生可见 UI、三语状态栏、拍卖倒计时、机会卡 dialog、44px 与 reduced-motion 边界已完成。
- [ ] `ART-036` 尚未取得逐族 `OWNER_AUTHORIZED_ART_CLEARANCE`，因此其 renderer、Manifest、性能预算与可逆回滚纵切尚未实施；真机视觉仅为发布证据待决。

## 本批已验收

- [x] `UI-037` 与 `GAME-045` 的产品范围、已实现基线、外部闸门和不实现项已从唯一台账及对应进度报告复核。
- [x] 已明确服务端 Monopoly 真相源：`monopoly-rule-v2`、`matchId`、`revision`、`stateHash`、`state.players[].pos`、`state.current`、phase、auction deadline 与 terminal/order。
- [x] 已记录并修正当前 WebSocket 根级 `transition` 的表现转交；规则 wire 形状不变，renderer 不自行猜测。
- [x] 已冻结 `MonopolyPresentationAdapter` 的小 Interface、Authority/Seat/Character 三个 Adapter、连续性规则与静态恢复策略。
- [x] 已覆盖进入、回合、骰子、移动、落点、机会卡、买地、支付、拍卖、破产、交易未实现、断线、重连、观战、结算与 protocol/asset fallback。
- [x] 已明确 `player-character-v1` 只消费公开投影；Player Character、Game Cosmetic tokenSkin、Avatar/Frame/Effect/NameFx、Honru 和 Logo 不可混用。
- [x] 已定义三语、dialog/aria-live、44px、四档响应式与 reduced-motion 的后续验收口径。
- [x] 本批只在本 active directory 创建文档；未改源码、测试、资源、Manifest、数据库、全局台账、报告、日志、构建产物或线上环境。

## 运行时验收（故意未执行）

- [x] 将完整事件 envelope 的 `transition` 安全交给表现 Module，并验证不改变 `monopoly-rule-v2` wire 形状；当前仅驱动代码原生 fallback，不加载未审批素材。
- [x] 专项 QA 验证 revision/matchId/stateHash、乱序/重复、角色畸形输入、资源失败、reconnect/spectator snap、破产差分与不泄漏私有经济字段。
- [x] 专项 QA 验证每个状态矩阵项的 Authority 输入、操作可用性、支付/机会卡/拍卖只读提示和不生成规则行动。
- [ ] `npm run test:i18n`、DOM/响应式/Immersive Shell、rule-authority online、reconnect/e2e、Quality Gates、完整 `npm test` 与双构建哈希。
- [ ] 本地四档浏览器、第二桌面浏览器、Android/iPhone/Tablet、双主题、三语言、reduced-motion、真实网络整形和恢复可见验证。

## 阻塞与防误报

- [ ] `ART-036` 未取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 前不能加载其新角色/棋盘位图；人工清稿、Reviewer B、IP/法律意见与 Golden Set 仅为可选咨询，不得作为 runtime 阻塞或伪造成 PASS。实际 renderer 与可见状态矩阵未完成前，仍不能标记“角色行走美术完成”。
- [ ] ECO-029 正式商城/数据库事务未通过：不能出售、授予或装备角色商品，也不能标记“正式角色商城完成”。
- [ ] 当前无交易 Authority：不能新增或显示会误导玩家的可提交交易流程。
- [ ] 本批未 commit、push 或部署；本文件不是线上验收证据。

## 文档检查命令

代码原生 fallback 批已完成专项与完整回归；获批素材和完整 UI 状态矩阵仍须独立验收，不得用本地 fallback 证据替代：

```powershell
node -e "for (const f of ['plan.json','execution.json','ownership.json']) JSON.parse(require('fs').readFileSync('requirements/active/ui-037-player-character-runtime-p1-20260810/'+f,'utf8')); console.log('UI037_CONTRACT_JSON_OK')"
git diff --check -- requirements/active/ui-037-player-character-runtime-p1-20260810
```

后续真正的 runtime 批必须再按 `plan.json` 的测试矩阵执行，不得把本目录的 JSON/Markdown 检查冒充功能测试。
