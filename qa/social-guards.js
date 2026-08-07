'use strict';

const {
  SpectatorAccessGuard,
  SpectatorSnapshotGuard,
  DelayedSnapshotBuffer,
  TournamentGuard,
} = require('../server/gameplay/guards');

function assert(name,value){
  console.log((value ? 'PASS' : 'FAIL') + '  ' + name);
  if (!value) process.exitCode = 1;
}

const access = new SpectatorAccessGuard({maxSpectators:2});
assert('Spectator：未开始对局不能加入观众席',
  access.join({sessionId:'s0',uid:'u0',roomId:'ROOMA',started:false}).reason === 'match_not_started');
assert('Spectator：跨房观战必须显式离开原房间',
  access.join({sessionId:'s0',uid:'u0',roomId:'ROOMA',started:true,matchId:'m1'}).ok &&
  access.join({sessionId:'s0',uid:'u0',roomId:'ROOMB',started:true,matchId:'m2'}).reason === 'cross_room_join');
assert('Spectator：同账号多连接不能占用多个观众席',
  access.join({sessionId:'s1',uid:'u0',roomId:'ROOMA',started:true,matchId:'m1'}).reason === 'duplicate_spectator_identity');
assert('Spectator：观战中不能通过普通 Join 或邀请占用玩家席位',
  access.canOccupyPlayerSeat({sessionId:'s0',uid:'u0',currentSpectatorRoomId:'ROOMA'}).reason === 'spectator_active' &&
  access.canOccupyPlayerSeat({sessionId:'s1',uid:'u0'}).reason === 'account_spectating');
assert('Spectator：参赛账号不能同时进入观众席',
  access.join({sessionId:'s2',uid:'u2',roomId:'ROOMA',started:true,matchId:'m1',targetPlayerUids:['u2']}).reason === 'account_is_player');
assert('Spectator：错误 matchId 被拒绝',
  access.join({sessionId:'s3',uid:'u3',roomId:'ROOMA',started:true,matchId:'m1',requestedMatchId:'old'}).reason === 'invalid_match');
assert('Spectator：观众容量由服务端限制',
  access.join({sessionId:'s2',uid:'u2',roomId:'ROOMA',started:true,matchId:'m1'}).ok &&
  access.join({sessionId:'s3',uid:'u3',roomId:'ROOMA',started:true,matchId:'m1'}).reason === 'spectator_capacity');
assert('Spectator：离开后席位可回收', access.leave('s0') && access.join({sessionId:'s3',uid:'u3',roomId:'ROOMA',started:true,matchId:'m1'}).ok);

const delayed = new SpectatorSnapshotGuard({maxSpectators:3});
const live = {matchId:'m-delay',revision:2,board:'live'};
assert('Spectator：Join Snapshot 的 matchId 不一致时回滚 Guard 席位',
  delayed.join({sessionId:'bad-live',uid:'bad-live-u',roomId:'ROOMD',started:true,matchId:'m-delay',delayMs:0,now:900,liveSnapshot:{matchId:'forged'}}).reason === 'invalid_match' &&
  delayed.access.roomSpectators('ROOMD').length === 0);
delayed.record('ROOMD',{matchId:'m-delay',revision:1,board:'old'},1000,{delayMs:1000});
delayed.record('ROOMD',live,1500,{delayMs:1000});
assert('Spectator：延迟快照未到时不泄露 live state',
  delayed.join({sessionId:'d0',uid:'du0',roomId:'ROOMD',started:true,matchId:'m-delay',delayMs:1000,now:1800,liveSnapshot:live}).reason === 'snapshot_not_ready');
const delayedJoin = delayed.join({sessionId:'d1',uid:'du1',roomId:'ROOMD',started:true,matchId:'m-delay',delayMs:1000,now:2600,liveSnapshot:live});
assert('Spectator：达到延迟窗口后返回历史快照',
  delayedJoin.ok && delayedJoin.initialSnapshot.revision === 2);
assert('Spectator：不同 matchId 的历史快照不能串房',
  delayed.join({sessionId:'d2',uid:'du2',roomId:'ROOMD',started:true,matchId:'new-match',delayMs:1000,now:2600,liveSnapshot:{matchId:'new-match'}}).reason === 'snapshot_not_ready');
const buffer = new DelayedSnapshotBuffer({delayMs:500,maxEntries:4});
const immutableSnapshot={matchId:'x',n:1};buffer.push(immutableSnapshot,1000);immutableSnapshot.n=999;buffer.push({matchId:'x',n:2},1300);
assert('Spectator：延迟队列按 server time 输出且只消费到期项',
  buffer.latest(1700,'x').n === 1 && buffer.due(1800,'x').length === 2 && buffer.latest(1800,'x') === null);

const tournaments = new TournamentGuard({maxActive:1,maxParticipants:4,maxPerOwner:1,ttlMs:1000,maxLifetimeMs:3000});
assert('Tournament：游戏白名单拒绝未知游戏',
  tournaments.create({tournamentId:'tour_bad',ownerUid:'u1',gameId:'snake',participants:['u1','u2','u3'],now:0}).reason === 'game_not_allowed');
assert('Tournament：参与人数/创建者约束生效',
  tournaments.create({tournamentId:'tour_bad2',ownerUid:'u9',gameId:'gomoku',participants:['u1','u2','u3'],now:0}).reason === 'invalid_participants');
assert('Tournament：重复参与者不能通过归一化绕过校验',
  tournaments.create({tournamentId:'tour_dup',ownerUid:'u1',gameId:'gomoku',participants:['u1','u2','u2','u3'],now:0}).reason === 'invalid_participants');
const created = tournaments.create({tournamentId:'tour_ok',ownerUid:'u1',gameId:'gomoku',participants:['u1','u2','u3'],now:0});
assert('Tournament：创建后默认仅创建者同意',
  created.ok && created.state.status === 'waiting' && created.state.consents.u1 === true && created.state.consents.u2 === false);
assert('Tournament：未全员同意不能开始', tournaments.start('tour_ok','u1',100).reason === 'consent_required');
assert('Tournament：非参与者不能伪造同意', tournaments.consent('tour_ok','attacker',true,100).reason === 'not_participant');
tournaments.consent('tour_ok','u2',true,120);tournaments.consent('tour_ok','u3',true,140);
assert('Tournament：全员同意后才能开始', tournaments.start('tour_ok','u1',160).ok);
assert('Tournament：同一所有者/全局活动数有上限',
  tournaments.create({tournamentId:'tour_over',ownerUid:'u1',gameId:'gomoku',participants:['u1','u2','u3'],now:170}).reason === 'owner_capacity' &&
  tournaments.create({tournamentId:'tour_over2',ownerUid:'u4',gameId:'gomoku',participants:['u4','u5','u6'],now:170}).reason === 'tournament_capacity');
assert('Tournament：绑定前不能上报结果', tournaments.authorizeResult('tour_ok','p1',{matchId:'m123456',gameId:'gomoku',players:['u1','u2'],source:'room_authority'},200).reason === 'match_not_bound');
assert('Tournament：配对只接受赛事参与者', tournaments.registerPairing('tour_ok','p1',['u1','attacker'],210).reason === 'invalid_pairing');
tournaments.registerPairing('tour_ok','p1',['u1','u2'],220);
assert('Tournament：重复席位不能伪造配对', tournaments.registerPairing('tour_ok','p_dup',['u1','u1'],225).reason === 'invalid_pairing');
assert('Tournament：绑定必须使用白名单游戏及精确席位',
  tournaments.bindMatch('tour_ok','p1',{matchId:'m123456',gameId:'xiangqi',players:['u1','u2']},230).reason === 'game_mismatch' &&
  tournaments.bindMatch('tour_ok','p1',{matchId:'m123456',gameId:'gomoku',players:['u1','u3']},230).reason === 'players_mismatch');
const binding = tournaments.bindMatch('tour_ok','p1',{matchId:'m123456',gameId:'gomoku',players:['u2','u1']},240);
assert('Tournament：服务端绑定真实 matchId 后才可授权结果', binding.ok && binding.binding.matchId === 'm123456');
assert('Tournament：任意 matchId 跳转被拒绝', tournaments.authorizeResult('tour_ok','p1',{matchId:'other123',gameId:'gomoku',players:['u1','u2'],source:'room_authority'},250).reason === 'match_mismatch');
assert('Tournament：非权威来源被拒绝', tournaments.authorizeResult('tour_ok','p1',{matchId:'m123456',gameId:'gomoku',players:['u1','u2'],source:'client'},250).reason === 'untrusted_result_source');
assert('Tournament：绑定席位和 matchId 一致才结算', tournaments.authorizeResult('tour_ok','p1',{matchId:'m123456',gameId:'gomoku',players:['u1','u2'],source:'room_authority'},260).ok);
assert('Tournament：结果重复提交幂等拒绝', tournaments.authorizeResult('tour_ok','p1',{matchId:'m123456',gameId:'gomoku',players:['u1','u2'],source:'room_authority'},270).reason === 'duplicate_result');
assert('Tournament：TTL 到期后赛事不可访问', tournaments.snapshot('tour_ok',4000) === null || tournaments.snapshot('tour_ok',4000).status === 'expired');

if (!process.exitCode) console.log('SOCIAL_GUARDS_ALL_PASS');
