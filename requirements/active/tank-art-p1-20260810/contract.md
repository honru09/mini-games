# Tank Art P1 Contract

- skin slot 固定为 `tank-skin-01..04`；地图材质、基地和角色露出分别使用独立 ID，不把图像状态写进规则快照。
- 运行时若未来接入，只能通过 manifest 双闸门解析；失败必须回退现有 CSS/Canvas/DOM 表现。
- 任何候选图只允许在 `art-source/` 与 `asset-library/` provenance 存在，未完成人工清稿/Reviewer B/IP/Golden Set 不得标记 integrated。
- 暗黑主题、低动效、头像/Seat/命中/弹道 HUD 的可读性优先于装饰细节。
