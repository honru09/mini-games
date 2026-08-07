'use strict';

const VALID_GAMES = Object.freeze(['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi']);

const REWARD_CONFIG = Object.freeze({
  version: '1.0',
  online1v1: Object.freeze({
    win: Object.freeze({ currency: 3, xp: 12 }),
    draw: Object.freeze({ currency: 2, xp: 10 }),
    loss: Object.freeze({ currency: 1, xp: 8 }),
  }),
  multiplayer: Object.freeze({
    first: Object.freeze({ currency: 4, xp: 14 }),
    second: Object.freeze({ currency: 3, xp: 12 }),
    third: Object.freeze({ currency: 2, xp: 10 }),
    other: Object.freeze({ currency: 1, xp: 8 }),
  }),
  ai: Object.freeze({
    win: Object.freeze({ currency: 1, xp: 8 }),
    draw: Object.freeze({ currency: 0, xp: 6 }),
    loss: Object.freeze({ currency: 0, xp: 5 }),
    dailyCurrencyCap: 3,
  }),
  local: Object.freeze({ currency: 0, xp: 0 }),
  dailyFirstWin: Object.freeze({ currency: 2, xp: 5 }),
  streakXp: Object.freeze({ three: 2, five: 4, eightPlus: 6 }),
  repeatOpponent: Object.freeze({
    fullRewardMatches: 10,
    reducedRewardMatches: 20,
    reducedCurrencyMultiplier: 0.5,
    exhaustedCurrencyMultiplier: 0,
    exhaustedXpMultiplier: 0.5,
    windowMs: 24 * 60 * 60 * 1000,
  }),
  level: Object.freeze({
    maxXpPerLevel: 200,
    baseXp: 30,
    xpStep: 5,
    currencyEveryLevels: 5,
    currencyReward: 5,
    curveVersion: 1,
  }),
  games: Object.freeze({
    gomoku: Object.freeze({ weight: 1, online: Object.freeze({ minDurationMs: 15000, minActions: 9, minUniqueActions: 8, minPlayerActions: 4 }), ai: Object.freeze({ minDurationMs: 12000, minActions: 4, minUniqueActions: 4 }) }),
    ludo: Object.freeze({ weight: 1, online: Object.freeze({ minDurationMs: 20000, minActions: 10, minUniqueActions: 4, minPlayerActions: 2 }), ai: Object.freeze({ minDurationMs: 15000, minActions: 4, minUniqueActions: 3 }) }),
    monopoly: Object.freeze({ weight: 1, online: Object.freeze({ minDurationMs: 25000, minActions: 8, minUniqueActions: 4, minPlayerActions: 2 }), ai: Object.freeze({ minDurationMs: 18000, minActions: 4, minUniqueActions: 3 }) }),
    tank: Object.freeze({ weight: 1, online: Object.freeze({ minDurationMs: 12000, minActions: 6, minUniqueActions: 3, minPlayerActions: 2 }), ai: Object.freeze({ minDurationMs: 10000, minActions: 3, minUniqueActions: 2 }) }),
    tetris: Object.freeze({ weight: 1, online: Object.freeze({ minDurationMs: 18000, minActions: 8, minUniqueActions: 6, minPlayerActions: 2 }), ai: Object.freeze({ minDurationMs: 12000, minActions: 4, minUniqueActions: 3 }) }),
    xiangqi: Object.freeze({ weight: 1, online: Object.freeze({ minDurationMs: 18000, minActions: 6, minUniqueActions: 6, minPlayerActions: 3 }), ai: Object.freeze({ minDurationMs: 15000, minActions: 3, minUniqueActions: 3 }) }),
  }),
});

function nonNegativeInteger(value){
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function dayKey(now){
  const date = new Date(now === undefined ? Date.now() : now);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function xpRequiredForNextLevel(level){
  const current = Math.max(1, nonNegativeInteger(level) || 1);
  return Math.min(REWARD_CONFIG.level.maxXpPerLevel, REWARD_CONFIG.level.baseXp + REWARD_CONFIG.level.xpStep * current);
}

function xpForLevel(level){
  const target = Math.max(1, nonNegativeInteger(level) || 1);
  const steps = target - 1;
  const uncappedSteps = Math.min(steps, 33); // Lv34 起每级固定需要 200 XP。
  const uncapped = uncappedSteps * REWARD_CONFIG.level.baseXp +
    REWARD_CONFIG.level.xpStep * uncappedSteps * (uncappedSteps + 1) / 2;
  return uncapped + Math.max(0, steps - uncappedSteps) * REWARD_CONFIG.level.maxXpPerLevel;
}

function levelFromXp(value){
  const xp = Math.min(Number.MAX_SAFE_INTEGER, nonNegativeInteger(value));
  let low = 1;
  let high = Math.max(2, Math.floor(xp / 35) + 2);
  while (low < high){
    const mid = Math.ceil((low + high) / 2);
    if (xpForLevel(mid) <= xp) low = mid;
    else high = mid - 1;
  }
  return low;
}

function levelProgress(xp){
  const total = nonNegativeInteger(xp);
  const level = levelFromXp(total);
  const floor = xpForLevel(level);
  const required = xpRequiredForNextLevel(level);
  return { level, current: Math.max(0, total - floor), required, total };
}

function eligibilityThreshold(gameId, mode, overrides){
  const game = REWARD_CONFIG.games[gameId];
  if (!game) return null;
  const source = game[mode === 'ai' ? 'ai' : 'online'];
  if (!source) return null;
  const out = { ...source };
  if (overrides && typeof overrides === 'object'){
    for (const key of ['minDurationMs', 'minActions', 'minUniqueActions', 'minPlayerActions']){
      if (Number.isFinite(Number(overrides[key])) && Number(overrides[key]) >= 0) out[key] = Math.floor(Number(overrides[key]));
    }
  }
  return out;
}

function evaluateEligibility(input){
  const mode = String(input && input.mode || '');
  const gameId = String(input && input.gameId || '');
  if (!VALID_GAMES.includes(gameId)) return { eligible: false, blockedReason: 'invalid_game' };
  if (mode === 'local') return { eligible: false, blockedReason: 'local_mode' };
  if (mode !== 'online' && mode !== 'ai') return { eligible: false, blockedReason: 'invalid_mode' };
  if (!input || !input.resultId) return { eligible: false, blockedReason: 'missing_result_id' };
  if (mode === 'online' && !input.matchId) return { eligible: false, blockedReason: 'missing_match_id' };
  if (input.identitiesValid === false) return { eligible: false, blockedReason: 'invalid_identity' };
  if (input.consensusValid === false) return { eligible: false, blockedReason: 'result_disputed' };
  if (input.duplicate === true) return { eligible: false, blockedReason: 'duplicate_result' };
  if (input.afk === true) return { eligible: false, blockedReason: 'afk' };
  const threshold = eligibilityThreshold(gameId, mode, input.thresholdOverrides);
  if (!threshold) return { eligible: false, blockedReason: 'missing_eligibility_config' };
  const durationMs = nonNegativeInteger(input.durationMs);
  const meaningfulActions = nonNegativeInteger(input.meaningfulActions);
  const uniqueActions = nonNegativeInteger(input.uniqueActions);
  if (durationMs < threshold.minDurationMs) return { eligible: false, blockedReason: 'match_too_short', threshold };
  if (meaningfulActions < threshold.minActions) return { eligible: false, blockedReason: 'insufficient_actions', threshold };
  if (uniqueActions < threshold.minUniqueActions) return { eligible: false, blockedReason: 'insufficient_progress', threshold };
  if (mode === 'online' && nonNegativeInteger(input.distinctActors) < 2) return { eligible: false, blockedReason: 'insufficient_participants', threshold };
  return { eligible: true, blockedReason: null, threshold };
}

function normalizeRoomResults(value, size){
  if (!Array.isArray(value) || !Number.isInteger(size) || size < 2 || value.length !== size) return null;
  const bySlot = new Map();
  for (const item of value){
    const slot = Number(item && item.slot);
    const rank = Number(item && item.rank);
    if (!Number.isInteger(slot) || slot < 0 || slot >= size || bySlot.has(slot) ||
        !Number.isInteger(rank) || rank < 1 || rank > size) return null;
    bySlot.set(slot, { slot, coins: item && item.coins === 1 ? 1 : 0, rank });
  }
  const out = [...bySlot.values()].sort((a, b) => a.slot - b.slot);
  const winners = out.filter(item => item.coins === 1);
  if (size === 2){
    const draw = winners.length === 0 && out[0].rank === 1 && out[1].rank === 1;
    if (draw) return out;
    if (winners.length !== 1 || winners[0].rank !== 1 || out.find(item => item !== winners[0]).rank !== 2) return null;
    return out;
  }
  const ranks = out.map(item => item.rank).sort((a, b) => a - b);
  if (winners.length !== 1 || winners[0].rank !== 1 || ranks.some((rank, index) => rank !== index + 1)) return null;
  return out;
}

function baseReward(mode, participantCount, result, placement){
  if (mode === 'local') return REWARD_CONFIG.local;
  if (mode === 'ai') return REWARD_CONFIG.ai[result] || null;
  if (mode !== 'online') return null;
  if (nonNegativeInteger(participantCount) <= 2) return REWARD_CONFIG.online1v1[result] || null;
  const rank = Math.max(1, nonNegativeInteger(placement) || 1);
  if (rank === 1) return REWARD_CONFIG.multiplayer.first;
  if (rank === 2) return REWARD_CONFIG.multiplayer.second;
  if (rank === 3) return REWARD_CONFIG.multiplayer.third;
  return REWARD_CONFIG.multiplayer.other;
}

function streakBonus(streak){
  const value = nonNegativeInteger(streak);
  if (value >= 8) return REWARD_CONFIG.streakXp.eightPlus;
  if (value === 5) return REWARD_CONFIG.streakXp.five;
  if (value === 3) return REWARD_CONFIG.streakXp.three;
  return 0;
}

function repeatMultipliers(previousMatches){
  const count = nonNegativeInteger(previousMatches);
  if (count >= REWARD_CONFIG.repeatOpponent.reducedRewardMatches){
    return {
      currency: REWARD_CONFIG.repeatOpponent.exhaustedCurrencyMultiplier,
      xp: REWARD_CONFIG.repeatOpponent.exhaustedXpMultiplier,
      tier: 'exhausted',
    };
  }
  if (count >= REWARD_CONFIG.repeatOpponent.fullRewardMatches){
    return {
      currency: REWARD_CONFIG.repeatOpponent.reducedCurrencyMultiplier,
      xp: 1,
      tier: 'reduced',
    };
  }
  return { currency: 1, xp: 1, tier: 'full' };
}

function resolveMatchReward(input, profile){
  const data = input && typeof input === 'object' ? input : {};
  const user = profile && typeof profile === 'object' ? profile : {};
  const mode = String(data.mode || '');
  const gameId = String(data.gameId || '');
  const result = ['win', 'draw', 'loss'].includes(data.result) ? data.result : 'loss';
  const placement = Math.max(1, nonNegativeInteger(data.placement) || (result === 'win' ? 1 : 2));
  const participantCount = Math.max(1, nonNegativeInteger(data.participantCount) || 1);
  const now = Number.isFinite(Number(data.now)) ? Number(data.now) : Date.now();
  const today = dayKey(now);
  const levelBefore = Math.max(1, nonNegativeInteger(user.level) || levelFromXp(user.xp || 0));
  const xpBefore = nonNegativeInteger(user.xp);
  const streakBefore = nonNegativeInteger(user.streak);
  const bestStreakBefore = nonNegativeInteger(user.bestStreak);
  const eligibility = data.eligibility && typeof data.eligibility === 'object'
    ? { eligible: data.eligibility.eligible === true, blockedReason: data.eligibility.blockedReason || null }
    : { eligible: data.eligible === true, blockedReason: data.blockedReason || null };
  const breakdown = [];

  if (!eligibility.eligible || mode === 'local'){
    const blockedReason = eligibility.blockedReason || (mode === 'local' ? 'local_mode' : 'ineligible_match');
    const streakAfter = blockedReason === 'afk' ? 0 : streakBefore;
    return {
      version: REWARD_CONFIG.version,
      gameId,
      mode,
      result,
      placement,
      participantCount,
      eligible: false,
      blockedReason,
      currency: 0,
      xp: 0,
      levelBefore,
      levelAfter: levelBefore,
      xpBefore,
      xpAfter: xpBefore,
      streakBefore,
      streakAfter,
      bestStreakAfter: bestStreakBefore,
      dailyFirstWinGranted: false,
      dailyFirstWinDateAfter: String(user.dailyFirstWinDate || ''),
      dailyAICurrencyKeyAfter: String(user.dailyAICurrencyKey || today),
      dailyAICurrencyEarnedAfter: user.dailyAICurrencyKey === today ? nonNegativeInteger(user.dailyAICurrencyEarned) : 0,
      repeatTier: 'none',
      breakdown: [{ code: 'reward_blocked', currency: 0, xp: 0, reason: blockedReason }],
      rewardReasons: ['reward_blocked'],
    };
  }

  const base = baseReward(mode, participantCount, result, placement);
  if (!base){
    return resolveMatchReward({ ...data, eligibility: { eligible: false, blockedReason: 'invalid_reward_context' } }, user);
  }
  const weight = Number(REWARD_CONFIG.games[gameId] && REWARD_CONFIG.games[gameId].weight) || 1;
  let baseCurrency = Math.max(0, Math.floor(nonNegativeInteger(base.currency) * weight));
  let baseXp = Math.max(0, Math.round(nonNegativeInteger(base.xp) * weight));
  breakdown.push({ code: 'base_reward', currency: baseCurrency, xp: baseXp });

  let currency = baseCurrency;
  let xp = baseXp;
  let repeatTier = 'none';
  if (mode === 'online'){
    const repeat = repeatMultipliers(data.repeatCount24h);
    repeatTier = repeat.tier;
    const reducedCurrency = Math.floor(baseCurrency * repeat.currency);
    const reducedXp = Math.floor(baseXp * repeat.xp);
    if (reducedCurrency !== baseCurrency || reducedXp !== baseXp){
      breakdown.push({ code: 'repeat_opponent_decay', currency: reducedCurrency - baseCurrency, xp: reducedXp - baseXp, tier: repeat.tier });
      currency = reducedCurrency;
      xp = reducedXp;
    }
  }

  let dailyFirstWinGranted = false;
  let dailyFirstWinDateAfter = String(user.dailyFirstWinDate || '');
  if (mode === 'online' && result === 'win' && dailyFirstWinDateAfter !== today){
    dailyFirstWinGranted = true;
    dailyFirstWinDateAfter = today;
    currency += REWARD_CONFIG.dailyFirstWin.currency;
    xp += REWARD_CONFIG.dailyFirstWin.xp;
    breakdown.push({ code: 'daily_first_win', currency: REWARD_CONFIG.dailyFirstWin.currency, xp: REWARD_CONFIG.dailyFirstWin.xp });
  }

  let streakAfter = streakBefore;
  let bestStreakAfter = bestStreakBefore;
  if (mode === 'online'){
    streakAfter = result === 'win' ? streakBefore + 1 : 0;
    bestStreakAfter = Math.max(bestStreakBefore, streakAfter);
    const bonusXp = result === 'win' ? streakBonus(streakAfter) : 0;
    if (bonusXp){
      xp += bonusXp;
      breakdown.push({ code: 'win_streak', currency: 0, xp: bonusXp, streak: streakAfter });
    }
  }

  let dailyAICurrencyKeyAfter = String(user.dailyAICurrencyKey || '');
  let dailyAICurrencyEarnedAfter = nonNegativeInteger(user.dailyAICurrencyEarned);
  if (dailyAICurrencyKeyAfter !== today){
    dailyAICurrencyKeyAfter = today;
    dailyAICurrencyEarnedAfter = 0;
  }
  const xpAfter = xpBefore + xp;
  const levelAfter = levelFromXp(xpAfter);
  const crossedMilestones = Math.max(0,
    Math.floor(levelAfter / REWARD_CONFIG.level.currencyEveryLevels) -
    Math.floor(levelBefore / REWARD_CONFIG.level.currencyEveryLevels));
  const levelCurrency = crossedMilestones * REWARD_CONFIG.level.currencyReward;
  if (levelCurrency){
    currency += levelCurrency;
    breakdown.push({ code: 'level_milestone', currency: levelCurrency, xp: 0, levels: crossedMilestones });
  }

  // AI 每日上限是最终经济闸门，连等级里程碑现金也不能绕过 💵3 上限；XP 不受影响。
  if (mode === 'ai'){
    const available = Math.max(0, REWARD_CONFIG.ai.dailyCurrencyCap - dailyAICurrencyEarnedAfter);
    const cappedCurrency = Math.min(currency, available);
    if (cappedCurrency !== currency){
      breakdown.push({ code: 'ai_daily_cap', currency: cappedCurrency - currency, xp: 0, cap: REWARD_CONFIG.ai.dailyCurrencyCap });
      currency = cappedCurrency;
    }
    dailyAICurrencyEarnedAfter += currency;
  }

  const rewardReasons = breakdown.map(item => item.code);
  return {
    version: REWARD_CONFIG.version,
    gameId,
    mode,
    result,
    placement,
    participantCount,
    eligible: true,
    blockedReason: null,
    currency,
    xp,
    baseCurrency,
    baseXp,
    gameWeight: weight,
    levelBefore,
    levelAfter,
    xpBefore,
    xpAfter,
    streakBefore,
    streakAfter,
    bestStreakAfter,
    dailyFirstWinGranted,
    dailyFirstWinDateAfter,
    dailyAICurrencyKeyAfter,
    dailyAICurrencyEarnedAfter,
    repeatTier,
    breakdown,
    rewardReasons,
  };
}

module.exports = {
  VALID_GAMES,
  REWARD_CONFIG,
  dayKey,
  xpRequiredForNextLevel,
  xpForLevel,
  levelFromXp,
  levelProgress,
  eligibilityThreshold,
  evaluateEligibility,
  normalizeRoomResults,
  repeatMultipliers,
  resolveMatchReward,
};
