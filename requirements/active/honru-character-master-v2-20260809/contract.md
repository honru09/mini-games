# Honru v2 资产合同

## Identity invariants

- 名称固定为 `Honru`；角色身份由“幽灵/手柄同体 + 左十字眼 + 右四圆眼”共同定义。
- v2 只允许简化轮廓、表情、线条和明暗，不改变上述三项原创识别点。

## Source and authority

- `art-source/brand/ghost-game/honru/v2/` 保存本轮生成源、透明候选、派生预览与独立 Prompt/provenance。
- 现有 `honru-mascot-master-v1.svg` 继续是当前运行时母版；v2 在取得逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE` 前仅为 source-only 候选，取得清除后可进入可逆 runtime 候选。人工与 IP/法律意见为可选咨询。
- `asset-library/catalog.json` 只登记 provenance，不建立或修改运行时 authority。

## Transparency and failure

- 内置 ImageGen 首先输出纯 `#00ff00` 色键源；使用官方 Skill helper 生成 Alpha PNG。
- Alpha 验证至少检查：RGBA、四角透明、主体覆盖合理、无大块色键残留、无明显绿色边缘。
- 色键移除失败时保留色键源与失败证据，禁止将坏 Alpha 写入素材库正样本或运行时。

## Review state

- 自动/主代理检查覆盖文件、尺寸、hash、Alpha、色键残留、来源、小尺寸派生、风格一致性与相似风险；满足 M0 North Star、fallback、feature flag 与回滚后由所有者记录 `OWNER_AUTHORIZED_ART_CLEARANCE`。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 保持 `OPTIONAL_ADVISORY_EVIDENCE`，不得伪造 PASS，也不得阻塞开发。
- v2 不修改现有 v1 IP Review 的通过/待定结论，另建候选审查记录。

## Rollback

- 删除 v2 独立目录和素材库新条目即可完整回滚；现有 v1 源与线上 SVG 不受影响。
