'use strict';
const { TournamentOrchestrator } = require('../server/gameplay/tournament');
const { TournamentGuard } = require('../server/gameplay/guards');

function assert(name,value){console.log((value?'PASS':'FAIL')+'  '+name);if(!value)process.exitCode=1;}
function playRound(tournament,drawFirst=false){
  const snapshot=tournament.snapshot();snapshot.pairings.forEach((pair,index)=>{
    const result=drawFirst&&index===0?{draw:true}:{winner:pair.players[(snapshot.round+index)%2]};
    const accepted=tournament.reportResult(pair.matchId,result);assert('Tournament：接受第 '+snapshot.round+' 轮桌 '+pair.table,accepted.ok);
  });
}
function run(count){
  const ids=Array.from({length:count},(_,i)=>'p'+(i+1));
  const tournament=new TournamentOrchestrator({tournamentId:'t'+count,gameId:'gomoku',participants:ids,rounds:3});
  tournament.start();
  while(tournament.status!=='finished'){
    assert(count+' 人赛事：多桌无重复玩家',new Set(tournament.pairings.flatMap(item=>item.players)).size===tournament.pairings.flatMap(item=>item.players).length);
    playRound(tournament,tournament.round===1);
    if(tournament.status==='round_complete')tournament.advance();
  }
  const state=tournament.snapshot(),pairs=state.results.filter(item=>!item.bye).map(item=>item.players.slice().sort().join('|'));
  assert(count+' 人赛事：完整生命周期结束',state.status==='finished'&&state.standings.length===count);
  assert(count+' 人赛事：排名确定且积分有效',state.standings.every((item,index)=>item.rank===index+1&&item.points>=0));
  if(count<=4)assert(count+' 人循环赛：每对只赛一次',new Set(pairs).size===count*(count-1)/2&&pairs.length===count*(count-1)/2);
  else {
    assert(count+' 人瑞士制：三轮完成',state.round===3);
    assert(count+' 人瑞士制：优先避免重复配对',new Set(pairs).size===pairs.length);
    if(count%2)assert(count+' 人瑞士制：Bye 公平',Math.max(...state.standings.map(item=>item.byes))<=1);
  }
  const restored=state;
  assert(count+' 人赛事：重连快照含桌位与积分',restored.protocol==='tournament-orchestrator-v1'&&Array.isArray(restored.results)&&Array.isArray(restored.standings));
}
[3,4,5,6].forEach(run);

const rollbackGuard=new TournamentGuard({maxActive:2,maxParticipants:4,maxPerOwner:2,ttlMs:10000,maxLifetimeMs:60000});
rollbackGuard.create({tournamentId:'tour_rollback',ownerUid:'u1',gameId:'gomoku',participants:['u1','u2','u3'],now:0});
rollbackGuard.consent('tour_rollback','u2',true,10);
rollbackGuard.consent('tour_rollback','u3',true,20);
rollbackGuard.start('tour_rollback','u1',30);
rollbackGuard.registerPairing('tour_rollback','pair_1',['u1','u2'],40);
rollbackGuard.bindMatch('tour_rollback','pair_1',{matchId:'match_rollback_1',gameId:'gomoku',players:['u1','u2']},50);
assert('Tournament：非服务端来源不能撤销真实绑定',
  rollbackGuard.unbindMatch('tour_rollback','pair_1',{matchId:'match_rollback_1',source:'client'},60).reason==='untrusted_rollback_source');
const rolledBack=rollbackGuard.unbindMatch('tour_rollback','pair_1',{matchId:'match_rollback_1',source:'server_rollback'},70);
assert('Tournament：attach 失败补偿会同时清理 pairing 与 match 索引',
  rolledBack.ok&&rollbackGuard.snapshot('tour_rollback',71).pairings.find(item=>item.pairingId==='pair_1').status==='unbound');
const rebound=rollbackGuard.bindMatch('tour_rollback','pair_1',{matchId:'match_rollback_2',gameId:'gomoku',players:['u2','u1']},80);
assert('Tournament：补偿后同一桌位可以安全重试绑定',rebound.ok&&rebound.binding.matchId==='match_rollback_2');
rollbackGuard.authorizeResult('tour_rollback','pair_1',{matchId:'match_rollback_2',gameId:'gomoku',players:['u1','u2'],source:'room_authority'},90);
assert('Tournament：已接受结果的绑定不能被补偿撤销',
  rollbackGuard.unbindMatch('tour_rollback','pair_1',{matchId:'match_rollback_2',source:'server_rollback'},100).reason==='binding_finalized');

const batchGuard=new TournamentGuard({maxActive:2,maxParticipants:4,maxPerOwner:2,ttlMs:10000,maxLifetimeMs:60000});
batchGuard.create({tournamentId:'tour_batch',ownerUid:'u1',gameId:'gomoku',participants:['u1','u2','u3','u4'],now:0});
for(const uid of ['u2','u3','u4'])batchGuard.consent('tour_batch',uid,true,10);
batchGuard.start('tour_batch','u1',20);
const invalidBatch=batchGuard.registerPairings('tour_batch',[
  {pairingId:'batch_1',players:['u1','u2']},
  {pairingId:'batch_bad',players:['u3','attacker']},
],30);
assert('Tournament：批量配对任一无效时不留下前半批状态',
  invalidBatch.reason==='invalid_pairing'&&batchGuard.snapshot('tour_batch',31).pairings.length===0);
assert('Tournament：批量配对验证全部通过后一次提交',batchGuard.registerPairings('tour_batch',[
  {pairingId:'batch_1',players:['u1','u2']},
  {pairingId:'batch_2',players:['u3','u4']},
],40).ok&&batchGuard.snapshot('tour_batch',41).pairings.length===2);

const detachTournament=new TournamentOrchestrator({tournamentId:'detach_tour',gameId:'gomoku',participants:['u1','u2','u3'],rounds:1});
detachTournament.start();
const detachPairing=detachTournament.pairings[0];
detachTournament.attachMatchRoom(detachPairing.pairingId,'ROOM_DETACH',{source:'tournament'});
assert('Tournament：非服务端补偿不能撤销 Orchestrator 房间绑定',
  detachTournament.detachMatchRoom(detachPairing.pairingId,'ROOM_DETACH',{source:'client'}).reason==='server_rollback_required');
assert('Tournament：服务端补偿撤销后可重新绑定真实房间',
  detachTournament.detachMatchRoom(detachPairing.pairingId,'ROOM_DETACH',{source:'server_rollback'}).ok&&
  detachTournament.attachMatchRoom(detachPairing.pairingId,'ROOM_RETRY',{source:'tournament'}).ok);

function runningGuard(tournamentId){
  const guard=new TournamentGuard({maxActive:4,maxParticipants:4,maxPerOwner:4,ttlMs:10000,maxLifetimeMs:60000});
  assert('Tournament Batch：创建 '+tournamentId,guard.create({tournamentId,ownerUid:'u1',gameId:'gomoku',participants:['u1','u2','u3','u4'],now:0}).ok);
  for(const uid of ['u2','u3','u4'])assert('Tournament Batch：'+uid+' 同意 '+tournamentId,guard.consent(tournamentId,uid,true,10).ok);
  assert('Tournament Batch：启动 '+tournamentId,guard.start(tournamentId,'u1',20).ok);
  assert('Tournament Batch：注册两桌 '+tournamentId,guard.registerPairings(tournamentId,[
    {pairingId:tournamentId+'_p1',players:['u1','u2']},
    {pairingId:tournamentId+'_p2',players:['u3','u4']},
  ],30).ok);
  return guard;
}

const atomicGuard=runningGuard('tour_atomic');
const atomicBefore=JSON.stringify(atomicGuard.snapshot('tour_atomic',40));
const invalidSecondBind=atomicGuard.bindMatches('tour_atomic',[
  {pairingId:'tour_atomic_p1',matchId:'atomic_match_1',gameId:'gomoku',players:['u1','u2']},
  {pairingId:'tour_atomic_p2',matchId:'atomic_match_2',gameId:'xiangqi',players:['u3','u4']},
],50);
assert('Tournament Batch：第二桌绑定失败时 pairings/revision/activity/bindings 全部零变化',
  invalidSecondBind.reason==='game_mismatch'&&JSON.stringify(atomicGuard.snapshot('tour_atomic',51))===atomicBefore);

const mutablePlayers=['u1','u2'];
const mutableMetadata={pairingId:'tour_atomic_p1',matchId:'atomic_match_1',gameId:'gomoku',players:mutablePlayers};
const atomicBound=atomicGuard.bindMatches('tour_atomic',[
  mutableMetadata,
  {pairingId:'tour_atomic_p2',matchId:'atomic_match_2',gameId:'gomoku',players:['u3','u4']},
],60);
assert('Tournament Batch：两桌整批一次提交且返回 DTO 深冻结',
  atomicBound.ok&&atomicBound.bound.length===2&&Object.isFrozen(atomicBound)&&Object.isFrozen(atomicBound.bindings)&&Object.isFrozen(atomicBound.bindings[0].players));
mutablePlayers[0]='attacker';
assert('Tournament Batch：调用方输入后续突变不能穿透 canonical binding',
  atomicGuard.snapshot('tour_atomic',61).bindings.find(item=>item.pairingId==='tour_atomic_p1').players.join('|')==='u1|u2');
const boundState=atomicGuard.snapshot('tour_atomic',62);
const exactRetry=atomicGuard.bindMatches('tour_atomic',[
  {pairingId:'tour_atomic_p1',matchId:'atomic_match_1',gameId:'gomoku',players:['u1','u2']},
  {pairingId:'tour_atomic_p2',matchId:'atomic_match_2',gameId:'gomoku',players:['u3','u4']},
],70);
assert('Tournament Batch：有序 players 完全一致的整批重试幂等且不触碰 revision/activity',
  exactRetry.ok&&exactRetry.idempotent&&exactRetry.bound.length===0&&JSON.stringify(atomicGuard.snapshot('tour_atomic',71))===JSON.stringify(boundState));
const wrongOrderState=JSON.stringify(atomicGuard.snapshot('tour_atomic',72));
const wrongOrderRetry=atomicGuard.bindMatches('tour_atomic',[
  {pairingId:'tour_atomic_p1',matchId:'atomic_match_1',gameId:'gomoku',players:['u2','u1']},
  {pairingId:'tour_atomic_p2',matchId:'atomic_match_2',gameId:'gomoku',players:['u3','u4']},
],80);
assert('Tournament Batch：幂等重试的 players 顺序不同会 fail-closed 且零变化',
  wrongOrderRetry.reason==='players_mismatch'&&JSON.stringify(atomicGuard.snapshot('tour_atomic',81))===wrongOrderState);

const mixedGuard=runningGuard('tour_mixed');
const firstMixedBinding=mixedGuard.bindMatches('tour_mixed',[
  {pairingId:'tour_mixed_p1',matchId:'mixed_match_1',gameId:'gomoku',players:['u1','u2']},
],40);
const firstMixedBoundAt=firstMixedBinding.bindings[0].boundAt;
const mixedGuardRevision=mixedGuard.snapshot('tour_mixed',41).revision;
const mixedBinding=mixedGuard.bindMatches('tour_mixed',[
  {pairingId:'tour_mixed_p1',matchId:'mixed_match_1',gameId:'gomoku',players:['u1','u2']},
  {pairingId:'tour_mixed_p2',matchId:'mixed_match_2',gameId:'gomoku',players:['u3','u4']},
],50);
assert('Tournament Batch：已有幂等项与新项可同批提交，仅新增项触碰一次 revision',
  mixedBinding.ok&&!mixedBinding.idempotent&&mixedBinding.bound.join('|')==='tour_mixed_p2'&&mixedBinding.bindings[0].boundAt===firstMixedBoundAt&&mixedBinding.state.revision===mixedGuardRevision+1);

atomicGuard.authorizeResult('tour_atomic','tour_atomic_p2',{matchId:'atomic_match_2',gameId:'gomoku',players:['u3','u4'],source:'room_authority'},90);
const finalizedBefore=JSON.stringify(atomicGuard.snapshot('tour_atomic',91));
const finalizedBatchRollback=atomicGuard.unbindMatches('tour_atomic',[
  {pairingId:'tour_atomic_p1',matchId:'atomic_match_1',source:'server_rollback'},
  {pairingId:'tour_atomic_p2',matchId:'atomic_match_2',source:'server_rollback'},
],100);
assert('Tournament Batch：任一桌 finalized 时批量 unbind 零删除',
  finalizedBatchRollback.reason==='binding_finalized'&&JSON.stringify(atomicGuard.snapshot('tour_atomic',101))===finalizedBefore&&atomicGuard.snapshot('tour_atomic',101).bindings.length===2);

const duplicatePlayerGuard=new TournamentGuard({maxActive:2,maxParticipants:4,maxPerOwner:2,ttlMs:10000,maxLifetimeMs:60000});
duplicatePlayerGuard.create({tournamentId:'tour_overlap',ownerUid:'u1',gameId:'gomoku',participants:['u1','u2','u3','u4'],now:0});
for(const uid of ['u2','u3','u4'])duplicatePlayerGuard.consent('tour_overlap',uid,true,10);
duplicatePlayerGuard.start('tour_overlap','u1',20);
duplicatePlayerGuard.registerPairing('tour_overlap','overlap_p1',['u1','u2'],30);
duplicatePlayerGuard.registerPairing('tour_overlap','overlap_p2',['u1','u3'],31);
const overlapBefore=JSON.stringify(duplicatePlayerGuard.snapshot('tour_overlap',32));
assert('Tournament Batch：禁止同批玩家跨桌重复且失败零变化',
  duplicatePlayerGuard.bindMatches('tour_overlap',[
    {pairingId:'overlap_p1',matchId:'overlap_match_1',gameId:'gomoku',players:['u1','u2']},
    {pairingId:'overlap_p2',matchId:'overlap_match_2',gameId:'gomoku',players:['u1','u3']},
  ],40).reason==='duplicate_batch_player'&&JSON.stringify(duplicatePlayerGuard.snapshot('tour_overlap',41))===overlapBefore);

const rollbackBatchGuard=runningGuard('tour_unbind');
rollbackBatchGuard.bindMatches('tour_unbind',[
  {pairingId:'tour_unbind_p1',matchId:'unbind_match_1',gameId:'gomoku',players:['u1','u2']},
  {pairingId:'tour_unbind_p2',matchId:'unbind_match_2',gameId:'gomoku',players:['u3','u4']},
],40);
const unboundBatch=rollbackBatchGuard.unbindMatches('tour_unbind',[
  {pairingId:'tour_unbind_p1',matchId:'unbind_match_1',source:'server_rollback'},
  {pairingId:'tour_unbind_p2',matchId:'unbind_match_2',source:'server_rollback'},
],50);
assert('Tournament Batch：可撤销两桌整批删除且返回冻结 DTO',
  unboundBatch.ok&&unboundBatch.unbound.length===2&&unboundBatch.state.bindings.length===0&&Object.isFrozen(unboundBatch)&&Object.isFrozen(unboundBatch.bindings[0].players));

const roomBatch=new TournamentOrchestrator({tournamentId:'room_batch',gameId:'gomoku',participants:['u1','u2','u3','u4'],rounds:1,now:1000});
roomBatch.start();
const originalRoomState=JSON.stringify(roomBatch.snapshot());
const roomRequests=roomBatch.pairings.map((pairing,index)=>({
  pairingId:pairing.pairingId,
  matchRoomId:'ROOM_BATCH_'+(index+1),
  metadata:{serverMatchId:'server_match_'+(index+1),presentation:{table:index+1}},
}));
const attachedBatch=roomBatch.attachMatchRooms(roomRequests,{source:'tournament',gameId:'gomoku',now:2000});
assert('Tournament Rooms：两桌整批 attach 成功并返回深冻结精确 rollback receipt',
  attachedBatch.ok&&attachedBatch.pairings.length===2&&Object.isFrozen(attachedBatch)&&Object.isFrozen(attachedBatch.rollbackReceipt)&&Object.isFrozen(attachedBatch.rollbackReceipt.entries[0].before));
roomRequests[0].metadata.presentation.table=99;
assert('Tournament Rooms：嵌套 metadata 输入突变不能穿透 canonical roomMetadata',
  roomBatch.snapshot().pairings[0].roomMetadata.presentation.table===1);
const isolatedSnapshot=roomBatch.snapshot();
const isolatedCanonicalBefore=JSON.stringify(isolatedSnapshot);
try{isolatedSnapshot.pairings[0].roomMetadata.presentation.table=777;}catch(_error){}
try{isolatedSnapshot.standings[0].opponents.push('attacker');}catch(_error){}
assert('Tournament Snapshot：roomMetadata/opponents 深隔离并冻结，调用方突变不能穿透 canonical',
  Object.isFrozen(isolatedSnapshot)&&Object.isFrozen(isolatedSnapshot.pairings)&&Object.isFrozen(isolatedSnapshot.pairings[0].roomMetadata.presentation)&&Object.isFrozen(isolatedSnapshot.standings[0].opponents)&&
  JSON.stringify(roomBatch.snapshot())===isolatedCanonicalBefore);
const detachedStandings=roomBatch.standings();
detachedStandings[0].opponents.push('attacker');
assert('Tournament Standings：公开 standings opponents 为独立数组',!roomBatch.snapshot().standings.some(item=>item.opponents.includes('attacker')));
const attachedState=roomBatch.snapshot();
const idempotentAttach=roomBatch.attachMatchRooms(roomBatch.pairings.map((pairing,index)=>({
  pairingId:pairing.pairingId,
  matchRoomId:'ROOM_BATCH_'+(index+1),
  metadata:{serverMatchId:'server_match_'+(index+1),presentation:{table:index+1}},
})),{source:'tournament',gameId:'gomoku',now:3000});
assert('Tournament Rooms：完全一致的整批 attach 重试幂等且 revision/audit/updatedAt 零变化',
  idempotentAttach.ok&&idempotentAttach.idempotent&&idempotentAttach.rollbackReceipt===null&&JSON.stringify(roomBatch.snapshot())===JSON.stringify(attachedState));
const forgedReceiptState=JSON.stringify(roomBatch.snapshot());
assert('Tournament Rooms：只接受模块签发的原始 rollback receipt capability',
  roomBatch.detachMatchRooms(JSON.parse(JSON.stringify(attachedBatch.rollbackReceipt)),{source:'server_rollback'}).reason==='invalid_rollback_receipt'&&JSON.stringify(roomBatch.snapshot())===forgedReceiptState);
const detachedBatch=roomBatch.detachMatchRooms(attachedBatch.rollbackReceipt,{source:'server_rollback'});
assert('Tournament Rooms：receipt 精确恢复原 matchRoomId/metadata/audit/revision/updatedAt',
  detachedBatch.ok&&JSON.stringify(roomBatch.snapshot())===originalRoomState&&detachedBatch.restored.revision===attachedBatch.rollbackReceipt.revisionBefore&&detachedBatch.restored.updatedAt===attachedBatch.rollbackReceipt.updatedAtBefore);

const legacySingleRooms=new TournamentOrchestrator({tournamentId:'room_single_compat',gameId:'gomoku',participants:['u1','u2','u3','u4'],rounds:1,now:3000});
legacySingleRooms.start();
const legacySingleBefore=JSON.stringify(legacySingleRooms.snapshot());
const legacySingleAttachments=legacySingleRooms.pairings.map((pairing,index)=>legacySingleRooms.attachMatchRoom(pairing.pairingId,'ROOM_SINGLE_'+(index+1),{source:'tournament',serverMatchId:'single_match_'+(index+1),now:3100+index}));
const legacySingleRollbacks=legacySingleRooms.pairings.slice().reverse().map(pairing=>legacySingleRooms.detachMatchRoom(pairing.pairingId,pairing.matchRoomId,{source:'server_rollback'}));
assert('Tournament Rooms：旧单桌接口复用 receipt，逆序补偿后仍精确回到批次前状态',
  legacySingleAttachments.every(result=>result.ok)&&legacySingleRollbacks.every(result=>result.ok)&&JSON.stringify(legacySingleRooms.snapshot())===legacySingleBefore);

const mixedRooms=new TournamentOrchestrator({tournamentId:'room_mixed',gameId:'gomoku',participants:['u1','u2','u3','u4'],rounds:1,now:3200});
mixedRooms.start();
const mixedRoomsBefore=JSON.stringify(mixedRooms.snapshot());
const mixedFirst=mixedRooms.attachMatchRooms([{
  pairingId:mixedRooms.pairings[0].pairingId,matchRoomId:'ROOM_MIXED_1',metadata:{serverMatchId:'mixed_server_1'},
}],{source:'tournament',gameId:'gomoku',now:3210});
const mixedSecond=mixedRooms.attachMatchRooms([
  {pairingId:mixedRooms.pairings[0].pairingId,matchRoomId:'ROOM_MIXED_1',metadata:{serverMatchId:'mixed_server_1'}},
  {pairingId:mixedRooms.pairings[1].pairingId,matchRoomId:'ROOM_MIXED_2',metadata:{serverMatchId:'mixed_server_2'}},
],{source:'tournament',gameId:'gomoku',now:3220});
const mixedSecondRollback=mixedRooms.detachMatchRooms(mixedSecond.rollbackReceipt,{source:'server_rollback'});
const mixedFirstRollback=mixedRooms.detachMatchRooms(mixedFirst.rollbackReceipt,{source:'server_rollback'});
assert('Tournament Rooms：已有幂等 attach 与新 attach 可混合，receipt 只补偿新增项且可嵌套逆序恢复',
  mixedFirst.ok&&mixedSecond.ok&&mixedSecond.rollbackReceipt.entries.length===1&&mixedSecond.rollbackReceipt.entries[0].pairingId===mixedRooms.tournamentId+'_r1_p2'&&mixedSecondRollback.ok&&mixedFirstRollback.ok&&JSON.stringify(mixedRooms.snapshot())===mixedRoomsBefore);

const staleRooms=new TournamentOrchestrator({tournamentId:'room_stale',gameId:'gomoku',participants:['u1','u2','u3','u4'],rounds:1,now:3300});
staleRooms.start();
const staleAttach=staleRooms.attachMatchRooms(staleRooms.pairings.map((pairing,index)=>({pairingId:pairing.pairingId,matchRoomId:'ROOM_STALE_'+(index+1),metadata:{serverMatchId:'stale_server_'+(index+1)}})),{source:'tournament',now:3310});
const stalePairing=staleRooms.pairings[0];
staleRooms.reportServerResult(stalePairing.matchId,{winnerUid:stalePairing.players[0]},{source:'server',matchRoomId:stalePairing.matchRoomId});
const staleBeforeRollback=JSON.stringify(staleRooms.snapshot());
assert('Tournament Rooms：后续权威状态变化会使旧 receipt 失效且 rollback 零变化',
  staleRooms.detachMatchRooms(staleAttach.rollbackReceipt,{source:'server_rollback'}).reason==='stale_rollback_receipt'&&JSON.stringify(staleRooms.snapshot())===staleBeforeRollback);

const invalidRoomBatch=new TournamentOrchestrator({tournamentId:'room_invalid',gameId:'gomoku',participants:['u1','u2','u3','u4'],rounds:1,now:4000});
invalidRoomBatch.start();
const invalidRoomBefore=JSON.stringify(invalidRoomBatch.snapshot());
const invalidRoomAttach=invalidRoomBatch.attachMatchRooms([
  {pairingId:invalidRoomBatch.pairings[0].pairingId,matchRoomId:'ROOM_VALID_1',metadata:{lane:'first'}},
  {pairingId:'missing_pairing',matchRoomId:'ROOM_VALID_2',metadata:{lane:'second'}},
],{source:'tournament',now:5000});
assert('Tournament Rooms：第二项校验失败时第一项不落盘且完整状态零变化',
  invalidRoomAttach.reason==='match_not_found'&&JSON.stringify(invalidRoomBatch.snapshot())===invalidRoomBefore);
const functionMetadataBefore=JSON.stringify(invalidRoomBatch.snapshot());
assert('Tournament Rooms：拒绝非 JSON/canonical 覆盖 metadata 且零变化',
  invalidRoomBatch.attachMatchRooms([{pairingId:invalidRoomBatch.pairings[0].pairingId,matchRoomId:'ROOM_VALID_1',metadata:{callback(){}}}],{source:'tournament'}).reason==='invalid_metadata'&&
  invalidRoomBatch.attachMatchRooms([{pairingId:invalidRoomBatch.pairings[0].pairingId,matchRoomId:'ROOM_VALID_1',metadata:{pairingId:'forged'}}],{source:'tournament'}).reason==='canonical_metadata_forbidden'&&
  JSON.stringify(invalidRoomBatch.snapshot())===functionMetadataBefore);
if(!process.exitCode)console.log('TOURNAMENT_ALL_PASS');
