# UI Motion Closure P1 Acceptance

当前状态：`VERIFYING / LOCAL_IMPLEMENTED`。自动化与主审完成，最新可见/设备/性能门禁尚未执行。

- [x] RECON 已读取 AGENTS、README、HIGH_RISK_FILES、PROJECT_STATUS、dirty worktree、最近提交、route 热文件、生成文件、现有测试与相关需求。
- [x] 不新增产品 Requirement ID；范围归入 `UI-028 / TECH-054`。
- [x] `transition / settle / dispose / snapshot` 深模块 Interface、同步 commit、generation、cleanup 和 rollback 已冻结。
- [x] 已识别现有 core-only GSAP 不含 CSSPlugin；DOM island 与 Gomoku generic-object island 分离。
- [ ] Terra Max Builder/Reviewer 独立结论：已按要求创建为 `gpt-5.6-terra / max`，但多次限定执行均未返回文件或可用结论；未采用不可审阅结果。
- [x] Master 完成共享热文件集成与逐轮差异审核。
- [x] 四区不同 route、相同 route、hash back/forward、快速连续导航、loader 失败合同保持最后导航获胜且不闪回。
- [x] hidden / aria-hidden / inert / nav aria-current 同步，动效不夺焦点、不阻塞输入。
- [x] normal motion 使用单条 `committed/enter/settled` timeline、transform/opacity、有限 targets 与 `<=360ms` 窗口；目标页始终可交互。
- [x] reduced-motion、document hidden、Game Shell active、import/plugin/timeline failure 全部静态 settle。
- [x] 离开/替换/dispose kill timeline、revert context、移除 listeners 与临时 inline/will-change。
- [x] GSAP DOM ESM 图、license/provenance、SW lazy cache 与 Gomoku core-only 图隔离通过专项测试。
- [x] i18n、DOM、路由/外壳、Quality Gates、完整 `npm test`（176.6 秒）和双构建稳定通过。
- [ ] 浏览器可见、第二浏览器、真机、真实网络和 visible reduced-motion：`NOT_EXECUTED`，不得宣称 visual verified。
- [x] 台账、PROJECT_STATUS、七报告、简报与三份中文日志完成同步。
- [x] 不 commit、不 push、不部署。

## Known Issues

- Codex in-app Browser transport 当前为任务运行时级 `Transport closed`；本任务无法用静态/VM 自动化替代可见浏览器证据。
- 工作树含大量前序合法修改；禁止 reset、checkout、清理或覆盖不在 ownership 的文件。

## Rollback

Motion Runtime 不可用时 `setAppRoute()` 必须执行原同步提交；可通过移除单一 bridge 调用回到 CSS-only route entrance，无数据迁移和服务器回滚。
