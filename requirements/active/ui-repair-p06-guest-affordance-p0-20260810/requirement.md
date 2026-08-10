# UI Repair P0.6：访客持久化动作提示

访客可继续浏览商城、玩家资料和公开社交信息，但永久购买、好友关系、Block/Report 与主动邀请不得形成“点了才由服务器报错”的死路。客户端必须显示只读/不可持久化状态，直接调用也不得发送 mutation；服务端 `requirePersistentUser()` 仍是最终权限边界。

不包含服务端协议、价格、Supabase、规则、奖励、AI、Replay、美术准入或发布。
