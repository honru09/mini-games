# P0-10 本地验收 — Player Character 七槽基础分层包

状态：IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING

- 资产族：P-PLAYER-CHARACTER-LAYERED-V1
- 2.5D：透明七槽 layer + 六姿态 pose；无 GLB、骨骼和 Three 依赖。
- 覆盖：body 4、face 6、hair 8、top 10、bottom 6、footwear 6、accessory 12；six poses；idle/walk/celebrate 三 compact actions。
- 技术合同：asset-family-manifest-v1.json、Runtime Manifest、Catalog、feature flag mg_art_player_character_layered_v1、fallback/rollback、Alpha/SHA/尺寸/预算记录。
- 运行时：Profile identity hero 与 Monopoly player marker 只消费公开 player-character-v1；规则、位置、奖励、经济、Replay、协议保持不变。
- 失败回退：七层全部成功后才切换；单层失败先显示同族通用 default composite（不承诺当前七槽装扮身份保真），其后才回到既有程序化 token/Avatar。
- 外部：完整 external inventory context 已登记；本批没有向任何 Skill 传输 blocked-license 文件、预览、像素、图层或向量对象。
- 机器证据：专项 QA、资产审计、构建、完整 npm test 需要在本批源码落盘后运行；未执行项保持真实记录。
- 可见证据：当前构建尚无新的浏览器/真机矩阵，保持 NOT_EXECUTED / RELEASE_EVIDENCE_PENDING。
