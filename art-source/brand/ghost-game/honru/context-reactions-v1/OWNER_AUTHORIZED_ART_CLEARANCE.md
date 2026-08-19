# OWNER_AUTHORIZED_ART_CLEARANCE — P-HONRU-CONTEXT-REACTIONS-V1

日期：2026-08-19  
状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_RUNTIME_DEFAULT_ON / NOT_RELEASED`

项目所有者已在当前任务中明确要求：沿用此前 Honru，只把人类式手改为 Q 版幽灵手，其他不改；随后继续主线并完整制作局内上下文、快捷贴纸与融合图片。本记录据此清除以下稳定范围：

- 16 个 context：`ready / your-turn / thinking / throw / hit / capture / score / combo / warning / reconnect / spectator / win / lose / draw / rematch / celebration`
- 16 个 quick visual cell，映射到既有 6 个 `match-expression-v1` quick ID
- 320px Context WebP 与 1024px Quick Atlas 本地可逆 default-on runtime

清除不等于发布。运行时只允许 Manifest 中版本化、哈希固定、项目自有派生文件；`mg_art_honru_context_reactions_v1=0` 可关闭新情境，`mg_art_honru_quick_stickers_v1=0` 可单独关闭快捷贴纸。回退链保持旧 Honru 九状态、Mascot SVG、Emoji/Unicode 与本地化文字。

该授权不扩展服务器消息字段，不把 16 个视觉 cell 当协议 ID，不把图片写入 Direct Chat 或 Match Chat，不改变频控、Block、观众延迟、幂等、规则、奖励、Replay、AI、Analytics 或数据库。外部 `EXTERNAL_REFERENCE_ONLY / blocked-license` 素材的许可与 runtime 禁止边界不变，本批没有把其像素或图层用作输入。

Reviewer B、自然人清稿、IP/法律意见与逐资产额外 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`。第二浏览器、Android/iPhone/Tablet、真实网络与线上当前构建仍为 `RELEASE_EVIDENCE_PENDING`。
