# T7 P13 — 正式 Session Token TTL Sweep

## 范围

把正式账号的过期 session token 清扫接入既有 `Auth/Profile` boundary 与
`ServerClockTimer` owner lease。清扫只处理服务端持久 token 记录，不改变登录协议、密码哈希、访客策略、奖励、好友或房间规则。

## 复用需求

- `TECH-039`：架构决策与可回滚边界。
- `TECH-040`：Code Health / lifecycle timer 健康扫描。
- `TECH-052`：唯一主线、批次证据与未发布边界。

## 不在本批

真实 Supabase 并发/RLS/备份恢复、多实例生产验收、第二浏览器、真机、真实网络整形与线上部署。
