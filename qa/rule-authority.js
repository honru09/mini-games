'use strict';

const {TetrisRuleAuthority}=require('../server/gameplay/tetris-rule-authority');
const {XiangqiRuleAuthority}=require('../server/gameplay/xiangqi-rule-authority');
const {MonopolyRuleAuthority}=require('../server/gameplay/monopoly-rule-authority');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

const t=new TetrisRuleAuthority({matchId:'t-rule',playerCount:2,startAt:1,matchEndAt:100000,matchSeed:'t-rule'});
const t1=t.acceptAction(0,{matchId:'t-rule',seq:1,action:{type:'hard_drop'}},1000),tdup=t.acceptAction(0,{matchId:'t-rule',seq:1,action:{type:'hard_drop'}},1001);
check('Tetris Rule Authority：Action→Server State Hash',t1.ok&&t1.stateEvent.payload.players[0].hash&&tdup.reason==='ERR_DUPLICATE_ACTION');
const tState=t.snapshot(1000);check('Tetris Rule Authority：Reconnect Snapshot 含所有 Rule Core 状态',tState.protocol==='tetris-rule-v3'&&tState.players.length===2&&tState.players[0].state.board.length===18);

const x=new XiangqiRuleAuthority({matchId:'x-rule',startedAt:1000,initialMs:10000});
const beforeIllegal=x.snapshot(1100).clock.remainingMsByPlayer[0];
const xIllegal=x.acceptMove(0,{matchId:'x-rule',seq:1,from:[6,0],to:[4,0]},1100);
const afterIllegal=x.snapshot(1100).clock.remainingMsByPlayer[0];
check('Xiangqi Rule Authority：非法棋步不会提交棋钟或动作序号',!xIllegal.ok&&beforeIllegal===afterIllegal&&x.lastSeq[0]===0);
const x1=x.acceptMove(0,{matchId:'x-rule',seq:1,from:[6,0],to:[5,0]},1200),xBad=x.acceptMove(0,{matchId:'x-rule',seq:1,from:[6,2],to:[8,2]},1201);
check('Xiangqi Rule Authority：服务端验证兵移动后才推进棋钟',x1.ok&&x1.event.payload.clock.activePlayer===1&&x1.event.payload.clock.remainingMsByPlayer[0]===9800&&xBad.reason==='ERR_NOT_ACTIVE_PLAYER');
check('Xiangqi Rule Authority：Reconnect Snapshot 含棋盘与 Clock Hash',x.snapshot(1300).board.length===10&&x.snapshot(1300).hash);

const m=new MonopolyRuleAuthority({matchId:'m-rule',playerCount:3,matchSeed:'m-rule',auctionDurationMs:1000});
const m1=m.acceptAction(0,{matchId:'m-rule',seq:1,action:{type:'roll'}},1000);check('Monopoly Rule Authority：Server RNG Roll 产生 Rule State',m1.ok&&m1.event.payload.stateHash);
if(m1.event&&m1.event.payload&&m1.event.payload.state&&m1.event.payload.state.phase==='buy'){
  const mp=m.acceptAction(0,{matchId:'m-rule',seq:2,action:{type:'pass'}},1001);check('Monopoly Rule Authority：Auction State 进入可恢复快照',mp.ok&&mp.event.payload.state.phase==='auction');
  const early=m.acceptAction(0,{matchId:'m-rule',seq:3,action:{type:'close_auction'}},1002);check('Monopoly Rule Authority：截止前不能提前关拍',early.reason==='ERR_DEADLINE');
}
check('Monopoly Rule Authority：Snapshot 与 Match ID 绑定',m.snapshot().matchId==='m-rule'&&m.snapshot().protocol==='monopoly-rule-v2');

if(failures.length){console.error('RULE_AUTHORITY_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('RULE_AUTHORITY_ALL_PASS');
