# Shared Change Request

Player Character P0 需要 Master 在 `server/index.js`、`public/src/online/03-websocket.js`、`public/src/ui/07-roster.js`、`package.json` 和生成产物中投影一个只读 `playerCharacter` 字段。不得新增消息类型、不得接受客户端装备 mutation、不得改变游戏规则/奖励/商城/Supabase。所有共享改动必须由专项隐私测试、安全/重连/E2E 与完整回归保护。
