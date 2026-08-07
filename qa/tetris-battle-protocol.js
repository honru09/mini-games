'use strict';

const { TetrisBattleAuthority, ATTACK_CONFIG } = require('../server/gameplay/tetris-battle');
const failures=[];
function check(name,condition,detail){console.log((condition?'PASS':'FAIL')+'  '+name+(condition||!detail?'':' :: '+detail));if(!condition)failures.push(name);}
function claim(seq,placementSeq,linesCleared,attackId,extra={}){return{seq,placementSeq,linesCleared,attack:ATTACK_CONFIG[linesCleared],attackId,score:extra.score||0,lines:extra.lines||linesCleared,boardHeight:extra.boardHeight||0};}

const battle=new TetrisBattleAuthority({matchId:'tetris-authority-test',playerCount:3,startAt:1000,matchEndAt:100000,matchSeed:'seed'});
const first=battle.claimLock(1,claim(1,1,3,'p1-a1'),2000);
check('Tetris Protocol：Server 决定 Alive Ring 目标',first.ok&&first.event.target===2&&first.event.amount===2);
check('Tetris Protocol：Duplicate attackId/seq 不重复 Garbage',battle.claimLock(1,claim(1,1,3,'p1-a1'),2010).reason==='stale_seq'&&battle.players[2].incoming.length===1);

const cancel=battle.claimLock(2,claim(1,1,4,'p2-a1'),2100);
check('Tetris Protocol：Garbage Cancel 由 Server 统一计算',cancel.ok&&cancel.event.cancelled===2&&cancel.event.amount===2&&cancel.event.target===0);
check('Tetris Protocol：Reconnect Snapshot 保留 Incoming',battle.snapshot().players[0].incoming.length===1&&battle.snapshot().players[0].incoming[0].attackId==='p2-a1');

const ko=battle.claimKO(1,{seq:2},2200);
check('Tetris Protocol：Server 确认 KO 并给出 placement',ko.ok&&ko.event.placement===3&&!battle.players[1].alive);
check('Tetris Protocol：Dead Player 不能继续攻击',battle.claimLock(1,claim(3,2,4,'p1-dead'),2300).reason==='dead_player');
check('Tetris Protocol：目标 KO 后 Alive Ring 自动跳过',battle.targetFor(0)===2&&battle.targetFor(2)===0);

const due=battle.advance(3000);
check('Tetris Protocol：到期 Garbage 只投递一次',due.length===1&&battle.advance(3100).length===0);
const last=battle.claimKO(2,{seq:2},3200);
check('Tetris Protocol：Last Survivor 与最终唯一名次由 Server 产生',last.ok&&battle.finished&&battle.order[0]===0&&new Set(battle.players.map(player=>player.placement)).size===3,JSON.stringify(battle.result()));

const invalid=new TetrisBattleAuthority({matchId:'invalid',playerCount:2,startAt:1,matchEndAt:10000});
check('Tetris Protocol：伪造攻击值被拒绝',invalid.claimLock(0,{...claim(1,1,1,'bad-attack'),attack:4},100).reason==='invalid_attack');

if(failures.length){console.error('TETRIS_PROTOCOL_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('TETRIS_PROTOCOL_ALL_PASS');
