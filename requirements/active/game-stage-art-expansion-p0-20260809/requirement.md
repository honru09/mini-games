# Game Stage + Tabletop Art Wave A P0

状态：`REQUIREMENT_FROZEN`

## Goal

把六款游戏从“大厅网页里出现一块棋盘”升级为独立、沉浸式的 Ghost Game 对局舞台，并以原创代码原生的 Pocket Tabletop 风格覆盖至少 52/100 可见美术分；同时移除 Honru 助手聊天界面与不符合游戏平台语境的元叙事文案，保留玩家私聊、签到协议和可选局内 IP 反应。

## IN

- 共用 Game Stage：Match Header、实时 Seat Rail、Arena、Command Tray、联机/观战/掉线/房主状态。
- Seat Rail 只读取既有 `online.roomInfo.seats`、`online.isHost`、`online.isSpectator`、`online.player` 和游戏当前回合，不新增协议。
- 六款游戏默认可见的原创代码美术：Ink/Paper/Cream、粗深色轮廓、两级明暗、右下接触影、卡片化操作区。
- 五子棋、飞行棋、大富翁、坦克、俄罗斯方块、象棋的棋盘/战场/方块井与核心棋子/单位/方块全部接入 Wave A。
- 删除前端 Honru Chat 子页、首页对话入口、悬浮 Dock、快捷问题和聊天表单；`#/chat?view=honru` 安全归一到玩家消息。
- 保留 `companion_checkin`、Honru 品牌资产、签到入口与默认关闭的局内反应；后端 `/api/companion` 本轮只做无入口兼容，不删除。
- 删除 `profile_route_intro` 展示段和 `profile_kicker` 元标题，不用另一段技术说明替换。
- 三语言、light/dark、360/390/768/1024/1440、reduced-motion、触控目标和 safe-area 同步验收。

## OUT

- 不修改服务端消息、共享规则、Reward Resolver、AI 学习、Supabase、商城价格/owned、Replay 或比赛结果。
- 不把 M0/P1/Honru P2 未完成人工/IP 审批的位图/SVG Draft 改成默认开启。
- 不复制参考图的具体角色、构图、道具或商业 IP；只采用抽象视觉原则。
- 不新增虚假的局内按钮；Command Tray 只承载既有真实操作。
- 不把模拟视口写成 Android/iPhone/Tablet 真机通过。

## Non-negotiable

- 规则快照、联机 payload、坐标、命中、计时器、AI 候选、奖励与结算前后完全一致。
- Wave A 默认开启；只有 `localStorage.mg_art_tabletop_wave_a === '0'` 时回退旧表现。读取异常必须继续使用默认 Wave A。
- `public/index.html` 只能由 `scripts/build.js` 生成。
- Chat 只剩玩家私聊；访客继续遵守 Direct Chat 禁止持久化边界。
- 观众无输入，非房主无房主动作；返回大厅不得销毁仍进行的联机局。
- 所有新增用户可见文案进入三份 locale，不扩展中文运行时替换表。

## Known Existing Behavior

- 六款大厅封面已上线，但属于软 3D 过渡风格。
- 五子棋旧木纹与俄罗斯方块旧玻璃井默认可见；Sticker 五子棋和 Honru 九状态均为严格双闸门默认关闭。
- 飞行棋、大富翁、坦克、象棋没有目标风格局内资源管线。
- 当前 `#screen-game` 仍复用平台普通宽度/间距；玩家栏只显示简化的“玩家 1/2”。
- `online.roomInfo.seats` 已提供真人/AI/空位、昵称、头像、房主、READY、离线、AI Controller 等信息。

## Expected UX

- 进入游戏时平台导航退场，出现完整桌游舞台；玩家能立即看清自己、对手、房主、AI、离线、观众和当前行动者。
- 棋盘/战场成为视觉中心，操作与状态集中在明确的卡片托盘，手机不遮挡 Tank/Tetris 输入。
- 六款游戏看起来属于同一个 Ghost Game 产品，但保留各自规则辨识度。
- Chat 区直接进入玩家消息，不再出现 Honru 聊天框、对话按钮或悬浮助手。
