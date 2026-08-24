'use strict';

(function expose(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LudoRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createLudoRules(){
  const TRACK=52,HOME=56,TOKENS=4,PROTOCOL='ludo-rule-v1';
  const START_BY_COUNT={2:[0,2],3:[0,1,2],4:[0,1,2,3]};
  function pidsFor(count){const n=Math.max(2,Math.min(4,Number(count)||2));return START_BY_COUNT[n].slice();}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function createInitialState(playerCount=2){const pids=pidsFor(playerCount);return{protocol:PROTOCOL,playerCount:pids.length,pids,tokens:pids.map(()=>Array(TOKENS).fill(-1)),current:0,phase:'roll',dice:0,terminal:false,winner:-1,reason:null,moveNumber:0,captures:0,takeoffs:0,revision:0,lastAction:null};}
  function validPlayer(state,p){return !!state&&Number.isInteger(p)&&p>=0&&p<state.playerCount;}
  function validToken(v){return Number.isInteger(v)&&v>=-1&&v<=HOME;}
  function cellOf(state,pi,pos){return (state.pids[pi]+pos)%TRACK;}
  function advanceToken(pos,dice){if(pos===-1)return 0;const next=pos+dice;return next<=HOME?next:Math.max(0,HOME-(next-HOME));}
  function captureCount(state,pi,destination){if(destination<0||destination>50)return 0;const landing=cellOf(state,pi,destination);let count=0;state.tokens.forEach((list,other)=>{if(other===pi)return;list.forEach((pos,ti)=>{if(pos>=0&&pos<=50&&cellOf(state,other,pos)===landing){list[ti]=-1;count++;}});});return count;}
  function cloneState(state){return clone(state);}
  function validateState(state){
    if(!state||state.protocol!==PROTOCOL||!Array.isArray(state.pids)||!START_BY_COUNT[state.playerCount]||JSON.stringify(state.pids)!==JSON.stringify(START_BY_COUNT[state.playerCount])||!Array.isArray(state.tokens)||state.tokens.length!==state.playerCount||state.tokens.some(list=>!Array.isArray(list)||list.length!==TOKENS||list.some(v=>!validToken(v))))return false;
    if(!validPlayer(state,state.current)||!['roll','pick'].includes(state.phase)||!Number.isInteger(state.dice)||state.dice<0||state.dice>6||!Number.isInteger(state.moveNumber)||state.moveNumber<0||!Number.isInteger(state.revision)||state.revision<0)return false;
    if(!state.terminal&&state.winner!==-1)return false;
    if(state.terminal&&!validPlayer(state,state.winner))return false;
    return true;
  }
  function legalTokens(state,pi=state&&state.current){if(!validateState(state)||state.terminal||state.phase!=='pick'||pi!==state.current)return[];return state.tokens[pi].map((pos,ti)=>(pos===-1&&state.dice===6)||(pos>=0&&pos<HOME)?ti:-1).filter(ti=>ti>=0);}
  function legalAfterRoll(state,pi,dice){return validateState(state)&&validPlayer(state,pi)&&state.tokens[pi].map((pos,ti)=>(pos===-1&&dice===6)||(pos>=0&&pos<HOME)?ti:-1).filter(ti=>ti>=0);}
  function validateAction(state,action,player=state&&state.current){
    if(!validateState(state)||state.terminal)return{ok:false,reason:'ERR_MATCH_FINISHED'};
    if(!validPlayer(state,player)||player!==state.current)return{ok:false,reason:'ERR_NOT_ACTIVE_PLAYER'};
    if(!action||typeof action!=='object')return{ok:false,reason:'ERR_INVALID_MOVE'};
    if(action.type==='roll'){
      if(state.phase!=='roll'||!Number.isInteger(action.dice)||action.dice<1||action.dice>6)return{ok:false,reason:'ERR_INVALID_MOVE'};
      return{ok:true};
    }
    if(action.type==='move'&&state.phase==='pick'&&Number.isInteger(action.token)&&legalTokens(state,player).includes(action.token))return{ok:true};
    return{ok:false,reason:'ERR_INVALID_MOVE'};
  }
  function applyAction(state,action,player=state&&state.current){
    const checked=validateAction(state,action,player);if(!checked.ok)return checked;
    const next=cloneState(state);next.revision++;next.moveNumber++;next.lastAction={player,type:action.type,token:action.token??null,dice:action.dice??null};
    if(action.type==='roll'){
      next.dice=action.dice;const legal=legalAfterRoll(next,player,action.dice);
      if(!legal.length){next.phase='roll';next.dice=0;next.current=(player+1)%next.playerCount;next.lastAction.noMove=true;}
      else next.phase='pick';
      return{ok:true,state:next,event:{type:'ludo_rule_state',payload:serializeSnapshot(next)}};
    }
    const pi=player,ti=action.token,from=next.tokens[pi][ti],destination=advanceToken(from,next.dice),wasBase=from===-1;
    next.tokens[pi][ti]=destination;if(wasBase)next.takeoffs++;
    const captured=captureCount(next,pi,destination);next.captures+=captured;
    const finished=next.tokens[pi].every(v=>v===HOME);
    if(finished){next.terminal=true;next.winner=pi;next.reason='ALL_HOME';next.phase='roll';next.dice=0;}
    else if(next.dice===6){next.phase='roll';next.dice=0;}
    else{next.current=(player+1)%next.playerCount;next.phase='roll';next.dice=0;}
    const event={type:'ludo_rule_state',payload:{...serializeSnapshot(next),move:{player,token:ti,from,destination,wasBase,captured}}};
    const result=next.terminal?resultFor(next):null;return{ok:true,state:next,event,result};
  }
  function serializeSnapshot(state){const out=clone(state);delete out.protocol;out.protocol=PROTOCOL;return out;}
  function resultFor(state){if(!state||!state.terminal)return null;const order=state.tokens.map((list,index)=>({slot:index,home:list.filter(v=>v===HOME).length,progress:list.reduce((sum,v)=>sum+Math.max(0,v),0),index})).sort((a,b)=>b.home-a.home||b.progress-a.progress||a.index-b.index).map(v=>v.slot);return{type:'ludo_result',payload:{protocol:PROTOCOL,matchId:state.matchId||null,revision:state.revision,draw:false,order,results:order.map((slot,index)=>({slot,rank:index+1,coins:index===0?1:0})),stats:{moves:state.moveNumber,captures:state.captures,takeoffs:state.takeoffs,winner:state.winner,reason:state.reason}}};}
  function deserialize(value){const parsed=typeof value==='string'?JSON.parse(value):clone(value);if(!validateState(parsed))throw new Error('invalid_ludo_state');return parsed;}
  function hashState(state){const text=JSON.stringify(serializeSnapshot(state));let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');}
  return{PROTOCOL,TRACK,HOME,TOKENS,pidsFor,createInitialState,validateState,validateAction,applyAction,legalTokens,legalAfterRoll,serialize:serializeSnapshot,deserialize,resultFor,hashState,advanceToken,cellOf};
});
