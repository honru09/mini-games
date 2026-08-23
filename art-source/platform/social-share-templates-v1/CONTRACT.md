# P2-09 / P-SOCIAL-SHARE-TEMPLATES-V1

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / IMPLEMENTED_LOCAL / RELEASE_EVIDENCE_PENDING`

本单元把 P1-06 已清除的 `card-playline / card-result / card-record` 装饰底图组合为
Ghost Game 的完整 1200×630 社交分享模板。模板只消费 Playline 已经由服务端权威投影、
客户端完成三语本地化并限长的展示字符串；原动态 DOM 继续负责无障碍朗读，卡面本身
`aria-hidden=true`，不会重复播报。

## IN / OUT

- IN：`game_share / result_share / record_share` 三类模板、六款游戏名、胜/负/平/名次、
  `level / total_wins / game_wins / mastery` 四类权威纪录、三语、320px 起可读布局、
  forced-colors、reduced-motion、图片 decode 失败回退、迟到异步销毁与 feature flag。
- OUT：新增分享协议、外部平台发布、截图上传、签名、权限、可见性、UID、token、
  Reward、Replay、Analytics、持久数据或 Supabase。
- Authority：`SOC-033 / GAME-030` 的事实仍来自现有服务端快照和协议；本模块只表现，
  不推导比赛或玩家事实。

## 回滚

将 `mg_art_social_share_templates_v1=0` 后，Playline 回到 P1-06 单张装饰底图；模块缺失、
抛错或拒绝挂载时也走相同旧 `<img>` fallback。底图 URL 解析、加载或 decode 失败时保留
代码原生 Ghost signal 背景，不影响原动态正文、按钮与权限。

