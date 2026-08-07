'use strict';

const ATTACK_CONFIG=Object.freeze({0:0,1:0,2:1,3:2,4:4});
const PRESENTATION_LIMITS=Object.freeze({rows:18,cols:10,kinds:7,minX:-3,maxX:9,minY:-4,maxY:17,maxQueue:14});
const LOCK_KEYS=new Set(['matchId','seq','placementSeq','linesCleared','attack','attackId','score','lines','boardHeight','piece','x','y','rot']);
const KO_KEYS=new Set(['matchId','seq','reason','boardHeight']);
const PRESENTATION_KEYS=new Set(['matchId','seq','state']);
const STATE_KEYS=new Set(['well','active','queue','bagIndex','hold','canHold','score','lines','tetrisCount','placementSeq']);
const ACTIVE_KEYS=new Set(['kind','rotation','x','y']);

function validAttackId(value){return typeof value==='string'&&/^[A-Za-z0-9:_-]{3,100}$/.test(value);}
function plainObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function onlyKeys(value,allowed){return plainObject(value)&&Object.keys(value).every(key=>allowed.has(key));}
function boundedInteger(value,min,max){return Number.isSafeInteger(value)&&value>=min&&value<=max;}
function validKind(value){return boundedInteger(value,0,PRESENTATION_LIMITS.kinds-1);}
function validCoordinates(x,y){return boundedInteger(x,PRESENTATION_LIMITS.minX,PRESENTATION_LIMITS.maxX)&&boundedInteger(y,PRESENTATION_LIMITS.minY,PRESENTATION_LIMITS.maxY);}
function validMatchId(value,expected){return typeof value==='string'&&typeof expected==='string'&&expected.length>0&&value===expected;}
function sanitizePresentationState(value,placementSeq){
  if(!onlyKeys(value,STATE_KEYS))return null;
  const well=value.well;
  if(!Array.isArray(well)||well.length!==PRESENTATION_LIMITS.rows||well.some(row=>!Array.isArray(row)||row.length!==PRESENTATION_LIMITS.cols||row.some(cell=>cell!==0&&cell!==1)))return null;
  let active=null;
  if(value.active!==null){
    if(!onlyKeys(value.active,ACTIVE_KEYS)||!validKind(value.active.kind)||!boundedInteger(value.active.rotation,0,3)||!validCoordinates(value.active.x,value.active.y))return null;
    active={kind:value.active.kind,rotation:value.active.rotation,x:value.active.x,y:value.active.y};
  }
  if(!Array.isArray(value.queue)||value.queue.length<4||value.queue.length>PRESENTATION_LIMITS.maxQueue||!value.queue.every(validKind))return null;
  if(value.hold!==null&&!validKind(value.hold))return null;
  if(typeof value.canHold!=='boolean'||!boundedInteger(value.bagIndex,0,1000000)||!boundedInteger(value.score,0,1000000000)||
      !boundedInteger(value.lines,0,100000)||!boundedInteger(value.tetrisCount,0,25000)||value.placementSeq!==placementSeq)return null;
  return{well:well.map(row=>row.slice()),active,queue:value.queue.slice(),bagIndex:value.bagIndex,hold:value.hold,canHold:value.canHold,
    score:value.score,lines:value.lines,tetrisCount:value.tetrisCount,placementSeq:value.placementSeq};
}

class TetrisBattleAuthority {
  constructor(options={}){
    this.matchId=String(options.matchId||'');this.playerCount=Math.max(2,Math.min(5,Number(options.playerCount)||2));
    this.startAt=Number(options.startAt)||Date.now()+3000;this.matchEndAt=Number(options.matchEndAt)||this.startAt+300000;
    this.matchSeed=String(options.matchSeed||this.matchId);this.rulesetVersion='tetris-battle-v1';this.revision=0;
    this.players=Array.from({length:this.playerCount},(_,id)=>({id,alive:true,koTime:null,placement:0,lastSeq:0,placementSeq:0,lastPresentationSeq:0,
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
    if(!boundedInteger(playerId,0,this.playerCount-1))return{ok:false,reason:'invalid_player'};
    const player=this.players[playerId];if(!player||!player.alive)return{ok:false,reason:'dead_player'};
    if(!onlyKeys(claim,LOCK_KEYS))return{ok:false,reason:'invalid_payload'};
    if(!validMatchId(claim.matchId,this.matchId))return{ok:false,reason:'invalid_match'};
    const seq=claim.seq,placementSeq=claim.placementSeq,cleared=claim.linesCleared;
    if(!Number.isSafeInteger(seq)||seq<=player.lastSeq)return{ok:false,reason:'stale_seq'};
    if(!Number.isSafeInteger(placementSeq)||placementSeq!==player.placementSeq+1)return{ok:false,reason:'invalid_placement_seq'};
    if(!Number.isInteger(cleared)||cleared<0||cleared>4)return{ok:false,reason:'invalid_lines'};
    if(!validKind(claim.piece)||!boundedInteger(claim.rot,0,3)||!validCoordinates(claim.x,claim.y))return{ok:false,reason:'invalid_piece'};
    if(!boundedInteger(claim.score,0,1000000000)||claim.score<player.score||!boundedInteger(claim.lines,0,100000)||claim.lines<player.lines||!boundedInteger(claim.boardHeight,0,18))return{ok:false,reason:'invalid_stats'};
    const attackId=claim.attackId;if(!validAttackId(attackId))return{ok:false,reason:'invalid_attack_id'};
    if(this.seenAttacks.has(attackId))return{ok:false,reason:'duplicate_attack'};
    const expected=ATTACK_CONFIG[cleared];
    if(claim.attack!==expected)return{ok:false,reason:'invalid_attack'};
    player.lastSeq=seq;player.placementSeq=placementSeq;this.seenAttacks.add(attackId);
    player.score=claim.score;player.lines=claim.lines;player.boardHeight=claim.boardHeight;
    const cancellation=this.cancelPending(player,expected,now);let target=-1;
    if(cancellation.remaining>0){target=this.targetFor(playerId);if(target>=0){const item={attackId,source:playerId,target,amount:cancellation.remaining,applyAt:now+650,delivered:false};this.players[target].incoming.push(item);player.garbageSent+=cancellation.remaining;}}
    this.revision++;
    return{ok:true,event:{type:'tetris_battle',matchId:this.matchId,revision:this.revision,attackId,source:playerId,target,amount:cancellation.remaining,cancelled:cancellation.cancelled,
      sourceIncoming:this.players[playerId].incoming.map(item=>({...item})),targetIncoming:target>=0?this.players[target].incoming.map(item=>({...item})):[]}};
  }

  acceptPresentation(playerId,payload,now=Date.now()){
    if(this.finished||now<this.startAt)return{ok:false,reason:'not_active'};
    if(!boundedInteger(playerId,0,this.playerCount-1))return{ok:false,reason:'invalid_player'};
    const player=this.players[playerId];if(!player||!player.alive)return{ok:false,reason:'dead_player'};
    if(!onlyKeys(payload,PRESENTATION_KEYS))return{ok:false,reason:'invalid_payload'};
    if(!validMatchId(payload.matchId,this.matchId))return{ok:false,reason:'invalid_match'};
    if(!Number.isSafeInteger(payload.seq)||payload.seq<=player.lastPresentationSeq)return{ok:false,reason:'stale_seq'};
    const state=sanitizePresentationState(payload.state,player.placementSeq);if(!state)return{ok:false,reason:'invalid_state'};
    player.lastPresentationSeq=payload.seq;
    return{ok:true,payload:{matchId:this.matchId,player:playerId,seq:payload.seq,state,updatedAt:now}};
  }

  advance(now=Date.now()){
    if(this.finished)return[];
    const due=[];
    this.players.forEach(player=>{
      const pending=[];
      player.incoming.forEach(item=>{
        if(item.delivered)return;
        if(item.applyAt<=now){player.garbageReceived+=item.amount;due.push({...item,delivered:true});}
        else pending.push(item);
      });
      player.incoming=pending;
    });
    if(due.length)this.revision++;
    if(!this.finished&&now>=this.matchEndAt)this.finishByTime(now);
    return due;
  }

  claimKO(playerId,claim,now=Date.now()){
    if(this.finished)return{ok:false,reason:'finished'};if(!boundedInteger(playerId,0,this.playerCount-1))return{ok:false,reason:'invalid_player'};const player=this.players[playerId];if(!player||!player.alive)return{ok:false,reason:'already_dead'};
    if(!onlyKeys(claim,KO_KEYS))return{ok:false,reason:'invalid_payload'};
    if(!validMatchId(claim.matchId,this.matchId))return{ok:false,reason:'invalid_match'};
    const seq=claim.seq;if(!Number.isSafeInteger(seq)||seq<=player.lastSeq)return{ok:false,reason:'stale_seq'};
    if(claim.reason!==undefined&&(typeof claim.reason!=='string'||claim.reason.length>40))return{ok:false,reason:'invalid_reason'};
    if(claim.boardHeight!==undefined&&!boundedInteger(claim.boardHeight,0,18))return{ok:false,reason:'invalid_stats'};
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
    const validOrder=Array.isArray(order)&&order.length===this.playerCount&&new Set(order).size===this.playerCount&&order.every(id=>boundedInteger(id,0,this.playerCount-1));
    this.order=validOrder?order.slice():this.players.map(p=>p.id).sort((a,b)=>{
      const A=this.players[a],B=this.players[b];if(A.alive!==B.alive)return A.alive?-1:1;if(A.alive)return A.boardHeight-B.boardHeight||B.lines-A.lines||B.score-A.score||a-b;return(B.koTime||0)-(A.koTime||0)||a-b;
    });
    this.finished=true;this.order.forEach((id,index)=>this.players[id].placement=index+1);this.players.forEach(player=>{player.incoming=[];});this.revision++;return this.order;
  }
  result(){return{type:'tetris_result',matchId:this.matchId,revision:this.revision,order:this.order?this.order.slice():[],stats:this.players.map(player=>({...player,incoming:player.incoming.map(item=>({...item}))}))};}
  snapshot(){return{protocol:'tetris-battle-authority-v1',matchId:this.matchId,startAt:this.startAt,matchEndAt:this.matchEndAt,matchSeed:this.matchSeed,rulesetVersion:this.rulesetVersion,revision:this.revision,
    players:this.players.map(player=>({...player,incoming:player.incoming.map(item=>({...item}))})),finished:this.finished,order:this.order?this.order.slice():null};}
}

module.exports={TetrisBattleAuthority,ATTACK_CONFIG,PRESENTATION_LIMITS,sanitizePresentationState};
