'use strict';

const Rules=require('../shared/rules/monopoly');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

const a=Rules.createInitialState({seed:'same-seed',playerCount:3}),b=Rules.createInitialState({seed:'same-seed',playerCount:3});
const rollA=Rules.applyAction(a,{type:'roll'},0),rollB=Rules.applyAction(b,{type:'roll'},0);
check('Monopoly Rule Core：Server Seeded Dice 确定',rollA.ok&&rollB.ok&&Rules.hashState(rollA.state)===Rules.hashState(rollB.state),JSON.stringify(rollA.event));

let buy=Rules.createInitialState({seed:'a',playerCount:3});const landed=Rules.applyAction(buy,{type:'roll'},0);buy=landed.state;
check('Monopoly Rule Core：掷骰/移动/落地产进入购买阶段',buy.phase==='buy'&&buy.pendingProperty===buy.players[0].pos,JSON.stringify(landed.event));
const bought=Rules.applyAction(buy,{type:'buy'},0);
check('Monopoly Rule Core：购买同时更新现金、产权与回合',bought.ok&&bought.state.owners[buy.pendingProperty]===0&&bought.state.players[0].props.includes(buy.pendingProperty)&&bought.state.current===1);

let auction=Rules.createInitialState({seed:'a',playerCount:3});auction=Rules.applyAction(auction,{type:'roll'},0).state;const opened=Rules.applyAction(auction,{type:'pass'},0);const bid=Rules.applyAction(opened.state,{type:'bid',amount:300,revision:1,bidId:'bid-1'},1);const closed=Rules.applyAction(bid.state,{type:'close_auction'},0);
check('Monopoly Rule Core：Pass→Auction→Bid→Close 全链路权威',closed.ok&&closed.state.owners[auction.pendingProperty]===1&&closed.state.players[1].money===1700&&closed.state.current===1,JSON.stringify(closed.event));

let rent=Rules.createInitialState({seed:'rent',playerCount:2});const preview=Rules.applyAction(rent,{type:'roll'},0),sum=preview.event.events.find(event=>event.type==='roll').dice.reduce((x,y)=>x+y,0),propertyId=2;rent.players[0].pos=(propertyId-sum+Rules.CELLS.length)%Rules.CELLS.length;rent.owners[propertyId]=1;rent.players[1].props=[propertyId];const before0=rent.players[0].money,before1=rent.players[1].money,passed=rent.players[0].pos+sum>=Rules.CELLS.length;const paid=Rules.applyAction(rent,{type:'roll'},0),rentAmount=Rules.rentOf(Rules.CELLS[propertyId]);
check('Monopoly Rule Core：租金从付款方转入产权方',paid.state.players[0].money===before0-rentAmount+(passed?2000:0)&&paid.state.players[1].money===before1+rentAmount,JSON.stringify(paid.event));

const bankruptProperty=22;let bankrupt=Rules.createInitialState({seed:'rent',playerCount:2});bankrupt.players[0].pos=bankruptProperty-sum;bankrupt.players[0].money=0;bankrupt.owners[bankruptProperty]=1;bankrupt.players[1].props=[bankruptProperty];const eliminated=Rules.applyAction(bankrupt,{type:'roll'},0);
check('Monopoly Rule Core：现金不足触发破产、释放名次并终局',eliminated.state.terminal&&!eliminated.state.players[0].alive&&eliminated.state.winner===1);

const restored=Rules.deserialize(Rules.serialize(closed.state));
check('Monopoly Rule Core：序列化/反序列化保持状态 Hash',Rules.hashState(closed.state)===Rules.hashState(restored));
check('Monopoly Rule Core：纯规则模块不依赖 DOM',!String(require('fs').readFileSync(require('path').join(__dirname,'../shared/rules/monopoly.js'),'utf8')).match(/\bdocument\b|\bwindow\b|HTMLElement|Canvas|Audio/));

if(failures.length){console.error('MONOPOLY_RULE_CORE_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('MONOPOLY_RULE_CORE_ALL_PASS');
