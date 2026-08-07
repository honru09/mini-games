'use strict';

(function expose(root, factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.XiangqiRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createXiangqiRules(){
  const ROWS=10,COLS=9,PROTOCOL='xiangqi-rule-v2';
  const SETUP=[
    ['r','h','e','a','k','a','e','h','r'],
    [null,null,null,null,null,null,null,null,null],
    [null,'c',null,null,null,null,null,'c',null],
    ['p',null,'p',null,'p',null,'p',null,'p'],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    ['p',null,'p',null,'p',null,'p',null,'p'],
    [null,'c',null,null,null,null,null,'c',null],
    [null,null,null,null,null,null,null,null,null],
    ['r','h','e','a','k','a','e','h','r'],
  ];

  function cloneBoard(board){return board.map(row=>row.map(piece=>piece?{p:piece.p,t:piece.t}:null));}
  function createInitialState(){
    const board=Array.from({length:ROWS},()=>Array(COLS).fill(null));
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(SETUP[r][c])board[r][c]={p:r<5?1:0,t:SETUP[r][c]};
    return{protocol:PROTOCOL,board,current:0,moveNumber:0,lastMove:null,terminal:false,winner:-1,reason:null,check:false};
  }
  function cloneState(state){return{...state,board:cloneBoard(state.board),lastMove:state.lastMove?{from:state.lastMove.from.slice(),to:state.lastMove.to.slice(),capture:state.lastMove.capture?{...state.lastMove.capture}:null}:null};}
  function validCoord(value){return Array.isArray(value)&&value.length===2&&Number.isInteger(value[0])&&Number.isInteger(value[1])&&value[0]>=0&&value[0]<ROWS&&value[1]>=0&&value[1]<COLS;}
  function inPalace(r,c,player){return c>=3&&c<=5&&(player===1?r>=0&&r<=2:r>=7&&r<=9);}
  function findGeneral(state,player){for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const piece=state.board[r][c];if(piece&&piece.p===player&&piece.t==='k')return[r,c];}return null;}
  function canMoveTo(state,player,r,c){return r>=0&&r<ROWS&&c>=0&&c<COLS&&(!state.board[r][c]||state.board[r][c].p!==player);}
  function pseudoMoves(state,player,r,c){
    const board=state.board,piece=board[r]&&board[r][c];if(!piece||piece.p!==player)return[];const result=[];
    if(piece.t==='k'){
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){const nr=r+dr,nc=c+dc;if(inPalace(nr,nc,player)&&canMoveTo(state,player,nr,nc))result.push([nr,nc]);}
      const enemy=findGeneral(state,player^1);if(enemy&&enemy[1]===c){let blocked=false;for(let rr=Math.min(r,enemy[0])+1;rr<Math.max(r,enemy[0]);rr++)if(board[rr][c]){blocked=true;break;}if(!blocked)result.push(enemy);}
    }else if(piece.t==='a'){
      for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){const nr=r+dr,nc=c+dc;if(inPalace(nr,nc,player)&&canMoveTo(state,player,nr,nc))result.push([nr,nc]);}
    }else if(piece.t==='e'){
      for(const [dr,dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]){const nr=r+dr,nc=c+dc,er=r+dr/2,ec=c+dc/2;if(!canMoveTo(state,player,nr,nc))continue;if(player===1&&nr>4||player===0&&nr<5)continue;if(board[er][ec])continue;result.push([nr,nc]);}
    }else if(piece.t==='h'){
      const paths=[[[-1,0],[-2,-1]],[[-1,0],[-2,1]],[[1,0],[2,-1]],[[1,0],[2,1]],[[0,-1],[-1,-2]],[[0,-1],[1,-2]],[[0,1],[-1,2]],[[0,1],[1,2]]];
      for(const [leg,step] of paths){const nr=r+step[0],nc=c+step[1],lr=r+leg[0],lc=c+leg[1];if(!canMoveTo(state,player,nr,nc)||!board[lr]||board[lr][lc])continue;result.push([nr,nc]);}
    }else if(piece.t==='r'||piece.t==='c'){
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){let nr=r+dr,nc=c+dc,screen=false;while(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS){const target=board[nr][nc];if(piece.t==='r'){if(!target)result.push([nr,nc]);else{if(target.p!==player)result.push([nr,nc]);break;}}else if(!screen){if(!target)result.push([nr,nc]);else screen=true;}else if(target){if(target.p!==player)result.push([nr,nc]);break;}nr+=dr;nc+=dc;}}
    }else if(piece.t==='p'){
      const forward=player===1?1:-1,nr=r+forward;if(canMoveTo(state,player,nr,c))result.push([nr,c]);
      if(player===1&&r>=5||player===0&&r<=4)for(const dc of [-1,1])if(canMoveTo(state,player,r,c+dc))result.push([r,c+dc]);
    }
    return result;
  }
  function isCheck(state,player){
    const general=findGeneral(state,player);if(!general)return true;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const piece=state.board[r][c];if(piece&&piece.p!==player&&pseudoMoves(state,piece.p,r,c).some(to=>to[0]===general[0]&&to[1]===general[1]))return true;}
    return false;
  }
  function legalMovesForPiece(state,player,r,c){
    return pseudoMoves(state,player,r,c).filter(to=>{const next=cloneState(state),piece=next.board[r][c];next.board[r][c]=null;next.board[to[0]][to[1]]=piece;return!isCheck(next,player);});
  }
  function getLegalActions(state,player=state.current){
    if(!state||state.terminal||player!==state.current)return[];const actions=[];
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const piece=state.board[r][c];if(piece&&piece.p===player)legalMovesForPiece(state,player,r,c).forEach(to=>actions.push({type:'move',from:[r,c],to}));}
    return actions;
  }
  function validateAction(state,action,player=state&&state.current){
    if(!state||state.protocol!==PROTOCOL||state.terminal)return{ok:false,reason:'ERR_MATCH_FINISHED'};
    if(player!==state.current)return{ok:false,reason:'ERR_NOT_ACTIVE_PLAYER'};
    if(!action||action.type!=='move'||!validCoord(action.from)||!validCoord(action.to))return{ok:false,reason:'ERR_INVALID_MOVE'};
    const piece=state.board[action.from[0]][action.from[1]];if(!piece||piece.p!==player)return{ok:false,reason:'ERR_INVALID_MOVE'};
    const legal=legalMovesForPiece(state,player,action.from[0],action.from[1]);return legal.some(to=>to[0]===action.to[0]&&to[1]===action.to[1])?{ok:true}:{ok:false,reason:'ERR_INVALID_MOVE'};
  }
  function applyAction(state,action,player=state&&state.current){
    const validation=validateAction(state,action,player);if(!validation.ok)return validation;
    const next=cloneState(state),piece=next.board[action.from[0]][action.from[1]],capture=next.board[action.to[0]][action.to[1]];
    next.board[action.from[0]][action.from[1]]=null;next.board[action.to[0]][action.to[1]]=piece;next.moveNumber++;next.lastMove={from:action.from.slice(),to:action.to.slice(),capture:capture?{...capture}:null};next.current=player^1;
    if(capture&&capture.t==='k'){next.terminal=true;next.winner=player;next.reason='GENERAL_CAPTURED';next.check=false;}
    else{next.check=isCheck(next,next.current);if(getLegalActions(next,next.current).length===0){next.terminal=true;next.winner=player;next.reason=next.check?'CHECKMATE':'STALEMATE';}}
    return{ok:true,state:next,event:{type:'move',player,from:action.from.slice(),to:action.to.slice(),capture:capture?{...capture}:null,check:next.check,terminal:next.terminal,winner:next.winner,reason:next.reason}};
  }
  function isTerminal(state){return!!(state&&state.terminal);}
  function getResult(state){return!isTerminal(state)?null:{winner:state.winner,loser:state.winner^1,reason:state.reason};}
  function serialize(state){return JSON.stringify(state);}
  function deserialize(value){const parsed=typeof value==='string'?JSON.parse(value):value;if(!parsed||parsed.protocol!==PROTOCOL||!Array.isArray(parsed.board)||parsed.board.length!==ROWS)throw new Error('invalid_xiangqi_state');return cloneState(parsed);}
  function hashState(state){const text=serialize(state);let hash=2166136261>>>0;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}return hash.toString(16).padStart(8,'0');}

  return{PROTOCOL,ROWS,COLS,createInitialState,validateAction,applyAction,getLegalActions,isTerminal,getResult,serialize,deserialize,hashState,isCheck,findGeneral,legalMovesForPiece};
});
