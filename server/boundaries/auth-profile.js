'use strict';

/*
 * T7 Auth/Profile vertical slice.
 *
 * The transport remains in server/index.js, but the shared policy for session
 * tokens and profile projections lives behind two deliberately small methods:
 * session(command) and profile(command).  Storage is an Adapter seam so the
 * same policy can run against the live JSON runtime or an isolated memory
 * store.  No password/PIN material enters this module; scrypt and legacy PIN
 * verification remain owned by their existing credential module/caller.
 */

const crypto = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 30 * DAY_MS;
const DEFAULT_TOKEN_LIMIT = 5;
const TOKEN_RECORD_RE = /^t2\$(\d{10,16})\$([A-Za-z0-9_-]{40,100})$/;
const LEGACY_TOKEN_HASH_RE = /^[A-Za-z0-9_-]{40,100}$/;
const TOKEN_HASH_PREFIX = 'mg-auth:';

function ownObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  if (value === undefined) return undefined;
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_error) {}
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_error) { return value; }
}

function text(value) {
  return String(value === undefined || value === null ? '' : value);
}

function secureEqual(left, right) {
  const a = Buffer.from(text(left));
  const b = Buffer.from(text(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(TOKEN_HASH_PREFIX + text(token)).digest('base64url');
}

function parseRecord(value) {
  const raw = text(value);
  const versioned = TOKEN_RECORD_RE.exec(raw);
  if (versioned) return { issuedAt: Number(versioned[1]), hash: versioned[2] };
  if (LEGACY_TOKEN_HASH_RE.test(raw)) return { issuedAt: 0, hash: raw };
  return null;
}

function validAdapter(adapter) {
  return !!adapter && typeof adapter.get === 'function' &&
    typeof adapter.list === 'function' && typeof adapter.put === 'function' &&
    typeof adapter.remove === 'function';
}

function createJsonRuntimeAuthProfileAdapter(options = {}) {
  const readUser = typeof options.readUser === 'function' ? options.readUser : null;
  const readUsers = typeof options.readUsers === 'function' ? options.readUsers : null;
  const putUser = typeof options.putUser === 'function' ? options.putUser : null;
  const removeUser = typeof options.removeUser === 'function' ? options.removeUser : null;
  if (!readUser || !readUsers || !putUser || !removeUser) {
    throw new TypeError('auth_profile_runtime_adapter_callbacks_required');
  }
  return Object.freeze({
    get(uid) { return readUser(text(uid)) || null; },
    list() {
      const source = readUsers();
      if (Array.isArray(source)) return source.filter(item => item && typeof item === 'object');
      return Object.values(ownObject(source)).filter(item => item && typeof item === 'object');
    },
    put(user) {
      if (!user || typeof user !== 'object' || !text(user.uid)) throw new TypeError('auth_profile_user_required');
      putUser(user);
      return user;
    },
    remove(uid) { return removeUser(text(uid)); },
  });
}

function createMemoryAuthProfileAdapter(initial = {}) {
  const users = new Map();
  const source = Array.isArray(initial) ? initial : Object.values(ownObject(initial));
  for (const item of source) {
    if (item && typeof item === 'object' && text(item.uid)) users.set(text(item.uid), clone(item));
  }
  return Object.freeze({
    get(uid) { return users.get(text(uid)) || null; },
    list() { return [...users.values()]; },
    put(user) {
      if (!user || typeof user !== 'object' || !text(user.uid)) throw new TypeError('auth_profile_user_required');
      users.set(text(user.uid), user);
      return user;
    },
    remove(uid) { return users.delete(text(uid)); },
  });
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createAuthProfileBoundary(options = {}) {
  const adapter = options.adapter;
  if (!validAdapter(adapter)) throw new TypeError('auth_profile_adapter_required');
  if (typeof options.now !== 'function') throw new TypeError('auth_profile_clock_required');
  const clock = options.now;
  const tokenTtlMs = Math.min(365 * DAY_MS, finitePositive(options.tokenTtlMs, DEFAULT_TOKEN_TTL_MS));
  const tokenLimit = Math.max(1, Math.min(32, Math.floor(finitePositive(options.tokenLimit, DEFAULT_TOKEN_LIMIT))));
  const randomBytes = typeof options.randomBytes === 'function' ? options.randomBytes : size => crypto.randomBytes(size);
  const normalizeUser = typeof options.normalizeUser === 'function' ? options.normalizeUser : value => value;
  const normalizeOwned = typeof options.normalizeOwned === 'function' ? options.normalizeOwned : value => value;
  const normalizeGameCosmetics = typeof options.normalizeGameCosmetics === 'function' ? options.normalizeGameCosmetics : value => value;
  const publicPlayerCharacter = typeof options.publicPlayerCharacter === 'function' ? options.publicPlayerCharacter : value => clone(value);
  const deriveMastery = typeof options.deriveMastery === 'function' ? options.deriveMastery : value => value || {};
  const levelProgress = typeof options.levelProgress === 'function' ? options.levelProgress : value => ({ xp: Number(value) || 0 });
  const xpForLevel = typeof options.xpForLevel === 'function' ? options.xpForLevel : value => Number(value) || 0;
  const dailyTasksPayload = typeof options.dailyTasksPayload === 'function' ? options.dailyTasksPayload : () => ({ });
  const publicPresence = typeof options.publicPresence === 'function' ? options.publicPresence : () => 'offline';
  const virtualProfile = typeof options.virtualProfile === 'function' ? options.virtualProfile : value => value;
  const isHidden = typeof options.isHidden === 'function' ? options.isHidden : () => false;
  const isTestAdmin = typeof options.isTestAdmin === 'function' ? options.isTestAdmin : () => false;
  const validOwnedId = typeof options.validOwnedId === 'function' ? options.validOwnedId : () => false;
  const ownsItem = typeof options.ownsItem === 'function' ? options.ownsItem : () => false;
  const sanitizePlainText = typeof options.sanitizePlainText === 'function' ? options.sanitizePlainText : value => text(value);
  const validGames = new Set(Array.isArray(options.validGames) ? options.validGames.map(text) : []);
  const getShopPrices = typeof options.getShopPrices === 'function' ? options.getShopPrices : () => ({});
  const canCompare = typeof options.canCompare === 'function' ? options.canCompare : () => false;

  function now() {
    const value = Number(clock());
    if (!Number.isFinite(value) || value < 0) throw new Error('auth_profile_clock_invalid');
    return value;
  }

  function normalizeRecords(values, at = now()) {
    const output = [];
    for (const value of Array.isArray(values) ? values : []) {
      const parsed = parseRecord(value);
      if (!parsed) continue;
      // Legacy bare hashes receive one complete TTL on first observation,
      // matching the pre-boundary migration behavior.
      const issuedAt = parsed.issuedAt || at;
      if (at - issuedAt <= tokenTtlMs) output.push('t2$' + issuedAt + '$' + parsed.hash);
    }
    return output.slice(-tokenLimit);
  }

  function result(ok, fields = {}) {
    return Object.freeze({ ok: !!ok, ...fields });
  }

  function userForCommand(command) {
    if (command && command.user && typeof command.user === 'object') return command.user;
    return adapter.get(command && command.uid);
  }

  function normalizeUserTokens(user, at) {
    if (!user || typeof user !== 'object') return [];
    const records = normalizeRecords(user.authTokens, at);
    user.authTokens = records;
    try { adapter.put(user); } catch (_error) { return records; }
    return records;
  }

  function issue(command) {
    const user = userForCommand(command);
    if (!user || !text(user.uid)) return result(false, { reason: 'user_not_found' });
    let at;
    try { at = now(); } catch (_error) { return result(false, { reason: 'auth_unavailable' }); }
    const previous = Array.isArray(user.authTokens) ? user.authTokens.slice() : [];
    try {
      const tokenValue = randomBytes(32);
      const token = Buffer.isBuffer(tokenValue) ? tokenValue.toString('base64url') : text(tokenValue);
      if (!/^[A-Za-z0-9_-]{24,200}$/.test(token)) return result(false, { reason: 'auth_unavailable' });
      const hash = tokenHash(token);
      const records = normalizeRecords(previous, at).filter(record => {
        const parsed = parseRecord(record);
        return !parsed || !secureEqual(parsed.hash, hash);
      });
      user.authTokens = records.concat('t2$' + at + '$' + hash).slice(-tokenLimit);
      adapter.put(user);
      return result(true, { uid: text(user.uid), token, tokenHash: hash });
    } catch (_error) {
      user.authTokens = previous;
      return result(false, { reason: 'auth_unavailable' });
    }
  }

  function verify(command, suppliedHash) {
    const user = userForCommand(command);
    if (!user || !text(user.uid)) return result(false, { reason: 'session_expired' });
    let at;
    try { at = now(); } catch (_error) { return result(false, { reason: 'auth_unavailable' }); }
    const records = normalizeRecords(user.authTokens, at);
    user.authTokens = records;
    const expected = suppliedHash ? text(suppliedHash) : tokenHash(command && command.token);
    const valid = records.some(record => {
      const parsed = parseRecord(record);
      return !!parsed && secureEqual(parsed.hash, expected);
    });
    if (!valid) return result(false, { reason: 'session_expired' });
    try { adapter.put(user); } catch (_error) { return result(false, { reason: 'auth_unavailable' }); }
    return result(true, { uid: text(user.uid), user, tokenHash: expected });
  }

  function revoke(command) {
    const user = userForCommand(command);
    if (!user || !text(user.uid)) return result(false, { reason: 'session_expired' });
    let at;
    try { at = now(); } catch (_error) { return result(false, { reason: 'auth_unavailable' }); }
    const expected = text(command && command.tokenHash);
    if (!expected) return result(false, { reason: 'session_expired' });
    const records = normalizeRecords(user.authTokens, at);
    const next = records.filter(record => {
      const parsed = parseRecord(record);
      return !parsed || !secureEqual(parsed.hash, expected);
    });
    const revoked = next.length !== records.length;
    user.authTokens = next;
    try { adapter.put(user); } catch (_error) { return result(false, { reason: 'auth_unavailable' }); }
    return result(revoked, { uid: text(user.uid), revoked });
  }

  function session(command = {}) {
    const action = text(command.action);
    try {
      if (action === 'normalize') return result(true, { records: normalizeRecords(command.records) });
      if (action === 'hash_token') return result(true, { tokenHash: tokenHash(command.token) });
      if (action === 'issue') return issue(command);
      if (action === 'authenticate') return verify(command, null);
      if (action === 'verify_token') return verify(command, null);
      if (action === 'verify_hash') return verify(command, command.tokenHash);
      if (action === 'resolve_token') {
        const hash = tokenHash(command.token);
        for (const user of adapter.list()) {
          const found = verify({ user, tokenHash: hash }, hash);
          if (found.ok) return found;
        }
        return result(false, { reason: 'session_expired' });
      }
      if (action === 'revoke') return revoke(command);
      return result(false, { reason: 'unsupported_action' });
    } catch (_error) {
      return result(false, { reason: 'auth_unavailable' });
    }
  }

  function privateProjection(user, viewerUid) {
    if (!user || typeof user !== 'object') return null;
    normalizeUser(user);
    const wins = user.wins && typeof user.wins === 'object' && !Array.isArray(user.wins) ? user.wins : {};
    const profile = {
      uid: user.uid,
      name: user.name,
      avatar: user.avatar,
      background: user.background || 0,
      frame: user.frame || 0,
      effect: user.effect || 0,
      owned: clone(normalizeOwned(user.owned)) || { avatars: [], frames: [], effects: [], backgrounds: [], game_cosmetics: [] },
      cosmeticSchemaVersion: 1,
      gameCosmetics: clone(normalizeGameCosmetics(user.gameCosmetics)),
      playerCharacter: clone(publicPlayerCharacter(user.playerCharacter)),
      coins: user.coins || 0,
      xp: user.xp || 0,
      level: user.level || 1,
      streak: user.streak || 0,
      bestStreak: user.bestStreak || 0,
      played: clone(user.played || {}),
      total: user.total || 0,
      wins: clone(wins),
      totalWins: user.totalWins || 0,
      mastery: clone(deriveMastery(wins)),
      lang: user.lang || 'zh-CN',
      achievements: clone(user.achievements || []),
      playmates: clone(user.playmates || {}),
      daily: clone(user.daily || { play: 0, win: 0, streak: 0 }),
      nameFx: user.nameFx || 0,
      dailyFirstWinDate: user.dailyFirstWinDate || '',
      dailyAICurrencyKey: user.dailyAICurrencyKey || '',
      dailyAICurrencyEarned: user.dailyAICurrencyEarned || 0,
      xpProgress: clone(levelProgress(user.xp || 0)),
      dailyTasks: clone(dailyTasksPayload(user)),
      signature: user.signature || '',
      countryRegion: user.countryRegion || '',
      genderTag: user.genderTag || 'hidden',
      showcase: clone(user.showcase || null),
      presencePreference: user.presencePreference || 'joinable',
      presenceVisibility: user.presenceVisibility || 'everyone',
      presence: publicPresence(user.uid, user, viewerUid || user.uid),
      username: user.username || '',
      authVersion: user.authVersion || (user.pin_hash ? 'legacy-pin-v1' : ''),
      ephemeral: !!user.ephemeral,
      accountKind: user.ephemeral ? 'guest' : 'member',
      companionCheckinDay: user.companionCheckinDay || '',
    };
    return virtualProfile(profile, { shopPrices: getShopPrices(), xpForLevel, levelProgress });
  }

  function publicProjection(user, viewerUid) {
    if (!user || isHidden(user.uid) || isTestAdmin(user.uid)) return null;
    const profile = privateProjection(user, viewerUid);
    if (!profile || profile.isTestAdmin) return null;
    const output = { ...profile };
    for (const key of [
      'owned', 'playmates', 'daily', 'dailyTasks', 'dailyFirstWinDate',
      'dailyAICurrencyKey', 'dailyAICurrencyEarned', 'presencePreference',
      'presenceVisibility', 'username', 'authVersion', 'companionCheckinDay',
    ]) delete output[key];
    return output;
  }

  function compareProjection(user) {
    if (!user || user.ephemeral || isHidden(user.uid) || isTestAdmin(user.uid)) return null;
    const mastery = deriveMastery(user.wins);
    const wins = {};
    for (const game of validGames) wins[game] = mastery && mastery.byGame && mastery.byGame[game] ? mastery.byGame[game].wins : 0;
    return {
      uid: user.uid,
      name: user.name,
      avatar: user.avatar,
      frame: user.frame || 0,
      effect: user.effect || 0,
      nameFx: user.nameFx || 0,
      lang: user.lang || 'zh-CN',
      level: Math.max(1, Math.floor(Number(user.level) || 1)),
      total: Math.max(0, Math.floor(Number(user.total) || 0)),
      totalWins: Math.max(0, Math.floor(Number(user.totalWins) || 0)),
      wins,
      mastery: clone(mastery),
      achievementsCount: Array.isArray(user.achievements) ? new Set(user.achievements.map(String)).size : 0,
    };
  }

  function applyUpdate(user, payload) {
    if (!user || !payload || typeof payload !== 'object') return false;
    if (payload.name !== undefined) {
      const name = text(payload.name || '').trim().slice(0, 12);
      if (name) user.name = name;
    }
    if (payload.lang && ['zh-CN', 'en-US', 'uk-UA'].includes(payload.lang)) user.lang = payload.lang;
    if (Number.isInteger(payload.avatar) && validOwnedId('avatars', payload.avatar) && ownsItem(user, 'avatars', payload.avatar)) user.avatar = payload.avatar;
    if (Number.isInteger(payload.background) && validOwnedId('backgrounds', payload.background) && ownsItem(user, 'backgrounds', payload.background)) user.background = payload.background;
    if (Number.isInteger(payload.frame) && validOwnedId('frames', payload.frame) && ownsItem(user, 'frames', payload.frame)) user.frame = payload.frame;
    if (Number.isInteger(payload.effect) && validOwnedId('effects', payload.effect) && ownsItem(user, 'effects', payload.effect)) user.effect = payload.effect;
    if (Number.isInteger(payload.nameFx) && payload.nameFx >= 0 && payload.nameFx <= 4) user.nameFx = payload.nameFx;
    if (payload.gameCosmetics !== undefined) user.gameCosmetics = normalizeGameCosmetics(payload.gameCosmetics, user);
    if (payload.signature !== undefined) user.signature = sanitizePlainText(payload.signature, 80);
    if (payload.countryRegion !== undefined) {
      const region = text(payload.countryRegion || '').trim().toUpperCase();
      if (!region || /^[A-Z]{2}$/.test(region)) user.countryRegion = region;
    }
    if (payload.genderTag !== undefined) {
      const gender = sanitizePlainText(payload.genderTag, 24);
      if (['hidden', 'male', 'female', 'nonbinary'].includes(gender) || /^custom:[^<>]{1,16}$/.test(gender)) user.genderTag = gender;
    }
    if (['joinable', 'online', 'busy', 'invisible'].includes(payload.presencePreference)) user.presencePreference = payload.presencePreference;
    if (['everyone', 'friends', 'nobody'].includes(payload.presenceVisibility)) user.presenceVisibility = payload.presenceVisibility;
    if (payload.showcase === null) user.showcase = null;
    else if (payload.showcase && typeof payload.showcase === 'object') {
      const type = text(payload.showcase.type || '');
      const value = sanitizePlainText(payload.showcase.value, 48);
      const valid = (type === 'game' && validGames.has(value)) ||
        (type === 'achievement' && Array.isArray(user.achievements) && user.achievements.includes(value)) ||
        (type === 'collection' && /^(pixel|anime|landscape|animal|neon|technology)_origins$/.test(value)) ||
        (type === 'record' && ['totalWins', 'bestStreak', 'total', 'level'].includes(value));
      if (valid) user.showcase = { type, value };
    }
    return true;
  }

  function profile(command = {}) {
    const action = text(command.action);
    try {
      if (action === 'private') return result(true, { profile: privateProjection(userForCommand(command), command.viewerUid) });
      if (action === 'public') return result(true, { profile: publicProjection(userForCommand(command), command.viewerUid) });
      if (action === 'read') {
        const targetUid = text(command.targetUid || command.uid);
        const target = adapter.get(targetUid);
        if (!target) return result(true, { profile: null });
        const privateAllowed = targetUid === text(command.viewerUid) &&
          !!session({ action: 'verify_hash', uid: targetUid, tokenHash: command.viewerTokenHash }).ok;
        return result(true, { profile: privateAllowed ? privateProjection(target, command.viewerUid) : publicProjection(target, command.viewerUid), private: privateAllowed });
      }
      if (action === 'compare_projection') return result(true, { profile: compareProjection(userForCommand(command)) });
      if (action === 'can_compare') {
        const viewer = userForCommand(command);
        const target = command.target || adapter.get(command.targetUid);
        const allowed = !!(viewer && target && !viewer.ephemeral && !target.ephemeral &&
          !isHidden(viewer.uid) && !isHidden(target.uid) && viewer.uid !== target.uid && canCompare(viewer, target));
        return result(allowed, { allowed, reason: allowed ? '' : 'profile_compare_forbidden' });
      }
      if (action === 'compare') {
        const viewer = command.viewer || adapter.get(command.viewerUid);
        const target = command.target || adapter.get(command.targetUid);
        const allowed = !!(viewer && target && !viewer.ephemeral && !target.ephemeral &&
          !isHidden(viewer.uid) && !isHidden(target.uid) && viewer.uid !== target.uid && canCompare(viewer, target));
        if (!allowed) return result(false, { reason: 'profile_compare_forbidden', requestId: text(command.requestId), targetUid: text(command.targetUid || target && target.uid) });
        return result(true, { requestId: text(command.requestId), targetUid: text(target.uid), self: compareProjection(viewer), friend: compareProjection(target) });
      }
      if (action === 'update') {
        const user = userForCommand(command);
        if (!user) return result(false, { reason: 'session_expired' });
        applyUpdate(user, command.payload);
        adapter.put(user);
        return result(true, { user, profile: privateProjection(user, command.viewerUid || user.uid) });
      }
      return result(false, { reason: 'unsupported_action' });
    } catch (_error) {
      return result(false, { reason: 'profile_unavailable' });
    }
  }

  return Object.freeze({ session, profile });
}

module.exports = Object.freeze({
  createAuthProfileBoundary,
  createJsonRuntimeAuthProfileAdapter,
  createMemoryAuthProfileAdapter,
});
