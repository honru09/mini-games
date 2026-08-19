# Ghost-native Q UI v1 — machine technical review

结论：`TECHNICAL_PASS_WITH_SOURCE_BOARD_BOUNDARY`

## 已通过

- 12 张源板均为项目内新生成文件，SHA-256、尺寸、字节数已固定。
- 11 张为 RGB Paper source board，1 张为带全画布 Alpha 的 RGBA source board；尺寸为 1672×941 或 1536×1024。所有源板均不冒充透明运行时切片。
- 内容无外部 PSD/AI/PNG 输入记录；只使用项目自有 M0 North Star 作为语义和质感裁决。
- 组件覆盖了外部素材登记中要求的 UI、商城、状态、房间、反馈、HUD 和恢复语义范围。
- 新增的游戏入口/roster、商城外观、Ghost/Honru-adjacent 装饰、六款游戏棋子/代币、社交反应效果和 Game Stage 背景表面补齐游戏入口、装备状态、非文字情绪、跨游戏 piece 与沉浸背景的参考覆盖；没有引入可识别第三方角色或品牌元素。
- 十二个 feature flag 均规划为 default-off；旧 DOM/CSS/SVG/Canvas/Unicode 继续是权威 fallback。
- 回滚为删除 family manifest、关闭十二个 flag，不改规则、Authority、协议、经济、账号、数据或社交正文。

## 未通过或不在本批范围

- `ghost-native-core-interaction-transparent-v2.png` 与 `ghost-native-commerce-progression-transparent-v2.png` 实际为 RGB，伪透明失败，已排除。
- 源板不是单独的透明 PNG/SVG 运行时切片；不得直接接入公开 Manifest 或线上 `public/assets`。
- 首批三张新增源板已核验为 PNG color type 2（8-bit RGB、无 Alpha）；第二批两张为 color type 2 RGB，棋子/代币板为 color type 6 RGBA 且 Alpha 覆盖全画布，仍只可作为源板。Honru-adjacent 源板仅作抽象装饰母板，不能当作现有 Honru 角色状态或第三方角色资产。
- 未执行第二浏览器、真机、真实网络、线上发布或生产 Supabase 验收。
- 未把人工清稿、Reviewer B、IP/法律意见或逐资产 Golden Set 伪造成完成。

## 运行时边界

本批只授予原创源板的 `OWNER_AUTHORIZED_ART_CLEARANCE`，含义是可进入后续可逆 runtime 候选；不表示已经 default-on、已部署或已经完成第三方法律授权。实际接入必须另行生成透明派生、更新 Manifest、执行 fallback/flag/rollback QA，并保留当前 DOM/CSS/Canvas/Unicode fallback。
