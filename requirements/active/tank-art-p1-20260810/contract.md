# Tank Art P1 Contract

- skin slot 固定为 `tank-skin-01..04`；地图材质、基地和角色露出分别使用独立 ID，不把图像状态写进规则快照。
- 运行时若未来接入，只能通过 manifest 双闸门解析；失败必须回退现有 CSS/Canvas/DOM 表现。
- 具体候选图在取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 前只允许存在于 `art-source/` 与 `asset-library/` provenance；满足 M0 North Star、稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚后可标记为可逆 runtime 候选。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 为可选咨询，不得伪造 PASS 或阻塞开发。
- 暗黑主题、低动效、头像/Seat/命中/弹道 HUD 的可读性优先于装饰细节。
