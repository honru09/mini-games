# P1-01 Monopoly Final Art v1 — Prompt 与 provenance

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED`

## 固定视觉事实

- Style IDs：`pocket-tabletop-sticker-v1`、M0 component/state grammar 与 M0 finished texture。
- Ink `#211923`、Paper `#FFF9F2`、Cream `#F3E5C4`；语义色只用于玩家/状态识别。
- 圆润粗线、闭合轮廓、Base + Shade + optional Highlight、3–5px 硬接触影、低频纸质表面。
- 24 格、文字、资金、产权、价格、骰子结果、倒计时与行动按钮仍由 DOM/规则实时绘制，不烘焙进位图。

## 生成目标

1. `monopoly-city-board-source-v1`：三层可拆分城市棋盘母版与 24 格安全留白。
2. `monopoly-building-prop-kit-source-v1`：透明建筑、地标、道具、接触阴影与卡牌原子。
3. `monopoly-player-character-kit-source-v1`：同一 Ghost-native 玩家角色的待机/行走/落点/庆祝/破产语义姿态。
4. `monopoly-semantic-vfx-kit-source-v1`：机会、拍卖、支付、租金、购买、破产和结算局部反馈原子。

## 生成记录

生成完成后逐调用追加内置 provider/model、任务 ID、输入 SHA、精确 Prompt、输出路径、输出 SHA/尺寸/字节与审查结果。

## 本批确定性派生记录（2026-08-20）

- source board：`monopoly-city-board-source-v1.png`，SHA-256 `55080E72E43421E05E74B65597E6DF28E514813E9D6E61D11352B3C010B42E78`，1254×1254，RGB；仅作棋盘方向母版。
- chroma source：`monopoly-building-prop-kit-chroma-source-v1.png`，SHA-256 `BC8F077577D1A0DFF083BF22E3BE7F57E76665221E1BD9FAB27769D03414A72F`，1448×1086，RGB；仅经项目脚本受控色键去底。
- `scripts/generate-monopoly-final-art-v1.js`：生成 6 个透明原子；派生后中性化平衡洋红接触影，严格 Alpha/边缘/污染统计写入 family manifest。
- `scripts/generate-monopoly-final-runtime-v1.js`：生成 23 个 Ghost-native SVG masters 与 46 个 WebP（静态/动效同族变体），并更新 runtime manifest；provider=`deterministic-local-svg-sharp`，taskId=`p1-01-monopoly-final-art-v1-runtime-20260820`，transmissionScope=`local-only`。
- 外部素材目录仍为 `EXTERNAL_REFERENCE_ONLY / blocked-license`，没有作为 Skill 输入、像素、图层或 Runtime 来源。
