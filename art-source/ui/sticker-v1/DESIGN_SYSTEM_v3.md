# Design System v3 · Sticker Components

本文件冻结结构、状态与 owner-clearance runtime 边界。视觉值来自 `../../style/design-tokens.v1.json`；是否 default-on 只由对应资产族的 `OWNER_AUTHORIZED_ART_CLEARANCE`、Manifest 与可逆 kill switch 决定。

## 唯一视觉基准

- `component-demo.png`（SHA-256 `135DB655DC400FB35F960045B510EE450E007CCFAD03E308DEBF65E222DB1F61`）负责组件结构、完整状态、焦点和代码原生几何。
- `generated/core-ui-style-board-draft-v1.png`（SHA-256 `184E24BFD5C52F54FA240366787A0751E5078038E4FBDA17B91C61219F2B4DE5`）负责暖纸、粗圆 Ink 轮廓、硬底影、两级赛璐璐、Q 版角色和玩具卡片的完成品质。

两者共同定义 `pocket-tabletop-sticker-v1`。外部 UI 素材只回答“有哪些组件、状态、层级与交互工艺”，不得提供 Ghost Game 的皮肤、角色、线稿、构图或成品 CSS。发生冲突时，结构与可访问性服从第一项，视觉完成度服从第二项。

## 产品覆盖顺序

1. 代码原生 Token 与 Button/Card/Modal/Toast/Badge 有限 Pilot。
2. Room Seat、Lobby、Shop、Profile、DM、Playline、Auth 与 Outcome Surface。
3. 六款 Game Stage HUD、棋盘外壳、过程反馈与结算；Rule/Authority/Canvas 命中层保持独立。
4. Avatar、Honru、Emoji 与游戏美术逐族补齐稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚；取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可进入可逆 default-on runtime。人工清稿、自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 只作可选风险咨询。

## 组件结构

- Button：Ink 外轮廓 + Paper/Accent 主体 + 3–5px 底影；Pressed 下移 2–3px。
- Card：Paper 面板、右下接触影、标题/状态/行动三区；不可用毛玻璃承担主层级。
- Modal：标题、说明、内容滚动区、固定主要行动；一个可达滚动容器。
- Room Seat：Avatar/空席、READY/Host/AI/Offline、主要行动和非颜色状态符号。
- Shop Card：资产预览、名称、价格/owned/equipped、购买/装备行动；selected 不得代替 equipped。
- Avatar：图像、fallback、锁定/owned/equipped、焦点环；圆形裁切保留 8% 安全区。
- Badge：文本 + 图形双编码，含 neutral/info/success/warning/error/owned/equipped。
- Toast：图标、短标题、说明、可选行动；success/warning/error 明确区分且不只靠颜色。

## 必须状态

| 组件 | 状态 |
|---|---|
| Button | default / hover / pressed / focus / disabled / loading / error |
| Card | default / hover / pressed / focus / disabled / loading / error |
| Modal | opening / open / loading / error / closing |
| Room Seat | empty / human / ai / ready / host / offline / takeover |
| Shop Card | default / preview / owned / equipped / insufficient / loading / error |
| Avatar | default / selected / locked / owned / equipped / loading / error |
| Badge | neutral / info / success / warning / error / owned / equipped |
| Toast | info / success / warning / error / action / dismissed |

## 可访问性与响应式

- 所有可交互控件桌面和移动端均至少 44×44 CSS px；键盘焦点环不得被阴影/overflow 裁切。
- 正文 ≥4.5:1，图形/边界 ≥3:1；状态必须同时使用文字、图形或形状。
- 中文、英文、乌克兰语均不烘焙进图；为英/乌预留 35% 横向空间。
- 360/390/768/1024/1440 下主要行动可见；Modal 只有一个主要滚动容器。
- reduced-motion 只移除非必要运动，不移除 loading/error/owned/equipped 等信息。

## 运行时边界

`mg_ui_sticker_v1` 与总闸门 `mg_art_sticker_m0_v1` 必须保留一键回滚。尚未取得逐族 clearance 的 source sidecar/技术预览保持 inert 或 default-off；取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 的 runtime 派生可在 Manifest 中标记 `default_enabled: true`。关闭后完整回退现有 UI，不改变 DOM 语义、账号、商城、规则、奖励或联机协议。

人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` 时，不得伪造 PASS，也不得据此暂停可机器验证的设计、runtime 或内部预览工作。外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁用；发布仍须当前用户明确命令。

Historical-as-of（2026-08-09）：旧合同曾规定“逐资产人工 Golden Set 通过前默认关闭”并把 Avatar/Honru/Emoji/游戏美术统一写成 source-only。该 candidate-only/default-off 结论仅描述当时尚无所有者清除的预览，不覆盖 2026-08-16 owner-clearance 轨道，也不回写已获清除资产的当前状态。
