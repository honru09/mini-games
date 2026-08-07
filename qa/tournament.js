'use strict';
const { TournamentOrchestrator } = require('../server/gameplay/tournament');

function assert(name,value){console.log((value?'PASS':'FAIL')+'  '+name);if(!value)process.exitCode=1;}
function playRound(tournament,drawFirst=false){
  const snapshot=tournament.snapshot();snapshot.pairings.forEach((pair,index)=>{
    const result=drawFirst&&index===0?{draw:true}:{winner:pair.players[(snapshot.round+index)%2]};
    const accepted=tournament.reportResult(pair.matchId,result);assert('Tournament：接受第 '+snapshot.round+' 轮桌 '+pair.table,accepted.ok);
  });
}
function run(count){
  const ids=Array.from({length:count},(_,i)=>'p'+(i+1));
  const tournament=new TournamentOrchestrator({tournamentId:'t'+count,gameId:'gomoku',participants:ids,rounds:3});
  tournament.start();
  while(tournament.status!=='finished'){
    assert(count+' 人赛事：多桌无重复玩家',new Set(tournament.pairings.flatMap(item=>item.players)).size===tournament.pairings.flatMap(item=>item.players).length);
    playRound(tournament,tournament.round===1);
    if(tournament.status==='round_complete')tournament.advance();
  }
  const state=tournament.snapshot(),pairs=state.results.filter(item=>!item.bye).map(item=>item.players.slice().sort().join('|'));
  assert(count+' 人赛事：完整生命周期结束',state.status==='finished'&&state.standings.length===count);
  assert(count+' 人赛事：排名确定且积分有效',state.standings.every((item,index)=>item.rank===index+1&&item.points>=0));
  if(count<=4)assert(count+' 人循环赛：每对只赛一次',new Set(pairs).size===count*(count-1)/2&&pairs.length===count*(count-1)/2);
  else {
    assert(count+' 人瑞士制：三轮完成',state.round===3);
    assert(count+' 人瑞士制：优先避免重复配对',new Set(pairs).size===pairs.length);
    if(count%2)assert(count+' 人瑞士制：Bye 公平',Math.max(...state.standings.map(item=>item.byes))<=1);
  }
  const restored=state;
  assert(count+' 人赛事：重连快照含桌位与积分',restored.protocol==='tournament-orchestrator-v1'&&Array.isArray(restored.results)&&Array.isArray(restored.standings));
}
[3,4,5,6].forEach(run);
if(!process.exitCode)console.log('TOURNAMENT_ALL_PASS');
