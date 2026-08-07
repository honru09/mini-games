'use strict';

const {TournamentOrchestrator}=require('../server/gameplay/tournament');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}
const t=new TournamentOrchestrator({tournamentId:'auto-tour',gameId:'xiangqi',participants:['u1','u2','u3']});t.start();
const first=t.snapshot().pairings[0];
const room=t.attachMatchRoom(first.pairingId,'auto-room-1',{source:'tournament',gameId:'xiangqi'});
check('Tournament Auto：Pairing 携带 tournament/round/pairing/room/source 合同',room.ok&&room.pairing.tournamentId==='auto-tour'&&room.pairing.roundId===1&&room.pairing.pairingId===first.pairingId&&room.pairing.matchRoomId==='auto-room-1'&&room.pairing.source==='tournament');
const manual=t.reportResult(first.matchId,{winner:first.players[0],source:'manual'});
check('Tournament Auto：自动桌拒绝手工结果',manual.ok===false&&manual.reason==='server_result_required');
const server=t.reportServerResult('auto-room-1',{winnerSlot:0},{source:'server',matchRoomId:'auto-room-1'});
check('Tournament Auto：单盘 Server Result 自动回传赛事积分',server.ok&&server.state.results.some(item=>item.matchRoomId==='auto-room-1'&&item.source==='tournament'));
check('Tournament Auto：审计记录房间创建与服务端结果',t.snapshot().auditLog.some(item=>item.action==='room_created')&&t.snapshot().auditLog.some(item=>item.action==='result_recorded'&&item.source==='server'));
if(failures.length){console.error('TOURNAMENT_AUTO_ROOM_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('TOURNAMENT_AUTO_ROOM_ALL_PASS');
