# Tabletop Presentation M1 Stage Finish 冻结合同

1. 镜头只改变 CSS 视觉，不改变 Canvas/DOM 逻辑坐标；reduced-motion 下必须无动画和变换。
2. 排名台只消费既有 `placement`，不能计算或改写服务端奖励、胜负或玩家身份。
3. 排名必须按数字升序；列表为可访问有序列表，系统文案三语，玩家原文不得进入 i18n 替换。
4. Shared Victory Overlay 未提供 `podium` 时，所有其他五款游戏保持原有 DOM、焦点和关闭生命周期。
