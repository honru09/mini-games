# Home Active Match Return P0 合同

1. `homeActiveMatchState()` 是唯一显示判定，失败即隐藏。
2. 返回按钮每次点击重新校验 matchId；迟到旧 click 必须 no-op。
3. 合法动作只有 `showGame(latest.game)`，依赖其现有同实例 fast path。
4. `showHub()` 在当前路由为 Home 时重渲染首页，使 result、leave、expired、reset 后旧卡立即消失。
5. 三语、44px、手机单列、无新增动画；文案只表达“返回当前对局”。
6. 服务端、WebSocket 协议、规则、奖励、Replay、AI、Supabase、assets/art 均为 OUT。
