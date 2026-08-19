'use strict';

const DEFAULT_GAME_WHITELIST = Object.freeze(['gomoku','ludo','monopoly','tank','tetris','xiangqi']);

function stringId(value){
  const id = String(value === undefined || value === null ? '' : value).trim();
  return id;
}

function uniqueStrings(values){
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(stringId).filter(Boolean))];
}

function reason(reason, extra){ return {ok:false, reason, ...(extra || {})}; }

function cloneValue(value){
  if (value === undefined || value === null) return value;
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}

function orderedStringsEqual(left,right){
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value,index) => value === right[index]);
}

function deepFreeze(value){
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function bindingDto(binding){
  return binding ? { ...binding, players:Array.isArray(binding.players) ? binding.players.slice() : [] } : null;
}

/**
 * Identity/seat guard for the spectator protocol.
 * The server can pass its session/room maps as request metadata without
 * coupling this module to Session or WebSocket classes.
 */
class SpectatorAccessGuard {
  constructor(options = {}){
    this.maxSpectators = Math.max(1, Math.min(50, Number(options.maxSpectators) || 12));
    this.maxConnectionsPerUid = Math.max(1, Number(options.maxConnectionsPerUid) || 1);
    this.sessions = new Map(); // sessionId -> {uid, roomId, joinedAt}
    this.byUid = new Map(); // uid -> Set(sessionId)
    this.byRoom = new Map(); // roomId -> Set(sessionId)
  }

  _uidCount(uid){ return this.byUid.has(uid) ? this.byUid.get(uid).size : 0; }
  _roomCount(roomId){ return this.byRoom.has(roomId) ? this.byRoom.get(roomId).size : 0; }

  canJoin(request = {}){
    const sessionId = stringId(request.sessionId);
    const uid = stringId(request.uid);
    const roomId = stringId(request.roomId || request.room);
    if (!sessionId || !uid || !roomId) return reason('invalid_identity');
    if (request.started !== true) return reason('match_not_started');
    const expectedMatchId = stringId(request.matchId);
    const requestedMatchId = stringId(request.requestedMatchId || request.joinMatchId);
    if (requestedMatchId && expectedMatchId !== requestedMatchId) return reason('invalid_match');
    const existing = this.sessions.get(sessionId);
    if (existing) return reason(existing.roomId === roomId ? 'already_spectating' : 'cross_room_join');
    const existingUidSessions = this.byUid.get(uid);
    if (existingUidSessions && existingUidSessions.size >= this.maxConnectionsPerUid) return reason('duplicate_spectator_identity');
    const currentSpectatorRoom = stringId(request.currentSpectatorRoomId || request.spectatorRoomId);
    if (currentSpectatorRoom && currentSpectatorRoom !== roomId) return reason('cross_room_join');
    if (currentSpectatorRoom === roomId) return reason('already_spectating');
    const playerRoomId = stringId(request.currentPlayerRoomId || request.playerRoomId);
    if (playerRoomId) return reason('account_is_player');
    const playerRoomIds = uniqueStrings(request.currentPlayerRoomIds);
    if (playerRoomIds.includes(roomId)) return reason('account_is_player');
    const targetPlayers = uniqueStrings(request.targetPlayerUids || request.playerUids);
    if (targetPlayers.includes(uid)) return reason('account_is_player');
    const targetSpectators = uniqueStrings(request.targetSpectatorUids);
    if (targetSpectators.includes(uid)) return reason('duplicate_spectator_identity');
    const roomLimit = Math.max(1, Math.min(50, Number(request.maxSpectators) || this.maxSpectators));
    if (this._roomCount(roomId) >= roomLimit) return reason('spectator_capacity');
    return {ok:true, sessionId, uid, roomId, matchId:expectedMatchId};
  }

  join(request = {}){
    const accepted = this.canJoin(request);
    if (!accepted.ok) return accepted;
    const record = {uid:accepted.uid, roomId:accepted.roomId, joinedAt:Number(request.now) || Date.now()};
    this.sessions.set(accepted.sessionId, record);
    if (!this.byUid.has(accepted.uid)) this.byUid.set(accepted.uid, new Set());
    if (!this.byRoom.has(accepted.roomId)) this.byRoom.set(accepted.roomId, new Set());
    this.byUid.get(accepted.uid).add(accepted.sessionId);
    this.byRoom.get(accepted.roomId).add(accepted.sessionId);
    return {ok:true, ...record, sessionId:accepted.sessionId};
  }

  leave(sessionId){
    const id = stringId(sessionId);
    const record = this.sessions.get(id);
    if (!record) return false;
    this.sessions.delete(id);
    const uidSet = this.byUid.get(record.uid);
    const roomSet = this.byRoom.get(record.roomId);
    if (uidSet){ uidSet.delete(id); if (!uidSet.size) this.byUid.delete(record.uid); }
    if (roomSet){ roomSet.delete(id); if (!roomSet.size) this.byRoom.delete(record.roomId); }
    return true;
  }

  canOccupyPlayerSeat(request = {}){
    const sessionId = stringId(request.sessionId);
    const uid = stringId(request.uid);
    if (!sessionId || !uid) return reason('invalid_identity');
    if (this.sessions.has(sessionId) || stringId(request.currentSpectatorRoomId)) return reason('spectator_active');
    if (this._uidCount(uid) > 0) return reason('account_spectating');
    return {ok:true,sessionId,uid};
  }

  roomSpectators(roomId){
    const ids = this.byRoom.get(stringId(roomId));
    return ids ? [...ids] : [];
  }

  snapshot(){
    return [...this.sessions.entries()].map(([sessionId,record]) => ({sessionId,...record}));
  }
}

/**
 * Delay-aware event/snapshot buffer. A join must read an event at or before
 * serverNow-delayMs; the current live state is never returned when delayed.
 */
class DelayedSnapshotBuffer {
  constructor(options = {}){
    this.delayMs = Math.max(0, Math.min(30000, Number(options.delayMs) || 0));
    this.maxEntries = Math.max(4, Math.min(2000, Number(options.maxEntries) || 256));
    this.maxAgeMs = Math.max(this.delayMs + 1000, Number(options.maxAgeMs) || 10 * 60 * 1000);
    this.entries = [];
  }

  push(snapshot, now = Date.now()){
    const at = Number(now);
    if (!Number.isFinite(at)) return false;
    const stored = cloneValue(snapshot);
    if (stored === null && snapshot !== null) return false;
    this.entries.push({at, snapshot:stored});
    this.entries.sort((a,b) => a.at - b.at);
    this.prune(at);
    while (this.entries.length > this.maxEntries) this.entries.shift();
    return true;
  }

  prune(now = Date.now()){
    const cutoff = Number(now) - this.maxAgeMs;
    this.entries = this.entries.filter(entry => entry.at >= cutoff);
  }

  latest(now = Date.now(), matchId){
    const current = Number(now);
    if (!Number.isFinite(current)) return null;
    this.prune(current);
    const cutoff = current - this.delayMs;
    for (let index = this.entries.length - 1; index >= 0; index--){
      const entry = this.entries[index];
      if (entry.at > cutoff) continue;
      if (matchId !== undefined && matchId !== null){
        const entryMatchId = entry.snapshot && (entry.snapshot.matchId || entry.snapshot.payload && entry.snapshot.payload.matchId);
        if (String(entryMatchId || '') !== String(matchId)) continue;
      }
      return cloneValue(entry.snapshot);
    }
    return null;
  }

  due(now = Date.now(), matchId){
    const current = Number(now);
    if (!Number.isFinite(current)) return [];
    this.prune(current);
    const cutoff = current - this.delayMs;
    const due = [];
    const keep = [];
    for (const entry of this.entries){
      const entryMatchId = entry.snapshot && (entry.snapshot.matchId || entry.snapshot.payload && entry.snapshot.payload.matchId);
      const match = matchId === undefined || String(entryMatchId || '') === String(matchId);
      if (entry.at <= cutoff && match) due.push(cloneValue(entry.snapshot));
      else keep.push(entry);
    }
    this.entries = keep;
    return due;
  }

  clear(){ this.entries = []; }
}

class SpectatorSnapshotGuard {
  constructor(options = {}){
    this.access = options.access instanceof SpectatorAccessGuard ? options.access : new SpectatorAccessGuard(options);
    this.buffers = new Map();
  }

  buffer(roomId, options = {}){
    const id = stringId(roomId);
    if (!this.buffers.has(id)) this.buffers.set(id, new DelayedSnapshotBuffer(options));
    const buffer = this.buffers.get(id);
    if (options.delayMs !== undefined) buffer.delayMs = Math.max(0,Math.min(30000,Number(options.delayMs)||0));
    return buffer;
  }

  record(roomId, snapshot, now = Date.now(), options = {}){
    return this.buffer(roomId, options).push(snapshot, now);
  }

  join(request = {}){
    const accepted = this.access.join(request);
    if (!accepted.ok) return accepted;
    const delayMs = Math.max(0, Number(request.delayMs) || 0);
    const requestedMatchId = stringId(request.matchId);
    let initialSnapshot = request.liveSnapshot || null;
    if (initialSnapshot && initialSnapshot.matchId !== undefined &&
        String(initialSnapshot.matchId || '') !== requestedMatchId){
      this.access.leave(accepted.sessionId);
      return reason('invalid_match');
    }
    if (delayMs > 0){
      const delayed = this.buffer(accepted.roomId,{delayMs}).latest(Number(request.now) || Date.now(), requestedMatchId);
      if (!delayed){
        this.access.leave(accepted.sessionId);
        return reason('snapshot_not_ready');
      }
      initialSnapshot = delayed;
    }
    return {ok:true, ...accepted, initialSnapshot:cloneValue(initialSnapshot)};
  }

  leave(sessionId){ return this.access.leave(sessionId); }
}

class TournamentGuard {
  constructor(options = {}){
    this.protocol = 'tournament-guard-v1';
    this.gameWhitelist = new Set(uniqueStrings(options.gameWhitelist || DEFAULT_GAME_WHITELIST));
    this.maxActive = Math.max(1, Number(options.maxActive) || 100);
    this.maxParticipants = Math.max(3, Math.min(64, Number(options.maxParticipants) || 16));
    this.maxPerOwner = Math.max(1, Number(options.maxPerOwner) || 3);
    this.ttlMs = Math.max(1000, Number(options.ttlMs) || 6 * 60 * 60 * 1000);
    this.maxLifetimeMs = Math.max(this.ttlMs, Number(options.maxLifetimeMs) || 24 * 60 * 60 * 1000);
    this.maxRetained = Math.max(this.maxActive, Number(options.maxRetained) || this.maxActive * 4);
    this.entries = new Map();
    this.matchBindings = new Map();
  }

  _now(value){ return Number.isFinite(Number(value)) ? Number(value) : Date.now(); }
  _activeCount(now){ this.cleanup(now); return [...this.entries.values()].filter(entry => !['finished','expired','declined','cancelled'].includes(entry.status)).length; }
  _ownerCount(ownerUid,now){ this.cleanup(now); return [...this.entries.values()].filter(entry => entry.ownerUid === ownerUid && !['finished','expired','declined','cancelled'].includes(entry.status)).length; }

  cleanup(now = Date.now()){
    const current = this._now(now);
    for (const [id,entry] of this.entries){
      if (entry.status !== 'finished' && entry.status !== 'declined' && entry.status !== 'cancelled' && current >= entry.expiresAt){
        entry.status = 'expired';
        for (const binding of entry.bindings.values()) this.matchBindings.delete(binding.matchId);
        this.entries.set(id,entry);
      }
    }
    if (this.entries.size > this.maxRetained){
      const removable = [...this.entries.values()]
        .filter(entry => ['finished','expired','declined','cancelled'].includes(entry.status))
        .sort((a,b) => a.lastActivityAt - b.lastActivityAt);
      while (this.entries.size > this.maxRetained && removable.length){
        const entry = removable.shift();
        for (const binding of entry.bindings.values()) this.matchBindings.delete(binding.matchId);
        this.entries.delete(entry.tournamentId);
      }
    }
    return this;
  }

  create(request = {}){
    const now = this._now(request.now);
    this.cleanup(now);
    const tournamentId = stringId(request.tournamentId);
    const ownerUid = stringId(request.ownerUid);
    const gameId = stringId(request.gameId);
    const allowExternalOwner = request.allowExternalOwner === true;
    const rawParticipants = Array.isArray(request.participants) ? request.participants.map(stringId) : [];
    const participants = uniqueStrings(request.participants);
    if (!tournamentId || !/^[A-Za-z0-9_-]{4,120}$/.test(tournamentId)) return reason('invalid_tournament_id');
    if (this.entries.has(tournamentId)) return reason('duplicate_tournament');
    if (!ownerUid || !gameId) return reason('invalid_tournament');
    if (!this.gameWhitelist.has(gameId)) return reason('game_not_allowed');
    if (participants.length < 3 || participants.length > this.maxParticipants) return reason('participant_limit');
    if (rawParticipants.length !== participants.length || (allowExternalOwner ? participants.includes(ownerUid) : !participants.includes(ownerUid))) return reason('invalid_participants');
    if (this._ownerCount(ownerUid,now) >= this.maxPerOwner) return reason('owner_capacity');
    if (this._activeCount(now) >= this.maxActive) return reason('tournament_capacity');
    const ttl = Math.min(this.maxLifetimeMs, Math.max(1000, Number(request.ttlMs) || this.ttlMs));
    const hardTtl = Math.min(this.maxLifetimeMs, Math.max(ttl, Number(request.maxLifetimeMs) || this.maxLifetimeMs));
    const entry = {
      tournamentId,ownerUid,gameId,participants,createdAt:now,lastActivityAt:now,
      expiresAt:now + ttl,hardExpiresAt:now + hardTtl,status:'waiting',
      externalOwner:allowExternalOwner,
      consents:new Map(participants.map(uid => [uid,allowExternalOwner ? false : uid === ownerUid])),
      pairings:new Map(),bindings:new Map(),authorizedResults:new Set(),revision:0,
    };
    this.entries.set(tournamentId,entry);
    return {ok:true,state:this.snapshot(tournamentId,now)};
  }

  _get(tournamentId,now = Date.now()){
    this.cleanup(now);
    return this.entries.get(stringId(tournamentId));
  }

  _touch(entry,now){
    const current = this._now(now);
    entry.lastActivityAt = current;
    entry.expiresAt = Math.min(entry.hardExpiresAt,current + this.ttlMs);
    entry.revision++;
  }

  consent(tournamentId,uid,accepted,now = Date.now()){
    const entry = this._get(tournamentId,now);
    const participant = stringId(uid);
    if (!entry) return reason('tournament_not_found');
    if (entry.status !== 'waiting') return reason('consent_closed');
    if (!entry.consents.has(participant)) return reason('not_participant');
    if (accepted !== true){ entry.status = 'declined'; this._touch(entry,now); return reason('participant_declined',{state:this.snapshot(entry.tournamentId,now)}); }
    entry.consents.set(participant,true); this._touch(entry,now);
    return {ok:true,state:this.snapshot(entry.tournamentId,now),allConsented:[...entry.consents.values()].every(Boolean)};
  }

  canStart(tournamentId,actorUid,now = Date.now()){
    const entry = this._get(tournamentId,now);
    if (!entry) return reason('tournament_not_found');
    if (entry.status !== 'waiting') return reason('invalid_status');
    if (entry.ownerUid !== stringId(actorUid)) return reason('owner_only');
    if (![...entry.consents.values()].every(Boolean)) return reason('consent_required');
    return {ok:true,state:this.snapshot(entry.tournamentId,now)};
  }

  start(tournamentId,actorUid,now = Date.now()){
    const checked = this.canStart(tournamentId,actorUid,now);
    if (!checked.ok) return checked;
    const entry = this.entries.get(stringId(tournamentId));
    entry.status = 'running'; this._touch(entry,now);
    return {ok:true,state:this.snapshot(entry.tournamentId,now)};
  }

  registerPairing(tournamentId,pairingId,players,now = Date.now()){
    const entry = this._get(tournamentId,now);
    const id = stringId(pairingId);
    const rawIds = Array.isArray(players) ? players.map(stringId) : [];
    const ids = uniqueStrings(players);
    if (!entry) return reason('tournament_not_found');
    if (entry.status !== 'running') return reason('invalid_status');
    if (!id || rawIds.length !== ids.length || ids.length !== 2 || ids.some(uid => !entry.participants.includes(uid)) || ids[0] === ids[1]) return reason('invalid_pairing');
    if (entry.pairings.has(id)) return reason('duplicate_pairing');
    entry.pairings.set(id,{pairingId:id,players:ids,matchId:null,status:'unbound'}); this._touch(entry,now);
    return {ok:true,state:this.snapshot(entry.tournamentId,now)};
  }

  registerPairings(tournamentId,requests,now = Date.now()){
    const entry = this._get(tournamentId,now);
    if (!entry) return reason('tournament_not_found');
    if (entry.status !== 'running') return reason('invalid_status');
    if (!Array.isArray(requests) || !requests.length) return reason('invalid_pairing');
    const additions = [];
    const seen = new Set();
    const seenPlayers = new Set();
    for (const request of requests) {
      const id = stringId(request && request.pairingId);
      const rawIds = Array.isArray(request && request.players) ? request.players.map(stringId) : [];
      const ids = uniqueStrings(request && request.players);
      if (!id || seen.has(id) || rawIds.length !== ids.length || ids.length !== 2 || ids.some(uid => !entry.participants.includes(uid)) || ids[0] === ids[1] || ids.some(uid => seenPlayers.has(uid))) return reason('invalid_pairing');
      seen.add(id);
      ids.forEach(uid => seenPlayers.add(uid));
      const existing = entry.pairings.get(id);
      if (existing) {
        if (!orderedStringsEqual(existing.players,ids)) return reason('duplicate_pairing');
        continue;
      }
      additions.push({pairingId:id,players:ids,matchId:null,status:'unbound'});
    }
    for (const pairing of additions) entry.pairings.set(pairing.pairingId,pairing);
    if (additions.length) this._touch(entry,now);
    return {ok:true,state:this.snapshot(entry.tournamentId,now),registered:additions.map(item=>item.pairingId)};
  }

  _bindMatches(tournamentId,requests,now,options = {}){
    const entry = this._get(tournamentId,now);
    if (!entry) return reason('tournament_not_found');
    if (entry.status !== 'running') return reason('invalid_status');
    if (!Array.isArray(requests) || !requests.length) return reason('invalid_binding_batch');
    const strictPlayerOrder = options.strictPlayerOrder !== false;
    const allowIdempotent = options.allowIdempotent !== false;
    const seenPairings = new Set();
    const seenMatches = new Set();
    const seenPlayers = new Set();
    const planned = [];
    for (const request of requests){
      if (!request || typeof request !== 'object' || Array.isArray(request)) return reason('invalid_binding');
      const id = stringId(request.pairingId);
      const matchId = stringId(request.matchId);
      if (!id || seenPairings.has(id)) return reason('duplicate_batch_pairing');
      if (!matchId || !/^[A-Za-z0-9_-]{6,160}$/.test(matchId)) return reason('invalid_match_id');
      if (seenMatches.has(matchId)) return reason('duplicate_batch_match');
      const pairing = entry.pairings.get(id);
      if (!pairing) return reason('pairing_not_found');
      if (request.actorUid !== undefined && stringId(request.actorUid) !== entry.ownerUid) return reason('owner_only');
      if (stringId(request.gameId) !== entry.gameId) return reason('game_mismatch');
      const rawPlayers = Array.isArray(request.players) ? request.players.map(stringId) : [];
      const players = uniqueStrings(request.players);
      const samePlayerSet = rawPlayers.length === players.length && players.length === pairing.players.length && players.every(uid => pairing.players.includes(uid));
      if (!samePlayerSet || (strictPlayerOrder && !orderedStringsEqual(players,pairing.players))) return reason('players_mismatch');
      if (players.some(uid => seenPlayers.has(uid))) return reason('duplicate_batch_player');
      players.forEach(uid => seenPlayers.add(uid));
      seenPairings.add(id);
      seenMatches.add(matchId);

      const existing = entry.bindings.get(id);
      const globalBinding = this.matchBindings.get(matchId);
      if (existing || pairing.matchId){
        if (!allowIdempotent) return reason('match_already_bound');
        if (!existing || pairing.matchId !== existing.matchId || existing.matchId !== matchId || globalBinding !== existing) return reason('match_already_bound');
        if (existing.gameId !== entry.gameId || !orderedStringsEqual(players,existing.players)) return reason('binding_mismatch');
        planned.push({pairing,binding:existing,isNew:false});
        continue;
      }
      if (globalBinding) return reason('match_already_bound');
      const bindingPlayers = strictPlayerOrder ? players.slice() : pairing.players.slice();
      planned.push({
        pairing,
        isNew:true,
        binding:{tournamentId:entry.tournamentId,pairingId:id,matchId,gameId:entry.gameId,players:bindingPlayers,boundAt:this._now(now),resultAccepted:false},
      });
    }

    const additions = planned.filter(item => item.isNew);
    for (const item of additions){
      item.pairing.matchId = item.binding.matchId;
      item.pairing.status = 'bound';
      entry.bindings.set(item.binding.pairingId,item.binding);
      this.matchBindings.set(item.binding.matchId,item.binding);
    }
    if (additions.length) this._touch(entry,now);
    return deepFreeze({
      ok:true,
      state:this.snapshot(entry.tournamentId,now),
      bindings:planned.map(item => bindingDto(item.binding)),
      bound:additions.map(item => item.binding.pairingId),
      idempotent:additions.length === 0,
    });
  }

  bindMatches(tournamentId,requests,now = Date.now()){
    return this._bindMatches(tournamentId,requests,now,{strictPlayerOrder:true,allowIdempotent:true});
  }

  bindMatch(tournamentId,pairingId,request = {},now = Date.now()){
    const batch = this._bindMatches(tournamentId,[{...request,pairingId}],now,{strictPlayerOrder:false,allowIdempotent:false});
    if (!batch.ok) return batch;
    return {ok:true,state:batch.state,binding:batch.bindings[0]};
  }

  _unbindMatches(tournamentId,requests,now){
    const entry = this._get(tournamentId,now);
    if (!entry) return reason('tournament_not_found');
    if (entry.status !== 'running') return reason('invalid_status');
    if (!Array.isArray(requests) || !requests.length) return reason('invalid_unbind_batch');
    const seenPairings = new Set();
    const seenMatches = new Set();
    const planned = [];
    for (const request of requests){
      if (!request || typeof request !== 'object' || Array.isArray(request)) return reason('invalid_unbind');
      const id = stringId(request.pairingId);
      const matchId = stringId(request.matchId);
      if (!id || seenPairings.has(id)) return reason('duplicate_batch_pairing');
      if (!matchId || seenMatches.has(matchId)) return reason('duplicate_batch_match');
      // This operation exists only to compensate a server-side orchestration
      // failure after binding succeeded. It is never a participant mutation.
      if (request.source !== 'server_rollback') return reason('untrusted_rollback_source');
      const pairing = entry.pairings.get(id);
      const binding = entry.bindings.get(id);
      if (!pairing || !binding) return reason('match_not_bound');
      if (matchId !== binding.matchId) return reason('match_mismatch');
      if (this.matchBindings.get(binding.matchId) !== binding || pairing.matchId !== binding.matchId) return reason('binding_state_mismatch');
      if (binding.resultAccepted || entry.authorizedResults.has(id) || pairing.status === 'complete') return reason('binding_finalized');
      seenPairings.add(id);
      seenMatches.add(matchId);
      planned.push({pairing,binding});
    }

    for (const item of planned){
      entry.bindings.delete(item.binding.pairingId);
      this.matchBindings.delete(item.binding.matchId);
      item.pairing.matchId = null;
      item.pairing.status = 'unbound';
    }
    this._touch(entry,now);
    return deepFreeze({
      ok:true,
      state:this.snapshot(entry.tournamentId,now),
      bindings:planned.map(item => bindingDto(item.binding)),
      unbound:planned.map(item => item.binding.pairingId),
    });
  }

  unbindMatches(tournamentId,requests,now = Date.now()){
    return this._unbindMatches(tournamentId,requests,now);
  }

  unbindMatch(tournamentId,pairingId,request = {},now = Date.now()){
    const batch = this._unbindMatches(tournamentId,[{...request,pairingId}],now);
    if (!batch.ok) return batch;
    return {ok:true,state:batch.state,binding:batch.bindings[0]};
  }

  authorizeResult(tournamentId,pairingId,request = {},now = Date.now()){
    const entry = this._get(tournamentId,now);
    const id = stringId(pairingId);
    if (!entry) return reason('tournament_not_found');
    if (entry.status !== 'running') return reason('invalid_status');
    const binding = entry.bindings.get(id);
    if (!binding) return reason('match_not_bound');
    if (stringId(request.matchId) !== binding.matchId) return reason('match_mismatch');
    if (stringId(request.gameId) !== binding.gameId) return reason('game_mismatch');
    const rawPlayers = Array.isArray(request.players) ? request.players.map(stringId) : [];
    const players = uniqueStrings(request.players);
    if (rawPlayers.length !== players.length || players.length !== binding.players.length || players.some(uid => !binding.players.includes(uid))) return reason('players_mismatch');
    if (entry.authorizedResults.has(id)) return reason('duplicate_result');
    // Only a server gameplay adapter may authorize a bound room result. The
    // explicit source marker makes accidental client forwarding fail closed.
    if (request.source !== 'room_authority') return reason('untrusted_result_source');
    entry.authorizedResults.add(id); binding.resultAccepted = true; entry.pairings.get(id).status = 'complete'; this._touch(entry,now);
    return {ok:true,state:this.snapshot(entry.tournamentId,now),binding:{...binding,players:binding.players.slice()}};
  }

  finish(tournamentId,actorUid,now = Date.now()){
    const entry = this._get(tournamentId,now);
    if (!entry) return reason('tournament_not_found');
    if (actorUid !== undefined && stringId(actorUid) !== entry.ownerUid) return reason('owner_only');
    if ([...entry.pairings.values()].some(pairing => pairing.status !== 'complete')) return reason('pairings_incomplete');
    entry.status = 'finished';
    for (const binding of entry.bindings.values()) this.matchBindings.delete(binding.matchId);
    this._touch(entry,now);
    return {ok:true,state:this.snapshot(entry.tournamentId,now)};
  }

  snapshot(tournamentId,now = Date.now()){
    const entry = this._get(tournamentId,now);
    if (!entry) return null;
    const mapValues = map => [...map.values()].map(item => ({...item,players:item.players && item.players.slice()}));
    return {
      protocol:this.protocol,tournamentId:entry.tournamentId,ownerUid:entry.ownerUid,gameId:entry.gameId,
      participants:entry.participants.slice(),externalOwner:entry.externalOwner===true,status:entry.status,createdAt:entry.createdAt,lastActivityAt:entry.lastActivityAt,
      expiresAt:entry.expiresAt,hardExpiresAt:entry.hardExpiresAt,revision:entry.revision,
      consents:Object.fromEntries(entry.consents),pairings:mapValues(entry.pairings),bindings:mapValues(entry.bindings),
    };
  }
}

module.exports = {
  DEFAULT_GAME_WHITELIST,
  SpectatorAccessGuard,
  DelayedSnapshotBuffer,
  SpectatorSnapshotGuard,
  TournamentGuard,
};
