# Production Readiness Sprint P0

状态：`REQUIREMENT_FROZEN`

## Goal

在不破坏六款游戏、账号、奖励、商城、Direct Chat、Honru fallback 和既有线上版本的前提下，将当前四组发布证据缺口推进到可执行上限：补齐 Tetris Guideline 高级计分；建立 Supabase 真实迁移/RLS/并发/备份/回滚工具链与多实例单写者/PubSub/遥测契约；执行可用的桌面、移动模拟、弱网和长会话验收；完成 Sticker/Honru 机器技术清稿候选、逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE` 与安全可逆默认开启合同。Reviewer B、IP/法律和 Golden Set 只保留可选咨询包。

## IN

- Tetris：T-Spin、Back-to-Back、Combo、Perfect Clear 的共享 Rule Core、权威快照、攻击/计分明细、回放确定性、客户端兼容和专项 QA。
- Supabase：可重复 schema、生产迁移/状态检查、RLS/函数授权静态与真实检查、并发幂等探针、备份、恢复演练与非破坏性回滚脚本。
- 多实例：数据库租约单写者、持久事件表、实例游标、去重与可恢复事件消费契约；Direct Chat/奖励/AI/遥测不得宣称跨实例通过，直到真实数据库执行。
- 遥测：脱敏、限频、有界批次、可选 Supabase 持久快照和外部 Webhook/Sentry-compatible 出口；未配置时保持现有本地 Metrics v2。
- 终端验收：当前可用浏览器的桌面/手机/平板视口，第二浏览器（若已连接）、弱网/离线恢复、两账号聊天、30 分钟 Synthetic Session；真实硬件与未连接浏览器单独标记。
- 美术：现有 Honru/M0 源的非破坏技术清稿候选、Alpha/轮廓/小尺寸/哈希/来源审计、Reviewer A 技术结论、Reviewer B 独立签字材料、Golden Set 决策记录与默认开启审批清单。
- 跨平台：安装型 PWA 基线、离线壳层、安全更新和平台能力边界；微信小程序、原生 App、桌面商店发布需账户/证书时保留外部闸门。

## OUT

- 不伪造 Supabase 凭证、真实 SQL 执行、备份或恢复成功；当前 Render 未配置 Supabase 时只交付并本地验证工具链。
- 不把浏览器视口模拟写成 Android/iPhone/Tablet 真机，不把同内核第二标签写成第二浏览器。
- 不把 Codex、自生成图片或子 Agent 评审冒充独立人类 Reviewer B、法律意见或用户最终美术批准。
- 不在缺少微信/Apple/Google/Microsoft 开发者账户、签名证书与商店资料时声称跨平台商店已发布。
- 具体 Honru/Sticker 候选取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 前保持默认关闭；取得清除后可在 fallback、kill switch 和回滚齐全时进入可逆 default-on 候选。真实设备缺失只保留发布证据待决，人工/IP/Golden Set 咨询缺失不得阻塞开发。

## Non-negotiable

- `shared/rules/tetris.js` 是 Tetris 规则真相源；服务端 Authority 与客户端只消费其稳定字段，不分叉第二套高级计分。
- 高级字段使用 `tetris-rule-v3` capability；旧 v2 客户端不会接收未知严格字段，而是安全回退 v1 Coordination；规则/奖励/经济完全隔离。
- Supabase 管理密钥、数据库 URL、Render Key、Webhook Token 与遥测内容不写入仓库、日志或证据。
- 迁移、备份和回滚默认 dry-run/显式确认；生产回滚不得 DROP 用户数据。
- PubSub 事件只保存白名单结构化数据；聊天正文、密码、token、PIN、DeepSeek prompt 和用户原文不得进入遥测。
- 新视觉资源版本化保存，旧 v1/v2/M0/P1/P2 与程序化 fallback 不覆盖、不删除。
- 每项状态区分 `implemented`、`verified`、`not_executed` 与 `blocked_external`。

## Known Existing Behavior

- Render 当前仅配置 `DEEPSEEK_KEY`、`METRICS_ADMIN_TOKEN`，没有 `SUPABASE_URL`、`SUPABASE_KEY` 或数据库连接串。
- Tetris Rule Core 已有 7-Bag、Hold、基础消行/攻击、Garbage、权威快照和确定性 Replay，但没有 T-Spin/B2B/Combo/Perfect Clear。
- Metrics v2 已有管理员 Bearer、CSV、阈值、脱敏错误和有界内存历史；没有跨实例持久层和外部投递。
- Honru v2/九状态与 M0 Golden Set 均为 Draft/默认关闭，缺少人工清稿、独立 Reviewer B 与最终批准。
- Direct Chat 本地/自动化已通过并上线，但生产没有 Supabase，跨实例和正式双账号 UI 闭环未验收。

## Expected UX

- Tetris 结算和局内反馈能明确显示 T-Spin、B2B、Combo、Perfect Clear，不影响低端设备输入响应。
- 弱网、断线、切后台和重连后不会重复计分、重复发消息或丢失已确认状态。
- PWA 安装后保持 Ghost Game 品牌、昼夜主题、三语言和安全更新；离线时显示可理解状态而不是白屏。
- 新 Honru 清稿在 44/64/96/192px 可辨识，黑白极致对比、幽灵手柄同体、左十字/右四键眼保持原创一致。
