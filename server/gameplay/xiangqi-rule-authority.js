'use strict';

const Rules=require('../../shared/rules/xiangqi');

class XiangqiRuleAuthority {
  constructor(options={}){
    this.protocol=Rules.PROTOCOL;this.matchId=String(options.matchId||'');this.initialMs=Math.max(1000,Number(options.initialMs)||600000);this.remaining=[this.initialMs,this.initialMs];this.turnStartedAt=Number(options.startedAt)||Date.now();
    this.state=Rules.createInitialState();this.lastSeq=[0,0];this.revision=0;this.finished=false;this.winner=-1;this.loser=-1;this.inputLog=[];
  }
  effective(player,now=Date.now()){return Math.max(0,this.remaining[player]-(player===this.state.current&&!this.finished?Math.max(0,now-this.turnStartedAt):0));}
  timeout(now=Date.now()){
    if(this.finished||this.effective(this.state.current,now)>0)return null;const loser=this.state.current;this.remaining[loser]=0;this.loser=loser;this.winner=loser^1;this.finished=true;this.revision++;return this.timeoutEvent(now);
  }
  timeoutEvent(now){return{type:'clock_timeout',payload:{...this.snapshot(now),finished:true,loser:this.loser,winner:this.winner,reason:'TIMEOUT'}};}
  acceptMove(player,payload,now=Date.now()){
    const timedOut=this.timeout(now);if(timedOut)return{ok:false,reason:'ERR_MATCH_FINISHED',timeout:timedOut};if(this.finished)return{ok:false,reason:'ERR_MATCH_FINISHED'};
    if(String(payload&&payload.matchId||'')!==this.matchId)return{ok:false,reason:'ERR_INVALID_STATE'};if(player!==this.state.current)return{ok:false,reason:'ERR_NOT_ACTIVE_PLAYER'};
    const seq=Number(payload&&payload.seq);if(!Number.isSafeInteger(seq)||seq<=this.lastSeq[player])return{ok:false,reason:seq===this.lastSeq[player]?'ERR_DUPLICATE_ACTION':'ERR_STALE_SEQ'};
    const remaining=this.effective(player,now);if(remaining<=0){const timeout=this.timeout(now);return{ok:false,reason:'ERR_MATCH_FINISHED',timeout};}
    const result=Rules.applyAction(this.state,{type:'move',from:payload.from,to:payload.to},player);if(!result.ok)return{ok:false,reason:result.reason};
    this.remaining[player]=remaining;this.lastSeq[player]=seq;this.state=result.state;this.inputLog.push({player,seq,from:payload.from.slice(),to:payload.to.slice(),at:now});if(this.inputLog.length>20000)this.inputLog.splice(0,this.inputLog.length-20000);
    this.revision++;if(this.state.terminal){this.finished=true;this.winner=this.state.winner;this.loser=this.winner^1;}else this.turnStartedAt=now;
    return{ok:true,event:{type:'xiangqi_rule_state',payload:this.snapshot(now)},result:this.finished?this.result(now):null};
  }
  advance(now=Date.now()){const timeout=this.timeout(now);return timeout?{changed:true,event:timeout,result:this.result(now)}:{changed:false};}
  snapshot(now=Date.now()){return{protocol:this.protocol,matchId:this.matchId,revision:this.revision,board:this.state.board.map(row=>row.map(piece=>piece?{...piece}:null)),current:this.state.current,moveNumber:this.state.moveNumber,lastMove:this.state.lastMove?{...this.state.lastMove,from:this.state.lastMove.from.slice(),to:this.state.lastMove.to.slice()}:null,check:this.state.check,terminal:this.finished||this.state.terminal,winner:this.winner,loser:this.loser,reason:this.state.reason||null,clock:{protocol:this.protocol,initialMs:this.initialMs,remainingMsByPlayer:[this.effective(0,now),this.effective(1,now)],activePlayer:this.state.current,turnStartedAt:this.turnStartedAt,serverNow:now,finished:this.finished||this.state.terminal,loser:this.loser,winner:this.winner},hash:Rules.hashState(this.state)};}
  result(now=Date.now()){return{type:'xiangqi_result',protocol:this.protocol,matchId:this.matchId,revision:this.revision,serverNow:now,order:[this.winner,this.loser],stats:{moves:this.state.moveNumber,hash:Rules.hashState(this.state),reason:this.state.reason||'TIMEOUT'}};}
}

module.exports={XiangqiRuleAuthority};
