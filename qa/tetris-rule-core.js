'use strict';

const Rules=require('../shared/rules/tetris');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

const first=Rules.createInitialState({seed:'deterministic-seed',player:0});
const firstBag=[first.active.kind,...first.queue.slice(0,6)];
check('Tetris Rule Core：确定性 7-Bag 前七块不重复',new Set(firstBag).size===7,JSON.stringify(firstBag));

const actions=Array.from({length:18},(_,index)=>index%4===0?{type:'rotate_cw'}:{type:'hard_drop'});
function runStream(){let state=Rules.createInitialState({seed:'replay-seed',player:1});for(const action of actions){const result=Rules.applyAction(state,action);if(!result.ok||result.state.terminal)break;state=result.state;}return state;}
const replayA=runStream(),replayB=runStream();
check('Tetris Rule Core：相同 Seed + Input Stream 生成相同 Hash',Rules.hashState(replayA)===Rules.hashState(replayB));

let lineState=Rules.createInitialState({seed:'line-clear',player:0});
lineState.board=Array.from({length:Rules.ROWS},()=>Array(Rules.COLS).fill(0));
for(let row=Rules.ROWS-4;row<Rules.ROWS;row++)for(let col=1;col<Rules.COLS;col++)lineState.board[row][col]=1;
lineState.active={kind:0,rotation:1,x:0,y:0};
const tetris=Rules.applyAction(lineState,{type:'hard_drop'});
check('Tetris Rule Core：碰撞/锁定/四消/攻击统一计算',tetris.ok&&tetris.event.cleared===4&&tetris.event.attackBreakdown.base===Rules.TETRIS_ATTACK_CONFIG.lines[4],JSON.stringify(tetris.event));
check('Tetris Rule Core：四消后空井识别 Perfect Clear',tetris.event.perfectClear===true&&tetris.event.attackBreakdown.perfectClear===10&&tetris.event.perfectClearBonus===2000,JSON.stringify(tetris.event));

const firstTetris=Rules.resolveLockScore({lines:0,level:1,combo:-1,backToBack:false,backToBackCount:0},{cleared:4});
const secondTetris=Rules.resolveLockScore({lines:4,level:1,combo:firstTetris.combo,backToBack:firstTetris.backToBack,backToBackCount:firstTetris.backToBackCount},{cleared:4});
check('Tetris Rule Core：连续困难消行形成 B2B 并增加攻击',firstTetris.backToBack&&!firstTetris.backToBackBonus&&secondTetris.backToBackBonus&&secondTetris.backToBackCount===2&&secondTetris.attackBreakdown.backToBack===1,JSON.stringify(secondTetris));
check('Tetris Rule Core：连续消行形成 Combo 计分与攻击',firstTetris.combo===0&&secondTetris.combo===1&&secondTetris.comboBonus===50&&secondTetris.attackBreakdown.combo===0,JSON.stringify(secondTetris));
const comboThird=Rules.resolveLockScore({lines:8,level:1,combo:1,backToBack:true,backToBackCount:2},{cleared:2});
const comboReset=Rules.resolveLockScore({lines:10,level:2,combo:comboThird.combo,backToBack:false,backToBackCount:0},{cleared:0});
check('Tetris Rule Core：第三次连续消行产生 Combo Attack，无消行后重置',comboThird.combo===2&&comboThird.attackBreakdown.combo===1&&comboReset.combo===-1,JSON.stringify({comboThird,comboReset}));

let spinState=Rules.createInitialState({seed:'t-spin',player:0});
spinState.board=Array.from({length:Rules.ROWS},()=>Array(Rules.COLS).fill(0));
spinState.board[16][4]=1;spinState.active={kind:6,rotation:0,x:4,y:16};spinState.lastAction='rotate';
check('Tetris Rule Core：T 方块旋转中心三角占用识别 T-Spin',Rules.detectTSpin(spinState.board,spinState.active,spinState.lastAction)===true);
const tSpinZero=Rules.applyAction(spinState,{type:'soft_drop'});
check('Tetris Rule Core：T-Spin Zero 产生稳定类型与计分',tSpinZero.ok&&tSpinZero.event.tSpin===true&&tSpinZero.event.clearType==='t-spin-zero'&&tSpinZero.event.scoreDelta===400,JSON.stringify(tSpinZero.event));

let holdState=Rules.createInitialState({seed:'hold',player:0});
const held=Rules.applyAction(holdState,{type:'hold'}),heldTwice=Rules.applyAction(held.state,{type:'hold'});
check('Tetris Rule Core：同一方块生命周期只能 Hold 一次',held.ok&&!heldTwice.ok&&heldTwice.reason==='ERR_INVALID_MOVE');

let garbageA=Rules.createInitialState({seed:'garbage',player:0}),garbageB=Rules.createInitialState({seed:'garbage',player:0});
garbageA=Rules.applyAction(garbageA,{type:'garbage',lines:4,attackId:'attack-1'}).state;
garbageB=Rules.applyAction(garbageB,{type:'garbage',lines:4,attackId:'attack-1'}).state;
check('Tetris Rule Core：Garbage Hole 对同 Seed/Attack 确定',Rules.hashState(garbageA)===Rules.hashState(garbageB));

const serialized=Rules.serialize(garbageA),restored=Rules.deserialize(serialized);
check('Tetris Rule Core：序列化/反序列化保持状态 Hash',Rules.hashState(garbageA)===Rules.hashState(restored));
check('Tetris Rule Core：纯规则模块不依赖 DOM',!String(require('fs').readFileSync(require('path').join(__dirname,'../shared/rules/tetris.js'),'utf8')).match(/\bdocument\b|\bwindow\b|HTMLElement|Canvas|Audio/));

if(failures.length){console.error('TETRIS_RULE_CORE_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('TETRIS_RULE_CORE_ALL_PASS');
