'use strict';
const { XiangqiClockAuthority } = require('../server/gameplay/turn-protocols');
function assert(name,value){console.log((value?'PASS':'FAIL')+'  '+name);if(!value)process.exitCode=1;}
const clock=new XiangqiClockAuthority({matchId:'clock_match',initialMs:10000,startedAt:1000});
assert('Clock：初始权威状态',clock.snapshot(1000).remainingMsByPlayer[0]===10000&&clock.snapshot(1000).activePlayer===0);
const first=clock.acceptMove(0,{matchId:'clock_match',seq:1},3500);
assert('Clock：走子扣时并切换行动者',first.ok&&first.state.remainingMsByPlayer[0]===7500&&first.state.activePlayer===1);
assert('Clock：重复 move seq 被拒绝',!clock.acceptMove(0,{matchId:'clock_match',seq:1},3600).ok);
assert('Clock：非当前行动者被拒绝',!clock.acceptMove(0,{matchId:'clock_match',seq:2},3700).ok);
const reconnect=clock.snapshot(6000);
assert('Clock：重连按 Server Time 恢复',reconnect.remainingMsByPlayer[1]===7500&&reconnect.serverNow===6000);
const timeout=clock.timeout(14000);
assert('Clock：Timeout 由服务器产生',timeout&&timeout.type==='clock_timeout'&&timeout.payload.winner===0&&clock.finished);
assert('Clock：Server correction 固定非行动方时间',clock.snapshot(15000).remainingMsByPlayer[0]===7500);
if(!process.exitCode)console.log('XIANGQI_CLOCK_ALL_PASS');
