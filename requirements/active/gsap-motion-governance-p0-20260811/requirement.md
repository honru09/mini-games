# GSAP Motion Governance P0 Requirement

## Outcome

Ghost Game 后续网站视觉、排版、页面转场、局内表现与视频式动效，统一经过 GreenSock 官方 GSAP skills 的设计与审核门禁，同时保持项目现有 Motion Token、无障碍、性能和生命周期边界。

## In Scope

- `gsap-core`：Tween、ease、stagger、matchMedia 与 reduced-motion。
- `gsap-timeline`：多步编排、label、position parameter 与可控播放。
- `gsap-scrolltrigger`：仅页面滚动叙事、视差、触发与 pin；不驱动沉浸式局内输入或权威状态。
- `gsap-plugins`：有明确交互价值时一次注册、按需加载；`gsap-utils` 是 core helper，不注册插件，按需调用。
- `gsap-performance`：transform/autoAlpha、批处理、离屏暂停、清理和低端设备预算。
- `gsap-react` / `gsap-frameworks`：未来发生对应框架迁移时才启用。

## Out of Scope

- 本任务不安装或引入 GSAP 运行时依赖。当前零依赖 classic-script 拼接架构中，L0/L1 简单效果继续 CSS-first；首次引入 GSAP runtime 必须单立 ADR，冻结版本/加载方式、PWA 离线缓存、失败 fallback、CSP/SRI、包体与回滚。
- 本任务不重写当前已验收 CSS 动效。
- 本任务不把 ScrollTrigger、GSDevTools 或未使用插件加入生产包。

## Completion

`AGENTS.md`、Skill Registry 和产品需求台账都能让后续 agent 稳定触发相应官方 skill，并在每个实际动效任务中留下可检查的性能、销毁、响应式与 reduced-motion 证据。
