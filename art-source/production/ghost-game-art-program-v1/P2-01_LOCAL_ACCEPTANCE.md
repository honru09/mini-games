# P2-01 本地收口

- 单元：`P2-01 / P-SEASONAL-BACKGROUNDS-V1`
- 状态：`IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`
- 资产：4 个原创 ImageGen PNG 源母板、20 个 WebP Runtime 变体、1 张四季 review board、2,022,638 runtime bytes。
- 目录：8 个 Premium Background 条目（32–39），四季各静态/动态一项。
- 消费者：现有 Shop 背景目录、购买/装备、Profile Hero、Shop Preview、reduced-motion 静态回退。
- 商业边界：只扩展现有装饰性商品目录；服务端价格仍权威，访客/余额/owned/requestId 规则不变。
- 产品边界：没有实现 Season clock、Battle Pass、LiveOps Remote Config、赛季奖励、社交排行或新协议；`ECO-021/ECO-022/SOC-024` 仍为 planned。
- Feature flag：`mg_art_seasonal_backgrounds_v1`，default-on；精确 `0` 回退原 Premium Background/CSS surface。
- Skill：`imagegen`、`gpt-image`、`image` 实际应用；其余六个九入口状态已登记；外部 blocked-license 输入/传输/runtime 为 0。
- 当前浏览器可见证据：`NOT_EXECUTED`；review board 和机器视觉审查不能替代运行时浏览器。
- 第二浏览器、物理真机、真实网络、低端性能与发布：`NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。

