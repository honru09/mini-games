'use strict';

/*
 * Replay Authority v1.
 *
 * Replays are presentation data, but a replay must never be allowed to claim
 * that a client-authored move was legal merely because it was present in a
 * bounded move log.  This seam replays the server-signed input projection
 * against the same shared Rule Core used by the live Authority.  It is kept
 * independent from transport, persistence and UI so it can be used both when
 * a match is finalized and by offline QA.
 */

const RULES = Object.freeze({
  gomoku: require('../../shared/rules/gomoku'),
  ludo: require('../../shared/rules/ludo'),
  monopoly: require('../../shared/rules/monopoly'),
  xiangqi: require('../../shared/rules/xiangqi'),
  tetris: require('../../shared/rules/tetris'),
});
const { TankAuthority, hashReplayProjection } = require('./tank-sim');

const PROTOCOL = 'replay-authority-v1';
const LIFECYCLE_PROTOCOL = 'replay-lifecycle-v1';
const GAMES = Object.freeze([...Object.keys(RULES), 'tank']);
const MAX_EVENTS = 20000;

function clone(value) {
  if (value === undefined || value === null) return value;
  try { return JSON.parse(JSON.stringify(value)); } catch (_error) { return null; }
}

function finiteInteger(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}

function initialState(game, options = {}) {
  if (game === 'ludo') return RULES.ludo.createInitialState(options.playerCount);
  if (game === 'monopoly') return RULES.monopoly.createInitialState({ playerCount: options.playerCount, seed: options.seed });
  if (game === 'tetris') return RULES.tetris.createInitialState({ player: options.player, seed: options.seed });
  return RULES[game].createInitialState();
}

function playerCountFor(game, options = {}) {
  if (game === 'gomoku' || game === 'xiangqi') return 2;
  return Math.max(2, Math.min(5, finiteInteger(options.playerCount, 2, 5) || 2));
}

function normalizeAction(game, record) {
  const source = record && record.action && typeof record.action === 'object' ? record.action : record;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  if (game === 'gomoku') {
    const row = finiteInteger(source.row ?? source.r, 0, 14);
    const col = finiteInteger(source.col ?? source.c, 0, 14);
    return row === null || col === null ? null : { type: 'place', row, col };
  }
  if (game === 'ludo') {
    const type = String(source.type || '');
    if (type === 'roll') {
      const dice = finiteInteger(source.dice, 1, 6);
      return dice === null ? null : { type, dice };
    }
    const token = finiteInteger(source.token, 0, 3);
    return type === 'move' && token !== null ? { type, token } : null;
  }
  if (game === 'xiangqi') {
    const from = Array.isArray(source.from) && source.from.length === 2 ? source.from.map(v => finiteInteger(v, 0, 9)) : null;
    const to = Array.isArray(source.to) && source.to.length === 2 ? source.to.map(v => finiteInteger(v, 0, 9)) : null;
    return from && to && from.every(v => v !== null) && to.every(v => v !== null) ? { type: 'move', from, to } : null;
  }
  if (game === 'monopoly') {
    const action = source.action && typeof source.action === 'object' ? source.action : source;
    const type = String(action.type || '');
    return ['roll', 'buy', 'pass', 'settle', 'close_auction'].includes(type) ? { type } : null;
  }
  if (game === 'tetris') {
    const type = String(source.type || '');
    if (['left', 'right', 'rotate_cw', 'rotate_ccw', 'soft_drop', 'hard_drop', 'hold', 'tick'].includes(type)) return { type };
    if (type === 'garbage') {
      const lines = finiteInteger(source.lines, 1, 12);
      return lines === null ? null : { type, lines, attackId: String(source.attackId || '') };
    }
    if (type === 'finish') return { type, order: Array.isArray(source.order) ? source.order.slice() : null };
    return null;
  }
  return null;
}

function normalizeRecord(game, event, matchId) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : event;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const protocol = String(payload.protocol || '');
  const expected = RULES[game].PROTOCOL;
  if (protocol !== expected && protocol !== PROTOCOL) return null;
  const eventMatch = String(payload.matchId || matchId || '');
  if (matchId && eventMatch !== String(matchId)) return null;
  const player = finiteInteger(event && event.player !== undefined ? event.player : payload.player, 0, 4);
  const source = payload.source === 'server' ? 'server' : 'client';
  const seq = source === 'server' ? null : finiteInteger(payload.seq, 1);
  const serverSeq = source === 'server' ? finiteInteger(payload.serverSeq, 1) : null;
  const action = normalizeAction(game, payload);
  if (player === null || (source === 'client' && seq === null) || (source === 'server' && serverSeq === null) || !action) return null;
  return { player, seq, serverSeq, source, action, matchId: eventMatch };
}

function createReplayVerifier(options = {}) {
  const game = String(options.game || '');
  if (!GAMES.includes(game)) throw new TypeError('replay_game_unsupported');
  const playerCount = playerCountFor(game, options);
  const seed = String(options.seed || options.matchId || 'local');
  const states = game === 'tetris'
    ? Array.from({ length: playerCount }, (_, player) => initialState(game, { player, seed }))
    : [options.initialState ? RULES[game].deserialize(options.initialState) : initialState(game, { playerCount, seed })];
  const lastSeq = Array(playerCount).fill(0);
  let accepted = 0;
  let terminal = false;
  let reason = null;

  function accept(event) {
    if (accepted >= MAX_EVENTS) return { ok: false, reason: 'replay_event_limit' };
    const record = normalizeRecord(game, event, options.matchId);
    if (!record) return { ok: false, reason: 'replay_record_invalid' };
    if (record.source === 'server' && game !== 'tetris') return { ok: false, reason: 'replay_source_invalid' };
    if (record.source === 'client' && record.seq <= lastSeq[record.player]) return { ok: false, reason: 'replay_seq_invalid' };
    const state = game === 'tetris' ? states[record.player] : states[0];
    if (!state || state.terminal) return { ok: false, reason: 'replay_after_terminal' };
    if (game === 'tetris' && record.source === 'server' && record.action.type === 'finish') {
      accepted++;
      terminal = true;
      reason = 'time_limit';
      return { ok: true, eventCount: accepted, hash: hash(), terminal };
    }
    const result = game === 'tetris'
      ? RULES.tetris.applyAction(state, record.action)
      : RULES[game].applyAction(state, record.action, record.player);
    if (!result || result.ok !== true || !result.state) return { ok: false, reason: 'replay_illegal_action' };
    states[game === 'tetris' ? record.player : 0] = result.state;
    if (record.source === 'client') lastSeq[record.player] = record.seq;
    accepted++;
    terminal = game === 'tetris' ? states.every(item => item.terminal) : !!result.state.terminal;
    if (terminal) reason = result.state.reason || 'terminal';
    return { ok: true, eventCount: accepted, hash: hash(), terminal };
  }

  function hash() {
    const values = states.map(state => RULES[game].hashState(state));
    return values.join(':');
  }

  function finish(events = []) {
    if (!Array.isArray(events) || events.length > MAX_EVENTS) return { ok: false, status: 'invalid', reason: 'replay_event_limit' };
    for (const event of events) {
      const result = accept(event);
      if (!result.ok) return { ok: false, status: 'invalid', reason: result.reason, eventCount: accepted, hash: hash() };
    }
    return {
      ok: true,
      status: game === 'tetris' ? 'deterministic_input_projection' : 'deterministic',
      protocol: PROTOCOL,
      game,
      ruleProtocol: RULES[game].PROTOCOL,
      eventCount: accepted,
      terminal,
      reason,
      hash: hash(),
      lastSeq: lastSeq.slice(),
    };
  }

  return Object.freeze({ accept, finish, hash, snapshot: () => ({ game, eventCount: accepted, terminal, hash: hash(), lastSeq: lastSeq.slice() }) });
}

function verifyReplayInputs(options = {}) {
  const events = Array.isArray(options.events) ? options.events : [];
  if (!events.length) return { ok: false, status: 'not_available', reason: 'replay_inputs_missing', eventCount: 0 };
  if (String(options.game || '') === 'tank') return applyReplayExpectations(verifyTankReplayInputs(options), options);
  try { return applyReplayExpectations(createReplayVerifier(options).finish(events), options); }
  catch (_error) { return { ok: false, status: 'invalid', reason: 'replay_verifier_failed', eventCount: 0 }; }
}

function applyReplayExpectations(result, options = {}) {
  if (!result || result.ok !== true) return result;
  if (options.expectedTerminal !== undefined && result.terminal !== options.expectedTerminal) {
    return { ...result, ok: false, status: 'invalid', reason: 'replay_terminal_mismatch' };
  }
  if (options.expectedHash && result.hash !== String(options.expectedHash)) {
    return { ...result, ok: false, status: 'invalid', reason: 'replay_final_hash_mismatch' };
  }
  if (Array.isArray(options.expectedLastSeq) && JSON.stringify(result.lastSeq) !== JSON.stringify(options.expectedLastSeq)) {
    return { ...result, ok: false, status: 'invalid', reason: 'replay_final_seq_mismatch' };
  }
  return result;
}

function verifyTankReplayInputs(options = {}) {
  const events = Array.isArray(options.events) ? options.events : [];
  const matchId = String(options.matchId || '');
  const playerCount = Math.max(2, Math.min(5, finiteInteger(options.playerCount, 2, 5) || 2));
  const startedAt = Number(options.startedAt) || 0;
  const durationMs = Math.max(10000, Number(options.durationMs) || 180000);
  if (!matchId || !startedAt || events.length > MAX_EVENTS) return { ok: false, status: 'invalid', reason: 'replay_tank_config_invalid', eventCount: 0 };
  let authority;
  try { authority = new TankAuthority({ matchId, playerCount, startedAt, durationMs }); }
  catch (_error) { return { ok: false, status: 'invalid', reason: 'replay_tank_authority_failed', eventCount: 0 }; }
  let previousAt = startedAt;
  let previousTimelineSeq = 0;
  let accepted = 0;
  for (const event of events) {
    const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : event;
    const at = Number(payload && payload.at);
    const timelineSeq = finiteInteger(payload && (payload.timelineSeq ?? (event && event.seq)), 1);
    const envelopeSeq = event && event.seq === undefined ? timelineSeq : finiteInteger(event && event.seq, 1);
    if (!payload || payload.protocol !== 'tank-authority-v1' || String(payload.matchId || '') !== matchId || !Number.isFinite(at) || at < previousAt || timelineSeq === null || timelineSeq <= previousTimelineSeq || envelopeSeq !== timelineSeq) {
      return { ok: false, status: 'invalid', reason: 'replay_tank_event_invalid', eventCount: accepted };
    }
    previousAt = at; previousTimelineSeq = timelineSeq;
    if (payload.source === 'server' && payload.kind === 'tick') {
      const expectedTick = finiteInteger(payload.serverTick, 1);
      if (expectedTick === null || expectedTick !== authority.serverTick + 1) return { ok: false, status: 'invalid', reason: 'replay_tank_tick_invalid', eventCount: accepted };
      authority.fixedStep(at);
      if (authority.serverTick !== expectedTick) return { ok: false, status: 'invalid', reason: 'replay_tank_tick_mismatch', eventCount: accepted };
    } else if (payload.source === 'client' && payload.kind === 'input') {
      const player = finiteInteger(event && event.player !== undefined ? event.player : payload.player, 0, playerCount - 1);
      const seq = finiteInteger(payload.seq, 1);
      if (player === null || seq === null) return { ok: false, status: 'invalid', reason: 'replay_tank_input_invalid', eventCount: accepted };
      if (payload.serverTick !== authority.serverTick) return { ok: false, status: 'invalid', reason: 'replay_tank_input_tick_invalid', eventCount: accepted };
      const result = authority.acceptInput(player, { matchId, seq, clientTick: payload.clientTick == null ? undefined : payload.clientTick, input: payload.input }, at);
      if (!result.ok) return { ok: false, status: 'invalid', reason: 'replay_tank_input_rejected', eventCount: accepted };
    } else return { ok: false, status: 'invalid', reason: 'replay_tank_source_invalid', eventCount: accepted };
    if (typeof payload.hash !== 'string' || !/^[0-9a-f]{8}$/.test(payload.hash) || payload.hash !== hashReplayProjection(authority.snapshot(at))) return { ok: false, status: 'invalid', reason: 'replay_tank_hash_mismatch', eventCount: accepted };
    accepted++;
  }
  return { ok: true, status: 'deterministic', protocol: PROTOCOL, game: 'tank', ruleProtocol: 'tank-authority-v1', eventCount: accepted, terminal: authority.finished || authority.stopped, reason: authority.finishReason || authority.stopReason || null, hash: hashReplayProjection(authority.snapshot(previousAt)), lastSeq: authority.lastSeq.slice() };
}

function lifecycleValueHash(value) {
  const text = JSON.stringify(value === undefined ? null : value);
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function verifyReplayLifecycle(options = {}) {
  const game = String(options.game || '');
  const matchId = String(options.matchId || '');
  const events = Array.isArray(options.events) ? options.events : [];
  if (!GAMES.includes(game) || !matchId || !events.length || events.length > MAX_EVENTS) {
    return { ok: false, status: 'not_available', reason: 'replay_lifecycle_missing', eventCount: 0 };
  }
  let previousAt = -Infinity;
  let previousTimelineSeq = 0;
  let terminalCount = 0;
  let terminalEvent = null;
  let automaticEventCount = 0;
  let authorityEventCount = 0;
  const reconnect = new Map();
  const instances = new Map();
  let previousInstanceOrder = 0;
  for (const event of events) {
    const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : event;
    const timelineSeq = finiteInteger(payload && payload.timelineSeq, 1);
    const at = Number(payload && payload.at);
    const kind = String(payload && payload.kind || '');
    if (!payload || payload.protocol !== LIFECYCLE_PROTOCOL || String(payload.matchId || '') !== matchId ||
      timelineSeq === null || timelineSeq <= previousTimelineSeq || !Number.isFinite(at) || at < previousAt ||
      !['start', 'authority', 'automatic', 'reconnect', 'instance', 'terminal'].includes(kind)) {
      return { ok: false, status: 'invalid', reason: 'replay_lifecycle_event_invalid', eventCount: authorityEventCount + automaticEventCount };
    }
    previousTimelineSeq = timelineSeq;
    previousAt = at;
    if (kind === 'start') {
      if (timelineSeq !== 1 || payload.source !== 'server') return { ok: false, status: 'invalid', reason: 'replay_lifecycle_start_invalid', eventCount: timelineSeq };
    } else if (kind === 'authority') {
      if (!['client', 'server'].includes(payload.source) || finiteInteger(payload.authoritySeq, 1) === null) return { ok: false, status: 'invalid', reason: 'replay_lifecycle_authority_invalid', eventCount: timelineSeq };
      authorityEventCount += 1;
    } else if (kind === 'automatic') {
      if (payload.source !== 'server') return { ok: false, status: 'invalid', reason: 'replay_lifecycle_automatic_invalid', eventCount: timelineSeq };
      automaticEventCount += 1;
    } else if (kind === 'reconnect') {
      const player = finiteInteger(payload.player, 0, 4);
      const epoch = finiteInteger(payload.epoch, 1);
      const phase = String(payload.phase || '');
      if (player === null || epoch === null || !['disconnect', 'resume'].includes(phase)) return { ok: false, status: 'invalid', reason: 'replay_lifecycle_reconnect_invalid', eventCount: timelineSeq };
      const previous = reconnect.get(player) || { epoch: 0, phase: 'resume' };
      if (epoch < previous.epoch || (epoch === previous.epoch && phase === previous.phase) ||
        (phase === 'disconnect' && previous.phase === 'disconnect') || (phase === 'resume' && previous.phase !== 'disconnect')) {
        return { ok: false, status: 'invalid', reason: 'replay_lifecycle_reconnect_order_invalid', eventCount: timelineSeq };
      }
      reconnect.set(player, { epoch, phase });
    } else if (kind === 'instance') {
      const instanceId = String(payload.instanceId || '');
      const instanceSeq = finiteInteger(payload.instanceSeq, 1);
      const globalOrder = finiteInteger(payload.globalOrder, 1);
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(instanceId) || instanceSeq === null || globalOrder === null || globalOrder <= previousInstanceOrder) {
        return { ok: false, status: 'invalid', reason: 'replay_lifecycle_instance_order_invalid', eventCount: timelineSeq };
      }
      const previousInstanceSeq = instances.get(instanceId) || 0;
      if (instanceSeq <= previousInstanceSeq) return { ok: false, status: 'invalid', reason: 'replay_lifecycle_instance_seq_invalid', eventCount: timelineSeq };
      instances.set(instanceId, instanceSeq);
      previousInstanceOrder = globalOrder;
    } else if (kind === 'terminal') {
      terminalCount += 1;
      if (terminalCount > 1 || payload.source !== 'server' || payload.terminal !== true || typeof payload.authorityHash !== 'string' || !/^[0-9a-f]{8,128}$/.test(payload.authorityHash)) {
        return { ok: false, status: 'invalid', reason: 'replay_lifecycle_terminal_invalid', eventCount: timelineSeq };
      }
      terminalEvent = payload;
    }
  }
  if (terminalCount !== 1 || !terminalEvent || terminalEvent.timelineSeq !== previousTimelineSeq) {
    return { ok: false, status: 'invalid', reason: 'replay_lifecycle_terminal_missing', eventCount: events.length };
  }
  const expected = options.expected || {};
  if (expected.terminal === true && terminalEvent.terminal !== true) return { ok: false, status: 'invalid', reason: 'replay_lifecycle_terminal_mismatch', eventCount: events.length };
  if (Array.isArray(expected.order) && JSON.stringify(terminalEvent.order || []) !== JSON.stringify(expected.order)) return { ok: false, status: 'invalid', reason: 'replay_lifecycle_order_mismatch', eventCount: events.length };
  if (expected.authorityHash && terminalEvent.authorityHash !== expected.authorityHash) return { ok: false, status: 'invalid', reason: 'replay_lifecycle_hash_mismatch', eventCount: events.length };
  const reconnectVerified = [...reconnect.values()].every(item => item.phase === 'resume');
  const crossInstance = options.clusterEnabled === true;
  return {
    ok: true,
    status: 'deterministic_lifecycle',
    protocol: LIFECYCLE_PROTOCOL,
    game,
    eventCount: events.length,
    authorityEventCount,
    automaticEventCount,
    terminalVerified: true,
    reconnectVerified,
    crossInstanceStatus: crossInstance ? (instances.size > 1 ? 'verified' : 'single_instance_only') : 'not_available_without_cluster',
    terminalHash: lifecycleValueHash(terminalEvent),
  };
}

module.exports = Object.freeze({ PROTOCOL, LIFECYCLE_PROTOCOL, GAMES, createReplayVerifier, verifyReplayInputs, verifyReplayLifecycle, lifecycleValueHash, normalizeAction, normalizeRecord });
