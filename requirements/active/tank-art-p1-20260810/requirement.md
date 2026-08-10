# Tank Art P1 — 坦克皮肤、地图材质与基地角色化源稿

状态：`REQUIREMENT_FROZEN`

时间：2026-08-10（Asia/Tokyo）

## Goal

为坦克大战建立 Ghost Game 自有的高质量实体桌游/克制漫画视觉方向：四套可扩展坦克皮肤、可读的地图材质、基地与玩家角色露出规则，以及统一的运行时资源交付和人工/IP 审批入口。此阶段只产出 source-only 概念和合同，不把未审资源默认接入线上。

对应台账：`ART-035`；复用已完成的 `GAME-044`、`gameStageTabletopWaveA`。

## IN

- 生成最高质量图像模型的坦克/地图/基地概念源稿与 Prompt/provenance；风格保持 Ghost Game 黑白极致对比、厚墨线、纸板/实体桌面质感和适度卡通冲击，不复制商业作品角色或构图。
- 冻结四套 skin slot、地图材质 slot、基地/玩家角色露出位置、尺寸/裁切/对比度/暗黑主题可读性合同。
- 建立 source → runtime → poster → fallback → manifest 的交付清单，记录模型、Prompt、哈希、许可、人工 Reviewer A/B、IP Review 与 Golden Set 状态。
- 继续保留现有 CSS/Canvas/Emoji fallback；所有资源默认 `reference-only` 或双闸门关闭。

## OUT

- 不改 Tank Controls、服务端 Authority、规则、碰撞、弹道、奖励、Replay、AI、商城、Supabase、WebSocket 或账号数据。
- 不将概念图直接写入 `public/assets/manifests/asset_manifest.json`，不默认打开任何美术 flag，不宣称已完成人工 IP/Golden Set 审批。
- 不生成五子棋/飞行棋/大富翁或其他游戏资产；不做 Tank 3D 引擎迁移或 GLB/Godot 运行时。

## Non-negotiable

- 位图生成使用最高质量内置图像模型；每个资产保存完整 Prompt/provenance 和不可变 hash。
- 角色、轮廓、道具和构图必须原创；参考只提炼材质/墨线/实体桌游通用语言。
- 资源失败、flag 缺失、reduced-motion 或暗黑主题下必须可读并回退现有表现。
- 没有独立 Reviewer B、IP Review 和用户 Golden Set 决议前，状态最多为 draft/partial，不能写 verified/production-ready。

## Expected UX

未来接入后，玩家能一眼区分自己的坦克、对手坦克、可破坏砖墙、钢墙、基地和安全区；材质有层次但不遮挡命中、生命、弹道或方向反馈，黑夜主题不会出现黑字融入背景，低动效模式仍保留清晰状态。
