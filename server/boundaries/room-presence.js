'use strict';

/*
 * T7 Room/Presence vertical slice.
 *
 * The external Interface is deliberately limited to room(command) and
 * presence(command). Seat normalization, membership transitions, reconnect
 * replacement, lobby filtering and public presence privacy live behind that
 * seam. WebSocket transport, match settlement and game authorities remain in
 * server/index.js and consume result-only outcomes from this module.
 */

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 40000;
const LANGUAGES = new Set(['zh-CN', 'en-US', 'uk-UA']);

function frozen(value) {
  return Object.freeze(value);
}

function ownObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  return String(value === undefined || value === null ? '' : value);
}

function finiteInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function iterableValues(value) {
  if (value instanceof Map || value instanceof Set) return [...value.values()];
  if (Array.isArray(value)) return value.slice();
  return Object.values(ownObject(value));
}

function roomEntries(value) {
  if (value instanceof Map) return [...value.entries()];
  if (Array.isArray(value)) return value.map(room => [text(room && room.id), room]);
  return Object.entries(ownObject(value));
}

function clonePlain(value) {
  if (value === undefined) return undefined;
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_error) {}
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_error) { return Array.isArray(value) ? [] : value && typeof value === 'object' ? {} : value; }
}

function cloneJsonObject(value) {
  try {
    const serialized = JSON.stringify(value);
    const parsed = serialized === undefined ? null : JSON.parse(serialized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function isPlainRecord(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function createJsonRuntimeRoomPresenceAdapter(options = {}) {
  const readRooms = typeof options.readRooms === 'function' ? options.readRooms : null;
  const readSessions = typeof options.readSessions === 'function' ? options.readSessions : null;
  const readUsers = typeof options.readUsers === 'function' ? options.readUsers : null;
  const putRoom = typeof options.putRoom === 'function' ? options.putRoom : null;
  const removeRoom = typeof options.removeRoom === 'function' ? options.removeRoom : null;
  if (!readRooms || !readSessions || !readUsers || !putRoom || !removeRoom) {
    throw new TypeError('room_presence_runtime_adapter_callbacks_required');
  }
  return frozen({
    read() {
      return { rooms: readRooms(), sessions: readSessions(), users: readUsers() };
    },
    putRoom(room) {
      if (!room || typeof room !== 'object' || !text(room.id)) throw new TypeError('room_presence_room_required');
      putRoom(room);
      return room;
    },
    removeRoom(roomId) {
      return removeRoom(text(roomId));
    },
  });
}

function createMemoryRoomPresenceAdapter(initial = {}) {
  const sessions = new Set();
  const sessionCopies = new Map();
  const sessionCopiesByKey = new Map();
  const knownSessionSources = new Set();
  const sessionKey = source => {
    if (!source || typeof source !== 'object') return '';
    const id = text(source.sessionId);
    const token = text(source.tokenHash);
    return id ? id + '|' + token : '';
  };
  const rememberSession = source => {
    if (source && typeof source === 'object') knownSessionSources.add(source);
  };
  const rememberRoomSessions = source => {
    if (!source || typeof source !== 'object') return;
    rememberSession(source.host);
    if (source.clients instanceof Map) for (const session of source.clients.keys()) rememberSession(session);
    if (source.spectators instanceof Map) for (const session of source.spectators.keys()) rememberSession(session);
  };

  let cloneSession;
  function cloneMemoryValue(value, memo) {
    if (!value || typeof value !== 'object') return value;
    if (sessions.has(value)) return value;
    if (sessionCopies.has(value)) return sessionCopies.get(value);
    if (knownSessionSources.has(value)) return cloneSession(value, memo);
    if (memo.has(value)) return memo.get(value);
    if (Array.isArray(value)) {
      const copy = new Array(value.length);
      memo.set(value, copy);
      for (const key of Object.keys(value)) copy[key] = cloneMemoryValue(value[key], memo);
      return copy;
    }
    if (value instanceof Map) {
      const copy = new Map();
      memo.set(value, copy);
      for (const [key, child] of value) copy.set(cloneMemoryValue(key, memo), cloneMemoryValue(child, memo));
      return copy;
    }
    if (value instanceof Set) {
      const copy = new Set();
      memo.set(value, copy);
      for (const child of value) copy.add(cloneMemoryValue(child, memo));
      return copy;
    }
    if (value instanceof Date) {
      const copy = new Date(value.getTime());
      memo.set(value, copy);
      return copy;
    }
    if (value instanceof RegExp) {
      const copy = new RegExp(value.source, value.flags);
      copy.lastIndex = value.lastIndex;
      memo.set(value, copy);
      return copy;
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
      const copy = Buffer.from(value);
      memo.set(value, copy);
      return copy;
    }
    if (value instanceof ArrayBuffer) {
      const copy = value.slice(0);
      memo.set(value, copy);
      return copy;
    }
    if (ArrayBuffer.isView(value)) {
      try {
        const copy = typeof structuredClone === 'function' ? structuredClone(value) : new value.constructor(value);
        memo.set(value, copy);
        return copy;
      } catch (_error) {
        memo.set(value, value);
        return value;
      }
    }
    // Authorities, timers and other runtime handles are deliberately opaque.
    // Their identity carries behaviour; copying their enumerable internals
    // would create a broken pseudo-instance.  Plain state nested anywhere in
    // rooms, sessions or users is copied recursively instead.
    if (!isPlainRecord(value)) {
      memo.set(value, value);
      return value;
    }
    const copy = Object.create(Object.getPrototypeOf(value));
    memo.set(value, copy);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable) continue;
      copy[key] = cloneMemoryValue(value[key], memo);
    }
    return copy;
  }

  cloneSession = (source, memo = new Map()) => {
    if (!source || typeof source !== 'object') return source;
    // A canonical session may be encountered again while a room is being
    // persisted.  Keep the same object identity so room.client Maps and the
    // session Set remain one coherent graph.
    if (sessions.has(source)) return source;
    if (sessionCopies.has(source)) return sessionCopies.get(source);
    const key = sessionKey(source);
    if (key && sessionCopiesByKey.has(key)) {
      const existing = sessionCopiesByKey.get(key);
      sessionCopies.set(source, existing);
      memo.set(source, existing);
      return existing;
    }
    const copy = Object.create(Object.getPrototypeOf(source) === null ? null : Object.prototype);
    sessionCopies.set(source, copy);
    sessionCopies.set(copy, copy);
    memo.set(source, copy);
    if (key) sessionCopiesByKey.set(key, copy);
    sessions.add(copy);
    for (const property of Reflect.ownKeys(source)) {
      const descriptor = Object.getOwnPropertyDescriptor(source, property);
      if (!descriptor || !descriptor.enumerable) continue;
      copy[property] = cloneMemoryValue(source[property], memo);
    }
    return copy;
  };

  const initialSessions = iterableValues(initial.sessions);
  const initialRooms = roomEntries(initial.rooms);
  for (const source of initialSessions) rememberSession(source);
  for (const [, source] of initialRooms) rememberRoomSessions(source);
  const initialMemo = new Map();
  for (const source of initialSessions) cloneSession(source, initialMemo);

  const users = {};
  for (const [uid, user] of Object.entries(ownObject(initial.users))) users[uid] = cloneMemoryValue(user, initialMemo);

  const rooms = new Map();
  const cloneRoom = (roomId, source, memo = new Map()) => {
    if (!source || typeof source !== 'object') return null;
    rememberRoomSessions(source);
    let copy = cloneMemoryValue(source, memo);
    // Room roots are plain runtime records today.  Keep a defensive forced
    // copy for a future record prototype while leaving nested authority/timer
    // handles opaque as documented above.
    if (copy === source) {
      copy = Object.create(Object.getPrototypeOf(source));
      memo.set(source, copy);
      for (const property of Reflect.ownKeys(source)) {
        const descriptor = Object.getOwnPropertyDescriptor(source, property);
        if (!descriptor || !descriptor.enumerable) continue;
        copy[property] = cloneMemoryValue(source[property], memo);
      }
    }
    copy.id = text(source.id || roomId);
    copy.host = cloneSession(source.host, memo);
    copy.clients = source.clients instanceof Map ? cloneMemoryValue(source.clients, memo) : new Map();
    copy.spectators = source.spectators instanceof Map ? cloneMemoryValue(source.spectators, memo) : new Map();
    return copy;
  };
  for (const [roomId, source] of initialRooms) {
    if (!source || typeof source !== 'object') continue;
    const copy = cloneRoom(roomId, source, initialMemo);
    if (copy) rooms.set(copy.id, copy);
  }

  return frozen({
    read() { return { rooms, sessions, users }; },
    putRoom(room) {
      if (!room || typeof room !== 'object' || !text(room.id)) throw new TypeError('room_presence_room_required');
      const id = text(room.id);
      const existing = rooms.get(id);
      // Persisting the canonical object is intentionally a no-op.  This
      // preserves references held by the boundary and callers while still
      // isolating a newly supplied source graph on first registration.
      if (existing === room) return room;
      const copy = cloneRoom(id, room, new Map());
      rooms.set(id, copy);
      return copy;
    },
    removeRoom(roomId) { return rooms.delete(text(roomId)); },
  });
}

function validAdapter(adapter) {
  return !!adapter && typeof adapter.read === 'function' &&
    typeof adapter.putRoom === 'function' && typeof adapter.removeRoom === 'function';
}

function createRoomPresenceBoundary(options = {}) {
  const adapter = options.adapter;
  if (!validAdapter(adapter)) throw new TypeError('room_presence_adapter_required');
  if (typeof options.now !== 'function') throw new TypeError('room_presence_clock_required');
  const clock = options.now;
  const heartbeatTimeoutMs = finiteInteger(options.heartbeatTimeoutMs, 1000, 10 * 60 * 1000, DEFAULT_HEARTBEAT_TIMEOUT_MS);
  const gameMin = frozen({ ...ownObject(options.gameMin) });
  const gameMax = frozen({ ...ownObject(options.gameMax) });
  const normalizeVisibility = typeof options.normalizeVisibility === 'function' ? options.normalizeVisibility : value => value === 'private' ? 'private' : 'public';
  const normalizeAIDifficulty = typeof options.normalizeAIDifficulty === 'function' ? options.normalizeAIDifficulty : value => text(value) || 'normal';
  const normalizeAIPersona = typeof options.normalizeAIPersona === 'function' ? options.normalizeAIPersona : value => text(value) || 'teacher';
  const publicPlayerCharacter = typeof options.publicPlayerCharacter === 'function' ? options.publicPlayerCharacter : value => clonePlain(value || {});
  const isHiddenUid = typeof options.isHiddenUid === 'function' ? options.isHiddenUid : () => false;
  const isFriend = typeof options.isFriend === 'function' ? options.isFriend : () => false;
  const isAllowedBetween = typeof options.isAllowedBetween === 'function' ? options.isAllowedBetween : () => true;
  const gameplayMetadata = typeof options.gameplayMetadata === 'function' ? options.gameplayMetadata : () => null;
  const secureEqual = typeof options.secureEqual === 'function' ? options.secureEqual : (left, right) => text(left) === text(right);
  const cancelTimer = typeof options.cancelTimer === 'function' ? options.cancelTimer : timer => clearTimeout(timer);

  function result(ok, fields = {}) {
    return freezeProjection({ ok: !!ok, ...fields });
  }

  function now() {
    const value = Number(clock());
    if (!Number.isFinite(value) || value < 0) throw new Error('room_presence_clock_invalid');
    return value;
  }

  function state() {
    const current = adapter.read();
    if (!current || !(current.rooms instanceof Map) || !(current.sessions instanceof Set)) {
      throw new Error('room_presence_adapter_state_invalid');
    }
    return { rooms: current.rooms, sessions: current.sessions, users: current.users instanceof Map ? current.users : ownObject(current.users) };
  }

  function persist(room) {
    if (!room || typeof room !== 'object' || !text(room.id)) throw new Error('room_presence_room_required');
    try {
      const stored = adapter.putRoom(room);
      return stored && typeof stored === 'object' ? stored : room;
    } catch (_error) {
      throw new Error('room_presence_persist_failed');
    }
  }

  // Room/Presence mutations are graph operations: a room owns the client
  // Map/seat array while each client owns its room/player fields.  Capture
  // enumerable own properties before a write so an Adapter failure cannot
  // leave half of that graph committed.  The Adapter seam is intentionally
  // tiny, but both concrete adapters expose their canonical Maps/Sets through
  // read(), allowing a best-effort in-memory store restoration as well.
  function snapshotObject(value) {
    if (!value || typeof value !== 'object') return null;
    const values = new Map();
    const containers = new Map();
    for (const key of Object.keys(value)) {
      const current = value[key];
      values.set(key, current);
      if (current instanceof Map) containers.set(key, { kind: 'map', copy: new Map(current) });
      else if (current instanceof Set) containers.set(key, { kind: 'set', copy: new Set(current) });
      else if (Array.isArray(current)) containers.set(key, { kind: 'array', copy: current.slice() });
    }
    return { value, values, containers };
  }

  function restoreObject(snapshot) {
    if (!snapshot || !snapshot.value || typeof snapshot.value !== 'object') return;
    const target = snapshot.value;
    for (const key of Object.keys(target)) {
      if (!snapshot.values.has(key)) {
        try { delete target[key]; } catch (_error) {}
      }
    }
    for (const [key, value] of snapshot.values) {
      const container = snapshot.containers && snapshot.containers.get(key);
      try {
        if (container && container.kind === 'map' && value instanceof Map) {
          value.clear();
          for (const [entryKey, entryValue] of container.copy) value.set(entryKey, entryValue);
          target[key] = value;
        } else if (container && container.kind === 'set' && value instanceof Set) {
          value.clear();
          for (const entry of container.copy) value.add(entry);
          target[key] = value;
        } else if (container && container.kind === 'array' && Array.isArray(value)) {
          value.splice(0, value.length, ...container.copy);
          target[key] = value;
        } else target[key] = value;
      } catch (_error) {}
    }
  }

  function graphSnapshot(current, room, extraSessions = []) {
    const sessions = new Set(extraSessions.filter(session => session && typeof session === 'object'));
    if (room && room.clients instanceof Map) for (const session of room.clients.keys()) sessions.add(session);
    if (room && room.host) sessions.add(room.host);
    const roomId = room && text(room.id);
    return {
      room: snapshotObject(room),
      storedRoom: roomId && current.rooms instanceof Map ? current.rooms.get(roomId) : undefined,
      hadStoredRoom: !!(roomId && current.rooms instanceof Map && current.rooms.has(roomId)),
      roomId,
      sessions: [...sessions].map(snapshotObject).filter(Boolean),
      sessionSet: current.sessions instanceof Set ? new Set(current.sessions) : null,
    };
  }

  function restoreGraph(current, snapshot) {
    if (!snapshot) return;
    restoreObject(snapshot.room);
    for (const session of snapshot.sessions || []) restoreObject(session);
    // Restore the canonical Adapter graph without invoking a callback that
    // may itself be the failing operation.
    try {
      const after = adapter.read();
      if (snapshot.roomId && after && after.rooms instanceof Map) {
        if (snapshot.hadStoredRoom) after.rooms.set(snapshot.roomId, snapshot.storedRoom);
        else after.rooms.delete(snapshot.roomId);
      }
      if (snapshot.sessionSet && after && after.sessions instanceof Set) {
        after.sessions.clear();
        for (const session of snapshot.sessionSet) after.sessions.add(session);
      }
    } catch (_error) {}
  }

  function batchGraphSnapshot(current, targetRooms = [], extraSessions = []) {
    const roomSet = new Set(targetRooms.filter(room => room && typeof room === 'object'));
    const sessionSet = new Set(extraSessions.filter(session => session && typeof session === 'object'));
    for (const room of roomSet) {
      if (room.clients instanceof Map) for (const session of room.clients.keys()) sessionSet.add(session);
      if (room.host) sessionSet.add(room.host);
    }
    return {
      rooms: [...roomSet].map(snapshotObject).filter(Boolean),
      roomMap: current.rooms instanceof Map ? new Map(current.rooms) : null,
      sessions: [...sessionSet].map(snapshotObject).filter(Boolean),
      sessionSet: current.sessions instanceof Set ? new Set(current.sessions) : null,
    };
  }

  function restoreBatchGraph(current, snapshot) {
    if (!snapshot) return;
    for (const room of snapshot.rooms || []) restoreObject(room);
    for (const session of snapshot.sessions || []) restoreObject(session);
    try {
      const after = adapter.read();
      if (snapshot.roomMap && after && after.rooms instanceof Map) {
        after.rooms.clear();
        for (const [roomId, room] of snapshot.roomMap) after.rooms.set(roomId, room);
      }
      if (snapshot.sessionSet && after && after.sessions instanceof Set) {
        after.sessions.clear();
        for (const session of snapshot.sessionSet) after.sessions.add(session);
      }
    } catch (_error) {}
  }

  function canonicalSession(session, current, options = {}) {
    if (!session || typeof session !== 'object') return null;
    if (current.sessions.has(session)) return session;
    const sessionId = text(session.sessionId);
    const tokenHash = text(session.tokenHash);
    const uid = text(session.uid);
    for (const candidate of current.sessions) {
      if (!candidate || typeof candidate !== 'object') continue;
      if (sessionId && tokenHash && uid && text(candidate.sessionId) === sessionId && text(candidate.uid) === uid && candidate.tokenHash) {
        try {
          if (secureEqual(candidate.tokenHash, tokenHash)) return candidate;
        } catch (_error) {}
      }
    }
    return options.allowUnregistered === true ? session : null;
  }

  function sessionOnline(session, at) {
    if (!session || session.alive !== true || session.detached === true) return false;
    const lastSeen = Number(session.lastSeen);
    if (!Number.isFinite(lastSeen)) return false;
    const age = at - lastSeen;
    return Number.isFinite(age) && age >= 0 && age < heartbeatTimeoutMs;
  }

  function safeAllowedBetween(left, right) {
    if (!left || !right || left === right) return true;
    try { return isAllowedBetween(left, right) !== false; }
    catch (_error) { return false; }
  }

  function userByUid(users, uid) {
    return users instanceof Map ? users.get(text(uid)) : users[text(uid)];
  }

  function roomFrom(command, rooms) {
    const id = text(command && (command.roomId || command.id || command.room && command.room.id));
    // Always prefer the Adapter's canonical reference.  Accepting an
    // arbitrary caller-owned room object here lets an isolated Adapter be
    // bypassed and causes mutations to disappear on the next read().
    const stored = id ? rooms.get(id) : null;
    if (stored) return stored;
    // A caller-owned object with an id is never an implicit registration.
    // Requiring an Adapter reference keeps stale rooms from bypassing the
    // seam after close/unregister or across isolated test lanes.
    return null;
  }

  function safeCharacter(value) {
    // Player Character is a public JSON wire projection.  Re-serialize the
    // injected projector result so Map/Set/class instances, cycles and
    // mutable references cannot cross the seam as pseudo-DTOs.  The input is
    // detached before invoking the projector as well: a faulty projector must
    // not be able to mutate canonical user/session state through a read path.
    try { return cloneJsonObject(publicPlayerCharacter(clonePlain(value || {}))); }
    catch (_error) { return {}; }
  }

  function emptySeat(seatId) {
    return {
      seatId, type: 'empty', userId: null, nickname: '', avatar: 0, frame: 0, effect: 0, nameFx: 0,
      lang: 'zh-CN', playerCharacter: safeCharacter(), ready: false, host: false, online: false,
      aiDifficulty: null, aiPersona: null, controllerUid: null,
    };
  }

  function humanSeat(session, seatId, host, users, at) {
    const user = session && session.uid ? userByUid(users, session.uid) : null;
    return {
      seatId, type: 'human', userId: session && session.uid || null,
      nickname: user && user.name || '玩家' + (seatId + 1), avatar: user && user.avatar || 0,
      frame: user && user.frame || 0, effect: user && user.effect || 0, nameFx: user && user.nameFx || 0,
      lang: user && user.lang || 'zh-CN', playerCharacter: safeCharacter(user && user.playerCharacter),
      ready: !!host, host: !!host,
      online: at === null || at === undefined ? !!(session && session.alive === true && session.detached !== true) : sessionOnline(session, at),
      aiDifficulty: null, aiPersona: null, controllerUid: null,
    };
  }

  // Seat normalization is split into a pure projection and an explicit write
  // operation.  Read commands must be able to inspect malformed canonical
  // state without repairing it as a side effect; write commands opt into the
  // assignment through normalizeRoomGraphForWrite below.
  function projectRoomGraph(room, users, at) {
    if (!room) return { capacity: 2, clients: new Map(), host: null, seats: [] };
    const capacity = finiteInteger(room.capacity, 2, 5, 2);
    const sourceClients = room.clients instanceof Map ? room.clients : new Map();
    const previous = Array.isArray(room.seats) ? room.seats : [];
    const next = Array.from({ length: capacity }, (_, seatId) => emptySeat(seatId));
    // AI seats are not represented in room.clients; preserve only valid AI
    // entries, then let canonical human membership win any collision.
    for (const candidate of previous) {
      const seatId = Number(candidate && candidate.seatId);
      if (candidate && candidate.type === 'ai' && Number.isInteger(seatId) && seatId >= 0 && seatId < capacity) {
        next[seatId] = { ...candidate, seatId, ready: true, online: true, host: false };
      }
    }
    const entries = [...sourceClients.entries()].sort((left, right) => Number(left[1]) - Number(right[1]));
    const normalized = new Map();
    const used = new Set();
    for (const [session, requestedSeat] of entries) {
      if (!session || typeof session !== 'object') continue;
      let seatId = Number.isInteger(requestedSeat) && requestedSeat >= 0 && requestedSeat < capacity && !used.has(requestedSeat)
        ? requestedSeat : next.findIndex((seat, index) => seat.type === 'empty' && !used.has(index));
      if (!Number.isInteger(seatId) || seatId < 0) continue;
      used.add(seatId);
      normalized.set(session, seatId);
      const seat = humanSeat(session, seatId, session === room.host, users, at);
      const previousSeat = previous[seatId];
      if (previousSeat && previousSeat.type === 'human' && previousSeat.userId === session.uid) seat.ready = !!previousSeat.ready;
      if (session === room.host) seat.ready = true;
      next[seatId] = seat;
    }
    const host = room.host && normalized.has(room.host) ? room.host : [...normalized.keys()][0] || null;
    for (const [session, seatId] of normalized) {
      const seat = next[seatId];
      if (seat) {
        seat.host = session === host;
        if (seat.host) seat.ready = true;
        seat.online = at === null || at === undefined ? session.alive === true && session.detached !== true : sessionOnline(session, at);
      }
    }
    return { capacity, clients: normalized, host, seats: next };
  }

  function normalizeRoomGraphForWrite(room, users, at) {
    const graph = projectRoomGraph(room, users, at);
    if (!room) return graph;
    room.capacity = graph.capacity;
    room.clients = graph.clients;
    room.host = graph.host;
    room.seats = graph.seats;
    return graph;
  }

  function inspectInternal(room, session, users, at) {
    const graph = projectRoomGraph(room, users, at);
    const seats = graph.seats;
    const activeSeats = seats.filter(seat => seat.type !== 'empty');
    const humanSeats = activeSeats.filter(seat => seat.type === 'human');
    const aiSeats = activeSeats.filter(seat => seat.type === 'ai');
    const firstEmptySeat = seats.find(seat => seat.type === 'empty') || null;
    const seatId = graph.clients.get(session);
    const sessionSeat = Number.isInteger(seatId) ? seats[seatId] || null : null;
    const min = room && room.game ? Number(gameMin[room.game]) : NaN;
    const max = room && room.game ? Number(gameMax[room.game]) : NaN;
    const canStart = !!(room && room.game && !room.started && Number.isFinite(min) && Number.isFinite(max) &&
      activeSeats.length >= min && activeSeats.length <= max && humanSeats.length > 0 &&
      humanSeats.every(seat => seat.online && seat.ready));
    const allOnline = !!room && [...graph.clients.keys()].every(client => sessionOnline(client, at));
    return {
      seats, activeSeats, humanSeats, aiSeats, firstEmptySeat, sessionSeat,
      activeCount: activeSeats.length, canStart, allOnline,
      capacity: graph.capacity, clients: graph.clients, host: graph.host,
    };
  }

  function freezeProjection(value, seen = new Map()) {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    // Public results are JSON-shaped.  If an injected dependency still
    // returns a Map/Set, detach it into a frozen array projection instead of
    // returning a mutable container (Object.freeze(Map) does not block set()).
    if (value instanceof Map) {
      const projected = [];
      seen.set(value, projected);
      for (const [key, child] of value) projected.push(freezeProjection([key, child], seen));
      return Object.freeze(projected);
    }
    if (value instanceof Set) {
      const projected = [];
      seen.set(value, projected);
      for (const child of value) projected.push(freezeProjection(child, seen));
      return Object.freeze(projected);
    }
    seen.set(value, value);
    for (const [key, child] of Object.entries(value)) {
      try { value[key] = freezeProjection(child, seen); } catch (_error) {}
    }
    try { Object.freeze(value); } catch (_error) {}
    return value;
  }

  function roomProjection(room, graph = null) {
    if (!room || typeof room !== 'object') return null;
    const capacity = graph && Number.isInteger(graph.capacity) ? graph.capacity : finiteInteger(room.capacity, 2, 5, 2);
    const host = graph && Object.prototype.hasOwnProperty.call(graph, 'host') ? graph.host : room.host;
    return freezeProjection({
      id: text(room.id), game: room.game || null, capacity,
      started: !!room.started, settled: !!room.settled, matchId: room.matchId || null,
      visibility: normalizeVisibility(room.visibility), allowSpectators: !!room.allowSpectators,
      testAdminSandbox: !!room.testAdminSandbox, hostUid: host && host.uid || null,
    });
  }

  function detailsProjection(details) {
    if (!details || typeof details !== 'object') return null;
    const seats = Array.isArray(details.seats) ? details.seats.map(publicSeat) : [];
    const activeSeats = Array.isArray(details.activeSeats) ? details.activeSeats.map(publicSeat) : [];
    const humanSeats = Array.isArray(details.humanSeats) ? details.humanSeats.map(publicSeat) : [];
    const aiSeats = Array.isArray(details.aiSeats) ? details.aiSeats.map(publicSeat) : [];
    return freezeProjection({
      seats, activeSeats, humanSeats, aiSeats,
      firstEmptySeat: details.firstEmptySeat ? publicSeat(details.firstEmptySeat) : null,
      sessionSeat: details.sessionSeat ? publicSeat(details.sessionSeat) : null,
      activeCount: Number(details.activeCount) || 0, canStart: !!details.canStart, allOnline: !!details.allOnline,
    });
  }

  function publicSeat(seat) {
    return freezeProjection({
      seatId: seat.seatId, type: seat.type, userId: seat.userId || null, nickname: seat.nickname || '',
      avatar: Number(seat.avatar) || 0, frame: Number(seat.frame) || 0, effect: Number(seat.effect) || 0,
      nameFx: Number(seat.nameFx) || 0, lang: LANGUAGES.has(seat.lang) ? seat.lang : 'zh-CN',
      playerCharacter: safeCharacter(seat.playerCharacter),
      ready: seat.type === 'ai' ? true : !!seat.ready, host: !!seat.host,
      online: seat.type === 'ai' ? true : !!seat.online,
      aiDifficulty: seat.type === 'ai' ? normalizeAIDifficulty(seat.aiDifficulty) : null,
      aiPersona: seat.type === 'ai' ? normalizeAIPersona(seat.aiPersona) : null,
      controllerUid: seat.type === 'ai' ? seat.controllerUid || null : null,
    });
  }

  function updateAIControllers(room, users, at) {
    const graph = normalizeRoomGraphForWrite(room, users, at);
    const controllerUid = graph.host && graph.host.uid || null;
    const aiSeats = graph.seats.filter(seat => seat.type === 'ai');
    for (const seat of aiSeats) seat.controllerUid = controllerUid;
    return aiSeats;
  }

  function compact(room, users, at) {
    const details = inspectInternal(room, null, users, at);
    const oldSeats = details.activeSeats.slice().sort((a, b) => a.seatId - b.seatId);
    const sessionByUid = new Map([...details.clients.keys()].map(session => [session.uid, session]));
    room.capacity = details.capacity;
    room.host = details.host;
    room.clients = new Map();
    room.seats = Array.from({ length: details.capacity }, (_, seatId) => emptySeat(seatId));
    const reassigned = [];
    oldSeats.forEach((oldSeat, seatId) => {
      const seat = { ...oldSeat, seatId, host: false };
      if (seat.type === 'human') {
        const session = sessionByUid.get(seat.userId);
        if (!session) return;
        const previous = session.player;
        session.player = seatId;
        room.clients.set(session, seatId);
        seat.host = session === details.host;
        seat.online = sessionOnline(session, at);
        if (previous !== seatId) reassigned.push({ uid: text(session.uid), sessionId: text(session.sessionId), previous, player: seatId });
      }
      room.seats[seatId] = seat;
    });
    updateAIControllers(room, users, at);
    return { seats: room.seats, reassigned };
  }

  function hostPayload(room, users, at) {
    const details = inspectInternal(room, null, users, at);
    const host = details.host;
    const seatId = host && details.clients instanceof Map ? details.clients.get(host) : null;
    return { uid: host && host.uid || null, seatId: Number.isInteger(seatId) ? seatId : null };
  }

  function payload(room, users, at) {
    const details = inspectInternal(room, null, users, at);
    const players = [...details.clients.entries()]
      .map(([session, player]) => ({ uid: session.uid || null, player, online: sessionOnline(session, at) }))
      .sort((left, right) => left.player - right.player);
    return freezeProjection({
      room: room.id, game: room.game || null, capacity: details.capacity, players,
      seats: details.seats.map(publicSeat), size: details.activeCount, activePlayerCount: details.activeCount,
      humanCount: details.humanSeats.length, aiCount: details.aiSeats.length,
      onlineSize: players.filter(player => player.online).length,
      spectatorCount: room.spectators instanceof Map ? room.spectators.size : 0,
      maxSpectators: room.maxSpectators || 20, started: !!room.started, settled: !!room.settled,
      matchId: room.matchId || null, visibility: normalizeVisibility(room.visibility),
      allowSpectators: !!room.allowSpectators, testAdminSandbox: !!room.testAdminSandbox,
      canStart: details.canStart, host: hostPayload(room, users, at), gameplay: clonePlain(gameplayMetadata(room)),
    });
  }

  function lobby(viewerUid, current) {
    const output = [];
    const at = now();
    for (const room of current.rooms.values()) {
      if (!room || room.testAdminSandbox) continue;
      const details = inspectInternal(room, null, current.users, at);
      if ([...details.clients.keys()].some(client => !sessionOnline(client, at))) continue;
      if (normalizeVisibility(room.visibility) !== 'public') continue;
      const joinLimit = room.game && gameMax[room.game] ? Math.min(details.capacity, Number(gameMax[room.game])) : details.capacity;
      const joinable = !room.started && details.activeCount < joinLimit && !!details.firstEmptySeat;
      const spectatable = !!room.allowSpectators && (room.spectators instanceof Map ? room.spectators.size : 0) < (room.maxSpectators || 20);
      if (!joinable && !spectatable) continue;
      const hostUser = details.host && details.host.uid ? userByUid(current.users, details.host.uid) : null;
      if (hostUser && hostUser.presencePreference === 'invisible') continue;
      if (viewerUid && [...details.clients.keys()].some(client => client.uid && client.uid !== viewerUid && !safeAllowedBetween(viewerUid, client.uid))) continue;
      output.push(freezeProjection({
        room: room.id, hostUid: details.host && details.host.uid || null,
        hostName: hostUser ? hostUser.name : '玩家', hostAvatar: hostUser ? hostUser.avatar : 0,
        hostFrame: hostUser ? hostUser.frame || 0 : 0, hostEffect: hostUser ? hostUser.effect || 0 : 0,
        hostNameFx: hostUser ? hostUser.nameFx || 0 : 0, hostLang: hostUser ? hostUser.lang || 'zh-CN' : 'zh-CN',
        capacity: details.capacity, size: details.activeCount, humanCount: details.humanSeats.length,
        aiCount: details.aiSeats.length, game: room.game || null, started: !!room.started,
        joinable, spectatable, spectatorCount: room.spectators instanceof Map ? room.spectators.size : 0,
        maxSpectators: room.maxSpectators || 0, matchId: room.matchId || null,
        status: room.started ? 'playing' : 'waiting', visibility: 'public',
        allowSpectators: !!room.allowSpectators, canJoin: joinable, canSpectate: spectatable,
        seats: details.seats.map(publicSeat),
      }));
    }
    return freezeProjection(output);
  }

  function register(command, current) {
    const room = command.room;
    if (!room || typeof room !== 'object' || !text(room.id)) return result(false, { reason: 'room_required' });
    const roomId = text(room.id);
    // Registration is creation, never replacement.  Reusing an occupied id
    // would orphan the old room's members while rooms.set() silently swaps the
    // canonical object underneath them.
    if (current.rooms.has(roomId)) return result(false, { reason: 'room_already_registered' });
    const sourceClients = room.clients instanceof Map ? room.clients : new Map(room.host ? [[room.host, 0]] : []);
    const clients = new Map();
    for (const [sourceSession, seatId] of sourceClients) {
      const session = canonicalSession(sourceSession, current);
      if (!session || session.alive !== true) return result(false, { reason: 'session_unavailable' });
      if (session.room && text(session.room) !== roomId) return result(false, { reason: 'already_in_room' });
      if (session.spectatorRoom) return result(false, { reason: 'already_spectating' });
      clients.set(session, seatId);
    }
    const host = room.host ? canonicalSession(room.host, current) : null;
    if (room.host && (!host || host.alive !== true || !clients.has(host))) return result(false, { reason: 'session_unavailable' });
    const snapshot = graphSnapshot(current, room, [...clients.keys(), host]);
    room.id = roomId;
    room.capacity = finiteInteger(room.capacity, 2, 5, 2);
    room.visibility = normalizeVisibility(room.visibility);
    room.clients = clients;
    room.host = host || [...clients.keys()][0] || null;
    if (!(room.spectators instanceof Map)) room.spectators = new Map();
    try {
      normalizeRoomGraphForWrite(room, current.users);
      const members = [];
      for (const [session, player] of room.clients) {
        session.room = roomId;
        session.player = player;
        session.resumeUntil = 0;
        session.detachedAt = 0;
        session.detached = false;
        members.push({ uid: text(session.uid), sessionId: text(session.sessionId), player });
      }
      const stored = persist(room);
      return result(true, { room: roomProjection(stored), roomId, members });
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function join(command, current) {
    const room = roomFrom(command, current.rooms);
    const session = canonicalSession(command.session, current);
    if (!room) return result(false, { reason: 'room_not_found' });
    if (!command.session || typeof command.session !== 'object') return result(false, { reason: 'session_required' });
    if (!session) return result(false, { reason: 'session_unavailable' });
    if (session.alive !== true) return result(false, { reason: 'session_unavailable' });
    const snapshot = graphSnapshot(current, room, [session]);
    const at = now();
    const normalized = normalizeRoomGraphForWrite(room, current.users, at);
    const details = inspectInternal(room, session, current.users, at);
    const reject = (reason, fields = {}) => {
      restoreGraph(current, snapshot);
      return result(false, { reason, ...fields });
    };
    if (room.started) return reject('match_started');
    if (details.activeCount >= details.capacity || !details.firstEmptySeat) return reject('room_full');
    if (room.game && gameMax[room.game] && details.activeCount + 1 > Number(gameMax[room.game])) {
      return reject('selected_game_capacity', { maximum: Number(gameMax[room.game]) });
    }
    if (session.uid && [...details.clients.keys()].some(client => client.uid === session.uid)) return reject('duplicate_room_account');
    if (session.uid && [...details.clients.keys()].some(client => client.uid && !safeAllowedBetween(session.uid, client.uid))) {
      return reject('blocked', { channel: 'social' });
    }
    if (session.room) return reject('already_in_room');
    const player = details.firstEmptySeat.seatId;
    room.clients = new Map(normalized.clients);
    room.seats = normalized.seats.slice();
    room.clients.set(session, player);
    room.seats[player] = humanSeat(session, player, false, current.users);
    session.room = room.id;
    session.player = player;
    try {
      const stored = persist(room);
      return result(true, { room: roomProjection(stored), roomId: text(room.id), player, sessionId: text(session.sessionId), uid: text(session.uid) });
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function remove(command, current) {
    const room = roomFrom(command, current.rooms);
    const session = canonicalSession(command.session, current, { allowUnregistered: command.allowUnregistered === true });
    if (!room || !session || !(room.clients instanceof Map) || !room.clients.has(session)) {
      return result(false, { reason: 'room_membership_missing' });
    }
    const snapshot = graphSnapshot(current, room, [session]);
    try {
      const wasHost = room.host === session;
      const player = room.clients.get(session);
      const reconnectTimer = session.reconnectTimer || null;
      room.clients.delete(session);
      normalizeRoomGraphForWrite(room, current.users);
      session.room = null;
      session.player = null;
      session.resumeUntil = 0;
      session.detachedAt = 0;
      session.detached = false;
      session.reconnectTimer = null;
      if (!room.clients.size) {
        room.host = null;
        if (command.deleteWhenEmpty !== false) {
          const removed = adapter.removeRoom(room.id);
          // A false return while the canonical room is still present is a
          // failed delete, even when the Adapter chose not to throw.  Treat it
          // exactly like a persistence exception so the room/session graph is
          // restored instead of reporting a phantom closed room.
          if (removed === false && current.rooms.has(room.id)) throw new Error('room_presence_remove_failed');
        }
        const output = result(true, { room: roomProjection(room), roomId: text(room.id), player, wasHost, hostChanged: false, closed: true, seats:[], reassigned:[], sessionId: text(session.sessionId), uid: text(session.uid) });
        if (reconnectTimer) try { cancelTimer(reconnectTimer); } catch (_error) {}
        return output;
      }
      let hostChanged = false;
      if (wasHost) {
        room.host = [...room.clients.entries()].sort((left, right) => {
          const onlineDiff = command.preferOnlineHost === true
            ? Number(left[0].alive === false) - Number(right[0].alive === false)
            : 0;
          return onlineDiff || left[1] - right[1];
        })[0][0];
        hostChanged = true;
      }
      const compacted = compact(room, current.users, now());
      const stored = persist(room);
      const output = result(true, { room: roomProjection(stored), roomId: text(room.id), player, wasHost, hostChanged, closed: false, hostUid: room.host && room.host.uid || null, seats:compacted.seats.map(publicSeat), reassigned:compacted.reassigned, sessionId: text(session.sessionId), uid: text(session.uid) });
      if (reconnectTimer) try { cancelTimer(reconnectTimer); } catch (_error) {}
      return output;
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function releaseMany(command, current) {
    const requested = Array.isArray(command.sessions) ? command.sessions : [];
    const sessions = [];
    for (const source of requested) {
      const session = canonicalSession(source, current, { allowUnregistered: command.allowUnregistered === true });
      if (!session) return result(false, { reason:'session_unavailable' });
      if (!sessions.includes(session)) sessions.push(session);
    }
    const targetPlans = [];
    const targetMembers = new Set();
    const targetIds = new Set();
    for (const sourceRoom of Array.isArray(command.targetRooms) ? command.targetRooms : []) {
      if (!sourceRoom || typeof sourceRoom !== 'object' || !text(sourceRoom.id)) return result(false, { reason:'target_room_required' });
      const roomId = text(sourceRoom.id);
      if (targetIds.has(roomId) || current.rooms.has(roomId)) return result(false, { reason:'room_already_registered' });
      targetIds.add(roomId);
      const sourceClients = sourceRoom.clients instanceof Map ? sourceRoom.clients : new Map(sourceRoom.host ? [[sourceRoom.host,0]] : []);
      const clients = new Map();
      for (const [sourceSession, seatId] of sourceClients) {
        const session = canonicalSession(sourceSession, current, { allowUnregistered: command.allowUnregistered === true });
        if (!session || session.alive !== true || !sessions.includes(session)) return result(false, { reason:'session_unavailable' });
        if (targetMembers.has(session)) return result(false, { reason:'duplicate_target_membership' });
        targetMembers.add(session);
        clients.set(session, seatId);
      }
      const host = sourceRoom.host ? canonicalSession(sourceRoom.host, current, { allowUnregistered: command.allowUnregistered === true }) : null;
      if (sourceRoom.host && (!host || !clients.has(host))) return result(false, { reason:'session_unavailable' });
      targetPlans.push({ room:sourceRoom, roomId, clients, host:host || [...clients.keys()][0] || null });
    }
    const memberships = [];
    const stale = [];
    const sourceRooms = new Set();
    const spectatorMemberships = [];
    const staleSpectators = [];
    const spectatorRooms = new Set();
    for (const session of sessions) {
      const matches = [...current.rooms.values()].filter(room => room && room.clients instanceof Map && room.clients.has(session));
      const hostOnly = [...current.rooms.values()].filter(room => room && room.host === session && !(room.clients instanceof Map && room.clients.has(session)));
      if (matches.length > 1 || hostOnly.length) return result(false, { reason:'room_membership_ambiguous' });
      if (!matches.length) {
        stale.push(session);
        continue;
      }
      const room = matches[0];
      if (session.room && text(session.room) !== text(room.id)) return result(false, { reason:'room_membership_mismatch' });
      memberships.push({ room, session, player:room.clients.get(session), wasHost:room.host === session });
      sourceRooms.add(room);
    }
    for (const session of sessions) {
      const matches = [...current.rooms.values()].filter(room => room && room.spectators instanceof Map && room.spectators.has(session));
      if (matches.length > 1) return result(false, { reason:'spectator_membership_ambiguous' });
      if (!matches.length) {
        if (session.spectatorRoom) staleSpectators.push(session);
        continue;
      }
      const room = matches[0];
      if (session.spectatorRoom && text(session.spectatorRoom) !== text(room.id)) return result(false, { reason:'spectator_membership_mismatch' });
      spectatorMemberships.push({ room, session });
      spectatorRooms.add(room);
    }
    const snapshot = batchGraphSnapshot(current, [...sourceRooms, ...spectatorRooms, ...targetPlans.map(plan => plan.room)], sessions);
    const timers = [];
    try {
      const changes = new Map();
      for (const membership of memberships) {
        const { room, session, player, wasHost } = membership;
        const change = changes.get(room) || { room, roomId:text(room.id), started:!!room.started, hostChanged:false, closed:false, removed:[], reassigned:[] };
        if (session.reconnectTimer) timers.push(session.reconnectTimer);
        room.clients.delete(session);
        session.room = null;
        session.player = null;
        session.resumeUntil = 0;
        session.detachedAt = 0;
        session.detached = false;
        session.reconnectTimer = null;
        change.hostChanged = change.hostChanged || wasHost;
        change.removed.push({ uid:text(session.uid), sessionId:text(session.sessionId), player });
        changes.set(room, change);
      }
      for (const session of stale) {
        if (session.reconnectTimer) timers.push(session.reconnectTimer);
        session.room = null;
        session.player = null;
        session.resumeUntil = 0;
        session.detachedAt = 0;
        session.detached = false;
        session.reconnectTimer = null;
      }
      const spectatorReleases = [];
      for (const membership of spectatorMemberships) {
        membership.room.spectators.delete(membership.session);
        membership.session.spectatorRoom = null;
        spectatorReleases.push({
          uid:text(membership.session.uid), sessionId:text(membership.session.sessionId), roomId:text(membership.room.id),
        });
      }
      for (const session of staleSpectators) {
        spectatorReleases.push({ uid:text(session.uid), sessionId:text(session.sessionId), roomId:text(session.spectatorRoom) });
        session.spectatorRoom = null;
      }
      for (const change of changes.values()) {
        const room = change.room;
        if (!room.clients.size) {
          room.host = null;
          room.seats = Array.from({ length:finiteInteger(room.capacity, 2, 5, 2) }, (_, seatId) => emptySeat(seatId));
          const removed = adapter.removeRoom(room.id);
          if (removed === false && current.rooms.has(room.id)) throw new Error('room_presence_remove_failed');
          change.closed = true;
          continue;
        }
        if (!room.host || !room.clients.has(room.host)) {
          room.host = [...room.clients.entries()].sort((left, right) => {
            const onlineDiff = command.preferOnlineHost === true
              ? Number(left[0].alive === false) - Number(right[0].alive === false)
              : 0;
            return onlineDiff || left[1] - right[1];
          })[0][0];
        }
        if (command.compactSources === false) {
          normalizeRoomGraphForWrite(room, current.users, now());
          updateAIControllers(room, current.users, now());
        } else {
          const compacted = compact(room, current.users, now());
          change.reassigned = compacted.reassigned;
        }
        persist(room);
      }
      for (const room of spectatorRooms) {
        if (!changes.has(room) && current.rooms.has(text(room.id))) persist(room);
      }
      const targets = [];
      for (const plan of targetPlans) {
        const room = plan.room;
        room.id = plan.roomId;
        room.capacity = finiteInteger(room.capacity, 2, 5, 2);
        room.visibility = normalizeVisibility(room.visibility);
        room.clients = plan.clients;
        room.host = plan.host;
        if (!(room.spectators instanceof Map)) room.spectators = new Map();
        normalizeRoomGraphForWrite(room, current.users);
        const members = [];
        for (const [session, player] of room.clients) {
          session.room = room.id;
          session.player = player;
          session.resumeUntil = 0;
          session.detachedAt = 0;
          session.detached = false;
          members.push({ uid:text(session.uid), sessionId:text(session.sessionId), player });
        }
        const stored = persist(room);
        targets.push({ roomId:room.id, room:roomProjection(stored), members });
      }
      const output = result(true, {
        changes:[...changes.values()].map(change => ({
          roomId:change.roomId, started:change.started, hostChanged:change.hostChanged,
          closed:change.closed, hostUid:change.room.host && change.room.host.uid || null,
          removed:change.removed, reassigned:change.reassigned,
        })),
        targets,
        retired:sessions.filter(session => !targetMembers.has(session)).map(session => ({ uid:text(session.uid), sessionId:text(session.sessionId) })),
        spectatorReleases,
      });
      for (const timer of timers) try { cancelTimer(timer); } catch (_error) {}
      return output;
    } catch (error) {
      restoreBatchGraph(current, snapshot);
      throw error;
    }
  }

  function detach(command, current) {
    const room = roomFrom(command, current.rooms);
    const session = canonicalSession(command.session, current, { allowUnregistered: command.allowUnregistered === true });
    if (!room || !session || !session.uid || !session.tokenHash || !room.started || !room.clients.has(session)) {
      return result(false, { reason: 'reconnect_not_available' });
    }
    const snapshot = graphSnapshot(current, room, [session]);
    try {
      const at = now();
      const graceMs = finiteInteger(command.graceMs, 1000, 24 * 60 * 60 * 1000, 60000);
      session.detachedAt = at;
      session.resumeUntil = at + graceMs;
      session.detached = true;
      const graph = normalizeRoomGraphForWrite(room, current.users, at);
      const player = graph.clients.get(session);
      if (Number.isInteger(player) && graph.seats[player]) graph.seats[player].online = false;
      const stored = persist(room);
      return result(true, { room: roomProjection(stored), roomId: text(room.id), player, resumeUntil: session.resumeUntil, sessionId: text(session.sessionId), uid: text(session.uid) });
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function resume(command, current) {
    if (!command.session || !current.sessions.has(command.session)) return result(false, { reason: 'resume_session_unavailable' });
    const session = canonicalSession(command.session, current);
    if (!session || !session.uid || !session.tokenHash) return result(false, { reason: 'session_required' });
    if (session.alive !== true || session.room || session.spectatorRoom || session.player !== null && session.player !== undefined) {
      return result(false, { reason: 'resume_session_unavailable' });
    }
    const at = now();
    for (const room of current.rooms.values()) {
      for (const [oldSession, player] of room.clients instanceof Map ? room.clients : []) {
        const resumeUntil = Number(oldSession && oldSession.resumeUntil);
        if (!oldSession || oldSession === session || oldSession.uid !== session.uid || oldSession.detached !== true || !Number.isFinite(resumeUntil) || resumeUntil <= at) continue;
        let tokenMatches = false;
        try { tokenMatches = secureEqual(oldSession.tokenHash, session.tokenHash) === true; } catch (_error) { tokenMatches = false; }
        if (!tokenMatches) continue;
        const snapshot = graphSnapshot(current, room, [oldSession, session]);
        try {
          const reconnectTimer = oldSession.reconnectTimer || null;
          oldSession.reconnectTimer = null;
          room.clients.delete(oldSession);
          room.clients.set(session, player);
          if (room.host === oldSession) room.host = session;
          // A replaced transport must be inert everywhere, including isolated
          // Adapter state, so late callbacks cannot resurrect its old seat.
          oldSession.room = null;
          oldSession.player = null;
          oldSession.resumeUntil = 0;
          oldSession.detachedAt = 0;
          oldSession.detached = false;
          current.sessions.delete(oldSession);
          session.room = room.id;
          session.player = player;
          session.detached = false;
          session.detachedAt = 0;
          const seats = normalizeRoomGraphForWrite(room, current.users, at).seats;
          const seat = seats[player];
          if (seat) {
            seat.online = sessionOnline(session, at);
            seat.userId = session.uid;
            seat.host = room.host === session;
          }
          session.resumeUntil = 0;
          const stored = persist(room);
          const output = result(true, { room: roomProjection(stored), roomId: text(room.id), player, oldSessionId: text(oldSession.sessionId), sessionId: text(session.sessionId), uid: text(session.uid), isHost: room.host === session });
          if (reconnectTimer) try { cancelTimer(reconnectTimer); } catch (_error) {}
          return output;
        } catch (error) {
          restoreGraph(current, snapshot);
          throw error;
        }
      }
    }
    return result(false, { reason: 'resume_not_found' });
  }

  function mutationRoom(command, current, options = {}) {
    const room = roomFrom(command, current.rooms);
    if (!room) return { ok: false, reason: 'room_not_found' };
    const session = canonicalSession(command.session, current);
    if (!session) return { ok: false, reason: 'session_unavailable' };
    if (!(room.clients instanceof Map) || !room.clients.has(session)) return { ok: false, reason: 'room_membership_missing' };
    if (options.hostOnly !== false && room.host !== session) return { ok: false, reason: 'host_only' };
    return { ok: true, room, session };
  }

  function setReady(command, current) {
    const access = mutationRoom(command, current, { hostOnly: false });
    if (!access.ok) return result(false, { reason: access.reason });
    const { room, session } = access;
    if (room.started) return result(false, { reason: 'match_started' });
    // A non-host caller may set only their own seat; host status is always
    // ready.  Canonical membership has already been checked above.
    const member = canonicalSession(command.session, current);
    if (!member || !(room.clients instanceof Map) || !room.clients.has(member)) return result(false, { reason: 'room_membership_missing' });
    const snapshot = graphSnapshot(current, room, [member]);
    try {
      const graph = normalizeRoomGraphForWrite(room, current.users);
      const seatId = graph.clients.get(member);
      const seats = graph.seats;
      const seat = Number.isInteger(seatId) ? seats[seatId] : null;
      if (!seat || seat.type !== 'human') {
        restoreGraph(current, snapshot);
        return result(false, { reason: 'room_membership_missing' });
      }
      seat.ready = member === room.host ? true : command.ready !== false;
      const stored = persist(room);
      return result(true, { room: roomProjection(stored), roomId: text(room.id), player: seatId, ready: !!seat.ready, uid: text(member.uid) });
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function resetReady(command, current) {
    const room = roomFrom(command, current.rooms);
    if (!room) return result(false, { reason: 'room_not_found' });
    const actor = canonicalSession(command.session, current);
    if (!actor || room.host !== actor) return result(false, { reason: actor ? 'host_only' : 'session_unavailable' });
    const snapshot = graphSnapshot(current, room, [actor]);
    try {
      const seats = normalizeRoomGraphForWrite(room, current.users).seats;
      for (const seat of seats) if (seat.type === 'human') seat.ready = !!seat.host;
      const stored = persist(room);
      return result(true, { room: roomProjection(stored), roomId: text(room.id) });
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function addAI(command, current) {
    const access = mutationRoom(command, current);
    if (!access.ok) return result(false, { reason: access.reason });
    const { room, session } = access;
    if (room.started) return result(false, { reason: 'match_started' });
    const snapshot = graphSnapshot(current, room, [session]);
    const at = now();
    normalizeRoomGraphForWrite(room, current.users, at);
    const details = inspectInternal(room, null, current.users, at);
    const maximum = room.game && gameMax[room.game] ? Number(gameMax[room.game]) : room.capacity;
    if (details.activeCount >= Math.min(room.capacity, maximum) || !details.firstEmptySeat) {
      restoreGraph(current, snapshot);
      return result(false, { reason: 'no_ai_seat' });
    }
    const seatId = Number.isInteger(Number(command.seatId)) ? Number(command.seatId) : details.firstEmptySeat.seatId;
    if (seatId < 0 || seatId >= room.capacity || !details.seats[seatId] || details.seats[seatId].type !== 'empty') {
      restoreGraph(current, snapshot);
      return result(false, { reason: 'no_ai_seat' });
    }
    const ai = ownObject(command.ai);
    const difficulty = normalizeAIDifficulty(command.difficulty || ai.difficulty);
    const persona = normalizeAIPersona(command.persona || ai.persona);
    try {
      room.seats[seatId] = {
        seatId, type: 'ai', userId: null,
        nickname: text(ai.nickname || command.nickname).slice(0, 80) || 'AI',
        avatar: finiteInteger(ai.avatar || command.avatar, 0, 100000, 141), frame: finiteInteger(ai.frame || command.frame, 0, 100000, 0),
        effect: finiteInteger(ai.effect || command.effect, 0, 100000, 0), nameFx: finiteInteger(ai.nameFx || command.nameFx, 0, 100000, 0),
        lang: LANGUAGES.has(ai.lang || command.lang) ? (ai.lang || command.lang) : 'zh-CN',
        playerCharacter: safeCharacter(ai.playerCharacter || command.playerCharacter),
        ready: true, host: false, online: true, aiDifficulty: difficulty, aiPersona: persona,
        controllerUid: session.uid || null,
      };
      const stored = persist(room);
      return result(true, { room: roomProjection(stored), roomId: text(room.id), seat: publicSeat(room.seats[seatId]), player: seatId });
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function removeAI(command, current) {
    const access = mutationRoom(command, current);
    if (!access.ok) return result(false, { reason: access.reason });
    const { room, session } = access;
    if (room.started) return result(false, { reason: 'match_started' });
    const snapshot = graphSnapshot(current, room, [session]);
    const seatId = Number(command.seatId);
    const at = now();
    normalizeRoomGraphForWrite(room, current.users, at);
    const details = inspectInternal(room, null, current.users, at);
    const seat = Number.isInteger(seatId) && seatId >= 0 && seatId < details.seats.length ? details.seats[seatId] : null;
    if (!seat || seat.type !== 'ai') {
      restoreGraph(current, snapshot);
      return result(false, { reason: 'ai_seat_not_found' });
    }
    try {
      room.seats[seatId] = emptySeat(seatId);
      const compacted = compact(room, current.users, now());
      const stored = persist(room);
      return result(true, { room: roomProjection(stored), roomId: text(room.id), seats: compacted.seats.map(publicSeat), reassigned: compacted.reassigned });
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function unregister(command, current) {
    const roomId = text(command.roomId || command.id || command.room && command.room.id);
    const room = roomId ? current.rooms.get(roomId) : null;
    if (!room) {
      const removed = adapter.removeRoom(roomId);
      return result(true, { removed: !!removed, roomId, members: [] });
    }
    const snapshot = graphSnapshot(current, room);
    const timers = [];
    try {
      const members = [];
      for (const [session, player] of room.clients instanceof Map ? room.clients : []) {
        if (session.reconnectTimer) timers.push(session.reconnectTimer);
        session.room = null;
        session.player = null;
        session.resumeUntil = 0;
        session.detachedAt = 0;
        session.detached = false;
        session.reconnectTimer = null;
        members.push({ uid: text(session.uid), sessionId: text(session.sessionId), player });
      }
      room.clients = new Map();
      room.host = null;
      room.seats = Array.from({ length: finiteInteger(room.capacity, 2, 5, 2) }, (_, seatId) => emptySeat(seatId));
      const removed = adapter.removeRoom(roomId);
      if (removed === false && current.rooms.has(roomId)) throw new Error('room_presence_remove_failed');
      const output = result(true, { removed: !!removed, roomId, members });
      for (const timer of timers) try { cancelTimer(timer); } catch (_error) {}
      return output;
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function retireSession(command, current) {
    const session = canonicalSession(command.session, current, { allowUnregistered: command.allowUnregistered === true });
    if (!session) return result(false, { reason: 'session_unavailable' });
    for (const room of current.rooms.values()) {
      if (room && ((room.clients instanceof Map && room.clients.has(session)) || room.host === session)) {
        return result(false, { reason: 'room_membership_active' });
      }
    }
    const snapshot = graphSnapshot(current, null, [session]);
    const reconnectTimer = session.reconnectTimer || null;
    try {
      session.room = null;
      session.player = null;
      session.resumeUntil = 0;
      session.detachedAt = 0;
      session.detached = false;
      session.reconnectTimer = null;
      const output = result(true, { uid: text(session.uid), sessionId: text(session.sessionId) });
      if (reconnectTimer) try { cancelTimer(reconnectTimer); } catch (_error) {}
      return output;
    } catch (error) {
      restoreGraph(current, snapshot);
      throw error;
    }
  }

  function room(command = {}) {
    const action = text(command.action);
    try {
      const current = state();
      if (action === 'register') return register(command, current);
      if (action === 'unregister') return unregister(command, current);
      if (action === 'seat') {
        if (command.kind === 'empty') return result(true, { seat: emptySeat(Number(command.seatId) || 0) });
        if (command.kind === 'human') return result(true, { seat: humanSeat(canonicalSession(command.session, current), Number(command.seatId) || 0, command.host === true, current.users) });
        if (command.kind === 'public' && command.value) return result(true, { seat: publicSeat(command.value) });
        return result(false, { reason: 'seat_command_invalid' });
      }
      if (action === 'inspect') {
        const target = roomFrom(command, current.rooms);
        if (!target) return result(false, { reason: 'room_not_found' });
        const details = inspectInternal(target, canonicalSession(command.session, current, { allowUnregistered: true }), current.users, now());
        return result(true, { room: roomProjection(target, details), details: detailsProjection(details) });
      }
      if (action === 'compact') {
        const target = roomFrom(command, current.rooms);
        if (!target) return result(false, { reason: 'room_not_found' });
        const snapshot = graphSnapshot(current, target);
        try {
          const compacted = compact(target, current.users, now());
          const stored = persist(target);
          return result(true, { room: roomProjection(stored), roomId: text(target.id), seats: compacted.seats.map(publicSeat), reassigned: compacted.reassigned });
        } catch (error) {
          restoreGraph(current, snapshot);
          throw error;
        }
      }
      if (action === 'update_ai_controllers') {
        const target = roomFrom(command, current.rooms);
        if (!target) return result(false, { reason: 'room_not_found' });
        const snapshot = graphSnapshot(current, target);
        try {
          const seats = updateAIControllers(target, current.users, now());
          const stored = persist(target);
          return result(true, { room: roomProjection(stored), roomId: text(target.id), seats: seats.map(publicSeat) });
        } catch (error) {
          restoreGraph(current, snapshot);
          throw error;
        }
      }
      if (action === 'payload') {
        const target = roomFrom(command, current.rooms);
        if (!target) return result(false, { reason: 'room_not_found' });
        return result(true, { payload: payload(target, current.users, now()) });
      }
      if (action === 'lobby') return result(true, { rooms: lobby(text(command.viewerUid), current) });
      if (action === 'join') return join(command, current);
      if (action === 'remove') return remove(command, current);
      if (action === 'release_many') return releaseMany(command, current);
      if (action === 'rehome_many') return releaseMany(command, current);
      if (action === 'detach') return detach(command, current);
      if (action === 'resume') return resume(command, current);
      if (action === 'set_ready') return setReady(command, current);
      if (action === 'reset_ready') return resetReady(command, current);
      if (action === 'add_ai') return addAI(command, current);
      if (action === 'remove_ai') return removeAI(command, current);
      if (action === 'retire_session') return retireSession(command, current);
      return result(false, { reason: 'unsupported_action' });
    } catch (_error) {
      return result(false, { reason: 'room_presence_unavailable' });
    }
  }

  function publicPresence(command, current) {
    const uid = text(command.uid);
    const storedUser = userByUid(current.users, uid);
    // Never let a caller-supplied projection override the Adapter's privacy
    // settings.  A missing canonical user is unknown and therefore offline.
    const user = storedUser && typeof storedUser === 'object' ? storedUser : null;
    if (!uid || isHiddenUid(uid)) return 'offline';
    if (!user) return 'offline';
    const visibility = user && user.presenceVisibility || 'everyone';
    if (!['everyone', 'friends', 'nobody'].includes(visibility)) return 'offline';
    const viewerUid = text(command.viewerUid);
    if (viewerUid && viewerUid !== uid) {
      if (visibility === 'nobody') return 'offline';
      if (visibility === 'friends' && !isFriend(viewerUid, uid)) return 'offline';
      if (!safeAllowedBetween(viewerUid, uid)) return 'offline';
    } else if (!viewerUid && visibility !== 'everyone') return 'offline';
    const preference = user && user.presencePreference || 'joinable';
    if (!['joinable', 'online', 'busy', 'invisible'].includes(preference) || preference === 'invisible') return 'offline';
    const at = now();
    const active = [...current.sessions].some(session => session.uid === uid && sessionOnline(session, at));
    if (!active) return 'offline';
    const playing = [...current.rooms.values()].some(room => room.started && room.clients instanceof Map && [...room.clients.keys()].some(session => session.uid === uid));
    return playing ? 'playing' : preference;
  }

  function presence(command = {}) {
    const action = text(command.action);
    try {
      const current = state();
      if (action === 'public') return result(true, { value: publicPresence(command, current) });
      if (action === 'online_uids') {
        const at = now();
        const uids = new Set();
        for (const session of current.sessions) {
          const user = session.uid && userByUid(current.users, session.uid);
          const visibility = user && user.presenceVisibility || 'everyone';
          // This projection has no viewer context, so it can only contain
          // accounts that explicitly opt into global visibility.  `friends`
          // requires a concrete viewer and `nobody` must never be exposed by
          // a leaderboard/global online index.
          if (session.uid && user && sessionOnline(session, at) &&
              !isHiddenUid(session.uid) && visibility === 'everyone' &&
              ['joinable', 'online', 'busy'].includes(user.presencePreference || 'joinable')) uids.add(session.uid);
        }
        return result(true, { uids: frozen([...uids]) });
      }
      return result(false, { reason: 'unsupported_action' });
    } catch (_error) {
      return result(false, { reason: 'room_presence_unavailable', value: 'offline', uids: frozen([]) });
    }
  }

  return frozen({ room, presence });
}

module.exports = frozen({
  createRoomPresenceBoundary,
  createJsonRuntimeRoomPresenceAdapter,
  createMemoryRoomPresenceAdapter,
});
