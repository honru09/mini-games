'use strict';

function stableId(value){ return String(value && value.id !== undefined ? value.id : value); }

function deepFreeze(value){
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function cloneJsonValue(value,seen = new Set()){
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number'){
    if (!Number.isFinite(value)) throw new Error('invalid_metadata');
    return value;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) throw new Error('invalid_metadata');
  seen.add(value);
  let cloned;
  if (Array.isArray(value)) cloned = value.map(item => cloneJsonValue(item,seen));
  else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error('invalid_metadata');
    cloned = {};
    for (const key of Object.keys(value)){
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('invalid_metadata');
      cloned[key] = cloneJsonValue(value[key],seen);
    }
  }
  seen.delete(value);
  return cloned;
}

function cloneMetadata(value){
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_metadata');
  return cloneJsonValue(value);
}

function stableJson(value){
  if (Array.isArray(value)) return '['+value.map(stableJson).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';
  return JSON.stringify(value);
}

function jsonEqual(left,right){ return stableJson(left) === stableJson(right); }

function pairingDto(pairing){
  return pairing ? {
    ...pairing,
    players:Array.isArray(pairing.players) ? pairing.players.slice() : [],
    result:pairing.result && cloneJsonValue(pairing.result),
    roomMetadata:pairing.roomMetadata && cloneJsonValue(pairing.roomMetadata),
  } : null;
}

class TournamentOrchestrator {
  constructor(options = {}){
    this.protocol = 'tournament-orchestrator-v1';
    this.tournamentId = String(options.tournamentId || 'tournament_local');
    this.gameId = String(options.gameId || 'gomoku');
    this.maxRounds = Math.max(1, Number(options.rounds) || 3);
    this.byePoints = Number.isFinite(Number(options.byePoints)) ? Number(options.byePoints) : 3;
    this.participants = (options.participants || []).map((item, seed) => ({
      id:stableId(item), seed, points:0, wins:0, draws:0, losses:0, byes:0, opponents:[], active:true,
    }));
    if (this.participants.length < 3) throw new Error('tournament_requires_3_players');
    if (new Set(this.participants.map(item => item.id)).size !== this.participants.length) throw new Error('duplicate_participant');
    this.format = this.participants.length <= 4 ? 'round_robin' : 'swiss';
    this.status = 'waiting';
    this.round = 0;
    this.pairings = [];
    this.results = [];
    this.revision = 0;
    this.auditLog = [];
    const createdAt = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
    this._roomAttachReceipts = new Map();
    this.roundRobinSchedule = this.format === 'round_robin' ? this.buildRoundRobin() : [];
  }

  _now(value){ return Number.isFinite(Number(value)) ? Number(value) : Date.now(); }

  buildRoundRobin(){
    const ids = this.participants.map(item => item.id);
    if (ids.length % 2) ids.push(null);
    const rounds = [];
    for (let round=0; round<ids.length-1; round++){
      const tables=[];
      for (let i=0; i<ids.length/2; i++){
        const a=ids[i], b=ids[ids.length-1-i];
        if (a !== null && b !== null) tables.push([a,b]);
      }
      rounds.push(tables);
      ids.splice(1,0,ids.pop());
    }
    return rounds;
  }

  standings(){
    const opponentPoints = player => player.opponents.reduce((sum,id) => {
      const opponent=this.participants.find(item=>item.id===id); return sum+(opponent?opponent.points:0);
    },0);
    return this.participants.map(item=>({...cloneJsonValue(item),opponentPoints:opponentPoints(item)})).sort((a,b)=>
      b.points-a.points || b.wins-a.wins || b.opponentPoints-a.opponentPoints || a.seed-b.seed
    ).map((item,index)=>({...item,rank:index+1}));
  }

  swissPairs(){
    const standings=this.standings().slice();
    const bestMatching=pool=>{
      if(!pool.length)return{score:0,tables:[]};
      if(pool.length>12){
        const work=pool.slice(),tables=[];let score=0;
        while(work.length){const a=work.shift();let index=work.findIndex(b=>!a.opponents.includes(b.id));if(index<0)index=0;const b=work.splice(index,1)[0];score+=(a.opponents.includes(b.id)?10000:0)+Math.abs(a.points-b.points)*100+Math.abs(a.seed-b.seed);tables.push([a.id,b.id]);}
        return{score,tables};
      }
      const a=pool[0];let best=null;
      for(let index=1;index<pool.length;index++){
        const b=pool[index],rest=pool.slice(1,index).concat(pool.slice(index+1)),tail=bestMatching(rest);
        const score=tail.score+(a.opponents.includes(b.id)?10000:0)+Math.abs(a.points-b.points)*100+Math.abs(a.seed-b.seed);
        const tables=[[a.id,b.id],...tail.tables],key=JSON.stringify(tables);
        if(!best||score<best.score||score===best.score&&key<best.key)best={score,tables,key};
      }
      return best;
    };
    if(standings.length%2===0){const best=bestMatching(standings);return{tables:best.tables,bye:null};}
    let selected=null;
    for(const candidate of standings){
      const rest=standings.filter(item=>item.id!==candidate.id),matching=bestMatching(rest);
      const score=candidate.byes*1000000+candidate.points*1000+matching.score;
      if(!selected||score<selected.score||score===selected.score&&candidate.seed>selected.candidate.seed)selected={score,candidate,matching};
    }
    return{tables:selected.matching.tables,bye:selected.candidate.id};
  }

  start(){
    if(this.status!=='waiting')return false;
    this.status='round_ready'; this.revision++; return this.nextRound();
  }

  nextRound(){
    const limit=this.format==='round_robin'?this.roundRobinSchedule.length:this.maxRounds;
    if(this.round>=limit){this.status='finished';this.revision++;return null;}
    this.round++;
    const generated=this.format==='round_robin'?{tables:this.roundRobinSchedule[this.round-1],bye:null}:this.swissPairs();
    this.pairings=generated.tables.map((players,index)=>({
      matchId:this.tournamentId+'_r'+this.round+'_t'+(index+1),tournamentId:this.tournamentId,roundId:this.round,pairingId:this.tournamentId+'_r'+this.round+'_p'+(index+1),matchRoomId:this.tournamentId+'_r'+this.round+'_room'+(index+1),source:'tournament',table:index+1,players:players.slice(),status:'playing',result:null,resultSource:null,
    }));
    if(generated.bye){
      const player=this.participants.find(item=>item.id===generated.bye);player.points+=this.byePoints;player.wins++;player.byes++;
      this.results.push({round:this.round,matchId:null,players:[player.id],winner:player.id,bye:true});
    }
    this.status='round_playing';this.revision++;return this.snapshot();
  }

  _normalizeRoomMetadata(pairing,matchRoomId,requestMetadata,commonMetadata){
    let common;
    let specific;
    try {
      common = cloneMetadata(commonMetadata);
      specific = cloneMetadata(requestMetadata);
    } catch (_error) {
      return {ok:false,reason:'invalid_metadata'};
    }
    const merged = {...common,...specific};
    if (merged.source !== undefined && merged.source !== 'tournament') return {ok:false,reason:'tournament_source_required'};
    for (const key of ['tournamentId','roundId','pairingId','matchRoomId']) if (Object.prototype.hasOwnProperty.call(merged,key)) return {ok:false,reason:'canonical_metadata_forbidden'};
    delete merged.source;
    delete merged.now;
    return {ok:true,value:{
      ...merged,
      tournamentId:this.tournamentId,
      roundId:this.round,
      pairingId:pairing.pairingId,
      matchRoomId,
      source:'tournament',
    }};
  }

  attachMatchRooms(requests,metadata={}){
    if (!Array.isArray(requests) || !requests.length) return {ok:false,reason:'invalid_attach_batch'};
    let commonMetadata;
    try { commonMetadata = cloneMetadata(metadata); } catch (_error) { return {ok:false,reason:'invalid_metadata'}; }
    const now = this._now(commonMetadata.now);
    const seenPairings = new Set();
    const seenRooms = new Set();
    const planned = [];
    for (const request of requests){
      if (!request || typeof request !== 'object' || Array.isArray(request)) return {ok:false,reason:'invalid_attachment'};
      const pairingId = String(request.pairingId || '').trim();
      const matchRoomId = String(request.matchRoomId || '').trim();
      if (!pairingId || seenPairings.has(pairingId)) return {ok:false,reason:'duplicate_batch_pairing'};
      if (!matchRoomId || matchRoomId.length > 160 || !/^[A-Za-z0-9_-]+$/.test(matchRoomId)) return {ok:false,reason:'invalid_match_room_id'};
      if (seenRooms.has(matchRoomId)) return {ok:false,reason:'duplicate_batch_room'};
      const pairing = this.pairings.find(item=>item.pairingId===pairingId);
      if (!pairing || pairing.status === 'complete') return {ok:false,reason:'match_not_found'};
      if (this.pairings.some(item=>item!==pairing && item.roomMetadata && String(item.matchRoomId)===matchRoomId)) return {ok:false,reason:'match_room_already_attached'};
      const normalized = this._normalizeRoomMetadata(pairing,matchRoomId,request.metadata,commonMetadata);
      if (!normalized.ok) return normalized;
      const hasMetadata = Object.prototype.hasOwnProperty.call(pairing,'roomMetadata') && pairing.roomMetadata !== undefined;
      if (hasMetadata){
        if (String(pairing.matchRoomId) !== matchRoomId || !jsonEqual(pairing.roomMetadata,normalized.value)) return {ok:false,reason:'match_room_already_attached'};
        planned.push({pairing,matchRoomId,metadata:normalized.value,isNew:false});
      } else {
        planned.push({pairing,matchRoomId,metadata:normalized.value,isNew:true});
      }
      seenPairings.add(pairingId);
      seenRooms.add(matchRoomId);
    }

    const additions = planned.filter(item=>item.isNew);
    if (!additions.length){
      return deepFreeze({ok:true,pairings:planned.map(item=>pairingDto(item.pairing)),rollbackReceipt:null,idempotent:true});
    }
    const auditLengthBefore = this.auditLog.length;
    const revisionBefore = this.revision;
    const updatedAtBefore = this.updatedAt;
    const entries = additions.map(item=>({
      pairingId:item.pairing.pairingId,
      attachedMatchRoomId:item.matchRoomId,
      before:{
        hadMatchRoomId:Object.prototype.hasOwnProperty.call(item.pairing,'matchRoomId'),
        matchRoomIdUndefined:item.pairing.matchRoomId === undefined,
        matchRoomId:item.pairing.matchRoomId === undefined ? null : item.pairing.matchRoomId,
        hadRoomMetadata:Object.prototype.hasOwnProperty.call(item.pairing,'roomMetadata'),
        roomMetadataUndefined:item.pairing.roomMetadata === undefined,
        roomMetadata:item.pairing.roomMetadata === undefined ? null : cloneJsonValue(item.pairing.roomMetadata),
      },
      after:{matchRoomId:item.matchRoomId,roomMetadata:cloneJsonValue(item.metadata)},
    }));
    const auditEntries = additions.map(item=>({at:now,action:'room_created',pairingId:item.pairing.pairingId,matchRoomId:item.matchRoomId}));
    for (const item of additions){
      item.pairing.matchRoomId = item.matchRoomId;
      item.pairing.roomMetadata = cloneJsonValue(item.metadata);
    }
    this.auditLog.push(...auditEntries.map(entry=>({...entry})));
    this.revision++;
    this.updatedAt = now;
    const receipt = deepFreeze({
      protocol:'tournament-room-rollback-v1',
      tournamentId:this.tournamentId,
      round:this.round,
      status:this.status,
      auditLengthBefore,
      auditLengthAfter:this.auditLog.length,
      auditEntries:auditEntries.map(entry=>({...entry})),
      revisionBefore,
      revisionAfter:this.revision,
      updatedAtBefore,
      updatedAtAfter:this.updatedAt,
      entries,
    });
    for (const entry of entries) this._roomAttachReceipts.set(entry.pairingId,receipt);
    return deepFreeze({ok:true,pairings:planned.map(item=>pairingDto(item.pairing)),rollbackReceipt:receipt,idempotent:false});
  }

  attachMatchRoom(pairingId,matchRoomId,metadata={}){
    const batch = this.attachMatchRooms([{pairingId,matchRoomId,metadata}],metadata && metadata.now === undefined ? {} : {now:metadata.now});
    if (!batch.ok) return batch;
    return deepFreeze({ok:true,pairing:batch.pairings[0],rollbackReceipt:batch.rollbackReceipt,idempotent:batch.idempotent});
  }

  detachMatchRooms(receipt,metadata={}){
    let requestMetadata;
    try { requestMetadata = cloneMetadata(metadata); } catch (_error) { return {ok:false,reason:'invalid_metadata'}; }
    if (requestMetadata.source !== 'server_rollback') return {ok:false,reason:'server_rollback_required'};
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || receipt.protocol !== 'tournament-room-rollback-v1' || receipt.tournamentId !== this.tournamentId || !Array.isArray(receipt.entries) || !receipt.entries.length) return {ok:false,reason:'invalid_rollback_receipt'};
    if (receipt.round !== this.round || receipt.status !== this.status || receipt.revisionAfter !== this.revision || receipt.updatedAtAfter !== this.updatedAt || receipt.auditLengthAfter !== this.auditLog.length) return {ok:false,reason:'stale_rollback_receipt'};
    const currentAuditTail = this.auditLog.slice(receipt.auditLengthBefore);
    if (!jsonEqual(currentAuditTail,receipt.auditEntries)) return {ok:false,reason:'stale_rollback_receipt'};
    const seenPairings = new Set();
    const planned = [];
    for (const entry of receipt.entries){
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return {ok:false,reason:'invalid_rollback_receipt'};
      const pairingId = String(entry.pairingId || '');
      if (!pairingId || seenPairings.has(pairingId)) return {ok:false,reason:'invalid_rollback_receipt'};
      const pairing = this.pairings.find(item=>item.pairingId===pairingId);
      if (!pairing || pairing.status === 'complete') return {ok:false,reason:'match_not_found'};
      if (this._roomAttachReceipts.get(pairingId) !== receipt) return {ok:false,reason:'invalid_rollback_receipt'};
      if (String(pairing.matchRoomId) !== String(entry.after && entry.after.matchRoomId || '') || !jsonEqual(pairing.roomMetadata,entry.after && entry.after.roomMetadata)) return {ok:false,reason:'match_room_mismatch'};
      if (!entry.before || typeof entry.before !== 'object') return {ok:false,reason:'invalid_rollback_receipt'};
      planned.push({pairing,entry});
      seenPairings.add(pairingId);
    }

    for (const item of planned){
      if (item.entry.before.hadMatchRoomId) item.pairing.matchRoomId = item.entry.before.matchRoomIdUndefined ? undefined : item.entry.before.matchRoomId;
      else delete item.pairing.matchRoomId;
      if (item.entry.before.hadRoomMetadata) item.pairing.roomMetadata = item.entry.before.roomMetadataUndefined ? undefined : cloneJsonValue(item.entry.before.roomMetadata);
      else delete item.pairing.roomMetadata;
      this._roomAttachReceipts.delete(item.pairing.pairingId);
    }
    this.auditLog.length = receipt.auditLengthBefore;
    this.revision = receipt.revisionBefore;
    this.updatedAt = receipt.updatedAtBefore;
    return deepFreeze({
      ok:true,
      pairings:planned.map(item=>pairingDto(item.pairing)),
      restored:{auditLength:this.auditLog.length,revision:this.revision,updatedAt:this.updatedAt},
    });
  }

  detachMatchRoom(pairingId,matchRoomId,metadata={}){
    if (!metadata || metadata.source !== 'server_rollback') return {ok:false,reason:'server_rollback_required'};
    const pairing=this.pairings.find(item=>item.pairingId===String(pairingId||''));
    if(!pairing||pairing.status==='complete')return{ok:false,reason:'match_not_found'};
    if(!pairing.roomMetadata||String(pairing.matchRoomId)!==String(matchRoomId||''))return{ok:false,reason:'match_room_mismatch'};
    const receipt = metadata.rollbackReceipt || this._roomAttachReceipts.get(pairing.pairingId);
    if (receipt){
      if (!Array.isArray(receipt.entries) || receipt.entries.length !== 1) return {ok:false,reason:'batch_rollback_receipt_required'};
      const batch = this.detachMatchRooms(receipt,{source:'server_rollback'});
      if (!batch.ok) return batch;
      return deepFreeze({ok:true,pairing:batch.pairings[0],restored:batch.restored});
    }
    // Compatibility path for state produced before rollback receipts existed.
    const now = this._now(metadata.now);
    pairing.matchRoomId=null;
    delete pairing.roomMetadata;
    this.auditLog.push({at:now,action:'room_attach_rolled_back',pairingId:pairing.pairingId,matchRoomId:String(matchRoomId)});
    this.revision++;
    this.updatedAt=now;
    return deepFreeze({ok:true,pairing:pairingDto(pairing)});
  }
  reportServerResult(matchId,result,metadata={}){
    const pairing=this.pairings.find(item=>item.matchId===String(matchId||'')||item.matchRoomId===String(matchId||''));if(!pairing)return{ok:false,reason:'match_not_found'};
    if(metadata.source!=='server'&&metadata.source!=='admin_recovery')return{ok:false,reason:'server_result_required'};
    if(metadata.matchRoomId&&String(metadata.matchRoomId)!==String(pairing.matchRoomId))return{ok:false,reason:'match_room_mismatch'};
    const normalized=result&&result.draw?{draw:true,forfeit:!!result.forfeit}:result&&Number.isInteger(result.winnerSlot)?{winner:pairing.players[result.winnerSlot],forfeit:!!result.forfeit}:result&&result.winnerUid?{winner:result.winnerUid,forfeit:!!result.forfeit}:result;
    return this.reportResult(pairing.matchId,{...(normalized||{}),source:metadata.source,serverMatchId:metadata.matchRoomId||pairing.matchRoomId});
  }
  reportResult(matchId, result){
    if(this.status!=='round_playing')return{ok:false,reason:'round_not_playing'};
    const pairing=this.pairings.find(item=>item.matchId===String(matchId||''));
    if(!pairing||pairing.status==='complete')return{ok:false,reason:pairing?'duplicate_result':'match_not_found'};
    const [aId,bId]=pairing.players,a=this.participants.find(item=>item.id===aId),b=this.participants.find(item=>item.id===bId);
    if(pairing.matchRoomId&&result&&result.source&&result.source!=='server'&&result.source!=='admin_recovery')return{ok:false,reason:'server_result_required'};
    const draw=result&&result.draw===true,winner=draw?null:String(result&&result.winner||'');
    if(!draw&&winner!==aId&&winner!==bId)return{ok:false,reason:'invalid_winner'};
    a.opponents.push(bId);b.opponents.push(aId);
    if(draw){a.points++;b.points++;a.draws++;b.draws++;}else if(winner===aId){a.points+=3;a.wins++;b.losses++;}else{b.points+=3;b.wins++;a.losses++;}
    pairing.status='complete';pairing.result={draw,winner:winner||null,forfeit:!!(result&&result.forfeit)};pairing.resultSource=result&&result.source||'manual';
    this.results.push({round:this.round,matchId:pairing.matchId,matchRoomId:pairing.matchRoomId,pairingId:pairing.pairingId,source:'tournament',players:pairing.players.slice(),...pairing.result});this.auditLog.push({at:Date.now(),action:'result_recorded',matchId:pairing.matchId,source:pairing.resultSource});this.revision++;
    if(this.pairings.every(item=>item.status==='complete')){
      this.status='round_complete';this.revision++;
      const limit=this.format==='round_robin'?this.roundRobinSchedule.length:this.maxRounds;
      if(this.round>=limit){this.status='finished';this.revision++;}
    }
    return{ok:true,state:this.snapshot()};
  }

  advance(){ if(this.status!=='round_complete')return null;return this.nextRound(); }
  snapshot(){return deepFreeze({protocol:this.protocol,tournamentId:this.tournamentId,gameId:this.gameId,format:this.format,status:this.status,round:this.round,maxRounds:this.format==='round_robin'?this.roundRobinSchedule.length:this.maxRounds,createdAt:this.createdAt,updatedAt:this.updatedAt,
    pairings:this.pairings.map(item=>pairingDto(item)),standings:this.standings(),results:this.results.map(item=>cloneJsonValue(item)),auditLog:this.auditLog.slice(-100).map(item=>cloneJsonValue(item)),revision:this.revision,byePoints:this.byePoints});}
}

module.exports={TournamentOrchestrator};
