# Tabletop Presentation M1 冻结合同

1. `toView` 与 `toLogical` 必须互逆；标准逻辑值不变，未知/观众输入安全回退。
2. 五子棋仅 draw/ghost/last/winLine/pointer 使用视图坐标；`applyMove/snapshot/serialize/sendMove/onProgress` 继续标准坐标。
3. 飞行棋仅 geometry/tokenPoint/DOM 使用旋转点；`tokens/cellOf/pick/serialize/deserialize/AI` 继续标准 pid/position。
4. 观众不伪造本人近端视角；玩家人数 2/3/4 都按当前 `pids[myIdx]` 计算。
5. 变换不写入协议、Replay、奖励或数据库，也不依赖未审批资源。
