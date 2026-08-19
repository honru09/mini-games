'use strict';

const Rules=require('../../shared/rules/tetris');

class TetrisRuleAuthority {
  constructor(options={}){
    this.protocol=Rules.PROTOCOL;this.matchId=String(options.matchId||'');this.playerCount=Math.max(2,Math.min(5,Number(options.playerCount)||2));
    this.startAt=Number(options.startAt)||Date.now()+3000;this.matchEndAt=Number(options.matchEndAt)||this.startAt+300000;this.matchSeed=String(options.matchSeed||this.matchId);
    this.states=Array.from({length:this.playerCount},(_,player)=>Rules.createInitialState({seed:this.matchSeed,player}));
    this.lastSeq=Array(this.playerCount).fill(0);this.nextFallAt=Array(this.playerCount).fill(this.startAt+700);this.incoming=Array.from({length:this.playerCount},()=>[]);
    this.revision=0;this.finished=false;this.order=null;this.koTime=Array(this.playerCount).fill(null);this.placements=Array(this.playerCount).fill(0);this.inputLog=[];this.attackSequence=0;
  }
  alive(player){return!!(this.states[player]&&!this.states[player].terminal);}
  targetFor(source){for(let step=1;step<this.playerCount;step++){const target=(source+step)%this.playerCount;if(this.alive(target))return target;}return-1;}
  cancelIncoming(player,amount,now){let remaining=amount,cancelled=0;for(const item of this.incoming[player]){if(item.delivered||item.applyAt<=now||remaining<=0)continue;const used=Math.min(remaining,item.amount);item.amount-=used;remaining-=used;cancelled+=used;}this.incoming[player]=this.incoming[player].filter(item=>item.amount>0);return{remaining,cancelled};}
  attackFrom(player,amount,now){const cancellation=this.cancelIncoming(player,amount,now);let target=-1,attack=null;if(cancellation.remaining>0){target=this.targetFor(player);if(target>=0){attack={attackId:'attack-'+player+'-'+(++this.attackSequence),source:player,target,amount:cancellation.remaining,applyAt:now+Rules.TETRIS_ATTACK_CONFIG.garbageDelayMs,delivered:false};this.incoming[target].push(attack);}}return{target,cancelled:cancellation.cancelled,attack};}
  markTerminal(player,now,reason){if(this.koTime[player]!==null)return;this.koTime[player]=now;const alive=this.states.map((_,id)=>id).filter(id=>this.alive(id));this.placements[player]=alive.length+1;if(alive.length<=1){if(alive[0]!==undefined)this.placements[alive[0]]=1;this.finish();}return{player,koTime:now,placement:this.placements[player],reason:reason||this.states[player].reason};}
  record(player,seq,action,now,source){this.inputLog.push({player,seq,action:{...action},at:now,source:source||'client'});if(this.inputLog.length>20000)this.inputLog.splice(0,this.inputLog.length-20000);}
  applyRuleAction(player,action,now,seq,source){
    const result=Rules.applyAction(this.states[player],action);if(!result.ok)return result;this.states[player]=result.state;this.record(player,seq,action,now,source);let battle=null,ko=null;
    if(result.event&&result.event.type==='lock'&&result.event.attack>0)battle=this.attackFrom(player,result.event.attack,now);
    if(result.state.terminal)ko=this.markTerminal(player,now,result.state.reason);this.revision++;
    return{ok:true,event:result.event,battle,ko,stateEvent:this.stateEvent(now),result:this.finished?this.result(now):null};
  }
  acceptAction(player,payload,now=Date.now()){
    if(this.finished)return{ok:false,reason:'ERR_MATCH_FINISHED'};if(now<this.startAt)return{ok:false,reason:'ERR_INVALID_STATE'};
    if(String(payload&&payload.matchId||'')!==this.matchId)return{ok:false,reason:'ERR_INVALID_STATE'};if(!this.alive(player))return{ok:false,reason:'ERR_MATCH_FINISHED'};
    const seq=Number(payload&&payload.seq);if(!Number.isSafeInteger(seq)||seq<=this.lastSeq[player])return{ok:false,reason:seq===this.lastSeq[player]?'ERR_DUPLICATE_ACTION':'ERR_STALE_SEQ'};
    const action=payload&&payload.action,allowed=['left','right','rotate_cw','rotate_ccw','soft_drop','hard_drop','hold'];if(!action||!allowed.includes(action.type))return{ok:false,reason:'ERR_INVALID_MOVE'};
    const result=this.applyRuleAction(player,action,now,seq,'client');
    if(result.ok){
      this.lastSeq[player]=seq;
      result.stateEvent=this.stateEvent(now);
      if(this.finished)result.result=this.result(now);
    }
    return result;
  }
  advance(now=Date.now()){
    if(this.finished)return{changed:false,result:this.result(now)};let changed=false;
    for(let player=0;player<this.playerCount;player++){
      if(!this.alive(player))continue;let steps=0;
      while(now>=this.nextFallAt[player]&&steps++<5&&this.alive(player)){
        const interval=Math.max(160,700-Math.floor(this.states[player].lines/10)*45);this.nextFallAt[player]+=interval;
        const applied=this.applyRuleAction(player,{type:'tick'},this.nextFallAt[player],0,'server');if(applied.ok)changed=true;else break;
      }
    }
    for(let target=0;target<this.playerCount;target++)for(const item of this.incoming[target])if(!item.delivered&&item.applyAt<=now&&this.alive(target)){
      item.delivered=true;const applied=this.applyRuleAction(target,{type:'garbage',lines:item.amount,attackId:item.attackId},now,0,'server');if(applied.ok)changed=true;
    }
    for(let player=0;player<this.playerCount;player++)this.incoming[player]=this.incoming[player].filter(item=>!item.delivered);
    if(!this.finished&&now>=this.matchEndAt){this.finishByTime();changed=true;}
    return{changed,stateEvent:changed?this.stateEvent(now):null,result:this.finished?this.result(now):null};
  }
  boardHeight(state){for(let row=0;row<Rules.ROWS;row++)if(state.board[row].some(Boolean))return Rules.ROWS-row;return 0;}
  finishByTime(){const alive=this.states.map((state,id)=>({state,id})).filter(item=>!item.state.terminal).sort((a,b)=>this.boardHeight(a.state)-this.boardHeight(b.state)||b.state.lines-a.state.lines||b.state.score-a.state.score||a.id-b.id);const dead=this.states.map((state,id)=>({state,id})).filter(item=>item.state.terminal).sort((a,b)=>(this.koTime[b.id]||0)-(this.koTime[a.id]||0)||a.id-b.id);this.finish(alive.concat(dead).map(item=>item.id));}
  finish(order){if(this.finished)return this.order;this.order=Array.isArray(order)&&order.length===this.playerCount?order.slice():this.states.map((_,id)=>id).sort((a,b)=>{const aliveA=this.alive(a),aliveB=this.alive(b);if(aliveA!==aliveB)return aliveA?-1:1;return this.boardHeight(this.states[a])-this.boardHeight(this.states[b])||this.states[b].lines-this.states[a].lines||this.states[b].score-this.states[a].score||a-b;});this.finished=true;this.order.forEach((id,index)=>this.placements[id]=index+1);this.revision++;return this.order;}
  playerSnapshot(player){const state=this.states[player];return{player,seq:this.lastSeq[player],hash:Rules.hashState(state),state:JSON.parse(Rules.serialize(state)),incoming:this.incoming[player].map(item=>({...item})),alive:!state.terminal,koTime:this.koTime[player],placement:this.placements[player]};}
  snapshot(now=Date.now()){return{protocol:this.protocol,matchId:this.matchId,startAt:this.startAt,matchEndAt:this.matchEndAt,matchSeed:this.matchSeed,rulesetVersion:this.protocol,revision:this.revision,serverNow:now,players:this.states.map((_,player)=>this.playerSnapshot(player)),finished:this.finished,order:this.order?this.order.slice():null,inputCount:this.inputLog.length};}
  stateEvent(now=Date.now()){return{type:'tetris_rule_state',payload:this.snapshot(now)};}
  result(now=Date.now()){return{type:'tetris_result',matchId:this.matchId,protocol:this.protocol,scoringVersion:Rules.SCORING_VERSION,revision:this.revision,serverNow:now,order:this.order.slice(),stats:this.states.map((state,player)=>({player,score:state.score,lines:state.lines,level:state.level,combo:state.combo,backToBackCount:state.backToBackCount,tSpins:state.tSpins,tetrises:state.tetrises,perfectClears:state.perfectClears,pieces:state.pieces,boardHeight:this.boardHeight(state),placement:this.placements[player],hash:Rules.hashState(state)}))};}
}

module.exports={TetrisRuleAuthority};
