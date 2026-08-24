'use strict';

const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

let Rules=null;
try{Rules=require('../shared/rules/gomoku');}catch(error){console.error('FAIL  Gomoku Rule Core 可加载 :: '+error.message);process.exit(1);}

const initial=Rules.createInitialState();
check('Gomoku Rule Core：初始盘为 15×15 且黑方先行',
  initial.protocol==='gomoku-rule-v1'&&initial.board.length===15&&initial.board.every(row=>row.length===15&&row.every(cell=>cell===-1))&&initial.current===0&&initial.moveNumber===0);

const wrongTurn=Rules.applyAction(initial,{type:'place',row:7,col:7},1);
check('Gomoku Rule Core：非当前玩家不能落子且输入状态不变',
  !wrongTurn.ok&&wrongTurn.reason==='ERR_NOT_ACTIVE_PLAYER'&&initial.board[7][7]===-1&&initial.moveNumber===0);

let state=initial;
const sequence=[
  [0,7,7],[1,0,0],[0,7,8],[1,0,1],[0,7,9],[1,0,2],[0,7,10],[1,0,3],[0,7,11],
];
for(const [player,row,col] of sequence){
  const applied=Rules.applyAction(state,{type:'place',row,col},player);
  if(!applied.ok){failures.push('Gomoku Rule Core：合法五连序列');break;}
  state=applied.state;
}
check('Gomoku Rule Core：连续五子产生服务端可判定终局',
  state.terminal===true&&state.winner===0&&state.reason==='FIVE_IN_A_ROW'&&Array.isArray(state.winLine)&&state.winLine.length===5);

function terminalFor(stones){
  let current=Rules.createInitialState(),whiteIndex=0;const whiteCells=[[14,0],[14,2],[14,4],[14,6],[14,8],[13,1]];
  for(let index=0;index<stones.length;index++){
    const black=stones[index],placed=Rules.applyAction(current,{type:'place',row:black[0],col:black[1]},0);if(!placed.ok)return null;current=placed.state;
    if(current.terminal)return current;
    const whiteCell=whiteCells[whiteIndex++];
    const white=Rules.applyAction(current,{type:'place',row:whiteCell[0],col:whiteCell[1]},1);if(!white.ok)return null;current=white.state;
  }
  return current;
}
const vertical=terminalFor([[2,2],[3,2],[4,2],[5,2],[6,2]]);
const diagonal=terminalFor([[2,3],[3,4],[4,5],[5,6],[6,7]]);
const antiDiagonal=terminalFor([[2,10],[3,9],[4,8],[5,7],[6,6]]);
check('Gomoku Rule Core：竖线与双斜线均按 >=5 判胜',[vertical,diagonal,antiDiagonal].every(item=>item&&item.terminal&&item.winner===0&&item.winLine.length===5));

const longLine=terminalFor([[7,3],[7,4],[7,6],[7,7],[7,8],[7,5]]);
check('Gomoku Rule Core：一步连接两侧棋组时允许自由规则长连',longLine&&longLine.terminal&&longLine.winLine.length===6);

const afterTerminal=Rules.applyAction(state,{type:'place',row:1,col:1},1);
check('Gomoku Rule Core：终局后拒绝继续落子',!afterTerminal.ok&&afterTerminal.reason==='ERR_MATCH_FINISHED');

let occupied=Rules.createInitialState();
occupied=Rules.applyAction(occupied,{type:'place',row:4,col:4},0).state;
const occupiedHash=Rules.hashState(occupied),occupiedRetry=Rules.applyAction(occupied,{type:'place',row:4,col:4},1);
check('Gomoku Rule Core：重复占位拒绝且哈希不变',
  !occupiedRetry.ok&&occupiedRetry.reason==='ERR_INVALID_MOVE'&&Rules.hashState(occupied)===occupiedHash&&occupied.current===1);

const strictInput=Rules.applyAction(Rules.createInitialState(),{type:'place',row:null,col:false},0);
check('Gomoku Rule Core：null/布尔/字符串坐标不会被强制转换为棋盘坐标',!strictInput.ok&&strictInput.reason==='ERR_INVALID_MOVE');

const drawBoard=Array.from({length:15},(_,row)=>Array.from({length:15},(_,col)=>((row+2*col)%4)<2?0:1));
drawBoard[14][13]=-1;
const drawReady=Rules.deserialize({protocol:'gomoku-rule-v1',board:drawBoard,current:0,moveNumber:224,last:[14,14],terminal:false,winner:-1,reason:null,winLine:[]});
const draw=Rules.applyAction(drawReady,{type:'place',row:14,col:13},0);
check('Gomoku Rule Core：满盘且无五连时产生和棋',draw.ok&&draw.state.terminal&&draw.state.winner===-1&&draw.state.reason==='BOARD_FULL'&&Rules.getResult(draw.state).draw===true);

const roundTrip=Rules.deserialize(Rules.serialize(occupied));
check('Gomoku Rule Core：序列化往返保持权威状态与稳定哈希',
  Rules.hashState(roundTrip)===occupiedHash&&roundTrip.board[4][4]===0&&roundTrip.current===1);

let malformedRejected=false;
try{Rules.deserialize({protocol:'gomoku-rule-v1',board:[[]],current:0});}catch(_error){malformedRejected=true;}
check('Gomoku Rule Core：畸形快照 fail-closed',malformedRejected);

const impossibleBoard=Array.from({length:15},()=>Array(15).fill(-1));
[[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[2,1],[2,2],[2,3]].forEach(([row,col])=>{impossibleBoard[row][col]=0;});
[[10,0],[10,2],[10,4],[10,6],[10,8],[11,1],[11,3],[11,5],[11,7]].forEach(([row,col])=>{impossibleBoard[row][col]=1;});
impossibleBoard[2][4]=0;
let postTerminalRejected=false;
try{Rules.deserialize({protocol:'gomoku-rule-v1',board:impossibleBoard,current:0,moveNumber:19,last:[2,4],terminal:true,winner:0,reason:'FIVE_IN_A_ROW',winLine:[[2,0],[2,1],[2,2],[2,3],[2,4]]});}catch(_error){postTerminalRejected=true;}
check('Gomoku Rule Core：终局前已存在五连的伪造快照 fail-closed',postTerminalRejected);

if(failures.length){console.error('GOMOKU_RULE_CORE_FAILED:',failures.join('、'));process.exitCode=1;}
else console.log('GOMOKU_RULE_CORE_ALL_PASS');
