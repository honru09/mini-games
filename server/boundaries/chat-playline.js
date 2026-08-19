'use strict';

/*
 * T7 Chat/Playline ownership seam.
 *
 * The module owns the protocol-neutral policy around Direct Chat: actor
 * admission, relationship checks, text normalization, bounded history,
 * idempotency, pagination and monotonic read cursors.  It deliberately does
 * not know how a transport, profile directory or social graph is implemented.
 * Playline remains the existing content module; this seam delegates to the
 * injected module and keeps its public result shape intact.
 */

const crypto = require('crypto');

const CHAT_PROTOCOL = 'direct-chat-v1';
const PLAYLINE_PROTOCOL = 'playline-v1';
const CHAT_CLIENT_ID_RE = /^[A-Za-z0-9._:-]{12,80}$/;
const SAFE_ID_RE = /^[A-Za-z0-9._:-]{3,160}$/;
const UID_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const MAX_MESSAGES = 50000;
const MAX_PER_CONVERSATION = 500;
const MAX_MESSAGE_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_READS = 50000;
const MAX_HISTORY_LIMIT = 50;
const DEFAULT_HISTORY_LIMIT = 30;
const DEFAULT_STATE_LIMIT = 50;
const DEFAULT_QUERY_WINDOW_MS = 60 * 1000;
const DEFAULT_QUERY_MAX = 60;
const DEFAULT_SEND_SHORT_WINDOW_MS = 10 * 1000;
const DEFAULT_SEND_SHORT_MAX = 8;
const DEFAULT_SEND_WINDOW_MS = 60 * 1000;
const DEFAULT_SEND_MAX = 30;
const DEFAULT_PAIR_WINDOW_MS = 60 * 1000;
const DEFAULT_PAIR_MAX = 30;
const DEFAULT_SEND_LONG_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SEND_LONG_MAX = 500;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const PRIVATE_KEYS = /(?:token|password|passwd|pin|secret|authorization|owned|coins?|currency|xp|reward|private[_-]?source|safe[_-]?snapshot|move[_-]?log|session|result[_-]?id|replay[_-]?id|match[_-]?id)/i;

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

function text(value) {
  try { return String(value === undefined || value === null ? '' : value); }
  catch (_) { return ''; }
}

function clone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return null;
  if (Array.isArray(value)) {
    seen.set(value, true);
    const output = value.map(item => clone(item, seen));
    seen.delete(value);
    return output;
  }
  if (!ownRecord(value)) return undefined;
  seen.set(value, true);
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!FORBIDDEN_KEYS.has(key)) output[key] = clone(item, seen);
  }
  seen.delete(value);
  return output;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const item of Object.values(value)) deepFreeze(item, seen);
  return Object.freeze(value);
}

function output(ok, fields = {}) {
  const source = ownRecord(fields) ? clone(fields) : {};
  return deepFreeze({ ok: !!ok, ...source });
}

function failure(reason, fields = {}) {
  const safeReason = /^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/.test(text(reason)) ? text(reason) : 'server_unavailable';
  const source = ownRecord(fields) ? clone(fields) : {};
  delete source.ok;
  delete source.reason;
  return output(false, { reason: safeReason, ...source });
}

function success(fields = {}) {
  const source = ownRecord(fields) ? clone(fields) : {};
  delete source.ok;
  return output(true, source);
}

function validUid(value) {
  const uid = text(value).trim();
  return UID_RE.test(uid) ? uid : '';
}

function validSafeId(value) {
  const id = text(value).trim();
  return SAFE_ID_RE.test(id) ? id : '';
}

function normalizeSeq(value) {
  const raw = text(value || '0');
  if (!/^\d{1,40}$/.test(raw)) return '0';
  try { return BigInt(raw).toString(); } catch (_) { return '0'; }
}

function parseStrictSeq(value) {
  const raw = text(value);
  if (!/^\d{1,40}$/.test(raw)) return null;
  try {
    const normalized = BigInt(raw).toString();
    return normalized === '0' ? null : normalized;
  } catch (_) {
    return null;
  }
}

function compareSeq(left, right) {
  const a = BigInt(normalizeSeq(left));
  const b = BigInt(normalizeSeq(right));
  return a < b ? -1 : a > b ? 1 : 0;
}

function nextSeq(value) {
  return (BigInt(normalizeSeq(value)) + 1n).toString();
}

function safeTimestamp(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function timestamp(value, fallback = 0) {
  const numeric = safeTimestamp(value, -1);
  if (numeric >= 0) return numeric;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
}

function normalizeChatText(value) {
  let normalized = text(value).normalize('NFC').replace(/\r\n?/g, '\n');
  normalized = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, '').trim();
  return normalized;
}

function validateChatText(value) {
  const normalized = normalizeChatText(value);
  const codePoints = [...normalized].length;
  if (!codePoints) return { ok: false, reason: 'empty_message', value: normalized };
  if (codePoints > 500 || Buffer.byteLength(normalized, 'utf8') > 2000) {
    return { ok: false, reason: 'message_too_long', value: normalized };
  }
  return { ok: true, value: normalized };
}

function pair(aUid, bUid) {
  const values = [validUid(aUid), validUid(bUid)].sort();
  return { aUid: values[0], bUid: values[1], id: values[0] + '|' + values[1] };
}

function conversationId(aUid, bUid) {
  const current = pair(aUid, bUid);
  return current.aUid && current.bUid && current.aUid !== current.bUid ? 'dm:' + current.id : '';
}

function normalizeStoredMessage(raw) {
  if (!ownRecord(raw)) return null;
  const senderUid = validUid(raw.senderUid || raw.sender_uid);
  const recipientUid = validUid(raw.recipientUid || raw.recipient_uid);
  if (!senderUid || !recipientUid || senderUid === recipientUid) return null;
  const id = validSafeId(raw.id);
  const clientMessageId = text(raw.clientMessageId || raw.client_message_id);
  const seq = normalizeSeq(raw.seq);
  if (!id || !CHAT_CLIENT_ID_RE.test(clientMessageId) || seq === '0') return null;
  const value = validateChatText(raw.text !== undefined ? raw.text : raw.body);
  if (!value.ok) return null;
  const createdAt = timestamp(raw.createdAt !== undefined ? raw.createdAt : raw.created_at, 0);
  if (!createdAt) return null;
  const expectedConversation = conversationId(senderUid, recipientUid);
  const suppliedConversation = text(raw.conversationId || raw.conversation_id);
  if (suppliedConversation && suppliedConversation !== expectedConversation) return null;
  return {
    id,
    conversationId: expectedConversation,
    seq,
    senderUid,
    recipientUid,
    clientMessageId,
    text: value.value,
    createdAt,
  };
}

function normalizeStoredRead(raw) {
  if (!ownRecord(raw)) return null;
  const uid = validUid(raw.uid);
  const peerUid = validUid(raw.peerUid || raw.peer_uid);
  const id = conversationId(uid, peerUid);
  const supplied = text(raw.conversationId || raw.conversation_id);
  if (!uid || !peerUid || uid === peerUid || !id || supplied && supplied !== id) return null;
  return {
    conversationId: id,
    uid,
    peerUid,
    lastReadSeq: normalizeSeq(raw.lastReadSeq !== undefined ? raw.lastReadSeq : raw.last_read_seq),
    updatedAt: timestamp(raw.updatedAt !== undefined ? raw.updatedAt : raw.updated_at, 0),
  };
}

function rawReads(value) {
  if (Array.isArray(value)) return value;
  if (!ownRecord(value)) return [];
  return Object.values(value);
}

function coerceState(raw) {
  const source = ownRecord(raw) ? raw : {};
  const rawMessages = Array.isArray(source.messages) ? source.messages : source.chatMessages;
  const rawReadRows = source.reads !== undefined ? source.reads : source.chatReads;
  const messages = (Array.isArray(rawMessages) ? rawMessages : [])
    .map(normalizeStoredMessage).filter(Boolean);
  const reads = rawReads(rawReadRows).map(normalizeStoredRead).filter(Boolean);
  const next = normalizeSeq(source.nextSeq !== undefined ? source.nextSeq : source.nextChatSeq);
  return { messages, reads, nextSeq: next };
}

function cleanState(raw, nowValue) {
  const source = coerceState(raw);
  const cutoff = Math.max(0, Number(nowValue) - MAX_MESSAGE_AGE_MS);
  const seenIds = new Set();
  const seenClients = new Set();
  const byConversation = new Map();
  for (const row of source.messages) {
    if (row.createdAt < cutoff || seenIds.has(row.id)) continue;
    const clientKey = row.senderUid + '|' + row.clientMessageId;
    if (seenClients.has(clientKey)) continue;
    seenIds.add(row.id);
    seenClients.add(clientKey);
    if (!byConversation.has(row.conversationId)) byConversation.set(row.conversationId, []);
    byConversation.get(row.conversationId).push(row);
  }
  const messages = [];
  for (const rows of byConversation.values()) {
    rows.sort((a, b) => compareSeq(a.seq, b.seq));
    messages.push(...rows.slice(-MAX_PER_CONVERSATION));
  }
  messages.sort((a, b) => compareSeq(a.seq, b.seq));
  const retainedMessages = messages.slice(-MAX_MESSAGES);
  const validConversations = new Set(retainedMessages.map(row => row.conversationId));
  const readMap = new Map();
  for (const row of source.reads) {
    if (!validUid(row.uid) || !validConversations.has(row.conversationId)) continue;
    const key = row.conversationId + '|' + row.uid;
    const previous = readMap.get(key);
    if (!previous || compareSeq(row.lastReadSeq, previous.lastReadSeq) > 0 ||
        row.updatedAt > previous.updatedAt) readMap.set(key, row);
  }
  const reads = [...readMap.values()].slice(-MAX_READS);
  let highWater = source.nextSeq;
  for (const row of retainedMessages) if (compareSeq(row.seq, highWater) > 0) highWater = row.seq;
  return { messages: retainedMessages, reads, nextSeq: normalizeSeq(highWater) };
}

function validStateAdapter(adapter) {
  return !!adapter && typeof adapter.load === 'function' &&
    (typeof adapter.commit === 'function' || typeof adapter.save === 'function');
}

function stateForWrite(state) {
  return {
    messages: state.messages.map(item => clone(item)),
    reads: state.reads.map(item => clone(item)),
    nextSeq: normalizeSeq(state.nextSeq),
  };
}

function createMemoryChatPlaylineAdapter(initial = {}) {
  let state = coerceState(initial);
  const commitState = next => {
    state = coerceState(next);
    return stateForWrite(state);
  };
  return Object.freeze({
    load() { return stateForWrite(state); },
    save(next) { return commitState(next); },
    commit(next) { return commitState(next); },
  });
}

function createJsonRuntimeChatPlaylineAdapter(options = {}) {
  const read = typeof options.read === 'function' ? options.read : null;
  const write = typeof options.write === 'function' ? options.write : null;
  const commit = typeof options.commit === 'function' ? options.commit : null;
  if (!read || (!write && !commit)) throw new TypeError('chat_playline_runtime_adapter_callbacks_required');
  const shape = options.shape === 'legacy' ? 'legacy' : 'canonical';

  function load() {
    return coerceState(read());
  }

  function toPersisted(next) {
    const state = stateForWrite(coerceState(next));
    if (shape !== 'legacy') return state;
    return {
      chatMessages: state.messages,
      chatReads: Object.fromEntries(state.reads.map(row => [row.conversationId + '|' + row.uid, row])),
      nextChatSeq: state.nextSeq,
    };
  }

  function save(next) {
    const value = toPersisted(next);
    if (write) write(clone(value));
    return coerceState(value);
  }

  async function commitState(next, metadata) {
    const value = toPersisted(next);
    if (commit) {
      const result = await commit(clone(value), clone(metadata || {}));
      if (result && result.ok === false) return result;
      if (result && result.state) return coerceState(result.state);
      if (result && result.ok === true) return coerceState(value);
      return coerceState(result || value);
    }
    if (write) write(clone(value));
    return coerceState(value);
  }

  return Object.freeze({ load, save, commit: commitState });
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteInteger(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function listFrom(value) {
  if (value instanceof Set) return [...value].map(validUid).filter(Boolean);
  if (Array.isArray(value)) return value.map(item => ownRecord(item) ? validUid(item.uid || item.userId || item.peerUid) : validUid(item)).filter(Boolean);
  return [];
}

function pairSetHas(value, aUid, bUid) {
  const direct = aUid + '|' + bUid;
  const reverse = bUid + '|' + aUid;
  if (value instanceof Set) return value.has(direct) || value.has(reverse);
  if (!Array.isArray(value)) return false;
  return value.some(item => {
    if (typeof item === 'string') return item === direct || item === reverse;
    if (!ownRecord(item)) return false;
    const left = validUid(item.aUid || item.fromUid || item.blockerUid || item.uidA);
    const right = validUid(item.bUid || item.toUid || item.blockedUid || item.uidB);
    return (left === aUid && right === bUid) || (left === bUid && right === aUid);
  });
}

function actorUid(actor) {
  if (!ownRecord(actor)) return '';
  return validUid(actor.uid || actor.user && actor.user.uid);
}

function guestActor(actor) {
  if (!ownRecord(actor)) return false;
  return actor.ephemeral === true || actor.guest === true || actor.isGuest === true ||
    actor.authType === 'guest' || actor.accountType === 'guest' || actor.type === 'guest' ||
    actor.auth === 'guest' || actor.role === 'guest';
}

function adminActor(actor, uid, options) {
  if (ownRecord(actor) && (actor.testAdmin === true || actor.isTestAdmin === true ||
      actor.test_admin === true || actor.role === 'test-admin' || actor.role === 'test_admin' ||
      actor.accountType === 'test-admin' || actor.type === 'test-admin')) return true;
  const resolver = options && (options.isTestAdmin || options.testAdminResolver);
  if (typeof resolver !== 'function') return false;
  try { return resolver(uid, actor) === true; } catch (_) { return true; }
}

function safePeerProjection(value, uid) {
  const source = ownRecord(value) ? value : {};
  const output = { uid };
  for (const key of ['name', 'username', 'lang', 'presence', 'relationship', 'countryRegion', 'signature']) {
    if (source[key] === undefined || source[key] === null) continue;
    if (typeof source[key] === 'string') output[key] = text(source[key]).normalize('NFC').slice(0, key === 'signature' ? 160 : 120);
    else if (['presence', 'relationship'].includes(key)) output[key] = text(source[key]).slice(0, 32);
  }
  for (const key of ['avatar', 'frame', 'effect', 'background', 'nameFx']) {
    if (Number.isFinite(Number(source[key]))) output[key] = Number(source[key]);
  }
  if (!output.name && !output.username) output.name = uid;
  return output;
}

function publicMessage(row) {
  return {
    id: row.id,
    seq: normalizeSeq(row.seq),
    senderUid: row.senderUid,
    recipientUid: row.recipientUid,
    text: row.text,
    createdAt: row.createdAt,
  };
}

function sanitizePlayline(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => sanitizePlayline(item, seen));
  if (!ownRecord(value)) return null;
  const outputValue = {};
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key) || PRIVATE_KEYS.test(key)) continue;
    outputValue[key] = sanitizePlayline(item, seen);
  }
  return outputValue;
}

function actionName(command, prefix) {
  const raw = text(command && (command.action || command.type)).toLowerCase();
  return raw.indexOf(prefix + '_') === 0 ? raw.slice(prefix.length + 1) : raw;
}

function commandPayload(command) {
  const nested = command && ownRecord(command.payload) ? command.payload : {};
  const direct = ownRecord(command) ? command : {};
  return { ...direct, ...nested };
}

function createChatPlaylineBoundary(options = {}) {
  const adapter = options.adapter;
  if (!validStateAdapter(adapter)) throw new TypeError('chat_playline_adapter_required');
  const clock = typeof options.now === 'function' ? options.now : () => Date.now();
  const playline = options.playline || options.playlineModule || null;
  const requireCapability = options.requireCapability === true;
  const users = options.users;
  const rateBuckets = new Map();
  let mutationTail = Promise.resolve();
  const limits = {
    queryWindowMs: finitePositive(options.queryWindowMs, DEFAULT_QUERY_WINDOW_MS),
    queryMax: finiteInteger(options.queryMax, DEFAULT_QUERY_MAX, 1, 10000),
    sendShortWindowMs: finitePositive(options.sendShortWindowMs, DEFAULT_SEND_SHORT_WINDOW_MS),
    sendShortMax: finiteInteger(options.sendShortMax, DEFAULT_SEND_SHORT_MAX, 1, 10000),
    sendWindowMs: finitePositive(options.sendWindowMs, DEFAULT_SEND_WINDOW_MS),
    sendMax: finiteInteger(options.sendMax, DEFAULT_SEND_MAX, 1, 10000),
    pairWindowMs: finitePositive(options.pairWindowMs, DEFAULT_PAIR_WINDOW_MS),
    pairMax: finiteInteger(options.pairMax, DEFAULT_PAIR_MAX, 1, 10000),
    sendLongWindowMs: finitePositive(options.sendLongWindowMs, DEFAULT_SEND_LONG_WINDOW_MS),
    sendLongMax: finiteInteger(options.sendLongMax, DEFAULT_SEND_LONG_MAX, 1, 100000),
  };
  const idFactory = typeof options.messageIdFactory === 'function'
    ? options.messageIdFactory
    : () => 'msg_' + crypto.randomBytes(10).toString('base64url');

  function now() {
    const value = Number(clock());
    if (!Number.isFinite(value) || value < 0) throw new Error('chat_playline_clock_invalid');
    return Math.floor(value);
  }

  async function load() {
    const raw = await adapter.load();
    return cleanState(raw, now());
  }

  async function persist(state, metadata) {
    const method = typeof adapter.commit === 'function' ? adapter.commit : adapter.save;
    if (typeof method !== 'function') throw new Error('chat_playline_adapter_commit_missing');
    const value = await method.call(adapter, stateForWrite(cleanState(state, now())), clone(metadata || {}));
    if (value && value.ok === false) return null;
    return cleanState(value && value.state ? value.state : value || state, now());
  }

  function reserve(key, at, windowMs, maximum) {
    let values = rateBuckets.get(key);
    if (!Array.isArray(values)) values = [];
    values = values.filter(value => at - value < windowMs);
    if (values.length >= maximum) {
      const oldest = values[0] || at;
      return Math.max(1, Math.ceil(Math.max(0, windowMs - (at - oldest)) / 1000));
    }
    values.push(at);
    rateBuckets.set(key, values);
    if (rateBuckets.size > 10000) {
      for (const [entry, timestamps] of rateBuckets) {
        if (!timestamps.length || at - timestamps[timestamps.length - 1] > limits.sendLongWindowMs) rateBuckets.delete(entry);
      }
    }
    return 0;
  }

  function rollback(key, at) {
    const values = rateBuckets.get(key);
    if (!Array.isArray(values)) return;
    const index = values.lastIndexOf(at);
    if (index >= 0) values.splice(index, 1);
    if (!values.length) rateBuckets.delete(key);
  }

  function serializeMutation(run) {
    const next = mutationTail.then(run, run);
    mutationTail = next.catch(() => undefined);
    return next;
  }

  function resolveUser(uid, actor) {
    const resolver = options.resolvePeer || options.getUser || options.userResolver;
    if (typeof resolver === 'function') {
      try {
        const value = resolver(uid, actor);
        return value && typeof value.then === 'function' ? null : value || null;
      } catch (_) { return null; }
    }
    if (users instanceof Map) return users.get(uid) || null;
    if (ownRecord(users)) return users[uid] || null;
    if (ownRecord(actor && actor.users)) return actor.users[uid] || null;
    if (uid === actorUid(actor)) return actor;
    return null;
  }

  function peerIds(actor, state) {
    const uid = actorUid(actor);
    const output = new Set();
    const listPeers = options.listPeers || options.peerList || options.listUsers;
    try {
      const values = typeof listPeers === 'function' ? listPeers(actor) : users instanceof Map ? [...users.keys()] : ownRecord(users) ? Object.keys(users) : [];
      for (const value of Array.isArray(values) ? values : []) {
        const candidate = ownRecord(value) ? validUid(value.uid) : validUid(value);
        if (candidate && candidate !== uid) output.add(candidate);
      }
    } catch (_) {}
    const friendships = options.friendships || options.friends;
    if (Array.isArray(friendships)) for (const row of friendships) {
      if (!ownRecord(row)) continue;
      if (validUid(row.aUid || row.fromUid) === uid) output.add(validUid(row.bUid || row.toUid));
      if (validUid(row.bUid || row.toUid) === uid) output.add(validUid(row.aUid || row.fromUid));
    }
    for (const row of state.messages) {
      if (row.senderUid === uid) output.add(row.recipientUid);
      if (row.recipientUid === uid) output.add(row.senderUid);
    }
    return [...output].filter(Boolean);
  }

  function relationship(type, aUid, bUid, actor, peer) {
    if (!aUid || !bUid || aUid === bUid) return false;
    const names = type === 'blocked'
      ? ['isBlockedBetween', 'blockedBetween', 'isBlocked']
      : ['isFriend', 'isFriends', 'areFriends', 'friendshipBetween'];
    const resolver = names.map(name => options[name]).find(fn => typeof fn === 'function');
    if (resolver) {
      try {
        const value = resolver(aUid, bUid, actor, peer);
        if (typeof value === 'boolean') return type === 'blocked' ? value : value;
        if (ownRecord(value)) {
          if (type === 'blocked' && typeof value.blocked === 'boolean') return value.blocked;
          if (type === 'friends' && typeof value.friends === 'boolean') return value.friends;
          if (typeof value.allowed === 'boolean') return type === 'blocked' ? !value.allowed : value.allowed;
          if (value.ok === false) return type === 'blocked';
          if (typeof value.ok === 'boolean') return value.ok;
          const relationFields = ['id', 'aUid', 'bUid', 'fromUid', 'toUid', 'blockerUid', 'blockedUid', 'uidA', 'uidB'];
          if (relationFields.some(key => value[key] !== undefined)) return true;
        }
        return false;
      } catch (_) {
        return type === 'blocked';
      }
    }
    if (type === 'blocked') {
      if (pairSetHas(options.blocks || options.blocked, aUid, bUid)) return true;
      if (listFrom(actor && (actor.blockedUids || actor.blocked)).includes(bUid)) return true;
      if (listFrom(peer && (peer.blockedUids || peer.blocked)).includes(aUid)) return true;
      return false;
    }
    if (pairSetHas(options.friendships || options.friends, aUid, bUid)) return true;
    if (listFrom(actor && (actor.friendUids || actor.friends)).includes(bUid)) return true;
    if (listFrom(peer && (peer.friendUids || peer.friends)).includes(aUid)) return true;
    return false;
  }

  function publicPeer(viewerUid, peerUid, actor, peer) {
    const directResolver = options.publicPeer || options.peerProjection;
    const profileResolver = options.publicProfileResolver;
    if (typeof directResolver === 'function') {
      try {
        const value = directResolver(viewerUid, peerUid, actor, peer);
        if (value && typeof value.then === 'function') return null;
        return safePeerProjection(value, peerUid);
      } catch (_) {
        return null;
      }
    }
    if (typeof profileResolver === 'function') {
      try {
        const value = profileResolver(peerUid, actor);
        if (value && typeof value.then === 'function') return null;
        return safePeerProjection(value, peerUid);
      } catch (_) {
        return null;
      }
    }
    return safePeerProjection(peer, peerUid);
  }

  async function authorize(actor, action, capability) {
    const uid = actorUid(actor);
    if (!uid) return failure('not_authenticated', { action });
    if (ownRecord(actor) && (actor.authenticated === false || actor.sessionValid === false || actor.valid === false)) {
      return failure('not_authenticated', { action });
    }
    if (ownRecord(actor) && (actor.formal === false || actor.persistent === false || actor.accountType === 'anonymous')) {
      return failure('not_authenticated', { action });
    }
    if (guestActor(actor)) return failure('guest_forbidden', { action });
    if (adminActor(actor, uid, options)) return failure('test_admin_isolated', { action });
    if (requireCapability || capability === true) {
      const capabilities = Array.isArray(actor.capabilities) ? actor.capabilities : [];
      if (!capabilities.includes(CHAT_PROTOCOL)) return failure('unsupported_capability', { action });
    }
    const validator = options.authorizeActor || options.authenticateActor || options.actorValidator;
    if (typeof validator === 'function') {
      try {
        const decision = await validator(actor, action);
        if (decision === false || decision && decision.ok === false) {
          return failure(decision && decision.reason || 'not_authenticated', { action });
        }
      } catch (_) {
        return failure('not_authenticated', { action });
      }
    }
    return { ok: true, uid };
  }

  function resolveTarget(uid, actor) {
    const peer = resolveUser(uid, actor);
    if (!peer || actorUid(peer) !== uid) return { peer: null, reason: 'invalid_target' };
    if (adminActor(peer, uid, options)) return { peer: null, reason: 'test_admin_isolated' };
    if (guestActor(peer) || peer.ephemeral === true || peer.formal === false || peer.persistent === false ||
        peer.accountType === 'anonymous' || uid === actorUid(actor)) return { peer: null, reason: 'invalid_target' };
    return { peer, reason: '' };
  }

  function targetFor(uid, actor) {
    return resolveTarget(uid, actor).peer;
  }

  function readFor(state, conversation, uid, peerUid) {
    return state.reads.find(row => row.conversationId === conversation && row.uid === uid) || {
      conversationId: conversation,
      uid,
      peerUid,
      lastReadSeq: '0',
      updatedAt: 0,
    };
  }

  function historyFor(state, conversation, before) {
    let rows = state.messages.filter(row => row.conversationId === conversation).sort((a, b) => compareSeq(a.seq, b.seq));
    if (before) rows = rows.filter(row => compareSeq(row.seq, before) < 0);
    return rows;
  }

  function canRead(state, uid, peerUid) {
    if (relationship('blocked', uid, peerUid, null, null)) return false;
    const conversation = conversationId(uid, peerUid);
    return relationship('friends', uid, peerUid, null, null) || state.messages.some(row => row.conversationId === conversation);
  }

  async function chatState(actor, input) {
    const auth = await authorize(actor, 'chat_list', input && input.capabilityRequired === true);
    if (!auth.ok) return auth;
    const queryLimited = reserve('query:' + auth.uid + ':list', now(), limits.queryWindowMs, limits.queryMax);
    if (queryLimited) return failure('rate_limited', { action: 'list', retryAfter: queryLimited });
    const state = await load();
    const uid = auth.uid;
    const limit = input && input.limit === undefined ? DEFAULT_STATE_LIMIT : Number(input && input.limit);
    const boundedLimit = Number.isSafeInteger(limit) && limit >= 1 ? Math.min(100, limit) : DEFAULT_STATE_LIMIT;
    const conversations = [];
    for (const peerUid of peerIds(actor, state)) {
      if (!peerUid || peerUid === uid) continue;
      const peer = targetFor(peerUid, actor);
      if (!peer || relationship('blocked', uid, peerUid, actor, peer)) continue;
      const conversation = conversationId(uid, peerUid);
      if (!conversation) continue;
      const rows = historyFor(state, conversation, null);
      const friends = relationship('friends', uid, peerUid, actor, peer);
      if (!friends && !rows.length) continue;
      const publicProfile = publicPeer(uid, peerUid, actor, peer);
      if (!publicProfile) continue;
      const read = readFor(state, conversation, uid, peerUid);
      const peerRead = readFor(state, conversation, peerUid, uid);
      const last = rows[rows.length - 1] || null;
      const unreadCount = rows.filter(row => row.recipientUid === uid && compareSeq(row.seq, read.lastReadSeq) > 0).length;
      conversations.push({
        conversationId: conversation,
        peer: publicProfile,
        lastMessage: last ? publicMessage(last) : null,
        unreadCount,
        readThroughSeq: read.lastReadSeq,
        peerReadThroughSeq: peerRead.lastReadSeq,
      });
    }
    conversations.sort((a, b) => Number(b.lastMessage && b.lastMessage.createdAt || 0) - Number(a.lastMessage && a.lastMessage.createdAt || 0) ||
      text(a.peer && (a.peer.name || a.peer.username)).localeCompare(text(b.peer && (b.peer.name || b.peer.username))));
    const selected = conversations.slice(0, boundedLimit);
    return success({ action: 'list', version: '1.0', conversations: selected, unreadTotal: selected.reduce((sum, row) => sum + row.unreadCount, 0) });
  }

  async function chatHistory(actor, input) {
    const auth = await authorize(actor, 'chat_history', input && input.capabilityRequired === true);
    if (!auth.ok) return auth;
    const uid = auth.uid;
    const queryLimited = reserve('query:' + uid + ':history', now(), limits.queryWindowMs, limits.queryMax);
    if (queryLimited) return failure('rate_limited', { action: 'history', retryAfter: queryLimited });
    const peerUid = validUid(input && input.peerUid);
    const target = resolveTarget(peerUid, actor);
    const peer = target.peer;
    if (!peer) return failure(target.reason, { action: 'history' });
    const state = await load();
    if (!canRead(state, uid, peerUid)) return failure('conversation_unavailable', { action: 'history' });
    let before = null;
    if (input && input.beforeSeq !== undefined && input.beforeSeq !== null && input.beforeSeq !== '') {
      before = parseStrictSeq(input.beforeSeq);
      if (!before) return failure('invalid_cursor', { action: 'history' });
    }
    const requested = input && input.limit === undefined ? DEFAULT_HISTORY_LIMIT : Number(input && input.limit);
    const limit = Number.isSafeInteger(requested) && requested >= 1 ? Math.min(MAX_HISTORY_LIMIT, requested) : DEFAULT_HISTORY_LIMIT;
    const conversation = conversationId(uid, peerUid);
    const rows = historyFor(state, conversation, before);
    const page = rows.slice(-limit);
    const read = readFor(state, conversation, uid, peerUid);
    const peerRead = readFor(state, conversation, peerUid, uid);
    const projectedPeer = publicPeer(uid, peerUid, actor, peer);
    if (!projectedPeer) return failure('conversation_unavailable', { action: 'history' });
    return success({
      action: 'history',
      conversationId: conversation,
      peer: projectedPeer,
      messages: page.map(publicMessage),
      hasMore: rows.length > page.length,
      nextBeforeSeq: rows.length > page.length && page.length ? page[0].seq : null,
      readThroughSeq: read.lastReadSeq,
      peerReadThroughSeq: peerRead.lastReadSeq,
    });
  }

  async function chatSend(actor, input) {
    const clientMessageId = text(input && input.clientMessageId);
    const auth = await authorize(actor, 'chat_send', input && input.capabilityRequired === true);
    if (!auth.ok) return failure(auth.reason, { action: 'send', clientMessageId });
    const uid = auth.uid;
    const peerUid = validUid(input && input.peerUid);
    const target = resolveTarget(peerUid, actor);
    const peer = target.peer;
    if (!peer) return failure(target.reason, { action: 'send', clientMessageId });
    if (!CHAT_CLIENT_ID_RE.test(clientMessageId)) return failure('invalid_client_message_id', { action: 'send', clientMessageId });
    const valid = validateChatText(input && input.text);
    if (!valid.ok) return failure(valid.reason, { action: 'send', clientMessageId });
    if (!relationship('friends', uid, peerUid, actor, peer) || relationship('blocked', uid, peerUid, actor, peer)) {
      return failure('conversation_unavailable', { action: 'send', clientMessageId });
    }
    const at = now();
    const reservations = [
      ['send10:' + uid, limits.sendShortWindowMs, limits.sendShortMax],
      ['send60:' + uid, limits.sendWindowMs, limits.sendMax],
      ['pair60:' + conversationId(uid, peerUid), limits.pairWindowMs, limits.pairMax],
      ['send24:' + uid, limits.sendLongWindowMs, limits.sendLongMax],
    ];
    const reserved = [];
    for (const [key, windowMs, maximum] of reservations) {
      const retryAfter = reserve(key, at, windowMs, maximum);
      if (retryAfter) {
        for (const [rollbackKey] of reserved) rollback(rollbackKey, at);
        return failure('rate_limited', { action: 'send', clientMessageId, retryAfter });
      }
      reserved.push([key]);
    }
    try {
      const state = await load();
      const existing = state.messages.find(row => row.senderUid === uid && row.clientMessageId === clientMessageId);
      if (existing) {
        for (const [key] of reserved) rollback(key, at);
        if (existing.recipientUid !== peerUid || existing.text !== valid.value) {
          return failure('idempotency_conflict', { action: 'send', clientMessageId });
        }
        const message = publicMessage(existing);
        return success({ action: 'send', clientMessageId, messageId: message.id, seq: message.seq, message, duplicate: true });
      }
      let id = validSafeId(idFactory({ senderUid: uid, recipientUid: peerUid, clientMessageId, createdAt: at }));
      if (!id) id = validSafeId('msg_' + crypto.randomBytes(10).toString('base64url'));
      if (state.messages.some(row => row.id === id)) id = validSafeId('msg_' + crypto.randomBytes(10).toString('base64url'));
      if (!id) throw new Error('message_id_unavailable');
      const candidate = {
        id,
        conversationId: conversationId(uid, peerUid),
        seq: nextSeq(state.nextSeq),
        senderUid: uid,
        recipientUid: peerUid,
        clientMessageId,
        text: valid.value,
        createdAt: at,
      };
      const next = cleanState({ messages: state.messages.concat(candidate), reads: state.reads, nextSeq: candidate.seq }, at);
      const committed = await persist(next, { operation: 'chat_send', uid, clientMessageId });
      if (!committed) throw new Error('chat_playline_commit_rejected');
      const stored = committed.messages.find(row => row.id === candidate.id);
      if (!stored) throw new Error('chat_playline_commit_missing_message');
      const message = publicMessage(stored);
      return success({ action: 'send', clientMessageId, messageId: message.id, seq: message.seq, message, duplicate: false });
    } catch (_) {
      for (const [key] of reserved) rollback(key, at);
      return failure('server_unavailable', { action: 'send', clientMessageId });
    }
  }

  async function chatRead(actor, input) {
    const auth = await authorize(actor, 'chat_read', input && input.capabilityRequired === true);
    if (!auth.ok) return auth;
    const uid = auth.uid;
    const queryLimited = reserve('query:' + uid + ':read', now(), limits.queryWindowMs, limits.queryMax);
    if (queryLimited) return failure('rate_limited', { action: 'read', retryAfter: queryLimited });
    const peerUid = validUid(input && input.peerUid);
    const target = resolveTarget(peerUid, actor);
    const peer = target.peer;
    if (!peer) return failure(target.reason, { action: 'read' });
    const throughSeq = parseStrictSeq(input && input.throughSeq);
    if (!throughSeq) return failure('message_not_found', { action: 'read' });
    const state = await load();
    if (!canRead(state, uid, peerUid)) return failure('conversation_unavailable', { action: 'read' });
    const conversation = conversationId(uid, peerUid);
    const received = state.messages.some(row => row.conversationId === conversation && row.recipientUid === uid && row.seq === throughSeq);
    if (!received) return failure('message_not_found', { action: 'read' });
    const current = readFor(state, conversation, uid, peerUid);
    const nextRead = compareSeq(throughSeq, current.lastReadSeq) > 0 ? { ...current, lastReadSeq: throughSeq, updatedAt: now() } : current;
    const reads = state.reads.filter(row => !(row.conversationId === conversation && row.uid === uid));
    reads.push(nextRead);
    try {
      const committed = await persist({ messages: state.messages, reads, nextSeq: state.nextSeq }, { operation: 'chat_read', uid, peerUid, throughSeq });
      if (!committed) return failure('server_unavailable', { action: 'read' });
      return success({ action: 'read', conversationId: conversation, readerUid: uid, throughSeq: nextRead.lastReadSeq, readAt: nextRead.updatedAt });
    } catch (_) {
      return failure('server_unavailable', { action: 'read' });
    }
  }

  async function chat(command = {}) {
    const input = commandPayload(command);
    const action = actionName(input, 'chat');
    const actor = input.actor || input.user || input.session;
    try {
      if (action === 'list' || action === 'state') return await chatState(actor, input);
      if (action === 'history') return await chatHistory(actor, input);
      if (action === 'send') return await serializeMutation(() => chatSend(actor, input));
      if (action === 'read') return await serializeMutation(() => chatRead(actor, input));
      return failure('unsupported_action', { action: action || 'chat' });
    } catch (_) {
      return failure('server_unavailable', { action: action || 'chat' });
    }
  }

  async function playlineCommand(command = {}) {
    const input = commandPayload(command);
    const action = actionName(input, 'playline');
    const actor = input.actor || input.user || input.session;
    const uid = actorUid(actor);
    if (!uid) return failure('not_authenticated', { action: action || 'playline' });
    if (ownRecord(actor) && (actor.authenticated === false || actor.sessionValid === false || actor.valid === false ||
        actor.formal === false || actor.persistent === false || actor.accountType === 'anonymous')) {
      return failure('not_authenticated', { action: action || 'playline' });
    }
    if (guestActor(actor)) return failure('guest_forbidden', { action });
    if (adminActor(actor, uid, options)) return failure('test_admin_isolated', { action });
    if (options.playlineRequireCapability === true || options.requireCapability === true || Array.isArray(actor.requiredCapabilities)) {
      const capabilities = Array.isArray(actor.capabilities) ? actor.capabilities : [];
      if (!capabilities.includes(PLAYLINE_PROTOCOL)) return failure('unsupported_capability', { action });
    }
    const methods = { list: 'list', publish: 'publish', remove: 'remove', report: 'resolveReportTarget' };
    const methodName = methods[action];
    if (!methodName || !playline || typeof playline[methodName] !== 'function') {
      return failure(methodName ? 'server_unavailable' : 'unsupported_action', { action: action || 'playline' });
    }
    try {
      let value;
      if (action === 'report') {
        const postId = validSafeId(input.postId || input.contextId);
        if (!postId) return failure('post_unavailable', { action });
        value = await playline[methodName](actor, postId);
      } else {
        const payload = { ...input };
        delete payload.actor; delete payload.user; delete payload.session;
        delete payload.action; delete payload.type; delete payload.payload;
        value = await playline[methodName](actor, payload);
      }
      if (!value || typeof value !== 'object' || typeof value.ok !== 'boolean') return failure('server_unavailable', { action });
      const safe = sanitizePlayline(value);
      if (!safe || typeof safe !== 'object') return failure('server_unavailable', { action });
      if (safe.ok === false) {
        const fields = { ...safe };
        delete fields.ok;
        const reason = /^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/.test(text(fields.reason)) ? fields.reason : 'server_unavailable';
        delete fields.reason;
        return failure(reason, { action, ...fields });
      }
      return deepFreeze(safe);
    } catch (_) {
      return failure('server_unavailable', { action });
    }
  }

  return Object.freeze({ chat, playline: playlineCommand });
}

module.exports = Object.freeze({
  CHAT_PROTOCOL,
  PLAYLINE_PROTOCOL,
  MAX_MESSAGES,
  MAX_PER_CONVERSATION,
  MAX_MESSAGE_AGE_MS,
  createChatPlaylineBoundary,
  createMemoryChatPlaylineAdapter,
  createJsonRuntimeChatPlaylineAdapter,
});
