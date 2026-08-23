# P2-05 / G-SPECTATOR-CAMERA-ADVANCED-V1

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / IMPLEMENTED_LOCAL / RELEASE_EVIDENCE_PENDING`

这是一个代码原生的 2.5D 表现单元，不新增位图。`CameraSystem25D` 提供
`overview / focus / impact / result` 既有语义预设，并新增可逆的
`player / spectator-neutral` 构图枚举。进入观众席时 Game Stage 只在角色变化
时调用一次中立 overview，避免将观众席、当前席位或任何玩家身份作为视觉焦点；
退出观战恢复 player composition。

## 边界

- IN：DOM/CSS/Canvas + GSAP 的镜头构图、reduced-motion、document hidden、销毁清理、
  六款现有 Game Stage 的观众席表现。
- OUT：Rule、Authority、Protocol、Reward、Replay 数据、AI、Chat、Supabase、权限、
  延迟缓存和任何强制 3D/Three.js runtime。
- 回滚：删除 `spectator-neutral` composition 或将 `mg_visual_25d_v1` 设为 `0`，
  立即回到既有静态/玩家构图，不改变对局状态。

## 证据等级

机器合同与本地回归已完成；第二浏览器、物理 Android/iPhone/Tablet、真实网络、
低端性能与线上构建仍为 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。
