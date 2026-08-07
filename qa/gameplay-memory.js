'use strict';

const {TetrisRuleAuthority}=require('../server/gameplay/tetris-rule-authority');
const {XiangqiRuleAuthority}=require('../server/gameplay/xiangqi-rule-authority');
const {MonopolyRuleAuthority}=require('../server/gameplay/monopoly-rule-authority');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}
if(typeof global.gc==='function')global.gc();const before=process.memoryUsage().heapUsed;
for(let i=0;i<1000;i++){
  const t=new TetrisRuleAuthority({matchId:'mem-t-'+i,playerCount:2,startAt:1,matchEndAt:100000,matchSeed:'mem-'+i});t.acceptAction(0,{matchId:'mem-t-'+i,seq:1,action:{type:'hard_drop'}},1000);t.advance(1100);
  const x=new XiangqiRuleAuthority({matchId:'mem-x-'+i,startedAt:1,initialMs:60000});x.acceptMove(0,{matchId:'mem-x-'+i,seq:1,from:[6,0],to:[5,0]},1000);x.advance(1100);
  const m=new MonopolyRuleAuthority({matchId:'mem-m-'+i,playerCount:2,matchSeed:'mem-'+i});m.acceptAction(0,{matchId:'mem-m-'+i,seq:1,action:{type:'roll'}},1000);m.advance(1100);
}
if(typeof global.gc==='function')global.gc();const after=process.memoryUsage().heapUsed,delta=after-before;
check('Gameplay Memory：1000 次创建/结束逻辑会话后 Heap 增长受控',delta<64*1024*1024,'delta='+delta);
if(typeof global.gc!=='function')console.log('INFO  未使用 --expose-gc，结果为近似值');
if(failures.length){console.error('GAMEPLAY_MEMORY_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('GAMEPLAY_MEMORY_ALL_PASS');
