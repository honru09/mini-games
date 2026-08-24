'use strict';

const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

let GomokuRuleAuthority=null;
try{({GomokuRuleAuthority}=require('../server/gameplay/gomoku-rule-authority'));}catch(error){console.error('FAIL  Gomoku Rule Authority 可加载 :: '+error.message);process.exit(1);}

const authority=new GomokuRuleAuthority({matchId:'gomoku-authority-test'});
const initial=authority.snapshot();
const malformed=authority.acceptMove(0,{matchId:'gomoku-authority-test',seq:1,row:null,col:false},999);
check('Gomoku Rule Authority：畸形坐标不被强制转换且不消耗 seq',!malformed.ok&&malformed.reason==='ERR_INVALID_MOVE'&&authority.lastSeq[0]===0&&authority.revision===0);
const illegal=authority.acceptMove(1,{matchId:'gomoku-authority-test',seq:1,row:7,col:7},1000);
check('Gomoku Rule Authority：非法回合不消耗动作序号或 Revision',
  !illegal.ok&&illegal.reason==='ERR_NOT_ACTIVE_PLAYER'&&authority.lastSeq[1]===0&&authority.revision===0&&authority.snapshot().hash===initial.hash);

const first=authority.acceptMove(0,{matchId:'gomoku-authority-test',seq:1,row:7,col:7},1010);
check('Gomoku Rule Authority：合法落子产出完整权威快照',
  first.ok&&first.event.type==='gomoku_rule_state'&&first.event.payload.protocol==='gomoku-rule-v1'&&first.event.payload.revision===1&&first.event.payload.board[7][7]===0&&first.event.payload.current===1);

const duplicate=authority.acceptMove(0,{matchId:'gomoku-authority-test',seq:1,row:8,col:8},1020);
check('Gomoku Rule Authority：重复动作序号被幂等拒绝',!duplicate.ok&&duplicate.reason==='ERR_DUPLICATE_ACTION'&&authority.revision===1);

const second=authority.acceptMove(1,{matchId:'gomoku-authority-test',seq:1,row:0,col:0},1030);
const undo=authority.undo(1,1040);
check('Gomoku Rule Authority：最后落子者可悔棋且 Revision 单调递增',
  second.ok&&undo.ok&&undo.event.payload.revision===3&&undo.event.payload.board[0][0]===-1&&undo.event.payload.current===1&&authority.lastSeq[1]===1);
const retryAfterUndo=authority.acceptMove(1,{matchId:'gomoku-authority-test',seq:2,row:0,col:1},1050);
check('Gomoku Rule Authority：悔棋不回退客户端序号并可继续',retryAfterUndo.ok&&authority.lastSeq[1]===2);

const terminal=new GomokuRuleAuthority({matchId:'gomoku-terminal'});
const sequence=[[0,7,7],[1,0,0],[0,7,8],[1,0,1],[0,7,9],[1,0,2],[0,7,10],[1,0,3],[0,7,11]];
let accepted=null,seq=[0,0];
for(const [player,row,col] of sequence)accepted=terminal.acceptMove(player,{matchId:'gomoku-terminal',seq:++seq[player],row,col},2000+seq[0]+seq[1]);
check('Gomoku Rule Authority：五连由服务端生成唯一终局与名次',
  accepted&&accepted.ok&&accepted.result&&accepted.result.type==='gomoku_result'&&accepted.result.order.join(',')==='0,1'&&accepted.result.stats.reason==='FIVE_IN_A_ROW'&&terminal.finished===true);
check('Gomoku Rule Authority：重连快照包含棋盘、回合、Last Seq、Revision 与 Hash',
  terminal.snapshot().matchId==='gomoku-terminal'&&terminal.snapshot().lastSeq.join(',')==='5,4'&&terminal.snapshot().moveNumber===9&&terminal.snapshot().hash);

const drawAuthority=new GomokuRuleAuthority({matchId:'gomoku-draw'}),drawPattern=Array.from({length:15},(_,row)=>Array.from({length:15},(_,col)=>((row+2*col)%4)<2?0:1));
const black=[],white=[];for(let row=0;row<15;row++)for(let col=0;col<15;col++){if(row===14&&col===13)continue;(drawPattern[row][col]===0?black:white).push([row,col]);}
let drawAccepted=null;
for(let index=0;index<white.length;index++){
  drawAccepted=drawAuthority.acceptMove(0,{matchId:'gomoku-draw',seq:index+1,row:black[index][0],col:black[index][1]},3000+index*2);
  if(!drawAccepted.ok)break;
  drawAccepted=drawAuthority.acceptMove(1,{matchId:'gomoku-draw',seq:index+1,row:white[index][0],col:white[index][1]},3001+index*2);
  if(!drawAccepted.ok)break;
}
drawAccepted=drawAuthority.acceptMove(0,{matchId:'gomoku-draw',seq:113,row:14,col:13},4000);
check('Gomoku Rule Authority：满盘和棋返回双第一且零币的可信结果',drawAccepted.ok&&drawAccepted.result&&drawAccepted.result.draw===true&&drawAccepted.result.results.every(item=>item.rank===1&&item.coins===0));

if(failures.length){console.error('GOMOKU_RULE_AUTHORITY_FAILED:',failures.join('、'));process.exitCode=1;}
else console.log('GOMOKU_RULE_AUTHORITY_ALL_PASS');
