# Ghost Game 体验纵切完成定义

本合同定义“一个体验纵切可以收口”的最低证据，不允许用一段 CSS、一个文字标签、一个图标、静态截图或 VM 假状态冒充完整实现。它适用于首页、四区路由、Game Stage、社交弹层、商城和未来已批准的美术 runtime；不替代具体 Requirement 的业务规则或外部门禁。

## 十项必答门槛

每个 active task 必须在自己的 `acceptance.md` 或 `evidence/` 中逐项记录以下内容：

1. **可见结果**：玩家能在当前目标页面/舞台看到真实层级、布局或状态；如果浏览器工具不可用，写 `NOT_EXECUTED`，不得把静态合同升级成 visual verified。
2. **真实输入**：鼠标、键盘、触控或联机消息至少有一条真实可操作路径；输入必须经过现有业务/Authority seam，表现层不能伪造结果。
3. **状态与错误**：初始、进行中、成功、失败、取消、超时、断线、重开、切账号或观战（适用时）均有可理解反馈，并有安全 fallback。
4. **三语与原文边界**：zh-CN / en-US / uk-UA key 同构；系统文案可切换，玩家昵称、消息、房名等原文不得被机器翻译。
5. **可访问性**：语义元素、命名、焦点、Tab/Escape、`aria-live`、44px 触控目标和滚动/安全区符合该纵切的使用方式。
6. **Reduced Motion**：`prefers-reduced-motion`、页面隐藏和离开页面都能立即得到静态但等价的反馈；不依赖持续 rAF 或不可清理的动画。
7. **性能与响应式**：记录桌面、平板、窄屏或目标设备的布局/帧耗预算；动画优先 transform/opacity，资源有 lazy/fallback/释放路径。
8. **清理与生命周期**：关闭、销毁、重连、注销、换号、重开和迟到异步结果不会留下监听器、timer、焦点陷阱、旧 DOM 或旧请求。
9. **回滚与兼容**：有精确 flag、adapter 或 fallback；关闭新表现不会删除旧规则、协议、数据、经济或可操作路径。
10. **权威与安全边界**：明确 Rule/Authority/Protocol/Reward/Replay/数据库、原创美术所有者清除与外部受限素材哪些不在本批；客户端不得写权威字段、泄露私密数据、绕过 `OWNER_AUTHORIZED_ART_CLEARANCE` 或启用 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材。

## 证据等级

- `CONTRACT`: 结构、边界或静态检查通过；不能证明玩家可见。
- `IMPLEMENTED_LOCAL`: 本地代码和自动化已覆盖合同；外部设备发布证据或可选人工风险咨询仍可能未完成。
- `VISUAL_VERIFIED`: 当前构建在真实浏览器/设备完成可见复核，并保留截图或原始记录。
- `PRODUCTION_READY`: 还需真实数据、发布、回滚和对应运营 Gate；不能由本地测试单独授予。原创 Ghost-native 资产可由所有者清除进入发布候选，但发布仍需当前用户明确命令。

任务必须把每项证据写成真实等级；缺任一项时保持 `partial`/`implemented`/`NOT_EXECUTED`，不能写 `verified`。

## 与动效和美术的关系

网页或舞台动效必须先遵守 GSAP 官方 skill 路由，并经 `gsap-performance` 复核；动效从语义事件产生，不能进入规则层。原创 Ghost-native 图片在 M0 North Star、稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与一键回滚可复核后，可获得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并进入可逆 default-on runtime 候选；人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE`，缺失不得阻塞开发或 runtime，也不得伪造成 PASS。`blocked-license / EXTERNAL_REFERENCE_ONLY` 素材可按用户授权的受控全信息 reference lane 提供给任务相关 Skill，逐输入记录 URL/path/hash/provider/model/taskId/transmissionScope；源素材不得直接进入 runtime，外部影响候选须记录来源元数据并完成相似风险审查。

## 交付记录

每批完成时同时更新 active task、原子台账、PROJECT_STATUS、七份进度报告、中文增/改/删日志和一份 `主题名-YYYYMMDDHHmm.md` 简报。第二浏览器、真机、真实网络或生产 Supabase 未执行时，必须原样记录 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`，但不得级联为无关开发停工；可选人工/IP/Golden Set 咨询未执行时记录 `NOT_EXECUTED / OPTIONAL_ADVISORY_EVIDENCE`，不得写成 `BLOCKED` 或伪造 PASS。
