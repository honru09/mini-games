# P0-11 技术审查

- 16 个 source family（8 frames + 8 effects）× 3 modes × 4 sizes 均生成。
- 所有运行时文件为 RGBA WebP，透明背景，无 baked text。
- 运行时总字节数 533844，预算 2 MiB：PASS。
- Manifest、catalog、稳定 ID、feature flag、fallback 与回滚链由本脚本统一生成。
- 素材像素只改变 presentation；Effect 5–8 作为既有商品分类的数据扩展，复用服务端权威购买、owned 与 profile 投影，不改变协议、数据库结构、奖励、游戏规则、AI 或 Replay。
