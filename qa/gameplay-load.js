'use strict';

const {TetrisRuleAuthority}=require('../server/gameplay/tetris-rule-authority');
const {XiangqiRuleAuthority}=require('../server/gameplay/xiangqi-rule-authority');
const {MonopolyRuleAuthority}=require('../server/gameplay/monopoly-rule-authority');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}
for(const count of [10,25,50]){
  const started=Date.now(),tanks=Array.from({length:count},(_,i)=>new TetrisRuleAuthority({matchId:'load-'+count+'-'+i,playerCount:2,startAt:1,matchEndAt:100000,matchSeed:'load-'+i})),xq=Array.from({length:count},(_,i)=>new XiangqiRuleAuthority({matchId:'xq-load-'+count+'-'+i,startedAt:1,initialMs:60000})),mono=Array.from({length:count},(_,i)=>new MonopolyRuleAuthority({matchId:'m-load-'+count+'-'+i,playerCount:2,matchSeed:'m-'+i}));
  for(let tick=0;tick<20;tick++){const now=1000+tick*50;tanks.forEach((authority,i)=>{authority.advance(now);if(tick===1)authority.acceptAction(0,{matchId:'load-'+count+'-'+i,seq:1,action:{type:'hard_drop'}},now);});xq.forEach((authority,i)=>{if(tick===1)authority.acceptMove(0,{matchId:'xq-load-'+count+'-'+i,seq:1,from:[6,0],to:[5,0]},now);authority.advance(now);});mono.forEach((authority,i)=>{if(tick===1)authority.acceptAction(0,{matchId:'m-load-'+count+'-'+i,seq:1,action:{type:'roll'}},now);authority.advance(now);});}
  const elapsed=Date.now()-started;check('Gameplay Load：'+count+' 个并发逻辑房间可完成合成会话',tanks.length===count&&xq.length===count&&mono.length===count&&elapsed<5000,'elapsed='+elapsed+'ms');
}
if(failures.length){console.error('GAMEPLAY_LOAD_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('GAMEPLAY_LOAD_ALL_PASS');
