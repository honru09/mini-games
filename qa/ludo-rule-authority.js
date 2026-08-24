'use strict';
const {LudoRuleAuthority}=require('../server/gameplay/ludo-rule-authority');const failures=[];const check=(n,v)=>{console.log((v?'PASS':'FAIL')+'  '+n);if(!v)failures.push(n);};
const a=new LudoRuleAuthority({matchId:'ludo-test',playerCount:2,matchSeed:'seed'});const initial=a.snapshot();
const wrong=a.acceptAction(1,{matchId:'ludo-test',seq:1,action:{type:'roll'}},1);check('非当前玩家不能掷骰',!wrong.ok&&wrong.reason==='ERR_NOT_ACTIVE_PLAYER'&&a.revision===0);
const roll=a.acceptAction(0,{matchId:'ludo-test',seq:1,action:{type:'roll'}},2);check('服务端生成骰面并返回权威状态',roll.ok&&roll.event.payload.protocol==='ludo-rule-v1'&&Number.isInteger(roll.event.payload.dice));
const duplicate=a.acceptAction(0,{matchId:'ludo-test',seq:1,action:{type:'roll'}},3);check('重复 seq 拒绝',!duplicate.ok&&duplicate.reason==='ERR_DUPLICATE_ACTION');
if(roll.ok&&roll.event.payload.phase==='pick'){
  const token=roll.event.payload.tokens[0].findIndex(v=>v===-1);const move=a.acceptAction(0,{matchId:'ludo-test',seq:2,action:{type:'move',token}},4);check('合法棋子移动由服务端接收',move.ok&&move.event.payload.revision===2);
}
check('重连快照含 seq/hash',a.snapshot().lastSeq[0]===(roll.event.payload.phase==='pick'?2:1)&&a.snapshot().hash);
if(failures.length)process.exitCode=1;else console.log('LUDO_RULE_AUTHORITY_ALL_PASS');
