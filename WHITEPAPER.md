# Mini Games Platform · 项目白皮书

**版本：v3.2（2026-08-07）**
**状态：Seat v2、Social Graph v1、Premium Background Pack v1 与统一图标系统已落地；Supabase 生产接入待凭证验收**

> 本文件是仓库内的公开技术总纲。完整排版版位于 `deliverables/`；实现事实以当前源码、测试和本文件为准。

## 0. 三十秒定位

- 产品：网页版多人游戏平台，保留 6 款可持续深化的插件化游戏。
- 游戏：五子棋、飞行棋、迷你大富翁、坦克大战、俄罗斯方块、象棋。
- 模式：人机对战、WebSocket 联机对战；真人房可加入真实 AI Seat。
- 核心体验：打开约 3 秒开局，约 5 分钟一局，结算后立刻再来；先看到人，再看到游戏。
- 技术：零 npm 运行依赖；前端模板 + JS 模块构建成单页；Node 静态服务、手写 WebSocket、DeepSeek 代理、可选 Supabase。
- 线上：GitHub Pages 前端 + Render 后端。

## 1. 产品基线

| runtime_id | 游戏 | 人数 | 人机 | 联机 / 混合 Seat |
|---|---|---:|---:|---:|
| `gomoku` | 五子棋 | 2 | ✅ | ✅ |
| `ludo` | 飞行棋 | 2–4 | ✅ | ✅ |
| `monopoly` | 迷你大富翁 | 2–5 | ✅ | ✅ |
| `tank` | 坦克大战 | 2 | ✅ | ✅ |
| `tetris` | 俄罗斯方块 | 2–4 | ✅ | ✅ |
| `xiangqi` | 象棋 | 2 | ✅ | ✅ |

平台能力包括 PIN 账号、设备自动登录、换机登录、💵 虚拟现金商城、排行榜、XP/等级/连胜、个性化装扮、三语言、六主题、在线状态、好友请求、屏蔽、举报、房间大厅、邀请、掉线恢复和结算共识。

## 2. 架构

```text
public/index-template.html + public/src/*
                 │ node scripts/build.js
                 ▼
          public/index.html
                 │ HTTP + WebSocket /ws + POST /api/ai
                 ▼
          server/index.js
                 │ 可选 REST（service_role，仅服务端）
                 ▼
        Supabase profiles/history/reward_history/economy_ledger/analytics_events
                 + friend_requests/friendships/blocks/reports
```

关键约束：

- `public/index.html` 是生成物；改前端必须修改模板或 `public/src/` 后重新构建。
- 服务端统一维护 `human | ai | empty` Seat、房主、READY、公开性、观战者和 AI `controllerUid`；坦克与俄罗斯方块使用专项服务端权威层，其余回合制游戏仍由客户端规则二次校验。
- `move` 由服务端记录顺序、发送者编号和有限 moveLog；客户端仍会验证当前行动者与具体走法。
- 开局按当前 active Seat 数，不要求填满容量；所有真人必须在线并 READY，房主显式开始。
- 真人异常断线在重连窗口内保留 Seat；超时或主动离开会结束当前局、压紧席位并转移房主，只有最后一名真人离开才关闭房间。AI 的 `controllerUid` 随房主同步转移。
- 观战者是独立只读身份，不占 Seat，不能走子或提交房间结算。
- 混合房只向真人账号结算：两名以上真人使用联机奖励；单真人 + AI 使用 AI 奖励与每日上限；AI 永远没有奖励账号身份，也不能通过增加 AI 抬高多人奖励。
- Social Graph 由服务端保存请求、好友、屏蔽和举报关系；屏蔽会同时阻断好友请求、房间邀请、公开房发现和按码直加入，客户端不能自报关系状态。
- Presence 由服务端按连接、房间和隐私偏好计算；隐身用户对普通用户统一表现为离线 / 不可加入，不通过排行榜或社交接口泄露真实在线状态。

## 3. DeepSeek AI

六款游戏各自的 `scheduleAI()` 只把规范化合法选项交给 `aiChoose()`。模型返回值必须与某个选项完全匹配，游戏逻辑还会再次验证；无 token、无 Key、超时、限流、断网或非法返回时使用本地策略。

DeepSeek Key 只存在于服务端环境变量。`qa/ai-games.js` 使用本地模型桩覆盖全部六款游戏，不依赖真实 Key。

## 4. 账号、经济与数据

- PIN 为 4–20 位字母数字；服务端保存版本化慢哈希。
- 客户端只持久化服务端 session token，不保存 PIN。
- 权威字段：💵 余额、owned、XP、等级、连胜、按游戏胜场 `wins`、总胜场 `totalWins`、局数、成就与结算历史；胜场与余额完全独立。
- Economy & Progression v1.0 由统一服务端 Reward Resolver 驱动：联机 1v1 胜/平/负为 `3/2/1💵` 与 `12/10/8 XP`，多人按名次为 `4/3/2/1💵` 与 `14/12/10/8 XP`。
- AI 通过服务端票据与有效动作进度结算，胜/平/负为 `1/0/0💵` 与 `8/6/5 XP`，每日 AI 货币上限为 `3💵`；无服务端票据的内部规则运行不产生正式 💵/XP。
- 每日首胜、连胜 XP、重复对手衰减、有效比赛/AFK/秒投判定和 `XPNext=min(200,30+5×Level)` 等级曲线均由服务端配置化执行。
- `history` 保留兼容结算记录，`reward_history` 保存完整奖励明细与防刷依据，`economy_ledger` 审计每次 💵 增减，`analytics_events` 记录比赛和经济埋点。
- Supabase 正式奖励通过 `apply_reward_v1` 按账号加锁并以 `result_id` 幂等，在单事务中更新档案、历史、奖励明细和可选经济流水；埋点仍独立写入。
- Supabase schema、RLS 和适配脚本已就绪；真实生产接入仍取决于 `SUPABASE_URL` 与仅服务端保存的 `service_role` secret。
- 未配置 Supabase 时回退到 JSON；当前 Render 未挂载持久磁盘，因此不能把 JSON 回退描述为生产持久化已完成。

### Social Graph 与安全

- Social Graph v1 只实现请求、接受/忽略/取消、移除好友、屏蔽/解除屏蔽和举报；不包含聊天、Feed、公会或自动处罚。
- 举报只进入 Moderation Intake，固定原因、限频并保存最小上下文与目标显示快照；服务端过滤 HTML、控制字符和超长文本。
- Supabase 增加 `friend_requests`、`friendships`、`blocks`、`reports`，与原 5 张权威表合计 9 张表全部启用 RLS，且不向 `anon` / `authenticated` 授权。
- `qa/social-graph.js` 覆盖发送、重复幂等、接受、忽略、取消、移除、屏蔽绕过、举报幂等和隐身泄露；真实 Supabase Staging 的 RLS、迁移和备份恢复仍未执行。

## 5. 白皮书 × 美术资源融合

运行时根目录是 `public/assets/`，权威索引是 `public/assets/manifests/asset_manifest.json`。

首批已落地：

- `P-001-MARK`：Header 与 Hero 使用的 Playroom 品牌 SVG。
- `P-001-WORDMARK`：可用于分享卡和后续商店物料的字标 SVG。
- `P-003`：平台虚拟现金 SVG，商城、排行榜、档案与结算统一显示 💵。
- `public/src/core/06-assets.js`：稳定资源路径、现金组件和加载失败 fallback。
- `G-02-COVER / G-02-BOARD-SURFACE`：五子棋响应式封面、木纹底材、Canvas 软 3D 棋子和最后落子状态。
- `G-11-COVER / G-11-WELL-SURFACE`：俄罗斯方块响应式封面、玻璃井、七类纹理及 active/ghost/locked/clear 状态。
- `art-source/`：保留四张高分辨率母图与可复现 ImageGen Prompt；`public/assets/` 只保存运行时 WebP。
- `P-BACKGROUND-V1-CATALOG`：六主题 12 款 Premium Background（每主题一静态、一动态），含 Desktop / Poster / Mobile / Mini / Animated / Static Fallback。
- `P-ICON-UI-V1`：Vendor 的 Lucide 1.27.0 平台 SVG 子集，保留 ISC/MIT 许可证，并由 `icon(name, size, label?)` 统一调用。

融合规则：

1. 每项资产必须有稳定 `asset_id`、运行时路径、状态、fallback、a11y 与许可证字段。
2. 游戏 runtime ID 只允许 `gomoku/ludo/monopoly/tank/tetris/xiangqi`。
3. 首屏只加载品牌和公共 UI；游戏棋盘/棋子按选中游戏懒加载。
4. 美术替换必须原子包含棋盘、棋子、状态、动效、音频与 fallback，不能只换一张不可交互大图。
5. 资源加载失败必须回退到现有 CSS/Canvas/DOM Emoji/WebAudio，不阻塞大厅和开局。
6. 三语言文字、规则网格、命中区域、焦点环和数值仍由代码生成，不烘焙进图片。

已完成的 P0 纵切：

1. 五子棋 Canvas：木纹氛围层、软 3D 黑白棋、最后落子、胜线、既有落子 WebAudio 与 fallback。
2. 俄罗斯方块 DOM/网格：玻璃井、七类方块纹理、active/ghost/locked/clear、既有 WebAudio 与 fallback。
3. 两款大厅封面使用 640×360 / 320×180 `srcset` 懒加载；任一封面失败时保留 Emoji。
4. `mg_art_gomoku_v1` 与 `mg_art_tetris_v1` 可独立关闭；规则、快照、AI 和联机消息不含美术状态。

下一批执行顺序：平台模式/房间/商城/成长 UI 资产，然后逐款原子覆盖飞行棋、迷你大富翁、坦克大战和象棋。

### Playroom 个性化 v2

- 头像固定为像素、动漫、风景、动物、霓虹、科技六主题，共 48 款：12 免费静态、24 付费静态、12 付费动态。
- Master 为 1024×1024；运行时提供 64/128/256 WebP，动态头像为约 1.6 秒 Animated WebP，普通列表只加载 Poster，Mini Profile / Full Profile / 商城主动试用才播放。
- 新注册只展示每主题 2 款免费头像及免费背景，不显示锁定、价格或付费商品。
- 商城按商品类型和六主题筛选，提供 Poster、试用、购买、装备；旧头像 ID 继续兼容历史账号，但不再作为新注册和新商城主目录。
- Profile 增加可选签名、国家/地区、性别标签、在线偏好和单槽 Featured Showcase；Showcase 可展示最常玩游戏、一个成就、一个收藏主题或最佳记录，不影响匹配、奖励或 Gameplay。
- Premium Background Pack 使用固定 ID `20–31`，静态 24💵、动态 32💵；商城显示六主题 Collection Progress，并支持 Avatar + Frame + Background + Name FX 整套 Try-On。Try-On 不购买、不装备，Bundle Economy 仍未引入。
- 动态背景只在 Profile 可见或商城明确预览时加载；离屏、页面隐藏、`prefers-reduced-motion`、解码/网络失败均回退静态图。Poster 预算不超过 180 KB，Animated WebP 不超过 1.5 MB。
- 旧头像 `0–55` 保持只读兼容：历史 owned 可继续装备，新注册和新商城不再展示；服务端记录匿名化 active-usage 遥测，为未来迁移提供依据。
- 公开状态由服务端结合连接与对局状态生成，隐身按离线 / 不可加入处理。
- Profile 与 Mini Profile 使用 Readability Scrim，网站 Theme 与玩家 Cosmetic 解耦；动态内容只在用户主动关注时播放。
- 平台导航、房间、Profile、商城和 Social Safety 操作使用统一 SVG 图标；游戏身份 Emoji 仍允许作为娱乐性语义，不与平台操作图标混用。

## 6. 质量与发布闸门

```bash
npm test
```

发布前必须满足：

- 构建产物与模板/源码同步。
- 六款游戏本地、人机和联机初始化与关键动作通过。
- 安全、重连、结算、商城、Seat v2、Social Graph、Supabase schema 和 fake adapter 回归通过。
- asset manifest 可解析，SVG/XML 合法，无孤儿路径，无旧货币显示。
- 1440/1024/768/390/360 视口无横向溢出；六平台主题、Premium 静态/动态预览和 normal/reduced-motion 均保留可读回退。
- 真实 Supabase Staging、JSON→Supabase 迁移、并发、备份/恢复在没有凭证时必须保持 BLOCKED，不能由 fake adapter 代替。

## 7. 路线图

### P0：当前执行

- [x] 聚焦为六款精选游戏并删除其余运行时模块、白名单和测试场景。
- [x] 建立 `public/assets/`、asset manifest、品牌 SVG、现金 SVG 与 fallback。
- [x] 💵 迁移到商城、档案、排行榜和结算 UI。
- [x] 完成五子棋和俄罗斯方块两个美术纵切，并加入 manifest/flag/fallback/QA。
- [x] 实施 Economy & Progression v1.0：权威结算、三模式隔离、有效局、防刷、独立胜场、`apply_reward_v1` 单事务落库、奖励流水与 Reward Breakdown UI。
- [x] 双模式大厅、统一 Seat / READY、公开私密、快速加入、观战、AI 托管与断线房主转移。
- [x] 六主题 48 头像、注册免费隔离、商城试用、Profile / Mini Profile 与身份字段。
- [x] Social Graph v1：好友请求全生命周期、屏蔽、举报、Presence Privacy 与大厅 Social Rail。
- [x] Premium Background Pack v1：六主题 12 款、响应式裁切、动态预算、静态回退、Collection Progress、整套 Try-On 与可见性策略。
- [x] Platform Icon System v1：32 个 Vendor SVG、统一组件、许可证、a11y 与 manifest/QA。
- [x] Featured Showcase 单槽、旧头像活跃使用遥测，以及桌面/平板/390/360 浏览器视觉证据。
- [ ] 配置并验证真实 Supabase，完成 JSON 数据迁移、备份和回滚演练。

### P1

- 六款游戏完整美术包与声音包。
- Social Communication（聊天）；必须建立在 Friend / Block / Report 稳定基础上。
- 回放、锦标赛和赛季系统（实时观战已经完成）。

### P2

- PWA、微信小程序、App 与桌面发行适配。
- 选择三款高复用游戏进行 GLB/Godot 试点，Web 继续保留 2D fallback。

## 8. 凭证与部署

- 所有 Key/token 只放环境变量，不写入仓库或前端。
- 前端推送 `main` 后由 GitHub Pages workflow 构建部署。
- Render 服务通过 `node scripts/render-deploy.js` 手动触发部署。
- 本机 Node 20 运行 WebSocket 测试需要 `--experimental-websocket`；Node 22+ 可直接运行。
