# Home Engagement P1 社交收藏脉冲收口

状态：`LOCAL_ACCEPTED_AWAITING_MASTER_INTEGRATION`

时间：2026-08-10 16:27（Asia/Tokyo）

## 本轮结论

Home Engagement P1 已完成本地安全聚合纵切。首页脉冲仅对正式账号显示，温和呈现已有在线好友数、本人收藏编目进度和既有成长方向；三个动作只复用既有 Profile、Chat、Shop 入口。访客与未登录状态不读取、不展示这张私有聚合卡。

关闭偏好使用每账号固定的 `localStorage` key，value 保存当天本地日期；同一账号跨日期自动恢复，且不会每日累积新 key。storage 不可用、身份或日期异常时安全退化为继续显示，不影响首页。主负责人已将早期“每日一个新 key”方案修正为该有界存储模型，并补入跨日期回归。

## 已完成范围

- 正式账号-only：访客、未登录账号和临时账号保持隐藏。
- 已有在线好友 presence 只聚合为数量；不渲染好友姓名、UID、关系明细或私聊正文。
- 既有 `CollectionRarityCatalog` 只投影本人收藏的编目聚合；不显示 owned ID、余额、价格或购买记录。
- 既有成长方向只读展示；不创建奖励、目标、稀有度、社交关系或任何经济状态。
- Profile、Chat、Shop 均复用既有路由动作，没有新 mutation。
- 三语、双主题、键盘关闭、44px 控件和手机单列合同均由专项与共享回归覆盖。

## 未改变的边界

本轮没有 server、protocol、economy、purchase、rules、AI、Replay、Supabase 或 art 变化；没有新增数据库、WebSocket、HTTP、购买、奖励、规则、AI 学习、回放或素材状态。

## 验证证据

- 专项、首页 P0、i18n、DOM、Ghost Shell、响应式、Profile/Shop 共享回归通过。
- 首次完整链在邀请房间创建阶段发生一次性超时；随后单独 E2E 在 53.7 秒通过，后续完整 `npm test` 在 179.7 秒通过。
- 双构建确定一致：968233 characters / 982494 bytes / SHA-256 `4A861DD2F6763FE4AFA4640E7F6AEC7418A0DC9E4EAD52BD41831C0988E43C37`。

## 仍保持 partial 的范围

UI-010 与 ECO-023 已记录本次安全聚合纵切，但仍为 `partial`：真正可恢复的进行中对局尚未实现，必须另立服务端权威恢复合同、状态与验收，不得把本卡的只读提示表述成已可续局。

第二桌面浏览器、Android/iPhone/Tablet、真实网络整形和可见 reduced-motion 仍未执行；本轮未提交、未推送、未部署。
