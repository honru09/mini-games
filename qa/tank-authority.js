'use strict';

const { TankAuthority } = require('../server/gameplay/tank-sim');
const failures=[];
function check(name,condition,detail){console.log((condition?'PASS':'FAIL')+'  '+name+(condition||!detail?'':' :: '+detail));if(!condition)failures.push(name);}

const sim=new TankAuthority({matchId:'tank-authority-test',playerCount:2,startedAt:1000,durationMs:10000});
const first=sim.acceptInput(0,{matchId:'tank-authority-test',seq:1,clientTick:0,input:{right:true},x:999,y:999,kill:1},1050);
check('Tank Authority：接受自己的单调输入',first.ok&&first.ack===1);
const startX=sim.players[0].x;sim.advance(1150);
check('Tank Authority：服务器模拟位置且忽略客户端伪造坐标',sim.players[0].x>startX&&sim.players[0].x<10);
check('Tank Authority：重复 input seq 被拒绝',sim.acceptInput(0,{matchId:'tank-authority-test',seq:1,clientTick:1,input:{left:true}},1160).reason==='stale_seq');
check('Tank Authority：异常 future tick 被拒绝',sim.acceptInput(0,{matchId:'tank-authority-test',seq:2,clientTick:9999,input:{}},1160).reason==='invalid_tick');

sim.players[0].x=2.5;sim.players[0].y=2.5;sim.players[0].d=1;sim.players[0].input={up:false,right:false,down:false,left:false,fire:false};
sim.players[1].x=4.5;sim.players[1].y=2.5;sim.players[1].hp=1;sim.players[1].invulnerableUntil=0;
sim.acceptInput(0,{matchId:'tank-authority-test',seq:3,clientTick:sim.serverTick,input:{fire:true}},1200);
for(let now=1200;now<=1600;now+=50)sim.advance(now);
check('Tank Authority：Fire/CD/Projectile/Hit/Kill 由服务器产生',sim.players[0].shots===1&&sim.players[0].hits===1&&sim.players[0].kills===1&&sim.players[1].deaths===1,JSON.stringify(sim.snapshot(1600).players));
const respawnAt=sim.players[1].respawnAt;sim.advance(respawnAt+100);
check('Tank Authority：Respawn 与短暂无敌由服务器产生',sim.players[1].alive&&sim.players[1].hp===3&&sim.players[1].invulnerableUntil>respawnAt);
const snapshot=sim.snapshot(respawnAt+100);
check('Tank Authority：重连快照含比分/剩余时间/赛季/墙体',snapshot.players.length===2&&snapshot.remainingMs>=0&&snapshot.season&&snapshot.destructibles.length===13&&Array.isArray(snapshot.ack));

const forgedBefore=JSON.stringify(sim.players.map(player=>({kills:player.kills,deaths:player.deaths,x:player.x,y:player.y})));
sim.acceptInput(1,{matchId:'tank-authority-test',seq:1,clientTick:sim.serverTick,input:{},players:[{kills:999}],order:[1,0]},respawnAt+150);
const forgedAfter=JSON.stringify(sim.players.map(player=>({kills:player.kills,deaths:player.deaths,x:player.x,y:player.y})));
check('Tank Authority：客户端伪造 Kill/Order 不改变权威状态',forgedBefore===forgedAfter);

sim.finish();
check('Tank Authority：服务器生成唯一最终排名',sim.order.length===2&&new Set(sim.players.map(player=>player.placement)).size===2);

if(failures.length){console.error('TANK_AUTHORITY_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('TANK_AUTHORITY_ALL_PASS');
