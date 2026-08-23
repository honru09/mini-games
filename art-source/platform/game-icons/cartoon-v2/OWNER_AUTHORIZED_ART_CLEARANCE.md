# P0-12 OWNER_AUTHORIZED_ART_CLEARANCE

- productionUnitId: P0-12
- familyId: P-GAME-ICON-SYSTEM-V2 / artworkVersion: 2
- status: OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED
- feature flag: mg_art_game_icon_system_v2 (default-on, exact rollback value 0)
- evidence: asset-family-manifest-v2.json, TECHNICAL_REVIEW_Reviewer_A.md, MACHINE_VISUAL_REVIEW.md, SIMILARITY_AND_IP_REVIEW.md, PROMPT_AND_PROVENANCE.md, SKILL_ROUTING.md, qa/game-icon-system-v2.js, qa/game-icon-system-runtime.js
- fallback chain: v2 WebP → existing 320/640 cover or CSS/Lucide/text → GAMES Emoji/generic gamepad; selected-object failure → existing CSS selected card

本批 runtime 为 Ghost-native deterministic vector，遵循用户确认的项目 M0 North Star。稳定 ID/SHA/provenance、机器技术/视觉/相似风险审查、透明 gutter、fallback、feature flag 和一键回滚齐全，可进入本地 default-on runtime 候选。ImageGen 板仅为 source-only 视觉锚点，不直接进入 runtime。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 是可选咨询，未伪造为已完成；设备/第二浏览器/真机/真实网络/生产 Supabase 与发布仍待外部 Gate，发布仍须用户当前明确命令。
