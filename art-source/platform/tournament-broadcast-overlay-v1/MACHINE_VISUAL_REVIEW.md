# Machine Visual Review

- 信息顺序：状态台标 → 赛事名/轮次 → 当前领先 → 本轮桌况。
- Ghost-native：Ink/Cream 主体，Signal Cyan 表达进行中，Tournament Gold 表达轮次/积分。
- 清晰度：不跟随鼠标移动；小屏改为单列；所有状态只做一次短入场，只有 `live` 的信号点
  执行有限 3 次 yoyo，waiting/complete/finished 保持静态状态色。
- 可访问：叠层为装饰性重复摘要，原赛事 DOM 继续承担朗读与交互；宿主复用统一 dialog，
  提供命名、焦点圈、Escape/backdrop、焦点恢复和滚动锁。
- 底图：启用态复用 P1-06 `card-tournament`，只有 load + decode 成功后显示；失败保持代码原生背景。
- Review：本地 1200×630 主板和三语 contact sheet；不代表当前完整 Runtime 浏览器矩阵。
