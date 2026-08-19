'use strict';

/*
 * T7 Match Protocol vertical slice.
 *
 * Authority classes remain the only owners of game state and legality. This
 * module owns the narrow server-side seam around them: input/transition
 * fences, categorical failures, deterministic effect ordering, and the
 * replaceable commit Adapter. It deliberately knows nothing about transport,
 * economy/history/social persistence, or transport wire parsing.
 */

const { PROTOCOL_VERSIONS, GAMEPLAY_ERROR_CODES, protocolError } = require('../gameplay/protocol');

const HANDLED_TYPES = Object.freeze(new Set(['tetris_action', 'xiangqi_action', 'monopoly_action']));
const MAX_JOURNAL = 256;
const MAX_REASON = 96;
const MAX_MATCH_ID = 256;
const MAX_GENERATION = Number.MAX_SAFE_INTEGER;
const MAX_PLAYERS = 5;

const AUTHORITY_SPECS = Object.freeze({
  tetris: Object.freeze({ game: 'tetris', protocol: PROTOCOL_VERSIONS.tetrisRules, key: 'tetrisRuleAuthority', action: 'acceptAction' }),
  xiangqi: Object.freeze({ game: 'xiangqi', protocol: PROTOCOL_VERSIONS.xiangqiRules, key: 'xiangqiRuleAuthority', action: 'acceptMove' }),
  monopoly: Object.freeze({ game: 'monopoly', protocol: PROTOCOL_VERSIONS.monopolyRules, key: 'monopolyRuleAuthority', action: 'acceptAction' }),
});
const ACTION_SPECS = Object.freeze({
  tetris_action: AUTHORITY_SPECS.tetris,
  xiangqi_action: AUTHORITY_SPECS.xiangqi,
  monopoly_action: AUTHORITY_SPECS.monopoly,
});

const SAFE_REASON_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/;
const SENSITIVE_REASON_RE = /(bearer|secret|token|password|credential|authorization|stack| at |\r|\n)/i;

function clone(value) {
  if (value === undefined || value === null) return value;
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_error) {}
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_error) {
    if (Array.isArray(value)) return value.map(item => clone(item));
    return value && typeof value === 'object' ? {} : value;
  }
}
function cloneRecord(value) {
  const result = clone(value);
  return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freeze(nested);
  return Object.freeze(value);
}
function result(fields) { return freeze(fields); }
function text(value, fallback = '') {
  try {
    if (value === undefined || value === null) return fallback;
    return String(value);
  } catch (_error) { return fallback; }
}
function boundedText(value, maximum, fallback = '') {
  const output = text(value, fallback);
  return output.length <= maximum ? output : fallback;
}
function safeInteger(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}
function safeReason(value, fallback = 'ERR_INVALID_STATE') {
  const candidate = boundedText(value, MAX_REASON);
  if (!candidate || !SAFE_REASON_RE.test(candidate) || SENSITIVE_REASON_RE.test(candidate)) return fallback;
  return candidate;
}
function protocolCode(value, fallback = 'ERR_INVALID_STATE') {
  const candidate = boundedText(value, MAX_REASON);
  return /^ERR_[A-Z0-9_]{1,80}$/.test(candidate) && Object.prototype.hasOwnProperty.call(GAMEPLAY_ERROR_CODES, candidate) ? candidate : fallback;
}
function effect(kind, fields) { return freeze({ kind, ...(fields || {}) }); }

function copyState(value) {
  const output = cloneRecord(value);
  const journal = Array.isArray(output.journal) ? output.journal : [];
  output.journal = journal.slice(-MAX_JOURNAL).map(item => cloneRecord(item));
  return output;
}
function validMessage(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && boundedText(value.type, 96) !== '';
}
function validEffect(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const kind = text(value.kind);
  if (kind === 'metric') return /^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/.test(text(value.name));
  if (kind === 'send' || kind === 'broadcast') return validMessage(value.message);
  if (kind === 'record') return safeInteger(value.player, 0) !== null && !!value.action && typeof value.action === 'object';
  if (kind === 'turn') return safeInteger(value.value, 0, 1024) !== null;
  if (kind === 'terminal') {
    return validMessage(value.message) && Array.isArray(value.order) && value.order.length > 0 &&
      value.order.length <= MAX_PLAYERS && value.order.every(item => safeInteger(item, 0, MAX_PLAYERS - 1) !== null) &&
      new Set(value.order).size === value.order.length && SAFE_REASON_RE.test(text(value.cause)) &&
      text(value.cause).length <= MAX_REASON;
  }
  return false;
}
function snapshotRoom(room) {
  if (!room || typeof room !== 'object') return null;
  const keys = ['gameplayResultSent', 'monopolyTurn', 'matchProtocolGeneration', 'matchGeneration', 'generation', 'matchEpoch'];
  const values = {};
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(room, key)) values[key] = room[key];
  return { room, values };
}
function restoreRoom(snapshot) {
  if (!snapshot || !snapshot.room) return;
  for (const key of ['gameplayResultSent', 'monopolyTurn', 'matchProtocolGeneration', 'matchGeneration', 'generation', 'matchEpoch']) {
    if (Object.prototype.hasOwnProperty.call(snapshot.values, key)) {
      try { snapshot.room[key] = snapshot.values[key]; } catch (_error) {}
    } else {
      try { delete snapshot.room[key]; } catch (_error) {}
    }
  }
}

// Rule Authorities mutate their own state before the effect Adapter is able
// to report whether the wire/settlement pipeline committed.  Keep a private
// checkpoint at the seam so an Adapter fault cannot consume a client seq or
// advance a revision without its corresponding effects.  `inputLog` is an
// append-only audit buffer; retaining its root and length avoids cloning an
// unbounded history on every action while still removing a failed append.
function snapshotAuthority(authority) {
  if (!authority || typeof authority !== 'object') return null;
  try {
    const values = new Map();
    for (const key of Reflect.ownKeys(authority)) {
      const descriptor = Object.getOwnPropertyDescriptor(authority, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) continue;
      const value = authority[key];
      if (key === 'inputLog' && Array.isArray(value)) {
        values.set(key, { kind: 'append', original: value, length: value.length });
      } else {
        values.set(key, { kind: 'value', original: value, copy: clone(value) });
      }
    }
    return { authority, values };
  } catch (_error) {
    return null;
  }
}

function restoreAuthorityValue(original, copy) {
  if (Array.isArray(original) && Array.isArray(copy)) {
    original.splice(0, original.length, ...clone(copy));
    return original;
  }
  if (original instanceof Map && copy instanceof Map) {
    original.clear();
    for (const [key, value] of copy) original.set(clone(key), clone(value));
    return original;
  }
  if (original instanceof Set && copy instanceof Set) {
    original.clear();
    for (const value of copy) original.add(clone(value));
    return original;
  }
  if (original && typeof original === 'object' && copy && typeof copy === 'object' &&
      !Array.isArray(original) && !Array.isArray(copy) &&
      (Object.getPrototypeOf(original) === Object.prototype || Object.getPrototypeOf(original) === null)) {
    for (const key of Reflect.ownKeys(original)) if (!Object.prototype.hasOwnProperty.call(copy, key)) {
      try { delete original[key]; } catch (_error) {}
    }
    for (const key of Reflect.ownKeys(copy)) {
      try { original[key] = clone(copy[key]); } catch (_error) {}
    }
    return original;
  }
  return clone(copy);
}

function restoreAuthority(snapshot) {
  if (!snapshot || !snapshot.authority) return;
  const authority = snapshot.authority;
  try {
    for (const key of Reflect.ownKeys(authority)) {
      if (!snapshot.values.has(key)) {
        const descriptor = Object.getOwnPropertyDescriptor(authority, key);
        if (descriptor && descriptor.configurable) {
          try { delete authority[key]; } catch (_error) {}
        }
      }
    }
    for (const [key, entry] of snapshot.values) {
      if (entry.kind === 'append') {
        if (Array.isArray(entry.original)) entry.original.length = entry.length;
        authority[key] = entry.original;
      } else {
        authority[key] = restoreAuthorityValue(entry.original, entry.copy);
      }
    }
  } catch (_error) {
    // A malformed/frozen test double must not turn a protocol error into an
    // exception. The caller still returns the categorical unavailable result.
  }
}

function commitWithAuthorityRollback(snapshot, command, fields, effects, commit) {
  const outcome = commit(command, fields, effects);
  if (!outcome || outcome.ok !== true) restoreAuthority(snapshot);
  return outcome;
}
function effectJournal(effects) {
  return effects.map(item => {
    const copy = cloneRecord(item);
    if (copy.message && typeof copy.message === 'object') copy.message = { type: text(copy.message.type, 'unknown') };
    if (copy.action && typeof copy.action === 'object') copy.action = { protocol: text(copy.action.protocol, 'unknown') };
    return copy;
  });
}

function createCommitAdapter(options = {}, persistence = null) {
  const required = ['send', 'broadcast', 'incrementMetric', 'recordAction', 'settle', 'stop'];
  for (const name of required) if (typeof options[name] !== 'function') throw new TypeError('match_protocol_adapter_invalid');
  const handlers = Object.freeze(Object.fromEntries(required.map(name => [name, options[name]])));
  const onEffect = typeof options.onEffect === 'function' ? options.onEffect : null;
  const onRollback = typeof options.onRollback === 'function' ? options.onRollback : null;
  let localState = copyState(options.initialState || {});

  function load() {
    if (!persistence || typeof persistence.read !== 'function') return copyState(localState);
    try { return copyState(persistence.read()); } catch (_error) { throw new Error('match_protocol_state_unavailable'); }
  }
  function save(next) {
    const state = copyState(next);
    if (persistence && typeof persistence.write === 'function') persistence.write(clone(state));
    else localState = state;
    return true;
  }
  function commit(input) {
    const source = input && typeof input === 'object' ? input : {};
    const room = source.room;
    const session = source.session;
    const effects = Array.isArray(source.effects) ? source.effects.map(clone) : [];
    if (!room || typeof room !== 'object') return result({ ok: false, reason: 'match_protocol_room_required' });
    if (effects.some(item => !validEffect(item))) return result({ ok: false, reason: 'match_protocol_effect_invalid' });
    const roomSnapshot = snapshotRoom(room);
    let state;
    try { state = load(); } catch (_error) { return result({ ok: false, reason: 'match_protocol_state_unavailable' }); }
    const applied = [];
    try {
      // Validate every shape before the first callback, preventing malformed
      // authority output from producing a prefix of wire effects.
      for (const item of effects) {
        if (item.kind === 'metric') handlers.incrementMetric(text(item.name));
        else if (item.kind === 'send') handlers.send(session, clone(item.message));
        else if (item.kind === 'broadcast') handlers.broadcast(room, clone(item.message));
        else if (item.kind === 'record') handlers.recordAction(room, item.player, clone(item.action));
        else if (item.kind === 'turn') room.monopolyTurn = item.value;
        else if (item.kind === 'terminal') {
          if (room.gameplayResultSent && item.force !== true) continue;
          room.gameplayResultSent = true;
          handlers.broadcast(room, clone(item.message));
          handlers.settle(room, clone(item.order), text(item.cause));
          handlers.stop(room);
        }
        applied.push(item);
      }
      const next = copyState(state);
      if (effects.length) {
        next.journal.push({ at: safeInteger(source.at, 0) || 0, effects: effectJournal(effects) });
        next.journal = next.journal.slice(-MAX_JOURNAL);
      }
      save(next);
      if (onEffect) for (const item of applied) onEffect(freeze(clone(item)));
      return result({ ok: true, applied: applied.length });
    } catch (_error) {
      restoreRoom(roomSnapshot);
      try { save(state); } catch (_stateRollbackError) {}
      try { if (onRollback) onRollback(freeze(applied.map(clone))); } catch (_rollbackError) {}
      return result({ ok: false, reason: 'match_protocol_effect_failed' });
    }
  }
  return Object.freeze({ load, save, commit });
}

function createJsonRuntimeMatchProtocolAdapter(options = {}) {
  const read = typeof options.read === 'function' ? options.read : (typeof options.readState === 'function' ? options.readState : (typeof options.load === 'function' ? options.load : null));
  const write = typeof options.write === 'function' ? options.write : (typeof options.writeState === 'function' ? options.writeState : (typeof options.save === 'function' ? options.save : null));
  if (!read || !write) throw new TypeError('match_protocol_runtime_adapter_callbacks_required');
  return createCommitAdapter(options, { read, write });
}
function createMemoryMatchProtocolAdapter(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  return createCommitAdapter({
    send: typeof source.send === 'function' ? source.send : () => {},
    broadcast: typeof source.broadcast === 'function' ? source.broadcast : () => {},
    incrementMetric: typeof source.incrementMetric === 'function' ? source.incrementMetric : () => {},
    recordAction: typeof source.recordAction === 'function' ? source.recordAction : () => {},
    settle: typeof source.settle === 'function' ? source.settle : () => {},
    stop: typeof source.stop === 'function' ? source.stop : () => {},
    onEffect: source.onEffect,
    onRollback: source.onRollback,
    initialState: source.initialState || source,
  });
}
function createRuntimeMatchProtocolAdapter(options = {}) { return createCommitAdapter(options); }
function validAdapter(adapter) { return !!adapter && typeof adapter.commit === 'function'; }

function roomGeneration(room) {
  if (!room || typeof room !== 'object') return null;
  for (const key of ['matchProtocolGeneration', 'matchGeneration', 'generation', 'matchEpoch', 'epoch']) {
    const value = safeInteger(room[key], 0, MAX_GENERATION);
    if (value !== null) return value;
  }
  return null;
}
function inputGeneration(input, payload) {
  for (const source of [input, payload]) {
    if (!source || typeof source !== 'object') continue;
    for (const key of ['matchProtocolGeneration', 'matchGeneration', 'generation', 'matchEpoch', 'epoch']) {
      const value = safeInteger(source[key], 0, MAX_GENERATION);
      if (value !== null) return value;
    }
  }
  return null;
}
function eventMatchId(message) {
  if (!message || typeof message !== 'object' || !message.payload || typeof message.payload !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(message.payload, 'matchId')) return null;
  return boundedText(message.payload.matchId, MAX_MATCH_ID, null);
}
function eventRevision(message) {
  if (!message || typeof message !== 'object' || !message.payload || typeof message.payload !== 'object') return null;
  return safeInteger(message.payload.revision, 0, MAX_GENERATION);
}

function createMatchProtocolBoundary(options = {}) {
  const adapter = options.adapter;
  if (!validAdapter(adapter)) throw new TypeError('match_protocol_adapter_required');
  if (typeof options.now !== 'function') throw new TypeError('match_protocol_clock_required');
  const clock = options.now;
  const roomState = new WeakMap();
  function now() {
    let value;
    try { value = Number(clock()); } catch (_error) { throw new Error('match_protocol_clock_invalid'); }
    if (!Number.isFinite(value) || value < 0) throw new Error('match_protocol_clock_invalid');
    return value;
  }
  function stateFor(room) {
    let state = roomState.get(room);
    const matchId = boundedText(room && room.matchId, MAX_MATCH_ID);
    const explicit = roomGeneration(room);
    if (!state) {
      state = { matchId, generation: explicit === null ? 0 : explicit, initialized: explicit !== null, revisions: new Map(), seq: new Map() };
      roomState.set(room, state);
      return state;
    }
    if (state.matchId !== matchId) {
      state.matchId = matchId;
      state.generation = explicit === null ? state.generation + 1 : explicit;
      state.initialized = explicit !== null;
      state.revisions.clear();
      state.seq.clear();
    } else if (explicit !== null && explicit > state.generation) {
      state.generation = explicit;
      state.initialized = true;
      state.revisions.clear();
      state.seq.clear();
    }
    return state;
  }
  function adoptInputGeneration(state, room, input, payload) {
    if (!state.initialized && roomGeneration(room) === null) {
      const supplied = inputGeneration(input, payload);
      const suppliedMatch = payload && typeof payload === 'object' ? boundedText(payload.matchId, MAX_MATCH_ID) : '';
      if (supplied !== null && suppliedMatch === boundedText(room && room.matchId, MAX_MATCH_ID)) state.generation = supplied;
    }
    state.initialized = true;
  }
  function commit(command, fields, effects) {
    let committed;
    try { committed = adapter.commit({ room: command.room, session: command.session, effects, at: command.at }); }
    catch (_error) { committed = null; }
    if (!committed || committed.ok !== true) return result({ handled: true, ok: false, protocol: fields.protocol, reason: 'match_protocol_unavailable', terminal: false });
    return result({ handled: true, ...fields });
  }
  function failure(command, protocol, code, reasonValue, metrics = []) {
    const safeCode = protocolCode(code, 'ERR_INVALID_STATE');
    const safeValue = safeReason(reasonValue, safeCode);
    const effects = metrics.map(name => effect('metric', { name }));
    effects.push(effect('send', { message: { type: 'gameplay_error', payload: protocolError(protocol, safeCode, safeValue !== safeCode ? { reason: safeValue } : null) } }));
    return commit(command, { ok: false, protocol, reason: safeValue || safeCode, terminal: false }, effects);
  }
  function unavailable(command, protocol, metrics = ['protocolErrors']) { return failure(command, protocol, 'ERR_INVALID_STATE', 'match_protocol_unavailable', metrics); }
  function terminalEffect(message, order, cause, force = false) {
    const output = { message: clone(message), order: clone(order), cause: safeReason(cause, 'rule_authority') };
    if (force === true) output.force = true;
    return effect('terminal', output);
  }
  function fence(command, spec, payload, state) {
    const room = command.room;
    if (room && room.started === false) return { ok: false, reason: 'not_active' };
    if (room && room.clients instanceof Map && command.session && !room.clients.has(command.session)) {
      return { ok: false, reason: 'not_member' };
    }
    const expectedMatch = boundedText(room && room.matchId, MAX_MATCH_ID);
    if (!expectedMatch) return { ok: false, reason: 'invalid_match' };
    const suppliedMatch = payload && typeof payload === 'object' ? boundedText(payload.matchId, MAX_MATCH_ID) : '';
    if (suppliedMatch !== expectedMatch) return { ok: false, reason: 'invalid_match' };
    const suppliedGeneration = inputGeneration(command, payload);
    if (suppliedGeneration !== null && suppliedGeneration !== state.generation) return { ok: false, reason: 'stale_generation' };
    const authority = room[spec.key];
    // Test doubles and older rolling instances may not expose matchId on the
    // authority object. When it is present it must agree; absence remains a
    // compatible opaque-authority case.
    if (!authority || (authority.matchId !== undefined && boundedText(authority.matchId, MAX_MATCH_ID) !== expectedMatch)) return { ok: false, reason: 'stale_match' };
    return { ok: true };
  }
  function playerFence(command, spec, payload, authority, state, player) {
    const base = fence(command, spec, payload, state);
    if (!base.ok) return base;
    const slot = safeInteger(player, 0, 1024);
    if (slot === null) return { ok: false, reason: 'ERR_INVALID_STATE' };
    const seq = safeInteger(payload && payload.seq, 1);
    // Real v2 authorities expose lastSeq and therefore get a strict boundary
    // fence. Opaque legacy test doubles may not expose sequence state; leave
    // malformed sequence handling to that authority for rolling compatibility.
    if (seq === null && Array.isArray(authority.lastSeq)) return { ok: false, reason: 'ERR_STALE_SEQ' };
    let last = state.seq.get(slot) || 0;
    if (Array.isArray(authority.lastSeq) && safeInteger(authority.lastSeq[slot], 0) !== null) last = Math.max(last, Number(authority.lastSeq[slot]));
    if (seq !== null && seq < last) return { ok: false, reason: 'ERR_STALE_SEQ' };
    if (seq !== null && seq === last && last > 0) return { ok: false, reason: 'ERR_DUPLICATE_ACTION' };
    return { ok: true, seq, slot };
  }
  function validateEvents(room, state, protocol, events) {
    for (const message of events.filter(Boolean)) {
      const match = eventMatchId(message);
      if (match !== null && match !== boundedText(room.matchId, MAX_MATCH_ID)) return { ok: false, reason: 'stale_match' };
      const generation = inputGeneration({}, message && message.payload);
      if (generation !== null && generation !== state.generation) return { ok: false, reason: 'stale_generation' };
      const revision = eventRevision(message);
      if (revision !== null && revision < (state.revisions.get(protocol) || 0)) return { ok: false, reason: 'stale_revision' };
    }
    return { ok: true };
  }

  function tetris(command, player, payload, authority, state) {
    const protocol = PROTOCOL_VERSIONS.tetrisRules;
    const checked = playerFence(command, AUTHORITY_SPECS.tetris, payload, authority, state, player);
    if (!checked.ok) return failure(command, protocol, checked.reason, checked.reason, checked.reason === 'ERR_STALE_SEQ' || checked.reason === 'ERR_DUPLICATE_ACTION' ? ['invalidTetrisActions', 'protocolErrors'] : ['protocolErrors']);
    const authoritySnapshot = snapshotAuthority(authority);
    if (!authoritySnapshot) return unavailable(command, protocol);
    let accepted; let at;
    try { at = now(); accepted = authority.acceptAction(checked.slot, payload, at); } catch (_error) { restoreAuthority(authoritySnapshot); return unavailable(command, protocol); }
    if (!accepted || accepted.ok !== true) {
      restoreAuthority(authoritySnapshot);
      const reasonValue = safeReason(accepted && accepted.reason, 'ERR_INVALID_STATE');
      // Rejected legality does not consume the sequence; corrected retries
      // with the same client seq remain possible.
      return failure(command, protocol, reasonValue, reasonValue, ['invalidTetrisActions', 'protocolErrors']);
    }
    let stateEvent;
    try { stateEvent = accepted.stateEvent || (typeof authority.stateEvent === 'function' ? authority.stateEvent(at) : null); } catch (_error) { restoreAuthority(authoritySnapshot); return unavailable(command, protocol); }
    if (!stateEvent || typeof stateEvent !== 'object') { restoreAuthority(authoritySnapshot); return unavailable(command, protocol); }
    const battleEvent = accepted.battle ? { type: 'tetris_rule_battle', payload: { matchId: command.room.matchId, revision: authority.revision, ...clone(accepted.battle) } } : null;
    const eventsValid = validateEvents(command.room, state, protocol, [battleEvent, stateEvent, accepted.result]);
    if (!eventsValid.ok) { restoreAuthority(authoritySnapshot); return failure(command, protocol, eventsValid.reason, eventsValid.reason, ['protocolErrors']); }
    const effects = [effect('metric', { name: 'tetrisInputs' })];
    if (accepted.battle) effects.push(effect('metric', { name: 'garbageEvents' }));
    effects.push(effect('record', { player: checked.slot, action: { protocol, action: clone(payload && payload.action) } }));
    if (battleEvent) effects.push(effect('broadcast', { message: battleEvent }));
    effects.push(effect('broadcast', { message: clone(stateEvent) }));
    const terminal = !!(accepted.result && !command.room.gameplayResultSent);
    if (terminal) effects.push(terminalEffect(accepted.result, accepted.result.order, 'tetris_rule_authority'));
    const committed = commitWithAuthorityRollback(authoritySnapshot, { ...command, at }, { ok: true, protocol, reason: null, terminal }, effects, commit);
    if (committed.ok) {
      if (checked.seq !== null) state.seq.set(checked.slot, checked.seq);
      const revision = eventRevision(stateEvent);
      if (revision !== null) state.revisions.set(protocol, Math.max(state.revisions.get(protocol) || 0, revision));
    }
    return committed;
  }
  function xiangqi(command, player, payload, authority, state) {
    const protocol = PROTOCOL_VERSIONS.xiangqiRules;
    const checked = playerFence(command, AUTHORITY_SPECS.xiangqi, payload, authority, state, player);
    if (!checked.ok) return failure(command, protocol, checked.reason, checked.reason,
      checked.reason === 'ERR_STALE_SEQ' || checked.reason === 'ERR_DUPLICATE_ACTION'
        ? ['invalidXiangqiMoves', 'protocolErrors'] : ['protocolErrors']);
    const authoritySnapshot = snapshotAuthority(authority);
    if (!authoritySnapshot) return unavailable(command, protocol);
    let accepted; let at;
    try { at = now(); accepted = authority.acceptMove(checked.slot, payload, at); } catch (_error) { restoreAuthority(authoritySnapshot); return unavailable(command, protocol); }
    if (!accepted || accepted.ok !== true) {
      const reasonValue = safeReason(accepted && accepted.reason, 'ERR_INVALID_STATE');
      if (accepted && accepted.timeout && accepted.timeout.payload) {
        const timeoutValid = validateEvents(command.room, state, protocol, [accepted.timeout]);
        if (!timeoutValid.ok) { restoreAuthority(authoritySnapshot); return failure(command, protocol, timeoutValid.reason, timeoutValid.reason, ['protocolErrors']); }
        const winner = safeInteger(accepted.timeout.payload.winner, 0, 1024);
        const loser = safeInteger(accepted.timeout.payload.loser, 0, 1024);
        // A late timeout callback must remain idempotent when the room has
        // already published a terminal result; `force` would re-broadcast a
        // second result through the Adapter.
        const effects = [effect('metric', { name: 'invalidXiangqiMoves' }), effect('metric', { name: 'protocolErrors' }), effect('metric', { name: 'clockTimeouts' }), terminalEffect(accepted.timeout, [winner === null ? 0 : winner, loser === null ? 1 : loser], 'xiangqi_rule_timeout')];
        const committed = commitWithAuthorityRollback(authoritySnapshot, { ...command, at }, { ok: false, protocol, reason: reasonValue, terminal: true }, effects, commit);
        if (committed.ok && checked.seq !== null) state.seq.set(checked.slot, Math.max(state.seq.get(checked.slot) || 0, checked.seq));
        return committed;
      }
      restoreAuthority(authoritySnapshot);
      return failure(command, protocol, reasonValue, reasonValue, ['invalidXiangqiMoves', 'protocolErrors']);
    }
    if (!accepted.event || typeof accepted.event !== 'object') { restoreAuthority(authoritySnapshot); return unavailable(command, protocol); }
    const eventsValid = validateEvents(command.room, state, protocol, [accepted.event, accepted.result]);
    if (!eventsValid.ok) { restoreAuthority(authoritySnapshot); return failure(command, protocol, eventsValid.reason, eventsValid.reason, ['protocolErrors']); }
    const effects = [effect('metric', { name: 'xiangqiMoves' }), effect('record', { player: checked.slot, action: { protocol, from: clone(payload && payload.from), to: clone(payload && payload.to) } }), effect('broadcast', { message: clone(accepted.event) })];
    const terminal = !!(accepted.result && !command.room.gameplayResultSent);
    if (terminal) effects.push(terminalEffect(accepted.result, accepted.result.order, 'xiangqi_rule_authority'));
    const committed = commitWithAuthorityRollback(authoritySnapshot, { ...command, at }, { ok: true, protocol, reason: null, terminal }, effects, commit);
    if (committed.ok) {
      if (checked.seq !== null) state.seq.set(checked.slot, checked.seq);
      const revision = eventRevision(accepted.event);
      if (revision !== null) state.revisions.set(protocol, Math.max(state.revisions.get(protocol) || 0, revision));
    }
    return committed;
  }
  function monopoly(command, player, payload, authority, state) {
    const protocol = PROTOCOL_VERSIONS.monopolyRules;
    const checked = playerFence(command, AUTHORITY_SPECS.monopoly, payload, authority, state, player);
    if (!checked.ok) return failure(command, protocol, checked.reason, checked.reason, ['protocolErrors']);
    const authoritySnapshot = snapshotAuthority(authority);
    if (!authoritySnapshot) return unavailable(command, protocol);
    let accepted; let at;
    try { at = now(); accepted = authority.acceptAction(checked.slot, payload, at); } catch (_error) { restoreAuthority(authoritySnapshot); return unavailable(command, protocol); }
    if (!accepted || accepted.ok !== true) {
      restoreAuthority(authoritySnapshot);
      const reasonValue = safeReason(accepted && accepted.reason, 'ERR_INVALID_STATE');
      return failure(command, protocol, reasonValue, reasonValue, ['protocolErrors']);
    }
    if (!accepted.event || typeof accepted.event !== 'object') { restoreAuthority(authoritySnapshot); return unavailable(command, protocol); }
    const eventsValid = validateEvents(command.room, state, protocol, [accepted.event, accepted.result]);
    if (!eventsValid.ok) { restoreAuthority(authoritySnapshot); return failure(command, protocol, eventsValid.reason, eventsValid.reason, ['protocolErrors']); }
    const effects = [effect('metric', { name: 'monopolyActions' })];
    if (payload && payload.action && payload.action.type === 'pass') effects.push(effect('metric', { name: 'auctionCount' }));
    effects.push(effect('turn', { value: authority.state && authority.state.current }), effect('record', { player: checked.slot, action: { protocol, action: clone(payload && payload.action) } }), effect('broadcast', { message: clone(accepted.event) }));
    const terminal = !!(accepted.result && !command.room.gameplayResultSent);
    if (terminal) effects.push(terminalEffect(accepted.result, accepted.result.order, 'monopoly_rule_authority'));
    const committed = commitWithAuthorityRollback(authoritySnapshot, { ...command, at }, { ok: true, protocol, reason: null, terminal }, effects, commit);
    if (committed.ok) {
      if (checked.seq !== null) state.seq.set(checked.slot, checked.seq);
      const revision = eventRevision(accepted.event);
      if (revision !== null) state.revisions.set(protocol, Math.max(state.revisions.get(protocol) || 0, revision));
    }
    return committed;
  }

  function transitionSpec(input) {
    const type = text(input && input.type);
    if (/^tetris_(?:transition|advance)$/.test(type) || text(input && input.game) === 'tetris') return AUTHORITY_SPECS.tetris;
    if (/^xiangqi_(?:transition|advance)$/.test(type) || text(input && input.game) === 'xiangqi') return AUTHORITY_SPECS.xiangqi;
    if (/^monopoly_(?:transition|advance)$/.test(type) || text(input && input.game) === 'monopoly') return AUTHORITY_SPECS.monopoly;
    return null;
  }
  function transition(input = {}) {
    const spec = transitionSpec(input);
    if (!spec) return result({ handled: false });
    const room = input.room && typeof input.room === 'object' ? input.room : {};
    const session = input.session && typeof input.session === 'object' ? input.session : {};
    const state = stateFor(room);
    const command = { type: text(input.type) || spec.game + '_transition', room, session, payload: input.payload, at: undefined };
    const authority = room[spec.key];
    if (!authority) return failure(command, spec.protocol, 'ERR_PROTOCOL_VERSION', 'ERR_PROTOCOL_VERSION', ['protocolErrors']);
    const payload = input.payload && typeof input.payload === 'object' ? input.payload : { matchId: room.matchId };
    adoptInputGeneration(state, room, input, payload);
    const checked = fence(command, spec, payload, state);
    if (!checked.ok) return failure(command, spec.protocol, checked.reason, checked.reason, ['protocolErrors']);
    const authoritySnapshot = snapshotAuthority(authority);
    if (!authoritySnapshot) return unavailable(command, spec.protocol);
    let advanced; let at;
    try { at = now(); advanced = authority.advance(at); } catch (_error) { restoreAuthority(authoritySnapshot); return unavailable(command, spec.protocol); }
    if (!advanced || typeof advanced !== 'object') { restoreAuthority(authoritySnapshot); return unavailable(command, spec.protocol); }
    const event = advanced.stateEvent || advanced.event || null;
    const resultMessage = advanced.result || null;
    const revision = eventRevision(event || resultMessage);
    const previousRevision = state.revisions.get(spec.protocol) || 0;
    if (revision !== null && revision < previousRevision) { restoreAuthority(authoritySnapshot); return failure(command, spec.protocol, 'ERR_INVALID_STATE', 'stale_revision', ['protocolErrors']); }
    if (advanced.changed && revision !== null && revision <= previousRevision && previousRevision > 0) {
      restoreAuthority(authoritySnapshot);
      return failure(command, spec.protocol, 'ERR_INVALID_STATE', 'stale_revision', ['protocolErrors']);
    }
    if (!advanced.changed && !event && !resultMessage) return result({ handled: true, ok: true, protocol: spec.protocol, changed: false, terminal: false, reason: null });
    const eventsValid = validateEvents(room, state, spec.protocol, [event, resultMessage]);
    if (!eventsValid.ok) { restoreAuthority(authoritySnapshot); return failure(command, spec.protocol, eventsValid.reason, eventsValid.reason, ['protocolErrors']); }
    const effects = [];
    // Tetris already exposes this metric in the legacy timer path. Xiangqi
    // and Monopoly transitions intentionally keep their historical metric
    // surface unchanged.
    if (spec.game === 'tetris' && advanced.changed) effects.push(effect('metric', { name: 'tetrisSnapshots' }));
    if (event) effects.push(effect('broadcast', { message: clone(event) }));
    const terminal = !!(resultMessage && !room.gameplayResultSent);
    if (terminal) {
      const cause = spec.game + '_rule_' + (spec.game === 'xiangqi' ? 'timeout' : 'authority');
      if (spec.game === 'xiangqi' && event) {
        effects.pop();
        effects.push(terminalEffect(event, resultMessage.order, cause, true));
      } else effects.push(terminalEffect(resultMessage, resultMessage.order, cause));
    }
    const committed = commitWithAuthorityRollback(authoritySnapshot, { ...command, at }, { ok: true, protocol: spec.protocol, reason: null, terminal, changed: !!advanced.changed }, effects, commit);
    if (committed.ok && revision !== null) state.revisions.set(spec.protocol, Math.max(previousRevision, revision));
    return committed;
  }
  function command(input = {}) {
    const type = text(input.type);
    if (!HANDLED_TYPES.has(type)) return result({ handled: false });
    const room = input.room && typeof input.room === 'object' ? input.room : {};
    const session = input.session && typeof input.session === 'object' ? input.session : {};
    const state = stateFor(room);
    const commandInput = { type, room, session, payload: input.payload, at: undefined };
    const spec = ACTION_SPECS[type];
    const authority = room[spec.key];
    if (!authority) return failure(commandInput, spec.protocol, 'ERR_PROTOCOL_VERSION', 'ERR_PROTOCOL_VERSION', ['protocolErrors']);
    const payload = input.payload;
    adoptInputGeneration(state, room, input, payload);
    if (!payload || typeof payload !== 'object') return failure(commandInput, spec.protocol, 'ERR_INVALID_STATE', 'invalid_match', ['protocolErrors']);
    const player = input.player !== undefined ? input.player : session.player;
    if (spec === AUTHORITY_SPECS.tetris) return tetris(commandInput, player, payload, authority, state);
    if (spec === AUTHORITY_SPECS.xiangqi) return xiangqi(commandInput, player, payload, authority, state);
    return monopoly(commandInput, player, payload, authority, state);
  }
  const api = { command, transition };
  Object.defineProperty(api, 'action', { value: command, enumerable: false, configurable: false, writable: false });
  // `advance` is an additive internal spelling used by timer callers; keep
  // it non-enumerable so the original `{ command }` surface remains stable to
  // older consumers while new callers can share the transition pipeline.
  Object.defineProperty(api, 'advance', { value: transition, enumerable: false, configurable: false, writable: false });
  return Object.freeze(api);
}

const exported = { createMatchProtocolBoundary, createRuntimeMatchProtocolAdapter, createMemoryMatchProtocolAdapter };
Object.defineProperty(exported, 'createJsonRuntimeMatchProtocolAdapter', { value: createJsonRuntimeMatchProtocolAdapter, enumerable: false, configurable: false, writable: false });
module.exports = Object.freeze(exported);
