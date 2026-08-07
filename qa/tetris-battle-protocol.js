'use strict';

const { TetrisBattleAuthority, ATTACK_CONFIG } = require('../server/gameplay/tetris-battle');
const failures=[];
function check(name,condition,detail){console.log((condition?'PASS':'FAIL')+'  '+name+(condition||!detail?'':' :: '+detail));if(!condition)failures.push(name);}
const MATCH_ID='tetris-authority-test';
function claim(seq,placementSeq,linesCleared,attackId,extra={}){return{matchId:extra.matchId||MATCH_ID,seq,placementSeq,linesCleared,attack:ATTACK_CONFIG[linesCleared],attackId,score:extra.score||0,lines:extra.lines===undefined?linesCleared:extra.lines,boardHeight:extra.boardHeight||0,piece:extra.piece===undefined?0:extra.piece,x:extra.x===undefined?3:extra.x,y:extra.y===undefined?16:extra.y,rot:extra.rot===undefined?0:extra.rot};}

const battle=new TetrisBattleAuthority({matchId:MATCH_ID,playerCount:3,startAt:1000,matchEndAt:100000,matchSeed:'seed'});
const first=battle.claimLock(1,claim(1,1,3,'p1-a1'),2000);
check('Tetris Protocol：Server 决定 Alive Ring 目标',first.ok&&first.event.target===2&&first.event.amount===2);
check('Tetris Protocol：Duplicate attackId/seq 不重复 Garbage',battle.claimLock(1,claim(1,1,3,'p1-a1'),2010).reason==='stale_seq'&&battle.players[2].incoming.length===1);

const cancel=battle.claimLock(2,claim(1,1,4,'p2-a1'),2100);
check('Tetris Protocol：Garbage Cancel 由 Server 统一计算',cancel.ok&&cancel.event.cancelled===2&&cancel.event.amount===2&&cancel.event.target===0);
check('Tetris Protocol：Reconnect Snapshot 保留 Incoming',battle.snapshot().players[0].incoming.length===1&&battle.snapshot().players[0].incoming[0].attackId==='p2-a1');

const ko=battle.claimKO(1,{matchId:MATCH_ID,seq:2},2200);
check('Tetris Protocol：Server 确认 KO 并给出 placement',ko.ok&&ko.event.placement===3&&!battle.players[1].alive);
check('Tetris Protocol：Dead Player 不能继续攻击',battle.claimLock(1,claim(3,2,4,'p1-dead'),2300).reason==='dead_player');
check('Tetris Protocol：目标 KO 后 Alive Ring 自动跳过',battle.targetFor(0)===2&&battle.targetFor(2)===0);

const due=battle.advance(3000);
check('Tetris Protocol：到期 Garbage 只投递一次且已投递项清理',due.length===1&&battle.advance(3100).length===0&&battle.players.every(player=>player.incoming.every(item=>!item.delivered))&&battle.players[2].incoming.length===0);
const last=battle.claimKO(2,{matchId:MATCH_ID,seq:2},3200);
check('Tetris Protocol：Last Survivor 与最终唯一名次由 Server 产生',last.ok&&battle.finished&&battle.order[0]===0&&new Set(battle.players.map(player=>player.placement)).size===3,JSON.stringify(battle.result()));

const invalid=new TetrisBattleAuthority({matchId:'invalid',playerCount:2,startAt:1,matchEndAt:10000});
check('Tetris Protocol：伪造攻击值被拒绝',invalid.claimLock(0,{...claim(1,1,1,'bad-attack',{matchId:'invalid'}),attack:4},100).reason==='invalid_attack');
check('Tetris Protocol：错误 matchId 被拒绝',invalid.claimLock(0,claim(1,1,1,'wrong'),100).reason==='invalid_match');
check('Tetris Protocol：piece/坐标白名单被拒绝',invalid.claimLock(0,claim(1,1,1,'bad-piece',{matchId:'invalid',piece:99}),100).reason==='invalid_piece');

const presentation=new TetrisBattleAuthority({matchId:'presentation',playerCount:2,startAt:1,matchEndAt:10000});
const well=Array.from({length:18},()=>Array(10).fill(0));
const presentState={well,active:{kind:6,rotation:0,x:3,y:-1},queue:[0,1,2,3],bagIndex:0,hold:null,canHold:true,score:0,lines:0,tetrisCount:0,placementSeq:0};
const p1=presentation.acceptPresentation(0,{matchId:'presentation',seq:1,state:{...presentState,debug:'drop-me'}},100);
check('Tetris Protocol：展示状态严格白名单且拒绝未知字段',p1.reason==='invalid_state');
const p2=presentation.acceptPresentation(0,{matchId:'presentation',seq:1,state:presentState},100);
check('Tetris Protocol：展示状态合法载荷可接受',p2.ok&&p2.payload.state.active.kind===6&&!Object.prototype.hasOwnProperty.call(p2.payload.state,'debug'));
check('Tetris Protocol：展示 seq 必须单调',presentation.acceptPresentation(0,{matchId:'presentation',seq:1,state:presentState},101).reason==='stale_seq');
check('Tetris Protocol：恶意 active/queue/hold 被拒绝',presentation.acceptPresentation(0,{matchId:'presentation',seq:2,state:{...presentState,active:{kind:99,rotation:0,x:3,y:0}}},102).reason==='invalid_state'&&presentation.acceptPresentation(0,{matchId:'presentation',seq:3,state:{...presentState,queue:[99,1,2,3]}},102).reason==='invalid_state');

if(failures.length){console.error('TETRIS_PROTOCOL_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('TETRIS_PROTOCOL_ALL_PASS');
