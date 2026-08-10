'use strict';

// Test-admin policy is intentionally a small, server-only authority module.
// It owns neither sockets nor persistence: callers must explicitly wire the
// narrow seams they consume. Keeping the secret in a closure avoids accidental
// serialization into profiles, logs, test evidence, or configuration status.
const {
  normalizeUsername,
  validateUsername,
  validatePassword,
  hashPassword,
  verifyPassword,
} = require('./auth-credentials');

const TEST_ADMIN_REASON = 'test_admin_config_invalid';
const TEST_ADMIN_UID_PATTERN = /^u_[A-Za-z0-9_-]{6,64}$/;
const TEST_ADMIN_LEVEL = 9999;
const TEST_ADMIN_COINS = Number.MAX_SAFE_INTEGER;

const TEST_ADMIN_CAPABILITIES = Object.freeze([
  'test_admin_profile',
  'test_admin_unlimited_currency',
  'test_admin_all_catalog_items',
  'test_admin_sandbox_match',
  'tournament_recover',
  'tournament_create',
]);
const CAPABILITY_SET = new Set(TEST_ADMIN_CAPABILITIES);

function text(value){ return String(value === undefined || value === null ? '' : value); }
function uid(value){ return text(value).trim(); }
function isValidTestAdminUid(value){ return TEST_ADMIN_UID_PATTERN.test(uid(value)); }
function safeIntegerIds(values){
  return [...new Set((Array.isArray(values) ? values : [])
    .map(Number)
    .filter(value => Number.isSafeInteger(value) && value >= 0))].sort((a, b) => a - b);
}
function ownObject(value){ return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

function configurationFrom(env = process.env){
  const source = env && typeof env === 'object' ? env : {};
  const requested = text(source.TEST_ADMIN_ENABLED) === '1';
  if (!requested) return Object.freeze({ enabled:false, fatal:false, reason:'disabled', uid:'', username:'', usernameKey:'' });

  const configuredUid = uid(source.TEST_ADMIN_UID);
  const configuredUsername = text(source.TEST_ADMIN_USERNAME);
  const configuredPassword = text(source.TEST_ADMIN_PASSWORD);
  const username = validateUsername(configuredUsername);
  const password = validatePassword(configuredPassword);
  if (!isValidTestAdminUid(configuredUid) || !username.valid || !password.valid){
    // Do not put source values in this object: callers may log configuration
    // status during startup and should never leak an operator password.
    return Object.freeze({ enabled:false, fatal:true, reason:TEST_ADMIN_REASON, uid:'', username:'', usernameKey:'' });
  }
  return Object.freeze({
    enabled:true,
    fatal:false,
    reason:'enabled',
    uid:configuredUid,
    username:configuredUsername,
    usernameKey:username.normalized,
  });
}

function allOwnedFromCatalog(owned, shopPrices){
  const out = {};
  for (const [category, values] of Object.entries(ownObject(owned))) out[category] = safeIntegerIds(values);
  for (const [category, catalog] of Object.entries(ownObject(shopPrices))){
    const merged = new Set(out[category] || []);
    for (const key of Object.keys(ownObject(catalog))){
      const id = Number(key);
      if (Number.isSafeInteger(id) && id >= 0) merged.add(id);
    }
    out[category] = [...merged].sort((a, b) => a - b);
  }
  return out;
}

function sandboxReward(input = {}){
  const level = Math.max(1, Math.floor(Number(input.level) || TEST_ADMIN_LEVEL));
  const xp = Math.max(0, Math.floor(Number(input.xp) || 0));
  const result = ['win','draw','loss'].includes(String(input.result)) ? String(input.result) : 'draw';
  return Object.freeze({
    version:'test-admin-sandbox-v1',
    gameId:text(input.gameId),
    mode:text(input.mode || 'ai'),
    result,
    placement:Math.max(1, Math.floor(Number(input.placement) || (result === 'win' ? 1 : 2))),
    participantCount:Math.max(1, Math.floor(Number(input.participantCount) || 1)),
    eligible:false,
    blockedReason:'test_admin_sandbox',
    currency:0,
    xp:0,
    baseCurrency:0,
    baseXp:0,
    levelBefore:level,
    levelAfter:level,
    xpBefore:xp,
    xpAfter:xp,
    streakBefore:0,
    streakAfter:0,
    bestStreakAfter:0,
    dailyFirstWinGranted:false,
    dailyFirstWinDateAfter:'',
    dailyAICurrencyKeyAfter:'',
    dailyAICurrencyEarnedAfter:0,
    repeatTier:'none',
    breakdown:[Object.freeze({ code:'test_admin_sandbox', currency:0, xp:0 })],
    rewardReasons:['test_admin_sandbox'],
  });
}

function createTestAdminPolicy(env = process.env){
  const config = configurationFrom(env);
  // Keep the raw password exclusively in the closure. It is never returned by
  // status(), virtualProfile(), bootstrap() results, or a thrown message.
  const configuredPassword = config.enabled ? text(env && env.TEST_ADMIN_PASSWORD) : '';
  const enabled = config.enabled === true;

  function isTestAdminUid(value){ return enabled && uid(value) === config.uid; }
  function hasCapability(value, capability){ return isTestAdminUid(value) && CAPABILITY_SET.has(text(capability)); }
  function shouldHidePublicUid(value){ return isTestAdminUid(value); }
  function socialAccess(aUid, bUid){
    return (isTestAdminUid(aUid) || isTestAdminUid(bUid))
      ? Object.freeze({ ok:false, reason:'test_admin_isolated' })
      : Object.freeze({ ok:true });
  }
  function roomAccess(request = {}){
    const actorUid = uid(request.actorUid);
    const participants = [...new Set((Array.isArray(request.participantUids) ? request.participantUids : []).map(uid).filter(Boolean))];
    const actorIsTest = isTestAdminUid(actorUid);
    const roomContainsTest = participants.some(isTestAdminUid);
    const normalParticipants = participants.filter(value => !isTestAdminUid(value));
    const roomTestOnly = request.roomTestOnly === true || roomContainsTest;
    if (request.spectator === true && (actorIsTest || roomTestOnly)) return Object.freeze({ ok:false, reason:'test_admin_isolated' });
    if (actorIsTest){
      if (normalParticipants.length) return Object.freeze({ ok:false, reason:'test_admin_isolated' });
      return Object.freeze({ ok:true, testOnly:true, visibility:'private', allowSpectators:false });
    }
    if (roomTestOnly) return Object.freeze({ ok:false, reason:'test_admin_isolated' });
    return Object.freeze({ ok:true, testOnly:false });
  }
  function tournamentCreateAccess(ownerUid, participantUids){
    if (!hasCapability(ownerUid, 'tournament_create')) return Object.freeze({ ok:false, reason:'admin_only' });
    const participants = [...new Set((Array.isArray(participantUids) ? participantUids : []).map(uid).filter(Boolean))];
    if (participants.length < 3 || participants.some(isTestAdminUid)) return Object.freeze({ ok:false, reason:'test_admin_participant_forbidden' });
    return Object.freeze({ ok:true, externalOwner:true, participantUids:participants });
  }
  function virtualProfile(profile, options = {}){
    const source = ownObject(profile);
    if (!isTestAdminUid(source.uid)) return profile;
    const level = Math.max(1, Math.floor(Number(options.level) || TEST_ADMIN_LEVEL));
    const xpForLevel = typeof options.xpForLevel === 'function' ? options.xpForLevel : null;
    const xp = Math.max(0, Math.floor(Number(xpForLevel ? xpForLevel(level) : source.xp) || 0));
    const out = {
      ...source,
      coins:TEST_ADMIN_COINS,
      level,
      xp,
      isTestAdmin:true,
      testRole:'test_admin',
      currencyMode:'unlimited',
      progressionMode:'max',
      owned:allOwnedFromCatalog(source.owned, options.shopPrices),
      testAdmin:Object.freeze({
        sandbox:true,
        virtualAssets:true,
        capabilities:TEST_ADMIN_CAPABILITIES.slice(),
      }),
    };
    if (typeof options.levelProgress === 'function') out.xpProgress = options.levelProgress(xp);
    return out;
  }
  async function bootstrap(options = {}){
    if (!enabled) return Object.freeze({ ok:true, active:false, created:false, passwordUpdated:false, reason:'disabled' });
    const users = ownObject(options.users);
    const createStarterUser = typeof options.createStarterUser === 'function' ? options.createStarterUser : null;
    if (!createStarterUser) return Object.freeze({ ok:false, reason:'bootstrap_unavailable' });
    const allUsers = Object.values(users).filter(value => value && typeof value === 'object');
    const sameUsername = allUsers.find(user => !user.ephemeral && normalizeUsername(user.username) === config.usernameKey) || null;
    let user = users[config.uid] || null;
    if (sameUsername && sameUsername.uid !== config.uid) return Object.freeze({ ok:false, reason:'username_conflict' });
    if (user && (user.ephemeral || normalizeUsername(user.username) !== config.usernameKey)) return Object.freeze({ ok:false, reason:'identity_conflict' });
    let created = false;
    let passwordUpdated = false;
    if (!user){
      user = createStarterUser(config.uid, config.username);
      if (!user || typeof user !== 'object') return Object.freeze({ ok:false, reason:'bootstrap_create_failed' });
      user.uid = config.uid;
      user.username = config.username;
      user.usernameKey = config.usernameKey;
      user.authVersion = 'username-password-v1';
      user.ephemeral = false;
      user.passwordHash = await hashPassword(configuredPassword);
      users[config.uid] = user;
      created = true;
    } else {
      const matches = await verifyPassword(configuredPassword, user.passwordHash);
      if (!matches){
        user.passwordHash = await hashPassword(configuredPassword);
        user.authVersion = 'username-password-v1';
        passwordUpdated = true;
      }
    }
    if ((created || passwordUpdated) && typeof options.persist === 'function'){
      try { await options.persist(user, Object.freeze({ created, passwordUpdated })); }
      catch { return Object.freeze({ ok:false, reason:'bootstrap_persist_failed' }); }
    }
    return Object.freeze({ ok:true, active:true, created, passwordUpdated, uid:config.uid });
  }

  return Object.freeze({
    enabled,
    fatal:config.fatal === true,
    reason:config.reason,
    uid:config.uid,
    username:config.username,
    usernameKey:config.usernameKey,
    status:() => Object.freeze({ enabled, fatal:config.fatal === true, reason:config.reason, uid:config.uid, username:config.username, usernameKey:config.usernameKey }),
    isTestAdminUid,
    hasCapability,
    shouldHidePublicUid,
    socialAccess,
    roomAccess,
    tournamentCreateAccess,
    virtualProfile,
    sandboxReward,
    allOwnedFromCatalog,
    bootstrap,
  });
}

module.exports = Object.freeze({
  TEST_ADMIN_REASON,
  TEST_ADMIN_LEVEL,
  TEST_ADMIN_COINS,
  TEST_ADMIN_CAPABILITIES,
  isValidTestAdminUid,
  configurationFrom,
  allOwnedFromCatalog,
  sandboxReward,
  createTestAdminPolicy,
});
