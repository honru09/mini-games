# P0-11 本地验收 — Avatar Frame 与 Effect 真实素材化

状态：IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING

- 资产族：P-AVATAR-FRAME-EFFECT-V1。
- 覆盖：8 个 Avatar Frame、8 个 Avatar Effect；44/64/96/192 四档；static/dynamic/high-contrast 三种模式；reduced-motion 自动选 static，forced-colors 自动选 high-contrast。
- 运行时：Profile、Shop、Player Seat、DM、Playline 只在构造可见统一身份节点时按 Manifest allowlist eager 请求透明 WebP，避免 `display:none + lazy` 不触发；加载/解码失败保留既有 CSS frame/effect 与 Avatar/initial fallback。
- 技术合同：稳定 ID、版本、SHA、尺寸、Alpha、字节预算、Skill Routing、provenance、feature flag 与回滚链已落盘。
- 动效边界：素材像素只作为 presentation atom；Effect 5–8 是既有商品分类的数据扩展，复用服务端权威价格、购买/owned/requestId 与 profile 投影，不改变协议、数据库结构、Reward、游戏规则、AI 或 Replay。动态态由现有 CSS/GSAP presentation 适配器有限驱动，页面离开/减少动态时可静态收口。
- 外部：未向任何 Skill 传输 blocked-license 外部素材；本批为项目自有确定性 SVG/Sharp 派生。
- 机器证据：静态资产合同、异步 runtime VM 合同与跨进程生成独占锁合同均通过（192 variants、533844 bytes、2 MiB 预算内）；44/64 实际合成检查板同时覆盖亮/暗底，Frame 装饰保持头像保护区，Effect 3/8 层级与可见性已复核。
- 可见证据：当前构建尚无新的真实浏览器、第二浏览器或真机矩阵，保持 NOT_EXECUTED / RELEASE_EVIDENCE_PENDING。
