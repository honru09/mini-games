# UI Repair P0.7 冻结合同

1. leaderboard cache miss 触发既有 `profile_get`，不伪造本地 Profile。
2. 请求期间显示命名 dialog、加载文案、取消按钮和滚动锁；三语言即时可切换。
3. 响应按 UID 绑定；成功渲染公开 Profile，null 清理加载态并显示 not-found。
4. 取消/切换后的迟到响应只可缓存安全公开资料，不得重新打开旧弹层。
5. 不改变 server profile projection、social actions、private fields 或 wire payload。
