'use strict';

/*
 * Playline Community P0
 *
 * This file deliberately contains no WebSocket, HTTP, database-client, or UI
 * knowledge.  The four functions returned by createPlaylineModule are the
 * only authority surface callers need.  A store adapter is an implementation
 * detail behind that surface; the JSON adapter is useful for a single local
 * process and the Supabase adapter only knows how to call injected RPCs.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'playline-v1';
const VALID_GAMES = Object.freeze(['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi']);
const VALID_AUDIENCES = Object.freeze(['all', 'friends']);
const VALID_FILTERS = Object.freeze(['all', 'friends']);
const VALID_KINDS = Object.freeze(['text', 'game_share', 'result_share', 'record_share']);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;
const DEFAULT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_CURSOR_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PUBLISH_SHORT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_PUBLISH_LONG_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PUBLISH_SHORT_MAX = 3;
const DEFAULT_PUBLISH_LONG_MAX = 15;
const DEFAULT_LIST_WINDOW_MS = 60 * 1000;
const DEFAULT_LIST_MAX = 60;
const DEFAULT_DELETE_WINDOW_MS = 60 * 1000;
const DEFAULT_DELETE_MAX = 20;
const DEFAULT_MAX_SCAN = 200;
const DEFAULT_MAX_STORED_POSTS = 20000;
const MAX_TEXT_CODE_POINTS = 280;
const MAX_TEXT_LINES = 4;
const MAX_TEXT_BYTES = 1200;
const CLIENT_POST_ID_RE = /^[A-Za-z0-9._:-]{12,80}$/;
const OPAQUE_ID_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const UID_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const PRIVATE_KEY_RE = /(?:token|password|passwd|pin|secret|owned|coins?|currency|xp|reward|opponent|matchid|resultid|replayid|seq|moveLog|session|authorization)/i;

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
  try { return String(value === undefined || value === null ? '' : value); } catch (_) { return ''; }
}

function boundedText(value, max = 160) {
  const result = text(value).normalize('NFC');
  return [...result].slice(0, max).join('');
}

function clone(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (!FORBIDDEN_KEYS.has(key)) out[key] = clone(item);
  }
  return out;
}

function uidOf(actor) {
  if (!ownRecord(actor)) return '';
  try {
    const candidate = actor.uid !== undefined ? actor.uid : actor.user && actor.user.uid;
    const value = text(candidate).trim();
    return UID_RE.test(value) ? value : '';
  } catch (_) { return ''; }
}

function boolFrom(value) {
  return value === true || value === 1 || value === '1';
}

function isGuestActor(actor) {
  if (!ownRecord(actor)) return false;
  try {
    return actor.ephemeral === true || actor.guest === true || actor.isGuest === true ||
      actor.authType === 'guest' || actor.accountType === 'guest' || actor.role === 'guest' ||
      actor.type === 'guest' || actor.auth === 'guest';
  } catch (_) { return true; }
}

function isTestAdminActor(actor, options) {
  if (!ownRecord(actor)) return false;
  try {
    if (actor.testAdmin === true || actor.isTestAdmin === true || actor.test_admin === true ||
        actor.role === 'test-admin' || actor.role === 'test_admin' || actor.accountType === 'test-admin' || actor.type === 'test-admin') return true;
  } catch (_) { return true; }
  const policy = options && (options.testAdminPolicy || options.testAdmin);
  const fn = options && (options.isTestAdmin || options.testAdminResolver);
  try {
    if (typeof fn === 'function' && fn(uidOf(actor), actor) === true) return true;
    if (policy && typeof policy.isTestAdminUid === 'function' && policy.isTestAdminUid(uidOf(actor)) === true) return true;
    if (policy && typeof policy.shouldHidePublicUid === 'function' && policy.shouldHidePublicUid(uidOf(actor)) === true) return true;
  } catch (_) {
    // A failing policy is treated as an ordinary authorization failure by
    // authorizeActor; it must never turn into an allow decision.
  }
  return false;
}

function normalizeText(input) {
  let value = text(input).normalize('NFC').replace(/\r\n?/g, '\n');
  // C0 controls, DEL, and the Unicode bidi embedding/override/isolate marks
  // are removed.  Tab is intentionally retained as ordinary plain text.
  value = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, '').trim();
  return value;
}

function validateText(value) {
  const normalized = normalizeText(value);
  const count = [...normalized].length;
  if (!count) return { ok: false, reason: 'empty_post', value: normalized };
  if (count > MAX_TEXT_CODE_POINTS || Buffer.byteLength(normalized, 'utf8') > MAX_TEXT_BYTES ||
      normalized.split('\n').length > MAX_TEXT_LINES) {
    return { ok: false, reason: 'post_too_long', value: normalized };
  }
  return { ok: true, value: normalized };
}

function validOpaqueId(value, re = OPAQUE_ID_RE) {
  return typeof value === 'string' && re.test(value);
}

function canonicalIntentKey(intent) {
  // JSON.stringify on this fixed-shape object is stable and never includes
  // arbitrary client fields.
  return JSON.stringify({
    audience: intent.audience,
    content: intent.content,
  });
}

function hashIntent(intent) {
  return crypto.createHash('sha256').update(canonicalIntentKey(intent), 'utf8').digest('hex');
}

function safeSeq(value) {
  const raw = text(value || '0');
  if (!/^\d{1,40}$/.test(raw)) return '0';
  try { return BigInt(raw).toString(); } catch (_) { return '0'; }
}

function compareSeq(a, b) {
  const aa = BigInt(safeSeq(a));
  const bb = BigInt(safeSeq(b));
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

function nextSeq(value) {
  return (BigInt(safeSeq(value)) + 1n).toString();
}

function safeTimestamp(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER) return n;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER) return parsed;
  }
  return fallback;
}

function safeRetryAfter(ms) {
  return Math.max(1, Math.ceil(Math.max(0, Number(ms) || 0) / 1000));
}

function errorResult(reason, extra = {}) {
  const out = { ok: false, reason: String(reason || 'server_unavailable') };
  if (ownRecord(extra)) {
    for (const [key, value] of Object.entries(extra)) {
      if (key === 'ok' || key === 'reason' || FORBIDDEN_KEYS.has(key)) continue;
      out[key] = clone(value);
    }
  }
  return out;
}

function successResult(extra = {}) {
  return { ok: true, ...(ownRecord(extra) ? clone(extra) : {}) };
}

function asPromise(value) {
  return value && typeof value.then === 'function' ? value : Promise.resolve(value);
}

async function invokeMaybe(fn, args) {
  if (typeof fn !== 'function') return undefined;
  return asPromise(fn(...args));
}

function getOption(options, names) {
  for (const name of names) {
    if (options && options[name] !== undefined) return options[name];
  }
  return undefined;
}

function adapterUnavailable(value) {
  return !!(value && typeof value === 'object' && (value.unavailable === true ||
    value.reason === 'server_unavailable' || value.ok === false && value.reason === 'server_unavailable'));
}

/* ---------------------------- Cursor codec ---------------------------- */

function deriveCursorKey(secret) {
  const source = text(secret || 'playline-local-development-secret');
  return crypto.createHash('sha256').update(source, 'utf8').digest();
}

function encodeCursor(payload, secret, now) {
  const key = deriveCursorKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.from(JSON.stringify({
    v: 1,
    scope: payload.scope,
    seq: safeSeq(payload.seq),
    snapshot: safeTimestamp(payload.snapshot, now),
    issued: safeTimestamp(payload.issued, now),
  }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map(part => part.toString('base64url')).join('.');
}

function decodeCursor(cursor, secret, now, ttlMs, expectedScope) {
  if (typeof cursor !== 'string' || cursor.length < 20 || cursor.length > 1024) return null;
  try {
    const parts = cursor.split('.');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'base64url');
    const ciphertext = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 2) return null;
    // Reject alternate/non-canonical base64url spellings.  Without this,
    // changing unused low bits in the final base64 character can decode to the
    // same authenticated bytes and would make a superficial cursor tamper
    // appear valid.
    if (iv.toString('base64url') !== parts[0] || ciphertext.toString('base64url') !== parts[1] || tag.toString('base64url') !== parts[2]) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveCursorKey(secret), iv);
    decipher.setAuthTag(tag);
    const parsed = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
    if (!ownRecord(parsed) || parsed.v !== 1 || !VALID_FILTERS.includes(parsed.scope) ||
        (expectedScope && parsed.scope !== expectedScope) || safeSeq(parsed.seq) === '0') return null;
    const issued = safeTimestamp(parsed.issued, 0);
    const snapshot = safeTimestamp(parsed.snapshot, 0);
    if (!issued || !snapshot || issued > now + 60000 || now - issued > ttlMs) return null;
    return { scope: parsed.scope, seq: safeSeq(parsed.seq), snapshot, issued };
  } catch (_) {
    return null;
  }
}

/* ---------------------------- Social policy ---------------------------- */

function listContainsUid(value, target) {
  if (Array.isArray(value)) return value.some(item => {
    if (typeof item === 'string') return item === target;
    return ownRecord(item) && (text(item.uid || item.userId || item.targetUid) === target);
  });
  if (value instanceof Set) return value.has(target);
  return false;
}

function pairSetHas(value, a, b, symmetric) {
  if (value instanceof Set) {
    const direct = a + '|' + b;
    const reverse = b + '|' + a;
    return value.has(direct) || (symmetric && value.has(reverse));
  }
  if (!Array.isArray(value)) return false;
  return value.some(row => {
    if (typeof row === 'string') return row === a + '|' + b || symmetric && row === b + '|' + a;
    if (!ownRecord(row)) return false;
    const x = text(row.aUid || row.fromUid || row.blockerUid || row.uidA);
    const y = text(row.bUid || row.toUid || row.blockedUid || row.uidB);
    return (x === a && y === b) || (symmetric && x === b && y === a);
  });
}

function relationFunction(options, type) {
  const names = type === 'blocked'
    ? ['isBlockedBetween', 'blockedBetween', 'isBlocked', 'socialBlockedBetween']
    : ['isFriend', 'isFriends', 'areFriends', 'friendsBetween', 'friendshipBetween', 'socialFriendship'];
  for (const name of names) {
    if (options && typeof options[name] === 'function') return options[name];
    if (options && options.social && typeof options.social[name] === 'function') return options.social[name];
    if (options && options.relationship && typeof options.relationship[name] === 'function') return options.relationship[name];
  }
  return null;
}

async function relation(options, type, aUid, bUid, actor, author) {
  if (!aUid || !bUid || aUid === bUid) return false;
  const fn = relationFunction(options, type);
  if (fn) {
    try {
      const value = await invokeMaybe(fn, [aUid, bUid, actor, author]);
      if (typeof value === 'boolean') return value;
      if (ownRecord(value)) {
        if (typeof value.blocked === 'boolean' && type === 'blocked') return value.blocked;
        if (typeof value.friends === 'boolean' && type === 'friends') return value.friends;
        if (type === 'blocked' && value.ok === false) return true;
        if (typeof value.ok === 'boolean' && value.reason === undefined) return value.ok;
        if (typeof value.allowed === 'boolean') return !value.allowed && type === 'blocked';
      }
    } catch (_) {
      // Failing social authority is fail-closed for visibility.
      return true;
    }
  }
  const source = options && (options.blocks || options.blocked || options.friendships || options.friends);
  if (type === 'blocked') {
    if (pairSetHas(options && (options.blocks || options.blocked), aUid, bUid, true)) return true;
    if (ownRecord(actor) && (listContainsUid(actor.blockedUids, bUid) || listContainsUid(actor.blocked, bUid))) return true;
    if (ownRecord(author) && (listContainsUid(author.blockedUids, aUid) || listContainsUid(author.blocked, aUid))) return true;
    return false;
  }
  if (pairSetHas(options && (options.friendships || options.friends), aUid, bUid, true)) return true;
  if (ownRecord(actor) && (listContainsUid(actor.friendUids, bUid) || listContainsUid(actor.friends, bUid))) return true;
  if (ownRecord(author) && (listContainsUid(author.friendUids, aUid) || listContainsUid(author.friends, aUid))) return true;
  return false;
}

/* ----------------------- Authoritative references ---------------------- */

function unwrapResolverResult(value) {
  if (!ownRecord(value)) return value;
  if (value.ok === false || value.shareable === false || value.available === false || value.valid === false) return null;
  for (const key of ['content', 'canonical', 'safeContent', 'snapshot', 'projection', 'value']) {
    if (value[key] !== undefined && ownRecord(value[key])) return value[key];
  }
  return value;
}

function safeNumber(value, integer = false) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) return null;
  return integer && !Number.isSafeInteger(n) ? null : n;
}

function safePublicId(value, max = 80) {
  const result = text(value).trim();
  return /^[A-Za-z0-9._:-]{1,160}$/.test(result) && result.length <= max ? result : '';
}

function canonicalResult(raw) {
  const source = unwrapResolverResult(raw);
  if (!ownRecord(source)) return null;
  const gameId = text(source.gameId || source.game || '').trim();
  const outcome = text(source.outcome || source.result || source.placementResult || '').trim();
  const mode = text(source.mode || '').trim();
  if (!VALID_GAMES.includes(gameId) || !['win', 'draw', 'loss'].includes(outcome)) return null;
  if (mode && !['online', 'ai'].includes(mode)) return null;
  const out = { kind: 'result_share', gameId, outcome };
  if (mode) out.mode = mode;
  const placement = safeNumber(source.placement !== undefined ? source.placement : source.rank, true);
  if (placement !== null && placement >= 1 && placement <= 99) out.placement = placement;
  const participantCount = safeNumber(source.participantCount !== undefined ? source.participantCount : source.players, true);
  if (participantCount !== null && participantCount >= 1 && participantCount <= 99) out.participantCount = participantCount;
  const settledAt = safeNumber(source.settledAt !== undefined ? source.settledAt : source.createdAt);
  if (settledAt !== null) out.settledAt = settledAt;
  const authority = safePublicId(source.authority || source.authorityKind, 64);
  if (authority && ['server_rule', 'settled_consensus'].includes(authority)) out.authority = authority;
  return out;
}

function validRecordKey(value) {
  const key = text(value).trim();
  if (key === 'total_wins' || key === 'level') return key;
  const match = /^(game_wins|mastery):([a-z0-9_-]+)$/.exec(key);
  return match && VALID_GAMES.includes(match[2]) ? key : '';
}

function canonicalRecord(raw) {
  const source = unwrapResolverResult(raw);
  if (!ownRecord(source)) return null;
  const out = { kind: 'record_share' };
  const record = validRecordKey(source.record || source.recordKey || source.metric || source.key);
  const gameId = text(source.gameId || source.game || '').trim();
  if (record) out.record = record;
  if (gameId && VALID_GAMES.includes(gameId)) out.gameId = gameId;
  else if (gameId) return null;
  const value = safeNumber(source.value !== undefined ? source.value : source.count, true);
  if (value !== null && value <= 1000000000) out.value = value;
  const eventCount = safeNumber(source.eventCount !== undefined ? source.eventCount : source.events, true);
  if (eventCount !== null && eventCount <= 1000000) out.eventCount = eventCount;
  if (typeof source.truncated === 'boolean') out.truncated = source.truncated;
  const recordedAt = safeNumber(source.recordedAt !== undefined ? source.recordedAt : source.createdAt);
  if (recordedAt !== null) out.recordedAt = recordedAt;
  const outcome = text(source.outcome || source.result || '').trim();
  if (['win', 'draw', 'loss'].includes(outcome)) out.outcome = outcome;
  const summaryKey = safePublicId(source.summaryKey || source.summary || '', 80);
  if (summaryKey && !PRIVATE_KEY_RE.test(summaryKey)) out.summaryKey = summaryKey;
  const badgeKey = safePublicId(source.badgeKey || source.badge, 80);
  if (badgeKey && !PRIVATE_KEY_RE.test(badgeKey)) out.badgeKey = badgeKey;
  // A record must be identifiable by a frozen metric or a useful, safe replay
  // summary.  Arbitrary resolver objects are never accepted as canonical
  // cards, and source replay IDs remain private even for summary cards.
  if (!record && !(out.gameId && (out.value !== undefined || out.eventCount !== undefined || out.outcome || out.summaryKey || out.recordedAt !== undefined))) return null;
  return out;
}

async function resolveReference(options, kind, actor, reference) {
  const resolverGroup = options && (options.resolvers || options.referenceResolver || options.authoritativeResolver);
  const unifiedResolver = !getOption(options, kind === 'result_share'
    ? ['resultResolver', 'resolveResult', 'resultShareResolver']
    : ['recordResolver', 'resolveRecord', 'recordShareResolver'])
    ? getOption(options, ['canonicalResolver', 'resolveCanonicalContent'])
    : null;
  let resolver = kind === 'result_share'
    ? getOption(options, ['resultResolver', 'resolveResult', 'resultShareResolver'])
    : getOption(options, ['recordResolver', 'resolveRecord', 'recordShareResolver']);
  if (!resolver) resolver = unifiedResolver;
  if (!resolver && resolverGroup) {
    resolver = kind === 'result_share' ? resolverGroup.result || resolverGroup.resolveResult : resolverGroup.record || resolverGroup.resolveRecord;
  }
  if (!resolver) return null;
  try {
    let value;
    const resolverFn = typeof resolver === 'function' ? resolver : resolver && typeof resolver.resolve === 'function' ? resolver.resolve.bind(resolver) : null;
    if (!resolverFn) return null;
    // Support both the documented `(actor, reference)` seam and the convenient
    // single-object test seam.  The hybrid object retains actor fields while
    // adding explicit reference names, so either form remains authoritative.
    const request = ownRecord(actor) ? { ...actor, actor, actorUid: uidOf(actor), uid: uidOf(actor), reference,
      ...(kind === 'result_share' ? { resultId: reference } : { replayId: reference, recordId: reference }), kind } :
      { actor, actorUid: uidOf(actor), uid: uidOf(actor), reference, kind,
        ...(kind === 'result_share' ? { resultId: reference } : { replayId: reference, recordId: reference }) };
    if (unifiedResolver && resolverFn.length > 1) value = await invokeMaybe(resolverFn, [kind, actor, reference]);
    else if (resolverFn.length <= 1) {
      value = await invokeMaybe(resolverFn, [request]);
      if (value === undefined || value === null) value = await invokeMaybe(resolverFn, [actor, reference, kind]);
    } else value = await invokeMaybe(resolverFn, [actor, reference, kind]);
    return kind === 'result_share' ? canonicalResult(value) : canonicalRecord(value);
  } catch (_) {
    return null;
  }
}

/* -------------------------- JSON store adapter ------------------------- */

function defaultStoreState(source) {
  const state = ownRecord(source) ? source : {};
  if (!Array.isArray(state.playlinePosts)) state.playlinePosts = [];
  if (state.nextPlaylineSeq === undefined) state.nextPlaylineSeq = '0';
  return state;
}

function normalizeStoredPost(value) {
  if (!ownRecord(value)) return null;
  const id = safePublicId(value.id || value.postId, 160);
  const authorUid = safePublicId(value.authorUid || value.author && value.author.uid, 160);
  const audience = VALID_AUDIENCES.includes(value.audience) ? value.audience : '';
  const kind = VALID_KINDS.includes(value.kind) ? value.kind : '';
  const seq = safeSeq(value.seq);
  const createdAt = safeTimestamp(value.createdAt, 0);
  const clientPostId = typeof value.clientPostId === 'string' ? value.clientPostId : '';
  if (!id || !authorUid || !audience || !kind || seq === '0' || !createdAt || !clientPostId) return null;
  const out = {
    id, seq, authorUid, audience, kind, createdAt, clientPostId,
    intentKey: typeof value.intentKey === 'string' ? value.intentKey.slice(0, 2000) : '',
    intentHash: typeof value.intentHash === 'string' ? value.intentHash.slice(0, 128) : '',
    normalizedText: typeof value.normalizedText === 'string' ? value.normalizedText : undefined,
    privateSource: ownRecord(value.privateSource) ? clone(value.privateSource) : undefined,
    safeSnapshot: ownRecord(value.safeSnapshot) ? clone(value.safeSnapshot) : null,
    deletedAt: value.deletedAt ? safeTimestamp(value.deletedAt, 0) : 0,
    tombstone: value.tombstone === true,
    deleteRequestIds: Array.isArray(value.deleteRequestIds) ? value.deleteRequestIds.filter(v => validOpaqueId(v)).slice(-20) : [],
  };
  if (out.kind === 'text' && typeof out.normalizedText !== 'string') return null;
  return out;
}

function mapRemotePost(value) {
  if (!ownRecord(value)) return null;
  // Supabase RPCs may return snake_case rows while the authority and JSON
  // adapter use camelCase.  Normalize at the adapter seam so no database
  // spelling escapes into the module or its callers.
  const parseJson = input => {
    if (typeof input !== 'string') return input;
    try { return JSON.parse(input); } catch (_) { return input; }
  };
  const createdRaw=value.createdAt!==undefined?value.createdAt:value.created_at,deletedRaw=value.deletedAt!==undefined?value.deletedAt:value.deleted_at;
  const createdAt=typeof createdRaw==='string'&&!/^\d+$/.test(createdRaw)?Date.parse(createdRaw):Number(createdRaw);
  const deletedAt=typeof deletedRaw==='string'&&!/^\d+$/.test(deletedRaw)?Date.parse(deletedRaw):Number(deletedRaw);
  const content=parseJson(value.content!==undefined?value.content:value.canonical_content);
  return normalizeStoredPost({
    ...value,
    id: value.id || value.post_id,
    seq: value.seq || value.sequence,
    authorUid: value.authorUid || value.author_uid,
    clientPostId: value.clientPostId || value.client_post_id,
    createdAt,
    normalizedText: value.normalizedText !== undefined ? value.normalizedText : value.normalized_text!==undefined?value.normalized_text:content&&content.text,
    privateSource: parseJson(value.privateSource !== undefined ? value.privateSource : value.private_source),
    safeSnapshot: parseJson(value.safeSnapshot !== undefined ? value.safeSnapshot : value.safe_snapshot!==undefined?value.safe_snapshot:content),
    deletedAt,
    tombstone: value.tombstone === true || value.state === 'deleted',
    intentHash: value.intentHash || value.intent_hash,
    intentKey: value.intentKey || value.intent_key,
  });
}

function clonePost(value) { return normalizeStoredPost(clone(value)); }

function createJsonPlaylineStore(options = {}) {
  const opts = ownRecord(options) ? options : {};
  let state = defaultStoreState(opts.state || opts.data || opts.db);
  const configuredPath = opts.filePath || opts.jsonPath || opts.storagePath;
  const filePath = typeof configuredPath === 'string' && configuredPath ? path.resolve(configuredPath) : '';
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const idFactory = typeof opts.idFactory === 'function' ? opts.idFactory : () => 'pl_' + crypto.randomBytes(16).toString('base64url');
  let unavailable = false;

  if (filePath && !opts.state && !opts.data && !opts.db) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        state = defaultStoreState(parsed);
      }
    } catch (_) {
      // A corrupt local fallback starts empty; callers still get a valid
      // adapter shape and can decide whether to surface the failure.
      state = defaultStoreState({});
    }
  }

  function records() {
    const valid = [];
    for (const item of Array.isArray(state.playlinePosts) ? state.playlinePosts : []) {
      const row = normalizeStoredPost(item);
      if (row) valid.push(row);
    }
    state.playlinePosts = valid;
    return valid;
  }

  async function persist() {
    if (unavailable) return false;
    try {
      if (typeof opts.persist === 'function') {
        const result = await asPromise(opts.persist(state));
        if (result === false) throw new Error('persist_rejected');
      } else if (typeof opts.write === 'function') {
        const result = await asPromise(opts.write(state));
        if (result === false) throw new Error('write_rejected');
      } else if (filePath) {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        const temporary = filePath + '.tmp-' + process.pid + '-' + Math.random().toString(36).slice(2);
        fs.writeFileSync(temporary, JSON.stringify({ playlinePosts: state.playlinePosts, nextPlaylineSeq: safeSeq(state.nextPlaylineSeq) }), 'utf8');
        fs.renameSync(temporary, filePath);
      }
      return true;
    } catch (_) {
      unavailable = true;
      return false;
    }
  }

  async function purge(nowValue = now(), retentionMs = DEFAULT_RETENTION_MS, maxPosts = DEFAULT_MAX_STORED_POSTS) {
    const cutoff = Number(nowValue) - Math.max(0, Number(retentionMs) || DEFAULT_RETENTION_MS);
    const before = records().length;
    state.playlinePosts = records().filter(row => row.createdAt >= cutoff);
    state.playlinePosts.sort((a, b) => compareSeq(b.seq, a.seq));
    if (state.playlinePosts.length > maxPosts) state.playlinePosts = state.playlinePosts.slice(0, maxPosts);
    if (state.playlinePosts.length !== before) await persist();
    return true;
  }

  async function findByIdempotency(authorUid, clientPostId) {
    const row = records().find(item => item.authorUid === authorUid && item.clientPostId === clientPostId);
    return row ? clonePost(row) : null;
  }

  async function insertIdempotent(candidate) {
    if (unavailable) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    const input = clone(candidate);
    const existing = await findByIdempotency(input.authorUid, input.clientPostId);
    if (existing) {
      const same = (existing.intentHash && input.intentHash && existing.intentHash === input.intentHash) ||
        existing.intentKey === input.intentKey;
      return { post: existing, duplicate: !!same, conflict: !same };
    }
    const row = normalizeStoredPost({
      ...input,
      id: validOpaqueId(input.id) ? input.id : idFactory(),
      seq: safeSeq(input.seq) === '0' ? nextSeq(state.nextPlaylineSeq) : safeSeq(input.seq),
      createdAt: safeTimestamp(input.createdAt, now()),
    });
    if (!row) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    state.nextPlaylineSeq = compareSeq(state.nextPlaylineSeq, row.seq) < 0 ? row.seq : state.nextPlaylineSeq;
    state.playlinePosts.push(row);
    state.playlinePosts.sort((a, b) => compareSeq(b.seq, a.seq));
    if (state.playlinePosts.length > DEFAULT_MAX_STORED_POSTS) state.playlinePosts = state.playlinePosts.slice(0, DEFAULT_MAX_STORED_POSTS);
    if (!(await persist())) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    return { post: clonePost(row), duplicate: false, conflict: false };
  }

  async function appendOrReplay(actorOrCandidate, maybeCandidate) {
    return insertIdempotent(maybeCandidate || actorOrCandidate);
  }

  async function listPage(actor, query = {}) {
    if (unavailable) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    const beforeSeqValue = query.beforeSeq ? safeSeq(query.beforeSeq) : '';
    const snapshot = safeTimestamp(query.snapshot, now());
    const limit = Math.max(1, Math.min(MAX_LIMIT, Number(query.scanLimit || query.limit || DEFAULT_LIMIT)));
    let rows = records().filter(row => row.createdAt <= snapshot && (!beforeSeqValue || compareSeq(row.seq, beforeSeqValue) < 0));
    rows.sort((a, b) => compareSeq(b.seq, a.seq));
    const selected = rows.slice(0, limit);
    return { records: selected.map(clonePost), hasMore: rows.length > selected.length, snapshot, lastSeq: selected.length ? selected[selected.length - 1].seq : beforeSeqValue || '0' };
  }

  async function deleteOwned(authorUid, postId, requestId) {
    if (unavailable) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    const row = records().find(item => item.id === postId);
    if (!row || row.authorUid !== authorUid) return { missing: true };
    const rid = validOpaqueId(requestId) ? requestId : '';
    if (row.tombstone || row.deletedAt) {
      return { post: clonePost(row), deleted: true, duplicate: true, replayed: true };
    }
    row.deletedAt = now(); row.tombstone = true;
    if (rid) row.deleteRequestIds = [...new Set([...row.deleteRequestIds, rid])].slice(-20);
    if (!(await persist())) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    return { post: clonePost(row), deleted: true, duplicate: false, replayed: false };
  }

  async function findReportTarget(postId) {
    const row = records().find(item => item.id === postId);
    return row ? clonePost(row) : null;
  }

  async function snapshot() {
    return { playlinePosts: records().map(clonePost), nextPlaylineSeq: safeSeq(state.nextPlaylineSeq) };
  }

  return Object.freeze({
    adapter: 'json',
    kind: 'json',
    atomicIdempotency: false,
    listPage,
    listVisible: listPage,
    readPage: listPage,
    findByIdempotency,
    insertIdempotent,
    appendOrReplay,
    deleteOwned,
    remove: deleteOwned,
    findReportTarget,
    purge,
    snapshot,
    get unavailable() { return unavailable; },
  });
}

/* ------------------------- Supabase RPC adapter ------------------------ */

function rpcResponseData(value) {
  if (Array.isArray(value)) return value.length === 1 && ownRecord(value[0]) && (value[0].post || value[0].records || value[0].items) ? value[0] : value;
  if (ownRecord(value) && value.data !== undefined) return value.data;
  return value;
}

function createSupabasePlaylineStore(options = {}) {
  const opts = ownRecord(options) ? options : {};
  const configuredRpc = opts.rpc || opts.rpcImpl || opts.callRpc;
  const rpc = typeof configuredRpc === 'function' ? configuredRpc
    : configuredRpc && typeof configuredRpc.call === 'function' ? configuredRpc.call.bind(configuredRpc)
      : null;
  const names = {
    list: opts.listRpc || 'list_playline_posts_v1',
    // The create RPC already performs the author/clientPostId idempotency
    // lookup inside its transaction.  A separate find RPC is optional so a
    // stock migration cannot be made unavailable merely by preflighting a
    // function that is not part of the required schema surface.
    find: opts.findRpc || null,
    insert: opts.insertRpc || 'create_playline_post_v1',
    remove: opts.removeRpc || 'delete_playline_post_v1',
    report: opts.reportRpc || 'resolve_playline_report_target_v1',
    purge: opts.purgeRpc || 'purge_playline_posts_v1',
  };
  async function call(name, payload) {
    if (!rpc) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    try {
      const value = await rpc(name, clone(payload));
      if (value === undefined || value === null) return { unavailable: true, ok: false, reason: 'server_unavailable' };
      return rpcResponseData(value);
    } catch (_) {
      return { unavailable: true, ok: false, reason: 'server_unavailable' };
    }
  }
  async function listPage(actor, query = {}) {
    const uid = uidOf(actor);
    const value = await call(names.list, {
      p_actor_uid: uid,
      p_scope: query.scope || query.filter || 'all',
      p_before_seq: query.beforeSeq || null,
      p_snapshot: query.snapshot || Date.now(),
      p_limit: Math.max(1, Math.min(MAX_LIMIT, Number(query.scanLimit || query.limit || DEFAULT_LIMIT))),
    });
    if (adapterUnavailable(value)) return value;
    const data = rpcResponseData(value);
    if (Array.isArray(data)) return { records: data.map(mapRemotePost).filter(Boolean), hasMore: false, snapshot: query.snapshot || Date.now(), lastSeq: data.length ? safeSeq(data[data.length - 1].seq || data[data.length - 1].sequence) : query.beforeSeq || '0' };
    if (!ownRecord(data)) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    if (data.allowed === false || data.ok === false) return { ok:false, reason:String(data.reason || 'server_unavailable'), retryAfter:Number(data.retryAfter) || undefined };
    return {
      records: (Array.isArray(data.records) ? data.records : Array.isArray(data.posts) ? data.posts : Array.isArray(data.items) ? data.items : []).map(mapRemotePost).filter(Boolean),
      hasMore: data.hasMore === true,
      snapshot: safeTimestamp(data.snapshot, query.snapshot || Date.now()),
      lastSeq: safeSeq(data.lastSeq || data.nextBeforeSeq || data.nextSeq || query.beforeSeq || '0'),
    };
  }
  async function findByIdempotency(authorUid, clientPostId) {
    if (!names.find) return null;
    const value = await call(names.find, { p_author_uid: authorUid, p_client_post_id: clientPostId });
    if (adapterUnavailable(value)) return value;
    if (!value || (ownRecord(value) && (value.found === false || value.exists === false || value.notFound === true))) return null;
    if (ownRecord(value) && value.post) return mapRemotePost(value.post) || null;
    return mapRemotePost(value);
  }
  async function insertIdempotent(candidate) {
    const value = await call(names.insert, {
      p_post_id: candidate.id || null,
      p_author_uid: candidate.authorUid,
      p_client_post_id: candidate.clientPostId,
      p_audience: candidate.audience,
      p_content_kind: candidate.kind,
      p_content_version: 1,
      p_canonical_content: candidate.safeSnapshot || null,
      p_private_source: candidate.privateSource || null,
      p_expires_at: null,
    });
    if (adapterUnavailable(value)) return value;
    const data = rpcResponseData(value);
    if (!ownRecord(data)) return { unavailable: true, ok: false, reason: 'server_unavailable' };
    if (data.reason && data.created === false && data.duplicate !== true) return { ok:false, reason:String(data.reason), retryAfter:Number(data.retryAfter) || undefined, conflict:data.conflict === true };
    return {
      post: mapRemotePost({...candidate,...(data.post||data.row||{}),seq:data.post&&data.post.seq||data.row&&data.row.seq||candidate.seq||'1',clientPostId:candidate.clientPostId,safeSnapshot:data.post&&data.post.content||data.row&&data.row.content||candidate.safeSnapshot,normalizedText:candidate.normalizedText,createdAt:data.post&&data.post.createdAt||data.row&&data.row.createdAt||candidate.createdAt}),
      duplicate: data.duplicate === true || data.replayed === true,
      conflict: data.conflict === true,
    };
  }
  async function appendOrReplay(actorOrCandidate, maybeCandidate) {
    return insertIdempotent(maybeCandidate || actorOrCandidate);
  }
  async function deleteOwned(authorUid, postId, requestId) {
    const value = await call(names.remove, { p_author_uid: authorUid, p_post_id: postId, p_request_id: requestId || null });
    if (adapterUnavailable(value)) return value;
    const data = rpcResponseData(value);
    if (!ownRecord(data)) return { missing: true };
    if (data.reason && data.deleted !== true) return { ok:false, reason:String(data.reason), retryAfter:Number(data.retryAfter) || undefined, missing:data.reason === 'post_unavailable' };
    return { ...data, post: mapRemotePost(data.post || data.row || data) };
  }
  async function findReportTarget(postId,actor) {
    const value = await call(names.report, { p_reporter_uid:uidOf(actor), p_post_id: postId });
    if (adapterUnavailable(value)) return value;
    const data = rpcResponseData(value);
    if (!data) return null;
    if (ownRecord(data) && (data.allowed === false || data.ok === false)) return { ok:false, reason:String(data.reason || 'post_unavailable') };
    if (ownRecord(data) && data.targetUid) return data;
    if (ownRecord(data) && data.post) return mapRemotePost(data.post) || null;
    return mapRemotePost(data);
  }
  async function purge(nowValue) {
    const value = await call(names.purge, { p_now: nowValue || Date.now() });
    return adapterUnavailable(value) ? false : true;
  }
  return Object.freeze({
    adapter: 'supabase-rpc',
    kind: 'supabase-rpc',
    atomicIdempotency: true,
    listPage,
    listVisible: listPage,
    readPage: listPage,
    findByIdempotency,
    insertIdempotent,
    appendOrReplay,
    deleteOwned,
    remove: deleteOwned,
    findReportTarget,
    purge,
  });
}

/* ---------------------------- Playline module -------------------------- */

function createPlaylineModule(options = {}) {
  const opts = ownRecord(options) ? options : {};
  const store = opts.store || createJsonPlaylineStore({ state: opts.state, now: opts.now, idFactory: opts.idFactory });
  const nowFn = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const idFactory = typeof opts.idFactory === 'function' ? opts.idFactory : () => 'pl_' + crypto.randomBytes(16).toString('base64url');
  const cursorSecret = opts.cursorSecret || opts.secret || process.env.PLAYLINE_CURSOR_SECRET || 'playline-local-development-secret';
  const retentionMs = Number.isFinite(Number(opts.retentionMs)) ? Math.max(1, Number(opts.retentionMs)) : DEFAULT_RETENTION_MS;
  const cursorTtlMs = Number.isFinite(Number(opts.cursorTtlMs)) ? Math.max(1000, Number(opts.cursorTtlMs)) : DEFAULT_CURSOR_TTL_MS;
  const maxScan = Number.isFinite(Number(opts.maxScan)) ? Math.max(1, Math.min(10000, Number(opts.maxScan))) : DEFAULT_MAX_SCAN;
  const enabled = opts.enabled !== false;
  const publishBuckets = new Map();
  const listBuckets = new Map();
  const deleteBuckets = new Map();

  function bucketCheck(map, key, nowValue, windowMs, max) {
    const nowNumber = Number(nowValue);
    let values = map.get(key);
    if (!Array.isArray(values)) values = [];
    values = values.filter(timestamp => nowNumber - timestamp < windowMs);
    if (values.length >= max) {
      const oldest = values[0] || nowNumber;
      return { limited: true, retryAfter: safeRetryAfter(windowMs - (nowNumber - oldest)) };
    }
    values.push(nowNumber);
    map.set(key, values);
    if (map.size > 10000) {
      for (const [entryKey, entry] of map) if (!entry.length || nowNumber - entry[entry.length - 1] > DEFAULT_PUBLISH_LONG_WINDOW_MS) map.delete(entryKey);
    }
    return { limited: false };
  }

  function rollbackBucket(map, key, timestamp) {
    const values = map.get(key);
    if (!Array.isArray(values) || !values.length) return;
    const index = values.lastIndexOf(timestamp);
    if (index >= 0) values.splice(index, 1);
    if (!values.length) map.delete(key);
  }

  async function authorizeActor(actor, action) {
    const uid = uidOf(actor);
    if (!uid) return errorResult('not_authenticated', { action });
    if (ownRecord(actor) && (actor.authenticated === false || actor.sessionValid === false || actor.valid === false)) {
      return errorResult('not_authenticated', { action });
    }
    if (ownRecord(actor) && (actor.formal === false || actor.persistent === false || actor.accountType === 'anonymous')) {
      return errorResult('not_authenticated', { action });
    }
    if (isGuestActor(actor)) return errorResult('guest_forbidden', { action });
    if (isTestAdminActor(actor, opts)) return errorResult('test_admin_isolated', { action });
    if (opts.requireCapability === true || (ownRecord(actor) && Array.isArray(actor.requiredCapabilities))) {
      const capabilities = Array.isArray(actor.capabilities) ? actor.capabilities : [];
      if (!capabilities.includes(PROTOCOL)) return errorResult('unsupported_capability', { action });
    }
    const validator = getOption(opts, ['authorizeActor', 'authenticateActor', 'actorValidator', 'isFormalActor']);
    if (typeof validator === 'function') {
      try {
        const result = await invokeMaybe(validator, [actor, action]);
        if (result === false || result && result.ok === false) return errorResult(result && result.reason || 'not_authenticated', { action });
      } catch (_) {
        return errorResult('not_authenticated', { action });
      }
    }
    return { ok: true, uid };
  }

  async function profileProjection(authorUid, actor) {
    let raw = null;
    const resolver = getOption(opts, ['publicProfileResolver', 'profileResolver', 'resolveProfile', 'getPublicProfile']);
    if (typeof resolver === 'function') {
      try { raw = await invokeMaybe(resolver, [authorUid, actor]); } catch (_) { raw = null; }
    } else if (ownRecord(actor) && uidOf(actor) === authorUid) {
      raw = actor.profile || actor;
    }
    if (ownRecord(raw) && ownRecord(raw.profile)) raw = raw.profile;
    const source = ownRecord(raw) ? raw : {};
    const out = { uid: authorUid };
    const fields = ['name', 'username', 'avatar', 'frame', 'effect', 'nameFx', 'lang', 'countryRegion', 'signature'];
    for (const field of fields) {
      if (source[field] === undefined || source[field] === null) continue;
      if (PRIVATE_KEY_RE.test(field)) continue;
      if (typeof source[field] === 'string') out[field] = boundedText(source[field], field === 'signature' ? 160 : 120);
      else if (typeof source[field] === 'number' && Number.isFinite(source[field])) out[field] = source[field];
      else if (typeof source[field] === 'boolean') out[field] = source[field];
      else if (field === 'avatar' || field === 'frame' || field === 'effect' || field === 'nameFx') out[field] = clone(source[field]);
    }
    if (!out.name && !out.username) out.name = authorUid;
    return out;
  }

  async function rawVisible(actor, post, scope, profileCache) {
    if (!post || post.tombstone || post.deletedAt) return false;
    if (post.createdAt < Number(nowFn()) - retentionMs) return false;
    const authorUid = text(post.authorUid);
    if (!authorUid || isTestAdminActor({ uid: authorUid, testAdmin: post.testAdmin }, opts)) return false;
    const viewerUid = uidOf(actor);
    if (!viewerUid) return false;
    if (await relation(opts, 'blocked', viewerUid, authorUid, actor, null)) return false;
    if (viewerUid !== authorUid && await relation(opts, 'blocked', authorUid, viewerUid, null, post)) return false;
    if (post.audience === 'friends') {
      if (viewerUid !== authorUid && !(await relation(opts, 'friends', viewerUid, authorUid, actor, post))) return false;
    }
    if (scope === 'friends' && viewerUid !== authorUid && !(await relation(opts, 'friends', viewerUid, authorUid, actor, post))) return false;
    if (profileCache && !profileCache.has(authorUid)) profileCache.set(authorUid, await profileProjection(authorUid, actor));
    return true;
  }

  function publicContent(post) {
    if (post.kind === 'text') return { kind: 'text', text: typeof post.normalizedText === 'string' ? post.normalizedText : '' };
    if (post.kind === 'game_share') {
      const gameId = post.safeSnapshot && post.safeSnapshot.gameId;
      return VALID_GAMES.includes(gameId) ? { kind: 'game_share', gameId } : null;
    }
    if (post.kind === 'result_share') return canonicalResult(post.safeSnapshot);
    if (post.kind === 'record_share') return canonicalRecord(post.safeSnapshot);
    return null;
  }

  async function projectPost(actor, post, profileCache) {
    const content = publicContent(post);
    if (!content) return null;
    const author = profileCache && profileCache.get(post.authorUid) || await profileProjection(post.authorUid, actor);
    const viewerUid = uidOf(actor);
    const blocked = await relation(opts, 'blocked', viewerUid, post.authorUid, actor, null) ||
      await relation(opts, 'blocked', post.authorUid, viewerUid, null, post);
    const friends = viewerUid !== post.authorUid && !blocked && await relation(opts, 'friends', viewerUid, post.authorUid, actor, post);
    const canMessage = viewerUid !== post.authorUid && friends && !blocked;
    const output = {
      id: post.id,
      author,
      createdAt: post.createdAt,
      audience: post.audience,
      content,
      actions: {
        canOpenProfile: true,
        canMessage: !!canMessage,
        canReport: viewerUid !== post.authorUid,
        canDelete: viewerUid === post.authorUid,
      },
    };
    return output;
  }

  async function normalizeIntent(actor, intent) {
    if (!ownRecord(intent)) return errorResult('invalid_post_shape', { action: 'publish' });
    const clientPostId = intent.clientPostId;
    if (!validOpaqueId(clientPostId, CLIENT_POST_ID_RE)) return errorResult('invalid_client_post_id', { action: 'publish' });
    const audience = intent.audience;
    if (!VALID_AUDIENCES.includes(audience)) return errorResult('invalid_audience', { action: 'publish', clientPostId });
    const content = intent.content;
    if (!ownRecord(content)) return errorResult('invalid_post_kind', { action: 'publish', clientPostId });
    const declaredKind = content.kind !== undefined ? content.kind : content.type;
    if (content.kind !== undefined && content.type !== undefined && content.kind !== content.type) return errorResult('invalid_post_kind', { action: 'publish', clientPostId });
    if (!VALID_KINDS.includes(declaredKind)) return errorResult('invalid_post_kind', { action: 'publish', clientPostId });
    const allowed = new Set(['kind', 'type']);
    let canonical;
    let privateSource = null;
    if (declaredKind === 'text') {
      allowed.add('text');
      if (Object.keys(content).some(key => !allowed.has(key))) return errorResult('invalid_post_shape', { action: 'publish', clientPostId });
      const valid = validateText(content.text);
      if (!valid.ok) return errorResult(valid.reason, { action: 'publish', clientPostId });
      canonical = { kind: 'text', text: valid.value };
    } else if (declaredKind === 'game_share') {
      allowed.add('gameId');
      if (Object.keys(content).some(key => !allowed.has(key))) return errorResult('invalid_post_shape', { action: 'publish', clientPostId });
      const gameId = text(content.gameId).trim();
      if (!VALID_GAMES.includes(gameId)) return errorResult('invalid_game', { action: 'publish', clientPostId });
      canonical = { kind: 'game_share', gameId };
    } else if (declaredKind === 'result_share') {
      allowed.add('resultId');
      if (Object.keys(content).some(key => !allowed.has(key))) return errorResult('invalid_post_shape', { action: 'publish', clientPostId });
      const resultId = text(content.resultId).trim();
      if (!validOpaqueId(resultId)) return errorResult('result_unavailable', { action: 'publish', clientPostId });
      privateSource = { resultId };
      canonical = await resolveReference(opts, declaredKind, actor, resultId);
      if (!canonical) return errorResult('result_unavailable', { action: 'publish', clientPostId });
    } else {
      allowed.add('replayId');
      // `recordId`/`record` are accepted as a migration convenience only;
      // the resulting post never exposes which spelling was used.
      allowed.add('recordId'); allowed.add('record');
      if (Object.keys(content).some(key => !allowed.has(key))) return errorResult('invalid_post_shape', { action: 'publish', clientPostId });
      const replayId = content.replayId !== undefined ? content.replayId : content.recordId !== undefined ? content.recordId : content.record;
      if (!validOpaqueId(replayId)) return errorResult('record_unavailable', { action: 'publish', clientPostId });
      privateSource = { replayId };
      canonical = await resolveReference(opts, declaredKind, actor, replayId);
      if (!canonical) return errorResult('record_unavailable', { action: 'publish', clientPostId });
    }
    // Idempotency is tied to the caller's normalized intent, not to mutable
    // resolver metadata (for example a freshly recomputed settledAt).  The
    // private reference itself stays inside the intent index and never enters
    // a public post projection.
    const idempotencyContent = declaredKind === 'result_share'
      ? { kind: declaredKind, resultId: privateSource.resultId }
      : declaredKind === 'record_share'
        ? { kind: declaredKind, replayId: privateSource.replayId }
        : canonical;
    const normalized = { clientPostId, audience, content: idempotencyContent };
    return { ok: true, clientPostId, audience, kind: declaredKind, content: canonical,
      intentKey: canonicalIntentKey(normalized), intentHash: hashIntent(normalized), privateSource,
      normalizedText: declaredKind === 'text' ? canonical.text : undefined };
  }

  async function findExisting(uid, clientPostId) {
    if (!store) return null;
    // Remote adapters perform the idempotency lookup and insert in one atomic
    // RPC.  Avoid a separate probe (and its extra failure mode) there.
    if (store.atomicIdempotency === true) return null;
    const finder = store.findByIdempotency || store.findByAuthorClientPostId;
    if (typeof finder !== 'function') return null;
    try {
      const value = await invokeMaybe(finder.bind(store), [uid, clientPostId]);
      if (adapterUnavailable(value)) return value;
      if (value && ownRecord(value) && value.post && !value.id) return value.post;
      return value || null;
    } catch (_) { return { unavailable: true, ok: false, reason: 'server_unavailable' }; }
  }

  async function list(actor, query = {}) {
    const auth = await authorizeActor(actor, 'list');
    if (!auth.ok) return auth;
    if (!enabled) return errorResult('feature_disabled', { action: 'list' });
    const viewerUid = auth.uid;
    const filter = query && (query.filter !== undefined ? query.filter : query.scope);
    const scope = filter === undefined ? 'all' : filter;
    if (!VALID_FILTERS.includes(scope)) return errorResult('invalid_filter', { action: 'list' });
    const limitRaw = query && query.limit;
    const limit = limitRaw === undefined ? DEFAULT_LIMIT : Number(limitRaw);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) return errorResult('invalid_limit', { action: 'list' });
    const cursorRaw = query && (query.cursor !== undefined ? query.cursor : query.before !== undefined ? query.before : query.beforeSeq);
    const nowValue = Number(nowFn());
    const bucket = bucketCheck(listBuckets, viewerUid, nowValue, DEFAULT_LIST_WINDOW_MS, DEFAULT_LIST_MAX);
    if (bucket.limited) return errorResult('rate_limited', { action: 'list', retryAfter: bucket.retryAfter });
    let cursor = null;
    if (cursorRaw !== undefined && cursorRaw !== null && cursorRaw !== '') {
      cursor = decodeCursor(cursorRaw, cursorSecret, nowValue, cursorTtlMs, scope);
      if (!cursor) return errorResult('invalid_cursor', { action: 'list' });
    }
    const snapshot = cursor ? cursor.snapshot : nowValue;
    try { if (typeof store.purge === 'function') await store.purge(nowValue, retentionMs, DEFAULT_MAX_STORED_POSTS); } catch (_) { /* purge is best effort */ }
    const profileCache = new Map();
    const posts = [];
    let beforeSeq = cursor ? cursor.seq : '';
    let lastScanned = beforeSeq || '0';
    let storeHasMore = false;
    let scanned = 0;
    let rounds = 0;
    const pageMethod = store && (store.listPage || store.listVisible || store.readPage || store.list);
    if (typeof pageMethod !== 'function') return errorResult('server_unavailable', { action: 'list' });
    while (posts.length < limit && scanned < maxScan && rounds < 20) {
      rounds++;
      const remaining = Math.max(limit - posts.length, 1);
      // Ask the store for exactly the number of candidates still needed.  A
      // store may have more rows behind that boundary; its `hasMore` bit then
      // drives the signed continuation cursor.  This keeps a page boundary
      // from accidentally consuming the first row of the next page.
      const scanLimit = Math.min(remaining, maxScan - scanned);
      const page = await invokeMaybe(pageMethod.bind(store), [actor, { scope, filter: scope, beforeSeq: beforeSeq || null, snapshot, limit: scanLimit, scanLimit }]);
      if (adapterUnavailable(page) || !page) return errorResult('server_unavailable', { action: 'list' });
      if(page.ok===false&&page.reason)return errorResult(page.reason,{action:'list',retryAfter:page.retryAfter});
      const records = Array.isArray(page.records) ? page.records : Array.isArray(page.posts) ? page.posts : Array.isArray(page.items) ? page.items : [];
      if (!records.length) { storeHasMore = !!(page.hasMore && scanned < maxScan); break; }
      scanned += records.length;
      for (const record of records) {
        const normalized = normalizeStoredPost(record);
        if (!normalized) continue;
        lastScanned = normalized.seq;
        if (!(await rawVisible(actor, normalized, scope, profileCache))) continue;
        const projected = await projectPost(actor, normalized, profileCache);
        if (projected) posts.push(projected);
        if (posts.length >= limit) break;
      }
      const pageLast = safeSeq(page.lastSeq || (records.length ? records[records.length - 1].seq : lastScanned));
      if (pageLast !== '0') { beforeSeq = pageLast; lastScanned = pageLast; }
      storeHasMore = page.hasMore === true;
      if (!storeHasMore || records.length < scanLimit) break;
    }
    // Only expose a continuation when the page is full and the store reports
    // more candidates.  Hidden/blocked rows therefore never become a count or
    // an oracle for another user's social graph.
    const hasMore = posts.length >= limit && storeHasMore && lastScanned !== '0';
    const nextCursor = hasMore ? encodeCursor({ scope, seq: lastScanned, snapshot, issued: nowValue }, cursorSecret, nowValue) : null;
    const result = successResult({ filter: scope, scope, posts, hasMore, nextCursor });
    Object.defineProperty(result, 'items', { value: posts, enumerable: false });
    Object.defineProperty(result, 'cursor', { value: nextCursor, enumerable: false });
    Object.defineProperty(result, 'nextBeforeSeq', { value: nextCursor, enumerable: false });
    return result;
  }

  async function publish(actor, intent = {}) {
    const auth = await authorizeActor(actor, 'publish');
    if (!auth.ok) return auth;
    if (!enabled) return errorResult('feature_disabled', { action: 'publish' });
    if (!ownRecord(intent)) return errorResult('invalid_post_shape', { action: 'publish' });
    const clientPostId = intent.clientPostId;
    if (validOpaqueId(clientPostId, CLIENT_POST_ID_RE)) {
      const existing = await findExisting(auth.uid, clientPostId);
      if (adapterUnavailable(existing)) return errorResult('server_unavailable', { action: 'publish', clientPostId });
      if (existing) {
        const provisional = await normalizeIntent(actor, intent);
        if (!provisional.ok) {
          // A malformed retry cannot disclose or mutate the existing post;
          // preserve the original validation reason.
          return provisional;
        }
        const same = (existing.intentHash && existing.intentHash === provisional.intentHash) ||
          existing.intentKey === provisional.intentKey;
        if (!same) return errorResult('idempotency_conflict', { action: 'publish', clientPostId });
        if (existing.tombstone || existing.deletedAt) return errorResult('post_unavailable', { action: 'publish', clientPostId });
        const profileCache = new Map([[existing.authorUid, await profileProjection(existing.authorUid, actor)]]);
        const post = await projectPost(actor, existing, profileCache);
        return post ? successResult({ action: 'publish', clientPostId, post, duplicate: true, replayed: true }) : errorResult('post_unavailable', { action: 'publish', clientPostId });
      }
    }
    const normalized = await normalizeIntent(actor, intent);
    if (!normalized.ok) return normalized;
    const nowValue = Number(nowFn());
    const short = bucketCheck(publishBuckets, auth.uid + ':short', nowValue, Number(opts.publishShortWindowMs) || DEFAULT_PUBLISH_SHORT_WINDOW_MS, Number(opts.publishShortMax) || DEFAULT_PUBLISH_SHORT_MAX);
    if (short.limited) return errorResult('rate_limited', { action: 'publish', clientPostId: normalized.clientPostId, retryAfter: short.retryAfter });
    const long = bucketCheck(publishBuckets, auth.uid + ':long', nowValue, Number(opts.publishLongWindowMs) || DEFAULT_PUBLISH_LONG_WINDOW_MS, Number(opts.publishLongMax) || DEFAULT_PUBLISH_LONG_MAX);
    if (long.limited) {
      // Roll back the short bucket reservation when the long bucket blocks so
      // a failed attempt does not consume a second quota.
      rollbackBucket(publishBuckets, auth.uid + ':short', nowValue);
      return errorResult('rate_limited', { action: 'publish', clientPostId: normalized.clientPostId, retryAfter: long.retryAfter });
    }
    const candidate = {
      id: idFactory(),
      seq: '0',
      authorUid: auth.uid,
      audience: normalized.audience,
      kind: normalized.kind,
      normalizedText: normalized.normalizedText,
      privateSource: normalized.privateSource,
      safeSnapshot: normalized.content,
      clientPostId: normalized.clientPostId,
      intentKey: normalized.intentKey,
      intentHash: normalized.intentHash,
      createdAt: nowValue,
    };
    try {
      const inserter = store && (store.insertIdempotent || store.appendOrReplay || store.insert);
      if (typeof inserter !== 'function') return errorResult('server_unavailable', { action: 'publish', clientPostId: normalized.clientPostId });
      const persisted = await invokeMaybe(inserter.bind(store), [candidate]);
      if (adapterUnavailable(persisted)) {
        rollbackBucket(publishBuckets, auth.uid + ':short', nowValue);
        rollbackBucket(publishBuckets, auth.uid + ':long', nowValue);
        return errorResult('server_unavailable', { action: 'publish', clientPostId: normalized.clientPostId });
      }
      if(persisted&&persisted.ok===false){rollbackBucket(publishBuckets,auth.uid+':short',nowValue);rollbackBucket(publishBuckets,auth.uid+':long',nowValue);return errorResult(persisted.reason||'server_unavailable',{action:'publish',clientPostId:normalized.clientPostId,retryAfter:persisted.retryAfter});}
      if (!persisted || persisted.conflict === true) {
        rollbackBucket(publishBuckets, auth.uid + ':short', nowValue);
        rollbackBucket(publishBuckets, auth.uid + ':long', nowValue);
        return errorResult('idempotency_conflict', { action: 'publish', clientPostId: normalized.clientPostId });
      }
      const row = persisted.post || persisted.row || persisted;
      const duplicate = persisted.duplicate === true || persisted.replayed === true;
      if (!row || !normalizeStoredPost(row)) {
        rollbackBucket(publishBuckets, auth.uid + ':short', nowValue);
        rollbackBucket(publishBuckets, auth.uid + ':long', nowValue);
        return errorResult('server_unavailable', { action: 'publish', clientPostId: normalized.clientPostId });
      }
      if (duplicate) {
        rollbackBucket(publishBuckets, auth.uid + ':short', nowValue);
        rollbackBucket(publishBuckets, auth.uid + ':long', nowValue);
      }
      if (row.tombstone || row.deletedAt) return errorResult('post_unavailable', { action: 'publish', clientPostId: normalized.clientPostId });
      const profileCache = new Map([[row.authorUid, await profileProjection(row.authorUid, actor)]]);
      const post = await projectPost(actor, row, profileCache);
      if (!post) return errorResult('post_unavailable', { action: 'publish', clientPostId: normalized.clientPostId });
      return successResult({ action: 'publish', clientPostId: normalized.clientPostId, post, duplicate, replayed: duplicate });
    } catch (_) {
      rollbackBucket(publishBuckets, auth.uid + ':short', nowValue);
      rollbackBucket(publishBuckets, auth.uid + ':long', nowValue);
      return errorResult('server_unavailable', { action: 'publish', clientPostId: normalized.clientPostId });
    }
  }

  async function remove(actor, input = {}) {
    const auth = await authorizeActor(actor, 'remove');
    if (!auth.ok) return auth;
    if (!enabled) return errorResult('feature_disabled', { action: 'remove' });
    if (!ownRecord(input) || !validOpaqueId(input.postId || input.id, OPAQUE_ID_RE)) return errorResult('post_unavailable', { action: 'remove' });
    const postId = input.postId || input.id;
    const requestId = input.requestId || input.clientDeleteId || '';
    const nowValue = Number(nowFn());
    const bucket = bucketCheck(deleteBuckets, auth.uid, nowValue, Number(opts.deleteWindowMs) || DEFAULT_DELETE_WINDOW_MS, Number(opts.deleteMax) || DEFAULT_DELETE_MAX);
    if (bucket.limited) return errorResult('rate_limited', { action: 'remove', postId, retryAfter: bucket.retryAfter });
    try {
      const remover = store && (store.deleteOwned || store.remove);
      if (typeof remover !== 'function') return errorResult('server_unavailable', { action: 'remove', postId });
      const result = await invokeMaybe(remover.bind(store), [auth.uid, postId, requestId]);
      if (adapterUnavailable(result)) return errorResult('server_unavailable', { action: 'remove', postId });
      if(result&&result.ok===false)return errorResult(result.reason||'post_unavailable',{action:'remove',postId,retryAfter:result.retryAfter});
      if (!result || result.missing === true || result.forbidden === true) return errorResult('post_unavailable', { action: 'remove', postId });
      return successResult({ action: 'remove', postId, deleted: true, replayed: result.replayed === true || result.duplicate === true });
    } catch (_) {
      return errorResult('server_unavailable', { action: 'remove', postId });
    }
  }

  async function resolveReportTarget(actor, postId) {
    const auth = await authorizeActor(actor, 'report');
    if (!auth.ok) return auth;
    if (!enabled) return errorResult('feature_disabled', { action: 'report' });
    if (!validOpaqueId(postId)) return errorResult('post_unavailable', { action: 'report' });
    try {
      const finder = store && (store.findReportTarget || store.findById);
      if (typeof finder !== 'function') return errorResult('server_unavailable', { action: 'report' });
      const row = await invokeMaybe(finder.bind(store), [postId,actor]);
      if (adapterUnavailable(row)) return errorResult('server_unavailable', { action: 'report' });
      if(row&&row.ok===false)return errorResult(row.reason||'post_unavailable',{action:'report'});
      if(row&&row.targetUid)return successResult({action:'report',postId:String(row.postId||postId),targetUid:String(row.targetUid),authorUid:String(row.targetUid),contextType:'playline'});
      const post = row && row.post && !row.id ? row.post : row;
      if (!post || !(await rawVisible(actor, normalizeStoredPost(post), 'all', new Map()))) return errorResult('post_unavailable', { action: 'report' });
      const author = await profileProjection(post.authorUid, actor);
      return successResult({ action: 'report', postId: post.id, targetUid: post.authorUid, authorUid: post.authorUid, author, contextType: 'playline' });
    } catch (_) {
      return errorResult('server_unavailable', { action: 'report' });
    }
  }

  return Object.freeze({ list, publish, remove, resolveReportTarget });
}

// Names used by the server plan and by early local callers.  Keeping aliases
// here costs no surface in the returned module and lets adapter conformance
// tests use either descriptive spelling without touching database details.
module.exports = Object.freeze({
  PROTOCOL,
  VALID_GAMES,
  VALID_AUDIENCES,
  VALID_FILTERS,
  VALID_KINDS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_TEXT_CODE_POINTS,
  MAX_TEXT_LINES,
  MAX_TEXT_BYTES,
  CLIENT_POST_ID_RE,
  normalizeText,
  validateText,
  createPlaylineModule,
  createJsonPlaylineStore,
  createSupabasePlaylineStore,
  createJsonStoreAdapter: createJsonPlaylineStore,
  createJsonPlaylineStoreAdapter: createJsonPlaylineStore,
  createSupabaseRpcStoreAdapter: createSupabasePlaylineStore,
  createSupabasePlaylineStoreAdapter: createSupabasePlaylineStore,
  createLocalJsonStoreAdapter: createJsonPlaylineStore,
  createSupabaseStoreAdapter: createSupabasePlaylineStore,
});
