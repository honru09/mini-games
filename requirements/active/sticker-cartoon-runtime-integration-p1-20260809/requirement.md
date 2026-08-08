# Sticker Cartoon Runtime Integration P1：五子棋安全纵切

## Goal

在不覆盖 M0 Draft 原稿、不改变六款游戏规则/协议/经济/账号的前提下，把 `Pocket Tabletop Sticker` 的运行时开关管线和五子棋首个纵切接入当前 Ghost Game。形成“黑白品牌外壳 + 彩色贴纸游戏内容”的双层体系，并以默认关闭、显式双开关、资源失败完整回退证明后续扩展路径可行。

## IN

- 新建独立、版本化的五子棋 Sticker 运行时资产目录；源自既有项目自有精确 15×15/五连 SVG 规格，不覆盖 `art-source/`。
- 在 `asset_manifest.json` 登记稳定 asset ID、路径、完整性、预算、fallback、加载时机和双 feature flag。
- 新增 M0 总闸门 `mg_art_sticker_m0_v1` 与五子棋分闸门 `mg_art_gomoku_sticker_v1`；两者都必须显式等于 `1` 才启用。
- 只修改五子棋绘制表现：底材、边框、星位、棋子高光/接触影、最近落子与胜线；坐标、合法性、胜负、AI、联机快照保持不变。
- 资源缺失、加载失败或开关关闭时完整回退当前 `mg_art_gomoku_v1` / Canvas 表现；按已接受的 `CHANGE_REQUEST-静态底材策略-20260809.md`，本批静态 SVG 本身即为 reduced-motion/离屏静态状态，不新增低性能阈值或持续动画。
- 增加开关、manifest、15×15 坐标不变、fallback、主题/i18n/响应式和构建漂移 QA。

## OUT

- 不接入 Teacher、Avatar 100/117/124/141、平台 Sticker UI 或飞行棋；原稿、Prompt、hash、IP Review 状态全部保留。
- 不修改 `server/**`、`shared/rules/**`、`public/src/online/03-websocket.js`、`public/src/08-registry.js`、`supabase/schema.sql`、奖励或商城 ID/价格。
- 不进行全量 Avatar/六游戏批量生产，不把 M0 标记为人工通过或 production-ready。
- 不复制任何商业游戏角色、表情、棋盘构图、图标或受保护资产。
- 不把生成图当作规则真相；本纵切优先使用项目自有 SVG/CSS/Canvas 资产。

## Non-negotiable

- `mg_art_sticker_m0_v1 === '1' && mg_art_gomoku_sticker_v1 === '1'` 才启用；缺失、`0`、其他值均关闭。
- 关闭 Sticker 开关后，既有 `mg_art_gomoku_v1` 行为与视觉回滚链必须继续有效。
- 棋盘仍为 15×15，落子交点、胜负判定、状态数组、快照、AI 候选和 WebSocket payload 零变化。
- 新资源不烘焙可见文字，昼夜主题和三语言不需要两套图片。
- 单游戏新增运行时包不超过 1.5MB；SVG 无脚本、事件处理器、外链、滤镜炸弹或嵌入式位图。
- `public/index.html` 只能由 `scripts/build.js` 生成。

## Known Existing Behavior

- Ghost Game P0 已在提交 `aac40da1615f44aef3773c838ff51e737ce29e5a` 上线；M0 原稿位于 `art-source/`，八项 runtime paths 仍为空。
- 当前五子棋已用 `mg_art_gomoku_v1` 控制木纹底材，关闭时仍可用程序化 Canvas 回退。
- `gameArtEnabled()` 当前对旧美术旗标采用“不是 0 即启用”，不能直接复用于 M0 默认关闭契约。
- M0 人工 Art Bible、双人 IP Review 和 Golden Set 决议未执行，因此本 P1 只能提供默认关闭的技术预览。

## Expected UX

- 默认用户线上视觉完全不变。
- 测试者显式打开两个开关后，五子棋呈现 M0 的粗墨线、纸板/简化木材、两级明暗、珊瑚最近落子标记与金色五连反馈。
- 棋盘在 360/390/768/1024/1440 下保持完整正方形、交点清晰、触控不偏移；Light/Dark 中均可读。
- 任一资源失败或任一开关关闭时无报错、无空白棋盘、无无法落子，立即使用既有表现。
