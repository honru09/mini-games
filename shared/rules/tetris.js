'use strict';

(function expose(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.TetrisRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createTetrisRules(){
  const COLS=10,ROWS=18,PROTOCOL='tetris-rule-v3',SCORING_VERSION='advanced-battle-score-v1';
  const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]],[[0,1,0],[1,1,1]]];
  const TETRIS_ATTACK_CONFIG=Object.freeze({lines:Object.freeze({0:0,1:0,2:1,3:2,4:4}),garbageDelayMs:650});
  const TETRIS_SCORING_CONFIG=Object.freeze({
    lines:Object.freeze([0,100,300,500,800]),
    tSpin:Object.freeze([400,800,1200,1600]),
    perfectClear:Object.freeze([0,800,1200,1800,2000]),
    tSpinAttack:Object.freeze([0,2,4,6]),
    comboAttack:Object.freeze([0,0,1,1,2,2,3,3,4,4,4,5]),
    comboUnit:50,
    backToBackMultiplier:1.5,
    backToBackAttack:1,
    perfectClearAttack:10,
  });

  function hashSeed(value){let hash=2166136261>>>0;for(let i=0;i<String(value).length;i++){hash^=String(value).charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}return hash||0x9e3779b9;}
  function seededRandom(value){let state=hashSeed(value);return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};}
  function makeBag(seed,player,index){const bag=[0,1,2,3,4,5,6],random=seededRandom(String(seed)+'|p'+player+'|bag'+index);for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}return bag;}
  function emptyBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(0));}
  function rotateCW(matrix){const rows=matrix.length,cols=matrix[0].length,out=Array.from({length:cols},()=>Array(rows).fill(0));for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)out[c][rows-1-r]=matrix[r][c];return out;}
  function shapeAt(kind,rotation){let shape=SHAPES[kind];for(let i=0;i<((rotation%4)+4)%4;i++)shape=rotateCW(shape);return shape;}
  function collide(board,shape,x,y){for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]){const rr=y+r,cc=x+c;if(cc<0||cc>=COLS||rr>=ROWS||(rr>=0&&board[rr][cc]))return true;}return false;}
  function normalizeScoringState(state){
    const lines=Math.max(0,Number(state.lines)||0);
    return{
      ...state,
      scoringVersion:SCORING_VERSION,
      level:Math.max(1,Number.isInteger(state.level)?state.level:Math.floor(lines/10)+1),
      combo:Number.isInteger(state.combo)?state.combo:-1,
      backToBack:state.backToBack===true,
      backToBackCount:Math.max(0,Number.isInteger(state.backToBackCount)?state.backToBackCount:0),
      tSpins:Math.max(0,Number.isInteger(state.tSpins)?state.tSpins:0),
      tetrises:Math.max(0,Number.isInteger(state.tetrises)?state.tetrises:0),
      perfectClears:Math.max(0,Number.isInteger(state.perfectClears)?state.perfectClears:0),
      lastAction:typeof state.lastAction==='string'?state.lastAction:null,
    };
  }
  function cloneState(state){const normalized=normalizeScoringState(state);return{...normalized,board:normalized.board.map(row=>row.slice()),active:normalized.active?{...normalized.active}:null,queue:normalized.queue.slice(),lastEvent:normalized.lastEvent?{...normalized.lastEvent,attackBreakdown:normalized.lastEvent.attackBreakdown?{...normalized.lastEvent.attackBreakdown}:undefined}:null};}
  function ensureQueue(state){while(state.queue.length<7)state.queue.push(...makeBag(state.seed,state.player,state.bagIndex++));}
  function spawn(state,forcedKind){ensureQueue(state);const kind=Number.isInteger(forcedKind)?forcedKind:state.queue.shift();ensureQueue(state);const shape=shapeAt(kind,0),active={kind,rotation:0,x:Math.floor((COLS-shape[0].length)/2),y:-Math.max(1,shape.length-1)};state.active=active;state.lastAction=null;if(collide(state.board,shape,active.x,active.y)){state.active=null;state.terminal=true;state.reason='TOP_OUT';return false;}return true;}
  function createInitialState(options={}){const state={protocol:PROTOCOL,scoringVersion:SCORING_VERSION,seed:String(options.seed||'local'),player:Math.max(0,Number(options.player)||0),board:emptyBoard(),active:null,queue:[],bagIndex:0,hold:null,canHold:true,score:0,lines:0,level:1,combo:-1,backToBack:false,backToBackCount:0,tSpins:0,tetrises:0,perfectClears:0,lastAction:null,pieces:0,terminal:false,reason:null,lastEvent:null};spawn(state);return state;}
  function occupiedOrWall(board,row,column){return row<0||row>=ROWS||column<0||column>=COLS||!!board[row][column];}
  function detectTSpin(board,active,lastAction){
    if(!active||active.kind!==6||lastAction!=='rotate')return false;
    const pivots=[[1,1],[0,1],[1,0],[1,1]],pivot=pivots[((active.rotation%4)+4)%4],cx=active.x+pivot[0],cy=active.y+pivot[1];
    let occupied=0;for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])if(occupiedOrWall(board,cy+dy,cx+dx))occupied++;
    return occupied>=3;
  }
  function clearType(cleared,tSpin){
    if(tSpin)return['t-spin-zero','t-spin-single','t-spin-double','t-spin-triple'][Math.max(0,Math.min(3,cleared))];
    return['none','single','double','triple','tetris'][Math.max(0,Math.min(4,cleared))];
  }
  function resolveLockScore(previous,details={}){
    const cleared=Math.max(0,Math.min(4,Number(details.cleared)||0)),tSpin=details.tSpin===true,perfectClear=details.perfectClear===true&&cleared>0;
    const previousLines=Math.max(0,Number(previous&&previous.lines)||0),level=Math.max(1,Number(previous&&previous.level)||Math.floor(previousLines/10)+1);
    const priorCombo=Number.isInteger(previous&&previous.combo)?previous.combo:-1,combo=cleared>0?priorCombo+1:-1;
    const difficult=cleared===4||(tSpin&&cleared>0),priorBackToBack=previous&&previous.backToBack===true,backToBackBonus=difficult&&priorBackToBack;
    const lineBase=(tSpin?TETRIS_SCORING_CONFIG.tSpin[cleared]:TETRIS_SCORING_CONFIG.lines[cleared])||0;
    const lineScore=Math.floor(lineBase*level*(backToBackBonus?TETRIS_SCORING_CONFIG.backToBackMultiplier:1));
    const comboBonus=cleared>0&&combo>0?TETRIS_SCORING_CONFIG.comboUnit*combo*level:0;
    const perfectClearBonus=perfectClear?(TETRIS_SCORING_CONFIG.perfectClear[cleared]||0)*level:0;
    const baseAttack=(tSpin?TETRIS_SCORING_CONFIG.tSpinAttack[cleared]:TETRIS_ATTACK_CONFIG.lines[cleared])||0;
    const backToBackAttack=backToBackBonus&&baseAttack>0?TETRIS_SCORING_CONFIG.backToBackAttack:0;
    const comboAttack=cleared>0?TETRIS_SCORING_CONFIG.comboAttack[Math.min(combo,TETRIS_SCORING_CONFIG.comboAttack.length-1)]||0:0;
    const perfectClearAttack=perfectClear?TETRIS_SCORING_CONFIG.perfectClearAttack:0;
    const backToBack=difficult?true:(cleared>0?false:priorBackToBack),backToBackCount=difficult?(priorBackToBack?Math.max(1,Number(previous&&previous.backToBackCount)||1)+1:1):(cleared>0?0:Math.max(0,Number(previous&&previous.backToBackCount)||0));
    const uncappedAttack=baseAttack+backToBackAttack+comboAttack+perfectClearAttack;
    return{clearType:clearType(cleared,tSpin),tSpin,difficult,level,combo,backToBack,backToBackCount,backToBackBonus,comboBonus,perfectClear,perfectClearBonus,
      scoreDelta:lineScore+comboBonus+perfectClearBonus,attack:Math.min(12,uncappedAttack),attackUncapped:uncappedAttack,
      attackBreakdown:{base:baseAttack,backToBack:backToBackAttack,combo:comboAttack,perfectClear:perfectClearAttack}};
  }
  function lock(state){
    const active=state.active,shape=active&&shapeAt(active.kind,active.rotation);if(!active||!shape)return{ok:false,reason:'ERR_INVALID_STATE'};
    const tSpin=detectTSpin(state.board,active,state.lastAction);
    for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]){const rr=active.y+r,cc=active.x+c;if(rr<0){state.active=null;state.terminal=true;state.reason='TOP_OUT';return{ok:true,event:{type:'lock',cleared:0,attack:0,topOut:true}};}state.board[rr][cc]=1;}
    let cleared=0;for(let r=ROWS-1;r>=0;r--)if(state.board[r].every(Boolean)){state.board.splice(r,1);state.board.unshift(Array(COLS).fill(0));cleared++;r++;}
    const perfectClear=cleared>0&&state.board.every(row=>row.every(cell=>cell===0)),scoring=resolveLockScore(state,{cleared,tSpin,perfectClear});
    state.lines+=cleared;state.level=Math.floor(state.lines/10)+1;state.score+=scoring.scoreDelta;state.combo=scoring.combo;state.backToBack=scoring.backToBack;state.backToBackCount=scoring.backToBackCount;
    if(tSpin)state.tSpins++;if(cleared===4)state.tetrises++;if(perfectClear)state.perfectClears++;state.pieces++;state.active=null;state.canHold=true;state.lastAction=null;
    const event={type:'lock',piece:active.kind,x:active.x,y:active.y,rotation:active.rotation,cleared,attack:scoring.attack,topOut:false,...scoring};state.lastEvent=event;
    if(!spawn(state))event.topOut=true;return{ok:true,event};
  }
  function applyGarbage(state,lines,attackId){
    const amount=Math.max(0,Math.min(12,Number(lines)||0));
    for(let index=0;index<amount;index++){
      if(state.board[0].some(Boolean)){state.terminal=true;state.reason='GARBAGE_TOP_OUT';state.active=null;return{type:'garbage',lines:index,topOut:true};}
      const hole=hashSeed(state.seed+'|'+attackId+'|'+index)%COLS;state.board.shift();state.board.push(Array.from({length:COLS},(_,column)=>column===hole?0:1));
    }
    const event={type:'garbage',lines:amount,attackId:String(attackId||''),topOut:false};state.lastEvent=event;return event;
  }
  function transition(state,action){
    if(!action||typeof action!=='object')return{ok:false,reason:'ERR_INVALID_MOVE'};const next=cloneState(state),active=next.active;
    if(action.type==='garbage'){const lines=Number(action.lines);if(!Number.isInteger(lines)||lines<1||lines>12)return{ok:false,reason:'ERR_INVALID_MOVE'};const event=applyGarbage(next,lines,action.attackId);return{ok:true,state:next,event};}
    if(!active)return{ok:false,reason:'ERR_INVALID_STATE'};
    const move=(dx,dy)=>{const shape=shapeAt(active.kind,active.rotation);if(collide(next.board,shape,active.x+dx,active.y+dy))return false;active.x+=dx;active.y+=dy;return true;};
    if(action.type==='left'||action.type==='right'){if(!move(action.type==='left'?-1:1,0))return{ok:false,reason:'ERR_INVALID_MOVE'};next.lastAction='move';return{ok:true,state:next,event:{type:'move',action:action.type}};}
    if(action.type==='rotate_cw'||action.type==='rotate_ccw'){
      const rotation=(active.rotation+(action.type==='rotate_cw'?1:3))%4,shape=shapeAt(active.kind,rotation);let applied=false;
      for(const kick of [0,-1,1,-2,2])if(!collide(next.board,shape,active.x+kick,active.y)){active.rotation=rotation;active.x+=kick;next.lastAction='rotate';applied=true;break;}
      return applied?{ok:true,state:next,event:{type:'rotate',rotation}}:{ok:false,reason:'ERR_INVALID_MOVE'};
    }
    if(action.type==='soft_drop'||action.type==='tick'){if(move(0,1)){if(action.type==='soft_drop')next.lastAction='drop';return{ok:true,state:next,event:{type:'fall'}};}const locked=lock(next);return{...locked,state:next};}
    if(action.type==='hard_drop'){let distance=0;while(move(0,1))distance++;if(distance>0)next.lastAction='drop';const locked=lock(next);return{...locked,state:next};}
    if(action.type==='hold'){
      if(!next.canHold)return{ok:false,reason:'ERR_INVALID_MOVE'};const previous=next.hold;next.hold=active.kind;next.active=null;next.lastAction=null;if(!spawn(next,previous===null?undefined:previous)){return{ok:true,state:next,event:{type:'hold',topOut:true}};}next.canHold=false;return{ok:true,state:next,event:{type:'hold',topOut:false}};
    }
    return{ok:false,reason:'ERR_INVALID_MOVE'};
  }
  function validateAction(state,action){if(!state||state.protocol!==PROTOCOL)return{ok:false,reason:'ERR_INVALID_STATE'};if(state.terminal)return{ok:false,reason:'ERR_MATCH_FINISHED'};const result=transition(state,action);return result.ok?{ok:true}:{ok:false,reason:result.reason};}
  function applyAction(state,action){const validation=validateAction(state,action);if(!validation.ok)return validation;return transition(state,action);}
  function getLegalActions(state){if(!state||state.terminal)return[];const candidates=['left','right','rotate_cw','rotate_ccw','soft_drop','hard_drop','hold'];return candidates.map(type=>({type})).filter(action=>validateAction(state,action).ok);}
  function isTerminal(state){return!!(state&&state.terminal);}
  function getResult(state){return isTerminal(state)?{terminal:true,reason:state.reason,score:state.score,lines:state.lines,level:state.level,combo:state.combo,backToBackCount:state.backToBackCount,tSpins:state.tSpins,tetrises:state.tetrises,perfectClears:state.perfectClears,pieces:state.pieces}:null;}
  function serialize(state){return JSON.stringify(state);}
  function deserialize(value){const parsed=typeof value==='string'?JSON.parse(value):value;if(!parsed||parsed.protocol!==PROTOCOL||!Array.isArray(parsed.board)||parsed.board.length!==ROWS||parsed.board.some(row=>!Array.isArray(row)||row.length!==COLS))throw new Error('invalid_tetris_state');return cloneState(parsed);}
  function hashState(state){const text=serialize(state);let hash=2166136261>>>0;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}return hash.toString(16).padStart(8,'0');}
  function replay(options,actions){let state=createInitialState(options);for(const action of actions||[]){const result=applyAction(state,action);if(!result.ok)throw new Error(result.reason);state=result.state;}return state;}

  return{PROTOCOL,SCORING_VERSION,COLS,ROWS,SHAPES,TETRIS_ATTACK_CONFIG,TETRIS_SCORING_CONFIG,createInitialState,validateAction,applyAction,getLegalActions,isTerminal,getResult,serialize,deserialize,hashState,replay,shapeAt,collide,detectTSpin,resolveLockScore};
});
