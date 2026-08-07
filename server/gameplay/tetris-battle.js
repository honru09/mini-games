'use strict';

const ATTACK_CONFIG=Object.freeze({0:0,1:0,2:1,3:2,4:4});

function validAttackId(value){return typeof value==='string'&&/^[A-Za-z0-9:_-]{3,100}$/.test(value);}

class TetrisBattleAuthority {
  constructor(options={}){
    this.matchId=String(options.matchId||'');this.playerCount=Math.max(2,Math.min(5,Number(options.playerCount)||2));
    this.startAt=Number(options.startAt)||Date.now()+3000;this.matchEndAt=Number(options.matchEndAt)||this.startAt+300000;
    this.matchSeed=String(options.matchSeed||this.matchId);this.rulesetVersion='tetris-battle-v1';this.revision=0;
    this.players=Array.from({length:this.playerCount},(_,id)=>({id,alive:true,koTime:null,placement:0,lastSeq:0,placementSeq:0,
      incoming:[],score:0,lines:0,boardHeight:0,garbageSent:0,garbageReceived:0}));
    this.seenAttacks=new Set();this.koSequence=[];this.finished=false;this.order=null;
  }

  targetFor(source){for(let step=1;step<this.playerCount;step++){const target=(source+step)%this.playerCount;if(this.players[target].alive)return target;}return-1;}
  pendingAmount(player,now){return player.incoming.filter(item=>!item.delivered&&item.applyAt>now).reduce((sum,item)=>sum+item.amount,0);}
  cancelPending(player,amount,now){
    let remaining=amount,cancelled=0;
    for(const item of player.incoming){if(item.delivered||item.applyAt<=now||remaining<=0)continue;const used=Math.min(remaining,item.amount);item.amount-=used;remaining-=used;cancelled+=used;}
    player.incoming=player.incoming.filter(item=>item.amount>0);return{remaining,cancelled};
  }

  claimLock(playerId,claim,now=Date.now()){
    if(this.finished||now<this.startAt)return{ok:false,reason:'not_active'};
    const player=this.players[playerId];if(!player||!player.alive)return{ok:false,reason:'dead_player'};
    const seq=Number(claim&&claim.seq),placementSeq=Number(claim&&claim.placementSeq),cleared=Number(claim&&claim.linesCleared);
    if(!Number.isSafeInteger(seq)||seq<=player.lastSeq)return{ok:false,reason:'stale_seq'};
    if(!Number.isSafeInteger(placementSeq)||placementSeq!==player.placementSeq+1)return{ok:false,reason:'invalid_placement_seq'};
    if(!Number.isInteger(cleared)||cleared<0||cleared>4)return{ok:false,reason:'invalid_lines'};
    const attackId=String(claim&&claim.attackId||'');if(!validAttackId(attackId))return{ok:false,reason:'invalid_attack_id'};
    if(this.seenAttacks.has(attackId))return{ok:false,reason:'duplicate_attack'};
    const expected=ATTACK_CONFIG[cleared];
    if(Number(claim&&claim.attack)!==expected)return{ok:false,reason:'invalid_attack'};
    player.lastSeq=seq;player.placementSeq=placementSeq;this.seenAttacks.add(attackId);
    player.score=Math.max(0,Math.min(1e9,Number(claim.score)||0));player.lines=Math.max(player.lines,Math.min(100000,Number(claim.lines)||0));
    player.boardHeight=Math.max(0,Math.min(18,Number(claim.boardHeight)||0));
    const cancellation=this.cancelPending(player,expected,now);let target=-1;
    if(cancellation.remaining>0){target=this.targetFor(playerId);if(target>=0){const item={attackId,source:playerId,target,amount:cancellation.remaining,applyAt:now+650,delivered:false};this.players[target].incoming.push(item);player.garbageSent+=cancellation.remaining;}}
    this.revision++;
    return{ok:true,event:{type:'tetris_battle',matchId:this.matchId,revision:this.revision,attackId,source:playerId,target,amount:cancellation.remaining,cancelled:cancellation.cancelled,
      sourceIncoming:this.players[playerId].incoming.map(item=>({...item})),targetIncoming:target>=0?this.players[target].incoming.map(item=>({...item})):[]}};
  }

  advance(now=Date.now()){
    const due=[];
    this.players.forEach(player=>player.incoming.forEach(item=>{if(!item.delivered&&item.applyAt<=now){item.delivered=true;player.garbageReceived+=item.amount;due.push({...item});}}));
    if(due.length)this.revision++;
    if(!this.finished&&now>=this.matchEndAt)this.finishByTime(now);
    return due;
  }

  claimKO(playerId,claim,now=Date.now()){
    if(this.finished)return{ok:false,reason:'finished'};const player=this.players[playerId];if(!player||!player.alive)return{ok:false,reason:'already_dead'};
    const seq=Number(claim&&claim.seq);if(!Number.isSafeInteger(seq)||seq<=player.lastSeq)return{ok:false,reason:'stale_seq'};
    player.lastSeq=seq;player.alive=false;player.koTime=now;this.koSequence.push(playerId);
    const alive=this.players.filter(item=>item.alive);player.placement=alive.length+1;this.revision++;
    const event={type:'tetris_ko',matchId:this.matchId,revision:this.revision,player:playerId,koTime:now,placement:player.placement};
    if(alive.length<=1){if(alive[0])alive[0].placement=1;this.finish();}
    return{ok:true,event,result:this.finished?this.result():null};
  }

  finishByTime(){
    const alive=this.players.filter(player=>player.alive).sort((a,b)=>a.boardHeight-b.boardHeight||b.lines-a.lines||b.score-a.score||a.id-b.id);
    const dead=this.players.filter(player=>!player.alive).sort((a,b)=>(b.koTime||0)-(a.koTime||0)||a.id-b.id);
    this.finish(alive.concat(dead).map(player=>player.id));
  }
  finish(order){
    if(this.finished)return this.order;
    this.order=Array.isArray(order)&&order.length===this.playerCount?order.slice():this.players.map(p=>p.id).sort((a,b)=>{
      const A=this.players[a],B=this.players[b];if(A.alive!==B.alive)return A.alive?-1:1;if(A.alive)return A.boardHeight-B.boardHeight||B.lines-A.lines||B.score-A.score||a-b;return(B.koTime||0)-(A.koTime||0)||a-b;
    });
    this.finished=true;this.order.forEach((id,index)=>this.players[id].placement=index+1);this.revision++;return this.order;
  }
  result(){return{type:'tetris_result',matchId:this.matchId,revision:this.revision,order:this.order.slice(),stats:this.players.map(player=>({...player,incoming:player.incoming.map(item=>({...item}))}))};}
  snapshot(){return{protocol:'tetris-battle-authority-v1',matchId:this.matchId,startAt:this.startAt,matchEndAt:this.matchEndAt,matchSeed:this.matchSeed,rulesetVersion:this.rulesetVersion,revision:this.revision,
    players:this.players.map(player=>({...player,incoming:player.incoming.map(item=>({...item}))})),finished:this.finished,order:this.order?this.order.slice():null};}
}

module.exports={TetrisBattleAuthority,ATTACK_CONFIG};
