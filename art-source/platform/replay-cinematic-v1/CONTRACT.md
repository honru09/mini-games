# P2-06 / P-REPLAY-CINEMATIC-V1

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / IMPLEMENTED_LOCAL / RELEASE_EVIDENCE_PENDING`

本单元把现有 Replay 播放器升级为 2.5D 三层演出：overview、逐事件 focus、seek、pause
和 result。Replay 事件、顺序、玩家、最终结果和分享权限仍完全来自现有服务端数据；表现
桥不解析或改写规则事实。

## 边界与回滚

- IN：background/midground/foreground 三层代码原生光场、有限 CameraSystem Timeline、
  range seek、速度、暂停、结束、reduced-motion、forced-colors、销毁与 Dialog a11y。
- OUT：Replay wire/schema/TTL/visibility/share token、Rule、Authority、Reward、AI、Chat、
  Analytics、Supabase 和完整确定性规则回放补齐。
- 回滚：移除 `ReplayCinematic25D` 调用后，原 range + 顺序 onMove 播放继续成立；
  CSS/模块失败不阻塞 Replay 数据读取。
