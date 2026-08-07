'use strict';

const {TetrisRuleAuthority}=require('../server/gameplay/tetris-rule-authority');
const {XiangqiRuleAuthority}=require('../server/gameplay/xiangqi-rule-authority');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}
const t=new TetrisRuleAuthority({matchId:'chaos-t',playerCount:2,startAt:1,matchEndAt:100000,matchSeed:'chaos'});
const ordered=t.acceptAction(0,{matchId:'chaos-t',seq:1,action:{type:'left'}},1000),duplicate=t.acceptAction(0,{matchId:'chaos-t',seq:1,action:{type:'left'}},1001),stale=t.acceptAction(0,{matchId:'chaos-t',seq:0,action:{type:'right'}},1002);
check('Network Chaos：Tetris duplicate/stale/reordered action 不改变最终状态',ordered.ok&&duplicate.reason==='ERR_DUPLICATE_ACTION'&&stale.reason==='ERR_STALE_SEQ'&&t.lastSeq[0]===1);
const x=new XiangqiRuleAuthority({matchId:'chaos-x',startedAt:1,initialMs:10000}),first=x.acceptMove(0,{matchId:'chaos-x',seq:1,from:[6,0],to:[5,0]},100),delayed=x.acceptMove(0,{matchId:'chaos-x',seq:2,from:[6,2],to:[5,2]},500),second=x.acceptMove(1,{matchId:'chaos-x',seq:1,from:[3,0],to:[4,0]},600),third=x.acceptMove(0,{matchId:'chaos-x',seq:2,from:[9,1],to:[7,2]},700),duplicateX=x.acceptMove(1,{matchId:'chaos-x',seq:1,from:[3,2],to:[4,2]},701);
check('Network Chaos：象棋 delayed/not-active/duplicate move 明确拒绝',first.ok&&delayed.reason==='ERR_NOT_ACTIVE_PLAYER'&&second.ok&&third.ok&&duplicateX.reason==='ERR_DUPLICATE_ACTION');
console.log('INFO  真实 tc/netem 丢包、抖动与断网未在当前 Windows 沙箱执行，需设备/网络闸门复测');
if(failures.length){console.error('NETWORK_CHAOS_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('NETWORK_CHAOS_ALL_PASS');
