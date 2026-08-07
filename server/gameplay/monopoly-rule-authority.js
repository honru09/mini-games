'use strict';

const Rules=require('../../shared/rules/monopoly');

class MonopolyRuleAuthority {
  constructor(options={}){
    this.protocol=Rules.PROTOCOL;this.matchId=String(options.matchId||'');this.playerCount=Math.max(2,Math.min(5,Number(options.playerCount)||2));this.matchSeed=String(options.matchSeed||this.matchId);this.auctionDurationMs=Math.max(1000,Number(options.auctionDurationMs)||5000);
    this.state=Rules.createInitialState({seed:this.matchSeed,playerCount:this.playerCount});this.lastSeq=Array(this.playerCount).fill(0);this.revision=0;this.finished=false;this.order=null;this.auctionEndAt=0;this.inputLog=[];
  }
  acceptAction(player,payload,now=Date.now()){
    if(this.finished)return{ok:false,reason:'ERR_MATCH_FINISHED'};if(String(payload&&payload.matchId||'')!==this.matchId)return{ok:false,reason:'ERR_INVALID_STATE'};
    if(!Number.isInteger(player)||player<0||player>=this.playerCount)return{ok:false,reason:'ERR_INVALID_STATE'};
    const seq=Number(payload&&payload.seq);if(!Number.isSafeInteger(seq)||seq<=this.lastSeq[player])return{ok:false,reason:seq===this.lastSeq[player]?'ERR_DUPLICATE_ACTION':'ERR_STALE_SEQ'};const action=payload&&payload.action;
    if(action&&action.type==='close_auction'&&this.state.phase==='auction'&&this.auctionEndAt&&now<this.auctionEndAt)return{ok:false,reason:'ERR_DEADLINE'};
    const result=Rules.applyAction(this.state,action,player);if(!result.ok)return{ok:false,reason:result.reason};this.lastSeq[player]=seq;this.state=result.state;this.revision++;this.inputLog.push({player,seq,action:{...action},at:now});if(this.inputLog.length>20000)this.inputLog.splice(0,this.inputLog.length-20000);
    if(action.type==='pass'&&this.state.auction)this.auctionEndAt=now+this.auctionDurationMs;else if(action.type==='close_auction')this.auctionEndAt=0;if(this.state.terminal){this.finished=true;this.order=this.state.placements.slice();}
    return{ok:true,event:{type:'monopoly_rule_state',payload:this.snapshot(now),transition:result.event},result:this.finished?this.result(now):null};
  }
  advance(now=Date.now()){
    if(this.finished)return{changed:false,result:this.result(now)};if(this.state.phase==='auction'&&this.auctionEndAt&&now>=this.auctionEndAt){const result=Rules.applyAction(this.state,{type:'close_auction'},this.state.current);if(result.ok){this.state=result.state;this.revision++;this.auctionEndAt=0;if(this.state.terminal){this.finished=true;this.order=this.state.placements.slice();}return{changed:true,event:{type:'monopoly_rule_state',payload:this.snapshot(now),transition:result.event},result:this.finished?this.result(now):null};}}
    return{changed:false};
  }
  snapshot(now=Date.now()){return{protocol:this.protocol,matchId:this.matchId,revision:this.revision,serverNow:now,phase:this.state.phase,current:this.state.current,round:this.state.round,terminal:this.state.terminal||this.finished,winner:this.state.winner,order:this.state.placements.slice(),state:JSON.parse(Rules.serialize(this.state)),stateHash:Rules.hashState(this.state),auctionEndAt:this.auctionEndAt};}
  result(now=Date.now()){return{type:'monopoly_result',protocol:this.protocol,matchId:this.matchId,revision:this.revision,serverNow:now,order:(this.order||this.state.placements||Rules.placement(this.state)).slice(),stats:this.state.players.map((player,id)=>({player,money:player.money,netWorth:Rules.netWorth(this.state,id),properties:player.props.length,placement:(this.order||this.state.placements).indexOf(id)+1}))};}
}

module.exports={MonopolyRuleAuthority};
