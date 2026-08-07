'use strict';

const Rules=require('../shared/rules/xiangqi');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}
function emptyState(){const state=Rules.createInitialState();state.board=Array.from({length:10},()=>Array(9).fill(null));state.current=0;return state;}

const initial=Rules.createInitialState();
check('Xiangqi Rule Core：初始局面合法动作可枚举',Rules.getLegalActions(initial).length===44,String(Rules.getLegalActions(initial).length));

let horse=Rules.createInitialState();horse.board[8][1]={p:0,t:'p'};
check('Xiangqi Rule Core：马腿阻挡由规则核心拒绝',!Rules.validateAction(horse,{type:'move',from:[9,1],to:[7,0]},0).ok);
let elephant=Rules.createInitialState();elephant.board[8][1]={p:0,t:'p'};
check('Xiangqi Rule Core：象眼阻挡由规则核心拒绝',!Rules.validateAction(elephant,{type:'move',from:[9,2],to:[7,0]},0).ok);

let cannon=emptyState();cannon.board[9][4]={p:0,t:'k'};cannon.board[0][4]={p:1,t:'k'};cannon.board[5][4]={p:0,t:'p'};cannon.board[7][1]={p:0,t:'c'};cannon.board[5][1]={p:0,t:'p'};cannon.board[2][1]={p:1,t:'r'};
check('Xiangqi Rule Core：炮隔一子吃子合法',Rules.validateAction(cannon,{type:'move',from:[7,1],to:[2,1]},0).ok);
cannon.board[5][1]=null;
check('Xiangqi Rule Core：炮无炮架吃子被拒绝',!Rules.validateAction(cannon,{type:'move',from:[7,1],to:[2,1]},0).ok);

let face=emptyState();face.board[9][4]={p:0,t:'k'};face.board[0][4]={p:1,t:'k'};face.board[5][4]={p:0,t:'r'};
check('Xiangqi Rule Core：暴露将帅照面动作被拒绝',!Rules.validateAction(face,{type:'move',from:[5,4],to:[5,3]},0).ok);
check('Xiangqi Rule Core：帅不能走出九宫',!Rules.validateAction(initial,{type:'move',from:[9,4],to:[9,6]},0).ok);
check('Xiangqi Rule Core：兵不能后退',!Rules.validateAction(initial,{type:'move',from:[6,0],to:[7,0]},0).ok);

let capture=emptyState();capture.board[9][4]={p:0,t:'k'};capture.board[0][4]={p:1,t:'k'};
const terminal=Rules.applyAction(capture,{type:'move',from:[9,4],to:[0,4]},0);
check('Xiangqi Rule Core：飞将捕获产生唯一终局',terminal.ok&&Rules.isTerminal(terminal.state)&&Rules.getResult(terminal.state).winner===0,JSON.stringify(terminal));

const restored=Rules.deserialize(Rules.serialize(initial));
check('Xiangqi Rule Core：序列化/反序列化保持状态 Hash',Rules.hashState(initial)===Rules.hashState(restored));
check('Xiangqi Rule Core：纯规则模块不依赖 DOM',!String(require('fs').readFileSync(require('path').join(__dirname,'../shared/rules/xiangqi.js'),'utf8')).match(/\bdocument\b|\bwindow\b|HTMLElement|Canvas|Audio/));

if(failures.length){console.error('XIANGQI_RULE_CORE_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('XIANGQI_RULE_CORE_ALL_PASS');
