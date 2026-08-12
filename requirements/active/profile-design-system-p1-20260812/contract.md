# Profile Design System P1 冻结合同

> 时间：2026-08-12（Asia/Tokyo）  
> 主需求：`UI-025 / UI-027 / UI-028 / SOC-014`  
> 状态：`COMPLETED_LOCAL_WITH_REVIEWER_LIMIT / LOCAL_ONLY`

## IN

- 本人 Profile 把身份、核心成长、下一目标、六游戏、成就、任务、社交、收藏和本人回放重排为明确优先级；核心指标与辅助指标分层，不删除既有可用能力。
- 桌面、平板、手机调整密度、按钮、文字、间距和安全区；操作至少 44px，长名称/三语文案可换行，不出现横向溢出。
- 公开 Profile 请求使用 `requestId + targetUid` 绑定；取消、换目标、断线、注销和迟到响应不能打开旧弹层。
- 公开 Profile 的好友消息、比较、关系与安全操作具备稳定操作栏；正式好友能力保持，访客和 Block 等既有权限不放宽。
- Profile 弹层入场复用 `GhostSurfaceMotion.run`，surface 固定为 `profile-dialog`、phase 固定为既有 `open`；关闭/取消/断线先 `settle` 后同步完成 aria、焦点、滚动锁与 DOM 业务状态，不让退出动画延迟可访问关闭。不创建新 Motion 模块或 GSAP Adapter。

## OUT

- 不增加或扩大公开 Profile 字段、WebSocket 消息类型、陌生人私信、关注、附件、经济、奖励、数据库、Supabase、游戏权威或未审批美术。
- 不修改 `UI-037 / ART-036 / GAME-045`，不启用 Honru Pixel v3 或其他人工门禁素材。
- 不使用 ScrollTrigger、持续循环、布局属性动画或动效延迟业务状态。
- 不提交、不推送、不部署。

## 验收 seam

- 本人页：`renderGhostProfile()` 产生的稳定 section/priority DOM 与响应式 CSS。
- 公开页：`online.requestProfile(uid)`、`begin/finish/cancelPublicProfileRequest()` 和弹层可观察结果。
- Motion：只跨现有 `GhostSurfaceMotion` Interface；reduced-motion、后台、Game Shell 与加载失败仍由深模块统一静态落位。
- 安全：玩家名字/签名只经 raw text；系统文案只经三语 key；旧字段白名单和权限检查不变。

## 外部门禁

- 浏览器初始化仍返回 `Transport closed`；最新桌面/平板/手机、第二浏览器、真机、真实网络、visible reduced-motion 与低端 FPS 均为 `NOT_EXECUTED`。
- 线上保持 `da3d05c`。
- Terra Max 独立终审在三次 180 秒等待、明确催交和一次重启审查后仍未交付可用结论；主负责人已停止空转任务并亲自完成代码/测试终审，不把独立 Reviewer 伪记为通过。
