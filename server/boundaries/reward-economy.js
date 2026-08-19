'use strict';

/*
 * T7 Reward/Economy persistence vertical slice.
 *
 * Reward numbers and profile projection remain owned by reward-engine.js and
 * the existing settlement caller.  This boundary owns the dangerous part
 * that used to be mixed into server/index.js: detached result outbox state,
 * per-account serialization, resultId idempotency, and remote retry.  It is
 * deliberately transport-, SQL-, and UI-free so a future Supabase adapter
 * can replace the JSON runtime without changing the result wire.
 */

const PROTOCOL = 'reward-economy-v1';
const UID_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const RESULT_ID_RE = /^[A-Za-z0-9._:-]{3,160}$/;
const MAX_PENDING = 10000;
const MAX_OPPONENTS = 32;
const MAX_REASONS = 32;
const MAX_BREAKDOWN = 32;
const MAX_TEXT = 160;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const PRIVATE_KEY_RE = /(?:token|password|passwd|pin|secret|authorization|session|safe[_-]?snapshot)/i;

function text(value) {
  try { return String(value === undefined || value === null ? '' : value); }
  catch (_) { return ''; }
}

function ownRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const proto = Object.getPrototypeOf(value);
    return (proto === Object.prototype || proto === null) &&
      !Object.keys(value).some(key => FORBIDDEN_KEYS.has(key));
  } catch (_) {
    return false;
  }
}

function clone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return null;
  if (Array.isArray(value)) {
    seen.add(value);
    const output = value.map(item => clone(item, seen));
    seen.delete(value);
    return output;
  }
  if (!ownRecord(value)) return undefined;
  seen.add(value);
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!FORBIDDEN_KEYS.has(key) && !PRIVATE_KEY_RE.test(key)) output[key] = clone(item, seen);
  }
  seen.delete(value);
  return output;
}

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const item of Object.values(value)) freeze(item, seen);
  return Object.freeze(value);
}

function output(ok, fields = {}) {
  const source = ownRecord(fields) ? clone(fields) : {};
  delete source.ok;
  return freeze({ ok: !!ok, ...source });
}

function success(fields = {}) { return output(true, fields); }

function failure(reason, fields = {}) {
  const safe = /^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/.test(text(reason)) ? text(reason) : 'server_unavailable';
  return output(false, { reason: safe, ...fields });
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

function safeTimestamp(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function safeText(value, maximum = MAX_TEXT) {
  return text(value).normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maximum);
}

function safeArray(value, mapper, maximum) {
  return (Array.isArray(value) ? value : []).map(mapper).filter(item => item !== null).slice(0, maximum);
}

function safeBreakdown(value) {
  return safeArray(value, item => {
    if (!ownRecord(item)) return null;
    const code = safeText(item.code, 64);
    if (!/^[a-z][a-z0-9_.:-]{1,63}$/.test(code)) return null;
    const result = { code, currency: Math.max(-1000000, Math.min(1000000, safeInteger(item.currency))), xp: Math.max(-1000000, Math.min(1000000, safeInteger(item.xp))) };
    if (item.reason !== undefined) result.reason = safeText(item.reason, 64);
    if (item.tier !== undefined) result.tier = safeText(item.tier, 32);
    if (item.cap !== undefined) result.cap = Math.max(0, safeInteger(item.cap));
    if (item.levels !== undefined) result.levels = Math.max(0, safeInteger(item.levels));
    if (item.streak !== undefined) result.streak = Math.max(0, safeInteger(item.streak));
    return result;
  }, MAX_BREAKDOWN);
}

function sanitizeRow(value) {
  if (!ownRecord(value)) return null;
  const uid = text(value.uid).trim();
  const resultId = text(value.resultId).trim();
  if (!UID_RE.test(uid) || !RESULT_ID_RE.test(resultId)) return null;
  const game = safeText(value.game, 32);
  const mode = safeText(value.mode, 16);
  if (!game || !mode) return null;
  const row = {
    uid,
    game,
    coins: Math.max(0, safeInteger(value.coins)),
    xp: Math.max(0, safeInteger(value.xp)),
    at: safeTimestamp(value.at, Date.now()),
    resultId,
    matchId: value.matchId === null || value.matchId === undefined ? null : safeText(value.matchId, MAX_TEXT),
    mode,
    result: ['win', 'draw', 'loss'].includes(text(value.result)) ? text(value.result) : 'loss',
    placement: Math.max(1, safeInteger(value.placement, 1)),
    opponentIds: safeArray(value.opponentIds, item => UID_RE.test(text(item)) ? text(item) : null, MAX_OPPONENTS),
    opponentKey: safeText(value.opponentKey, MAX_TEXT),
    durationMs: Math.max(0, safeInteger(value.durationMs)),
    meaningfulActions: Math.max(0, safeInteger(value.meaningfulActions)),
    eligible: value.eligible !== false,
    blockedReason: value.blockedReason ? safeText(value.blockedReason, 64) : null,
    baseCurrency: Math.max(0, safeInteger(value.baseCurrency)),
    baseXp: Math.max(0, safeInteger(value.baseXp)),
    rewardReasons: safeArray(value.rewardReasons, item => {
      const reason = safeText(item, 64);
      return /^[a-z][a-z0-9_.:-]{1,63}$/.test(reason) ? reason : null;
    }, MAX_REASONS),
    levelBefore: Math.max(1, safeInteger(value.levelBefore, 1)),
    levelAfter: Math.max(1, safeInteger(value.levelAfter, 1)),
    streakBefore: Math.max(0, safeInteger(value.streakBefore)),
    streakAfter: Math.max(0, safeInteger(value.streakAfter)),
    breakdown: safeBreakdown(value.breakdown),
  };
  if (ownRecord(value.reward)) row.reward = clone(value.reward);
  if (ownRecord(value.economyRow)) {
    row.economyRow = {
      uid,
      kind: safeText(value.economyRow.kind, 32),
      amount: safeInteger(value.economyRow.amount),
      balanceAfter: Math.max(0, safeInteger(value.economyRow.balanceAfter)),
      refId: safeText(value.economyRow.refId || resultId, 160),
      metadata: ownRecord(value.economyRow.metadata) ? clone(value.economyRow.metadata) : {},
      at: safeTimestamp(value.economyRow.at, row.at),
    };
  }
  return row;
}

function normalizePending(value) {
  const list = Array.isArray(value) ? value : [];
  const byKey = new Map();
  for (const item of list) {
    if (!ownRecord(item)) continue;
    const row = sanitizeRow(item.row);
    if (!row) continue;
    const uid = text(item.uid || row.uid).trim();
    if (uid !== row.uid) continue;
    const key = uid + '|' + row.resultId;
    byKey.set(key, { uid, row, queuedAt: safeTimestamp(item.queuedAt, row.at) });
  }
  return [...byKey.values()].slice(-MAX_PENDING);
}

function createMemoryRewardEconomyAdapter(initial = {}) {
  let state = { pendingRewardSync: normalizePending(initial.pendingRewardSync || initial.pending) };
  return Object.freeze({
    load() { return { pendingRewardSync: clone(state.pendingRewardSync) }; },
    save(next) { state = { pendingRewardSync: normalizePending(next && next.pendingRewardSync || next && next.pending) }; return true; },
  });
}

function createJsonRuntimeRewardEconomyAdapter(options = {}) {
  const read = typeof options.read === 'function' ? options.read : null;
  const write = typeof options.write === 'function' ? options.write : null;
  if (!read || !write) throw new TypeError('reward_economy_runtime_adapter_callbacks_required');
  const shape = options.shape === 'canonical' ? 'canonical' : 'legacy';
  return Object.freeze({
    load() {
      const source = read();
      return { pendingRewardSync: normalizePending(source && (source.pendingRewardSync || source.pending)) };
    },
    save(next) {
      const pending = normalizePending(next && next.pendingRewardSync || next && next.pending);
      write(shape === 'canonical' ? { pending: pending } : { pendingRewardSync: pending });
      return true;
    },
  });
}

function validAdapter(value) {
  return !!value && typeof value.load === 'function' && typeof value.save === 'function';
}

function createRewardEconomyBoundary(options = {}) {
  if (!validAdapter(options.adapter)) throw new TypeError('reward_economy_adapter_required');
  const adapter = options.adapter;
  const clock = typeof options.now === 'function' ? options.now : () => Date.now();
  const excluded = typeof options.isExcluded === 'function' ? options.isExcluded : () => false;
  const remoteApply = typeof options.remoteApply === 'function' ? options.remoteApply : null;
  const enabled = options.enabled !== false;
  const queues = new Map();
  let disposed = false;

  function now() {
    try {
      const value = Number(clock());
      return Number.isFinite(value) && value >= 0 ? Math.floor(value) : Date.now();
    } catch (_) { return Date.now(); }
  }

  function load() {
    try {
      const source = adapter.load();
      return { pendingRewardSync: normalizePending(source && source.pendingRewardSync) };
    }
    catch (_) { throw new Error('reward_economy_load_failed'); }
  }

  function save(state) {
    try {
      adapter.save({ pendingRewardSync: normalizePending(state && state.pendingRewardSync) });
      return true;
    } catch (_) { return false; }
  }

  function serial(uid, task) {
    const previous = queues.get(uid) || Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    queues.set(uid, next);
    next.then(() => { if (queues.get(uid) === next) queues.delete(uid); }, () => { if (queues.get(uid) === next) queues.delete(uid); });
    return next;
  }

  function excludedResult(uid, user) {
    try { return excluded(uid, user) === true; } catch (_) { return true; }
  }

  function remoteSucceeded(value) {
    return value === true || !!(value && typeof value === 'object' && (value.ok === true || value.applied === true || value.duplicate === true));
  }

  async function flush(uid, row, user) {
    if (!remoteApply) return success({ queued: true, synced: false, resultId: row.resultId });
    try {
      const response = await remoteApply({ uid, row: clone(row), user });
      if (!remoteSucceeded(response)) return failure('server_unavailable', { queued: true, resultId: row.resultId });
      const state = load();
      state.pendingRewardSync = state.pendingRewardSync.filter(item => !(item.uid === uid && item.row.resultId === row.resultId));
      if (!save(state)) return failure('server_unavailable', { queued: true, resultId: row.resultId });
      return success({ queued: false, synced: true, resultId: row.resultId, duplicate: !!(response && response.duplicate) });
    } catch (_) {
      return failure('server_unavailable', { queued: true, resultId: row.resultId });
    }
  }

  async function enqueue(command = {}) {
    if (disposed) return failure('boundary_disposed');
    const row = sanitizeRow(command.row);
    const uid = text(command.uid || row && row.uid).trim();
    if (!row || !UID_RE.test(uid) || row.uid !== uid) return failure('invalid_reward_row');
    if (!enabled) return success({ skipped: true, reason: 'disabled', resultId: row.resultId });
    if (excludedResult(uid, command.user)) return success({ skipped: true, reason: 'excluded_actor', resultId: row.resultId });
    return serial(uid, async () => {
      let state;
      try { state = load(); } catch (_) { return failure('server_unavailable', { resultId: row.resultId }); }
      const existing = state.pendingRewardSync.find(item => item.uid === uid && item.row.resultId === row.resultId);
      if (existing && JSON.stringify(existing.row) !== JSON.stringify(row)) return failure('idempotency_conflict', { resultId: row.resultId });
      if (!existing) {
        state.pendingRewardSync.push({ uid, row, queuedAt: now() });
        state.pendingRewardSync = normalizePending(state.pendingRewardSync);
        if (!save(state)) return failure('server_unavailable', { resultId: row.resultId });
      }
      return flush(uid, row, command.user);
    });
  }

  async function retry(command = {}) {
    if (disposed) return failure('boundary_disposed');
    if (!enabled) return success({ attempted: 0, synced: 0, pending: 0, skipped: true });
    let pending;
    try { pending = load().pendingRewardSync; } catch (_) { return failure('server_unavailable'); }
    const targetUid = text(command.uid || '').trim();
    const entries = pending.filter(item => !targetUid || item.uid === targetUid);
    let synced = 0;
    for (const item of entries) {
      const result = await serial(item.uid, () => flush(item.uid, item.row, command.userResolver && command.userResolver(item.uid)));
      if (result.ok && result.synced) synced += 1;
    }
    let remaining = 0;
    try { remaining = load().pendingRewardSync.length; } catch (_) { return failure('server_unavailable', { attempted: entries.length, synced }); }
    return success({ attempted: entries.length, synced, pending: remaining });
  }

  function dispose() { disposed = true; queues.clear(); return true; }

  return Object.freeze({ enqueue, retry, dispose });
}

module.exports = {
  PROTOCOL,
  createRewardEconomyBoundary,
  createMemoryRewardEconomyAdapter,
  createJsonRuntimeRewardEconomyAdapter,
};
