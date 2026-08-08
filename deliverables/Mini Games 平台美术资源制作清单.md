# Mini Games 平台美术资源制作清单（v3.0 生产完善版）

> 用途：为 6 款精选插件化游戏和平台大厅建立一套可并行生产、可渐进接入的视觉资产规范。
> 版本日期：2026-08-07；已合并用户提供的 v3.0 稳定 ID、manifest、精确棋盘规格、Prompt、音频、3D 试点、QA 与接入验收要求。
> 参考灵感：用户提供的《风起余烬 — 美术资产生成清单》中的 spritesheet、透明背景、帧序、9-slice、场景分层、特效 atlas 和保存路径方法；本清单不复用其角色、世界观、文件名或美术内容。
> 当前工程基线：Web/CSS/Canvas 优先；后续如接入 Godot，沿用同一命名、帧序和资产 ID。
> 执行快照：`public/assets/manifests/asset_manifest.json` 已落地；P-001 品牌 mark 与 P-003 虚拟现金 SVG 已接入；G-02 五子棋和 G-11 俄罗斯方块 P0 纵切已接入大厅封面、棋盘/井底材、绘制状态、feature flag 与程序化 fallback。其余四款保持可运行的 CSS/Canvas/Emoji fallback，正式包按本清单排期。

## 1. 总体美术方向

### 1.1 视觉母题：Pocket Tabletop

- 每款游戏都是一个可以放进大厅玻璃卡片的“口袋桌游世界”：棋盘/战场是主角，棋子和道具像桌面上的收藏级玩具。
- 3D 样式采用“软 3D + 清晰轮廓”：正面柔光、边缘高光、底部接触阴影、轻微环境色，不追求写实材质和高面数。
- 平台公共 UI 继续使用毛玻璃、渐变、半透明层、4px 间距刻度和 44px 触控目标；游戏资产不得破坏文字对比度和操作识别。
- 统一动画节奏：输入确认 80–120ms，普通动效 160–260ms，胜负/奖励 500–900ms；`prefers-reduced-motion` 下只保留必要状态变化。

### 1.2 颜色和光照

- 基础中性色：`#0D1220`（墨夜）、`#F7F9FC`（雾白）、`#64748B`（辅助文字）。
- 交互主色：`#4F6EF7`（靛蓝）；奖励色：`#F5B83D`（现金金）；成功：`#2FB67D`；风险：`#E35D6A`。
- 每款游戏增加一个“世界色”，只用于棋盘边框、选中态、粒子和小面积装饰，禁止大面积压过棋子/文字。
- 统一光照：左上方 45° 主光、右下方柔和反光、阴影透明度 16–28%；高亮不使用纯白大面积发光。

### 1.3 文件、帧序和交付格式

| 资产层 | 母版 | Web 运行时 | 约束 |
|---|---|---|---|
| UI 图标/Logo | SVG/FIG | SVG | 24px 网格；必须有 `aria-label` 对应语义 |
| 棋子/道具 | SVG 或 3D 渲染 PNG | WebP/PNG | 1x、2x；透明背景；锚点居中 |
| 帧动画 | Aseprite/PNG atlas | PNG/WebP atlas | 文件名含 `f00` 起始帧；帧尺寸固定 |
| 背景 | 分层 PSD/FIG | WebP/PNG | `bg_far/mid/near` 三层；移动端可只加载 far+mid |
| 粒子 | 矢量源文件 | PNG atlas 或 Canvas 参数 | 颜色、寿命、缩放写入 sidecar JSON |
| 3D 资产（预研） | GLB/Blender | 预渲染 WebP；Godot 可用 GLB | 面数、贴图尺寸、光照方向固定 |
| 音频提示 | WAV/工程源 | OGG/MP3 | 轻量、短、无语音依赖；可由 WebAudio 先占位 |

运行时根目录固定为 `public/assets/`，可编辑母版固定为仓库外或独立的 `art-source/`；下表为了可读性写的 `assets/...` 均表示 `public/assets/...`。游戏键只允许使用 `gomoku/ludo/monopoly/tank/tetris/xiangqi`。

命名格式：`mg_<scope>_<runtime_id>_<asset>_<state>[_v##].<ext>`。例如 `public/assets/pieces/ludo/mg_piece_ludo_token_red_idle_v01.webp`。逐帧文件才使用 `_f00`；单文件 atlas 使用 `_atlas` 并由 manifest 记录行列和帧序，不混用两种概念。同一资产的所有语言不改文件名，文案在 i18n 层维护；`aria-label` 由调用资产的 DOM 控件提供，不写进图像文件。

每条 manifest 必填：`asset_id`、`runtime_id`、运行时路径、母版路径、CSS 逻辑尺寸、像素尺寸、数量、atlas 行列、帧序、单帧时长、loop、pivot、alpha、1x/2x、reduced-motion fallback、字节预算、加载时机、a11y 语义、验收截图、版权/许可证和完整 Prompt。

```json
{
  "asset_id": "G-LUDO-TOKEN-RED-MOVE",
  "runtime_id": "ludo",
  "runtime_path": "public/assets/pieces/ludo/mg_piece_ludo_token_red_move_atlas.webp",
  "source_path": "art-source/pieces/ludo/token_red_move.aseprite",
  "logical_size": "48x48 CSS px",
  "pixel_size": "768x96",
  "atlas": { "cols": 8, "rows": 1, "frame": "96x96@2x", "order": ["f00","f01","f02","f03","f04","f05","f06","f07"] },
  "timing_ms": [60,60,60,60,60,60,60,90],
  "loop": false,
  "pivot": [0.5, 0.78],
  "alpha": true,
  "fallback": "mg_piece_ludo_token_red_idle_v01.webp",
  "budget_bytes": 120000,
  "load": "on game=ludo",
  "a11y": "视觉移动反馈；状态文字同时播报移动格数",
  "status": "待制作",
  "license": "project-owned",
  "prompt_ref": "PROMPT-LUDO-01"
}
```

资产状态统一使用四种值：`现有占位`（当前 CSS/Canvas/DOM Emoji/WebAudio 已能运行）、`待制作`（本清单的美术交付）、`已接入`（运行时已替换并通过 QA）、`未来逻辑依赖`（对应产品逻辑尚未上线，美术不能宣称已上线）。观众席、赛事编排、Tank/Tetris 权威协议、象棋棋钟和大富翁拍卖逻辑已经落地，但专用美术仍可标记为 `待制作`；只有完整用户回放、聊天/好友、赛季和跨端发行仍属于未来逻辑依赖。DOM Emoji 仅指当前棋子/角色等程序化占位，不代表投掷 Emoji 功能已经上线。除特别注明外，下表新资源默认均为 `待制作`。

## 2. 平台公共资产

| ID | 路径/资产 | 规格 | 状态/验收 |
|---|---|---|---|
| P-001 | `assets/brand/logo_mark.svg`、`logo_wordmark.svg` | 24/48/96px，浅色/深色 | mark 已接入 Header/Hero；wordmark 已制作待分享卡使用；小尺寸仍可辨识 |
| P-002 | `assets/brand/app_icon_512.png` | 512×512，圆角安全区 80% | GitHub Pages favicon、未来 App 图标共用母版 |
| P-003 | `assets/ui/currency_cash.svg` | `💵` 平台虚拟现金，16/24/32px | 已接入商城、档案、排行榜和结算；加载失败回退 `💵`；不暗示真实法币 |
| P-004 | `assets/ui/icon_set.svg` | 大厅、房间、邀请、排行榜、设置、语言、返回、关闭等 24px | 线宽 1.75px；深浅主题通过 CSS currentColor 适配 |
| P-005 | `assets/ui/avatars/mg_avatar_00-55.webp` | 56 个独立 96×96 头像，另交付 `_2x` 192×192；ID 0–29 免费、30–55 商城 | 商城 30–55 分类锁定为幻想、动物、职业、创意；每个 ID 独立文件，不能重排以免丢失已购内容 |
| P-006 | `assets/cosmetic/frames/mg_frame_00-08.webp` | 9 个独立 128×128 透明头像框 | ID 0–8 固定；内圈不遮挡头像脸部；动态框另交 atlas/JSON |
| P-007 | `assets/cosmetic/namefx/mg_namefx_00-04.json` | 闪名 ID 0–4：默认、流光、脉冲、彩虹、故障 | CSS/Canvas 参数 + 静态预览；必须提供 reduced-motion 降级 |
| P-008 | `assets/cosmetic/profile_bg/mg_profile_bg_00-10.webp` | 11 个独立 1200×480 横幅；ID 0–10 固定 | 7–10 为动态背景，0–6 静态；动态版有静态 poster |
| P-009 | `assets/theme/<runtime_id>/mg_theme_bg.webp` | `light/midnight/ocean/forest/cyber/sakura` 各 1600×900 | 主题 ID 与运行时一致；旧 `dark` 兼容映射到 `midnight`；仅作氛围底图 |
| P-010 | `assets/ui/dice_3d_atlas.webp` | 6 面×3 状态：静止/滚动/落定；每面 128×128 | 与现有 3D 骰子 DOM 视觉一致；可先用 CSS 生成，资源到位后替换 |
| P-011 | `assets/fx/shared_feedback_atlas.webp` | 点击、水波、选择、加载、AI 思考、重连、胜利、平局、失败 | 每个动作 3–6 帧，透明背景；动效 1 秒内可完成 |
| P-012 | `assets/fx/shared_reward_cash.webp` | 纸钞飞入、余额跳字、排行榜上升，8–12 帧 | 由服务端 Reward Breakdown 驱动可变金额；`💵=0` 时不播放入账，数值由 UI/i18n 实时生成；禁止烘焙固定金额或展示“无限财富” |
| P-013 | `assets/ui/badges/mg_achievement_*.svg` | 首胜、十胜、五十胜、三连胜、五连胜、等级 5、全能玩家、社交达人 8 个徽章 | 胜场徽章仅绑定服务端 `totalWins` / Supabase `total_wins`，不得以余额代替；另交 5 个称号和 4 个每日任务图标；16/24/32px 三档；名称在 i18n 中维护 |
| P-013A | `assets/cosmetic/effects/mg_avatar_effect_00-04.json` | 独立头像动态效果 ID 0–4：默认、呼吸、星光、漂浮、环绕旋转 | 不能与 nameFx 混用；CSS/Canvas 参数 + reduced-motion 静态态 |
| P-014 | `assets/ui/emoji_projectiles.svg` | ❤️、💩、🍅、🥚、💵 五类投掷表情的静态 glyph、轨迹与命中图 | 未来逻辑依赖；作为 P-024 动画 atlas 的矢量母版和静态 fallback；协议就绪后由客户端渲染 |

### 2.1 平台功能状态资产（补齐 UI 全链路）

| ID | 路径/资产 | 规格与状态 | 必备状态/验收 |
|---|---|---|---|
| P-015 | `assets/ui/game_covers/game_*.webp` | 6 张 640×360 大厅封面 + 320×180 缩略图；五子棋/俄罗斯方块 2 张已接入，其余 4 张待制作 | normal/hover/selected/locked；不得依赖封面文字表达游戏名 |
| P-016 | `assets/ui/auth_pin.svg` | PIN 注册、登录、设备自动登录、会话失效；待制作 | show/hide、valid/error/loading/success；三语文案不烘焙进图 |
| P-017 | `assets/ui/shop_states.svg` | 商城商品卡和价格标签；待制作 | owned/equipped/locked/insufficient/sold-out/limited/loading/error |
| P-018 | `assets/ui/leaderboard_podium.webp` | 前三领奖台、排名上升/下降、空榜；待制作 | 1/2/3 名不只靠颜色；兼容 `💵` 与局数两类榜 |
| P-019 | `assets/ui/panel_9slice.webp` | Modal、Toast、设置、档案、公告 9-slice；待制作 | normal/success/warning/error；四角不拉伸，最小 280×120 |
| P-020 | `assets/ui/button_states.svg` | primary/secondary/danger/icon button；待制作 | normal/hover/pressed/disabled/focus/loading；触控 44px |
| P-021 | `assets/ui/system_states.svg` | 空态、离线、重连、恢复、超时、404、服务不可用；待制作 | 图形 + 文本区域；reduced-motion 静态版 |
| P-022 | `assets/social/chat_layers.svg` | 大厅/房间/游戏内/私聊/公告五层聊天；未来逻辑依赖 | 发送中/失败/重试/屏蔽/举报/未读/系统消息 |
| P-023 | `assets/social/friends_actions.svg` | 好友申请、接受、拒绝、删除、邀请、拉黑、举报；未来逻辑依赖 | 现有邀请/在线状态不等同于完整好友关系；destructive action 有二次确认；在线/离线不只靠颜色 |
| P-024 | `assets/social/emoji_projectiles.webp` | 五类表情的发射/轨迹/命中 atlas；未来逻辑依赖 | 每类 6–10 帧；频控、静音、关闭动效时可用 |
| P-025 | `assets/event/match_event_icons.svg` | Forward/Backward/Extra Roll/Curse/Blessing/Extra Life；未来逻辑依赖 | icon、事件卡、Buff/Debuff、小型 HUD、入场/命中/消退 |
| P-026 | `assets/replay/replay_controls.svg` | 用户回放时间轴、播放、暂停、倍速、回合跳转、分享；待制作 | 独立观众席/只读标签/重连快照及可配置延迟发送队列已上线；用户可操作的时间轴、跳转、分享与回放存档仍待实现；键盘可达 |
| P-027 | `assets/meta/tasks_season.svg` | 每日/每周任务、赛季、锦标赛、季票、限时商品；待制作 | 赛事编排/积分面板已上线但没有专用正式美术；赛季、周任务、领奖与季票仍待实现；locked/active/claimable/claimed/expired；真实支付与 `💵` 分离 |
| P-028 | `assets/platform/cross_platform_pack/` | PWA、App、小程序、桌面、Steam 发行包；未来逻辑依赖 | PWA 192/512、启动图、Android/iOS 自适应图标、商店截图、分享卡、Steam capsule/library/DLC 图 |
| P-029 | `assets/ui/modes/mg_mode_*.svg` | 人机、联机 2 图标；待制作 | 24/48/96px；AI persona 与联机状态分别有可读徽标 |
| P-030 | `assets/ai/mg_persona_<id>_*.webp` | `tsundere/gambler/mean/cute/teacher` 五套 192×192 头像；待制作 | 每人格 think/win/lose 气泡插图各 1；文字由 i18n/运行时渲染；人格只改变表达与近优选择，不允许覆盖强策略 |
| P-031 | `assets/ui/room/mg_room_states.svg` | 席位、房主皇冠、等待、满员、游戏中、在线、离线、重连；待制作 | 不能只靠红/绿；房主与本人状态有形状/标签双编码 |
| P-032 | `assets/ui/profile/mg_growth_states.svg` | XP、5 称号、8 成就、4 每日任务、最近一起玩；待制作 | locked/unlocked/progress/claimable；当前任务仅显示进度，领奖属未来逻辑 |
| P-033 | `assets/ui/settings/mg_settings_states.svg` | 六主题预览、三语言旗帜、声音/动效开关；待制作 | 主题 ID 与 runtime 对齐；旗帜不是唯一语言文本；on/off/focus/disabled |

功能追踪规则：Logo/封面/棋子/头像/主题氛围属于正式资产；交互网格、文字、焦点环、进度数值和 aria 语义由 HTML/CSS/Canvas/i18n 生成；Loading、骰子、基础音效现有程序化占位，正式资产到位前不得删除 fallback；聊天、Emoji、用户回放、赛季和跨端发行资产标记为“未来逻辑依赖”，观众席与赛事编排的运行时逻辑已完成但专用素材仍是“待制作”。当前仓库真实 raster/SVG 交付仅包括品牌 mark/wordmark、`currency_cash.svg`、五子棋/俄罗斯方块各两档封面和各自底材；其余清单项不得标记为“已接入”。

## 3. 6 款精选游戏资产矩阵

### 3.1 棋类和棋盘类

| ID | 游戏 | 棋盘/场景 | 棋子/道具 3D 样式 | 必做动效 |
|---|---|---|---|---|
| G-02 | 五子棋 | `mg_board_gomoku_surface_v01.webp`：温润木纹底材；网格/星位由 Canvas 精确绘制；已接入 | 黑白棋为 Canvas 软 3D 抛光石；已接入 | 已接入置子反馈、最后落子和胜线；“禁手”仅作为未来可选规则包 |
| G-06 | 象棋 | `board_xiangqi_9x10.webp`：朱砂线、玉石边框、楚河汉界 | 红黑棋子为玉石/木雕圆片，文字可替换 SVG | 走子磁吸、吃子碰撞、将军闪烁、将死聚光；复盘拖影为未来回放依赖 |

### 3.2 骰子、地图和动作类

| ID | 游戏 | 棋盘/场景 | 棋子/道具 3D 样式 | 必做动效 |
|---|---|---|---|---|
| G-07 | 飞行棋 | 52 格环形轨道 + 4 基地 + 4 条终点航线，网格/地形/标签分层 | 4 色×4 架飞机；单骰使用公共 3D atlas | 掷骰、逐格、碰撞回基地、已实现的终点折返、归位皇冠、庆祝纸屑 |
| G-08 | 迷你大富翁 | 24 格环形地图；起点/机会/税/休息/车站/地产分层 | 双骰、5 个玩家标记、产权标记；首版无房屋升级 | 掷骰、格子弹跳、买地卡、收租局内资金、破产警示；局内资金图标不得使用平台 `💵` 钱包 ID |
| G-09 | 坦克大战 | 正式 2 人图为 15×13；砖墙/钢墙/基地/空地分层 | 2 坦克×四方向、3 HP、炮弹、击毁/2 秒重生状态 | 移动、后坐力、炮口火、钢墙阻挡、砖墙碎裂、爆炸；护盾反弹为未来逻辑依赖 |
| G-11 | 俄罗斯方块 | 每人 10×18 井，最多并列 4 井；`mg_board_tetris_well_v01.webp` 已接入 | 7 种颜色 + 7 种纹理；active/ghost/locked/clear 已接入 | 已接入旋转、软降、硬降、锁定与消行脉冲；连击/Tetris 爆发继续深化 |

每款游戏至少交付：棋盘底图 3 套、棋子/角色主视觉 1 套、状态变体（idle/selected/disabled/win/lose）5 套、移动/落子/吃子或碰撞动效 3–6 帧、胜负结算 1 套、深浅主题对比校验图 1 张。

当前 G-02 五子棋与 G-11 俄罗斯方块已完成 P0 纵切；飞行棋、迷你大富翁、坦克大战和象棋为“现有 CSS/Canvas/DOM Emoji fallback + 正式游戏资产待制作”。Tank/Tetris 权威协议、象棋棋钟、大富翁拍卖、观众席和赛事编排的运行时逻辑已通过专项 QA；五子棋禁手、坦克护盾、完整象棋回放和用户回放仍是未上线规则/产品能力，相关素材不能提前标记“已接入”。

### 3.3 运行时数量与拆层锁定（工程接入权威表）

| runtime_id | 规则尺寸/数量 | 必须拆分的运行时层 | 首批导出规格 |
|---|---|---|---|
| `gomoku` | 15×15、黑白棋 | 木纹背景已接入；15×15 规则网格/星位/棋子/最后落子/胜线仍由 Canvas 精确绘制 | 背景 1024² WebP 已接入；棋子为 Canvas 软 3D v1；当前无禁手资产 |
| `ludo` | 52 格轨道、4 色×4 架、4 基地、4 终点航线、单骰 | 背景、轨道/基地/终点标签、交互坐标（代码原生）、16 架飞机、骰子 | 棋盘 1200²；飞机 4 色×192²；折返规则已实现，正式折返素材待制作 |
| `monopoly` | 24 格、双骰、最多 5 标记 | 城市背景、24 格规则层、起点/机会/税/休息/车站/地产、产权标记、5 pawn | 棋盘 1200²；地块图标 SVG；pawn 192²；首版不做房屋升级 |
| `tank` | 15×13、砖/钢/基地、2 坦克×4 方向、3 HP | 地面、规则网格、墙/基地 tile、坦克、炮弹、生命、击毁/重生 | tile 96²；坦克每方向 192²；爆炸 6 帧；未来护盾另 flag |
| `tetris` | 每人 10×18 井，最多 4 井、7 方块 | 玻璃井背景已接入；规则格由 CSS 精确生成；7 方块 active/ghost/locked/clear 已接入 | 640×1152 WebP 井底材；7 色同时用纹理区分；4 井保留 CSS fallback |
| `xiangqi` | 9×10、双方各 16 子、14 种正面字形 | 背景、线/楚河汉界、规则交点（代码原生）、红黑棋、将军/将死 | 棋盘 1024×1152；棋子 160²；文字保留可编辑 SVG 母版 |

交互网格、合法坐标和规则标签以代码为准；美术棋盘不得把命中区域烘焙成唯一信息。每款游戏必须以 feature flag 原子交付“棋盘 + 棋子 + 状态 + 动效 + 音频 + fallback”，不能先铺一张不可交互的大图。

### 3.4 每款游戏主资产完整 Prompt（首轮生成）

以下 Prompt 对应“棋盘氛围底图 + 棋子主视觉”首轮；实际生成时须把 manifest 的尺寸、数量、分层、透明背景和禁用文字条件附在末尾。棋盘 Prompt 不要求透明背景；棋子 Prompt 要求透明背景；象棋字形不得让模型生成，使用人工校对的 SVG。

1. **五子棋 `gomoku`**：`A refined 15x15 gomoku tabletop, warm maple wood grain background with subtle metal star points, polished black and ivory stone pieces, soft reflections, top-left 45 degree light, calm modern board-game photography rendered as clean soft 3D, no labels or text.`
2. **飞行棋 `ludo`**：`A whimsical pocket aviation race board based on a 52-cell circular track, four colored home bases and four finish lanes, cloud-layer background, sixteen toy airplane tokens in red blue green yellow, collectible soft 3D plastic, clear silhouettes and colorblind-safe emblem patterns, no text.`
3. **迷你大富翁 `monopoly`**：`A compact 24-cell city property board, miniature streets and skyline diorama, start chance tax rest station and property icon zones, five distinct toy pawns and two dice, soft 3D, readable top-down layout, no brand names, no baked currency text.`
4. **坦克大战 `tank`**：`A 15 by 13 toy tank arena, modular brick wall steel wall base and ground tiles, two compact toy tanks with four directional views, luminous shells, soft 3D plastic and metal, clean tile boundaries, no shield unless marked future concept.`
5. **俄罗斯方块 `tetris`**：`A translucent glass tetris well, seven frosted glass tetromino families with bevel highlights and unique surface patterns, active ghost locked and line-clear visual states, neon edge accents, soft 3D, clean grid alignment, no text.`
6. **象棋 `xiangqi`**：`An elegant 9 by 10 Chinese chess tabletop, jade and carved wood round pieces, red and dark teams, soft 3D rim and contact shadows, clean river and palace linework, piece face characters left blank for manually verified SVG overlays, no AI-generated Chinese text.`

## 4. 共享动效、声音和 3D 预研

### 4.1 动效 atlas

| ID | 文件 | 帧规格 | 触发 |
|---|---|---|---|
| FX-01 | `assets/fx/input_tap.webp` | 3×64×64 | 按钮/格子点击，80–120ms |
| FX-02 | `assets/fx/piece_move.webp` | 4×96×96 | 棋子/棋盘移动，160–260ms |
| FX-03 | `assets/fx/capture.webp` | 5×128×128 | 吃子/碰撞/击毁 |
| FX-04 | `assets/fx/roll_dice.webp` | 8×128×128 | 骰子滚动与落定 |
| FX-05 | `assets/fx/ai_thinking.webp` | 6×80×80 | AI 思考中；无文字也能识别 |
| FX-06 | `assets/fx/result_win.webp` | 8×320×180 | 胜利：彩带、星光；💵/XP 数值由 Reward Breakdown UI 动态叠加，资产不得烘焙固定金额 |
| FX-07 | `assets/fx/result_draw.webp` | 6×320×180 | 平局：中性脉冲，不误导为失败 |
| FX-08 | `assets/fx/result_lose.webp` | 6×320×180 | 失败：柔和暗角，可快速再来 |
| FX-09 | `assets/fx/reconnect.webp` | 6×96×96 | 重连等待、恢复、超时三种色调 |
| FX-10 | `assets/fx/countdown_3_2_1.webp` | 每个数字 4 帧 | 开局倒计时，支持色盲安全轮廓 |

上表 `N×W×H` 统一解释为“单行 N 列 atlas、单帧 W×H”；例如 FX-01 总图 192×64。默认不 trim，四周保留 4px 透明安全边，导入 atlas 时 extrude 2px、最大单图 2048²、pivot 为中心 `(0.5,0.5)`。FX-01/02/03/04/06/07/08/10 播放一次，FX-05/09 可循环；默认 12fps，输入反馈按总时长压缩到 80–120ms，胜负 8–12fps。每项必须指定事件帧、静态 poster 和 reduced-motion fallback；若选择 animated WebP，就不再同时交付同名 PNG atlas，manifest 只允许一种运行时格式。

多人颜色不得只做色相替换：2–5 人同时增加圆/三角/菱形/星/十字徽记或点/条/格纹；动画闪烁频率不超过 3 次/秒。

### 4.2 音频占位和最终资产

- 先用现有 WebAudio `click/move/place/capture/score/win/lose/pop` 映射作为零资源兜底；最终扩展 `roll/confirm/draw/ai/reconnect/purchase/invite/countdown/reward/levelup` 和各游戏专属音效。
- 母版：48kHz/24-bit WAV、峰值 ≤−1 dBTP、短效目标约 −16 LUFS；运行时 OGG/MP3，UI 单效 ≤30KB、游戏单效 ≤80KB，每个高频动作提供 2–4 个轻微变体并设并发组，避免叠加爆音。
- 重要音效与动作发生时间差小于 15ms；系统静音、浏览器自动播放限制和无障碍设置必须可用。
- 首期不制作 BGM，避免首屏和循环播放负担；若未来增加 BGM，独立懒加载、可单独静音并标循环点。

### 4.3 3D 预研模型

- 每类棋子提供 128×128、256×256 预渲染图；只有性能预算允许时才交付 GLB。
- GLB 约束：单棋子 2k–8k triangles、单张 512×512 PBR 贴图、最多 2 个材质槽；2D 预渲染使用正交相机并在 manifest 锁定 orthographic scale（不使用透视相机的 35mm 焦距表述），主光固定左上 45°。
- 3D 资产必须有 2D fallback；Web 首发不依赖 WebGL 才能开局，Godot 迁移时再使用 GLB/动画树。
- 6 款都交付软 3D 预渲染 2D；仅选择 3 款做真实 GLB pilot。每个 GLB manifest 记录米制单位、Y-up、前向轴、原点/pivot、UV、BaseColor/Normal/ORM、LOD0/1、动画 clip、投影规则、`.blend` 母版、`.glb` 和 2D fallback。试点选择依据为活跃度、资产复用和交互复杂度，成功后再覆盖剩余 3 款。

## 5. 生成与验收 Prompt 模板

```text
Mini Games Platform, pocket tabletop toy aesthetic, soft 3D, clean silhouette,
top-left 45 degree key light, subtle contact shadow, glossy edge highlight,
transparent background, no text, no watermark, centered object, consistent scale.
Asset: <game/object>; state: <idle/selected/win/lose>; palette: <world color>.
Deliver as <size>, <frame count>, atlas order f00..fNN, plus 2x export.
```

验收四步：

1. 结构：尺寸、透明通道、帧顺序、文件名、2x 导出和 sidecar 元数据齐全。
2. 识别：1 秒内能区分玩家、棋子、选中态、胜负态；缩小到 44px 仍可识别。
3. 对比：浅色/深色/海洋/森林/赛博/樱花六主题下，文字和棋子对比度不低于产品无障碍目标。
4. 性能：首屏不加载未选游戏资源；单游戏资源包建议 ≤1.5MB（不含可选 3D），移动端提供低清 fallback。

### 5.1 每款游戏专属音效矩阵

| 游戏 | 专属音效（除共享 tap/win/lose 外） |
|---|---|
| 五子棋 | 黑/白石落木盘、胜线确认 |
| 飞行棋 | 骰子滚动、飞机起飞、逐格、碰撞回基地、终点折返、归位 |
| 大富翁 | 买地、收租、事件卡、局内资金入账、破产（不使用平台 `💵` 钱包音） |
| 坦克大战 | 履带、炮口、命中、墙碎、爆炸、未来护盾 |
| 俄罗斯方块 | 旋转、软降、硬降、锁定、消行、连击、Tetris |
| 象棋 | 木/玉走子、吃子、将军、将死 |

### 5.2 `💵` 全站迁移与资产隔离

本节已进入执行态：源码统一使用 `CURRENCY = '💵'` 和 P-003 SVG，商城、档案、排行榜、邀请列表、对局结算与 Reward Breakdown、toast 已完成迁移；内部数据字段仍保留兼容名称 `coins`，它是协议字段而非用户可见货币符号。

| 场景 | 统一显示/资产 | 禁止 |
|---|---|---|
| Header 余额、档案、排行榜 | `💵` + 数值；P-003 `currency_cash.svg` | 旧字母币标、coin 图标或任何旧货币文案 |
| 商城价格/余额不足 | `💵` + 价格；购买成功纸钞飞入/扣除 | 与法币价格、美元符号或可提现承诺混用 |
| 对局结算 | 服务端 Reward Breakdown 动态显示 💵/XP；金额大于 0 时播放 P-012 `shared_reward_cash.webp` | 固定 `+💵1`、客户端自算金额、隐藏平局/失败奖励或无限财富暗示 |
| Emoji 投掷 | P-024 `emoji_projectiles.webp` 中的现金表情，纯社交用途；未来逻辑依赖 | 触发余额变更或购买 |
| 大富翁局内资金 | `mg_money_monopoly_note`，城市游戏券样式 | 使用平台钱包 asset ID 或写入平台 `coins` |
| a11y 文案 | “平台虚拟现金，余额 N” | 朗读为真实美元、可提现现金 |

## 6. 生产批次和接入顺序

1. **P0 工程锁定**：冻结 manifest schema、运行时 ID、`💵` 迁移表、资源加载器、feature flag、fallback 和 CI 校验。
2. **P0 两个纵切（已完成）**：Canvas 五子棋和 DOM/网格俄罗斯方块已同时接入棋盘/井底材、绘制层棋子、状态、动效、既有 WebAudio、a11y、独立 feature flag 与 fallback。
3. **P0/P1 原子扩展**：逐款发布其余 4 款；不允许只替换棋盘而保留风格不一致的棋子，或只交动画不交静态 fallback。
4. **P1 平台与个性化**：Logo、`💵`、模式/AI/房间/商城/成长 UI，随后按持久化 ID 接入 56 头像、9 个头像框 ID（默认 + 8 款）、5 个头像效果 ID（默认 + 4 款）、5 个闪名 ID（默认 + 4 款）、11 个背景 ID（默认 + 10 款）和 6 主题。
5. **P2 3D/Godot 试点**：3 款 GLB pilot；失败时保留 2D fallback；通过后分批覆盖剩余 3 款。
6. **P2 功能资产**：观众席与锦标赛专用素材可按已落地协议制作但当前仍未生成；Emoji、Match Event、好友/聊天、用户回放、赛季和跨端商店素材继续等待对应产品逻辑 ready 后再启用。

每批都需要 feature flag、现有 CSS/Canvas/WebAudio fallback、视觉快照、字节预算、CI manifest 校验和明确回滚条件。

## 7. 资产目录建议

```text
public/assets/
├── brand/              # Logo、favicon、商店封面
├── ui/                 # 图标、现金、徽章、按钮、9-slice、atlas
├── cosmetic/           # 头像、头像框、闪名参数、档案背景
├── theme/              # 6 套主题氛围图
├── board/              # 6 款棋盘/战场底图和皮肤
├── pieces/             # 黑白棋、飞机、玩家标记、坦克、方块、象棋棋子
├── fx/                 # 共享/专属粒子与结算动效
├── audio/              # UI、对局、结果音效
├── 3d/                 # 可选 GLB、材质、渲染预览
└── manifests/          # asset_manifest.json、版本、许可证、a11y 备注

art-source/             # 不随 Web 首屏发布：FIG/PSD/Aseprite/Blend/WAV 母版
```

## 8. 版权、可访问性与发布闸门

- 参考图只用于风格启发，不复制角色、构图、文件名、文字或受版权保护的独特表达；每批资产登记来源、生成工具、授权状态和修改记录。
- 资产不得把国旗、货币、疾病、身体特征作为负面标签；默认提供高对比轮廓、色盲可分辨纹理或形状差异。
- WCAG AA：普通文本对比度至少 4.5:1，大字/UI/图形至少 3:1；2–5 人使用形状/纹理双编码；闪烁不超过 3 次/秒；声音不能是唯一反馈。44px 是 HTML/Canvas 交互命中区，不强制素材自身正好 44px。
- 字节预算：单 SVG 建议 ≤25KB、单普通 raster ≤150KB、单 atlas ≤1MB、平台首屏新增资产 ≤500KB、单游戏懒加载包 ≤1.5MB、可选离线全缓存建议 ≤20MB；超限必须说明并提供低清版本。
- 发布前跑尺寸、alpha、孤儿文件、命名、重复帧、atlas 布局、字节预算和许可证检查；视觉回归覆盖 6 主题 × 3 语言 × 360px/桌面 × normal/reduced-motion。
- 若资产未通过性能或无障碍闸门，回退到现有 CSS/Canvas/WebAudio 方案，不能阻塞开局主链路。
