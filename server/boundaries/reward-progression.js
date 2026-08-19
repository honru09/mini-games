'use strict';

/*
 * Reward/Progression Projection v1.
 *
 * The Reward Resolver remains the only authority for currency, XP, eligibility
 * and level values. This deep Module only projects an already-resolved reward
 * onto the bounded profile fields and stages the existing audit effects. The
 * commit Adapter owns the runtime mutation; P5 reward-economy remains the
 * outbox/Supabase seam outside this module.
 */

const PROTOCOL = 'reward-progression-v1';
const UID_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const RESULT_ID_RE = /^[A-Za-z0-9._:-]{3,160}$/;
const MAX_RESULTS = 500;
const MAX_DAILY_CLAIMS = 20;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const PROJECTION_KEYS = Object.freeze([
  'uid', 'ephemeral', 'playerCharacter', 'coins', 'xp', 'level', 'xpCurveVersion',
  'streak', 'bestStreak', 'dailyFirstWinDate', 'dailyAICurrencyKey',
  'dailyAICurrencyEarned', 'played', 'total', 'wins', 'totalWins', 'dailyKey',
  'daily', 'dailyTaskKey', 'dailyTasks', 'achievements', 'recentResults',
  '_supabaseLocalRewardCurrency',
]);
const DAILY_TASK_DEFS = Object.freeze([
  Object.freeze({ id: 'play_1', kind: 'play', target: 1, reward: 5 }),
  Object.freeze({ id: 'play_3', kind: 'play', target: 3, reward: 10 }),
  Object.freeze({ id: 'win_1', kind: 'win', target: 1, reward: 8 }),
  Object.freeze({ id: 'streak_2', kind: 'streak', target: 2, reward: 12 }),
]);

function text(value) {
  try { return String(value === undefined || value === null ? '' : value); }
  catch (_) { return ''; }
}

function safeInt(value, fallback = 0) {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : fallback;
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function safeNonNegative(value, fallback = 0) {
  return Math.max(0, safeInt(value, fallback));
}

function safeAt(value, fallback) {
  const parsed = safeInt(value, fallback);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function ownRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    return Object.getOwnPropertyNames(value).every(key => {
      if (FORBIDDEN_KEYS.has(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return !!descriptor && !descriptor.get && !descriptor.set;
    });
  } catch (_) { return false; }
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
    if (!FORBIDDEN_KEYS.has(key)) output[key] = clone(item, seen);
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

function result(ok, fields = {}) {
  const safe = ownRecord(fields) ? clone(fields) : {};
  delete safe.ok;
  return freeze({ ok: !!ok, ...safe });
}

function failure(reason, fields = {}) {
  const stable = /^[a-z][a-z0-9_.:-]{1,95}$/.test(text(reason)) ? text(reason) : 'reward_progression_unavailable';
  return result(false, { reason: stable, ...fields });
}

function projectionPatch(draft) {
  const patch = {};
  for (const key of PROJECTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(draft, key) && draft[key] !== undefined) patch[key] = clone(draft[key]);
  }
  return patch;
}

function applyPatch(user, patch) {
  if (!user || typeof user !== 'object' || !ownRecord(patch)) return false;
  for (const key of PROJECTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) user[key] = clone(patch[key]);
  }
  return true;
}

function createRewardProgressionPolicy(options = {}) {
  const validGames = new Set(Array.isArray(options.validGames) ? options.validGames.map(String) : []);
  const dayKey = typeof options.dayKey === 'function' ? options.dayKey : value => new Date(value).toISOString().slice(0, 10);
  const xpForLevel = typeof options.xpForLevel === 'function' ? options.xpForLevel : () => 0;
  const levelFromXp = typeof options.levelFromXp === 'function' ? options.levelFromXp : () => 1;
  const curveVersion = safeNonNegative(options.curveVersion, 0);
  const normalizePlayerCharacter = typeof options.normalizePlayerCharacter === 'function'
    ? options.normalizePlayerCharacter : value => value;

  function day(at) {
    const timestamp = safeAt(at, Date.now());
    try { return text(dayKey(timestamp)); }
    catch (_) { return new Date(timestamp).toISOString().slice(0, 10); }
  }

  function ensureDailyTasks(user, key) {
    if (!user || typeof user !== 'object') return { play: 0, win: 0, streak: 0, claimed: [], claimIds: {} };
    const current = text(key || day());
    if (user.dailyTaskKey !== current || !ownRecord(user.dailyTasks)) {
      user.dailyTaskKey = current;
      user.dailyTasks = { play: 0, win: 0, streak: 0, claimed: [], claimIds: {} };
    }
    user.dailyTasks.claimed = (Array.isArray(user.dailyTasks.claimed) ? user.dailyTasks.claimed : [])
      .map(value => text(value)).filter(Boolean).slice(-MAX_DAILY_CLAIMS);
    user.dailyTasks.claimIds = ownRecord(user.dailyTasks.claimIds) ? user.dailyTasks.claimIds : {};
    return user.dailyTasks;
  }

  function normalizeUser(user, at) {
    if (!user || typeof user !== 'object') return user;
    try { user.playerCharacter = normalizePlayerCharacter(user.playerCharacter); } catch (_) { user.playerCharacter = null; }
    const oldLevel = Math.max(1, safeNonNegative(user.level, 1));
    user.xp = safeNonNegative(user.xp);
    user.xp = Math.max(user.xp, safeNonNegative(xpForLevel(oldLevel)));
    user.xpCurveVersion = curveVersion;
    user.level = Math.max(1, safeNonNegative(levelFromXp(user.xp), 1));
    user.streak = safeNonNegative(user.streak);
    user.bestStreak = Math.max(user.streak, safeNonNegative(user.bestStreak));
    user.dailyFirstWinDate = text(user.dailyFirstWinDate);
    user.dailyAICurrencyKey = text(user.dailyAICurrencyKey);
    user.dailyAICurrencyEarned = safeNonNegative(user.dailyAICurrencyEarned);
    if (user.dailyAICurrencyKey !== day(at)) {
      user.dailyAICurrencyKey = day(at);
      user.dailyAICurrencyEarned = 0;
    }
    if (!ownRecord(user.wins)) user.wins = {};
    const derivedWins = Object.values(user.wins).reduce((sum, value) => sum + safeNonNegative(value), 0);
    const storedWins = safeNonNegative(user.totalWins);
    user.totalWins = storedWins > 0 ? storedWins : derivedWins;
    if (!ownRecord(user.played)) user.played = {};
    if (!Array.isArray(user.achievements)) user.achievements = [];
    if (!Array.isArray(user.recentResults)) user.recentResults = [];
    return user;
  }

  function addAchievement(user, id) {
    const value = text(id);
    if (!value) return;
    if (!Array.isArray(user.achievements)) user.achievements = [];
    if (!user.achievements.includes(value)) user.achievements.push(value);
  }

  function updateAchievements(user) {
    if (!user || typeof user !== 'object') return user;
    if (safeNonNegative(user.totalWins) >= 1) addAchievement(user, 'first_win');
    if (safeNonNegative(user.totalWins) >= 10) addAchievement(user, 'win_10');
    if (safeNonNegative(user.totalWins) >= 50) addAchievement(user, 'win_50');
    if (safeNonNegative(user.bestStreak) >= 3) addAchievement(user, 'streak_3');
    if (safeNonNegative(user.bestStreak) >= 5) addAchievement(user, 'streak_5');
    if (safeNonNegative(user.level, 1) >= 5) addAchievement(user, 'level_5');
    if (validGames.size && [...validGames].every(game => safeNonNegative(user.played && user.played[game]) > 0)) addAchievement(user, 'all_games');
    if (Object.keys(ownRecord(user.playmates) ? user.playmates : {}).length >= 3) addAchievement(user, 'social');
    return user;
  }

  function updateDaily(user, won, at) {
    if (!user || typeof user !== 'object') return user;
    const key = day(at);
    if (user.dailyKey !== key || !ownRecord(user.daily)) user.dailyKey = key, user.daily = { play: 0, win: 0, streak: 0 };
    user.daily.play = safeNonNegative(user.daily.play) + 1;
    if (won) user.daily.win = safeNonNegative(user.daily.win) + 1;
    user.daily.streak = Math.max(safeNonNegative(user.daily.streak), safeNonNegative(user.streak));
    const tasks = ensureDailyTasks(user, key);
    tasks.play = user.daily.play;
    tasks.win = user.daily.win;
    tasks.streak = user.daily.streak;
    return user;
  }

  function dailyTasksPayload(user, at) {
    const state = ensureDailyTasks(user, day(at));
    return {
      dayKey: user && user.dailyTaskKey || day(at),
      tasks: DAILY_TASK_DEFS.map(task => ({ ...task, progress: Math.min(task.target, safeNonNegative(state[task.kind])), claimed: state.claimed.includes(task.id) })),
    };
  }

  return Object.freeze({
    dailyTaskDefs: DAILY_TASK_DEFS,
    normalizeUser,
    ensureDailyTasks,
    dailyTasksPayload,
    updateDaily,
    updateAchievements,
    addAchievement,
  });
}

function createJsonRuntimeRewardProgressionAdapter(options = {}) {
  if (typeof options.findResult !== 'function' || typeof options.commit !== 'function') throw new TypeError('reward_progression_runtime_adapter_callbacks_required');
  return Object.freeze({
    findResult(command) { return options.findResult(command); },
    commit(plan) { return options.commit(plan); },
  });
}

function createMemoryRewardProgressionAdapter(initial = {}) {
  const state = {
    history: Array.isArray(initial.history) ? initial.history : [],
    rewardHistory: Array.isArray(initial.rewardHistory) ? initial.rewardHistory : [],
    economyLedger: Array.isArray(initial.economyLedger) ? initial.economyLedger : [],
    events: Array.isArray(initial.events) ? initial.events : [],
  };
  const committed = new Map();
  return Object.freeze({
    state,
    findResult({ uid, resultId }) {
      const key = text(uid) + '|' + text(resultId);
      const cached = committed.get(key);
      if (cached) return clone(cached);
      const row = state.rewardHistory.find(item => item && item.uid === uid && item.resultId === resultId);
      return row ? clone(row) : null;
    },
    commit(plan) {
      if (!plan || !plan.user || !ownRecord(plan.profilePatch)) return { ok: false, reason: 'reward_progression_commit_failed' };
      if (!applyPatch(plan.user, plan.profilePatch)) return { ok: false, reason: 'reward_progression_commit_failed' };
      const row = clone(plan.row);
      state.history.push(row);
      state.rewardHistory.push(row);
      if (plan.economy) state.economyLedger.push(clone(plan.economy));
      for (const event of Array.isArray(plan.analytics) ? plan.analytics : []) state.events.push(clone(event));
      committed.set(text(plan.uid) + '|' + text(plan.resultId), row);
      return { ok: true, row };
    },
  });
}

function rewardRowFrom(user, reward, meta) {
  return {
    uid: user.uid,
    game: reward.gameId,
    coins: reward.currency || 0,
    xp: reward.xp || 0,
    at: safeAt(meta.at, Date.now()),
    resultId: meta.resultId || null,
    matchId: meta.matchId || null,
    mode: reward.mode,
    result: reward.result,
    placement: reward.placement,
    opponentIds: Array.isArray(meta.opponentIds) ? meta.opponentIds.map(String).slice(0, 32) : [],
    opponentKey: text(meta.opponentKey).slice(0, 160),
    durationMs: safeNonNegative(meta.durationMs),
    meaningfulActions: safeNonNegative(meta.meaningfulActions),
    eligible: reward.eligible === true,
    blockedReason: reward.blockedReason || null,
    baseCurrency: safeNonNegative(reward.baseCurrency),
    baseXp: safeNonNegative(reward.baseXp),
    rewardReasons: Array.isArray(reward.rewardReasons) ? reward.rewardReasons.map(String).slice(0, 32) : [],
    levelBefore: Math.max(1, safeNonNegative(reward.levelBefore, 1)),
    levelAfter: Math.max(1, safeNonNegative(reward.levelAfter, 1)),
    streakBefore: safeNonNegative(reward.streakBefore),
    streakAfter: safeNonNegative(reward.streakAfter),
    breakdown: Array.isArray(reward.breakdown) ? clone(reward.breakdown).slice(0, 32) : [],
    reward: clone(reward),
    ephemeral: !!user.ephemeral,
  };
}

function createRewardProgression(options = {}) {
  if (!options.policy || typeof options.policy.normalizeUser !== 'function') throw new TypeError('reward_progression_policy_required');
  if (!options.adapter || typeof options.adapter.commit !== 'function' || typeof options.adapter.findResult !== 'function') throw new TypeError('reward_progression_adapter_required');
  const policy = options.policy;
  const adapter = options.adapter;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const isTestAdmin = typeof options.isTestAdmin === 'function' ? options.isTestAdmin : () => false;
  const sandboxReward = typeof options.sandboxReward === 'function' ? options.sandboxReward : null;
  const applyLocalRewardCurrency = typeof options.applyLocalRewardCurrency === 'function' ? options.applyLocalRewardCurrency : null;
  let disposed = false;

  function timestamp(value) {
    let fallback;
    try { fallback = safeAt(now(), Date.now()); } catch (_) { fallback = Date.now(); }
    return safeAt(value, fallback);
  }

  function apply(input = {}) {
    if (disposed) return failure('reward_progression_disposed');
    if (!ownRecord(input) || !ownRecord(input.user)) return failure('reward_progression_invalid_user');
    const user = input.user;
    const reward = input.reward;
    const meta = ownRecord(input.meta) ? input.meta : {};
    const uid = text(user.uid).trim();
    const resultId = text(meta.resultId).trim();
    if (!UID_RE.test(uid)) return failure('reward_progression_invalid_user');
    const at = timestamp(meta.at);
    if (!RESULT_ID_RE.test(resultId)) return failure('reward_progression_invalid_meta');

    if (isTestAdmin(uid) === true) {
      if (!sandboxReward) return failure('reward_progression_unavailable');
      const virtual = sandboxReward({
        gameId: reward && reward.gameId, mode: reward && reward.mode, result: reward && reward.result,
        placement: reward && reward.placement, participantCount: reward && reward.participantCount,
        level: user.level, xp: user.xp,
      });
      const row = rewardRowFrom(user, virtual, { ...meta, at, resultId });
      return result(true, { status: 'virtual', uid, resultId, row, reward: virtual });
    }
    if (!ownRecord(reward)) return failure('reward_progression_invalid_reward');
    const gameId = text(reward.gameId).trim();
    const mode = text(reward.mode).trim();
    const outcome = text(reward.result).trim();
    if (!gameId || !mode || !['win', 'draw', 'loss'].includes(outcome) || typeof reward.eligible !== 'boolean') return failure('reward_progression_invalid_reward');
    for (const key of ['currency', 'xp', 'levelBefore', 'levelAfter', 'xpBefore', 'xpAfter', 'streakBefore', 'streakAfter', 'bestStreakAfter']) {
      if (!Number.isSafeInteger(reward[key])) return failure('reward_progression_invalid_reward');
    }
    let existing = null;
    try { existing = adapter.findResult({ uid, resultId }); } catch (_) { return failure('reward_progression_unavailable'); }
    if (existing) {
      const sameReward = !existing.reward || JSON.stringify(existing.reward) === JSON.stringify(reward);
      const sameContext = Number(existing.at) === at && text(existing.matchId) === text(meta.matchId) && text(existing.mode) === mode;
      if (!sameReward || !sameContext) return failure('reward_progression_idempotency_conflict', { uid, resultId });
      return result(true, { status: 'duplicate', uid, resultId, row: existing });
    }
    if (Array.isArray(user.recentResults) && user.recentResults.map(String).includes(resultId)) return result(true, { status: 'duplicate', uid, resultId, row: null });

    const draft = {};
    for (const key of PROJECTION_KEYS) draft[key] = clone(user[key]);
    policy.normalizeUser(draft, at);
    if (reward.eligible === true) {
      draft.coins = safeNonNegative(draft.coins) + safeNonNegative(reward.currency);
      if (Number.isSafeInteger(reward.xpAfter)) draft.xp = reward.xpAfter;
      draft.level = Math.max(1, reward.levelAfter);
      draft.streak = safeNonNegative(reward.streakAfter);
      draft.bestStreak = Math.max(draft.streak, safeNonNegative(reward.bestStreakAfter));
      draft.dailyFirstWinDate = text(reward.dailyFirstWinDateAfter);
      draft.dailyAICurrencyKey = text(reward.dailyAICurrencyKeyAfter);
      draft.dailyAICurrencyEarned = safeNonNegative(reward.dailyAICurrencyEarnedAfter);
      draft.xpCurveVersion = safeNonNegative(options.curveVersion, draft.xpCurveVersion);
      if (applyLocalRewardCurrency) {
        try { applyLocalRewardCurrency(draft, reward); } catch (_) { return failure('reward_progression_invalid_reward'); }
      }
      draft.played[gameId] = safeNonNegative(draft.played[gameId]) + 1;
      draft.total = safeNonNegative(draft.total) + 1;
      if (outcome === 'win') {
        draft.wins[gameId] = safeNonNegative(draft.wins[gameId]) + 1;
        draft.totalWins = safeNonNegative(draft.totalWins) + 1;
      }
      policy.updateDaily(draft, outcome === 'win', at);
      policy.updateAchievements(draft);
    } else if (text(reward.blockedReason) === 'afk') {
      draft.streak = safeNonNegative(reward.streakAfter);
    }
    draft.recentResults = (Array.isArray(draft.recentResults) ? draft.recentResults.map(String) : []);
    draft.recentResults = draft.recentResults.includes(resultId) ? draft.recentResults : draft.recentResults.concat(resultId).slice(-MAX_RESULTS);
    const row = rewardRowFrom(draft, reward, { ...meta, at, resultId });
    const common = { uid, matchId: meta.matchId || null, game: gameId, mode, at, metadata: { resultId, currency: reward.currency, xp: reward.xp, reason: reward.blockedReason || null } };
    const analytics = [{ event: reward.eligible === true ? 'reward_granted' : 'reward_blocked', ...common }];
    if (reward.repeatTier === 'reduced' || reward.repeatTier === 'exhausted' || (Array.isArray(reward.breakdown) && reward.breakdown.some(item => item && item.code === 'ai_daily_cap'))){
      analytics.push({ event: 'reward_reduced', ...common, metadata: { resultId, repeatTier: reward.repeatTier || 'none' } });
    }
    if (reward.dailyFirstWinGranted) analytics.push({ event: 'daily_first_win', ...common, metadata: { resultId } });
    if (reward.levelAfter > reward.levelBefore) analytics.push({ event: 'level_up', ...common, metadata: { resultId, from: reward.levelBefore, to: reward.levelAfter } });
    const economy = reward.currency ? { uid, kind: 'match_reward', amount: safeInt(reward.currency), balanceAfter: draft.coins, refId: resultId, metadata: { game: gameId, mode, matchId: meta.matchId || null, result: outcome, rewardReasons: reward.rewardReasons || [] }, at, ephemeral: !!user.ephemeral } : null;
    let committed;
    try { committed = adapter.commit({ uid, resultId, user, profilePatch: projectionPatch(draft), row, reward: clone(reward), analytics, economy, at }); }
    catch (_) { return failure('reward_progression_commit_failed'); }
    if (!committed || committed.ok !== true) return failure(committed && committed.reason || 'reward_progression_commit_failed');
    const committedRow = committed.row || row;
    return result(true, { status: 'applied', uid, resultId, row: committedRow, reward: clone(reward) });
  }

  function dispose() { disposed = true; return true; }
  return Object.freeze({ apply, dispose });
}

module.exports = {
  PROTOCOL,
  PROJECTION_KEYS,
  DAILY_TASK_DEFS,
  applyPatch,
  createRewardProgressionPolicy,
  createRewardProgression,
  createJsonRuntimeRewardProgressionAdapter,
  createMemoryRewardProgressionAdapter,
};
