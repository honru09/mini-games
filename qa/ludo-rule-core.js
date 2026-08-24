'use strict';
const R=require('../shared/rules/ludo');const failures=[];const check=(n,v)=>{console.log((v?'PASS':'FAIL')+'  '+n);if(!v)failures.push(n);};
let s=R.createInitialState(2);check('Ludo 初始 52 格与四枚棋子',s.protocol==='ludo-rule-v1'&&s.pids.join(',')==='0,2'&&s.tokens.every(x=>x.length===4));
const bad=R.applyAction(s,{type:'roll',dice:7},0);check('骰面越界拒绝且状态不变',!bad.ok&&s.revision===0);
const roll=R.applyAction(s,{type:'roll',dice:6},0);check('六点掷骰进入选子',roll.ok&&roll.state.phase==='pick'&&R.legalTokens(roll.state,0).length===4);
const move=R.applyAction(roll.state,{type:'move',token:0},0);check('起飞后回到下一回合或额外回合',move.ok&&move.state.tokens[0][0]===0&&move.state.phase==='roll'&&move.state.current===0);
const next=R.applyAction(move.state,{type:'roll',dice:1},0);const moved=R.applyAction(next.state,{type:'move',token:0},0);check('路径推进与回合切换',next.ok&&moved.ok&&moved.state.tokens[0][0]===1&&moved.state.current===1);
const round=R.deserialize(R.serialize(moved.state));check('快照序列化往返',round.tokens[0][0]===1&&R.hashState(round)===R.hashState(moved.state));
if(failures.length)process.exitCode=1;else console.log('LUDO_RULE_CORE_ALL_PASS');
