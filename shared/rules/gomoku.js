'use strict';

(function expose(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.GomokuRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createGomokuRules(){
  const SIZE=15,PROTOCOL='gomoku-rule-v1';
  const DIRECTIONS=Object.freeze([[1,0],[0,1],[1,1],[1,-1]].map(value=>Object.freeze(value)));

  function emptyBoard(){return Array.from({length:SIZE},()=>Array(SIZE).fill(-1));}
  function cloneBoard(board){return board.map(row=>row.slice());}
  function cloneLine(line){return Array.isArray(line)?line.map(cell=>cell.slice(0,2)):[];}
  function createInitialState(){return{protocol:PROTOCOL,board:emptyBoard(),current:0,moveNumber:0,last:null,terminal:false,winner:-1,reason:null,winLine:[]};}
  function cloneState(state){return{protocol:PROTOCOL,board:cloneBoard(state.board),current:state.current,moveNumber:state.moveNumber,last:Array.isArray(state.last)?state.last.slice(0,2):null,terminal:!!state.terminal,winner:Number.isInteger(state.winner)?state.winner:-1,reason:state.reason||null,winLine:cloneLine(state.winLine)};}
  function validCoordinate(value){return Number.isInteger(value)&&value>=0&&value<SIZE;}
  function validPlayer(value){return value===0||value===1;}
  function winningLine(board,row,col){
    const player=board&&board[row]&&board[row][col];if(!validPlayer(player))return[];
    for(const [dr,dc] of DIRECTIONS){
      const before=[],after=[];
      let r=row-dr,c=col-dc;
      while(r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[r][c]===player){before.unshift([r,c]);r-=dr;c-=dc;}
      r=row+dr;c=col+dc;
      while(r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[r][c]===player){after.push([r,c]);r+=dr;c+=dc;}
      const line=before.concat([[row,col]],after);if(line.length>=5)return line;
    }
    return[];
  }
  function validateAction(state,action,player=state&&state.current){
    if(!state||state.protocol!==PROTOCOL||state.terminal)return{ok:false,reason:'ERR_MATCH_FINISHED'};
    if(!validPlayer(player)||player!==state.current)return{ok:false,reason:'ERR_NOT_ACTIVE_PLAYER'};
    if(!action||action.type!=='place'||!validCoordinate(action.row)||!validCoordinate(action.col))return{ok:false,reason:'ERR_INVALID_MOVE'};
    if(!Array.isArray(state.board)||!state.board[action.row]||state.board[action.row][action.col]!==-1)return{ok:false,reason:'ERR_INVALID_MOVE'};
    return{ok:true};
  }
  function applyAction(state,action,player=state&&state.current){
    const validation=validateAction(state,action,player);if(!validation.ok)return validation;
    const next=cloneState(state),row=action.row,col=action.col;
    next.board[row][col]=player;next.moveNumber++;next.last=[row,col];
    const line=winningLine(next.board,row,col);
    if(line.length>=5){next.terminal=true;next.winner=player;next.reason='FIVE_IN_A_ROW';next.winLine=line;}
    else if(next.moveNumber===SIZE*SIZE){next.terminal=true;next.winner=-1;next.reason='BOARD_FULL';next.winLine=[];}
    else next.current=player^1;
    return{ok:true,state:next,event:{type:'place',player,row,col,moveNumber:next.moveNumber,current:next.current,terminal:next.terminal,winner:next.winner,reason:next.reason,winLine:cloneLine(next.winLine)}};
  }
  function getLegalActions(state,player=state&&state.current){
    if(!state||state.protocol!==PROTOCOL||state.terminal||player!==state.current)return[];
    const actions=[];for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++)if(state.board[row][col]===-1)actions.push({type:'place',row,col});return actions;
  }
  function isTerminal(state){return!!(state&&state.terminal);}
  function getResult(state){if(!isTerminal(state))return null;return state.winner<0?{draw:true,winner:-1,order:[0,1],reason:state.reason}:{draw:false,winner:state.winner,loser:state.winner^1,order:[state.winner,state.winner^1],reason:state.reason};}
  function serialize(state){return JSON.stringify(state);}
  function validBoard(board){return Array.isArray(board)&&board.length===SIZE&&board.every(row=>Array.isArray(row)&&row.length===SIZE&&row.every(cell=>cell===-1||cell===0||cell===1));}
  function boardHasWinningLine(board){
    for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE;col++)if(board[row][col]!==-1&&winningLine(board,row,col).length>=5)return true;
    return false;
  }
  function deserialize(value){
    const parsed=typeof value==='string'?JSON.parse(value):value;
    if(!parsed||parsed.protocol!==PROTOCOL||!validBoard(parsed.board)||!validPlayer(parsed.current)||!Number.isInteger(parsed.moveNumber)||parsed.moveNumber<0||parsed.moveNumber>SIZE*SIZE)throw new Error('invalid_gomoku_state');
    const occupied=parsed.board.reduce((sum,row)=>sum+row.filter(cell=>cell!==-1).length,0);
    if(occupied!==parsed.moveNumber||!Number.isInteger(parsed.winner)||parsed.winner< -1||parsed.winner>1||!Array.isArray(parsed.winLine))throw new Error('invalid_gomoku_state');
    const black=parsed.board.reduce((sum,row)=>sum+row.filter(cell=>cell===0).length,0),white=occupied-black;
    if(black<white||black>white+1)throw new Error('invalid_gomoku_state');
    if(parsed.last!==null&&(!Array.isArray(parsed.last)||parsed.last.length!==2||!validCoordinate(parsed.last[0])||!validCoordinate(parsed.last[1])||parsed.board[parsed.last[0]][parsed.last[1]]===-1))throw new Error('invalid_gomoku_state');
    const state=cloneState(parsed);
    const expectedLast=occupied?((occupied-1)%2):null;
    if((occupied===0&&state.last!==null)||(occupied>0&&(!state.last||state.board[state.last[0]][state.last[1]]!==expectedLast)))throw new Error('invalid_gomoku_state');
    if(!state.terminal){
      if(state.winner!==-1||state.reason!==null||state.winLine.length||state.current!==occupied%2)throw new Error('invalid_gomoku_state');
      if(boardHasWinningLine(state.board))throw new Error('invalid_gomoku_state');
    }else if(state.reason==='FIVE_IN_A_ROW'){
      const actual=state.last?winningLine(state.board,state.last[0],state.last[1]):[];
      if(!validPlayer(state.winner)||state.winner!==expectedLast||state.current!==state.winner||actual.length<5||JSON.stringify(actual)!==JSON.stringify(state.winLine))throw new Error('invalid_gomoku_state');
      const previous=cloneBoard(state.board);previous[state.last[0]][state.last[1]]=-1;
      if(boardHasWinningLine(previous))throw new Error('invalid_gomoku_state');
    }else if(state.reason==='BOARD_FULL'){
      if(occupied!==SIZE*SIZE||state.winner!==-1||state.current!==expectedLast||state.winLine.length)throw new Error('invalid_gomoku_state');
      if(boardHasWinningLine(state.board))throw new Error('invalid_gomoku_state');
    }else throw new Error('invalid_gomoku_state');
    return state;
  }
  function hashState(state){const text=serialize(state);let hash=2166136261>>>0;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}return hash.toString(16).padStart(8,'0');}

  return{PROTOCOL,SIZE,createInitialState,validateAction,applyAction,getLegalActions,isTerminal,getResult,serialize,deserialize,hashState,winningLine};
});
